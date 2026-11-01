import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  AlertOctagon, AlertTriangle, ArrowUpRight, Briefcase, CalendarHeart, CheckCircle2, Circle, ClipboardList, GraduationCap,
  CalendarRange, Cloud, FileBarChart, Filter, Info, Loader, MessageSquare, Sparkles, Ticket, X,
} from 'lucide-react';
import type { EmployeeDash, HrDash, HrFilters, Kpi, Severity, User } from '../lib/api';
import { useT } from '../lib/i18n';
import { AgentIcon, JiraBadge, SapBadge } from './AgentIcon';
import { AGENT_TOOLS, StatCard, ToolCard, agentStats } from './agentKit';
import { AttendanceStrip, Columns, Donut, HBars, Progress, SERIES, STATUS, StackedColumns } from './charts';

type Ask = (agentId: string, prompt: string) => void;

const greeting = () => { const h = new Date().getHours(); return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'; };
const today = () => new Date().toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const shortDate = (d: string) => new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
const money = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;

// ---------- Building blocks ----------
export const SEVERITY: Record<Severity, { color: string; label: string; icon: typeof Info }> = {
  critical: { color: STATUS.critical, label: 'Critical', icon: AlertOctagon },
  serious: { color: STATUS.serious, label: 'High', icon: AlertTriangle },
  warning: { color: STATUS.warning, label: 'Attention', icon: AlertTriangle },
  info: { color: '#7dd3fc', label: 'Update', icon: Info },
  good: { color: STATUS.good, label: 'Good', icon: CheckCircle2 },
};

export const SeverityChip = ({ level }: { level: Severity }) => {
  const s = SEVERITY[level];
  const Icon = s.icon;
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-200">
      <Icon className="h-3 w-3" style={{ color: s.color }} />{s.label}
    </span>
  );
};

// Jira status with an icon + label (status colour never carries meaning alone).
function JiraStatus({ r }: { r: EmployeeDash['requests'][number] }) {
  const base = 'inline-flex flex-shrink-0 items-center gap-1 rounded-full border border-white/10 bg-white/[0.04] px-2 py-0.5 text-[10px] font-semibold text-slate-200';
  if (r.jira?.pending) return <span className={base} title={r.jira.error}><AlertTriangle className="h-3 w-3" style={{ color: STATUS.warning }} />Jira sync pending</span>;
  if (!r.jira?.key) return <span className="flex-shrink-0 text-[11px] text-slate-400">{r.status}</span>;
  const cat = r.jira.category;
  const Icon = cat === 'done' ? CheckCircle2 : cat === 'indeterminate' ? Loader : Circle;
  const color = cat === 'done' ? STATUS.good : cat === 'indeterminate' ? STATUS.warning : '#7dd3fc';
  return <span className={base}><Icon className="h-3 w-3" style={{ color }} />{r.jira.status}</span>;
}

function Widget({ title, sub, sap, jira, action, className = '', children }: { title: string; sub?: string; sap?: boolean; jira?: boolean; action?: () => void; className?: string; children: ReactNode }) {
  const t = useT();
  return (
    <section className={`flex flex-col rounded-2xl border border-white/[0.07] bg-slate-900/70 p-4 shadow-lg shadow-black/20 backdrop-blur ${className}`}>
      <header className="mb-3 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-white">{title}</h3>{sap && <SapBadge />}{jira && <JiraBadge />}</div>
          {sub && <p className="text-xs text-slate-500">{sub}</p>}
        </div>
        {action && (
          <button onClick={action} className="flex flex-shrink-0 items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-blue-300 transition hover:bg-blue-500/10 hover:text-blue-200">
            <Sparkles className="h-3 w-3" /> {t('Ask agent')}
          </button>
        )}
      </header>
      <div className="flex-1">{children}</div>
    </section>
  );
}

const Unavailable = () => { const t = useT(); return <p className="py-6 text-center text-xs text-slate-500">{t('SAP SuccessFactors is busy right now. This widget will fill in on the next refresh.')}</p>; };

function KpiTile({ k, onAsk, tint }: { k: Kpi; onAsk: Ask; tint: string }) {
  // Briefly highlight the tile when its value changes (after a filter, refresh or agent action).
  const prev = useRef(k.value);
  const [changed, setChanged] = useState(false);
  useEffect(() => {
    if (prev.current === k.value) return;
    prev.current = k.value;
    setChanged(true);
    const id = window.setTimeout(() => setChanged(false), 1600);
    return () => window.clearTimeout(id);
  }, [k.value]);
  return (
    <button onClick={() => onAsk(k.agent, k.prompt)}
      className={`group relative overflow-hidden rounded-2xl border bg-slate-900/70 p-4 text-left shadow-lg shadow-black/20 transition hover:-translate-y-0.5 hover:border-blue-500/40 ${changed ? 'kpi-changed border-cyan-400/70' : 'border-white/[0.07]'}`}>
      <div className="pointer-events-none absolute -right-6 -top-6 h-20 w-20 rounded-full opacity-20 blur-2xl" style={{ background: tint }} />
      <div className="flex items-center justify-between text-xs text-slate-400">{k.label}<ArrowUpRight className="h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" /></div>
      <div className="mt-1.5 flex items-baseline gap-1"><span className="text-2xl font-black tracking-tight text-white">{k.value}</span>{k.unit && <span className="text-xs text-slate-500">{k.unit}</span>}</div>
      <div className="mt-0.5 truncate text-[11px] text-slate-500">{k.sub}</div>
      {k.sap && <div className="mt-2"><SapBadge label="SAP" /></div>}
    </button>
  );
}

