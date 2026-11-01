import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { Bell, ChevronDown, ChevronLeft, Cloud, Home, Loader2, LogOut, MessageCircle, Moon, RefreshCw, RotateCcw, Send, Sun } from 'lucide-react';
import { api, type Agent, type EmployeeDash, type HrDash, type HrFilters, type Notice, type Status, type TraceItem, type User } from '../lib/api';
import { usePrefs, useT } from '../lib/i18n';
import { ReportModal } from './ReportModal';
import { AgentIcon, JiraBadge, SapBadge } from './AgentIcon';
import { Brand } from './Brand';
import { AgentOverview, EmployeeDashboard, HrDashboard, SEVERITY } from './Dashboard';
import { Markdown } from './Markdown';
import { DocumentsView } from './DocumentsView';
import { graphToken, takeAfterRedirect } from '../lib/msal';

interface Message { role: 'user' | 'model'; text: string; trace?: TraceItem[]; pending?: boolean }
interface Props { user: User; agents: Agent[]; status: Status; onSignOut: () => void }

const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const SAP = 'SAP SuccessFactors';
// View key for the OneDrive page; distinct from agent ids (the employee Document Assistant is 'documents').
const DOCS = 'onedrive';
// "get_leave_balance" -> "Leave balance", "sap_workforce_summary" -> "Workforce summary"
const toolLabel = (t: string) => { const s = t.replace(/^(get|sap|search|list)_/, '').replace(/_/g, ' '); return s[0].toUpperCase() + s.slice(1); };
const isSap = (a: Agent) => a.sources.includes(SAP);
const isJira = (a: Agent) => a.sources.includes('Jira');
const usesOneDrive = (a: Agent) => a.sources.includes('OneDrive');

