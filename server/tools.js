// Built-in HR tools: run against the demo HR store in mockHr.js. IT & Facilities requests are also raised in Jira.
// Live SAP SuccessFactors tools live in sap.js; agents.js decides which agent gets which.
import wd from './mockHr.js';
import { createIssue, issueStatus, jiraConfigured } from './jira.js';

// Raise the request in Jira if it has no issue yet (or a previous attempt failed); otherwise refresh its status.
async function syncJira(r, u) {
  try {
    const name = u?.name || wd.employee(r.empId)?.name || r.empId;
    r.jira = r.jira?.key
      ? await issueStatus(r.jira.key)
      : await createIssue({
        summary: `[${r.category}] ${r.item} for ${name} (${r.id})`,
        description: `Service request ${r.id} raised via NTT DATA HRMS.\nRequested by: ${name} (${r.empId})\nCategory: ${r.category}\nItem: ${r.item}\nDetails: ${r.details || 'None'}`,
        labels: ['hrms', r.category.toLowerCase()],
      });
    r.status = r.jira.category === 'done' ? 'Fulfilled' : r.jira.category === 'indeterminate' ? 'In progress' : 'Submitted';
  } catch (e) {
    if (!r.jira?.key) r.jira = { pending: true, error: e.message };
    else r.jira.error = e.message;
  }
  wd.saveRequests();
  return r;
}

const S = (description) => ({ type: 'STRING', description });
const none = { type: 'OBJECT', properties: {} };
const obj = (properties, required = []) => ({ type: 'OBJECT', properties, required });
const overlap = (a, b) => a.filter((x) => b.includes(x));
const pct = (n, d) => (d ? Math.round((n / d) * 100) : 0);

