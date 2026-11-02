// Dashboard data for each persona: KPI tiles, chart series and notifications.
// HR operations figures come from SAP SuccessFactors (sap.js); employee figures from the built-in HR store.
import wd from './mockHr.js';
import { tools } from './tools.js';
import { sapData, sapTools } from './sap.js';
import { jiraConfigured } from './jira.js';
import { recentSubmissions } from './jobs.js';

const settle = async (entries) => {
  const out = {};
  const results = await Promise.allSettled(entries.map(([, fn]) => fn()));
  entries.forEach(([key], i) => { out[key] = results[i].status === 'fulfilled' ? results[i].value : null; });
  return out;
};
const daysUntil = (d) => Math.round((Date.parse(d) - Date.parse(new Date().toISOString().slice(0, 10))) / 864e5);
const money = (n) => `$${Math.round(n).toLocaleString('en-US')}`;

export async function employeeDashboard(user) {
  const e = wd.employee(user.empId);
  const leave = tools.get_leave_balance.run(user);
  const attendance = tools.get_attendance.run(user);
  const payslips = tools.get_payslips.run(user);
  const holidays = tools.get_holidays.run(user).slice(0, 4);
  const onboarding = tools.get_onboarding_tasks.run(user);
  const requests = (await tools.get_service_requests.run(user)).myRequests;
  const jobs = tools.get_internal_jobs.run(user).slice(0, 3);
  const learning = tools.get_learning_recommendations.run(user).recommendations.slice(0, 3);
  const benefits = tools.get_benefits.run(user);
  const pending = onboarding.tasks.filter((t) => t.status === 'Pending');
  const latest = payslips[0];
  const years = ((Date.now() - Date.parse(e.hireDate)) / (365.25 * 864e5)).toFixed(1);

  const notifications = [
    ...pending.map((t) => ({ severity: daysUntil(t.due) <= 7 ? 'warning' : 'info', title: t.task, detail: `Due ${t.due} (${daysUntil(t.due)} days)`, agent: 'onboarding', prompt: 'What onboarding tasks are pending?' })),
    { severity: 'info', title: `Payslip for ${latest.period} is available`, detail: `Net pay ${money(latest.net)}`, agent: 'payroll-assistant', prompt: 'Explain my latest payslip' },
    { severity: 'info', title: 'Benefits open enrolment is open', detail: benefits.enrolmentWindow, agent: 'benefits', prompt: 'When is open enrolment and what can I change?' },
    ...leave.requests.filter((r) => r.status === 'Pending').map((r) => ({ severity: 'info', title: `Leave ${r.id} awaiting approval`, detail: `${r.start} to ${r.end} · ${r.days} days`, agent: 'leave-attendance', prompt: 'What is the status of my leave requests?' })),
    ...requests.filter((r) => r.jira?.key && r.jira.category !== 'done').map((r) => ({ severity: 'info', title: `${r.item}: ${r.jira.key} is ${r.jira.status}`, detail: `Jira · ${r.id}${r.jira.assignee ? ` · ${r.jira.assignee}` : ''}`, agent: 'it-facilities', prompt: `What is the Jira status of request ${r.id}?` })),
    ...requests.filter((r) => r.jira?.pending).map((r) => ({ severity: 'warning', title: `${r.item}: Jira sync pending`, detail: r.id, agent: 'it-facilities', prompt: 'What is the Jira status of my requests?' })),
    { severity: 'good', title: `Next holiday: ${holidays[0]?.name}`, detail: `${holidays[0]?.date} · in ${daysUntil(holidays[0]?.date)} days`, agent: 'leave-attendance', prompt: 'What are the upcoming holidays?' },
  ];

  return {
    role: 'employee',
    profile: { name: e.name, title: e.title, dept: e.dept, manager: e.manager, location: e.location, hireDate: e.hireDate, tenureYears: Number(years) },
    kpis: [
      { label: 'Annual leave left', value: leave.annual.remaining, unit: 'days', sub: `of ${leave.annual.entitlement} · ${leave.annual.taken} taken`, agent: 'leave-attendance', prompt: 'What is my leave balance?' },
      { label: 'Latest net pay', value: money(latest.net), sub: `${latest.period} · gross ${money(latest.gross)}`, agent: 'payroll-assistant', prompt: 'Explain my latest payslip' },
      { label: 'Office days', value: attendance.summary.office, unit: `/ ${attendance.days.length}`, sub: `${attendance.summary.remote} remote · last 20 working days`, agent: 'leave-attendance', prompt: 'Show my attendance for the last month' },
      { label: 'Open tasks', value: pending.length, sub: pending[0] ? `Next due ${pending[0].due}` : 'All done', agent: 'onboarding', prompt: 'What onboarding tasks are pending?' },
    ],
    leave: [
      { name: 'Annual', taken: leave.annual.taken, pending: leave.annual.pending, remaining: leave.annual.remaining },
      { name: 'Sick', taken: leave.sick.taken, pending: leave.sick.pending, remaining: leave.sick.remaining },
      { name: 'Floating', taken: leave.floating.taken, pending: leave.floating.pending, remaining: leave.floating.remaining },
    ],
    attendance: attendance.days.slice().reverse(),
    pay: payslips.slice().reverse().map((p) => ({ period: p.period, net: p.net, deductions: p.totalDeductions, gross: p.gross, bonus: p.earnings.performanceBonus })),
    payComponents: [
      { name: 'Basic', value: latest.earnings.basic },
      { name: 'Housing', value: latest.earnings.housingAllowance },
      { name: 'Special', value: latest.earnings.specialAllowance },
      { name: 'Tax', value: latest.deductions.incomeTax, deduction: true },
      { name: 'Pension', value: latest.deductions.pension5pct, deduction: true },
    ],
    holidays,
    onboarding: { done: onboarding.tasks.length - pending.length, total: onboarding.tasks.length, pending },
    allowances: benefits.allowances,
    requests: requests.slice(-4).reverse(),
    jira: jiraConfigured(),
    jobs: jobs.map((j) => ({ id: j.id, title: j.title, dept: j.dept, matchPct: j.matchPct, closes: j.closes })),
    learning: learning.map((l) => ({ id: l.id, title: l.title, hours: l.hours })),
    notifications,
  };
}