function Hero({ name, line, chips, children }: { name: string; line: string; chips: { label: string; onClick: () => void }[]; children?: ReactNode }) {
  const t = useT();
  return (
    <section className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-br from-blue-600/25 via-slate-900 to-emerald-600/15 p-5 sm:p-6">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-cyan-400/10 blur-3xl" />
      <div className="relative flex flex-wrap items-end justify-between gap-4">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-widest text-cyan-300/80">{today()}</p>
          <h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-3xl">{t(greeting())}, {name.split(' ')[0]}</h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-300">{line}</p>
        </div>
        {children}
      </div>
      <div className="relative mt-4 flex flex-wrap gap-2">
        {chips.map((c) => (
          <button key={c.label} onClick={c.onClick} className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-xs text-slate-200 transition hover:border-cyan-400/50 hover:bg-white/10">
            <Sparkles className="h-3 w-3 text-cyan-300" />{c.label}
          </button>
        ))}
      </div>
    </section>
  );
}

const ListRow = ({ left, right, onClick }: { left: ReactNode; right?: ReactNode; onClick?: () => void }) => (
  <button onClick={onClick} disabled={!onClick} className="flex w-full items-center justify-between gap-3 rounded-lg px-2 py-2 text-left text-xs transition enabled:hover:bg-white/[0.04]">
    <span className="min-w-0 flex-1">{left}</span>{right && <span className="flex-shrink-0 text-slate-400">{right}</span>}
  </button>
);

const TINTS = [SERIES[0], SERIES[2], SERIES[3], SERIES[4], SERIES[1], '#22d3ee'];

