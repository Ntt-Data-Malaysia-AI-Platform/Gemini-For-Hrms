// Small persistence layer. On Cloud Run the data lives in Firestore (free tier), reached with the service account's own
// access token from the metadata server, so no key or dependency is needed. Everywhere else it uses files in server/.cache.
// Each named store is one document: hrms_state/<name> with the data as a JSON string.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '.cache');
const EMULATOR = process.env.FIRESTORE_EMULATOR_HOST || null; // standard Firestore emulator variable, handy for tests
const useFirestore = process.env.FIRESTORE !== 'off' && (Boolean(process.env.K_SERVICE) || process.env.FIRESTORE === 'on' || Boolean(EMULATOR));
export const mode = useFirestore ? 'firestore' : 'files';

const META = 'http://metadata.google.internal/computeMetadata/v1';
const metaGet = async (p) => {
  const r = await fetch(`${META}/${p}`, { headers: { 'Metadata-Flavor': 'Google' }, signal: AbortSignal.timeout(5000) });
  if (!r.ok) throw new Error(`metadata server ${r.status}`);
  return r;
};
let tokenCache = { value: null, exp: 0 };
async function token() {
  if (EMULATOR) return 'owner';
  if (tokenCache.value && Date.now() < tokenCache.exp - 60_000) return tokenCache.value;
  const j = await (await metaGet('instance/service-accounts/default/token')).json();
  tokenCache = { value: j.access_token, exp: Date.now() + j.expires_in * 1000 };
  return tokenCache.value;
}
let projectId = process.env.GOOGLE_CLOUD_PROJECT || (EMULATOR ? 'demo-hrms' : null);
const project = async () => projectId || (projectId = (await (await metaGet('project/project-id')).text()).trim());
const docUrl = async (name) => `${EMULATOR ? `http://${EMULATOR}` : 'https://firestore.googleapis.com'}/v1/projects/${await project()}/databases/(default)/documents/hrms_state/${encodeURIComponent(name)}`;

async function fsRequest(name, method, body, query = '') {
  const res = await fetch(`${await docUrl(name)}${query}`, {
    method,
    headers: { authorization: `Bearer ${await token()}`, 'content-type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(15000),
  });
  if (res.status === 404 && method === 'GET') return null;
  if (!res.ok) throw new Error(`Firestore ${method} ${name} failed (${res.status}): ${(await res.text()).slice(0, 240)}`);
  return res.json();
}

const filePath = (name) => path.join(DIR, `${name}.json`);
const readFile = (name) => { try { return JSON.parse(fs.readFileSync(filePath(name), 'utf8')); } catch { return null; } };
const writeFile = (name, data) => { try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(filePath(name), JSON.stringify(data, null, 2)); } catch { /* best effort */ } };

// Load a named store, or `fallback` if nothing has been saved yet.
export async function load(name, fallback) {
  if (useFirestore) {
    try {
      const doc = await fsRequest(name, 'GET');
      const text = doc?.fields?.json?.stringValue;
      if (text) return JSON.parse(text);
      return readFile(name) ?? fallback;
    } catch (e) {
      console.error(`[store] ${e.message}. Using ${readFile(name) ? 'the local copy' : 'defaults'} for "${name}".`);
      return readFile(name) ?? fallback;
    }
  }
  return readFile(name) ?? fallback;
}

// Save a named store. Writes for one store are queued so they land in order; failures are logged, never thrown.
const queues = new Map();
export function save(name, data) {
  const json = JSON.stringify(data);
  if (!useFirestore) { writeFile(name, data); return Promise.resolve(); }
  const run = () => fsRequest(name, 'PATCH', { fields: { json: { stringValue: json }, updatedAt: { timestampValue: new Date().toISOString() } } }, '?updateMask.fieldPaths=json&updateMask.fieldPaths=updatedAt')
    .catch((e) => { console.error(`[store] ${e.message}`); writeFile(name, data); });
  const next = (queues.get(name) || Promise.resolve()).then(run);
  queues.set(name, next);
  return next;
}

// Startup check: write and read back a health document so a missing permission shows up in the logs straight away.
export async function init() {
  if (!useFirestore) { console.log('[store] Using local files in server/.cache'); return; }
  try {
    await fsRequest('_health', 'PATCH', { fields: { json: { stringValue: '{"ok":true}' }, updatedAt: { timestampValue: new Date().toISOString() } } }, '?updateMask.fieldPaths=json&updateMask.fieldPaths=updatedAt');
    const back = await fsRequest('_health', 'GET');
    if (!back) throw new Error('read-back returned nothing');
    console.log(`[store] Firestore ready (project ${await project()}${EMULATOR ? ', emulator' : ''})`);
  } catch (e) {
    console.error(`[store] Firestore is not usable: ${e.message}. Check that the Firestore database exists and the service account has roles/datastore.user. Data will not persist across restarts.`);
  }
}