function Trace({ items }: { items: TraceItem[] }) {
  if (!items.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-1.5 border-t border-white/5 pt-2.5">
      {items.map((t, i) => {
        const sap = t.source === SAP;
        const jira = t.source === 'Jira';
        const drive = t.source === 'OneDrive';
        return (
          <span key={i} title={JSON.stringify(t.args)}
            className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${!t.ok ? 'border-red-500/30 bg-red-500/10 text-red-300' : sap ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-300' : jira || drive ? 'border-sky-500/30 bg-sky-500/10 text-sky-300' : 'border-blue-500/20 bg-blue-500/10 text-blue-200'}`}>
            {sap ? 'SAP · ' : jira ? 'Jira · ' : drive ? 'OneDrive · ' : ''}{toolLabel(t.tool)} · {t.ms < 1000 ? `${t.ms}ms` : `${(t.ms / 1000).toFixed(1)}s`}{t.ok ? '' : ' · failed'}
          </span>
        );
      })}
    </div>
  );
}

function Notifications({ items, onOpen, teams }: { items: Notice[]; onOpen: (n: Notice) => void; teams?: { enabled: boolean; subtitle: string } }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const toTeams = async () => {
    setSent('Sending…');
    try { const r = await api.teamsNotify('NTT DATA HRMS · HR notifications', teams!.subtitle, items); setSent(`Sent ${r.sent} notifications to Teams.`); }
    catch (e) { setSent(e instanceof Error ? e.message : 'Could not send to Teams.'); }
  };
  const urgent = items.filter((n) => n.severity === 'critical' || n.severity === 'serious').length;
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-label={`Notifications (${items.length})`}
        className="relative rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-300 transition hover:bg-white/10 hover:text-white">
        <Bell className="h-4 w-4" />
        {items.length > 0 && <span className={`absolute -right-1.5 -top-1.5 grid h-5 min-w-5 place-items-center rounded-full px-1 text-[10px] font-bold text-white ${urgent ? 'bg-red-600' : 'bg-blue-600'}`}>{items.length}</span>}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-40 mt-2 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/60">
            <div className="flex items-center justify-between border-b border-white/5 px-4 py-3">
              <span className="text-sm font-semibold text-white">{t('Notifications')}</span>
              <span className="text-[11px] text-slate-500">{urgent ? `${urgent} ${t('urgent')}` : t('All caught up on urgent items')}</span>
            </div>
            <div className="max-h-[60vh] overflow-y-auto p-1.5">
              {items.map((n, i) => {
                const s = SEVERITY[n.severity];
                const Icon = s.icon;
                return (
                  <button key={i} onClick={() => { setOpen(false); onOpen(n); }} className="flex w-full gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/[0.05]">
                    <Icon className="mt-0.5 h-4 w-4 flex-shrink-0" style={{ color: s.color }} />
                    <span className="min-w-0">
                      <span className="block text-xs font-medium text-slate-100">{n.title}</span>
                      <span className="block truncate text-[11px] text-slate-500">{s.label} · {n.detail}</span>
                    </span>
                  </button>
                );
              })}
              {!items.length && <p className="px-3 py-6 text-center text-xs text-slate-500">{t('No notifications.')}</p>}
            </div>
            {teams && items.length > 0 && (
              <div className="border-t border-white/5 px-3 py-2.5">
                <button onClick={toTeams} disabled={!teams.enabled} title={teams.enabled ? '' : 'Add TEAMS_WEBHOOK_URL to .env to enable'}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#5b5fc7] px-3 py-2 text-xs font-semibold text-white hover:bg-[#4f52b2] disabled:cursor-not-allowed disabled:opacity-40">
                  <Send className="h-3.5 w-3.5" />{t('Send to Teams')}
                </button>
                {(sent || !teams.enabled) && <p className="mt-1.5 text-center text-[11px] text-slate-500">{sent ?? 'Teams is not configured (TEAMS_WEBHOOK_URL).'}</p>}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-36 rounded-2xl bg-white/[0.04]" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">{[0, 1, 2, 3].map((i) => <div key={i} className="h-24 rounded-2xl bg-white/[0.04]" />)}</div>
      <div className="grid gap-4 lg:grid-cols-3">{[0, 1, 2].map((i) => <div key={i} className="h-64 rounded-2xl bg-white/[0.04]" />)}</div>
    </div>
  );
}

// Glowing picker in the top bar that switches between Home, Documents and every agent.
function AgentPicker({ agents, view, hr, onGo }: { agents: Agent[]; view: string; hr: boolean; onGo: (v: string) => void }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const current = agents.find((a) => a.id === view);
  const pick = (v: string) => { setOpen(false); onGo(v); };
  const item = (active: boolean) => `flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition ${active ? 'bg-blue-500/15 text-white ring-1 ring-blue-500/40' : 'text-slate-300 hover:bg-white/[0.06]'}`;
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        className="agent-glow flex max-w-[44vw] sm:max-w-[340px] items-center gap-2.5 rounded-2xl border-2 border-blue-500/70 bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:border-blue-400">
        <span className="relative flex h-2.5 w-2.5 flex-shrink-0"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-400 opacity-50" /><span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-blue-400" /></span>
        {current ? <AgentIcon name={current.icon} className="h-4 w-4 flex-shrink-0 text-blue-300" /> : view === DOCS ? <Cloud className="h-4 w-4 flex-shrink-0 text-sky-300" /> : <Home className="h-4 w-4 flex-shrink-0 text-blue-300" />}
        <span className="truncate">{current ? current.name : view === DOCS ? t('Documents · OneDrive') : 'Home overview'}</span>
        <ChevronDown className={`h-4 w-4 flex-shrink-0 text-blue-300 transition ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-30" onClick={() => setOpen(false)} />
          <div role="listbox" className="absolute right-0 z-40 mt-2 max-h-[75vh] w-[min(92vw,360px)] overflow-y-auto rounded-2xl border border-blue-500/30 bg-slate-900 p-1.5 shadow-2xl shadow-black/60">
            <button onClick={() => pick('dashboard')} className={item(view === 'dashboard')}><Home className="h-4 w-4 text-slate-400" />Home overview</button>
            {hr && <button onClick={() => pick(DOCS)} className={item(view === DOCS)}><Cloud className="h-4 w-4 text-sky-300" />{t('Documents · OneDrive')}</button>}
            <div className="px-3 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-widest text-slate-500">{t(hr ? 'HR operations agents' : 'My HR agents')}</div>
            {agents.map((a, n) => (
              <button key={a.id} onClick={() => pick(a.id)} className={item(a.id === view)}>
                <AgentIcon name={a.icon} className="h-4 w-4 flex-shrink-0 text-slate-400" />
                <span className="flex-1 truncate">{n + 1}. {a.name}</span>
                {isSap(a) && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" title="Live SAP SuccessFactors data" />}
                {isJira(a) && <span className="h-1.5 w-1.5 flex-shrink-0 rounded-full bg-sky-400" title="Requests tracked in Jira" />}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export function Workspace({ user, agents, status, onSignOut }: Props) {
  const [after] = useState(() => takeAfterRedirect());
  const [view, setView] = useState<string>(after === 'documents' ? DOCS : 'dashboard');
  const [reportOpen, setReportOpen] = useState(after === 'report');
  const [filters, setFilters] = useState<HrFilters>({ division: null, years: 5 });
  const { lang, theme, setTheme } = usePrefs();
  const t = useT();
  const [chats, setChats] = useState<Record<string, Message[]>>({});
  const [dash, setDash] = useState<EmployeeDash | HrDash | null>(null);
  const [dashError, setDashError] = useState<string | null>(null);
  const [loadingDash, setLoadingDash] = useState(true);
  const [input, setInput] = useState('');
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const logRef = useRef<HTMLDivElement>(null);
  const chatRef = useRef<HTMLElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hr = user.role === 'hr';
  const current = agents.find((a) => a.id === view) ?? null;
  const messages = current ? chats[current.id] ?? [] : [];
  const busy = messages.some((m) => m.pending);

  const loadDashboard = useCallback(async () => {
    setLoadingDash(true);
    setDashError(null);
    try { setDash(await api.dashboard(user.role === 'hr' ? filters : undefined)); setUpdatedAt(new Date()); }
    catch (e) { setDashError(e instanceof Error ? e.message : 'Could not load the dashboard.'); }
    finally { setLoadingDash(false); }
  }, [user.role, filters]);
  useEffect(() => { loadDashboard(); }, [loadDashboard]);

  // Keep Home and agent overviews live: refresh every minute and whenever the tab comes back into view.
  useEffect(() => {
    const id = window.setInterval(() => { if (document.visibilityState === 'visible') loadDashboard(); }, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') loadDashboard(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { window.clearInterval(id); document.removeEventListener('visibilitychange', onVisible); };
  }, [loadDashboard]);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: 'smooth' }); }, [messages.length, view]);

  const send = async (agentId: string, text: string) => {
    text = text.trim();
    if (!text || (chats[agentId] ?? []).some((m) => m.pending)) return;
    const history = (chats[agentId] ?? []).map(({ role, text: t }) => ({ role, text: t }));
    setChats((c) => ({ ...c, [agentId]: [...(c[agentId] ?? []), { role: 'user', text }, { role: 'model', text: '', pending: true }] }));
    setInput('');
    let reply: Message;
    try {
      // Agents that read OneDrive get the user's delegated Graph token for this request only.
      const agent = agents.find((a) => a.id === agentId);
      const graph = agent && usesOneDrive(agent) && user.authMethod === 'Microsoft 365' ? await graphToken().catch(() => null) : null;
      const r = await api.chat(agentId, text, history, graph, lang);
      reply = { role: 'model', text: r.reply, trace: r.trace };
      if (r.changed) loadDashboard(); // an agent changed data: update Home, overviews and notifications now
    } catch (e) {
      reply = { role: 'model', text: `Something went wrong: ${e instanceof Error ? e.message : 'unknown error'}` };
    }
    setChats((c) => ({ ...c, [agentId]: [...(c[agentId] ?? []).filter((m) => !m.pending), reply] }));
  };

  // Questions from widgets, notifications and next steps open the agent and answer in its docked chat.
  const ask = (agentId: string, prompt: string) => { setView(agentId); send(agentId, prompt); };
  // On narrow screens the chat sits below the overview, so bring it into view before focusing.
  const focusChat = () => { chatRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); inputRef.current?.focus(); };
  const submit = (e: FormEvent) => { e.preventDefault(); if (current) send(current.id, input); };
  const go = (v: string) => setView(v);

  return (
    <div className="flex h-screen overflow-hidden bg-slate-950 text-slate-200">
      {reportOpen && hr && <ReportModal filters={filters} user={user} onClose={() => setReportOpen(false)} />}
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="relative z-20 flex items-center gap-2 border-b border-white/[0.06] bg-slate-900/60 px-4 py-3 backdrop-blur sm:px-6">
          <div className="hidden flex-shrink-0 sm:block"><Brand compact /></div>
          <div className="hidden min-w-0 border-l border-white/10 pl-3 xl:block">
            <h1 className="truncate text-sm font-bold text-white">{hr ? 'HR Operations AI' : 'Employee Self-Service AI'}</h1>
            <p className="flex items-center gap-1.5 truncate text-[11px] text-slate-500"><span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{status.services.join(' · ')}</p>
          </div>
          <div className="flex-1" />
          <span className="hidden text-xs font-medium text-slate-400 md:inline">Agent</span>
          <AgentPicker agents={agents} view={view} hr={hr} onGo={go} />
          {(view === 'dashboard' || current) && (
            <>
              {updatedAt && (
                <span className="hidden items-center gap-1.5 whitespace-nowrap text-[11px] text-slate-500 xl:flex" title="Refreshes every minute, when you return to this tab, and after any agent action">
                  <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" /></span>
                  Live · updated {updatedAt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
              <button onClick={loadDashboard} disabled={loadingDash} className="hidden rounded-xl sm:block border border-white/10 bg-white/[0.04] p-2 text-slate-300 hover:bg-white/10 disabled:opacity-50" aria-label={t('Refresh dashboard')}>
                <RefreshCw className={`h-4 w-4 ${loadingDash ? 'animate-spin' : ''}`} />
              </button>
            </>
          )}
          <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label={t(theme === 'dark' ? 'Light theme' : 'Dark theme')} title={t(theme === 'dark' ? 'Light theme' : 'Dark theme')}>
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <Notifications items={dash?.notifications ?? []} onOpen={(n) => ask(n.agent, n.prompt)} teams={hr ? { enabled: status.teams, subtitle: dash?.role === 'hr' ? `${dash.filters.label} · ${new Date().toLocaleDateString('en-GB', { dateStyle: 'medium' })}` : '' } : undefined} />
          <div className="hidden items-center gap-2.5 border-l border-white/10 pl-3 sm:flex">
            <div className={`grid h-9 w-9 place-items-center rounded-full text-sm font-bold text-white ${hr ? 'bg-gradient-to-br from-emerald-500 to-teal-600' : 'bg-gradient-to-br from-blue-500 to-indigo-600'}`}>{initials(user.name)}</div>
            <div className="hidden leading-tight xl:block">
              <div className="max-w-[160px] truncate text-xs font-semibold text-white">{user.name}</div>
              <div className="text-[10px] text-slate-500">{user.title} · {user.authMethod}</div>
            </div>
          </div>
          <button onClick={onSignOut} className="rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label={t('Sign out')} title={t('Sign out')}><LogOut className="h-4 w-4" /></button>
        </header>

        {/* Home and Documents fill the page; an agent shows its overview with the chat docked beside it. */}
        <div className={`flex min-h-0 flex-1 flex-col lg:flex-row lg:overflow-hidden ${current ? 'overflow-y-auto' : ''}`}>
          <div className={`px-4 py-5 sm:px-6 lg:min-h-0 lg:min-w-0 lg:flex-1 lg:overflow-y-auto ${current ? 'flex-shrink-0' : 'min-h-0 flex-1 overflow-y-auto'}`}>
            <div className="mx-auto max-w-7xl">
              {dashError && <div className="mb-4 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300">{dashError}</div>}
              {view === DOCS ? <DocumentsView user={user} onAsk={ask} />
                : loadingDash && !dash ? <DashboardSkeleton />
                  : current && dash ? (dash.role === 'hr'
                    ? <AgentOverview role="hr" agent={current} d={dash} filters={filters} onFilter={setFilters} onReport={() => setReportOpen(true)} onDocuments={() => go(DOCS)} onAsk={ask} onChat={focusChat} />
                    : <AgentOverview role="employee" agent={current} d={dash} onAsk={ask} onChat={focusChat} />)
                    : dash?.role === 'hr' ? <HrDashboard d={dash} user={user} filters={filters} onFilter={setFilters} onReport={() => setReportOpen(true)} onDocuments={() => go(DOCS)} onAsk={ask} />
                      : dash ? <EmployeeDashboard d={dash} onAsk={ask} /> : null}
            </div>
          </div>

          {current && (
            <div className="flex-shrink-0 px-4 pb-5 sm:px-6 lg:w-[380px] lg:py-5 lg:pl-0 xl:w-[440px] 2xl:w-[520px]">
            <section ref={chatRef} aria-label={`Chat with ${current.name}`}
              className="agent-glow relative flex h-[75vh] flex-col overflow-hidden rounded-3xl border border-blue-500/40 bg-slate-900 lg:h-full">
              <div className="h-1 flex-shrink-0 bg-gradient-to-r from-blue-500 via-cyan-400 to-indigo-500" />
              <div className="flex items-center gap-3 border-b border-white/[0.06] px-4 py-3.5">
                <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 shadow-lg shadow-blue-600/30"><AgentIcon name={current.icon} className="h-5 w-5 text-white" /></div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-bold text-white">{current.name}</div>
                  <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400" />
                    {isSap(current) ? 'Connected to SAP SuccessFactors' : isJira(current) ? 'Connected to HR records and Jira' : 'Grounded in your HR records'}
                    {isSap(current) && <SapBadge />}{isJira(current) && <JiraBadge />}
                  </div>
                </div>
                <button onClick={() => go('dashboard')} className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label="Back to Home" title="Back to Home"><ChevronLeft className="h-4 w-4" /></button>
                <button onClick={() => setChats((c) => ({ ...c, [current.id]: [] }))} disabled={busy || !messages.length} className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-300 hover:bg-white/10 hover:text-white disabled:opacity-40" aria-label="New conversation" title="New conversation"><RotateCcw className="h-4 w-4" /></button>
              </div>
              <div ref={logRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-4"
                onClick={(e) => {
                  // "Next steps" buttons rendered by Markdown carry the request to send in data-step.
                  const step = (e.target as HTMLElement).closest<HTMLElement>('[data-step]')?.dataset.step;
                  if (step && !busy) send(current.id, step);
                }}>
                <div className="flex flex-col gap-3">
                  {!messages.length && (
                    <div className="pt-4 text-center">
                      <div className="mx-auto mb-3 grid h-14 w-14 place-items-center rounded-2xl bg-blue-500/10 ring-1 ring-blue-500/30"><MessageCircle className="h-6 w-6 text-blue-300" /></div>
                      <h2 className="mb-1 text-lg font-bold text-white">Ask me anything</h2>
                      <p className="mx-auto max-w-sm text-sm text-slate-400">{current.description}</p>
                      <div className="mt-5 flex flex-col gap-2 text-left">
                        {current.prompts.map((p) => (
                          <button key={p} onClick={() => send(current.id, p)} disabled={busy}
                            className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3 text-left text-sm text-slate-200 transition hover:border-blue-500/60 hover:bg-blue-500/10 disabled:opacity-50">{p}</button>
                        ))}
                      </div>
                    </div>
                  )}
                  {messages.map((m, i) => m.role === 'user' ? (
                    <div key={i} className="max-w-[88%] self-end rounded-2xl rounded-br-md bg-blue-600 px-3.5 py-2 text-sm text-white">{m.text}</div>
                  ) : (
                    <div key={i} className="max-w-full rounded-2xl rounded-bl-md border border-white/[0.07] bg-slate-900 px-3.5 py-3 text-sm">
                      {m.pending ? (
                        <div className="flex items-center gap-2 text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> {isSap(current) ? 'Querying SAP SuccessFactors and thinking…' : 'Checking your HR records…'}</div>
                      ) : (<><Markdown text={m.text} /><Trace items={m.trace ?? []} /></>)}
                    </div>
                  ))}
                </div>
              </div>
              <div className="px-4 pb-3 pt-2">
                <form onSubmit={submit} className="flex items-center gap-2 rounded-2xl border border-white/10 bg-slate-950 p-1.5 pl-4 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/20">
                  <input ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} placeholder={`Message the ${current.name}…`} aria-label="Message"
                    className="min-w-0 flex-1 bg-transparent py-2 text-sm text-white outline-none placeholder:text-slate-500" />
                  <button type="submit" disabled={busy || !input.trim()} className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-600/30 hover:brightness-110 disabled:opacity-50" aria-label="Send">
                    <Send className="h-4 w-4" />
                  </button>
                </form>
                <p className="mt-2 text-center text-[11px] text-slate-500">AI can make mistakes; check important details with HR.</p>
              </div>
            </section>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
