// Live SAP SuccessFactors tools (OData v2) for the HR operations agents.
// Entity and field names were checked against the SAP Business Accelerator Hub sandbox
// (sandbox.api.sap.com/successfactors/odata/v2). Each query selects only the fields it needs and never
// requests SSNs, phone numbers, addresses or bank data, so none of that can reach Gemini.
// Aggregation happens here; Gemini receives summaries, not raw employee tables.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SANDBOX = 'https://sandbox.api.sap.com/successfactors/odata/v2';
const cfg = () => ({
  base: (process.env.SAP_BASE_URL || SANDBOX).replace(/\/$/, ''),
  key: process.env.SAP_API_KEY,
  user: process.env.SAP_USERNAME,
  pass: process.env.SAP_PASSWORD,
});
export const sapConfigured = () => Boolean(cfg().key || (cfg().user && cfg().pass));

const headers = () => {
  const c = cfg();
  return {
    accept: 'application/json',
    ...(c.key ? { APIKey: c.key } : { authorization: 'Basic ' + Buffer.from(`${c.user}:${c.pass}`).toString('base64') }),
  };
};

// The sandbox is slow and rate limited, so:
//  - reads are cached for 30 minutes, in memory and on disk (server/.cache), so restarts reuse them;
//  - requests go out one at a time with a short gap, never in bursts;
//  - if SAP refuses a request (quota), the last good copy is served, however old, and marked as stale.
const CACHE_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '.cache', 'sap-cache.json');
const TTL = 30 * 60 * 1000;
const cache = new Map((() => { try { return Object.entries(JSON.parse(fs.readFileSync(CACHE_FILE, 'utf8'))); } catch { return []; } })());
let saveTimer = null;
const persist = () => {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { fs.mkdirSync(path.dirname(CACHE_FILE), { recursive: true }); fs.writeFileSync(CACHE_FILE, JSON.stringify(Object.fromEntries(cache))); } catch { /* cache is best effort */ }
  }, 1000);
};
let lastStale = null;
export const staleSince = () => lastStale;

let queue = Promise.resolve();
const GAP_MS = 350;
const throttled = (fn) => {
  const run = queue.then(fn);
  queue = run.catch(() => undefined).then(() => new Promise((r) => setTimeout(r, GAP_MS)));
  return run;
};

// SAP echoes the API key in some error bodies; never let it reach logs, Gemini or the UI.
const redact = (s) => (cfg().key ? String(s).split(cfg().key).join('[redacted]') : String(s));

async function odata(path, params = {}) {
  if (!sapConfigured()) throw new Error('SAP is not configured. Set SAP_API_KEY in .env.');
  const url = new URL(`${cfg().base}/${path}`);
  url.searchParams.set('$format', 'json');
  for (const [k, v] of Object.entries(params)) if (v != null) url.searchParams.set(k, v);
  const hit = cache.get(url.href);
  if (hit && Date.now() - hit.at < TTL) return hit.data;
  try {
    const res = await throttled(() => fetch(url, { headers: headers(), signal: AbortSignal.timeout(30000) }));
    const text = await res.text();
    if (!res.ok) {
      if (/ratelimit|quota/i.test(text)) throw new Error('The SAP sandbox rate limit was reached. Try again in a minute.');
      throw new Error(`SAP ${path} returned ${res.status}: ${redact(text.slice(0, 200))}`);
    }
    const j = JSON.parse(text);
    const data = { rows: j.d?.results ?? (j.d ? [j.d] : []), count: j.d?.__count != null ? Number(j.d.__count) : null };
    cache.set(url.href, { at: Date.now(), data });
    persist();
    lastStale = null;
    return data;
  } catch (e) {
    if (hit) { lastStale = new Date(hit.at).toISOString(); return hit.data; }
    throw new Error(redact(e.message));
  }
}
const rows = async (path, params) => (await odata(path, params)).rows;
const countOf = async (path, filter) => (await odata(path, { $top: 1, $inlinecount: 'allpages', ...(filter ? { $filter: filter } : {}) })).count;

