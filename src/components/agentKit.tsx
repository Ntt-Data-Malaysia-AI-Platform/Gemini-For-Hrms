// Per-agent stat cards and "AI tools" for the agent overview. Every agent gets four stats computed
// from the live dashboard data and four one-click tools that turn a few inputs into a chat request.
import { useState, type FormEvent } from 'react';
import {
  AlarmClock, AlertTriangle, BadgeCheck, BarChart3, Briefcase, Building2, CalendarCheck, CalendarDays, CalendarPlus, Car, CheckCircle2,
  ClipboardCheck, ClipboardList, Clock, Coins, FileSearch, FileSignature, FileText, Flag, Gift, Globe2, GraduationCap, HeartPulse,
  Inbox, KeyRound, Laptop, LineChart, ListChecks, Mail, MapPin, Megaphone, PieChart, Plane, Receipt, Scale, Search, ShieldCheck,
  Sparkles, Target, TrendingDown, TrendingUp, UserCheck, UserMinus, UserPlus, Users, Wallet, Workflow, X, type LucideIcon,
} from 'lucide-react';
import type { EmployeeDash, HrDash } from '../lib/api';
import { SERIES } from './charts';

export interface Stat { label: string; value: string | number; sub: string; icon: LucideIcon; color: string; prompt: string }
interface Field { label: string; placeholder: string; type?: 'text' | 'date' }
export interface Tool { title: string; desc: string; icon: LucideIcon; prompt: string; fields?: Field[] }

const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
const day = (d?: string) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—');
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
const C = [SERIES[0], SERIES[2], SERIES[3], SERIES[1]];
const s = (i: number, label: string, value: string | number, sub: string, icon: LucideIcon, prompt: string): Stat => ({ label, value, sub, icon, color: C[i], prompt });

