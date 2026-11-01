// Public pages behind the landing navigation: How it works, User flow, Architecture and Agents.
// The architecture and use-case images come from the solution pack (Captial A/solution).
import { useEffect, useState, type ReactNode } from 'react';
import {
  Bell, BellRing, Bot, Building2, CheckCircle2, ChevronRight, Cloud, Database, FileBarChart, Filter, GitBranch, KeyRound,
  LayoutDashboard, Lock, Maximize2, MessageSquare, Server, ShieldCheck, Sparkles, Ticket, Users, X, type LucideIcon,
} from 'lucide-react';
import type { Agent } from '../lib/api';
import { onLink } from '../lib/router';
import { AgentIcon, JiraBadge, SapBadge } from './AgentIcon';

function PageHeader({ eyebrow, title, intro }: { eyebrow: string; title: string; intro: string }) {
  return (
    <div className="mb-8 max-w-3xl">
      <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-cyan-300">{eyebrow}</p>
      <h1 className="mb-3 text-3xl font-black tracking-tight text-white sm:text-4xl">{title}</h1>
      <p className="text-slate-400">{intro}</p>
    </div>
  );
}

const Page = ({ children }: { children: ReactNode }) => <main className="relative z-10 mx-auto max-w-6xl px-4 pb-16 pt-10 sm:px-6">{children}</main>;

// Image from the solution pack; click to view full size.
function Figure({ src, alt, caption }: { src: string; alt: string; caption: string }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);
  return (
    <figure>
      <button onClick={() => setOpen(true)} className="group relative block w-full overflow-hidden rounded-2xl border border-white/10 bg-white shadow-2xl shadow-black/40" aria-label={`Enlarge: ${alt}`}>
        <img src={src} alt={alt} className="w-full" loading="lazy" />
        <span className="absolute right-3 top-3 flex items-center gap-1 rounded-lg bg-slate-900/80 px-2 py-1 text-[11px] font-medium text-white opacity-0 transition group-hover:opacity-100"><Maximize2 className="h-3 w-3" /> Full size</span>
      </button>
      <figcaption className="mt-2 text-xs text-slate-500">{caption}</figcaption>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm" role="dialog" aria-modal="true" aria-label={alt} onClick={() => setOpen(false)}>
          <button className="absolute right-4 top-4 rounded-lg bg-white/10 p-2 text-white hover:bg-white/20" aria-label="Close"><X className="h-5 w-5" /></button>
          <img src={src} alt={alt} className="max-h-full max-w-full rounded-xl" />
        </div>
      )}
    </figure>
  );
}

// ---------- How it works ----------
const STEPS = [
  { icon: Users, title: 'Sign in by role', text: 'HR staff use their Microsoft 365 work account; employees use their self-service login. Your role decides which dashboards and agents you see.' },
  { icon: LayoutDashboard, title: 'Start on a live dashboard', text: 'KPIs, charts and notifications for your role. Every widget opens the right agent with the question already asked.' },
  { icon: Sparkles, title: 'Ask in plain language', text: 'Each agent is Gemini with a focused job, a system prompt and a fixed set of tools. Answers come back as headlines, tables and next steps.' },
  { icon: Database, title: 'Grounded in HR systems', text: 'Gemini calls tools; the server queries SAP SuccessFactors, Jira and Microsoft 365, selecting only the fields needed, and Gemini answers from what came back.' },
];
const TRUST = [
  { icon: ShieldCheck, title: 'Role-based access', text: 'Microsoft 365 identity is verified on the server before HR agents unlock. Employees only reach their own records.' },
  { icon: Lock, title: 'Minimum data to the model', text: 'Queries select only needed fields; identifiers like SSNs, phone numbers and addresses are never requested.' },
  { icon: BellRing, title: 'Proactive notifications', text: 'Expired documents, stalled workflows, overdue reviews and pending approvals surface before anyone has to ask.' },
];