// ---------- HR operations (Tessa): live SAP SuccessFactors, filtered by division and period ----------
// Every widget, KPI and notification follows the same filters. Dated records are limited to the period;
// snapshot data (risk ratings, vacancies) follows the division filter, and headcount is shown as at the period end.
const day = (v) => { const m = v && String(v).match(/-?\d+/); return m ? new Date(Number(m[0])).toISOString().slice(0, 10) : null; };
const tally = (list, key, top = 12) => Object.entries(list.reduce((m, x) => { const k = key(x) || 'Unassigned'; m[k] = (m[k] || 0) + 1; return m; }, {}))
  .sort((a, b) => b[1] - a[1]).slice(0, top).map(([name, count]) => ({ name: /^\(\s*\)$/.test(name) ? 'Unassigned' : name, count }));
const code = (s) => (String(s || '').match(/\(([^)]+)\)\s*$/) || [])[1] || s || 'Unassigned';
const short = (s) => String(s || '').replace(/\s*\([^)]*\)$/, '');
const pct = (n, d) => (d ? Math.round((n / d) * 1000) / 10 : 0);
const fmtDate = (d) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const ISO = /^\d{4}-\d{2}-\d{2}$/;
const RISK = { 5324: 'Low', 5325: 'Medium', 5326: 'High' };
export const RANGES = [1, 3, 5, 10, 0]; // years; 0 = all time. A custom from/to range overrides these.

