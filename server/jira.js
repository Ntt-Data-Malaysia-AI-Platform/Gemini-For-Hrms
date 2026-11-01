// Jira Cloud connector (REST API v3) for IT & Facilities requests.
// Each service request is raised as a Jira issue; its status is read back live from Jira.
// Config: JIRA_BASE_URL, JIRA_EMAIL, JIRA_API_TOKEN, optional JIRA_PROJECT_KEY (default: first project)
// and JIRA_ISSUE_TYPE (default: Task).

const cfg = () => ({
  base: (process.env.JIRA_BASE_URL || '').replace(/\/$/, ''),
  email: process.env.JIRA_EMAIL,
  token: process.env.JIRA_API_TOKEN,
  project: process.env.JIRA_PROJECT_KEY,
  issueType: process.env.JIRA_ISSUE_TYPE || 'Task',
});
export const jiraConfigured = () => Boolean(cfg().base && cfg().email && cfg().token);

// Never let the API token reach logs, Gemini or the UI.
const redact = (s) => (cfg().token ? String(s).split(cfg().token).join('[redacted]') : String(s));

async function jira(method, path, body) {
  const c = cfg();
  let res;
  try {
    res = await fetch(`${c.base}/rest/api/3${path}`, {
      method,
      headers: { authorization: 'Basic ' + Buffer.from(`${c.email}:${c.token}`).toString('base64'), accept: 'application/json', 'content-type': 'application/json' },
      body: body && JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch (e) {
    throw new Error(`Jira is unreachable (${redact(e.cause?.code || e.message)}).`);
  }
  const text = await res.text();
  if (!res.ok) {
    if (/temporarily unavailable/i.test(text) || (res.status === 404 && /<html/i.test(text))) throw new Error(`The Jira site ${c.base} is unavailable (it may be deactivated).`);
    if (res.status === 401 || res.status === 403) throw new Error('Jira rejected the credentials (check JIRA_EMAIL and JIRA_API_TOKEN).');
    let detail = text.slice(0, 200);
    try { const j = JSON.parse(text); detail = [...(j.errorMessages || []), ...Object.values(j.errors || {})].join('; ') || detail; } catch { /* keep raw */ }
    throw new Error(`Jira ${method} ${path.split('?')[0]} failed (${res.status}): ${redact(detail)}`);
  }
  return text ? JSON.parse(text) : {};
}

let projectKey = null;
async function project() {
  if (cfg().project) return cfg().project;
  if (projectKey) return projectKey;
  const r = await jira('GET', '/project/search?maxResults=1&orderBy=name');
  projectKey = r.values?.[0]?.key;
  if (!projectKey) throw new Error('No Jira project is available. Set JIRA_PROJECT_KEY in .env.');
  return projectKey;
}

const statusOf = (fields) => ({
  status: fields?.status?.name || 'Unknown',
  category: fields?.status?.statusCategory?.key || 'new', // new | indeterminate | done
  assignee: fields?.assignee?.displayName || null,
  updated: fields?.updated ? fields.updated.slice(0, 10) : null,
});

// Plain text -> Atlassian Document Format (one paragraph per line).
const adf = (text) => ({
  type: 'doc', version: 1,
  content: String(text).split('\n').filter(Boolean).map((line) => ({ type: 'paragraph', content: [{ type: 'text', text: line }] })),
});

export async function createIssue({ summary, description, labels = [] }) {
  const key = await project();
  const created = await jira('POST', '/issue', {
    fields: { project: { key }, issuetype: { name: cfg().issueType }, summary: summary.slice(0, 250), description: adf(description), labels },
  });
  const issue = await jira('GET', `/issue/${created.key}?fields=status,assignee,updated`);
  return { key: created.key, url: `${cfg().base}/browse/${created.key}`, ...statusOf(issue.fields) };
}

export async function issueStatus(issueKey) {
  const issue = await jira('GET', `/issue/${encodeURIComponent(issueKey)}?fields=status,assignee,updated`);
  return { key: issue.key, url: `${cfg().base}/browse/${issue.key}`, ...statusOf(issue.fields) };
}
