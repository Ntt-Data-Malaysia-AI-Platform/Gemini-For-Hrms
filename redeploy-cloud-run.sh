#!/usr/bin/env bash
# Rebuilds the image from the current code and rolls it out to the existing Cloud Run service.
# Secrets, settings, scaling and the service account stay exactly as already deployed, so no .env is needed.
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
echo; echo "Deployed: $URL"