export function HowItWorksPage() {
  return (
    <Page>
      <PageHeader eyebrow="How it works" title="Agents never answer from memory" intro="Gemini decides which HR tools to call, the server runs them against your systems of record, and Gemini writes the answer from what came back. Every reply shows which systems it used." />
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {STEPS.map(({ icon: Icon, title, text }, n) => (
          <li key={title} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <div className="mb-3 flex items-center gap-2"><span className="grid h-7 w-7 place-items-center rounded-lg bg-blue-500/15 text-xs font-bold text-blue-300">{n + 1}</span><Icon className="h-4 w-4 text-slate-400" /></div>
            <div className="mb-1 font-semibold text-white">{title}</div>
            <p className="text-sm text-slate-400">{text}</p>
          </li>
        ))}
      </ol>
      <h2 className="mb-4 mt-12 text-xl font-bold text-white">Built for enterprise trust</h2>
      <div className="grid gap-3 sm:grid-cols-3">
        {TRUST.map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <Icon className="mb-2 h-5 w-5 text-emerald-400" />
            <div className="mb-1 font-semibold text-white">{title}</div>
            <p className="text-sm text-slate-400">{text}</p>
          </div>
        ))}
      </div>
      <NextLinks />
    </Page>
  );
}

// ---------- User flow ----------
type Step = { icon: LucideIcon; title: string; text: string };
const FLOWS: Record<'employee' | 'hr', { label: string; who: string; icon: LucideIcon; image: string; alt: string; steps: Step[] }> = {
  employee: {
    label: 'Employee experience', who: 'Tyson · Senior Software Engineer · 8 agents', icon: Users,
    image: '/solution/employee-use-cases.jpg', alt: 'Gemini-Powered Employee Experience: key use cases',
    steps: [
      { icon: KeyRound, title: 'Sign in', text: 'Email and password; lands on a personal overview.' },
      { icon: LayoutDashboard, title: 'My overview', text: 'Leave, pay, attendance, tasks and holidays at a glance.' },
      { icon: Bell, title: 'Notifications', text: 'Payslip ready, tasks due, request updates.' },
      { icon: MessageSquare, title: 'Ask an agent', text: '“Why was my pay higher two months ago?”' },
      { icon: Ticket, title: 'Raise a request', text: 'A parking permit is logged as a Jira issue.' },
      { icon: CheckCircle2, title: 'Track it', text: 'Live Jira status in chat, dashboard and alerts.' },
    ],
  },
  hr: {
    label: 'HR operations', who: 'Tessa · HR Analyst · 10 agents', icon: Building2,
    image: '/solution/hr-operations-use-cases.jpg', alt: 'Gemini-Powered HR Operations: key use cases',
    steps: [
      { icon: KeyRound, title: 'Sign in with M365', text: 'Entra ID token verified on the server.' },
      { icon: LayoutDashboard, title: 'Operations overview', text: 'Live SAP KPIs, risks and stalled workflows.' },
      { icon: Filter, title: 'Drill down', text: 'Filter by division and period with one click.' },
      { icon: Sparkles, title: 'Ask copilots', text: 'Answers with tables; next steps run with a click.' },
      { icon: Cloud, title: 'Review documents', text: 'OneDrive files analysed by Gemini.' },
      { icon: FileBarChart, title: 'Report and share', text: 'PDF, PowerPoint, Outlook draft, Teams.' },
    ],
  },
};