function employeeStats(id: string, d: EmployeeDash): Stat[] {
  const leave = (k: string) => d.leave.find((l) => l.name.toLowerCase().includes(k));
  const annual = leave('annual');
  const latest = d.pay[d.pay.length - 1];
  const openTasks = d.onboarding.total - d.onboarding.done;
  const open = d.requests.filter((r) => !/fulfil|closed|done|resolved/i.test(r.jira?.status ?? r.status));
  const office = d.attendance.filter((a) => /office/i.test(a.status)).length;
  const next = d.holidays[0];
  const best = Math.max(0, ...d.jobs.map((j) => j.matchPct));
  const monthly = sum(d.allowances.map((a) => a.monthly ?? 0));
  const annualAllow = d.allowances.filter((a) => a.annual);
  switch (id) {
    case 'leave-attendance': return [
      s(0, 'Annual leave left', annual?.remaining ?? '—', `${annual?.taken ?? 0} taken · ${annual?.pending ?? 0} pending`, CalendarDays, 'What is my leave balance?'),
      s(1, 'Sick leave left', leave('sick')?.remaining ?? '—', 'this year', HeartPulse, 'How much sick leave do I have left?'),
      s(2, 'Office days', `${office}/${d.attendance.length}`, 'last 20 working days', Building2, 'Show my attendance for the last month'),
      s(3, 'Next holiday', day(next?.date), next?.name ?? 'none scheduled', Flag, 'What are the upcoming holidays?'),
    ];
    case 'payroll-assistant': return [
      s(0, 'Latest net pay', latest ? money(latest.net) : '—', latest?.period ?? '', Wallet, 'Explain my latest payslip'),
      s(1, 'Gross pay', latest ? money(latest.gross) : '—', 'before deductions', Coins, 'Break down my gross pay'),
      s(2, 'Deductions', latest ? money(latest.deductions) : '—', 'tax, pension and benefits', Receipt, 'Explain my deductions this month'),
      s(3, 'Bonus paid', money(sum(d.pay.map((p) => p.bonus))), `last ${d.pay.length} months`, Gift, 'Tell me about my recent bonus payments'),
    ];
    case 'onboarding': return [
      s(0, 'Tasks complete', `${Math.round((d.onboarding.done / Math.max(1, d.onboarding.total)) * 100)}%`, `${d.onboarding.done} of ${d.onboarding.total}`, ListChecks, 'Show my onboarding progress'),
      s(1, 'Tasks pending', openTasks, 'still to finish', ClipboardList, 'What onboarding tasks are still pending?'),
      s(2, 'Next due', day(d.onboarding.pending[0]?.due), d.onboarding.pending[0]?.task ?? 'nothing due', AlarmClock, 'What is my next onboarding deadline?'),
      s(3, 'Manager', d.profile.manager.split(' ')[0], d.profile.dept, UserCheck, 'Who is my manager and how do I reach them?'),
    ];
    case 'career': return [
      s(0, 'Matching roles', d.jobs.length, 'open internal jobs', Briefcase, 'Which internal roles match my profile?'),
      s(1, 'Best match', `${best}%`, d.jobs.find((j) => j.matchPct === best)?.title ?? '—', Target, 'Tell me about my best matching role'),
      s(2, 'Courses suggested', d.learning.length, 'for your next step', GraduationCap, 'Suggest a learning plan for my career'),
      s(3, 'Learning hours', sum(d.learning.map((l) => l.hours)), 'in suggested courses', Clock, 'How long will the suggested courses take?'),
    ];
    case 'benefits': return [
      s(0, 'Allowances', d.allowances.length, 'active benefits', Gift, 'Explain my benefits'),
      s(1, 'Monthly allowances', money(monthly), 'paid with salary', Coins, 'What monthly allowances do I get?'),
      s(2, 'Annual budget used', `${money(sum(annualAllow.map((a) => a.used ?? 0)))}`, `of ${money(sum(annualAllow.map((a) => a.annual ?? 0)))}`, PieChart, 'How much of my annual benefit budget have I used?'),
      s(3, 'Floating leave left', leave('floating')?.remaining ?? '—', 'days this year', CalendarCheck, 'How many floating days do I have left?'),
    ];
    case 'it-facilities': return [
      s(0, 'Requests', d.requests.length, 'IT and facilities', Inbox, 'What is the Jira status of my requests?'),
      s(1, 'Open', open.length, 'in progress', Clock, 'Which of my requests are still open?'),
      s(2, 'Completed', d.requests.length - open.length, 'fulfilled', CheckCircle2, 'Which of my requests are complete?'),
      s(3, 'Tracked in Jira', d.requests.filter((r) => r.jira?.key).length, 'with live status', Workflow, 'What is the Jira status of my requests?'),
    ];
    case 'documents': return [
      s(0, 'Letter types', 5, 'ready to generate', FileText, 'What letters can you generate for me?'),
      s(1, 'Years of service', d.profile.tenureYears, `since ${day(d.profile.hireDate)}`, BadgeCheck, 'Generate an Experience Letter'),
      s(2, 'Department', d.profile.dept, d.profile.title, Building2, 'Generate an Employment Verification letter'),
      s(3, 'Location', d.profile.location, 'used on letters', MapPin, 'Generate an Address Proof letter'),
    ];
    default: return [
      s(0, 'Annual leave left', annual?.remaining ?? '—', 'days', CalendarDays, 'What is my leave balance?'),
      s(1, 'Open tasks', openTasks, 'onboarding and compliance', ClipboardList, 'What tasks do I have open?'),
      s(2, 'Open requests', open.length, 'IT and facilities', Inbox, 'What is the status of my requests?'),
      s(3, 'Years of service', d.profile.tenureYears, d.profile.title, BadgeCheck, 'Summarise my employee profile'),
    ];
  }
}

