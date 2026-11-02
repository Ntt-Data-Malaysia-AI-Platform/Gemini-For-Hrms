// HR agents API. Vite serves the React app and proxies /api here during development;
// after `npm run build` this server also serves dist/ on its own.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Minimal .env loader (shared with Vite; only VITE_* values ever reach the browser).
try {
  for (const line of fs.readFileSync(path.join(ROOT, '.env'), 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch { /* no .env */ }

const { agents, publicAgent } = await import('./agents.js');
const { chat, geminiLabel, geminiMode } = await import('./gemini.js');
const { jiraConfigured } = await import('./jira.js');
const { sapConfigured, staleSince, warmSapCache } = await import('./sap.js');
const auth = await import('./auth.js');
const { employeeDashboard, hrDashboard } = await import('./dashboard.js');
const onedrive = await import('./onedrive.js');
const report = await import('./report.js');
const teams = await import('./teams.js');
const jobs = await import('./jobs.js');

// Cloud Run (and most hosts) pass the port in PORT; API_PORT is the local dev setting.
const PORT = Number(process.env.PORT || process.env.API_PORT || 8787);
const DIST = path.join(ROOT, 'dist');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.json': 'application/json', '.woff2': 'font/woff2', '.ico': 'image/x-icon' };

const send = (res, code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
const readBody = (req) => new Promise((resolve) => {
  let s = '';
  req.on('data', (c) => { s += c; if (s.length > 2e5) req.destroy(); });
  req.on('end', () => { try { resolve(JSON.parse(s || '{}')); } catch { resolve({}); } });
});
const status = () => ({
  gemini: geminiMode(),
  sap: sapConfigured() ? 'SAP SuccessFactors connected' : 'SAP not configured',
  sapStaleSince: staleSince(),
  m365: Boolean(process.env.VITE_CLIENT_ID),
  demoHr: auth.demoHrEnabled(),
  teams: teams.teamsConfigured(),
  // Connected services for the header, e.g. 'Gemini 3.5', 'SAP', 'Jira', 'M365'.
  services: [geminiLabel(), sapConfigured() && 'SAP', jiraConfigured() && 'Jira', process.env.VITE_CLIENT_ID && 'M365'].filter(Boolean),
});

async function api(req, res, url) {
  if (url === '/api/catalog') return send(res, 200, { agents: agents.map(publicAgent), status: status() });

  if (url === '/api/auth/login' && req.method === 'POST') {
    const { email, password } = await readBody(req);
    const user = auth.passwordLogin(email, password);
    if (!user) return send(res, 401, { error: 'Email or password is incorrect.' });
    return send(res, 200, { token: auth.createSession(user) });
  }
  if (url === '/api/auth/m365' && req.method === 'POST') {
    const { idToken } = await readBody(req);
    try { return send(res, 200, { token: auth.createSession(await auth.m365Login(idToken)) }); }
    catch (e) { return send(res, 401, { error: e.message }); }
  }
  if (url === '/api/auth/demo-hr' && req.method === 'POST') {
    if (!auth.demoHrEnabled()) return send(res, 403, { error: 'Demo HR sign-in is turned off. Sign in with Microsoft 365.' });
    return send(res, 200, { token: auth.createSession(auth.demoHrUser()) });
  }

  const user = auth.sessionUser(req);
  if (!user) return send(res, 401, { error: 'Not signed in' });

  if (url === '/api/me') {
    const { name, title, dept, role, email, authMethod } = user;
    return send(res, 200, { user: { name, title, dept, role, email, authMethod }, status: status(), agents: agents.filter((a) => a.role === user.role).map(publicAgent) });
  }
  // Delegated Microsoft Graph token for OneDrive, sent by the browser per request and never stored.
  const graphToken = req.headers['x-graph-token'] || null;
  if (url.startsWith('/api/onedrive/')) {
    if (user.role !== 'hr') return send(res, 403, { error: 'OneDrive documents are available to HR operations only.' });
    const q = new URL(req.url, 'http://localhost').searchParams;
    try {
      if (url === '/api/onedrive/list') return send(res, 200, await onedrive.listFolder(graphToken, q.get('folder')));
      if (url === '/api/onedrive/search') return send(res, 200, await onedrive.search(graphToken, q.get('q')));
      if (url === '/api/onedrive/details') return send(res, 200, await onedrive.analyse(graphToken, q.get('id')));
    } catch (e) { return send(res, 400, { error: e.message }); }
  }
  const params = new URL(req.url, 'http://localhost').searchParams;
  const years = params.has('years') && [1, 3, 5, 10, 0].includes(Number(params.get('years'))) ? Number(params.get('years')) : 5;
  // A custom from/to period (YYYY-MM-DD) overrides the preset years; dashboard.js validates it.
  const filters = { division: params.get('division') || null, years, from: params.get('from'), to: params.get('to') };
  if (url.startsWith('/api/candidate/')) {
    if (user.role !== 'candidate') return send(res, 403, { error: 'The job portal is for candidates.' });
    try {
      if (url === '/api/candidate/profile') return send(res, 200, jobs.candidateProfile(user));
      if (url === '/api/candidate/search' && req.method === 'POST') return send(res, 200, await jobs.searchJobs(user, (await readBody(req)).query));
      if (url === '/api/candidate/prepare' && req.method === 'POST') return send(res, 200, await jobs.prepareApplication(user, String((await readBody(req)).jobId || '')));
      if (url === '/api/candidate/interview/confirm' && req.method === 'POST') return send(res, 200, jobs.confirmInterview(user, String((await readBody(req)).reference || '')));
      if (url === '/api/candidate/apply' && req.method === 'POST') { const b = await readBody(req); return send(res, 200, jobs.submitApplication(user, String(b.jobId || ''), b.fields)); }
    } catch (e) { return send(res, 400, { error: e.message }); }
  }
  if (url.startsWith('/api/hr/recruiting/')) {
    if (user.role !== 'hr') return send(res, 403, { error: 'Shortlists are available to HR operations only.' });
    try {
      if (url === '/api/hr/recruiting/jobs') return send(res, 200, { jobs: jobs.openJobs() });
      if (url === '/api/hr/recruiting/schedule' && req.method === 'POST') return send(res, 200, jobs.scheduleNext(String((await readBody(req)).applicationId || '')));
      if (url === '/api/hr/recruiting/shortlist') return send(res, 200, await jobs.shortlist(params.get('jobId') || '', params.get('balanced') !== '0'));
    } catch (e) { return send(res, 400, { error: e.message }); }
  }
  if (url === '/api/dashboard') {
    if (user.role === 'candidate') return send(res, 403, { error: 'No dashboard for candidates.' });
  }
  if (url === '/api/dashboard') return send(res, 200, user.role === 'hr' ? await hrDashboard(filters) : await employeeDashboard(user));
  if (url === '/api/report') {
    if (user.role !== 'hr') return send(res, 403, { error: 'Executive reports are available to HR operations only.' });
    return send(res, 200, await report.executiveReport(filters));
  }
  if (url === '/api/teams/notify' && req.method === 'POST') {
    if (user.role !== 'hr') return send(res, 403, { error: 'Teams notifications are available to HR operations only.' });
    const { items, title, subtitle } = await readBody(req);
    if (!Array.isArray(items) || !items.length) return send(res, 400, { error: 'Nothing to send.' });
    try { return send(res, 200, await teams.postDigest({ title: String(title || 'HR notifications').slice(0, 120), subtitle: String(subtitle || '').slice(0, 200), items, appUrl: process.env.APP_URL })); }
    catch (e) { return send(res, 400, { error: e.message }); }
  }
  if (url === '/api/logout' && req.method === 'POST') { auth.endSession(req); return send(res, 200, {}); }
  if (url === '/api/chat' && req.method === 'POST') {
    const { agentId, message, history, lang } = await readBody(req);
    const agent = agents.find((a) => a.id === agentId && a.role === user.role);
    if (!agent) return send(res, 403, { error: 'This agent is not available for your role.' });
    if (!message || typeof message !== 'string') return send(res, 400, { error: 'Message required' });
    return send(res, 200, await chat(agent, { ...user, graphToken }, Array.isArray(history) ? history.slice(-12) : [], message.slice(0, 2000), lang === 'ar' ? 'ar' : 'en'));
  }
  send(res, 404, { error: 'Not found' });
}

http.createServer(async (req, res) => {
  const url = req.url.split('?')[0];
  try {
    if (url.startsWith('/api/')) return await api(req, res, url);
    // Production: serve the built React app, falling back to index.html for client-side routes.
    let file = path.normalize(path.join(DIST, url === '/' ? 'index.html' : url));
    if (!file.startsWith(DIST)) { res.writeHead(403); return res.end(); }
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404); return res.end('Run "npm run build" first, or use "npm run dev".'); }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  } catch (e) {
    console.error(e);
    send(res, 500, { error: 'Server error' });
  }
}).listen(PORT, () => {
  const s = status();
  console.log(`NTT DATA HRMS API on http://localhost:${PORT}  [${s.gemini} | ${s.sap} | M365 ${s.m365 ? 'configured' : 'not configured'}${s.demoHr ? ' | demo HR on' : ''}]`);
  warmSapCache();
  setInterval(warmSapCache, 25 * 60 * 1000).unref();
});
