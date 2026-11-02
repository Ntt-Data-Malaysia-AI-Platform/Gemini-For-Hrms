// Sign-in for the two journeys:
//   Employee (Tyson), HR analyst (Tessa) and job candidate (Riyadh): email + password, checked here against salted scrypt hashes.
//   HR analyst (Tessa) can also use Microsoft 365. The browser signs in with MSAL and sends its Entra ID token;
//   the server verifies the signature against Microsoft's published keys before granting the HR role.
import crypto from 'node:crypto';
import wd from './mockHr.js';

const sessions = new Map();
const SESSION_MS = 8 * 60 * 60 * 1000;

export function createSession(user) {
  const token = crypto.randomBytes(24).toString('hex');
  sessions.set(token, { user, expires: Date.now() + SESSION_MS });
  return token;
}
export function sessionUser(req) {
  const token = (req.headers.authorization || '').replace(/^Bearer /, '');
  const s = sessions.get(token);
  if (!s) return null;
  if (s.expires < Date.now()) { sessions.delete(token); return null; }
  return s.user;
}
export const endSession = (req) => sessions.delete((req.headers.authorization || '').replace(/^Bearer /, ''));

// ---------- Email + password login ----------
const ACCOUNTS = {
  'tyson@gmail.com': { hash: '3680479228ab4bcb68f4e01dd59978c8:dde76ae828950f68a43e5653fdd7e737d1acd9a88d3e1ba5ca2338341249485a', empId: 'E1001' },
  'riyadh@gmail.com': { hash: '4bcc5b9c8fc400fc681514d379f6d780:45f797f01fdc9d67f8d567becfd817ca695059f22b55e22aa8bbc6db42f6c886', role: 'candidate', name: 'Riyadh Karim' },
  'tessa@gmail.com': { hash: 'dd89b4484295e7df4064fb832ad31d9d:4b437b88395f06248dc5afc4371785b3c6aaab8d8fb27f36a22a80ed8eddb363', role: 'hr', name: 'Tessa Nguyen' },
};

export function passwordLogin(email, password) {
  const entry = ACCOUNTS[String(email || '').trim().toLowerCase()];
  // Hash even for unknown emails so response time does not reveal which emails exist.
  const [salt, expected] = (entry?.hash || '00:00').split(':');
  const actual = crypto.scryptSync(String(password || ''), salt, 32);
  const ok = entry && crypto.timingSafeEqual(actual, Buffer.from(expected, 'hex'));
  if (!ok) return null;
  if (entry.role === 'candidate') return { role: 'candidate', name: entry.name, title: 'Principal Cloud Architect', dept: 'Candidate', email: String(email).toLowerCase(), authMethod: 'Email and password' };
  if (entry.role === 'hr') return { role: 'hr', name: entry.name, title: 'HR Analyst', dept: 'HR Operations', email: String(email).toLowerCase(), authMethod: 'Email and password' };
  const e = wd.employee(entry.empId);
  return { role: 'employee', empId: e.id, name: e.name, title: e.title, dept: e.dept, email: String(email).toLowerCase(), authMethod: 'Email and password' };
}

// ---------- Microsoft 365 (Entra ID) ----------
const b64json = (s) => JSON.parse(Buffer.from(s, 'base64url').toString('utf8'));
const GUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
let jwks = { at: 0, keys: [] };

async function signingKeys(tenant) {
  if (Date.now() - jwks.at < 60 * 60 * 1000 && jwks.keys.length) return jwks.keys;
  const res = await fetch(`https://login.microsoftonline.com/${tenant}/discovery/v2.0/keys`, { signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`Could not load Microsoft signing keys (${res.status})`);
  jwks = { at: Date.now(), keys: (await res.json()).keys || [] };
  return jwks.keys;
}

export async function m365Login(idToken) {
  const clientId = process.env.VITE_CLIENT_ID;
  const tenant = process.env.VITE_TENANT_ID || 'organizations';
  if (!clientId) throw new Error('Microsoft 365 sign-in is not configured (VITE_CLIENT_ID is empty).');
  const [h, p, s] = String(idToken || '').split('.');
  if (!h || !p || !s) throw new Error('Malformed Microsoft ID token.');
  let header, claims;
  try { header = b64json(h); claims = b64json(p); } catch { throw new Error('Malformed Microsoft ID token.'); }
  if (header.alg !== 'RS256') throw new Error('Unexpected token algorithm.');

  let jwk = (await signingKeys(tenant)).find((k) => k.kid === header.kid);
  if (!jwk) { jwks.at = 0; jwk = (await signingKeys(tenant)).find((k) => k.kid === header.kid); }
  if (!jwk) throw new Error('Token signing key not recognised.');
  const valid = crypto.verify('RSA-SHA256', Buffer.from(`${h}.${p}`), crypto.createPublicKey({ key: jwk, format: 'jwk' }), Buffer.from(s, 'base64url'));
  if (!valid) throw new Error('Microsoft token signature is invalid.');

  const now = Date.now() / 1000;
  const tid = GUID.test(tenant) ? tenant : claims.tid;
  if (claims.aud !== clientId) throw new Error('Token was issued for a different application.');
  if (claims.tid !== tid || claims.iss !== `https://login.microsoftonline.com/${tid}/v2.0`) throw new Error('Token was issued by an unexpected tenant.');
  if (claims.exp < now - 60 || (claims.nbf && claims.nbf > now + 60)) throw new Error('Microsoft token has expired. Sign in again.');

  const email = String(claims.preferred_username || claims.email || '').toLowerCase();
  const allowed = (process.env.HR_ALLOWED_USERS || '').split(',').map((x) => x.trim().toLowerCase()).filter(Boolean);
  if (allowed.length && !allowed.includes(email)) throw new Error(`${email} is not on the HR operations access list.`);

  return { role: 'hr', name: claims.name || email, title: 'HR Analyst', dept: 'HR Operations', email, authMethod: 'Microsoft 365', tenant: claims.tid };
}

// Optional: lets the HR journey be demoed before the Entra app registration is ready.
export const demoHrEnabled = () => /^(1|true|yes)$/i.test(process.env.ALLOW_DEMO_HR || '');
export const demoHrUser = () => ({ role: 'hr', name: 'Tessa Nguyen', title: 'HR Analyst', dept: 'HR Operations', email: 'tessa.demo', authMethod: 'Demo (no Microsoft 365)' });
