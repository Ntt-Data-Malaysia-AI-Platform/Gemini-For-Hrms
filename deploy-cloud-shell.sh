#!/usr/bin/env bash
# Deploys NTT DATA HRMS to Cloud Run with every key from .env stored in Secret Manager.
# Run in Google Cloud Shell, from the repo folder that also contains your uploaded .env:
#   bash deploy-cloud-shell.sh [project-name-or-id] [region]
# Safe to re-run: secrets get a new version, the service gets a new revision.
set -euo pipefail

PROJECT_QUERY="${1:-HRMS}"
REGION="${2:-asia-southeast1}"
SERVICE="ntt-hrms"
REPO="hrms"
SA_NAME="hrms-run"
ENV_FILE=".env"

# Keys go to Secret Manager; everything else is a plain setting.
SECRET_NAMES=(GEMINI_API_KEY SAP_API_KEY SAP_PASSWORD JIRA_API_TOKEN TEAMS_WEBHOOK_URL)
SETTING_NAMES=(GEMINI_MODEL VITE_CLIENT_ID VITE_TENANT_ID SAP_BASE_URL SAP_USERNAME JIRA_BASE_URL JIRA_EMAIL JIRA_PROJECT_KEY JIRA_ISSUE_TYPE HR_ALLOWED_USERS)

say() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

[ -f "$ENV_FILE" ] || die "$ENV_FILE not found in $(pwd). Upload it to Cloud Shell (menu with three dots > Upload) into this folder, then run again."
[ -f Dockerfile ] || die "Run this from the repo folder (Dockerfile not found)."

# Value of NAME from .env, without quotes or carriage returns. Never printed.
envval() {
  local line
  line=$(grep -E "^[[:space:]]*$1[[:space:]]*=" "$ENV_FILE" | tail -n 1 || true)
  [ -z "$line" ] && return 0
  line="${line#*=}"
  line="${line%$'\r'}"
  line="$(printf '%s' "$line" | sed -E 's/^[[:space:]]+//; s/[[:space:]]+$//; s/^"(.*)"$/\1/; s/^'"'"'(.*)'"'"'$/\1/')"
  printf '%s' "$line"
}

# ---------- Project ----------
say "Finding the Google Cloud project \"$PROJECT_QUERY\""
PROJECT_ID=$(gcloud projects list --filter="projectId=$PROJECT_QUERY OR name=$PROJECT_QUERY" --format="value(projectId)" | head -n 1)
[ -n "$PROJECT_ID" ] || die "No project with the name or ID \"$PROJECT_QUERY\" is visible to $(gcloud config get-value account 2>/dev/null). Pass the project ID as the first argument."
gcloud config set project "$PROJECT_ID" >/dev/null
gcloud config set run/region "$REGION" >/dev/null
echo "Project: $PROJECT_ID   Region: $REGION"
BILLING=$(gcloud billing projects describe "$PROJECT_ID" --format="value(billingEnabled)" 2>/dev/null || echo "")
[ "$BILLING" = "True" ] || die "Billing is not enabled on $PROJECT_ID. Enable it (Console > Billing) and run again."

SA_EMAIL="${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:$(date +%Y%m%d-%H%M%S)"

# ---------- APIs, image repository, service account ----------
say "Enabling Cloud Run, Secret Manager and the build services they rely on"
gcloud services enable run.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com

say "Preparing the image repository and the runtime service account"
gcloud artifacts repositories describe "$REPO" --location="$REGION" >/dev/null 2>&1 \
  || gcloud artifacts repositories create "$REPO" --repository-format=docker --location="$REGION" --description="NTT DATA HRMS images" >/dev/null
gcloud iam service-accounts describe "$SA_EMAIL" >/dev/null 2>&1 \
  || gcloud iam service-accounts create "$SA_NAME" --display-name="NTT DATA HRMS Cloud Run" >/dev/null