function hrStats(id: string, d: HrDash): Stat[] {
  const k = (i: number, label: string, icon: LucideIcon): Stat => {
    const x = d.kpis.find((q) => q.label === label);
    return { label, value: x ? `${x.value}${x.unit ?? ''}` : '—', sub: x?.sub ?? 'SAP is busy; refreshing', icon, color: C[i], prompt: x?.prompt ?? `Tell me about ${label.toLowerCase()}` };
  };
  const docs = d.compliance?.documents ?? [];
  const atRisk = docs.filter((x) => x.state !== 'Valid').length;
  const top = d.payroll?.top ?? [];
  const risk = d.risk;
  const worst = risk?.divisions.slice().sort((a, b) => b.highRiskPct - a.highRiskPct)[0];
  const training = d.trainingByDept.length ? Math.round(sum(d.trainingByDept.map((t) => t.pct)) / d.trainingByDept.length) : 0;
  const urgentCases = d.cases.filter((c) => c.priority === 'Critical' || c.priority === 'High').length;
  switch (id) {
    case 'recruitment': return [
      k(0, 'Open requisitions', Briefcase), k(1, 'New hires', UserPlus), k(2, 'Vacant positions', Users),
      s(3, 'Applications', sum((d.applications ?? []).map((a) => a.count)), 'across all requisitions', Inbox, 'Summarise the recruitment pipeline'),
    ];
    case 'payroll-ops': return [
      s(0, 'Findings', sum((d.payroll?.findings ?? []).map((f) => f.count)), 'from the latest review', FileSearch, 'Run the payroll review'),
      s(1, 'High severity', top.filter((t) => /high|critical/i.test(t.severity)).length, 'need a decision', AlertTriangle, 'Which payroll findings are high severity?'),
      s(2, 'Employees affected', new Set(top.map((t) => t.userId)).size, 'in top findings', Users, 'Which employees are affected by payroll findings?'),
      s(3, 'Pay components', new Set(top.map((t) => t.payComponent)).size, 'flagged', Coins, 'Which pay components were flagged?'),
    ];
    case 'case-mgmt': return [
      s(0, 'Open cases', d.cases.length, 'in the queue', Inbox, 'Triage the new cases'),
      s(1, 'Critical / high', urgentCases, 'answer first', AlertTriangle, 'Show critical and high priority cases'),
      s(2, 'Untriaged', d.cases.filter((c) => !c.category).length, 'no category yet', ClipboardList, 'Triage the new cases'),
      k(3, 'Pending workflows', Workflow),
    ];
    case 'workforce': return [k(0, 'Active employees', Users), k(1, 'New hires', UserPlus), k(2, 'Vacant positions', Briefcase), k(3, 'Open requisitions', ClipboardList)];
    case 'compliance': return [
      s(0, 'Documents tracked', d.compliance?.tracked ?? '—', 'work permits and IDs', ShieldCheck, 'Show compliance status'),
      s(1, 'Expiring or expired', atRisk, 'need renewal', AlertTriangle, 'Which documents are expiring or expired?'),
      s(2, 'Missing expiry', d.compliance?.missingExpiry ?? '—', 'dates to fix', Flag, 'Which documents are missing an expiry date?'),
      s(3, 'Training complete', `${training}%`, 'average across departments', GraduationCap, 'Show training completion by department'),
    ];
    case 'performance': return [
      s(0, 'Review forms', d.reviews?.total ?? '—', 'this cycle', ClipboardCheck, 'Show performance review status'),
      s(1, 'Completion', `${d.reviews?.completionPct ?? 0}%`, 'of reviews done', CheckCircle2, 'What is the review completion rate?'),
      k(2, 'Reviews overdue', AlarmClock),
      s(3, 'Longest overdue', `${Math.max(0, ...(d.reviews?.overdue ?? []).map((o) => o.daysOverdue))}d`, 'oldest open review', Clock, 'Which reviews are the most overdue?'),
    ];
    case 'attrition': return [
      s(0, 'High-risk employees', sum((risk?.divisions ?? []).map((x) => x.high)), 'flight risk rated high', TrendingDown, 'Who is at high risk of leaving?'),
      s(1, 'Regrettable', risk?.regrettable ?? '—', 'high performers at risk', UserMinus, 'List regrettable attrition risks'),
      s(2, 'Hotspot division', worst ? `${worst.highRiskPct}%` : '—', worst?.division ?? '—', Flag, 'Which divisions have the highest attrition risk?'),
      k(3, 'Active employees', Users),
    ];
    case 'doc-processing': return [
      s(0, 'Documents tracked', d.compliance?.tracked ?? '—', 'in SAP', FileText, 'Show compliance status'),
      s(1, 'Need attention', atRisk, 'expiring or expired', AlertTriangle, 'Which documents are expiring or expired?'),
      s(2, 'Missing expiry', d.compliance?.missingExpiry ?? '—', 'to extract from files', FileSearch, 'Which documents are missing an expiry date?'),
      s(3, 'Alerts', d.compliance?.alerts ?? '—', 'compliance alerts', Megaphone, 'Show compliance alerts'),
    ];
    case 'exec-reporting': return [k(0, 'Active employees', Users), k(1, 'New hires', UserPlus), k(2, 'Vacant positions', Briefcase), k(3, 'Approvals waiting', Inbox)];
    default: return [
      k(0, 'Approvals waiting', Inbox), k(1, 'Pending workflows', Workflow), k(2, 'Reviews overdue', AlarmClock),
      s(3, 'Open cases', d.cases.length, `${urgentCases} critical or high`, ClipboardList, 'What needs my attention today?'),
    ];
  }
}