// Page through an entity set (the sandbox caps $top at 1000).
async function all(path, params, max = 3000) {
  const out = [];
  for (let skip = 0; skip < max; skip += 1000) {
    const page = await rows(path, { ...params, $top: 1000, $skip: skip });
    out.push(...page);
    if (page.length < 1000) break;
  }
  return out;
}

const today = () => new Date().toISOString().slice(0, 10);
const day = (v) => {
  const m = v && String(v).match(/-?\d+/);
  return m ? new Date(Number(m[0])).toISOString().slice(0, 10) : null;
};
const tally = (list, key, top = 12) =>
  Object.entries(list.reduce((m, x) => { const k = key(x) || 'Unassigned'; m[k] = (m[k] || 0) + 1; return m; }, {}))
    .sort((a, b) => b[1] - a[1]).slice(0, top).map(([name, count]) => ({ name: /^\(\s*\)$/.test(name) ? 'Unassigned' : name, count }));
const code = (s) => (String(s || '').match(/\(([^)]+)\)\s*$/) || [])[1] || s || 'Unassigned';
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const RISK = { 5324: 'Low', 5325: 'Medium', 5326: 'High' };
const quote = (s) => String(s).replace(/'/g, "''");
// Shared queries: agents reuse the same cached result sets instead of spending sandbox quota.
export const sapData = {
  users: () => all('User', { $select: 'userId,displayName,title,division,department,country,status,employeeClass,hireDate,riskOfLoss,matrix1Label' }),
  positions: () => all('Position', { $select: 'code,division,vacant,effectiveStatus' }),
  requisitions: () => all('JobRequisition', { $select: 'jobReqId,internalStatus,deleted,numberOpenings,openingsFilled,divisionCode,departmentCode,locationCode,jobCode,timeToFill,createdDateTime' }),
  applications: () => all('JobApplication', { $select: 'applicationId,jobReqId,status' }),
  reviewForms: () => all('FormHeader', { $select: 'formDataId,formTitle,formDataStatus,formReviewDueDate,rating,formSubjectId', $filter: "formTemplateType eq 'Review'", $orderby: 'formReviewDueDate desc' }, 4000),
  permits: () => all('EmpWorkPermit', { $select: 'userId,documentTitle,documentType,country,issueDate,expirationDate,isValidated' }),
  workflows: () => all('WfRequest', { $select: 'wfRequestId,module,status,totalSteps,currentStepNum,createdDateTime,createdBy', $orderby: 'createdDateTime desc' }),
  todos: () => all('TodoEntryV2', { $select: 'todoEntryId,todoEntryName,categoryLabel,userId,status' }, 4000),
  pendingTimeOff: () => all('EmployeeTime', { $select: 'userId,timeType,startDate,endDate,quantityInDays', $filter: "approvalStatus eq 'PENDING'" }),
};
const users = sapData.users;
const applications = sapData.applications;

const sapTools = {
  sap_lookup_employee: {
    description: 'Look up employees in SAP SuccessFactors by name or user ID. Returns job title, division, department, location, hire date, performance label and risk of loss.',
    parameters: { type: 'OBJECT', properties: { query: { type: 'STRING', description: 'Name or part of a name, or a user ID' } }, required: ['query'] },
    run: async (u, { query = '' }) => {
      const q = quote(String(query).trim().toLowerCase().slice(0, 60));
      if (!q) return { error: 'Give a name or user ID to search for.' };
      const found = await rows('User', {
        $select: 'userId,displayName,title,division,department,location,country,hireDate,employeeClass,matrix1Label,matrix2Label,riskOfLoss',
        $filter: `substringof('${q}',tolower(displayName)) or userId eq '${quote(query)}'`,
        $top: 10,
      });
      return found.map((x) => ({
        userId: x.userId, name: x.displayName, title: x.title, division: x.division, department: x.department,
        location: x.location, country: x.country, hireDate: day(x.hireDate), employeeClass: x.employeeClass,
        performance: x.matrix1Label || null, potential: x.matrix2Label || null, riskOfLoss: RISK[x.riskOfLoss] || null,
      }));
    },
    brief: (d) => (Array.isArray(d) ? `Found **${d.length}** matching employee(s) in SAP SuccessFactors.` : d.error),
  },

  sap_workforce_summary: {
    description: 'Workforce planning data from SAP SuccessFactors: headcount by division, country and department, vacant vs filled positions by division, and hiring by year.',
    parameters: { type: 'OBJECT', properties: {} },
    run: async () => {
      const [people, positions] = await Promise.all([users(), sapData.positions()]);
      const active = people.filter((p) => p.status === 't');
      const activePos = positions.filter((p) => p.effectiveStatus === 'A');
      const divisions = tally(active, (p) => p.division, 10).map(({ name, count }) => {
        const pos = activePos.filter((p) => p.division === code(name));
        const vacant = pos.filter((p) => p.vacant === true || p.vacant === 'true').length;
        return { division: name, headcount: count, positions: pos.length, vacantPositions: vacant, vacancyRatePct: pct(vacant, pos.length) };
      });
      const year = new Date().getFullYear();
      return {
        source: 'SAP SuccessFactors', asOf: today(),
        activeEmployees: active.length,
        totalPositions: activePos.length,
        vacantPositions: activePos.filter((p) => p.vacant === true || p.vacant === 'true').length,
        byDivision: divisions,
        byCountry: tally(active, (p) => p.country, 10),
        topDepartments: tally(active, (p) => p.department, 10),
        hiresByYear: [0, 1, 2, 3, 4].map((n) => ({ year: year - n, hires: active.filter((p) => day(p.hireDate)?.startsWith(String(year - n))).length })),
      };
    },
    brief: (d) => `SAP shows **${d.activeEmployees.toLocaleString()} active employees** and **${d.vacantPositions} vacant positions** out of ${d.totalPositions}.`,
  },

  sap_recruitment_pipeline: {
    description: 'Hiring progress from SAP SuccessFactors Recruiting: open requisitions by status and division, openings vs filled, time to fill, and application counts per requisition.',
    parameters: { type: 'OBJECT', properties: {} },
    run: async () => {
      const [reqs, apps] = await Promise.all([
        sapData.requisitions(),
        applications(),
      ]);
      const live = reqs.filter((r) => r.deleted !== 'Deleted' && r.internalStatus !== 'Closed');
      const appsByReq = apps.reduce((m, a) => { (m[a.jobReqId] ||= []).push(a.status); return m; }, {});
      const ttf = live.map((r) => Number(r.timeToFill)).filter((n) => n >= 1);
      return {
        source: 'SAP SuccessFactors', asOf: today(),
        openRequisitions: live.length,
        openPositions: live.reduce((s, r) => s + Math.max(0, Number(r.numberOpenings || 0) - Number(r.openingsFilled || 0)), 0),
        avgTimeToFillDays: ttf.length ? Math.round(ttf.reduce((a, b) => a + b, 0) / ttf.length) : null,
        byStatus: tally(live, (r) => r.internalStatus),
        byDivision: tally(live, (r) => r.divisionCode, 8),
        applicationStatus: tally(apps, (a) => a.status, 8),
        busiestRequisitions: live
          .map((r) => ({
            jobReqId: r.jobReqId, department: r.departmentCode || null, location: r.locationCode || null, jobCode: r.jobCode,
            status: r.internalStatus, openings: Number(r.numberOpenings || 0), filled: Number(r.openingsFilled || 0),
            applications: (appsByReq[r.jobReqId] || []).length, openApplications: (appsByReq[r.jobReqId] || []).filter((s) => s === 'Open').length,
            created: day(r.createdDateTime),
          }))
          .sort((a, b) => b.applications - a.applications).slice(0, 10),
      };
    },
    brief: (d) => `SAP Recruiting has **${d.openRequisitions} open requisitions** covering ${d.openPositions} unfilled positions.`,
  },

  sap_screen_applicants: {
    description: 'List and screen the applicants for one SAP SuccessFactors job requisition: status, rating, source and availability. Use the jobReqId from sap_recruitment_pipeline.',
    parameters: { type: 'OBJECT', properties: { jobReqId: { type: 'STRING', description: 'Requisition ID, for example 482' } }, required: ['jobReqId'] },
    run: async (u, { jobReqId }) => {
      const id = quote(String(jobReqId || '').replace(/\D/g, ''));
      if (!id) return { error: 'Give a numeric requisition ID.' };
      const apps = await rows('JobApplication', {
        $select: 'applicationId,candidateId,firstName,lastName,status,averageRating,rating,sourceLabel,formerEmployee,dateAvail,lastModifiedDateTime',
        $filter: `jobReqId eq '${id}'`, $top: 100,
      });
      const score = (a) => Number(a.averageRating) > 0 ? Number(a.averageRating) : Number(a.rating) > 0 ? Number(a.rating) : null;
      return {
        jobReqId: id, applicants: apps.length,
        ranked: apps.map((a) => ({
          applicationId: a.applicationId, candidate: `${a.firstName || ''} ${a.lastName || ''}`.trim(), status: a.status,
          rating: score(a), source: a.sourceLabel || null, formerEmployee: a.formerEmployee, available: day(a.dateAvail), updated: day(a.lastModifiedDateTime),
        })).sort((a, b) => (b.status === 'Open') - (a.status === 'Open') || (b.rating ?? -1) - (a.rating ?? -1)),
      };
    },
    brief: (d) => (d.error ? d.error : `Requisition ${d.jobReqId} has **${d.applicants} applicant(s)** in SAP.`),
  },

  sap_performance_status: {
    description: 'Performance review progress from SAP SuccessFactors Performance Management: review forms by status, completion rate and overdue appraisals (not completed and past due date).',
    parameters: { type: 'OBJECT', properties: {} },
    run: async () => {
      const forms = await sapData.reviewForms();
      // formDataStatus 3 = completed. Other codes are reported as-is.
      const label = (s) => ({ 1: 'In progress', 3: 'Completed' }[s] || `Status code ${s}`);
      const now = today();
      const overdue = forms.filter((f) => f.formDataStatus !== '3' && day(f.formReviewDueDate) && day(f.formReviewDueDate) < now);
      const recent = forms.filter((f) => (day(f.formReviewDueDate) || '') >= `${new Date().getFullYear() - 2}-01-01`);
      return {
        source: 'SAP SuccessFactors', asOf: now,
        reviewForms: forms.length,
        completionPct: pct(forms.filter((f) => f.formDataStatus === '3').length, forms.length),
        byStatus: tally(forms, (f) => label(f.formDataStatus)),
        recentCycles: { forms: recent.length, completionPct: pct(recent.filter((f) => f.formDataStatus === '3').length, recent.length) },
        overdueCount: overdue.length,
        mostRecentOverdue: overdue.slice(0, 15).map((f) => ({
          form: f.formTitle, status: label(f.formDataStatus), dueDate: day(f.formReviewDueDate),
          daysOverdue: Math.round((Date.now() - Date.parse(day(f.formReviewDueDate))) / 864e5),
        })),
      };
    },
    brief: (d) => `SAP has **${d.reviewForms.toLocaleString()} review forms**, ${d.completionPct}% completed; **${d.overdueCount.toLocaleString()} are overdue**.`,
  },

  sap_payroll_review: {
    description: 'Scan recurring pay components in SAP SuccessFactors (EmpPayCompRecurring) for exceptions: duplicate active components, values far from peers on the same component, zero or negative amounts, and large changes between consecutive records.',
    parameters: { type: 'OBJECT', properties: {} },
    run: async () => {
      const recs = await all('EmpPayCompRecurring', { $select: 'userId,payComponent,paycompvalue,currencyCode,frequency,startDate,endDate,seqNumber' });
      const now = today();
      const current = recs.filter((r) => (day(r.endDate) || '9999') >= now);
      const findings = [];
      const key = (r) => `${r.userId}|${r.payComponent}`;
      const groups = recs.reduce((m, r) => { (m[key(r)] ||= []).push(r); return m; }, {});
      for (const list of Object.values(groups)) {
        const active = list.filter((r) => (day(r.endDate) || '9999') >= now);
        if (active.length > 1) findings.push({ userId: list[0].userId, payComponent: list[0].payComponent, issue: 'Duplicate active pay component', detail: `${active.length} active records`, severity: 'Critical' });
        const hist = [...list].sort((a, b) => (day(a.startDate) || '').localeCompare(day(b.startDate) || ''));
        for (let i = 1; i < hist.length; i++) {
          const a = Number(hist[i - 1].paycompvalue), b = Number(hist[i].paycompvalue);
          if (a > 0 && Math.abs(b - a) / a >= 0.25) findings.push({ userId: hist[i].userId, payComponent: hist[i].payComponent, issue: 'Large change between records', detail: `${a} to ${b} ${hist[i].currencyCode || ''} from ${day(hist[i].startDate)}`, date: day(hist[i].startDate), severity: 'High' });
        }
      }
      const peers = current.reduce((m, r) => { (m[`${r.payComponent}|${r.currencyCode}|${r.frequency}`] ||= []).push(r); return m; }, {});
      for (const list of Object.values(peers)) {
        const vals = list.map((r) => Number(r.paycompvalue)).filter((n) => n > 0).sort((a, b) => a - b);
        if (vals.length < 5) continue;
        const median = vals[Math.floor(vals.length / 2)];
        for (const r of list) {
          const v = Number(r.paycompvalue);
          if (v > median * 3 || (v > 0 && v < median / 3)) findings.push({ userId: r.userId, payComponent: r.payComponent, issue: 'Outlier vs peers', detail: `${v} ${r.currencyCode} vs median ${median}`, severity: 'Medium' });
        }
      }
      for (const r of current) if (!(Number(r.paycompvalue) > 0)) findings.push({ userId: r.userId, payComponent: r.payComponent, issue: 'Zero or negative amount', detail: `value ${r.paycompvalue}`, severity: 'High' });
      const rank = { Critical: 0, High: 1, Medium: 2 };
      findings.sort((a, b) => rank[a.severity] - rank[b.severity]);
      return {
        source: 'SAP SuccessFactors', asOf: now,
        recordsScanned: recs.length, activeRecords: current.length,
        findingsBySeverity: tally(findings, (f) => f.severity),
        findingsByType: tally(findings, (f) => f.issue),
        topFindings: findings.slice(0, 20),
        allFindings: findings,
        note: 'Timesheet completeness is not exposed by this SAP API; use the payroll run check (get_payroll_exceptions) for that.',
      };
    },
    brief: (d) => `Scanned ${d.recordsScanned.toLocaleString()} SAP pay records: **${d.topFindings.length ? d.findingsBySeverity.reduce((s, x) => s + x.count, 0) : 0} exceptions** found.`,
  },

  sap_attrition_signals: {
    description: 'Attrition intelligence from SAP SuccessFactors: risk-of-loss ratings by division, high performers at high risk (regrettable-loss candidates), and low-performance signals.',
    parameters: { type: 'OBJECT', properties: {} },
    run: async () => {
      const people = (await users()).filter((p) => p.status === 't');
      const rated = people.filter((p) => RISK[p.riskOfLoss]);
      const byDiv = Object.entries(rated.reduce((m, p) => { const d = p.division || 'Unassigned'; (m[d] ||= { High: 0, Medium: 0, Low: 0 })[RISK[p.riskOfLoss]]++; return m; }, {}))
        .map(([division, r]) => ({ division, rated: r.High + r.Medium + r.Low, high: r.High, medium: r.Medium, low: r.Low, highRiskPct: pct(r.High, r.High + r.Medium + r.Low) }))
        .sort((a, b) => b.highRiskPct - a.highRiskPct || b.high - a.high);
      const stars = /star|solid contributor|experienced/i;
      return {
        source: 'SAP SuccessFactors', asOf: today(),
        activeEmployees: people.length, withRiskRating: rated.length,
        riskDistribution: tally(rated, (p) => RISK[p.riskOfLoss]),
        divisionsByHighRisk: byDiv.slice(0, 10),
        regrettableLossCandidates: rated.filter((p) => RISK[p.riskOfLoss] === 'High' && stars.test(p.matrix1Label || ''))
          .slice(0, 12).map((p) => ({ userId: p.userId, name: p.displayName, title: p.title, division: p.division, performance: p.matrix1Label })),
        performanceConcerns: tally(people.filter((p) => /coaching|marginal|unsatisf/i.test(p.matrix1Label || '')), (p) => p.division, 8),
      };
    },
    brief: (d) => `${d.withRiskRating} employees have a risk-of-loss rating; highest share of high risk: **${d.divisionsByHighRisk[0]?.division}** (${d.divisionsByHighRisk[0]?.highRiskPct}%).`,
  },

  sap_ops_queue: {
    description: 'Live HR operations queue from SAP SuccessFactors: pending time-off approvals, open job applications, overdue performance reviews and vacant positions.',
    parameters: { type: 'OBJECT', properties: {} },
    run: async () => {
      const [pending, pendingTotal, apps, vacant, perf] = await Promise.all([
        rows('EmployeeTime', { $select: 'userId,timeType,startDate,endDate,quantityInDays', $filter: "approvalStatus eq 'PENDING'", $orderby: 'startDate desc', $top: 10 }),
        countOf('EmployeeTime', "approvalStatus eq 'PENDING'"),
        applications(),
        countOf('Position', 'vacant eq true'),
        sapTools.sap_performance_status.run(),
      ]);
      return {
        source: 'SAP SuccessFactors', asOf: today(),
        pendingTimeOffApprovals: pendingTotal,
        latestPendingRequests: pending.map((p) => ({ userId: p.userId, type: p.timeType, from: day(p.startDate), to: day(p.endDate), days: Number(p.quantityInDays) })),
        openJobApplications: apps.filter((a) => a.status === 'Open').length,
        overduePerformanceReviews: perf.overdueCount,
        vacantPositions: vacant,
      };
    },
    brief: (d) => `SAP queue: **${d.pendingTimeOffApprovals} time-off approvals**, ${d.openJobApplications} open applications, ${d.overduePerformanceReviews} overdue reviews, ${d.vacantPositions} vacant positions.`,
  },

  sap_executive_snapshot: {
    description: 'One-page HR executive snapshot from SAP SuccessFactors: workforce, hiring, performance, attrition risk and payroll exceptions.',
    parameters: { type: 'OBJECT', properties: {} },
    run: async () => {
      const [w, r, p, a, pay] = await Promise.all(['sap_workforce_summary', 'sap_recruitment_pipeline', 'sap_performance_status', 'sap_attrition_signals', 'sap_payroll_review'].map((n) => sapTools[n].run()));
      return {
        source: 'SAP SuccessFactors', asOf: today(),
        workforce: { activeEmployees: w.activeEmployees, vacantPositions: w.vacantPositions, largestDivisions: w.byDivision.slice(0, 3), hiresThisYear: w.hiresByYear[0].hires },
        hiring: { openRequisitions: r.openRequisitions, openPositions: r.openPositions, avgTimeToFillDays: r.avgTimeToFillDays },
        performance: { completionPct: p.completionPct, overdueReviews: p.overdueCount },
        attrition: { highRiskDivision: a.divisionsByHighRisk[0], regrettableLossCandidates: a.regrettableLossCandidates.length },
        payroll: { recordsScanned: pay.recordsScanned, exceptions: pay.findingsBySeverity },
      };
    },
    brief: (d) => `Executive snapshot from SAP as of ${d.asOf}: **${d.workforce.activeEmployees.toLocaleString()} employees**, ${d.hiring.openRequisitions} open requisitions, ${d.performance.overdueReviews} overdue reviews.`,
  },
  sap_compliance_status: {
    description: 'Compliance monitoring from SAP SuccessFactors: identity and work-permit documents that are expired, expiring within 90 days or missing an expiry date, plus open timesheet to-dos and employee-data alerts.',
    parameters: { type: 'OBJECT', properties: {} },
    run: async () => {
      const [docs, todos, people] = await Promise.all([sapData.permits(), sapData.todos(), users()]);
      const names = Object.fromEntries(people.map((p) => [p.userId, p.displayName]));
      const now = today();
      const in90 = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
      const rows = docs.map((d) => {
        const expires = day(d.expirationDate);
        const state = !expires ? 'No expiry date' : expires < now ? 'Expired' : expires <= in90 ? 'Expiring within 90 days' : 'Valid';
        return { employee: names[d.userId] || d.userId, userId: d.userId, document: d.documentTitle || 'Untitled document', expires, state, validated: d.isValidated === true || d.isValidated === 'true' };
      });
      const todoCount = (re) => todos.filter((t) => re.test(`${t.categoryLabel} ${t.todoEntryName}`)).length;
      return {
        source: 'SAP SuccessFactors', asOf: now,
        documentsTracked: rows.length,
        documentStatus: tally(rows, (r) => r.state),
        expiredOrExpiring: rows.filter((r) => r.state === 'Expired' || r.state.startsWith('Expiring'))
          .sort((a, b) => (b.expires || '').localeCompare(a.expires || '')).slice(0, 12),
        missingExpiryDate: rows.filter((r) => r.state === 'No expiry date').length,
        notValidated: rows.filter((r) => !r.validated).length,
        openTimesheetTodos: todoCount(/time ?sheet/i),
        employeeDataAlerts: todoCount(/EC Alert|Alert for/i),
      };
    },
    brief: (d) => `SAP tracks ${d.documentsTracked} identity and work-permit documents: **${d.documentStatus.find((x) => x.name === 'Expired')?.count ?? 0} expired**, ${d.missingExpiryDate} missing an expiry date; ${d.openTimesheetTodos} timesheet to-dos open.`,
  },

  sap_workflow_queue: {
    description: 'HR request and approval queue from SAP SuccessFactors workflows: pending requests by type, approval step and age, stalled requests, and open to-dos by category.',
    parameters: { type: 'OBJECT', properties: {} },
    run: async () => {
      const [wf, todos, people] = await Promise.all([sapData.workflows(), sapData.todos(), users()]);
      const names = Object.fromEntries(people.map((p) => [p.userId, p.displayName]));
      const age = (d) => Math.round((Date.now() - Date.parse(day(d))) / 864e5);
      const pending = wf.filter((w) => w.status === 'PENDING').map((w) => ({
        id: w.wfRequestId, type: w.module === 'HRIS' ? 'Employee data change' : 'Generic object change',
        step: `${w.currentStepNum ?? '?'} of ${w.totalSteps ?? '?'}`, created: day(w.createdDateTime), ageDays: age(w.createdDateTime),
        requestedBy: names[w.createdBy] || w.createdBy,
      }));
      const bucket = (p) => (p.ageDays < 30 ? 'Under 30 days' : p.ageDays < 180 ? '30 to 180 days' : 'Over 180 days');
      return {
        source: 'SAP SuccessFactors', asOf: today(),
        totalRequests: wf.length,
        byStatus: tally(wf, (w) => w.status),
        pending: pending.length,
        pendingByType: tally(pending, (p) => p.type),
        pendingByAge: ['Under 30 days', '30 to 180 days', 'Over 180 days'].map((name) => ({ name, count: pending.filter((p) => bucket(p) === name).length })),
        stalledOver30Days: pending.filter((p) => p.ageDays >= 30).length,
        latestPending: pending.sort((a, b) => (b.created || '').localeCompare(a.created || '')).slice(0, 8),
        openTodosByCategory: tally(todos, (t) => (/^\d+$/.test(t.categoryLabel || '') ? 'Profile completion' : t.categoryLabel), 8),
      };
    },
    brief: (d) => `SAP has **${d.pending} pending workflow requests** (${d.stalledOver30Days} waiting over 30 days).`,
  },
};

for (const t of Object.values(sapTools)) t.source = 'SAP SuccessFactors';
export { sapTools };

// Fill the cache in the background (one request at a time) so dashboards open instantly,
// then refresh it every 25 minutes. Failures are ignored: stale data keeps being served.
export async function warmSapCache() {
  if (!sapConfigured()) return;
  for (const name of ['sap_workforce_summary', 'sap_recruitment_pipeline', 'sap_performance_status', 'sap_attrition_signals', 'sap_payroll_review', 'sap_ops_queue', 'sap_compliance_status', 'sap_workflow_queue']) {
    try { await sapTools[name].run(); } catch { /* try again on the next refresh */ }
  }
  try { await sapData.pendingTimeOff(); } catch { /* next refresh */ }
}
