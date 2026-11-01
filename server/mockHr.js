// Simulated HR system: the mock tenant behind every "Simulated" tool.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const DAY = 864e5;
const iso = (d) => d.toISOString().slice(0, 10);
const addDays = (n) => iso(new Date(Date.now() + n * DAY));
const round = (n) => Math.round(n);

const emp = (id, name, title, dept, manager, location, hireDate, salary, status = 'Active') => ({
  id, name, title, dept, manager, location, hireDate, salary, status,
  email: name.toLowerCase().replace(/[^a-z]+/g, '.') + '@hrms.example',
});

const employees = [
  emp('E1001', 'Tyson Reed', 'Senior Software Engineer', 'Engineering', 'Priya Shah', 'Austin, US', '2021-03-15', 112000),
  emp('E1002', 'Priya Shah', 'Engineering Manager', 'Engineering', 'Elena Brandt', 'Austin, US', '2018-06-01', 148000),
  emp('E1003', 'Marcus Lee', 'Sales Executive', 'Sales', 'Hannah Weber', 'Chicago, US', '2022-01-10', 78000),
  emp('E1004', 'Aisha Khan', 'Financial Analyst', 'Finance', 'Emma Clark', 'London, UK', '2020-09-21', 84000),
  emp('E1005', 'Daniel Cho', 'Software Engineer', 'Engineering', 'Priya Shah', 'Austin, US', '2023-02-06', 96000),
  emp('E1006', 'Sofia Rossi', 'Marketing Specialist', 'Marketing', 'Olivia Martin', 'Milan, IT', '2022-11-14', 70000),
  emp('E1007', 'Liam O\'Brien', 'Support Engineer', 'Support', 'Noah Kim', 'Dublin, IE', '2021-07-05', 62000),
  emp('E1008', 'Hannah Weber', 'Sales Manager', 'Sales', 'Elena Brandt', 'Chicago, US', '2019-04-29', 118000),
  emp('E1009', 'Ravi Patel', 'Software Engineer', 'Engineering', 'Priya Shah', 'Pune, IN', '2022-08-01', 92000),
  emp('E1010', 'Emma Clark', 'Finance Manager', 'Finance', 'Elena Brandt', 'London, UK', '2017-01-16', 126000),
  emp('E1011', 'Noah Kim', 'Support Lead', 'Support', 'Elena Brandt', 'Dublin, IE', '2019-10-07', 88000),
  emp('E1012', 'Olivia Martin', 'Marketing Manager', 'Marketing', 'Elena Brandt', 'Milan, IT', '2018-03-12', 105000),
  emp('E1013', 'Jack Turner', 'Software Engineer', 'Engineering', 'Priya Shah', 'Austin, US', addDays(-12), 90000),
  emp('E1014', 'Grace Miller', 'Sales Executive', 'Sales', 'Hannah Weber', 'Chicago, US', '2021-05-17', 76000, 'Terminated'),
  emp('HR001', 'Tessa Nguyen', 'HR Analyst', 'Human Resources', 'Elena Brandt', 'Austin, US', '2020-02-03', 90000),
];

const byId = (id) => employees.find((e) => e.id === id);

// ---------- Employee-facing data ----------

