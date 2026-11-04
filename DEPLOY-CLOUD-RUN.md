# Deploy NTT DATA HRMS to Google Cloud Run (keys in Secret Manager)

This guide deploys the app as **one Cloud Run service**: the container serves the built web app and the API together.

Everything is read from your local **`.env`**:

- **Keys and tokens** go to **Secret Manager**. Cloud Run reads them at startup as environment variables, so no key is ever put in the image, the source code, a command line or this guide.
- **Plain settings** (model name, Jira site, Entra IDs and so on) are written into `cloudrun-env.yaml` automatically and applied to the service.

At the end there is a **teardown** section that removes everything again.

> Commands are for **Windows PowerShell**. Run them from the project folder:
> `C:\Users\deepanraj.vellingiri\OneDrive - NTT Ltd\Documents\SOW\Captial A\project`

---

## What gets deployed

| Piece | Where it lives | Notes |
|---|---|---|
| Container image | Artifact Registry (`hrms` repository) | Built by Cloud Build from `Dockerfile` + `cloudbuild.yaml` |
| Web app + API | Cloud Run service `ntt-hrms` | Listens on the port Cloud Run gives it (`PORT`) |
| Secrets | Secret Manager | Every non-empty key from `.env` listed below |
| Plain settings | Cloud Run env vars (from `cloudrun-env.yaml`, generated from `.env`) | Not credentials |
| Runtime identity | Service account `hrms-run` | Can read only these secrets, nothing else |

### What is read from `.env`

| `.env` variable | Goes to | Used for |
|---|---|---|
| `GEMINI_API_KEY` | **Secret Manager** | Gemini agents, document extraction, report narrative |
| `SAP_API_KEY` | **Secret Manager** | SAP SuccessFactors sandbox |
| `SAP_PASSWORD` | **Secret Manager** | Only for a real SAP tenant |
| `JIRA_API_TOKEN` | **Secret Manager** | Raising and reading Jira issues |
| `TEAMS_WEBHOOK_URL` | **Secret Manager** | Posting notifications to a Teams channel |
| `VITE_CLIENT_ID`, `VITE_TENANT_ID` | Build arguments + settings | Public Entra IDs: baked into the web app and used by the server to verify Microsoft sign-ins |
| `GEMINI_MODEL`, `SAP_BASE_URL`, `SAP_USERNAME`, `JIRA_BASE_URL`, `JIRA_EMAIL`, `JIRA_PROJECT_KEY`, `JIRA_ISSUE_TYPE`, `HR_ALLOWED_USERS` | Settings (`cloudrun-env.yaml`) | Not credentials |
| `ALLOW_DEMO_HR` | Settings, **always set to `false`** in the cloud | The "Continue as Tessa (demo)" shortcut stays off |
| `APP_URL` | Settings, set to the Cloud Run URL after the first deploy | Teams cards and the Teams tab |
| `API_PORT` | Not used | Cloud Run supplies `PORT` itself |

Empty values are skipped: if, say, `TEAMS_WEBHOOK_URL` is blank, no secret is created and that feature shows as "not configured".

### Sign-in accounts

| Who | How they sign in | Role |
|---|---|---|
| Tyson Reed | **Sign in with email**: `tyson@gmail.com` + the demo password | Employee: 8 self-service agents |
| Tessa Nguyen | **Sign in with email**: `tessa@gmail.com` + the demo password | HR analyst: 10 HR operations agents |
| Any HR user in your tenant | **Sign in with Microsoft 365** (limited to `HR_ALLOWED_USERS` if set) | HR analyst, plus OneDrive documents and Outlook drafts |

The email accounts are stored in `server/auth.js` as salted scrypt hashes, not as plain passwords, so they work in the cloud with nothing extra to configure. Passwords are not written in this guide on purpose. OneDrive and Outlook features need a Microsoft 365 sign-in, so Tessa's email login sees everything except those two.