export const agentStats = (id: string, d: EmployeeDash | HrDash) => (d.role === 'hr' ? hrStats(id, d) : employeeStats(id, d));

const f = (label: string, placeholder: string, type?: Field['type']): Field => ({ label, placeholder, type });
const t = (title: string, desc: string, icon: LucideIcon, prompt: string, fields?: Field[]): Tool => ({ title, desc, icon, prompt, fields });

// {0}, {1}… in a prompt are filled from the tool's fields in order.
export const AGENT_TOOLS: Record<string, Tool[]> = {
  'hr-assistant': [
    t('Policy lookup', 'What a policy says, in plain words.', Search, 'What does the policy say about {0}?', [f('Topic', 'e.g. remote work')]),
    t('My profile', 'Role, manager, location and tenure.', UserCheck, 'Summarise my employee profile'),
    t('Leave and pay snapshot', 'Balances and latest payslip together.', Wallet, 'Give me a snapshot of my leave balance and latest pay'),
    t('Ask HR anything', 'Type a question; get a full answer.', Sparkles, '{0}', [f('Question', 'e.g. How do I update my bank details?')]),
  ],
  'leave-attendance': [
    t('Apply for leave', 'Pick a type and dates; it is submitted.', CalendarPlus, 'Apply {0} leave from {1} to {2}', [f('Type', 'Annual, Sick or Floating'), f('From', '', 'date'), f('To', '', 'date')]),
    t('Leave balance', 'Every leave type, taken and left.', CalendarDays, 'What is my leave balance?'),
    t('Attendance check', 'Office, remote and late days.', Clock, 'Show my attendance for the last month'),
    t('Plan around holidays', 'Stretch your days off further.', Plane, 'Plan time off around the holidays'),
  ],
  'payroll-assistant': [
    t('Explain my payslip', 'Every line in plain words.', Receipt, 'Explain my latest payslip'),
    t('Compare two months', 'What changed and why.', BarChart3, 'Compare my {0} payslip with {1}', [f('First month', 'e.g. September'), f('Second month', 'e.g. October')]),
    t('Tax summary', 'Year-to-date tax withheld.', Scale, 'Check year-to-date tax withholding details'),
    t('Bonus details', 'When and how much.', Gift, 'Tell me about my recent bonus payments'),
  ],
  onboarding: [
    t('What is next', 'Pending tasks, soonest first.', ListChecks, 'What onboarding tasks are still pending?'),
    t('Help with a task', 'Step-by-step help for one task.', ClipboardCheck, 'How do I complete the onboarding task "{0}"?', [f('Task', 'e.g. Annual Data Privacy training')]),
    t('First-week guide', 'Who to meet and what to set up.', Users, 'Give me a first-week guide for my role'),
    t('Meet my manager', 'Contact details and team.', UserCheck, 'Who is my manager and how do I reach them?'),
  ],
  career: [
    t('Find internal roles', 'Open jobs that fit your interests.', Briefcase, 'Find internal roles related to {0}', [f('Interest', 'e.g. cloud architecture')]),
    t('Skill gap', 'What to learn for a target role.', Target, 'What skills do I need for the {0} role?', [f('Role', 'e.g. Staff Engineer')]),
    t('Learning plan', 'Courses in a sensible order.', GraduationCap, 'Suggest a learning plan for my career'),
    t('Promotion path', 'Your next step and timeline.', TrendingUp, 'What is my path to the next level?'),
  ],
  benefits: [
    t('Explain my benefits', 'Everything you are enrolled in.', Gift, 'Explain my benefits'),
    t('Allowance balance', 'Used and remaining this year.', PieChart, 'How much of my annual benefit budget have I used?'),
    t('Benefit question', 'Eligibility, claims or enrolment.', HeartPulse, '{0}', [f('Question', 'e.g. Is dental covered for my family?')]),
    t('Claim help', 'How to claim, step by step.', FileSignature, 'How do I submit a claim for {0}?', [f('Claim for', 'e.g. gym membership')]),
  ],
  'it-facilities': [
    t('Request equipment', 'Raised and tracked in Jira.', Laptop, 'I need {0}', [f('Item', 'e.g. a new laptop')]),
    t('Parking permit', 'Raise a permit request.', Car, 'Request a parking permit'),
    t('Software access', 'Request a licence or access.', KeyRound, 'Request software access to {0}', [f('Application', 'e.g. Figma')]),
    t('Track my requests', 'Live Jira status.', Workflow, 'What is the Jira status of my requests?'),
  ],
  documents: [
    t('Employment letter', 'Verification of employment.', FileText, 'Generate an Employment Verification letter'),
    t('Salary certificate', 'For banks and landlords.', Coins, 'Generate a Salary Certificate'),
    t('Visa support letter', 'For travel abroad.', Globe2, 'Generate a Visa Support Letter for travel to {0}', [f('Destination', 'e.g. Japan')]),
    t('Experience letter', 'Role history and tenure.', BadgeCheck, 'Generate an Experience Letter'),
  ],
  'ops-copilot': [
    t('Today\'s priorities', 'What needs you first.', Flag, 'What needs my attention today?'),
    t('Approvals queue', 'Everything waiting on HR.', Inbox, 'Show the approvals queue'),
    t('Division briefing', 'One division, all signals.', Building2, 'Give me an operations briefing for the {0} division', [f('Division', 'e.g. Manufacturing')]),
    t('Overdue reviews', 'Who to chase this week.', AlarmClock, 'Which performance reviews are overdue?'),
  ],
  recruitment: [
    t('Screen applicants', 'Rank candidates for a requisition.', UserCheck, 'Screen applicants for requisition {0}', [f('Requisition ID', 'e.g. 1204')]),
    t('Pipeline summary', 'Stages, volumes and bottlenecks.', BarChart3, 'Summarise the recruitment pipeline'),
    t('Schedule interview', 'Book a slot with a candidate.', CalendarPlus, 'Schedule an interview with {0} on {1}', [f('Candidate', 'Full name'), f('Date', '', 'date')]),
    t('Hard-to-fill roles', 'Requisitions open the longest.', Briefcase, 'Which requisitions are hardest to fill?'),
  ],
  'payroll-ops': [
    t('Run payroll review', 'Find anomalies before pay day.', FileSearch, 'Run the payroll review'),
    t('Explain a finding', 'One employee, full detail.', Search, 'Explain the payroll finding for employee {0}', [f('Employee ID', 'e.g. 103217')]),
    t('Large changes', 'Big month-on-month swings.', TrendingUp, 'Show large pay changes this month'),
    t('Payroll memo', 'Summary for finance sign-off.', Mail, 'Draft a payroll review memo for finance'),
  ],
  'case-mgmt': [
    t('Triage new cases', 'Category, priority and owner.', ClipboardList, 'Triage the new cases'),
    t('Case detail', 'History and next action.', Search, 'Show the details of case {0}', [f('Case ID', 'e.g. CASE-1042')]),
    t('Draft a reply', 'Empathetic, policy-correct.', Mail, 'Draft a reply for case {0}', [f('Case ID', 'e.g. CASE-1042')]),
    t('Critical cases', 'Highest priority first.', AlertTriangle, 'Show critical and high priority cases'),
  ],
  workforce: [
    t('Division headcount', 'Headcount and vacancies.', Users, 'Show headcount and vacancies for the {0} division', [f('Division', 'e.g. Manufacturing')]),
    t('Hiring trend', 'New hires over time.', LineChart, 'Show the hiring trend'),
    t('Vacancy hotspots', 'Where seats are empty.', Flag, 'Which divisions have the highest vacancy rates?'),
    t('Country mix', 'Where people work.', Globe2, 'Show the workforce by country'),
  ],
  compliance: [
    t('Expiring documents', 'Permits due for renewal.', AlertTriangle, 'Which documents are expiring or expired?'),
    t('Missing data', 'Records without expiry dates.', Flag, 'Which documents are missing an expiry date?'),
    t('Training completion', 'By department.', GraduationCap, 'Show training completion by department'),
    t('Employee check', 'One person\'s compliance status.', ShieldCheck, 'Check the compliance status for {0}', [f('Employee', 'Name or ID')]),
  ],
  performance: [
    t('Overdue reviews', 'Who is late, and by how long.', AlarmClock, 'Which reviews are the most overdue?'),
    t('Completion by division', 'Where the cycle is behind.', BarChart3, 'Show review completion by division'),
    t('Manager nudge', 'A reminder email draft.', Megaphone, 'Draft a reminder to managers with overdue reviews'),
    t('Employee review', 'One person\'s review status.', Search, 'Show the review status for {0}', [f('Employee', 'Name or ID')]),
  ],
  attrition: [
    t('Risk hotspots', 'Divisions with most flight risk.', TrendingDown, 'Which divisions have the highest attrition risk?'),
    t('Regrettable risks', 'High performers at risk.', UserMinus, 'List regrettable attrition risks'),
    t('Retention plan', 'Actions for one division.', ShieldCheck, 'Suggest retention actions for the {0} division', [f('Division', 'e.g. Manufacturing')]),
    t('Key talent', 'Who to protect first.', Target, 'Show our key talent list'),
  ],
  'doc-processing': [
    t('Find a document', 'Search HR files in OneDrive.', Search, 'Search OneDrive for {0}', [f('Keyword', 'e.g. work permit')]),
    t('Extract details', 'Names, dates and terms from a file.', FileSearch, 'Extract the key details from {0}', [f('File name', 'e.g. Offer letter - J Smith.pdf')]),
    t('Latest HR files', 'Newest documents first.', FileText, 'List the latest HR documents in OneDrive'),
    t('Expiring permits', 'Match files to SAP records.', AlertTriangle, 'Which documents are expiring or expired?'),
  ],
  'exec-reporting': [
    t('Executive snapshot', 'Headline numbers and trends.', BarChart3, 'Give me the executive workforce snapshot'),
    t('Board summary', 'A one-page narrative.', FileText, 'Write a board summary for {0}', [f('Period', 'e.g. Q3 2026')]),
    t('Top risks', 'What leadership should know.', AlertTriangle, 'What are the top workforce risks right now?'),
    t('Talking points', 'Five bullets for a meeting.', Megaphone, 'Give me five workforce talking points for the leadership meeting'),
  ],
};

