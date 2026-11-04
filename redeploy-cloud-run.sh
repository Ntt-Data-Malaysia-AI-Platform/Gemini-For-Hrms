#!/usr/bin/env bash
# Rebuilds the image from the current code and rolls it out to the existing Cloud Run service.
# Secrets, settings, scaling and the service account stay exactly as already deployed, so no .env is needed.
# It also makes sure Firestore (free tier) exists and the service account can use it; there is no key to manage.
# Run in Google Cloud Shell from the repo folder after `git pull`:
#   bash redeploy-cloud-run.sh [project-id] [region]
set -euo pipefail

PROJECT_ID="${1:-$(gcloud config get-value project 2>/dev/null)}"
REGION="${2:-asia-southeast1}"
SERVICE="ntt-hrms"
REPO="hrms"

[ -f Dockerfile ] || { echo "ERROR: run this from the repo folder (Dockerfile not found)." >&2; exit 1; }
gcloud config set project "$PROJECT_ID" >/dev/null
gcloud config set run/region "$REGION" >/dev/null
echo "Project: $PROJECT_ID   Region: $REGION   Commit: $(git rev-parse --short HEAD 2>/dev/null || echo unknown)"

# The public Entra IDs are baked into the web app at build time; read them from the running service.
SVC_JSON=$(gcloud run services describe "$SERVICE" --format=json)
envval() { printf '%s' "$SVC_JSON" | jq -r --arg n "$1" '.spec.template.spec.containers[0].env[]? | select(.name==$n) | .value // empty'; }
CLIENT_ID=$(envval VITE_CLIENT_ID); TENANT_ID=$(envval VITE_TENANT_ID)
[ -n "$CLIENT_ID" ] || echo "note: VITE_CLIENT_ID is not set on the service; Microsoft 365 sign-in stays off."

# Firestore keeps applications, interviews and requests across restarts. The app reaches it with the service account
# attached to Cloud Run, so access is an IAM role, not a key. Safe to repeat.
echo; echo "==> Making sure Firestore is ready"
gcloud services enable firestore.googleapis.com
if ! gcloud firestore databases describe --database='(default)' >/dev/null 2>&1; then
  gcloud firestore databases create --database='(default)' --location="$REGION" --type=firestore-native
fi
RUN_SA=$(printf '%s' "$SVC_JSON" | jq -r '.spec.template.spec.serviceAccountName // empty')
if [ -n "$RUN_SA" ]; then
  gcloud projects add-iam-policy-binding "$PROJECT_ID" --member="serviceAccount:$RUN_SA" --role="roles/datastore.user" --condition=None >/dev/null
  echo "Granted roles/datastore.user to $RUN_SA"
else
  echo "note: the service has no dedicated service account; the default Compute account is used and needs roles/datastore.user."
fi

IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:$(date +%Y%m%d-%H%M%S)"

echo; echo "==> Building the container image (2-4 minutes)"
gcloud builds submit --config cloudbuild.yaml \
  --substitutions="_IMAGE=${IMAGE},_VITE_CLIENT_ID=${CLIENT_ID},_VITE_TENANT_ID=${TENANT_ID}"

echo; echo "==> Rolling out to Cloud Run"
gcloud run deploy "$SERVICE" --image="$IMAGE"

URL=$(gcloud run services describe "$SERVICE" --format="value(status.url)")
echo; echo "==> Checking the live service"
sleep 3
curl -fsS "$URL/api/catalog" | head -c 120 && echo
echo; echo "==> Firestore check from the new revision"
sleep 15
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE AND textPayload:\"[store]\"" --limit=3 --freshness=15m --format="value(textPayload)" || true
echo; echo "Deployed: $URL"