// ---------- Employee (Tyson): widgets ----------
// Widgets are built once per render and shared by the Home dashboard and each agent's Overview tab.
function useEmployeeWidgets(d: EmployeeDash, onAsk: Ask): Record<string, ReactNode> {
  const t = useT();
  const annual = d.leave[0];
  const latest = d.pay[d.pay.length - 1];
  const learningBudget = d.allowances.find((a) => a.annual);
  const p = d.profile;
  return {
    profile: (
      <Widget title="My profile" sub="From your HR record" action={() => onAsk('hr-assistant', 'What is the notice period for my role?')}>
        <dl className="grid grid-cols-2 gap-2 text-xs">
          {[['Title', p.title], ['Department', p.dept], ['Manager', p.manager], ['Location', p.location], ['Joined', shortDate(p.hireDate)], ['Tenure', `${p.tenureYears} years`]].map(([k, v]) => (
            <div key={k} className="rounded-lg bg-white/[0.04] px-3 py-2"><dt className="text-[10px] uppercase tracking-wider text-slate-500">{k}</dt><dd className="truncate text-slate-200">{v}</dd></div>
          ))}
        </dl>
      </Widget>
    ),
    leave: (
      <Widget title={t('Leave balance')} sub={t('Annual leave, this year')} action={() => onAsk('leave-attendance', 'What is my leave balance?')}>
        <Donut center={annual.remaining} sub={t('days left')} data={[
          { name: t('Remaining'), value: annual.remaining, color: SERIES[0] },
          { name: t('Taken'), value: annual.taken, color: SERIES[1] },
          { name: t('Pending approval'), value: annual.pending, color: SERIES[3] },
        ]} />
        <div className="mt-4 space-y-2.5">
          {d.leave.slice(1).map((l) => <Progress key={l.name} label={`${l.name} leave left`} value={l.remaining} max={l.taken + l.remaining + l.pending} color={SERIES[0]} right={`${l.remaining} of ${l.taken + l.remaining + l.pending} days`} />)}
        </div>
      </Widget>
    ),
    attendance: (
      <Widget title={t('Attendance')} sub={t('Last 20 working days')} action={() => onAsk('leave-attendance', 'Show my attendance for the last month')}>
        <AttendanceStrip days={d.attendance} />
      </Widget>
    ),
    pay: (
      <Widget title={t('Pay over the last 3 months')} sub={t('Net pay and deductions')} action={() => onAsk('payroll-assistant', 'Explain my latest payslip')}>
        <StackedColumns height={150} format={money}
          data={d.pay.map((x) => ({ label: new Date(`${x.period}-01`).toLocaleDateString('en-GB', { month: 'short' }), values: [x.net, x.deductions] }))}
          series={[{ name: t('Net pay'), color: SERIES[0] }, { name: t('Deductions'), color: SERIES[1] }]} />
        {d.pay.some((x) => x.bonus) && <p className="mt-2 text-[11px] text-slate-500">Includes a {money(d.pay.find((x) => x.bonus)!.bonus)} performance bonus in {d.pay.find((x) => x.bonus)!.period}.</p>}
      </Widget>
    ),
    payslip: (
      <Widget title={`Payslip breakdown · ${latest.period}`} sub={`Gross ${money(latest.gross)} → net ${money(latest.net)}`} action={() => onAsk('payroll-assistant', 'Explain the deductions on my latest payslip')}>
        <HBars data={d.payComponents.map((c) => ({ label: `${c.deduction ? '−' : '+'} ${c.name}`, value: c.value, detail: c.deduction ? 'deduction' : 'earning' }))} format={money} />
      </Widget>
    ),
    tasks: (
      <Widget title={t('Your tasks')} sub={`${d.onboarding.done} of ${d.onboarding.total} complete`} action={() => onAsk('onboarding', 'What onboarding tasks are pending?')}>
        <Progress label="Joining and compliance tasks" value={d.onboarding.done} max={d.onboarding.total} color={SERIES[2]} />
        <div className="mt-3 space-y-1">
          {d.onboarding.pending.map((x) => <ListRow key={x.task} left={<span className="flex items-start gap-2 text-slate-200"><ClipboardList className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-amber-300" />{x.task}</span>} right={shortDate(x.due)} />)}
        </div>
      </Widget>
    ),
    holidays: (
      <Widget title={t('Upcoming holidays')} action={() => onAsk('leave-attendance', 'What are the upcoming holidays?')}>
        <div className="space-y-1">
          {d.holidays.map((h) => (
            <ListRow key={h.date} left={<span className="flex items-center gap-3"><span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-lg bg-white/[0.05] text-center leading-none"><span><span className="block text-sm font-bold text-white">{new Date(h.date).getDate()}</span><span className="text-[9px] uppercase text-slate-400">{new Date(h.date).toLocaleDateString('en-GB', { month: 'short' })}</span></span></span><span className="text-slate-200">{h.name}</span></span>}
              right={new Date(h.date).toLocaleDateString('en-GB', { weekday: 'short' })} />
          ))}
        </div>
      </Widget>
    ),
    career: (
      <Widget title={t('Career opportunities')} sub={t('Internal roles matched to your skills')} action={() => onAsk('career', 'Show internal jobs that match my skills')}>
        <div className="space-y-3">
          {d.jobs.map((j, i) => <Progress key={j.id} label={j.title} value={j.matchPct} color={TINTS[i]} right={`${j.matchPct}% match`} />)}
        </div>
        <div className="mt-4 border-t border-white/5 pt-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-slate-500"><GraduationCap className="h-3.5 w-3.5" /> Recommended learning</p>
          {d.learning.map((l) => <ListRow key={l.id} left={<span className="text-slate-200">{l.title}</span>} right={`${l.hours}h`} onClick={() => onAsk('career', `Tell me about the course "${l.title}"`)} />)}
        </div>
      </Widget>
    ),
    benefits: (
      <Widget title={t('Benefits and allowances')} sub="This year" action={() => onAsk('benefits', 'What does my medical plan cover?')}>
        {learningBudget && <Progress label="Learning budget used" value={learningBudget.used ?? 0} max={learningBudget.annual} color={SERIES[4]} right={`${money(learningBudget.used ?? 0)} of ${money(learningBudget.annual!)}`} />}
        <div className="mt-3 grid grid-cols-2 gap-2">
          {d.allowances.filter((a) => a.monthly).map((a) => (
            <div key={a.name} className="rounded-xl bg-white/[0.04] p-3"><div className="text-[11px] text-slate-400">{a.name}</div><div className="text-lg font-bold text-white">{money(a.monthly!)}<span className="text-xs font-normal text-slate-500"> /mo</span></div></div>
          ))}
        </div>
      </Widget>
    ),
    requests: (
      <Widget title={t('IT and facilities requests')} sub={d.jira ? 'Tracked in Jira · live status' : undefined} jira={d.jira} action={() => onAsk('it-facilities', 'What is the Jira status of my requests?')}>
        {d.requests.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 rounded-lg px-2 py-2 text-xs">
            <span className="min-w-0">
              <span className="flex items-center gap-2 text-slate-200"><Ticket className="h-3.5 w-3.5 flex-shrink-0 text-cyan-300" /><span className="truncate">{r.item}</span></span>
              <span className="mt-0.5 block truncate pl-5 text-[11px] text-slate-500">
                {r.id}
                {r.jira?.key && <> · <a href={r.jira.url} target="_blank" rel="noreferrer" className="font-medium text-sky-300 hover:underline">{r.jira.key}</a>{r.jira.assignee ? ` · ${r.jira.assignee}` : ''}</>}
              </span>
            </span>
            <JiraStatus r={r} />
          </div>
        ))}
        <div className="mt-2 grid grid-cols-2 gap-2">
          <button onClick={() => onAsk('it-facilities', 'Request a parking permit')} className="rounded-lg border border-dashed border-white/15 py-2 text-xs text-slate-400 hover:border-blue-500/50 hover:text-white">+ Parking permit</button>
          <button onClick={() => onAsk('it-facilities', 'I need a new laptop')} className="rounded-lg border border-dashed border-white/15 py-2 text-xs text-slate-400 hover:border-blue-500/50 hover:text-white">+ New laptop</button>
        </div>
      </Widget>
    ),
    documents: (
      <Widget title={t('Documents')} sub={t('Letters generated instantly')} action={() => onAsk('documents', 'Show my documents')}>
        <div className="grid grid-cols-2 gap-2">
          {['Salary Certificate', 'Employment Verification', 'Experience Letter', 'Visa Support Letter'].map((x) => (
            <button key={x} onClick={() => onAsk('documents', `Generate a ${x.toLowerCase()}`)} className="rounded-xl bg-white/[0.04] p-3 text-left text-xs text-slate-200 transition hover:bg-white/[0.08]">
              <Briefcase className="mb-1.5 h-4 w-4 text-blue-300" />{x}
            </button>
          ))}
        </div>
      </Widget>
    ),
  };
}

// Home layout: [widget key, 12-column span]
const EMP_HOME: [string, string][] = [
  ['leave', 'lg:col-span-4'], ['attendance', 'lg:col-span-4'], ['pay', 'lg:col-span-4'],
  ['payslip', 'lg:col-span-5'], ['tasks', 'lg:col-span-3'], ['holidays', 'lg:col-span-4'],
  ['career', 'lg:col-span-7'], ['benefits', 'lg:col-span-5'],
  ['requests', 'lg:col-span-6'], ['documents', 'lg:col-span-6'],
];
const Grid = ({ w, layout }: { w: Record<string, ReactNode>; layout: [string, string][] }) => (
  <div className="grid gap-4 lg:grid-cols-12">{layout.filter(([k]) => w[k]).map(([k, span]) => <div key={k} className={`flex ${span}`}><div className="flex w-full flex-col [&>section]:flex-1">{w[k]}</div></div>)}</div>
);

export function EmployeeDashboard({ d, onAsk }: { d: EmployeeDash; onAsk: Ask }) {
  const t = useT();
  const w = useEmployeeWidgets(d, onAsk);
  const nextHoliday = d.holidays[0];
  return (
    <div className="space-y-4">
      <Hero name={d.profile.name} line={`${d.profile.title} · ${d.profile.dept} · reports to ${d.profile.manager} · ${d.profile.tenureYears} years with the company`}
        chips={[
          { label: t('Plan time off around the holidays'), onClick: () => onAsk('leave-attendance', 'What are the upcoming holidays and how much annual leave do I have?') },
          { label: t('Why did my pay change?'), onClick: () => onAsk('payroll-assistant', 'Why was my pay higher two months ago?') },
          { label: t('Path to Staff Engineer'), onClick: () => onAsk('career', 'What training should I take to become a Staff Engineer?') },
        ]}>
        {nextHoliday && (
          <div className="rounded-xl border border-white/10 bg-slate-950/40 px-4 py-3 text-right">
            <div className="flex items-center justify-end gap-1.5 text-[11px] uppercase tracking-wider text-slate-400"><CalendarHeart className="h-3.5 w-3.5 text-pink-300" /> {t('Next holiday')}</div>
            <div className="text-sm font-semibold text-white">{nextHoliday.name}</div>
            <div className="text-xs text-slate-400">{shortDate(nextHoliday.date)}</div>
          </div>
        )}
      </Hero>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{d.kpis.map((k, i) => <KpiTile key={k.label} k={{ ...k, label: t(k.label) }} onAsk={onAsk} tint={TINTS[i]} />)}</div>
      <Grid w={w} layout={EMP_HOME.filter(([k]) => k !== 'profile')} />
    </div>
  );
}

// ---------- HR operations (Tessa): widgets ----------
const RANGE_LABEL: Record<number, string> = { 1: '1y', 3: '3y', 5: '5y', 10: '10y', 0: 'All' };
const docLevel = (state: string): Severity => (state === 'Expired' ? 'critical' : state.startsWith('Expiring') ? 'warning' : 'serious');
const priorityLevel = (p: string | null): Severity => (p === 'Critical' ? 'critical' : p === 'High' ? 'serious' : p === 'Medium' ? 'warning' : 'info');

function FilterBar({ d, filters, onFilter, onReport }: { d: HrDash; filters: HrFilters; onFilter: (f: HrFilters) => void; onReport?: () => void }) {
  const t = useT();
  const today = new Date().toISOString().slice(0, 10);
  const custom = Boolean(filters.from && filters.to);
  const [picking, setPicking] = useState(false);
  const [from, setFrom] = useState(filters.from ?? `${new Date().getFullYear() - 1}-01-01`);
  const [to, setTo] = useState(filters.to ?? today);
  return (
    <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-slate-900/70 px-3 py-2.5">
      <label className="flex items-center gap-2 text-xs text-slate-400">
        <Filter className="h-3.5 w-3.5" />{t('Division')}
        <select value={filters.division ?? ''} onChange={(e) => onFilter({ ...filters, division: e.target.value || null })}
          className="max-w-[220px] rounded-lg border border-white/10 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-blue-500">
          <option value="">{t('All divisions')}</option>
          {d.filters.divisions.map((v) => <option key={v} value={v}>{v.replace(/\s*\([^)]*\)$/, '')}</option>)}
        </select>
      </label>
      <div className="flex items-center gap-1 text-xs text-slate-400">
        <CalendarRange className="ms-2 h-3.5 w-3.5" /><span className="me-1">{t('Period')}</span>
        <div className="flex rounded-lg border border-white/10 bg-slate-950 p-0.5" role="group" aria-label={t('Period')}>
          {d.filters.ranges.map((y) => {
            const active = !custom && filters.years === y;
            return (
              <button key={y} onClick={() => { setPicking(false); onFilter({ ...filters, years: y, from: null, to: null }); }} aria-pressed={active}
                className={`rounded-md px-2.5 py-1 font-medium transition ${active ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>{t(RANGE_LABEL[y])}</button>
            );
          })}
          <button onClick={() => setPicking((p) => !p)} aria-pressed={custom} aria-expanded={picking}
            className={`rounded-md px-2.5 py-1 font-medium transition ${custom ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>Custom</button>
        </div>
      </div>
      {picking && (
        <form className="flex flex-wrap items-center gap-2 text-xs text-slate-400"
          onSubmit={(e) => { e.preventDefault(); if (from && to && from <= to) { onFilter({ ...filters, from, to }); setPicking(false); } }}>
          <label className="flex items-center gap-1">From<input type="date" required value={from} max={to || today} onChange={(e) => setFrom(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-xs text-slate-200 outline-none focus:border-blue-500" /></label>
          <label className="flex items-center gap-1">To<input type="date" required value={to} min={from} max={today} onChange={(e) => setTo(e.target.value)}
            className="rounded-lg border border-white/10 bg-slate-950 px-2 py-1 text-xs text-slate-200 outline-none focus:border-blue-500" /></label>
          <button type="submit" disabled={!from || !to || from > to} className="rounded-lg bg-blue-600 px-2.5 py-1 font-semibold text-white hover:bg-blue-500 disabled:opacity-40">Apply</button>
        </form>
      )}
      {custom && !picking && <span className="rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-200">{d.filters.span}</span>}
      {filters.division && (
        <button onClick={() => onFilter({ ...filters, division: null })} className="flex items-center gap-1.5 rounded-full border border-blue-500/40 bg-blue-500/10 px-2.5 py-1 text-xs text-blue-200 hover:bg-blue-500/20">
          {t('Filtered to')} {filters.division.replace(/\s*\([^)]*\)$/, '')}<X className="h-3 w-3" /><span className="sr-only">{t('Clear filter')}</span>
        </button>
      )}
      {onReport && (
        <button onClick={onReport} className="ms-auto flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500">
          <FileBarChart className="h-3.5 w-3.5" />{t('Executive report')}
        </button>
      )}
    </div>
  );
}

function useHrWidgets(d: HrDash, filters: HrFilters, onFilter: (f: HrFilters) => void, onAsk: Ask, onReport: () => void, onDocuments: () => void): Record<string, ReactNode> {
  const t = useT();
  const riskColor: Record<string, string> = { High: STATUS.critical, Medium: STATUS.warning, Low: STATUS.good };
  const appColors = [SERIES[0], SERIES[2], SERIES[3], SERIES[1], SERIES[4]];
  const div = filters.division?.replace(/\s*\([^)]*\)$/, '');
  const scope = div ? ` in ${div}` : '';
  return {
    headcount: (
      <Widget title={t('Headcount by division')} sub={`${t('Click a division to filter the dashboard')} · vacancy rate on the right`} sap action={() => onAsk('workforce', 'Where do we have the most vacancies?')}>
        {d.headcount ? (
          <HBars onSelect={(key) => onFilter({ ...filters, division: key === filters.division ? null : key })}
            data={d.headcount.map((h) => ({ key: h.division, label: h.name, value: h.headcount, selected: h.selected, detail: `${h.vacant} vacant positions (${h.vacancyRatePct}%)` }))}
            note={(x) => <span>{x.value} <span className="text-slate-500">· {d.headcount!.find((h) => h.name === x.label)?.vacancyRatePct}%</span></span>} />
        ) : <Unavailable />}
      </Widget>
    ),
    hiring: (
      <Widget title={t('Hiring trend')} sub={`${d.hires && !/^d{4}$/.test(d.hires[0]?.label ?? '') ? 'New hires by month' : t('New hires by year')}${scope} · ${d.filters.span}`} sap action={() => onAsk('workforce', `How has hiring trended${scope} over the ${d.filters.span}?`)}>
        {d.hires ? <Columns data={d.hires.map((h) => ({ label: /^d{4}$/.test(h.label) && d.hires!.length > 6 ? `'${h.label.slice(2)}` : h.label, value: h.hires }))} color={SERIES[2]} unit=" hires" height={170} /> : <Unavailable />}
      </Widget>
    ),
    departments: div ? (
      <Widget title={`${t('Top departments')} · ${div}`} sap action={() => onAsk('workforce', `Show the workforce profile for the ${div} division`)}>
        {d.departments?.length ? <HBars data={d.departments.map((x) => ({ label: x.name.replace(/\s*\([^)]*\)$/, ''), value: x.count }))} color={SERIES[0]} /> : <p className="py-4 text-center text-xs text-slate-500">No department data for this division.</p>}
      </Widget>
    ) : null,
    keyTalent: div ? (
      <Widget title={`${t('Key talent at risk')} · ${div}`} sap action={() => onAsk('attrition', `Suggest a retention plan for ${div}`)}>
        {d.risk?.regrettableList.length ? d.risk.regrettableList.map((p) => (
          <ListRow key={p.name} left={<span><span className="font-medium text-slate-200">{p.name}</span><span className="block text-[11px] text-slate-500">{p.title}</span></span>} right={<SeverityChip level="critical" />} />
        )) : <p className="py-4 text-center text-xs text-slate-500">No high performers at high risk in this division.</p>}
      </Widget>
    ) : null,
    countries: (
      <Widget title={`${t('Workforce by country')}${div ? ` · ${div}` : ''}`} sub={t('Top locations')} sap action={() => onAsk('workforce', 'Show headcount by division and country')}>
        {d.countries?.length ? <HBars data={d.countries.map((c) => ({ label: c.name, value: c.count }))} color={SERIES[0]} /> : <Unavailable />}
      </Widget>
    ),
    risk: (
      <Widget title={t('Retention risk')} sub={`${t('Employees with a risk-of-loss rating')}${scope}`} sap action={() => onAsk('attrition', 'Who are our high performers at high risk of leaving?')}>
        {d.risk ? (
          <>
            <Donut center={d.risk.regrettable} sub={t('key talent')} data={['High', 'Medium', 'Low'].map((n) => ({ name: `${n} risk`, value: d.risk!.distribution.find((x) => x.name === n)?.count ?? 0, color: riskColor[n] }))} />
            <div className="mt-4 space-y-2">
              {d.risk.divisions.map((v) => <Progress key={v.division} label={v.division.replace(/\s*\([^)]*\)$/, '')} value={v.highRiskPct} color={STATUS.critical} right={`${v.highRiskPct}% high risk`} />)}
            </div>
          </>
        ) : <Unavailable />}
      </Widget>
    ),
    recruiting: (
      <Widget title={t('Recruiting pipeline')} sub={`Applications on open requisitions${scope} · created ${d.filters.span}`} sap action={() => onAsk('recruitment', 'Which requisitions have the most applicants?')}>
        {d.applications ? (
          <div className="grid gap-5 md:grid-cols-2">
            <Donut center={d.applications.reduce((s, a) => s + a.count, 0).toLocaleString()} sub={t('applications')} data={d.applications.map((a, i) => ({ name: a.name, value: a.count, color: appColors[i] }))} />
            <div className="space-y-1">
              {d.busiestReqs?.map((r) => (
                <ListRow key={r.jobReqId} onClick={() => onAsk('recruitment', `Screen the applicants for requisition ${r.jobReqId}`)}
                  left={<span><span className="font-semibold text-slate-200">Req {r.jobReqId}</span><span className="block truncate text-[11px] text-slate-500">{[r.department, r.location].filter(Boolean).join(' · ') || r.status}</span></span>}
                  right={<span className="tabular-nums">{r.applications} applicants</span>} />
              ))}
              {!d.busiestReqs?.length && <p className="py-4 text-center text-xs text-slate-500">No open requisitions in this period.</p>}
            </div>
          </div>
        ) : <Unavailable />}
      </Widget>
    ),
    performance: (
      <Widget title={t('Performance cycle')} sub={`${d.reviews?.total.toLocaleString() ?? 0} review forms due${scope} · ${d.filters.span}`} sap action={() => onAsk('performance', 'Draft a reminder to managers with overdue reviews')}>
        {d.reviews ? (
          <>
            <Progress label={t('Review forms completed')} value={d.reviews.completionPct} color={SERIES[0]} />
            <p className="mb-1 mt-4 text-[11px] uppercase tracking-wider text-slate-500">{t('Most recently overdue')}</p>
            {d.reviews.overdue.map((o) => <ListRow key={o.form} left={<span className="block truncate text-slate-200">{o.form}</span>} right={`${o.daysOverdue}d late`} />)}
            {!d.reviews.overdue.length && <p className="py-3 text-center text-xs text-slate-500">No overdue reviews in this period.</p>}
          </>
        ) : <Unavailable />}
      </Widget>
    ),
    documents: (
      <Widget title={t('Employee documents')} sub={t('Identity and work-permit documents')} sap action={() => onAsk('compliance', 'Which employee documents have expired or are expiring soon?')}>
        {d.compliance ? (
          <>
            <div className="mb-3 grid grid-cols-3 gap-2 text-center">
              {([['Expired', d.compliance.status.find((s) => s.name === 'Expired')?.count ?? 0, STATUS.critical], [t('Missing expiry date'), d.compliance.missingExpiry, STATUS.serious], [t('Timesheet to-dos'), d.compliance.timesheets, STATUS.warning]] as const).map(([label, value, color]) => (
                <div key={label} className="rounded-xl bg-white/[0.04] px-2 py-2"><div className="text-lg font-black text-white">{value}</div><div className="flex items-center justify-center gap-1 text-[10px] text-slate-400"><span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />{label}</div></div>
              ))}
            </div>
            {d.compliance.documents.map((x) => (
              <ListRow key={x.employee + x.document} onClick={() => onAsk('compliance', `What should HR do about ${x.employee}'s ${x.document} (${x.state.toLowerCase()})?`)}
                left={<span><span className="block truncate font-medium text-slate-200">{x.employee}</span><span className="text-[11px] text-slate-500">{x.document}{x.expires ? ` · ${shortDate(x.expires)}` : ''}</span></span>}
                right={<SeverityChip level={docLevel(x.state)} />} />
            ))}
          </>
        ) : <Unavailable />}
      </Widget>
    ),
    payroll: (
      <Widget title={t('Payroll exceptions')} sub={t('Recurring pay records checked against peers')} sap action={() => onAsk('payroll-ops', 'Check SAP pay data for exceptions')}>
        {d.payroll ? (
          <>
            {d.payroll.findings.map((f) => <div key={f.name} className="mb-2 flex items-center justify-between rounded-lg bg-white/[0.04] px-3 py-2 text-xs text-slate-300"><span>{f.name}</span><span className="font-semibold text-white">{f.count}</span></div>)}
            {d.payroll.top.map((x, i) => (
              <ListRow key={i} onClick={() => onAsk('payroll-ops', `Explain the ${x.issue.toLowerCase()} for user ${x.userId} on ${x.payComponent}`)}
                left={<span><span className="font-medium text-slate-200">{x.payComponent}</span><span className="block truncate text-[11px] text-slate-500">User {x.userId} · {x.detail}</span></span>}
                right={<SeverityChip level={x.severity === 'Critical' ? 'critical' : x.severity === 'High' ? 'serious' : 'warning'} />} />
            ))}
          </>
        ) : <Unavailable />}
      </Widget>
    ),
    workflows: (
      <Widget title={t('Workflow requests')} sub={`${d.workflows?.pending ?? 0} pending in SAP · ${t('Pending approvals by age')}`} sap action={() => onAsk('ops-copilot', 'Which workflow requests are stalled and what should I do?')}>
        {d.workflows ? (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <HBars data={d.workflows.byAge.map((a) => ({ label: a.name, value: a.count }))} color={SERIES[3]} />
              <p className="mb-1 mt-4 text-[11px] uppercase tracking-wider text-slate-500">Open to-dos by category</p>
              <HBars data={d.workflows.todos.map((a) => ({ label: a.name, value: a.count }))} color={SERIES[4]} />
            </div>
            <div className="space-y-1">
              {d.workflows.latest.map((x) => (
                <ListRow key={x.id} onClick={() => onAsk('ops-copilot', `What is happening with SAP workflow request ${x.id} and who should approve it?`)}
                  left={<span><span className="font-medium text-slate-200">#{x.id} · {x.type}</span><span className="block truncate text-[11px] text-slate-500">{x.requestedBy} · step {x.step} · {shortDate(x.created)}</span></span>}
                  right={`${x.ageDays}d`} />
              ))}
            </div>
          </div>
        ) : <Unavailable />}
      </Widget>
    ),
    training: (
      <Widget title={t('Training completion')} sub={t('Mandatory training by department')} action={() => onAsk('compliance', 'Training completion by department')}>
        <HBars data={d.trainingByDept.map((x) => ({ label: x.name, value: x.pct }))} format={(v) => `${v}%`} color={SERIES[4]} />
      </Widget>
    ),
    cases: (
      <Widget title="HR case queue" sub={`${d.cases.filter((c) => !c.category).length} new cases need triage`} action={() => onAsk('case-mgmt', 'Triage all new cases')}>
        {d.cases.map((c) => (
          <ListRow key={c.id} onClick={() => onAsk('case-mgmt', `Summarise case ${c.id} and draft a reply`)}
            left={<span><span className="font-medium text-slate-200">{c.subject}</span><span className="block text-[11px] text-slate-500">{c.id} · {c.employee} · {shortDate(c.received)}</span></span>}
            right={c.priority ? <SeverityChip level={priorityLevel(c.priority)} /> : <span className="rounded-full bg-blue-500/15 px-2 py-0.5 text-[10px] font-semibold text-blue-200">New</span>} />
        ))}
      </Widget>
    ),
    notices: (
      <Widget title={t('Notifications')} sub="What needs attention now" action={() => onAsk('ops-copilot', 'What needs my attention today?')}>
        {d.notifications.map((n, i) => {
          const s = SEVERITY[n.severity];
          const Icon = s.icon;
          return (
            <ListRow key={i} onClick={() => onAsk(n.agent, n.prompt)}
              left={<span className="flex items-start gap-2"><Icon className="mt-0.5 h-3.5 w-3.5 flex-shrink-0" style={{ color: s.color }} /><span><span className="block font-medium text-slate-200">{n.title}</span><span className="text-[11px] text-slate-500">{n.detail}</span></span></span>} />
          );
        })}
      </Widget>
    ),
    onedrive: (
      <Widget title="Documents in OneDrive" sub="Browse, search and analyse with Gemini">
        <p className="mb-3 text-xs text-slate-400">Open any HR document from your OneDrive and Gemini extracts the type, people, dates and amounts, and flags missing or inconsistent details.</p>
        <button onClick={onDocuments} className="flex w-full items-center justify-center gap-2 rounded-xl bg-sky-600 px-3 py-2 text-xs font-semibold text-white hover:bg-sky-500"><Cloud className="h-3.5 w-3.5" />Open Documents · OneDrive</button>
      </Widget>
    ),
    report: (
      <Widget title={t('Executive report')} sub={`${d.filters.label} · ${d.filters.span}`}>
        <p className="mb-3 text-xs text-slate-400">A leadership-ready report from live SAP data: headline, key metrics, risks and actions. Download as PDF or PowerPoint, or create an Outlook draft.</p>
        <button onClick={onReport} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500"><FileBarChart className="h-3.5 w-3.5" />Generate report</button>
      </Widget>
    ),
  };
}

const HR_HOME: [string, string][] = [
  ['headcount', 'lg:col-span-7'], ['hiring', 'lg:col-span-5'],
  ['departments', 'lg:col-span-4'], ['keyTalent', 'lg:col-span-4'],
  ['risk', 'lg:col-span-5'], ['recruiting', 'lg:col-span-7'],
  ['performance', 'lg:col-span-4'], ['documents', 'lg:col-span-4'], ['payroll', 'lg:col-span-4'],
  ['workflows', 'lg:col-span-6'], ['training', 'lg:col-span-3'], ['countries', 'lg:col-span-3'],
];

type HrProps = { d: HrDash; user: User; filters: HrFilters; onFilter: (f: HrFilters) => void; onReport: () => void; onDocuments: () => void; onAsk: Ask };

export function HrDashboard({ d, user, filters, onFilter, onReport, onDocuments, onAsk }: HrProps) {
  const t = useT();
  const w = useHrWidgets(d, filters, onFilter, onAsk, onReport, onDocuments);
  const urgent = d.notifications.filter((n) => n.severity === 'critical' || n.severity === 'serious').length;
  // With a division selected, its countries appear in the drill-down row instead of the last row.
  const layout = filters.division
    ? HR_HOME.flatMap((e): [string, string][] => (e[0] === 'keyTalent' ? [e, ['countries', 'lg:col-span-4']] : e[0] === 'countries' ? [] : e[0] === 'training' ? [['training', 'lg:col-span-6']] : [e]))
    : HR_HOME;
  return (
    <div className="space-y-4">
      <Hero name={user.name}
        line={`${urgent} urgent item${urgent === 1 ? '' : 's'} and ${d.notifications.length - urgent} updates across workforce, documents, workflows and payroll. Figures marked SAP come live from SAP SuccessFactors.`}
        chips={[
          { label: t('What needs my attention today?'), onClick: () => onAsk('ops-copilot', 'What needs my attention today?') },
          { label: t('Prepare the leadership report'), onClick: onReport },
          { label: t('Triage new cases'), onClick: () => onAsk('case-mgmt', 'Triage all new cases') },
        ]}>
        {d.sapAvailable && <SapBadge label={t('Connected to SAP SuccessFactors')} />}
      </Hero>
      <FilterBar d={d} filters={filters} onFilter={onFilter} onReport={onReport} />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">{d.kpis.map((k, i) => <KpiTile key={k.label} k={{ ...k, label: t(k.label) }} onAsk={onAsk} tint={TINTS[i % TINTS.length]} />)}</div>
      <Grid w={w} layout={layout} />
    </div>
  );
}

// ---------- Agent overview: each agent's own mini dashboard ----------
// Which KPI tiles (by label) and widgets (by key) belong to each agent. Widgets pair up two per row;
// a ":wide" suffix makes one span the full row, so rows never leave a gap.
const AGENT_VIEWS: Record<string, { kpis: string[]; widgets: string[] }> = {
  // Employee
  'hr-assistant': { kpis: ['Annual leave left', 'Open tasks'], widgets: ['profile:wide', 'benefits', 'tasks'] },
  'leave-attendance': { kpis: ['Annual leave left', 'Office days'], widgets: ['leave', 'attendance', 'holidays:wide'] },
  'payroll-assistant': { kpis: ['Latest net pay'], widgets: ['pay', 'payslip'] },
  onboarding: { kpis: ['Open tasks'], widgets: ['tasks', 'profile'] },
  career: { kpis: [], widgets: ['career', 'profile'] },
  benefits: { kpis: [], widgets: ['benefits', 'profile'] },
  'it-facilities': { kpis: [], widgets: ['requests:wide'] },
  documents: { kpis: [], widgets: ['documents', 'profile'] },
  // HR operations
  'ops-copilot': { kpis: ['Approvals waiting', 'Pending workflows', 'Reviews overdue'], widgets: ['notices', 'documents', 'workflows:wide'] },
  recruitment: { kpis: ['Open requisitions', 'New hires', 'Vacant positions'], widgets: ['recruiting:wide', 'hiring:wide'] },
  'payroll-ops': { kpis: [], widgets: ['payroll:wide'] },
  'case-mgmt': { kpis: ['Pending workflows'], widgets: ['cases', 'workflows'] },
  workforce: { kpis: ['Active employees', 'New hires', 'Vacant positions', 'Open requisitions'], widgets: ['headcount:wide', 'hiring', 'countries', 'departments', 'keyTalent'] },
  compliance: { kpis: [], widgets: ['documents', 'training'] },
  performance: { kpis: ['Reviews overdue'], widgets: ['performance:wide'] },
  attrition: { kpis: ['Active employees'], widgets: ['risk', 'headcount', 'keyTalent', 'departments'] },
  'doc-processing': { kpis: [], widgets: ['onedrive', 'documents'] },
  'exec-reporting': { kpis: ['Active employees', 'New hires', 'Vacant positions', 'Open requisitions', 'Approvals waiting', 'Reviews overdue', 'Pending workflows'], widgets: ['report', 'risk', 'headcount:wide'] },
};

type OverviewProps = {
  agent: { id: string; name: string; icon: string; description: string; prompts: string[]; sources: string[] };
  onAsk: Ask; onChat: () => void;
} & ({ role: 'employee'; d: EmployeeDash } | { role: 'hr'; d: HrDash; filters: HrFilters; onFilter: (f: HrFilters) => void; onReport: () => void; onDocuments: () => void });

function EmployeeWidgets({ d, onAsk, keys }: { d: EmployeeDash; onAsk: Ask; keys: string[] }) {
  const w = useEmployeeWidgets(d, onAsk);
  return <OverviewGrid w={w} keys={keys} />;
}
function HrWidgets({ d, filters, onFilter, onAsk, onReport, onDocuments, keys }: { d: HrDash; filters: HrFilters; onFilter: (f: HrFilters) => void; onAsk: Ask; onReport: () => void; onDocuments: () => void; keys: string[] }) {
  const w = useHrWidgets(d, filters, onFilter, onAsk, onReport, onDocuments);
  return <OverviewGrid w={w} keys={keys} />;
}
const OverviewGrid = ({ w, keys }: { w: Record<string, ReactNode>; keys: string[] }) => (
  <div className="grid gap-4 lg:grid-cols-2">
    {keys.map((k) => k.split(':')).filter(([k]) => w[k]).map(([k, wide]) => <div key={k} className={`flex ${wide ? 'lg:col-span-2' : ''}`}><div className="flex w-full flex-col [&>section]:flex-1">{w[k]}</div></div>)}
  </div>
);

export function AgentOverview(props: OverviewProps) {
  const { agent, onAsk, onChat } = props;
  const view = AGENT_VIEWS[agent.id] ?? { kpis: [], widgets: [] };
  const stats = agentStats(agent.id, props.d);
  const tools = AGENT_TOOLS[agent.id] ?? [];
  const sap = agent.sources.includes('SAP SuccessFactors');
  return (
    <div className="space-y-5">
      <section className="relative overflow-hidden rounded-3xl border border-white/[0.06] bg-gradient-to-br from-blue-600/20 via-slate-900 to-indigo-600/10 p-5 sm:p-6">
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-indigo-500/15 blur-3xl" />
        <div className="relative flex items-start gap-4 sm:gap-5">
          <div className="grid h-14 w-14 flex-shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-xl shadow-blue-600/30 sm:h-20 sm:w-20 sm:rounded-3xl"><AgentIcon name={agent.icon} className="h-7 w-7 text-white sm:h-9 sm:w-9" /></div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-300">{props.role === 'hr' ? 'HR operations' : 'Employee self-service'} · Gemini agent{sap ? ' · SAP SuccessFactors' : ''}</p>
            <h2 className="mt-1 text-2xl font-black tracking-tight text-white sm:text-4xl">{agent.name}</h2>
            <p className="mt-1.5 max-w-2xl text-sm text-slate-300 sm:text-base">{agent.description}</p>
          </div>
          <button onClick={onChat} className="hidden flex-shrink-0 items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 sm:flex lg:hidden"><MessageSquare className="h-4 w-4" />Chat</button>
        </div>
      </section>
      {props.role === 'hr' && <FilterBar d={props.d} filters={props.filters} onFilter={props.onFilter} />}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 2xl:grid-cols-4">{stats.map((x) => <StatCard key={x.label} x={x} onAsk={() => onAsk(agent.id, x.prompt)} />)}</div>
      {tools.length > 0 && (
        <section>
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <h3 className="flex items-center gap-2 text-lg font-black text-white"><Sparkles className="h-5 w-5 text-blue-300" />AI tools</h3>
            <span className="text-sm text-slate-400">Fill in a few details; the agent does the rest.</span>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">{tools.map((tl) => <ToolCard key={tl.title} tool={tl} onRun={(p) => onAsk(agent.id, p)} />)}</div>
        </section>
      )}
      {props.role === 'employee'
        ? <EmployeeWidgets d={props.d} onAsk={onAsk} keys={view.widgets} />
        : <HrWidgets d={props.d} filters={props.filters} onFilter={props.onFilter} onAsk={onAsk} onReport={props.onReport} onDocuments={props.onDocuments} keys={view.widgets} />}
    </div>
  );
}