export function StatCard({ x, onAsk }: { x: Stat; onAsk: () => void }) {
  const Icon = x.icon;
  return (
    <button onClick={onAsk} className="group relative flex min-w-0 gap-3 overflow-hidden rounded-2xl border border-white/[0.07] bg-slate-900/70 p-4 pb-5 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-blue-500/40">
      <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl" style={{ background: `${x.color}26` }}><Icon className="h-5 w-5" style={{ color: x.color }} /></span>
      <span className="min-w-0">
        <span className="block text-xs font-semibold text-slate-300">{x.label}</span>
        <span className="mt-1 block truncate text-2xl font-black tracking-tight text-white">{x.value}</span>
        <span className="block truncate text-[11px] text-slate-500">{x.sub}</span>
      </span>
      <span className="absolute inset-x-0 bottom-0 h-1" style={{ background: x.color }} />
    </button>
  );
}

export function ToolCard({ tool, onRun }: { tool: Tool; onRun: (prompt: string) => void }) {
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<string[]>(() => (tool.fields ?? []).map(() => ''));
  const Icon = tool.icon;
  const fill = (v: string[]) => tool.prompt.replace(/\{(\d)\}/g, (_, i) => v[Number(i)].trim());
  const submit = (e: FormEvent) => { e.preventDefault(); onRun(fill(values)); setOpen(false); setValues(values.map(() => '')); };
  const head = (
    <>
      <span className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-600/25"><Icon className="h-5 w-5 text-white" /></span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-bold text-white">{tool.title}</span>
        <span className="block text-xs text-slate-400">{tool.desc}</span>
      </span>
    </>
  );
  if (!open) {
    return (
      <button onClick={() => (tool.fields?.length ? setOpen(true) : onRun(tool.prompt))}
        className="group flex items-center gap-3 rounded-2xl border border-white/[0.07] bg-slate-900/70 p-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-blue-500/50">
        {head}<Sparkles className="h-4 w-4 flex-shrink-0 text-blue-300/60 transition group-hover:text-cyan-300" />
      </button>
    );
  }
  return (
    <form onSubmit={submit} className="agent-glow rounded-2xl border border-blue-500/50 bg-slate-900 p-4">
      <div className="flex items-center gap-3">{head}<button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close"><X className="h-4 w-4" /></button></div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {tool.fields!.map((fl, i) => (
          <label key={fl.label} className={`text-[11px] font-medium text-slate-400 ${tool.fields!.length === 1 ? 'sm:col-span-2' : ''}`}>{fl.label}
            <input required type={fl.type ?? 'text'} value={values[i]} placeholder={fl.placeholder} autoFocus={i === 0}
              onChange={(e) => setValues(values.map((v, j) => (j === i ? e.target.value : v)))}
              className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
          </label>
        ))}
      </div>
      <button type="submit" className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:brightness-110"><Sparkles className="h-4 w-4" />Run with agent</button>
    </form>
  );
}