export function UserFlowPage() {
  const [tab, setTab] = useState<'employee' | 'hr'>('employee');
  const f = FLOWS[tab];
  return (
    <Page>
      <PageHeader eyebrow="User flow" title="Two journeys, one platform" intro="Employees get self-service answers and actions; HR operations get copilots across workforce, payroll, compliance and recruiting. Both start on a live dashboard and hand off to the right agent." />
      <div className="mb-6 inline-flex rounded-xl border border-white/10 bg-slate-900 p-1" role="tablist" aria-label="Persona">
        {(Object.keys(FLOWS) as (keyof typeof FLOWS)[]).map((k) => {
          const Icon = FLOWS[k].icon;
          return (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold transition ${tab === k ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'}`}>
              <Icon className="h-4 w-4" />{FLOWS[k].label}
            </button>
          );
        })}
      </div>
      <Figure src={f.image} alt={f.alt} caption={`${f.alt} · from the NTT DATA solution pack`} />
      <h2 className="mb-1 mt-10 text-xl font-bold text-white">Journey in the app</h2>
      <p className="mb-4 text-sm text-slate-500">{f.who}</p>
      <ol className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {f.steps.map(({ icon: StepIcon, title, text }, i) => (
          <li key={title} className="relative rounded-xl border border-white/[0.06] bg-slate-900/70 p-3">
            <div className="mb-2 flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md bg-blue-500/15 text-[11px] font-bold text-blue-300">{i + 1}</span>
              <StepIcon className="h-4 w-4 text-slate-400" />
            </div>
            <div className="text-sm font-semibold text-white">{title}</div>
            <p className="mt-0.5 text-xs leading-relaxed text-slate-400">{text}</p>
            {i < f.steps.length - 1 && <ChevronRight className="absolute -right-2.5 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-slate-600 lg:block" aria-hidden="true" />}
          </li>
        ))}
      </ol>
      <NextLinks />
    </Page>
  );
}

// ---------- Architecture ----------
const LAYERS: { icon: LucideIcon; title: string; items: string[] }[] = [
  { icon: Users, title: 'Users', items: ['Employees (e.g. Tyson) with 8 employee AI agents', 'HR analysts (e.g. Tessa) with 10 HR operations agents'] },
  { icon: Server, title: 'Application layer', items: ['Cloud Run: HR employee portal (frontend and API)'] },
  { icon: Bot, title: 'AI and agentic layer', items: ['Agent orchestration (Google ADK): intent routing, multi-agent workflow, tool and API invocation, policy and guardrails', 'Gemini 3.5: language understanding, reasoning and planning, enterprise data grounding (RAG), tool use and action execution'] },
  { icon: Database, title: 'Data and knowledge layer', items: ['Firestore: user login and session management', 'Vector Store (Vertex AI): embeddings and knowledge index', 'Vertex AI Search: enterprise search (RAG)', 'Cloud Storage: documents, policies, training and HR content', 'Secret Manager: API keys, credentials and sensitive secrets'] },
  { icon: GitBranch, title: 'Platform and operations', items: ['Git → CI/CD (Cloud Build) → deploy to Cloud Run', 'Cloud Logging (logs, audit, trace) and Cloud Monitoring (health, metrics, alerts)'] },
  { icon: Building2, title: 'Enterprise systems', items: ['Workday: employee records, leave and attendance, payroll, performance, benefits', 'SAP: employee and org data, cost center and finance, time and attendance', 'Secure API integration (REST / SOAP)'] },
];
const DEMO_MAP: [string, string][] = [
  ['Cloud Run portal', 'React web app and Node API server (runs locally; deployable to Cloud Run)'],
  ['Agent orchestration (ADK)', 'Server agent runtime: 18 agents with role checks, tools and house style'],
  ['Gemini 3.5', 'Gemini 3.5 Flash with function calling'],
  ['Workday and SAP', 'SAP SuccessFactors API sandbox live; Workday connector written, awaiting a tenant'],
  ['Firestore sessions', 'In-memory sessions with Microsoft 365 (Entra ID) sign-in'],
  ['Cloud Storage and Vertex AI Search', 'OneDrive documents analysed by Gemini; HR policies from the built-in store'],
];

export function ArchitecturePage() {
  return (
    <Page>
      <PageHeader eyebrow="Architecture" title="Gemini-Powered Employee Experience Platform" intro="AI-driven HR support for every employee on Google Cloud, integrated with Workday and SAP through secure APIs." />
      <Figure src="/solution/architecture.jpg" alt="NTT DATA Gemini HR Platform architecture on Google Cloud" caption="NTT DATA Gemini HR Platform architecture · from the NTT DATA solution pack" />
      <h2 className="mb-4 mt-10 text-xl font-bold text-white">Layers</h2>
      <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
        {LAYERS.map(({ icon: Icon, title, items }) => (
          <div key={title} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <div className="mb-2 flex items-center gap-2 font-semibold text-white"><Icon className="h-4 w-4 text-cyan-300" />{title}</div>
            <ul className="list-disc space-y-1 pl-5 text-sm text-slate-400 marker:text-blue-400">{items.map((i) => <li key={i}>{i}</li>)}</ul>
          </div>
        ))}
      </div>
      <h2 className="mb-1 mt-10 text-xl font-bold text-white">In this demo</h2>
      <p className="mb-4 text-sm text-slate-500">How each part of the target architecture is represented in the running demo.</p>
      <div className="overflow-x-auto rounded-2xl border border-white/10">
        <table className="w-full text-sm">
          <thead><tr className="bg-white/[0.05] text-left text-xs uppercase tracking-wide text-slate-400"><th className="px-4 py-2.5">Target architecture</th><th className="px-4 py-2.5">Demo implementation</th></tr></thead>
          <tbody>{DEMO_MAP.map(([a, b]) => <tr key={a} className="border-t border-white/[0.06]"><td className="px-4 py-2.5 font-medium text-slate-200">{a}</td><td className="px-4 py-2.5 text-slate-400">{b}</td></tr>)}</tbody>
        </table>
      </div>
      <NextLinks />
    </Page>
  );
}

// ---------- Agents ----------
export function AgentsPage({ agents }: { agents: Agent[] }) {
  const groups = [
    { title: 'Employee self-service', who: 'Tyson Reed, Senior Software Engineer · 8 agents', list: agents.filter((a) => a.role === 'employee'), accent: 'text-blue-300' },
    { title: 'HR operations', who: 'Tessa, HR Analyst · signs in with Microsoft 365 · 10 agents', list: agents.filter((a) => a.role === 'hr'), accent: 'text-emerald-300' },
  ];
  return (
    <Page>
      <PageHeader eyebrow="Agents" title="Eighteen agents, each with one job" intro="Employees get a personal HR overview and eight self-service agents. HR analysts get an operations dashboard and ten copilots, most of them reading SAP SuccessFactors live." />
      <div className="grid gap-5 lg:grid-cols-2">
        {groups.map(({ title, who, list, accent }) => (
          <div key={title} className="rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5">
            <h2 className={`text-lg font-bold ${accent}`}>{title}</h2>
            <p className="mb-4 text-sm text-slate-500">{who}</p>
            <div className="space-y-2">
              {list.map((a) => (
                <div key={a.id} className="flex items-start gap-3 rounded-xl bg-slate-900/60 px-3 py-2.5">
                  <AgentIcon name={a.icon} className="mt-0.5 h-4 w-4 flex-shrink-0 text-slate-400" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2"><span className="text-sm font-semibold text-white">{a.name}</span>{a.sources.includes('SAP SuccessFactors') && <SapBadge />}{a.sources.includes('Jira') && <JiraBadge />}</div>
                    <p className="text-xs text-slate-400">{a.description}</p>
                  </div>
                </div>
              ))}
              {!list.length && <p className="text-sm text-slate-500">Loading agents…</p>}
            </div>
          </div>
        ))}
      </div>
      <NextLinks />
    </Page>
  );
}

// ---------- Shared: navigation between pages ----------
export const PAGES = [
  { path: '/how-it-works', label: 'How it works', text: 'Sign-in by role, dashboards, grounded answers.' },
  { path: '/user-flow', label: 'User flow', text: 'Employee and HR operations journeys and use cases.' },
  { path: '/architecture', label: 'Architecture', text: 'The Gemini HR platform on Google Cloud.' },
  { path: '/agents', label: 'Agents', text: 'All 18 agents and the systems they use.' },
] as const;

function NextLinks() {
  const here = window.location.pathname;
  return (
    <div className="mt-14 grid gap-3 border-t border-white/[0.06] pt-8 sm:grid-cols-3">
      {PAGES.filter((p) => p.path !== here).slice(0, 3).map((p) => (
        <a key={p.path} href={p.path} onClick={onLink(p.path)} className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4 transition hover:border-blue-500/40">
          <div className="flex items-center justify-between font-semibold text-white">{p.label}<ChevronRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-blue-300" /></div>
          <p className="mt-1 text-xs text-slate-400">{p.text}</p>
        </a>
      ))}
    </div>
  );
}