const policies = [
  { id: 'POL-01', title: 'Annual Leave', category: 'Leave', keywords: 'annual vacation holiday pto leave days carry forward', summary: '24 days per year, accrued monthly. Up to 5 unused days carry forward to 31 March. Requests of 5+ days need 2 weeks notice and manager approval.' },
  { id: 'POL-02', title: 'Sick Leave', category: 'Leave', keywords: 'sick illness medical leave certificate', summary: '10 paid sick days per year. A medical certificate is required for absences longer than 2 consecutive days. Notify your manager before start of shift.' },
  { id: 'POL-03', title: 'Hybrid & Remote Work', category: 'Working Model', keywords: 'remote wfh hybrid work from home office', summary: '3 office days per week, 2 remote. Full-remote work abroad is limited to 20 days per year with manager and HR approval.' },
  { id: 'POL-04', title: 'Parental Leave', category: 'Leave', keywords: 'parental maternity paternity baby adoption', summary: '20 weeks fully paid for the primary caregiver and 8 weeks for the secondary caregiver. Can be taken within 12 months of birth or placement.' },
  { id: 'POL-05', title: 'Expense & Travel', category: 'Finance', keywords: 'expense travel reimbursement claim receipt per diem', summary: 'Submit expenses within 30 days with receipts. Economy flights under 6 hours; business class needs VP approval. Daily meal limit is $60.' },
  { id: 'POL-06', title: 'Notice Period & Resignation', category: 'Employment Terms', keywords: 'notice resign resignation termination probation period', summary: 'Probation is 6 months with 2 weeks notice. After probation notice is 2 months for grades E1-E3 and 3 months for managers.' },
  { id: 'POL-07', title: 'Code of Conduct', category: 'Compliance', keywords: 'conduct ethics harassment whistleblower gift conflict', summary: 'Zero tolerance for harassment and discrimination. Gifts above $100 must be declared. Concerns can be raised anonymously via the Ethics Line.' },
  { id: 'POL-08', title: 'Learning & Development Budget', category: 'Development', keywords: 'learning training course certification budget development', summary: '$1,500 per employee per year for courses and certifications, plus 3 paid learning days. Manager approval required above $500.' },
  { id: 'POL-09', title: 'Overtime & On-call', category: 'Working Model', keywords: 'overtime on-call oncall comp time', summary: 'On-call engineers receive $200 per week allowance plus time-off in lieu for incident work beyond 2 hours outside business hours.' },
  { id: 'POL-10', title: 'Information Security', category: 'Compliance', keywords: 'security password laptop device data privacy mfa', summary: 'Company devices must use disk encryption and MFA. Report lost devices within 2 hours. Personal cloud storage is not permitted for company data.' },
];

const leaveBalances = {
  E1001: { annual: { entitlement: 24, taken: 9, pending: 0 }, sick: { entitlement: 10, taken: 2, pending: 0 }, floating: { entitlement: 2, taken: 1, pending: 0 }, carryForward: 3 },
};
const leaveRequests = [
  { id: 'LV-2041', empId: 'E1001', type: 'Annual', start: '2026-08-10', end: '2026-08-14', days: 5, status: 'Approved' },
  { id: 'LV-2077', empId: 'E1001', type: 'Sick', start: '2026-09-22', end: '2026-09-23', days: 2, status: 'Approved' },
];
const holidays = [
  { date: '2026-11-26', name: 'Thanksgiving' },
  { date: '2026-12-25', name: 'Christmas Day' },
  { date: '2026-12-31', name: 'New Year\'s Eve (half day)' },
  { date: '2027-01-01', name: 'New Year\'s Day' },
  { date: '2027-01-18', name: 'Martin Luther King Jr. Day' },
  { date: '2027-05-31', name: 'Memorial Day' },
];

const bizDays = (start, end) => {
  let n = 0;
  for (let d = new Date(start); d <= new Date(end); d = new Date(d.getTime() + DAY)) {
    const w = d.getUTCDay();
    if (w !== 0 && w !== 6 && !holidays.some((h) => h.date === iso(d))) n++;
  }
  return n;
};

const attendanceFor = () => {
  const rows = []; let i = 0;
  for (let t = Date.now() - DAY; rows.length < 20; t -= DAY) {
    const d = new Date(t); const w = d.getUTCDay();
    if (w === 0 || w === 6) continue;
    i++;
    let status = 'Office', hours = 8.4;
    if (i % 11 === 0) { status = 'Leave'; hours = 0; }
    else if (i % 5 === 0 || i % 5 === 3) { status = 'Remote'; hours = 8.1; }
    else if (i % 9 === 0) { status = 'Late arrival'; hours = 7.6; }
    rows.push({ date: iso(d), status, hours });
  }
  return rows;
};

const payslipsFor = (salary) => [1, 2, 3].map((n) => {
  const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - n);
  const m = salary / 12;
  const basic = round(m * 0.6), housing = round(m * 0.2), special = round(m * 0.2), bonus = n === 2 ? 2500 : 0;
  const gross = basic + housing + special + bonus;
  const tax = round(gross * 0.18), pension = round(basic * 0.05), health = 150;
  return {
    period: iso(d).slice(0, 7),
    earnings: { basic, housingAllowance: housing, specialAllowance: special, performanceBonus: bonus },
    gross, deductions: { incomeTax: tax, pension5pct: pension, healthPremium: health },
    totalDeductions: tax + pension + health, net: gross - tax - pension - health,
  };
});

