# NTT DATA HRMS: Gemini × SAP SuccessFactors × Microsoft 365

Personal dashboards (KPI tiles, charts, notifications) and eighteen Gemini agents for two HR journeys:

| Persona | Signs in with | Agents | Data |
|---------|---------------|--------|------|
| **Tessa**, HR Analyst | Microsoft 365 work account (Entra ID) | Operations dashboard + 10 agents | **Live SAP SuccessFactors** where the API has it, built-in demo HR data for the rest |
| **Tyson Reed**, Employee | `Tyson@gmail.com` / `Tyson@123!@#` | Personal dashboard + 8 agents | Built-in demo HR data |

Every reply lists the tool calls behind it; calls to SAP are marked **SAP**. Dashboard widgets and notifications open the matching agent with the question already asked.

## Run it

```bash
npm install
npm run dev          # API on :8787 + web app on http://localhost:5173
```

If PowerShell blocks `npm` (script execution policy), run `node dev.js` instead.
The API uses `--use-system-ca` so corporate HTTPS inspection certificates are trusted.

## Configuration (`.env`, see `.env.example`)
- `VITE_CLIENT_ID`, `VITE_TENANT_ID`: Entra app registration for Tessa's sign-in. `http://localhost:5173` must be a
  **Single-page application** redirect URI on that registration.
- `GEMINI_API_KEY`: Google AI Studio key. Without it the agents still run their tools and show templated answers.
- `SAP_API_KEY`: SAP Business Accelerator Hub key for the SuccessFactors sandbox
  (`sandbox.api.sap.com/successfactors/odata/v2`). For a real tenant set `SAP_BASE_URL`, `SAP_USERNAME`, `SAP_PASSWORD`.
- `HR_ALLOWED_USERS`: optional allow-list of Microsoft 365 emails for HR operations (empty = anyone in the tenant).
- `ALLOW_DEMO_HR=true`: adds "Continue as Tessa (demo)" to the landing page, for demos before Entra is ready.

## Jira (IT & Facilities requests)
Requests raised with the IT & Facilities Assistant (parking permit, laptop, software access, badge…) are created as
Jira issues (`server/jira.js`, REST API v3) in `JIRA_PROJECT_KEY` (or the first visible project). The chat, the dashboard
widget and notifications show the Jira key, link, live status and assignee. If Jira is unreachable the request is kept
as **Jira sync pending** and pushed automatically the next time requests are viewed. Requests persist in `server/.cache`.

## OneDrive documents (HR operations)
Tessa's **Documents · OneDrive** screen browses and searches her OneDrive and has Gemini extract the HR details of a
document (type, people, dates, amounts, completeness, discrepancies; identity and bank numbers masked). Word, Excel and
PowerPoint files are converted to PDF by Microsoft Graph first. The HR Document Processing Agent can use the same tools.

- The Entra app registration needs the **Microsoft Graph delegated permission `Files.Read.All`** (admin consent if your
  tenant requires it). It is requested only when the user clicks **Connect OneDrive**, so sign-in works without it.
- The browser sends the user's delegated Graph token with each OneDrive request (`x-graph-token`); the server uses it for
  that request only and never stores it. Only Microsoft 365 sessions with the HR role can use OneDrive.

## Response style
All agents share one house style (`STYLE` in `server/agents.js`): headline, highlighted summary, tables for records,
pointers for insights, short paragraphs for explanations, and **Next steps** that render as buttons; clicking one sends
that request to the agent.

## How it works
```
Browser (React, Vite)                     server/ (Node, no dependencies)
  Landing: M365 button ──MSAL redirect──▶ Microsoft Entra ID
           ID token ───────────────────▶ /api/auth/m365  verifies signature, audience, tenant → HR session
  Landing: email + password ───────────▶ /api/auth/login  scrypt-hashed demo credential → employee session
  Workspace chat ──────────────────────▶ /api/chat ─▶ Gemini function calling (up to 6 rounds)
                                                     ├─ sap_* tools ─▶ SAP SuccessFactors OData v2
                                                     └─ HRMS tools ─▶ built-in demo HR data
```

- `server/agents.js`: the 18 agents (system prompt, allowed tools, suggested prompts).
- `server/sap.js`: live SAP tools. Queries select only needed fields (no SSN, phone, address, bank data), aggregate
  server-side, run one at a time, cache for 30 minutes (also on disk in `server/.cache`), warm up in the background at
  start-up and every 25 minutes, and fall back to the last good result if the sandbox rate limit is hit.
- `server/dashboard.js`: dashboard tiles, chart series and notifications for each persona.
- `server/tools.js`, `server/mockHr.js`: built-in HR tools and demo data.
- `server/gemini.js`: Gemini loop; each tool result is tagged with its source so answers attribute figures correctly.
- `server/auth.js`: Microsoft ID token verification (Microsoft signing keys, `aud`, `iss`, `tid`, `exp`) and demo login.
- `src/`: landing page, sign-in flows, dashboards (`components/Dashboard.tsx`, `components/charts.tsx`) and agent workspace.

## Which HR operations agents use SAP

| Agent | SAP SuccessFactors entities | Built-in demo data |
|-------|-----------------------------|----------------|
| HR Operations Copilot | `EmployeeTime` (pending approvals), `JobApplication`, `FormHeader`, `Position` | cases and approvals queue |
| Recruitment Operations | `JobRequisition`, `JobApplication` | interview scheduling |
| Payroll Operations | `EmpPayCompRecurring` (duplicates, large changes, outliers) | payroll run, missing timesheets |
| Workforce Planning | `User`, `Position` | |
| Performance Operations | `FormHeader` (review forms; status 3 = completed) | |
| Attrition Intelligence | `User` (risk of loss, performance labels) | |
| HR Executive Reporting | all of the above | |
| Case Management, Compliance, Document Processing | | all (no matching sandbox API) |

The SAP sandbox is shared, read-only and rate limited; its data is SAP's demo company, not NTT DATA's.

## Before real use
- Replace the demo employee login with your identity provider.
- The previous `.env` still holds `VITE_SECRET_ID` (an Entra client secret) and Supabase values from the old app.
  Nothing reads them now. A client secret must never be in a `VITE_*` variable; remove it and rotate it.
- The earlier SAP key was hardcoded in `supabase/functions/sap-analyze`; it now lives only in `.env`.
  The previous project is preserved in `../project-backup-2026-11-01`.