> **Before you start:** rotate the Jira API token that was printed earlier in development (https://id.atlassian.com/manage-profile/security/api-tokens), put the **new** token in `.env`, and delete the unused `VITE_SECRET_ID` line from `.env` if it is still there.

---

## 0. Prerequisites

1. A Google Cloud project with **billing enabled**.
2. Google Cloud CLI installed: https://cloud.google.com/sdk/docs/install (then open a new PowerShell window).
3. You have **Owner**, or these roles on the project: Cloud Run Admin, Secret Manager Admin, Artifact Registry Admin, Cloud Build Editor, Service Account Admin, Project IAM Admin, Service Usage Admin.

Sign in and check:

```powershell
gcloud auth login
gcloud --version
```

> **Corporate network (NTT proxy):** if `gcloud` fails with certificate errors, point it at the corporate root CA:
> `gcloud config set core/custom_ca_certs_file "C:\path\to\corporate-root-ca.pem"`

---

## 1. Set variables and load `.env`

Change the first two lines, then paste the whole block. Later steps reuse these variables and the `Get-EnvValue` helper. **If you open a new PowerShell window, paste this block again first.**

```powershell
$PROJECT_ID = "your-gcp-project-id"
$REGION     = "asia-southeast1"          # pick the region closest to your users
$SERVICE    = "ntt-hrms"
$REPO       = "hrms"
$SA_NAME    = "hrms-run"
$SA_EMAIL   = "$SA_NAME@$PROJECT_ID.iam.gserviceaccount.com"
$IMAGE      = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/${SERVICE}:v1"

gcloud config set project $PROJECT_ID
gcloud config set run/region $REGION

# Read values from .env without printing them
$envFile = Get-Content .env | Where-Object { $_ -match '^\s*[A-Z0-9_]+\s*=' }
function Get-EnvValue($name) {
  $line = $envFile | Where-Object { $_ -match "^\s*$name\s*=" } | Select-Object -First 1
  if ($line) { ($line -split '=', 2)[1].Trim().Trim('"').Trim("'") } else { "" }
}

# Which .env values are secrets and which are plain settings
$SECRET_NAMES  = @("GEMINI_API_KEY", "SAP_API_KEY", "SAP_PASSWORD", "JIRA_API_TOKEN", "TEAMS_WEBHOOK_URL")
$SETTING_NAMES = @("GEMINI_MODEL", "VITE_CLIENT_ID", "VITE_TENANT_ID", "SAP_BASE_URL", "SAP_USERNAME",
                   "JIRA_BASE_URL", "JIRA_EMAIL", "JIRA_PROJECT_KEY", "JIRA_ISSUE_TYPE", "HR_ALLOWED_USERS", "APP_URL")

# Quick check: which values were found (names and lengths only)
foreach ($n in $SECRET_NAMES + $SETTING_NAMES) { "{0,-18} {1}" -f $n, $(if (Get-EnvValue $n) { "found ($((Get-EnvValue $n).Length) chars)" } else { "empty" }) }
```

---

## 2. Enable the APIs

```powershell
gcloud services enable run.googleapis.com cloudbuild.googleapis.com artifactregistry.googleapis.com secretmanager.googleapis.com firestore.googleapis.com
```

---

## 3. Create the image repository

```powershell
gcloud artifacts repositories create $REPO --repository-format=docker --location=$REGION --description="NTT DATA HRMS images"
```

---

## 4. Create the runtime service account

Cloud Run runs the app as this account. It gets **no project roles**, only read access to the specific secrets (step 5).

```powershell
gcloud iam service-accounts create $SA_NAME --display-name="NTT DATA HRMS Cloud Run"
```

---

## 5. Store the keys from `.env` in Secret Manager

For every non-empty secret in `.env`, this:

1. writes the value to a temp file with no trailing newline (so it doesn't end up on screen or in your shell history),
2. creates the secret, or adds a new version if it already exists,
3. deletes the temp file,
4. lets the `hrms-run` service account read that one secret,
5. remembers it for the deploy command (`$SECRET_FLAGS`).

```powershell
$stored = @()
foreach ($name in $SECRET_NAMES) {
  $value = Get-EnvValue $name
  if (-not $value) { Write-Host "Skipping $name (empty in .env)"; continue }
  $tmp = New-TemporaryFile
  [System.IO.File]::WriteAllText($tmp, $value)
  gcloud secrets describe $name *> $null
  if ($LASTEXITCODE -eq 0) { gcloud secrets versions add $name --data-file="$tmp" | Out-Null }
  else { gcloud secrets create $name --replication-policy=automatic --data-file="$tmp" | Out-Null }
  Remove-Item $tmp -Force
  gcloud secrets add-iam-policy-binding $name --member="serviceAccount:$SA_EMAIL" --role="roles/secretmanager.secretAccessor" | Out-Null
  $stored += $name
  Write-Host "Stored $name and granted $SA_NAME access"
}
$SECRET_FLAGS = ($stored | ForEach-Object { "$_=${_}:latest" }) -join ","
"Secrets for the deploy: $($stored -join ', ')"
```

Check what exists (names and versions only, never values):

```powershell
gcloud secrets list
```

> If you open a new window later, rebuild `$SECRET_FLAGS` from what is in Secret Manager:
> ```powershell
> $stored = $SECRET_NAMES | Where-Object { gcloud secrets describe $_ *> $null; $LASTEXITCODE -eq 0 }
> $SECRET_FLAGS = ($stored | ForEach-Object { "$_=${_}:latest" }) -join ","
> ```

---

## 6. Generate `cloudrun-env.yaml` from `.env`

This writes the plain settings to `cloudrun-env.yaml` (git-ignored). `ALLOW_DEMO_HR` is always `false` in the cloud. A YAML file is used instead of `--set-env-vars` because `HR_ALLOWED_USERS` can contain commas.

```powershell
$yaml = @('ALLOW_DEMO_HR: "false"')
foreach ($name in $SETTING_NAMES) {
  $value = Get-EnvValue $name
  if ($value) { $yaml += ('{0}: "{1}"' -f $name, ($value -replace '\\', '\\' -replace '"', '\"')) }
}
[System.IO.File]::WriteAllLines("$PWD\cloudrun-env.yaml", $yaml)
Get-Content cloudrun-env.yaml
```

Review the printed file. It holds only settings, no keys.

---

## 7. Build the container image

`VITE_CLIENT_ID` and `VITE_TENANT_ID` are baked into the web app at build time (they are public IDs, not secrets).

```powershell
$VITE_CLIENT_ID = Get-EnvValue "VITE_CLIENT_ID"
$VITE_TENANT_ID = Get-EnvValue "VITE_TENANT_ID"

gcloud builds submit --config cloudbuild.yaml `
  --substitutions="_IMAGE=$IMAGE,_VITE_CLIENT_ID=$VITE_CLIENT_ID,_VITE_TENANT_ID=$VITE_TENANT_ID"
```

This uploads the project (minus `node_modules`, `dist`, `.env`, `cloudrun-env.yaml` and caches, see `.dockerignore`), builds it in Cloud Build and pushes the image. It takes about 2–4 minutes.

> **If the build fails with a permission error on Artifact Registry or logs:** newer projects run Cloud Build as the Compute Engine default service account. Grant it the writer roles, then rerun the build:
> ```powershell
> $PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
> $BUILD_SA = "$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
> gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$BUILD_SA" --role="roles/artifactregistry.writer"
> gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$BUILD_SA" --role="roles/logging.logWriter"
> gcloud projects add-iam-policy-binding $PROJECT_ID --member="serviceAccount:$BUILD_SA" --role="roles/storage.objectViewer"
> ```

---

## 8. Deploy to Cloud Run

```powershell
gcloud run deploy $SERVICE `
  --image=$IMAGE `
  --service-account=$SA_EMAIL `
  --env-vars-file=cloudrun-env.yaml `
  --set-secrets=$SECRET_FLAGS `
  --allow-unauthenticated `
  --port=8080 `
  --cpu=1 --memory=512Mi `
  --min-instances=0 --max-instances=1 `
  --timeout=300
```

Why these flags:

- `--set-secrets` maps each stored secret to an environment variable with the same name, so the app reads it exactly as it reads `.env` locally. `$SECRET_FLAGS` contains only the secrets created in step 5.
- `--allow-unauthenticated` makes the landing page public; the app does its own sign-in (email accounts, or Microsoft 365 for HR). If your org policy blocks public services, see *Restricting access* below.
- `--max-instances=1`: sign-in sessions are kept in memory, so all requests must reach the same instance. Raising this would log people out at random.
- `--min-instances=0` scales to zero when idle (lowest cost; the first request after idle takes a few seconds). Use `1` for a demo that must be instant (costs more).
- `--timeout=300` leaves room for Gemini calls that run several SAP queries.

When it finishes, gcloud prints the **Service URL**, e.g. `https://ntt-hrms-xxxxxxxx-as.a.run.app`.

### Set the public URL

```powershell
$URL = gcloud run services describe $SERVICE --format="value(status.url)"
gcloud run services update $SERVICE --update-env-vars="APP_URL=$URL"
$URL
```

Also put this URL in your local `.env` as `APP_URL=` so the next run of step 6 keeps it.

---

## 9. Point Microsoft 365 sign-in at the new URL

Microsoft only returns users to addresses you have registered. (Skip this if you only use the email sign-ins.)

1. Azure portal → **Microsoft Entra ID** → **App registrations** → your HRMS app.
2. **Authentication** → under **Single-page application**, **Add URI**: paste the Service URL (for example `https://ntt-hrms-xxxxxxxx-as.a.run.app`) and also the same URL with a trailing `/`.
3. **Save**. Keep `http://localhost:5173` if you still develop locally.

If you use a custom domain later, add that address here too.

---

## 10. Check that it works

```powershell
# The server is up and sees its configuration (agent list and connection status; no secrets are returned)
(Invoke-RestMethod "$URL/api/catalog").status

# Open the app
Start-Process $URL
```

Then in the browser:

1. **Employee:** under **Sign in with email**, sign in as `tyson@gmail.com`, open an agent from the **Agent** dropdown and ask a question.
2. **HR:** sign out, then sign in with email as `tessa@gmail.com`. You should land on the HR home with the 10 operations agents. Optionally also try **Sign in with Microsoft 365**.
3. The top bar should show `Gemini 3.5 · SAP · Jira · M365`.

Logs:

```powershell
gcloud logging read "resource.type=cloud_run_revision AND resource.labels.service_name=$SERVICE" --limit=50 --format="value(timestamp,textPayload)"
```

---

## Updating the app

After code changes, build a new image tag and deploy it (settings and secrets are kept):

```powershell
$IMAGE = "$REGION-docker.pkg.dev/$PROJECT_ID/$REPO/${SERVICE}:v2"
gcloud builds submit --config cloudbuild.yaml --substitutions="_IMAGE=$IMAGE,_VITE_CLIENT_ID=$VITE_CLIENT_ID,_VITE_TENANT_ID=$VITE_TENANT_ID"
gcloud run deploy $SERVICE --image=$IMAGE
```

After editing **settings** in `.env`: rerun step 6, then

```powershell
gcloud run services update $SERVICE --env-vars-file=cloudrun-env.yaml
```

## Rotating a key

Put the new value in `.env`, rerun the **step 1** block (to reload `.env`) and the **step 5** block (adds a new version of each secret), then roll out a new revision so Cloud Run reads it (`:latest` is resolved when an instance starts):

```powershell
gcloud run services update $SERVICE --update-secrets=$SECRET_FLAGS
```

Once the new revision works, disable the old version of the rotated secret, for example:

```powershell
gcloud secrets versions list JIRA_API_TOKEN
gcloud secrets versions disable 1 --secret=JIRA_API_TOKEN
```

## Restricting access (optional)

If the app should not be public:

- **Organisation users only:** deploy with `--no-allow-unauthenticated` and put **Identity-Aware Proxy** in front of it (Cloud Run → service → *Security* → enable IAP), then grant `IAP-secured Web App User` to your users or group.
- **Ingress:** `--ingress=internal-and-cloud-load-balancing` together with a load balancer and Cloud Armor rules for IP allow-lists.

## Good to know

- **The demo email accounts are public-facing.** Anyone who knows the Tyson or Tessa password can sign in to a public service. For anything beyond a demo, use Microsoft 365 for HR plus `HR_ALLOWED_USERS`, or put IAP in front (see above).
- **Data is kept in Firestore.** Job applications, interview rounds and IT/facilities requests are stored in a Firestore database (free tier: 1 GiB, 50,000 reads and 20,000 writes a day) and survive restarts. The app reaches it through the Cloud Run service account with the `roles/datastore.user` role, so there is **no key to create or store**. `redeploy-cloud-run.sh` and `deploy-cloud-shell.sh` create the database and grant the role. Locally the same data is kept in `server/.cache` files. The SAP response cache is still in memory and is simply fetched again after a restart.
- **Optional budget alert.** Firestore costs nothing inside the free quota, but a budget alert at a few dollars (Billing > Budgets) is a cheap safety net.
- **The SAP sandbox is rate-limited.** The app throttles and caches calls, but a cold start runs a warm-up that may take ~30 seconds before every widget fills in.
- **Teams tab:** after deploying, set `APP_URL` in your local `.env` to the Service URL and run `npm run teams:package` so the Teams package points at Cloud Run.
- **Costs:** with `min-instances=0` you pay only while requests are served, plus small charges for Artifact Registry storage, Cloud Build minutes and Secret Manager access. Gemini, SAP and Jira usage is billed by those services.

---

# Teardown: remove Cloud Run, Secret Manager and everything else

Run these in a PowerShell window where the **step 1 block** has been pasted (it sets the variables). Each delete asks you to confirm unless it says `--quiet`.

### 1. Delete the Cloud Run service

```powershell
gcloud run services delete $SERVICE --region=$REGION
```

The URL stops working immediately.

### 2. Delete the secrets (all versions)

```powershell
foreach ($name in $SECRET_NAMES) {
  gcloud secrets describe $name *> $null
  if ($LASTEXITCODE -eq 0) { gcloud secrets delete $name --quiet; Write-Host "Deleted secret $name" }
}
gcloud secrets list
```

> Deleting a secret is permanent. If these keys were only ever used for this app, also **revoke them at the source**: Gemini key in Google AI Studio, SAP key on api.sap.com, Jira token at id.atlassian.com, and remove the Teams Workflow.

### 3. Delete the container images and repository

```powershell
gcloud artifacts repositories delete $REPO --location=$REGION
```

### 4. Delete the service account

```powershell
gcloud iam service-accounts delete $SA_EMAIL
```

### 4b. Delete the Firestore database and its role

```bash
gcloud firestore databases delete --database='(default)'
gcloud projects remove-iam-policy-binding $PROJECT_ID --member="serviceAccount:$SA_EMAIL" --role="roles/datastore.user" --condition=None
```

(Run the role removal before deleting the service account in step 4 if you want it removed cleanly.)

### 5. Remove Cloud Build's upload bucket (optional)

Cloud Build keeps the uploaded source in a bucket named `<project-id>_cloudbuild`.

```powershell
gcloud storage rm --recursive "gs://${PROJECT_ID}_cloudbuild"
```

If you granted extra roles to the build service account in step 7, remove them:

```powershell
$PROJECT_NUMBER = gcloud projects describe $PROJECT_ID --format="value(projectNumber)"
$BUILD_SA = "$PROJECT_NUMBER-compute@developer.gserviceaccount.com"
foreach ($role in @("roles/artifactregistry.writer", "roles/logging.logWriter", "roles/storage.objectViewer")) {
  gcloud projects remove-iam-policy-binding $PROJECT_ID --member="serviceAccount:$BUILD_SA" --role=$role --quiet | Out-Null
}
```

### 6. Turn off the APIs (optional)

Only if nothing else in the project uses them:

```powershell
gcloud services disable run.googleapis.com secretmanager.googleapis.com artifactregistry.googleapis.com cloudbuild.googleapis.com --force
```

### 7. Clean up locally and in Microsoft Entra

```powershell
Remove-Item cloudrun-env.yaml -ErrorAction SilentlyContinue
```

Azure portal → App registrations → your HRMS app → **Authentication** → remove the Cloud Run redirect URIs → **Save**. Reset `APP_URL=` in `.env` if you set it.

### 8. Check that nothing is left

```powershell
gcloud run services list
gcloud secrets list
gcloud artifacts repositories list --location=$REGION
gcloud iam service-accounts list --filter="email:$SA_EMAIL"
```

All four should come back empty for these names.

### Everything at once: delete the whole project

If the project was created just for this demo, deleting it removes every resource above in one step (it can be restored for 30 days):

```powershell
gcloud projects delete $PROJECT_ID
```

---

## Files used for deployment

| File | Purpose |
|---|---|
| `Dockerfile` | Builds the web app, then a small runtime image (Node 22, no `node_modules`, runs as the non-root `node` user) |
| `.dockerignore` | Keeps `.env`, `cloudrun-env.yaml`, `node_modules`, `dist` and caches out of the build upload |
| `cloudbuild.yaml` | Cloud Build steps; passes the public Entra IDs as build arguments |
| `cloudrun-env.yaml` | Generated in step 6 from `.env`: plain runtime settings only; git-ignored |
| `server/index.js` | Listens on `PORT` (Cloud Run) and falls back to `API_PORT` locally; serves `.jpg`/`.webp` images with the right type |
| `server/auth.js` | Email sign-in accounts for Tyson (employee) and Tessa (HR), stored as salted hashes |
