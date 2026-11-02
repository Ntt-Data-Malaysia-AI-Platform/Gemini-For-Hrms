// Agent runtime: Gemini function calling over the agent's tools (SAP SuccessFactors or simulated),
// with a demo fallback that runs the same tools without an LLM when GEMINI_API_KEY is missing.
import { allTools } from './agents.js';

const key = () => process.env.GEMINI_API_KEY;
const model = () => process.env.GEMINI_MODEL || 'gemini-3.5-flash';
// Short label for the header, derived from the configured model: gemini-3.5-flash -> Gemini 3.5.
export const geminiLabel = () => (key() ? `Gemini ${(model().match(/gemini-(\d+(?:\.\d+)?)/) || [])[1] || ''}`.trim() : null);
export const geminiMode = () => (key() ? `Gemini (${model()})` : 'Demo mode (no GEMINI_API_KEY)');

async function callTool(name, args, user, agent, trace) {
  const t = allTools[name];
  if (!t || !agent.tools.includes(name)) return { error: `Tool ${name} is not available to this agent.` };
  const start = Date.now();
  let out;
  try { out = await t.run(user, args || {}); } catch (e) { out = { error: e.message }; }
  trace.push({ tool: name, args: args || {}, ms: Date.now() - start, source: t.source, ok: !out?.error });
  return out;
}

const ARABIC = 'Reply in Modern Standard Arabic. Keep the same Markdown structure (headline, summary, tables, Next steps), translate headings and table headers, and keep names, IDs, numbers, dates and links unchanged. Write Next steps in Arabic.';

async function runGemini(agent, user, history, message, trace, lang = 'en') {
  const decls = agent.tools.map((n) => ({ name: n, description: allTools[n].description, parameters: allTools[n].parameters }));
  const contents = [
    ...history.map((h) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: String(h.text) }] })),
    { role: 'user', parts: [{ text: message }] },
  ];
  const system = `${agent.system}\nSigned-in user: ${user.name} (${user.title}). Today is ${new Date().toISOString().slice(0, 10)}.${lang === 'ar' ? `