const onboardingTasks = {
  E1001: [
    { task: 'Sign offer letter & employment contract', status: 'Completed' },
    { task: 'Submit tax & bank details', status: 'Completed' },
    { task: 'Complete I-9 verification', status: 'Completed' },
    { task: 'Information Security training', status: 'Completed' },
    { task: 'Acknowledge updated Code of Conduct (2026)', status: 'Pending', due: addDays(6) },
    { task: 'Annual Data Privacy training', status: 'Pending', due: addDays(14) },
  ],
};
const onboardingGuide = {
  firstWeek: ['Day 1: laptop pickup, badge, accounts', 'Day 2: HR orientation and benefits enrolment', 'Day 3: team introductions and buddy session', 'Day 4-5: mandatory compliance training'],
  keyPolicies: ['Code of Conduct', 'Information Security', 'Hybrid & Remote Work', 'Expense & Travel'],
};

const learningCatalog = [
  { id: 'LRN-301', title: 'Staff Engineer Path: Technical Leadership', hours: 12, skills: ['leadership', 'architecture'] },
  { id: 'LRN-322', title: 'Designing Distributed Systems', hours: 16, skills: ['architecture', 'cloud'] },
  { id: 'LRN-340', title: 'Kubernetes Certified Application Developer prep', hours: 20, skills: ['kubernetes', 'cloud'] },
  { id: 'LRN-355', title: 'Mentoring & Coaching Engineers', hours: 6, skills: ['leadership', 'mentoring'] },
  { id: 'LRN-372', title: 'Intro to Machine Learning Engineering', hours: 14, skills: ['ml', 'python'] },
  { id: 'LRN-390', title: 'Engineering Management Foundations', hours: 18, skills: ['management', 'leadership'] },
];
const employeeCareer = { E1001: { skills: ['java', 'python', 'cloud', 'kubernetes'], goals: ['Staff Engineer', 'Engineering Manager'], lastPromotion: '2024-04-01', rating: 'Exceeds Expectations' } };
const internalJobs = [
  { id: 'IJ-501', title: 'Staff Software Engineer, Platform', dept: 'Engineering', location: 'Austin, US', skills: ['java', 'architecture', 'cloud', 'kubernetes'], closes: addDays(21) },
  { id: 'IJ-502', title: 'Engineering Manager, Payments', dept: 'Engineering', location: 'Remote US', skills: ['leadership', 'java', 'management'], closes: addDays(30) },
  { id: 'IJ-503', title: 'ML Engineer, Personalization', dept: 'Data & AI', location: 'Austin, US', skills: ['python', 'ml'], closes: addDays(14) },
  { id: 'IJ-504', title: 'Product Manager, Developer Experience', dept: 'Product', location: 'Chicago, US', skills: ['product', 'leadership'], closes: addDays(25) },
];

const benefits = {
  E1001: {
    medical: { plan: 'Gold PPO', coverage: 'Employee + Spouse + 1 child', employeePremiumMonthly: 150, deductible: 500, outOfPocketMax: 3500 },
    dental: { plan: 'Delta Dental Plus', annualMax: 2000 },
    vision: { plan: 'VSP Choice', exam: 'Once per 12 months', frames: '$200 allowance' },
    lifeInsurance: 'Company-paid 3x base salary ($336,000)',
    pension: '401(k) with 5% company match (100% vested)',
    allowances: [
      { name: 'Wellness', monthly: 50 },
      { name: 'Home internet', monthly: 60 },
      { name: 'Learning budget', annual: 1500, used: 400 },
    ],
    enrolmentWindow: 'Open enrolment 2026-11-01 to 2026-11-15',
  },
};

const serviceCatalog = [
  { category: 'IT', items: ['New laptop', 'Laptop replacement', 'Software access', 'VPN / MFA reset', 'Monitor & peripherals'] },
  { category: 'Facilities', items: ['Desk booking', 'Parking permit', 'Access badge', 'Ergonomic assessment', 'Meeting room'] },
];
const seedRequests = [
  { id: 'REQ-7120', empId: 'E1001', category: 'IT', item: 'Software access', details: 'IntelliJ Ultimate licence', status: 'Fulfilled', created: addDays(-20) },
];
// Service requests persist across restarts because they are linked to permanent Jira issues.
const REQUESTS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '.cache', 'service-requests.json');
const serviceRequests = (() => { try { return JSON.parse(fs.readFileSync(REQUESTS_FILE, 'utf8')); } catch { return seedRequests; } })();
const saveRequests = () => { try { fs.mkdirSync(path.dirname(REQUESTS_FILE), { recursive: true }); fs.writeFileSync(REQUESTS_FILE, JSON.stringify(serviceRequests, null, 2)); } catch { /* best effort */ } };

