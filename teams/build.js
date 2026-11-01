// Builds the Microsoft Teams app package (teams/build/ntt-data-hrms-teams.zip) that adds NTT DATA HRMS as a
// personal tab in Teams. Usage: set APP_URL in .env to the app's public HTTPS address, then `npm run teams:package`
// and upload the zip in Teams > Apps > Manage your apps > Upload an app.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const env = (() => {
  try {
    return Object.fromEntries(fs.readFileSync(path.join(here, '..', '.env'), 'utf8').split(/\r?\n/)
      .map((l) => l.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)).filter(Boolean).map((m) => [m[1], m[2]]));
  } catch { return {}; }
})();
const appUrl = (process.env.APP_URL || env.APP_URL || '').replace(/\/$/, '');
if (!/^https:\/\//.test(appUrl)) {
  console.error('Set APP_URL in .env to the app\'s public HTTPS address (Teams only loads https tabs), e.g. a dev tunnel URL.');
  process.exit(1);
}

// Keep the same app id across builds so Teams treats new packages as updates.
const idFile = path.join(here, 'app-id.txt');
if (!fs.existsSync(idFile)) fs.writeFileSync(idFile, crypto.randomUUID());
const id = fs.readFileSync(idFile, 'utf8').trim();

const manifest = {
  $schema: 'https://developer.microsoft.com/en-us/json-schemas/teams/v1.17/MicrosoftTeams.schema.json',
  manifestVersion: '1.17',
  version: '1.0.0',
  id,
  developer: { name: 'NTT DATA', websiteUrl: appUrl, privacyUrl: appUrl, termsOfUseUrl: appUrl },
  name: { short: 'NTT DATA HRMS', full: 'NTT DATA HRMS · Gemini HR agents' },
  description: {
    short: 'HR dashboards and Gemini agents on SAP SuccessFactors.',
    full: 'Personal HR dashboards, notifications and 18 Gemini agents for employees and HR operations, connected to SAP SuccessFactors, Jira and Microsoft 365.',
  },
  icons: { color: 'color.png', outline: 'outline.png' },
  accentColor: '#0072BC',
  staticTabs: [{ entityId: 'hrms', name: 'HRMS', contentUrl: appUrl, websiteUrl: appUrl, scopes: ['personal'] }],
  permissions: ['identity'],
  validDomains: [new URL(appUrl).host],
  ...(env.VITE_CLIENT_ID ? { webApplicationInfo: { id: env.VITE_CLIENT_ID, resource: `api://${new URL(appUrl).host}/${env.VITE_CLIENT_ID}` } } : {}),
};

const out = path.join(here, 'build');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out, 'manifest.json'), JSON.stringify(manifest, null, 2));
for (const icon of ['color.png', 'outline.png']) fs.copyFileSync(path.join(here, icon), path.join(out, icon));
const zip = 'ntt-data-hrms-teams.zip';
fs.rmSync(path.join(out, zip), { force: true });
execFileSync('tar', ['-a', '-cf', zip, 'manifest.json', 'color.png', 'outline.png'], { cwd: out });
console.log(`Teams package: ${path.join(out, zip)}\nTab URL: ${appUrl}`);