// Resolves the dashboard period: a custom from/to range, or the last N years (0 = all time) up to today.
export function resolvePeriod({ years = 5, from = null, to = null } = {}) {
  const today = new Date().toISOString().slice(0, 10);
  const thisYear = new Date().getFullYear();
  if (ISO.test(from || '') && ISO.test(to || '') && from <= to) return { from, to, custom: true, span: `${fmtDate(from)} – ${fmtDate(to)}` };
  return {
    from: years ? `${thisYear - years + 1}-01-01` : '1900-01-01', to: today, custom: false,
    span: years ? `last ${years} year${years > 1 ? 's' : ''}` : 'all time',
  };
}

// Hiring buckets: monthly for periods up to two years, otherwise yearly (at most the last 12 years).
function hireBuckets(scope, from, to) {
  const months = (Number(to.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(to.slice(5, 7)) - Number(from.slice(5, 7)) + 1;
  if (from > '1900-01-01' && months <= 24) {
    return Array.from({ length: months }, (_, i) => {
      const dt = new Date(Date.UTC(Number(from.slice(0, 4)), Number(from.slice(5, 7)) - 1 + i, 1));
      const ym = dt.toISOString().slice(0, 7);
      return { label: dt.toLocaleDateString('en-GB', { month: 'short', year: '2-digit', timeZone: 'UTC' }), hires: scope.filter((p) => { const h = day(p.hireDate); return h && h.startsWith(ym) && h >= from && h <= to; }).length };
    });
  }
  const toYear = Number(to.slice(0, 4));
  const hireYears = scope.map((p) => Number((day(p.hireDate) || '').slice(0, 4))).filter(Boolean);
  const first = Math.max(toYear - 11, from > '1900-01-01' ? Number(from.slice(0, 4)) : Math.min(toYear, ...hireYears));
  return Array.from({ length: toYear - first + 1 }, (_, i) => first + i)
    .map((year) => ({ label: String(year), hires: scope.filter((p) => { const h = day(p.hireDate); return h && h.startsWith(String(year)) && h >= from && h <= to; }).length }));
}

export async function hrDashboard({ division = null, years = 5, from: customFrom = null, to: customTo = null } = {}) {
  const raw = await settle([
    ['users', () => sapData.users()], ['positions', () => sapData.positions()], ['reqs', () => sapData.requisitions()],
    ['apps', () => sapData.applications()], ['forms', () => sapData.reviewForms()], ['permits', () => sapData.permits()],
    ['workflows', () => sapData.workflows()], ['todos', () => sapData.todos()], ['timeOff', () => sapData.pendingTimeOff()],
    ['payroll', () => sapTools.sap_payroll_review.run()],
  ]);
  const now = new Date().toISOString().slice(0, 10);
  const period = resolvePeriod({ years, from: customFrom, to: customTo });
  const { from, to, span } = period;
  const inRange = (d) => Boolean(d) && d >= from && d <= to;

  const allUsers = raw.users || [];
  const people = allUsers.filter((p) => p.status === 't');
  const divisions = tally(people.filter((p) => p.division && p.division !== 'N/A'), (p) => p.division, 30).map((d) => d.name);
  if (division && !divisions.includes(division)) division = null;
  const divisionOf = Object.fromEntries(allUsers.map((p) => [p.userId, p.division]));
  const nameOf = Object.fromEntries(allUsers.map((p) => [p.userId, p.displayName]));
  const inDivision = (userId) => !division || divisionOf[userId] === division;
  // Headcount as at the end of the period: active employees hired on or before that date.
  const asOf = (p) => !day(p.hireDate) || day(p.hireDate) <= to;
  const scope = people.filter((p) => (!division || p.division === division) && asOf(p));
  const scopeIds = new Set(scope.map((p) => p.userId));
  const activePos = (raw.positions || []).filter((p) => p.effectiveStatus === 'A');
  const isVacant = (p) => p.vacant === true || p.vacant === 'true';
  const posScope = activePos.filter((p) => !division || p.division === code(division));

  const headcount = raw.users ? divisions.slice(0, 8).map((name) => {
    const pos = activePos.filter((p) => p.division === code(name));
    const vacant = pos.filter(isVacant).length;
    return { division: name, name: short(name), headcount: people.filter((p) => p.division === name && asOf(p)).length, vacant, vacancyRatePct: pct(vacant, pos.length), selected: name === division };
  }) : null;
  const hires = raw.users ? hireBuckets(people.filter((p) => !division || p.division === division), from, to) : null;
  const hiresInPeriod = hires ? hires.reduce((s, h) => s + h.hires, 0) : 0;

  const reqs = (raw.reqs || []).filter((r) => r.deleted !== 'Deleted' && r.internalStatus !== 'Closed'
    && (!division || code(r.divisionCode) === code(division)) && inRange(day(r.createdDateTime)));
  const appsByReq = (raw.apps || []).reduce((m, a) => { (m[a.jobReqId] ||= []).push(a.status); return m; }, {});
  const reqApps = reqs.flatMap((r) => (appsByReq[r.jobReqId] || []).map((status) => ({ status })));

  const forms = (raw.forms || []).filter((f) => (!division || scopeIds.has(f.formSubjectId)) && inRange(day(f.formReviewDueDate)));
  const done = forms.filter((f) => f.formDataStatus === '3').length;
  const overdue = forms.filter((f) => f.formDataStatus !== '3' && day(f.formReviewDueDate) < now);

  const rated = scope.filter((p) => RISK[p.riskOfLoss]);
  const riskByDiv = Object.entries(rated.reduce((m, p) => { const d = p.division || 'Unassigned'; (m[d] ||= { High: 0, Medium: 0, Low: 0 })[RISK[p.riskOfLoss]]++; return m; }, {}))
    .map(([d, r]) => ({ division: d, rated: r.High + r.Medium + r.Low, high: r.High, highRiskPct: pct(r.High, r.High + r.Medium + r.Low) }))
    .filter((d) => d.rated >= 4).sort((a, b) => b.highRiskPct - a.highRiskPct);
  const regrettable = rated.filter((p) => RISK[p.riskOfLoss] === 'High' && /star|solid contributor|experienced/i.test(p.matrix1Label || ''));

  // Time-off approvals: pending requests starting in the period.
  const timeOff = (raw.timeOff || []).filter((x) => inDivision(x.userId) && inRange(day(x.startDate)));

  // Workflow requests: pending requests raised in the period.
  const age = (d) => Math.round((Date.now() - Date.parse(d)) / 864e5);
  const pendingWf = (raw.workflows || []).filter((w) => w.status === 'PENDING' && inDivision(w.createdBy) && inRange(day(w.createdDateTime)))
    .map((w) => ({ id: w.wfRequestId, type: w.module === 'HRIS' ? 'Employee data change' : 'Generic object change', step: `${w.currentStepNum ?? '?'} of ${w.totalSteps ?? '?'}`, created: day(w.createdDateTime), ageDays: age(day(w.createdDateTime)), requestedBy: nameOf[w.createdBy] || w.createdBy }))
    .sort((a, b) => b.created.localeCompare(a.created));
  const bucket = (p) => (p.ageDays < 30 ? 'Under 30 days' : p.ageDays < 180 ? '30 to 180 days' : 'Over 180 days');
  const todos = (raw.todos || []).filter((x) => inDivision(x.userId));

  // Employee documents: expired or expiring within the period; undated documents are data-quality gaps.
  const docs = (raw.permits || []).filter((x) => inDivision(x.userId)).map((x) => {
    const expires = day(x.expirationDate);
    const in90 = new Date(Date.now() + 90 * 864e5).toISOString().slice(0, 10);
    return { employee: nameOf[x.userId] || x.userId, document: x.documentTitle || 'Untitled document', expires, state: !expires ? 'No expiry date' : expires < now ? 'Expired' : expires <= in90 ? 'Expiring within 90 days' : 'Valid' };
  });
  const docsInPeriod = docs.filter((x) => x.expires && inRange(x.expires));
  const docsDue = docsInPeriod.filter((x) => x.state !== 'Valid').sort((a, b) => b.expires.localeCompare(a.expires));
  const missingExpiry = docs.filter((x) => !x.expires).length;
  const timesheets = todos.filter((x) => /time ?sheet/i.test(`${x.categoryLabel} ${x.todoEntryName}`)).length;

  // Payroll: findings for the division; dated pay changes limited to the period.
  const pay = raw.payroll;
  const payFindings = pay ? pay.allFindings.filter((f) => inDivision(f.userId) && (!f.date || inRange(f.date))) : null;

  const expired = docsDue.filter((x) => x.state === 'Expired').length;
  const label = division ? short(division) : 'All divisions';
  const scopeText = `${label} · ${span}`;
  const stalled = pendingWf.filter((p) => p.ageDays >= 30).length;

  const notifications = [
    raw.permits && expired && { severity: 'critical', title: `${expired} identity or work-permit documents expired`, detail: scopeText, agent: 'compliance', prompt: 'Which employee documents have expired or are expiring soon?' },
    raw.permits && missingExpiry && { severity: 'serious', title: `${missingExpiry} documents have no expiry date`, detail: `${label} · data quality`, agent: 'compliance', prompt: 'Which employee documents are missing an expiry date?' },
    raw.timeOff && timeOff.length && { severity: 'warning', title: `${timeOff.length} time-off requests awaiting approval`, detail: scopeText, agent: 'ops-copilot', prompt: 'How many time-off requests are waiting for approval?' },
    raw.workflows && stalled && { severity: 'warning', title: `${stalled} workflow requests stalled over 30 days`, detail: `${pendingWf.length} pending · ${scopeText}`, agent: 'ops-copilot', prompt: 'Which workflow requests are stalled and what should I do?' },
    raw.todos && timesheets && { severity: 'warning', title: `${timesheets} timesheet to-dos open`, detail: label, agent: 'compliance', prompt: 'How many timesheet to-dos are open?' },
    raw.forms && overdue.length && { severity: 'warning', title: `${overdue.length.toLocaleString()} performance reviews overdue`, detail: scopeText, agent: 'performance', prompt: 'Which appraisals are most overdue?' },
    payFindings && payFindings.length && { severity: 'info', title: `${payFindings.length} pay exceptions`, detail: scopeText, agent: 'payroll-ops', prompt: 'Check SAP pay data for exceptions' },
    ...recentSubmissions().slice(0, 1).map((n) => ({ severity: 'info', title: `New application: ${n.name} for ${n.title}`, detail: 'Job portal · ATS scored', agent: 'recruitment', prompt: `Show the top 5 candidates for ${n.title}` })),
  ].filter(Boolean);

  const vacantInScope = posScope.filter(isVacant).length;
  return {
    role: 'hr',
    sapAvailable: Object.values(raw).some(Boolean),
    filters: { division, years: period.custom ? null : years, from: period.custom ? from : null, to: period.custom ? to : null, custom: period.custom, divisions, ranges: RANGES, label, span },
    kpis: [
      raw.users && { label: 'Active employees', value: scope.length.toLocaleString(), sub: `${division ? short(division) : `${divisions.length} divisions`} · as at ${fmtDate(to)}`, agent: 'workforce', prompt: division ? `Show the workforce profile for the ${short(division)} division` : 'Show headcount by division and country', sap: true },
      raw.users && { label: 'New hires', value: hiresInPeriod.toLocaleString(), sub: span, agent: 'workforce', prompt: 'How has hiring trended over the last 5 years?', sap: true },
      raw.positions && { label: 'Vacant positions', value: vacantInScope.toLocaleString(), sub: `${pct(vacantInScope, posScope.length)}% of ${posScope.length.toLocaleString()} positions · current`, agent: 'workforce', prompt: 'Where do we have the most vacancies?', sap: true },
      raw.reqs && { label: 'Open requisitions', value: reqs.length, sub: `${reqs.reduce((s, r) => s + Math.max(0, Number(r.numberOpenings || 0) - Number(r.openingsFilled || 0)), 0)} openings · ${span}`, agent: 'recruitment', prompt: 'Show our hiring progress', sap: true },
      raw.timeOff && { label: 'Approvals waiting', value: timeOff.length, sub: `Time-off requests · ${span}`, agent: 'ops-copilot', prompt: 'How many time-off requests are waiting for approval?', sap: true },
      raw.forms && { label: 'Reviews overdue', value: overdue.length.toLocaleString(), sub: `${pct(done, forms.length)}% of forms done · ${span}`, agent: 'performance', prompt: 'Which appraisals are most overdue?', sap: true },
      raw.workflows && { label: 'Pending workflows', value: pendingWf.length, sub: `${stalled} waiting over 30 days · ${span}`, agent: 'ops-copilot', prompt: 'Which workflow requests are stalled and what should I do?', sap: true },
    ].filter(Boolean),
    headcount,
    hires,
    countries: raw.users ? tally(scope.filter((p) => p.country && p.country !== 'null'), (p) => p.country, 6) : null,
    departments: raw.users && division ? tally(scope.filter((p) => p.department && p.department !== 'N/A'), (p) => p.department, 6) : null,
    applications: raw.apps ? tally(reqApps, (a) => a.status, 5) : null,
    busiestReqs: raw.reqs ? reqs.map((r) => ({ jobReqId: r.jobReqId, department: r.departmentCode || null, location: r.locationCode || null, status: r.internalStatus, applications: (appsByReq[r.jobReqId] || []).length }))
      .sort((a, b) => b.applications - a.applications).slice(0, 5) : null,
    reviews: raw.forms ? {
      total: forms.length, completionPct: pct(done, forms.length),
      overdue: overdue.slice(0, 5).map((f) => ({ form: f.formTitle, dueDate: day(f.formReviewDueDate), daysOverdue: Math.round((Date.now() - Date.parse(day(f.formReviewDueDate))) / 864e5) })),
    } : null,
    risk: raw.users ? {
      distribution: tally(rated, (p) => RISK[p.riskOfLoss]), divisions: riskByDiv.slice(0, 5), regrettable: regrettable.length,
      regrettableList: division ? regrettable.slice(0, 6).map((p) => ({ name: p.displayName, title: p.title, performance: p.matrix1Label })) : [],
    } : null,
    payroll: payFindings ? { findings: tally(payFindings, (f) => f.issue), top: payFindings.slice(0, 4) } : null,
    compliance: raw.permits ? {
      tracked: docs.length, status: tally(docsInPeriod, (x) => x.state).concat(missingExpiry ? [{ name: 'No expiry date', count: missingExpiry }] : []),
      documents: docsDue.slice(0, 5), missingExpiry, timesheets, alerts: todos.filter((x) => /EC Alert|Alert for/i.test(`${x.categoryLabel} ${x.todoEntryName}`)).length,
    } : null,
    workflows: raw.workflows ? {
      pending: pendingWf.length,
      byAge: ['Under 30 days', '30 to 180 days', 'Over 180 days'].map((name) => ({ name, count: pendingWf.filter((p) => bucket(p) === name).length })),
      byType: tally(pendingWf, (p) => p.type), latest: pendingWf.slice(0, 5),
      todos: tally(todos, (x) => (/^\d+$/.test(x.categoryLabel || '') ? 'Profile completion' : x.categoryLabel), 5),
    } : null,
    trainingByDept: Object.entries(wd.trainingByDept).map(([name, p]) => ({ name, pct: p })).sort((x, y) => x.pct - y.pct),
    // HR case queue (built-in case store) for the Case Management agent's overview.
    cases: tools.get_cases.run(null, {}).filter((x) => x.status !== 'Closed').slice(0, 6)
      .map((x) => ({ id: x.id, subject: x.subject, employee: x.employee, priority: x.priority, category: x.category, received: x.received })),
    notifications,
  };
}