const documentsFor = (empId) => [
  { id: 'DOC-1', type: 'Offer Letter', date: byId(empId).hireDate },
  { id: 'DOC-2', type: 'Employment Contract', date: byId(empId).hireDate },
  { id: 'DOC-3', type: 'Promotion Letter', date: '2024-04-01' },
  { id: 'DOC-4', type: 'Tax Form W-4', date: '2026-01-10' },
];
const letterTypes = ['Employment Verification', 'Salary Certificate', 'Experience Letter', 'Address Proof', 'Visa Support Letter'];

// ---------- HR operations data ----------

const requisitions = [
  { id: 'R-101', title: 'Senior Backend Engineer', dept: 'Engineering', openings: 2, openDays: 38, skills: ['java', 'kubernetes', 'cloud', 'sql'], stage: 'Interviewing' },
  { id: 'R-102', title: 'Sales Executive', dept: 'Sales', openings: 1, openDays: 52, skills: ['b2b sales', 'crm', 'negotiation'], stage: 'Screening' },
  { id: 'R-103', title: 'Financial Analyst', dept: 'Finance', openings: 1, openDays: 19, skills: ['excel', 'forecasting', 'sql'], stage: 'Screening' },
  { id: 'R-104', title: 'Support Engineer', dept: 'Support', openings: 2, openDays: 66, skills: ['troubleshooting', 'linux', 'customer service'], stage: 'Offer' },
];
const candidates = [
  { id: 'C-9001', name: 'Mei Tan', reqId: 'R-101', years: 7, skills: ['java', 'kubernetes', 'cloud', 'sql', 'kafka'], stage: 'Applied' },
  { id: 'C-9002', name: 'Omar Haddad', reqId: 'R-101', years: 5, skills: ['java', 'sql', 'spring'], stage: 'Applied' },
  { id: 'C-9003', name: 'Julia Novak', reqId: 'R-101', years: 9, skills: ['java', 'cloud', 'kubernetes', 'terraform'], stage: 'Phone Screen' },
  { id: 'C-9004', name: 'Ben Carter', reqId: 'R-101', years: 2, skills: ['python', 'django'], stage: 'Applied' },
  { id: 'C-9005', name: 'Lena Fischer', reqId: 'R-102', years: 6, skills: ['b2b sales', 'crm', 'negotiation', 'saas'], stage: 'Applied' },
  { id: 'C-9006', name: 'Carlos Mendes', reqId: 'R-102', years: 3, skills: ['crm', 'retail'], stage: 'Applied' },
  { id: 'C-9007', name: 'Yuki Sato', reqId: 'R-103', years: 4, skills: ['excel', 'forecasting', 'sql', 'power bi'], stage: 'Applied' },
  { id: 'C-9008', name: 'Anna Petrova', reqId: 'R-103', years: 1, skills: ['excel'], stage: 'Applied' },
  { id: 'C-9009', name: 'David Okafor', reqId: 'R-104', years: 5, skills: ['troubleshooting', 'linux', 'customer service'], stage: 'Offer' },
];
const interviews = [];

// Payroll run snapshot (the HR system Payroll worker-level results)
const payrollRun = employees.map((e) => {
  const net = round((e.salary / 12) * 0.74);
  return { empId: e.id, name: e.name, status: e.status, prevNet: net, currNet: net, payments: 1, timesheet: true };
});
const pr = (id) => payrollRun.find((p) => p.empId === id);
pr('E1003').currNet = round(pr('E1003').prevNet * 1.42);
pr('E1009').currNet = round(pr('E1009').prevNet * 0.72);
pr('E1008').payments = 2;
pr('E1007').timesheet = false;
pr('E1011').timesheet = false;
pr('E1014').currNet = pr('E1014').prevNet;