const tools = {
  // ---------------- Employee tools ----------------
  search_policies: {
    description: 'Search company HR policies, employment terms and procedures by keyword.',
    parameters: obj({ query: S('Keywords, e.g. "parental leave" or "notice period"') }, ['query']),
    run: (u, { query = '' }) => {
      const words = query.toLowerCase().split(/\W+/).filter((w) => w.length > 2);
      const scored = wd.policies
        .map((p) => ({ p, s: words.filter((w) => (p.title + ' ' + p.keywords + ' ' + p.summary).toLowerCase().includes(w)).length }))
        .filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3).map((x) => x.p);
      return scored.length ? scored.map(({ id, title, category, summary }) => ({ id, title, category, summary })) : { message: 'No matching policy. Suggest contacting HR.' };
    },
    brief: (d) => (Array.isArray(d) ? `I found ${d.length} relevant policy section(s) in the HR policy library.` : 'I could not find a matching policy.'),
  },
  get_employee_profile: {
    description: 'Get the signed-in employee\'s HR profile (title, department, manager, location, hire date).',
    parameters: none,
    run: (u) => { const { id, name, title, dept, manager, location, hireDate, email } = wd.employee(u.empId); return { id, name, title, dept, manager, location, hireDate, email }; },
    brief: () => 'Here is your HR profile.',
  },
  get_leave_balance: {
    description: 'Get leave balances and leave request history for the signed-in employee.',
    parameters: none,
    run: (u) => wd.leaveBalance(u.empId),
    brief: (d) => `You have **${d.annual.remaining} days** of annual leave remaining, ${d.sick.remaining} sick days and ${d.floating.remaining} floating holiday.`,
  },
  get_attendance: {
    description: 'Get the last 20 working days of attendance (office, remote, leave, late arrivals) for the signed-in employee.',
    parameters: none,
    run: () => { const rows = wd.attendance(); return { summary: { office: rows.filter((r) => r.status === 'Office').length, remote: rows.filter((r) => r.status === 'Remote').length, leave: rows.filter((r) => r.status === 'Leave').length, late: rows.filter((r) => r.status === 'Late arrival').length }, days: rows }; },
    brief: (d) => `Over the last 20 working days: ${d.summary.office} office, ${d.summary.remote} remote, ${d.summary.leave} leave and ${d.summary.late} late arrival(s).`,
  },
  get_holidays: {
    description: 'List upcoming company holidays.',
    parameters: none,
    run: () => wd.holidays.filter((h) => h.date >= wd.today()),
    brief: (d) => `The next company holiday is **${d[0]?.name}** on ${d[0]?.date}.`,
  },
  submit_leave_request: {
    description: 'Submit a leave request on behalf of the signed-in employee. Only call after the employee has given leave type and dates. Dates are YYYY-MM-DD.',
    parameters: obj({ leaveType: S('Annual, Sick or Floating'), startDate: S('YYYY-MM-DD'), endDate: S('YYYY-MM-DD'), reason: S('Optional reason') }, ['leaveType', 'startDate', 'endDate']),
    run: (u, a) => {
      const type = ['Annual', 'Sick', 'Floating'].find((t) => t.toLowerCase() === String(a.leaveType || '').toLowerCase());
      if (!type) return { error: 'Leave type must be Annual, Sick or Floating.' };
      if (!/^\d{4}-\d{2}-\d{2}$/.test(a.startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(a.endDate) || a.endDate < a.startDate) return { error: 'Invalid dates.' };
      const bal = wd.leaveBalance(u.empId)[type.toLowerCase()];
      const days = wd.bizDays(a.startDate, a.endDate);
      if (days > bal.remaining) return { error: `Only ${bal.remaining} ${type} days remaining; request needs ${days}.` };
      const r = wd.addLeave(u.empId, type, a.startDate, a.endDate, a.reason || '');
      return { ...r, approver: wd.employee(u.empId).manager, message: 'Submitted in the HR system and routed to your manager for approval.' };
    },
    brief: (d) => (d.error ? d.error : `Done. Request **${d.id}** (${d.days} working days) was submitted and routed to ${d.approver} for approval.`),
  },
  get_payslips: {
    description: 'Get the last 3 payslips with earnings, deductions and net pay.',
    parameters: none,
    run: (u) => wd.payslips(u.empId),
    brief: (d) => `Your latest payslip (${d[0].period}): gross **$${d[0].gross.toLocaleString()}**, deductions $${d[0].totalDeductions.toLocaleString()}, net **$${d[0].net.toLocaleString()}**.`,
  },
  get_tax_info: {
    description: 'Get year-to-date tax withholding and tax profile.',
    parameters: none,
    run: (u) => wd.taxInfo(u.empId),
    brief: () => 'Here is your year-to-date tax summary from payroll.',
  },
  get_onboarding_tasks: {
    description: 'Get onboarding / joining tasks, due dates and the new-joiner guide.',
    parameters: none,
    run: (u) => wd.onboarding(u.empId),
    brief: (d) => `You have ${d.tasks.filter((t) => t.status === 'Pending').length} pending task(s) and ${d.tasks.filter((t) => t.status === 'Completed').length} completed.`,
  },
  get_learning_recommendations: {
    description: 'Get employee career profile (skills, goals) and the learning catalog, to recommend training.',
    parameters: none,
    run: (u) => {
      const { profile, catalog } = wd.learning(u.empId);
      const goalSkills = ['leadership', 'architecture', 'management', 'mentoring'];
      return { profile, recommendations: catalog.map((c) => ({ ...c, relevance: overlap(c.skills, goalSkills).length })).filter((c) => c.relevance > 0).sort((a, b) => b.relevance - a.relevance) };
    },
    brief: (d) => `Based on your goals (${d.profile.goals.join(', ')}), here are courses ranked by relevance.`,
  },
  get_internal_jobs: {
    description: 'List open internal job postings matched against the employee\'s skills.',
    parameters: none,
    run: (u) => {
      const skills = wd.learning(u.empId).profile.skills;
      return wd.internalJobs.map((j) => ({ ...j, matchPct: pct(overlap(j.skills, skills).length, j.skills.length), skills: j.skills.join(', ') })).sort((a, b) => b.matchPct - a.matchPct);
    },
    brief: (d) => `Your best internal match is **${d[0].title}** (${d[0].matchPct}% skills match).`,
  },
  get_benefits: {
    description: 'Get medical, dental, vision, insurance, pension and allowance entitlements.',
    parameters: none,
    run: (u) => wd.benefits(u.empId),
    brief: () => 'Here are your current benefits elections and entitlements.',
  },
  get_service_requests: {
    description: 'List IT and facilities requests raised by the employee with their live Jira issue key, Jira status, assignee and link, plus the request catalog.',
    parameters: none,
    run: async (u) => {
      const mine = wd.serviceRequestsFor(u.empId);
      // Only requests raised through Jira are synced (older requests predate the integration).
      if (jiraConfigured()) await Promise.all(mine.filter((r) => r.jira).map((r) => syncJira(r, u)));
      return { myRequests: mine, catalog: wd.serviceCatalog };
    },
    brief: (d) => `You have ${d.myRequests.length} request(s) on record.`,
  },
  create_service_request: {
    description: 'Raise an IT or facilities request (laptop, software access, desk, badge, parking, etc.). It is logged in Jira as an issue; the result includes the Jira key, status and link.',
    parameters: obj({ category: S('IT or Facilities'), item: S('What is needed, e.g. "New laptop"'), details: S('Extra details') }, ['category', 'item']),
    run: async (u, a) => {
      const r = wd.addServiceRequest(u.empId, a.category === 'Facilities' ? 'Facilities' : 'IT', a.item, a.details || '');
      if (jiraConfigured()) { r.jira = { pending: true }; await syncJira(r, u); }
      return r;
    },
    brief: (d) => (d.jira?.key
      ? `Request **${d.id}** (${d.item}) was raised in Jira as **${d.jira.key}**, status **${d.jira.status}**.`
      : `Request **${d.id}** (${d.item}) was created for the ${d.category} team.${d.jira?.error ? ` Jira sync is pending: ${d.jira.error}` : ''}`),
  },
  list_documents: {
    description: 'List the employee\'s documents in the HR system and the letter types they can generate.',
    parameters: none,
    run: (u) => ({ documents: wd.documents(u.empId), generatableLetters: wd.letterTypes }),
    brief: (d) => `You have ${d.documents.length} documents on file and can generate ${d.generatableLetters.length} letter types.`,
  },
  generate_document: {
    description: 'Generate an HR letter. documentType is one of: Employment Verification, Salary Certificate, Experience Letter, Address Proof, Visa Support Letter.',
    parameters: obj({ documentType: S('Letter type') }, ['documentType']),
    run: (u, a) => {
      const t = wd.letterTypes.find((x) => x.toLowerCase() === String(a.documentType || '').toLowerCase());
      return t ? wd.addLetter(u.empId, t) : { error: 'Unknown letter type.', available: wd.letterTypes };
    },
    brief: (d) => (d.error ? d.error : `Your **${d.type}** letter is ready (ref ${d.id}). ${d.note}`),
  },

  // ---------------- HR operations tools ----------------
  get_pending_tasks: {
    description: 'Consolidated HR work queue: open cases, approvals, payroll exceptions, compliance items due soon, overdue reviews.',
    parameters: none,
    run: () => {
      const openCases = wd.cases.filter((c) => c.status !== 'Closed');
      const exceptions = tools.get_payroll_exceptions.run();
      const in14 = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
      const compliance = wd.complianceItems.filter((c) => c.due <= in14);
      return {
        totals: { openCases: openCases.length, untriagedCases: openCases.filter((c) => !c.category).length, approvalsWaiting: wd.approvals.length, payrollExceptions: exceptions.length, complianceDue14Days: compliance.length, overdueReviews: Object.values(wd.reviewStatus).filter((s) => s === 'Overdue').length },
        approvals: wd.approvals,
        urgentCompliance: compliance.map(({ id, item, due, severity }) => ({ id, item, due, severity })),
        topPayrollExceptions: exceptions.slice(0, 3),
      };
    },
    brief: (d) => `You have **${d.totals.openCases} open cases** (${d.totals.untriagedCases} untriaged), **${d.totals.approvalsWaiting} approvals**, **${d.totals.payrollExceptions} payroll exceptions** and ${d.totals.complianceDue14Days} compliance items due within 14 days.`,
  },
  get_requisitions: {
    description: 'List open job requisitions with pipeline counts.',
    parameters: none,
    run: () => wd.requisitions.map((r) => ({ ...r, skills: r.skills.join(', '), candidates: wd.candidates.filter((c) => c.reqId === r.id).length })),
    brief: (d) => `There are ${d.length} open requisitions covering ${d.reduce((s, r) => s + r.openings, 0)} positions.`,
  },
  screen_candidates: {
    description: 'Screen and rank candidates for a requisition by skill match. Returns match %, matched and missing skills.',
    parameters: obj({ requisitionId: S('Requisition id such as R-101') }, ['requisitionId']),
    run: (u, { requisitionId = 'R-101' }) => {
      const req = wd.requisitions.find((r) => r.id.toLowerCase() === String(requisitionId).toLowerCase());
      if (!req) return { error: 'Requisition not found', available: wd.requisitions.map((r) => r.id) };
      return {
        requisition: `${req.id} ${req.title}`,
        ranked: wd.candidates.filter((c) => c.reqId === req.id).map((c) => ({
          id: c.id, name: c.name, years: c.years, stage: c.stage,
          matchPct: pct(overlap(req.skills, c.skills).length, req.skills.length),
          matched: overlap(req.skills, c.skills).join(', '), missing: req.skills.filter((s) => !c.skills.includes(s)).join(', ') || 'none',
        })).sort((a, b) => b.matchPct - a.matchPct),
      };
    },
    brief: (d) => (d.error ? d.error : `I ranked ${d.ranked.length} candidates for ${d.requisition}. Top match: **${d.ranked[0].name}** (${d.ranked[0].matchPct}%).`),
  },
  schedule_interview: {
    description: 'Schedule an interview for a candidate. dateTime format YYYY-MM-DD HH:mm.',
    parameters: obj({ candidateId: S('Candidate id such as C-9001'), dateTime: S('YYYY-MM-DD HH:mm') }, ['candidateId', 'dateTime']),
    run: (u, a) => wd.scheduleInterview(a.candidateId, a.dateTime),
    brief: (d) => (d.error ? d.error : `Interview **${d.id}** booked for ${d.candidate} on ${d.dateTime}. Stage updated in the recruiting system.`),
  },
  get_payroll_exceptions: {
    description: 'Detect payroll exceptions in the latest run: unusual net-pay swings, duplicate payments, missing timesheets, payments to terminated workers.',
    parameters: none,
    run: () => {
      const out = [];
      for (const p of wd.payrollRun) {
        const change = (p.currNet - p.prevNet) / p.prevNet;
        if (Math.abs(change) >= 0.15) out.push({ empId: p.empId, name: p.name, issue: 'Unusual salary change', detail: `Net pay ${change > 0 ? '+' : ''}${Math.round(change * 100)}% (${p.prevNet} to ${p.currNet})`, severity: 'High' });
        if (p.payments > 1) out.push({ empId: p.empId, name: p.name, issue: 'Duplicate payment', detail: `${p.payments} payments of ${p.currNet} in one run`, severity: 'Critical' });
        if (!p.timesheet && p.status === 'Active') out.push({ empId: p.empId, name: p.name, issue: 'Missing timesheet', detail: 'No approved timesheet for the period', severity: 'Medium' });
        if (p.status === 'Terminated') out.push({ empId: p.empId, name: p.name, issue: 'Paid after termination', detail: `Terminated worker received ${p.currNet}`, severity: 'Critical' });
      }
      const rank = { Critical: 0, High: 1, Medium: 2 };
      return out.sort((a, b) => rank[a.severity] - rank[b.severity]);
    },
    brief: (d) => `I found **${d.length} payroll exceptions** in the current run; ${d.filter((x) => x.severity === 'Critical').length} are critical.`,
  },
  get_cases: {
    description: 'List employee HR cases with employee name, text, category, priority and assigned team. Use update_case to triage.',
    parameters: obj({ status: S('Optional filter: New, In Progress') }),
    run: (u, { status } = {}) => wd.cases.filter((c) => !status || c.status === status).map((c) => ({ ...c, employee: wd.employee(c.empId).name })),
    brief: (d) => `There are ${d.length} cases in the queue.`,
  },
  update_case: {
    description: 'Triage a case: set category (Payroll, Leave, Benefits, Employee Relations, Documents, Work Arrangement), priority (Low, Medium, High, Critical), assigned team, and optionally a draft response to the employee.',
    parameters: obj({ caseId: S('Case id such as CS-3301'), category: S('Category'), priority: S('Low, Medium, High or Critical'), assignedTeam: S('Team name'), draftResponse: S('Draft reply to employee') }, ['caseId', 'category', 'priority', 'assignedTeam']),
    run: (u, a) => wd.updateCase(a.caseId, { category: a.category, priority: a.priority, team: a.assignedTeam, draft: a.draftResponse || null }),
    brief: (d) => (d.error ? d.error : `Case ${d.id} triaged as ${d.category} / ${d.priority}, assigned to ${d.team}.`),
  },
  get_workforce_summary: {
    description: 'Headcount by department, vacancies, planned headcount and utilization for workforce planning.',
    parameters: none,
    run: () => {
      const plan = { Engineering: 8, Sales: 5, Finance: 3, Marketing: 3, Support: 6, 'Human Resources': 1 };
      const util = { Engineering: 91, Sales: 84, Finance: 78, Marketing: 72, Support: 96, 'Human Resources': 80 };
      return Object.keys(plan).map((dept) => {
        const headcount = wd.employees.filter((e) => e.dept === dept && e.status === 'Active').length;
        const openRoles = wd.requisitions.filter((r) => r.dept === dept).reduce((s, r) => s + r.openings, 0);
        return { dept, headcount, openRoles, plannedHeadcount: plan[dept], gap: plan[dept] - headcount - openRoles, utilizationPct: util[dept], flag: util[dept] >= 90 ? 'Overloaded' : util[dept] < 75 ? 'Under-utilised' : 'Healthy' };
      });
    },
    brief: (d) => { const o = d.filter((x) => x.flag === 'Overloaded').map((x) => x.dept); return `Total active headcount is **${d.reduce((s, x) => s + x.headcount, 0)}**. ${o.length ? 'Overloaded: ' + o.join(', ') + '.' : ''}`; },
  },
  get_compliance_status: {
    description: 'Compliance monitoring: outstanding acknowledgements, missing documents, training completion by department, statutory deadlines.',
    parameters: none,
    run: () => ({ items: [...wd.complianceItems].sort((a, b) => a.due.localeCompare(b.due)), trainingCompletionPctByDept: wd.trainingByDept }),
    brief: (d) => `**${d.items.filter((i) => ['Critical', 'High'].includes(i.severity)).length} high-priority** compliance items. Lowest training completion: ${Object.entries(d.trainingCompletionPctByDept).sort((a, b) => a[1] - b[1])[0].join(' at ')}%.`,
  },
  get_performance_status: {
    description: 'Performance cycle progress: review completion by status and the list of overdue appraisals.',
    parameters: none,
    run: () => {
      const rows = Object.entries(wd.reviewStatus).map(([id, status]) => ({ empId: id, name: wd.employee(id).name, manager: wd.employee(id).manager, dept: wd.employee(id).dept, status }));
      const count = (s) => rows.filter((r) => r.status === s).length;
      return { cycle: 'FY26 Mid-year', completionPct: pct(count('Completed'), rows.length), counts: { Completed: count('Completed'), 'In Progress': count('In Progress'), 'Not Started': count('Not Started'), Overdue: count('Overdue') }, overdue: rows.filter((r) => r.status === 'Overdue') };
    },
    brief: (d) => `${d.cycle} is **${d.completionPct}% complete**; ${d.counts.Overdue} appraisals are overdue.`,
  },
  get_attrition_analysis: {
    description: 'Attrition analysis: exits per department, attrition rate, and employees at flight risk with drivers.',
    parameters: none,
    run: () => {
      const depts = Object.entries(wd.exits12m).map(([dept, exits]) => {
        const hc = wd.employees.filter((e) => e.dept === dept && e.status === 'Active').length;
        return { dept, exits12m: exits, headcount: hc, attritionPct: pct(exits, hc + exits), attention: pct(exits, hc + exits) >= 40 ? 'Retention focus' : 'Monitor' };
      }).sort((a, b) => b.attritionPct - a.attritionPct);
      const atRisk = Object.entries(wd.riskFactors).map(([id, f]) => ({ empId: id, name: wd.employee(id).name, dept: wd.employee(id).dept, riskScore: Math.round((100 - f.engagement) * 0.5 + (1 - f.compaRatio) * 200 + f.monthsSincePromo * 0.4), drivers: f.note })).sort((a, b) => b.riskScore - a.riskScore);
      return { departments: depts, flightRisk: atRisk };
    },
    brief: (d) => `Highest attrition: **${d.departments[0].dept}** (${d.departments[0].attritionPct}% over 12 months). Top flight-risk employee: ${d.flightRisk[0].name}.`,
  },
  process_hr_documents: {
    description: 'Review employee documents submitted to the HR system: check completeness and flag discrepancies (expired, name mismatch, missing signature or sections).',
    parameters: none,
    run: () => wd.submittedDocs.map((d) => {
      const x = d.extracted, flags = [];
      const emp = wd.employee(d.empId);
      if (x.expiry && x.expiry < wd.today()) flags.push('Document expired ' + x.expiry);
      else if (x.expiry && x.expiry < new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10)) flags.push('Expires within 30 days (' + x.expiry + ')');
      if (x.fullName && x.fullName.split(' ')[0].toLowerCase().slice(0, 4) !== emp.name.split(' ')[0].toLowerCase().slice(0, 4)) flags.push(`Name mismatch: "${x.fullName}" vs HR record "${emp.name}"`);
      if (x.signature === false) flags.push('Missing signature');
      if (x.section2 === false) flags.push('Section 2 incomplete');
      if (x.doctorStamp === false) flags.push('Missing doctor stamp');
      return { id: d.id, employee: d.employee, docType: d.docType, extracted: Object.entries(x).map(([k, v]) => `${k}: ${v}`).join('; '), result: flags.length ? 'Flagged' : 'Complete', flags: flags.join(' | ') || 'None' };
    }),
    brief: (d) => `Reviewed ${d.length} documents: **${d.filter((x) => x.result === 'Flagged').length} flagged**, ${d.filter((x) => x.result === 'Complete').length} complete.`,
  },
  get_executive_report: {
    description: 'Management report data: headcount, hiring, payroll, leave and workforce trends in one view.',
    parameters: none,
    run: () => {
      const active = wd.employees.filter((e) => e.status === 'Active');
      const payroll = active.reduce((s, e) => s + e.salary / 12, 0);
      const perf = tools.get_performance_status.run();
      const attr = tools.get_attrition_analysis.run();
      return {
        asOf: wd.today(),
        workforce: { activeHeadcount: active.length, newJoinersLast30d: active.filter((e) => e.hireDate >= new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10)).length, leaversLast12m: Object.values(wd.exits12m).reduce((a, b) => a + b, 0) },
        hiring: { openRequisitions: wd.requisitions.length, openPositions: wd.requisitions.reduce((s, r) => s + r.openings, 0), avgDaysOpen: Math.round(wd.requisitions.reduce((s, r) => s + r.openDays, 0) / wd.requisitions.length), candidatesInPipeline: wd.candidates.length },
        payroll: { monthlyGrossBase: Math.round(payroll), exceptionsThisRun: tools.get_payroll_exceptions.run().length },
        leave: { avgAnnualLeaveUtilisationPct: 41, upcomingHolidays: wd.holidays.filter((h) => h.date >= wd.today()).slice(0, 2).map((h) => h.name + ' ' + h.date) },
        performance: { cycle: perf.cycle, completionPct: perf.completionPct, overdue: perf.counts.Overdue },
        attrition: { highestDept: attr.departments[0].dept, ratePct: attr.departments[0].attritionPct, flightRiskCount: attr.flightRisk.length },
        compliance: { highPriorityItems: wd.complianceItems.filter((c) => ['Critical', 'High'].includes(c.severity)).length },
      };
    },
    brief: (d) => `Executive snapshot as of ${d.asOf}: **${d.workforce.activeHeadcount} active employees**, ${d.hiring.openPositions} open positions, ${d.payroll.exceptionsThisRun} payroll exceptions.`,
  },
};

export { tools };