${ARABIC}` : ''}`;
  for (let i = 0; i < 6; i++) {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model()}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key() },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents, tools: [{ functionDeclarations: decls }], generationConfig: { temperature: 0.3 } }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}: ${(await res.text()).slice(0, 300)}`);
    const parts = (await res.json()).candidates?.[0]?.content?.parts || [];
    const calls = parts.filter((p) => p.functionCall);
    if (!calls.length) return parts.map((p) => p.text || '').join('').trim() || 'I could not produce an answer.';
    contents.push({ role: 'model', parts });
    contents.push({
      role: 'user',
      // Tag each result with where it came from, so Gemini attributes figures to the right system.
      parts: await Promise.all(calls.map(async (c) => ({
        functionResponse: { name: c.functionCall.name, response: { source: allTools[c.functionCall.name]?.source, result: await callTool(c.functionCall.name, c.functionCall.args, user, agent, trace) } },
      }))),
    });
  }
  return 'I could not finish that request. Please try again.';
}

// ---------- Demo fallback (no LLM) ----------
const cell = (v) => (v && typeof v === 'object' ? Object.entries(v).map(([k, x]) => `${k}: ${cell(x)}`).join(', ') : String(v ?? '-'));
function toMd(d, indent = '') {
  if (Array.isArray(d)) {
    if (!d.length) return `${indent}_None_\n`;
    if (typeof d[0] !== 'object') return d.map((x) => `${indent}- ${x}\n`).join('');
    const keys = Object.keys(d[0]).filter((k) => !['body', 'draft'].includes(k));
    return `${indent}| ${keys.join(' | ')} |\n${indent}|${keys.map(() => '---').join('|')}|\n` + d.map((r) => `${indent}| ${keys.map((k) => cell(r[k]).replace(/\|/g, '/')).join(' | ')} |`).join('\n') + '\n\n';
  }
  if (d && typeof d === 'object') {
    return Object.entries(d).map(([k, v]) => (v && typeof v === 'object' ? `${indent}- **${k}**\n${toMd(v, indent + '  ')}` : `${indent}- **${k}:** ${v}\n`)).join('');
  }
  return `${indent}${d}\n`;
}

const triageRules = [
  [/harass|inappropriate|conduct|confidential|discriminat/i, 'Employee Relations', 'Critical', 'Employee Relations'],
  [/payslip|net pay|overtime|salary|pay /i, 'Payroll', 'High', 'Payroll Ops'],
  [/leave|parental|baby|maternity/i, 'Leave', 'Medium', 'Leave Admin'],
  [/letter|certificate|verification/i, 'Documents', 'Medium', 'HR Services'],
  [/remote|location|relocat/i, 'Work Arrangement', 'Medium', 'Mobility'],
  [/benefit|medical|enrol|insurance/i, 'Benefits', 'Low', 'Benefits'],
];

async function demoTriage(user, trace, agent) {
  const open = await callTool('get_cases', { status: 'New' }, user, agent, trace);
  if (!Array.isArray(open) || !open.length) return 'There are no new cases waiting for triage. All open cases already have a category, priority and owner.';
  const lines = [];
  for (const c of open) {
    const rule = triageRules.find(([re]) => re.test(`${c.subject} ${c.body}`)) || [null, 'General', 'Low', 'HR Services'];
    const draft = `Hi ${c.employee.split(' ')[0]}, thanks for reaching out about "${c.subject}". We have assigned this to our ${rule[3]} team and will update you within ${rule[2] === 'Critical' ? '1 business day' : '2 business days'}.`;
    await callTool('update_case', { caseId: c.id, category: rule[1], priority: rule[2], assignedTeam: rule[3], draftResponse: draft }, user, agent, trace);
    lines.push({ case: c.id, employee: c.employee, subject: c.subject, category: rule[1], priority: rule[2], team: rule[3], draftReply: draft });
  }
  return `I triaged **${lines.length} new cases** and saved the categories, priorities and assignments.\n\n${toMd(lines)}`;
}

async function demo(agent, user, message, trace) {
  const route = agent.routes.find(([re]) => re.test(message)) || agent.routes[agent.routes.length - 1];
  let [, name, args] = route;
  if (name === '__triage') return demoTriage(user, trace, agent);
  args = { ...(args || {}) };
  const note = '\n\n_Demo mode: set `GEMINI_API_KEY` to have Gemini reason over this data conversationally._';

  if (name === 'search_policies') args.query = message;
  const req = message.match(/requisition\s*#?\s*(\d+)/i);
  if (name === 'sap_screen_applicants' && req) args.jobReqId = req[1];

  const dates = message.match(/\d{4}-\d{2}-\d{2}/g);
  if (agent.id === 'leave-attendance' && /apply|request|submit|book|take/i.test(message)) {
    if (!dates) return 'Sure. Which leave type (Annual, Sick or Floating) and what dates? For example: _Apply annual leave from 2026-12-22 to 2026-12-24_.';
    args = { leaveType: /sick/i.test(message) ? 'Sick' : /floating/i.test(message) ? 'Floating' : 'Annual', startDate: dates[0], endDate: dates[1] || dates[0] };
    name = 'submit_leave_request';
  }
  if (name === 'create_service_request') {
    const item = /laptop/i.test(message) ? 'New laptop' : /parking/i.test(message) ? 'Parking permit' : /desk/i.test(message) ? 'Desk booking' : /badge/i.test(message) ? 'Access badge' : /vpn|mfa/i.test(message) ? 'VPN / MFA reset' : /software|licen[cs]e/i.test(message) ? 'Software access' : null;
    if (!item) return 'What do you need? For example a laptop, software access, a desk, a badge or a parking permit.';
    args = { category: /parking|desk|badge/i.test(message) ? 'Facilities' : 'IT', item, details: message };
  }
  if (name === 'generate_document') {
    const t = ['Salary Certificate', 'Experience Letter', 'Address Proof', 'Visa Support Letter', 'Employment Verification'].find((x) => message.toLowerCase().includes(x.split(' ')[0].toLowerCase()));
    if (!t) return 'Which letter do you need? Options: Employment Verification, Salary Certificate, Experience Letter, Address Proof or Visa Support Letter.';
    args = { documentType: t };
  }

  const data = await callTool(name, args, user, agent, trace);
  const brief = data?.error ? `I could not get that data: ${data.error}` : allTools[name].brief?.(data) || '';
  return `${brief}\n\n${data?.error ? '' : toMd(data)}${note}`;
}

// Tools that change data. When one succeeds, the reply is flagged so the browser refreshes its dashboards.
const WRITES = new Set(['submit_leave_request', 'create_service_request', 'update_case', 'schedule_interview', 'schedule_interview_round', 'generate_document']);
const flag = (r) => ({ ...r, changed: r.trace.some((t) => t.ok && WRITES.has(t.tool)) });

export async function chat(agent, user, history, message, lang = 'en') {
  const trace = [];
  if (!key()) return flag({ reply: await demo(agent, user, message, trace), trace, mode: 'demo' });
  try {
    return flag({ reply: await runGemini(agent, user, history, message, trace, lang), trace, mode: 'gemini' });
  } catch (e) {
    trace.length = 0;
    const why = `${e.message}${e.cause ? `: ${e.cause.code || e.cause.message}` : ''}`;
    return flag({ reply: `${await demo(agent, user, message, trace)}\n\n_Gemini call failed (${why}); showing the data directly._`, trace, mode: 'demo' });
  }
}