const cases = [
  { id: 'CS-3301', empId: 'E1005', subject: 'Payslip missing overtime', body: 'My October payslip does not include 6 hours of overtime I worked during the release weekend.', status: 'New', category: null, priority: null, team: null, received: addDays(-1) },
  { id: 'CS-3302', empId: 'E1006', subject: 'Parental leave planning', body: 'We are expecting a baby in March. How much leave can I take and how do I apply?', status: 'New', category: null, priority: null, team: null, received: addDays(-2) },
  { id: 'CS-3303', empId: 'E1007', subject: 'Manager behaviour concern', body: 'I would like to raise a confidential concern about repeated inappropriate comments in team meetings.', status: 'New', category: null, priority: null, team: null, received: addDays(0) },
  { id: 'CS-3304', empId: 'E1004', subject: 'Employment letter for mortgage', body: 'I need an employment verification letter with salary for my bank by Friday.', status: 'New', category: null, priority: null, team: null, received: addDays(-3) },
  { id: 'CS-3305', empId: 'E1009', subject: 'Net pay lower than expected', body: 'My net pay dropped about 28 percent this month and I do not know why.', status: 'New', category: null, priority: null, team: null, received: addDays(-1) },
  { id: 'CS-3306', empId: 'E1010', subject: 'Request to change work location', body: 'I would like to move from the London office to fully remote from Spain for 3 months.', status: 'New', category: null, priority: null, team: null, received: addDays(-5) },
  { id: 'CS-3307', empId: 'E1012', subject: 'Benefits enrolment question', body: 'Can I add my partner to the medical plan during open enrolment?', status: 'In Progress', category: 'Benefits', priority: 'Low', team: 'Benefits', received: addDays(-6) },
];

const approvals = [
  { id: 'AP-501', type: 'Compensation change', subject: 'Marcus Lee: base salary +42% (E1003)', waiting: '3 days' },
  { id: 'AP-502', type: 'Transfer', subject: 'Ravi Patel to Platform team', waiting: '1 day' },
  { id: 'AP-503', type: 'Leave exception', subject: 'Noah Kim: 14 days unpaid leave', waiting: '2 days' },
];

const trainingByDept = { Engineering: 86, Sales: 71, Finance: 94, Marketing: 78, Support: 62, 'Human Resources': 100 };
const complianceItems = [
  { id: 'CMP-1', item: 'Annual Code of Conduct acknowledgement', owner: 'All employees', outstanding: 9, due: addDays(6), severity: 'High' },
  { id: 'CMP-2', item: 'Data Privacy training', owner: 'All employees', outstanding: 5, due: addDays(14), severity: 'Medium' },
  { id: 'CMP-3', item: 'Work permit expiry: Ravi Patel (IN to US project)', owner: 'E1009', outstanding: 1, due: addDays(23), severity: 'High' },
  { id: 'CMP-4', item: 'I-9 re-verification: Jack Turner (new joiner, missing section 2)', owner: 'E1013', outstanding: 1, due: addDays(2), severity: 'Critical' },
  { id: 'CMP-5', item: 'Statutory pension return filing', owner: 'Payroll', outstanding: 1, due: addDays(28), severity: 'Medium' },
  { id: 'CMP-6', item: 'Year-end tax form distribution (W-2)', owner: 'Payroll', outstanding: 1, due: addDays(75), severity: 'Low' },
];

const reviewStatus = {
  E1001: 'Completed', E1002: 'Completed', E1003: 'Overdue', E1004: 'Completed', E1005: 'In Progress', E1006: 'Overdue',
  E1007: 'Overdue', E1008: 'Completed', E1009: 'In Progress', E1010: 'Completed', E1011: 'Not Started', E1012: 'In Progress', E1013: 'Not Started', HR001: 'Completed',
};

const exits12m = { Engineering: 1, Sales: 2, Finance: 0, Marketing: 1, Support: 2, 'Human Resources': 0 };
const riskFactors = {
  E1007: { engagement: 41, compaRatio: 0.86, monthsSincePromo: 36, note: 'Low engagement score, below market pay' },
  E1011: { engagement: 48, compaRatio: 0.9, monthsSincePromo: 40, note: 'Overdue review, no promotion in 3+ years' },
  E1003: { engagement: 55, compaRatio: 0.95, monthsSincePromo: 30, note: 'Recently moved up in pay, quota pressure' },
  E1005: { engagement: 62, compaRatio: 0.92, monthsSincePromo: 20, note: 'Unpaid overtime dispute open' },
  E1006: { engagement: 58, compaRatio: 0.88, monthsSincePromo: 28, note: 'Overdue review, below market pay' },
};