# ---------- Secrets from .env ----------
say "Storing keys from .env in Secret Manager"
STORED=()
for NAME in "${SECRET_NAMES[@]}"; do
  VAL="$(envval "$NAME")"
  if [ -z "$VAL" ] || [[ "$VAL" == your-* ]]; then echo "  skip   $NAME (empty or placeholder in .env)"; continue; fi
  if gcloud secrets describe "$NAME" >/dev/null 2>&1; then
    printf '%s' "$VAL" | gcloud secrets versions add "$NAME" --data-file=- >/dev/null
    echo "  update $NAME (new version)"
  else
    printf '%s' "$VAL" | gcloud secrets create "$NAME" --replication-policy=automatic --data-file=- >/dev/null
    echo "  create $NAME"
  fi
  gcloud secrets add-iam-policy-binding "$NAME" --member="serviceAccount:$SA_EMAIL" --role="roles/secretmanager.secretAccessor" >/dev/null
  STORED+=("$NAME")
done
unset VAL
[ "${#STORED[@]}" -gt 0 ] || die "No keys found in $ENV_FILE."
printf '%s\n' "${STORED[@]}" | grep -qx GEMINI_API_KEY || die "GEMINI_API_KEY is missing from $ENV_FILE; the agents need it."
SECRET_FLAGS=$(for N in "${STORED[@]}"; do printf '%s=%s:latest,' "$N" "$N"; done | sed 's/,$//')
grep -qE '^[[:space:]]*VITE_SECRET_ID[[:space:]]*=[[:space:]]*[^[:space:]]' "$ENV_FILE" && echo "  note: VITE_SECRET_ID is in .env and is NOT deployed (an Entra client secret must not be in a VITE_ variable; remove and rotate it)."

# ---------- Plain settings ----------
ENV_YAML=$(mktemp)
trap 'rm -f "$ENV_YAML"' EXIT
{
  echo 'ALLOW_DEMO_HR: "false"'
  for NAME in "${SETTING_NAMES[@]}"; do
    V="$(envval "$NAME")"
    [ -z "$V" ] && continue
    V="${V//\\/\\\\}"; V="${V//\"/\\\"}"
    printf '%s: "%s"\n' "$NAME" "$V"
  done
} > "$ENV_YAML"
echo "Settings being applied (no secrets):"; cut -d: -f1 "$ENV_YAML" | sed 's/^/  /'

# ---------- Build ----------
say "Letting Cloud Build push to the image repository"
PROJECT_NUMBER=$(gcloud projects describe "$PROJECT_ID" --format="value(projectNumber)")
BUILD_SA="${PROJECT_NUMBER}-compute@developer.gserviceaccount.com"
for ROLE in artifactregistry.writer logging.logWriter storage.objectViewer; do
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$BUILD_SA" --role="roles/$ROLE" >/dev/null
done

say "Building the container image (2-4 minutes)"
gcloud builds submit --config cloudbuild.yaml \
  --substitutions="_IMAGE=${IMAGE},_VITE_CLIENT_ID=$(envval VITE_CLIENT_ID),_VITE_TENANT_ID=$(envval VITE_TENANT_ID)"

# ---------- Deploy ----------
say "Deploying to Cloud Run"
gcloud run deploy "$SERVICE" \
  --image="$IMAGE" \
  --service-account="$SA_EMAIL" \
  --env-vars-file="$ENV_YAML" \
  --set-secrets="$SECRET_FLAGS" \
  --allow-unauthenticated \
  --port=8080 --cpu=1 --memory=512Mi \
  --min-instances=0 --max-instances=1 --timeout=300

URL=$(gcloud run services describe "$SERVICE" --format="value(status.url)")
gcloud run services update "$SERVICE" --update-env-vars="APP_URL=$URL" >/dev/null

# ---------- Check ----------
say "Checking the live service"
sleep 3
curl -fsS "$URL/api/catalog" | head -c 160 && echo
echo
echo "Deployed:  $URL"
echo "Secrets:   ${STORED[*]}"
echo
echo "If you use Sign in with Microsoft 365: in Azure portal > Entra ID > App registrations > your app > Authentication,"
echo "add this as a Single-page application redirect URI (and the same with a trailing /):"
echo "  $URL"