const submittedDocs = [
  { id: 'HD-1', employee: 'Jack Turner', empId: 'E1013', docType: 'Passport', extracted: { fullName: 'Jack A. Turner', number: 'X1234567', expiry: addDays(-30), signature: true } },
  { id: 'HD-2', employee: 'Jack Turner', empId: 'E1013', docType: 'I-9 Form', extracted: { fullName: 'Jack Turner', section1: true, section2: false, signature: true } },
  { id: 'HD-3', employee: 'Ravi Patel', empId: 'E1009', docType: 'Work Permit', extracted: { fullName: 'Ravindra Patel', number: 'WP-77821', expiry: addDays(23), signature: true } },
  { id: 'HD-4', employee: 'Sofia Rossi', empId: 'E1006', docType: 'Medical Certificate', extracted: { fullName: 'Sofia Rossi', issued: addDays(-3), doctorStamp: false, signature: true } },
  { id: 'HD-5', employee: 'Daniel Cho', empId: 'E1005', docType: 'Bank Details Form', extracted: { fullName: 'Daniel Cho', iban: 'GB29NWBK60161331926819', signature: true } },
];

const wd = {
  employee: byId,
  employees,
  policies, holidays, bizDays,
  leaveBalance(empId) {
    const b = leaveBalances[empId];
    const pending = leaveRequests.filter((r) => r.empId === empId && r.status === 'Pending');
    const calc = (k) => {
      const x = b[k]; const pend = pending.filter((r) => r.type.toLowerCase() === k).reduce((s, r) => s + r.days, 0);
      return { entitlement: x.entitlement, taken: x.taken, pending: pend, remaining: x.entitlement - x.taken - pend };
    };
    return { annual: { ...calc('annual'), carryForwardIncluded: b.carryForward }, sick: calc('sick'), floating: calc('floating'), requests: leaveRequests.filter((r) => r.empId === empId) };
  },
  addLeave(empId, type, start, end, reason) {
    const days = bizDays(start, end);
    const req = { id: 'LV-' + (2100 + leaveRequests.length), empId, type, start, end, days, status: 'Pending', reason };
    leaveRequests.push(req);
    return req;
  },
  attendance: attendanceFor,
  payslips: (empId) => payslipsFor(byId(empId).salary),
  taxInfo(empId) {
    const e = byId(empId);
    return { filingStatus: 'Married filing jointly', withholdingAllowances: 2, ytdGross: round(e.salary * 0.83 + 2500), ytdTaxWithheld: round(e.salary * 0.83 * 0.18), effectiveRate: '18%', pensionContribYtd: round(e.salary * 0.6 * 0.05 * 0.83), w2Available: 'January 2027' };
  },
  onboarding: (empId) => ({ tasks: onboardingTasks[empId] || [], guide: onboardingGuide }),
  learning: (empId) => ({ profile: employeeCareer[empId], catalog: learningCatalog }),
  internalJobs, benefits: (empId) => benefits[empId],
  serviceCatalog,
  serviceRequestsFor: (empId) => serviceRequests.filter((r) => r.empId === empId),
  saveRequests,
  addServiceRequest(empId, category, item, details) {
    const r = { id: 'REQ-' + (7130 + serviceRequests.length), empId, category, item, details, status: 'Submitted', created: iso(new Date()) };
    serviceRequests.push(r);
    saveRequests();
    return r;
  },
  documents: documentsFor, letterTypes,
  addLetter(empId, type) {
    const e = byId(empId);
    return { id: 'GEN-' + Math.floor(Math.random() * 9000 + 1000), type, employee: e.name, status: 'Generated', note: 'Digitally signed PDF added to My Documents in the HR system.' };
  },

  // HR ops
  requisitions, candidates, interviews,
  scheduleInterview(candidateId, dateTime) {
    const c = candidates.find((x) => x.id === candidateId);
    if (!c) return { error: 'Candidate not found' };
    c.stage = 'Interview Scheduled';
    const i = { id: 'INT-' + (400 + interviews.length), candidateId, candidate: c.name, requisition: c.reqId, dateTime };
    interviews.push(i);
    return i;
  },
  payrollRun, cases, approvals,
  updateCase(id, patch) {
    const c = cases.find((x) => x.id === id);
    if (!c) return { error: 'Case not found' };
    Object.assign(c, patch, { status: 'In Progress' });
    return c;
  },
  trainingByDept, complianceItems, reviewStatus, exits12m, riskFactors, submittedDocs,
  today: () => iso(new Date()),
};

export default wd;
