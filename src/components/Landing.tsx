import { useState, type FormEvent } from 'react';
import { ArrowRight, Building2, ChevronRight, Loader2, Lock, Mail, Moon, Sparkles, Sun, Users } from 'lucide-react';
import type { Agent, Status } from '../lib/api';
import { usePrefs, useT } from '../lib/i18n';
import { navigate, onLink, usePath } from '../lib/router';
import { Brand } from './Brand';
import { AgentsPage, ArchitecturePage, HowItWorksPage, PAGES, UserFlowPage } from './PublicPages';

interface Props {
  agents: Agent[];
  status: Status | null;
  busy: 'm365' | 'employee' | 'demo' | null;
  error: string | null;
  onM365: () => void;
  onDemoHr: () => void;
  onEmployeeLogin: (email: string, password: string) => void;
}

const MicrosoftLogo = () => (
  <svg width="18" height="18" viewBox="0 0 21 21" aria-hidden="true">
    <rect x="1" y="1" width="9" height="9" fill="#f25022" /><rect x="11" y="1" width="9" height="9" fill="#7fba00" />
    <rect x="1" y="11" width="9" height="9" fill="#00a4ef" /><rect x="11" y="11" width="9" height="9" fill="#ffb900" />
  </svg>
);

// Public site: a shared header and footer around separate pages (home with sign-in, how it works, user flow, architecture, agents).
export function Landing(props: Props) {
  const { status } = props;
  const { theme, setTheme } = usePrefs();
  const t = useT();
  const path = usePath();
  const page = PAGES.find((p) => p.path === path);
  const goSignIn = () => {
    if (path !== '/') navigate('/');
    setTimeout(() => document.getElementById('signin')?.scrollIntoView({ behavior: 'smooth' }), 50);
  };

  return (
    <div className="relative flex min-h-screen flex-col overflow-x-clip bg-slate-950 text-slate-200">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-[140px]" />
      <div className="pointer-events-none absolute top-[38%] -right-40 h-[480px] w-[480px] rounded-full bg-emerald-500/10 blur-[120px]" />

      <header className="sticky top-0 z-30 border-b border-white/[0.06] bg-slate-950/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 py-3.5 sm:px-6">
          <a href="/" onClick={onLink('/')} aria-label="NTT DATA HRMS home"><Brand /></a>
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Pages">
            {PAGES.map((p) => (
              <a key={p.path} href={p.path} onClick={onLink(p.path)} aria-current={path === p.path ? 'page' : undefined}
                className={`rounded-lg px-3 py-1.5 text-sm transition ${path === p.path ? 'bg-white/10 font-semibold text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`}>{p.label}</a>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 text-xs text-slate-400 xl:flex">
              <span className={`h-1.5 w-1.5 rounded-full ${status?.sap.includes('connected') ? 'bg-emerald-400' : 'bg-amber-400'}`} />
              {status ? status.services.join(' · ') : 'Checking services…'}
            </div>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label={t(theme === 'dark' ? 'Light theme' : 'Dark theme')}>
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <button onClick={goSignIn} className="rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-blue-500">{t('Sign in')}</button>
          </div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-4 pb-2.5 lg:hidden" aria-label="Pages">
          {PAGES.map((p) => (
            <a key={p.path} href={p.path} onClick={onLink(p.path)} aria-current={path === p.path ? 'page' : undefined}
              className={`flex-shrink-0 rounded-lg border px-3 py-1 text-xs ${path === p.path ? 'border-blue-500/50 bg-blue-500/10 text-white' : 'border-white/10 text-slate-300 hover:text-white'}`}>{p.label}</a>
          ))}
        </nav>
      </header>

      <div className="flex-1">
        {page?.path === '/how-it-works' ? <HowItWorksPage />
          : page?.path === '/user-flow' ? <UserFlowPage />
            : page?.path === '/architecture' ? <ArchitecturePage />
              : page?.path === '/agents' ? <AgentsPage agents={props.agents} />
                : <Home {...props} />}
      </div>

      <footer className="relative z-10 border-t border-white/5 px-4 py-6 text-center text-xs text-slate-600">
        NTT DATA HRMS · Powered by Gemini · HR operations data from the SAP SuccessFactors API sandbox.
      </footer>
    </div>
  );
}

function Home({ status, busy, error, onM365, onDemoHr, onEmployeeLogin }: Props) {
  const t = useT();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const submit = (e: FormEvent) => { e.preventDefault(); onEmployeeLogin(email, password); };

  return (
    <>
      <section className="relative z-10 mx-auto grid max-w-6xl gap-10 px-4 pb-10 pt-8 sm:px-6 lg:grid-cols-[1.15fr_1fr] lg:pt-14">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-blue-500/25 bg-blue-500/10 px-3.5 py-1.5 text-xs font-semibold text-cyan-300">
            <Sparkles className="h-3.5 w-3.5" /> Gemini · SAP SuccessFactors · Microsoft 365
          </div>
          <h1 className="mb-5 text-4xl font-black leading-[1.08] tracking-tight text-white sm:text-5xl">
            {t('HR that answers, acts')}
            <br />
            <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">{t('and keeps up with the work.')}</span>
          </h1>
          <p className="mb-4 max-w-xl text-lg text-slate-300">
            Live dashboards and eighteen Gemini agents on top of your HR system of record. Employees get instant self-service answers and a personal overview.
            HR operations teams get copilots that read SAP SuccessFactors, spot exceptions and draft the next step.
          </p>
          <p className="max-w-xl text-sm text-slate-500">
            Every answer is grounded in tool calls to HR systems and shows its sources, so nothing is guessed and every figure can be traced.
          </p>
          <div className="mt-8 grid max-w-xl grid-cols-3 gap-4">
            {[['18', 'AI agents'], ['2', 'live dashboards'], ['SAP', 'SuccessFactors data']].map(([v, l]) => (
              <div key={l}><div className="text-2xl font-black text-white">{v}</div><div className="text-xs uppercase tracking-wider text-slate-500">{l}</div></div>
            ))}
          </div>
        </div>

        <div id="signin" className="scroll-mt-28 space-y-4">
          {error && <div className="rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">{error}</div>}

          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 shadow-2xl shadow-black/40">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-emerald-300"><Building2 className="h-3.5 w-3.5" /> {t('HR operations')}</div>
            <h2 className="mb-4 text-lg font-bold text-white">{t('Sign in with your work account')}</h2>
            <button onClick={onM365} disabled={!!busy || status?.m365 === false}
              className="flex w-full items-center justify-center gap-3 rounded-xl bg-white px-6 py-3.5 font-bold text-slate-900 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60">
              {busy === 'm365' ? <Loader2 className="h-5 w-5 animate-spin" /> : <MicrosoftLogo />}
              {busy === 'm365' ? t('Connecting to Microsoft…') : t('Sign in with Microsoft 365')}
            </button>
            {status?.m365 === false && <p className="mt-2 text-xs text-amber-300">Microsoft 365 is not configured: set VITE_CLIENT_ID and VITE_TENANT_ID in .env.</p>}
            {status?.demoHr && (
              <button onClick={onDemoHr} disabled={!!busy} className="mt-3 w-full text-center text-xs text-slate-400 underline-offset-4 hover:text-white hover:underline">
                {busy === 'demo' ? 'Opening…' : 'No Microsoft account? Continue as Tessa (demo)'}
              </button>
            )}
          </div>

          <form onSubmit={submit} className="rounded-2xl border border-white/10 bg-white/[0.04] p-5" autoComplete="on">
            <div className="mb-1 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-blue-300"><Users className="h-3.5 w-3.5" /> {t('Employees and HR')}</div>
            <h2 className="mb-4 text-lg font-bold text-white">{t('Sign in with email')}</h2>
            <label htmlFor="email" className="mb-1.5 block text-xs font-semibold text-slate-400">{t('Email')}</label>
            <div className="relative mb-3">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="username"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 pl-10 pr-3 text-sm text-white outline-none placeholder:text-slate-600 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" placeholder="name@company.com" />
            </div>
            <label htmlFor="password" className="mb-1.5 block text-xs font-semibold text-slate-400">{t('Password')}</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password"
                className="w-full rounded-xl border border-slate-700 bg-slate-900 py-3 pl-10 pr-3 text-sm text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
            </div>
            <button type="submit" disabled={!!busy}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-6 py-3 font-bold text-white transition hover:bg-blue-500 disabled:opacity-60">
              {busy === 'employee' ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowRight className="h-4 w-4" />} {t('Sign in')}
            </button>
          </form>
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-6" aria-label="Explore">
        <h2 className="mb-4 text-xs font-semibold uppercase tracking-widest text-slate-500">Explore the solution</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PAGES.map((p) => (
            <a key={p.path} href={p.path} onClick={onLink(p.path)} className="group rounded-2xl border border-white/[0.07] bg-white/[0.03] p-5 transition hover:-translate-y-0.5 hover:border-blue-500/40">
              <div className="flex items-center justify-between font-semibold text-white">{p.label}<ChevronRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5 group-hover:text-blue-300" /></div>
              <p className="mt-1 text-sm text-slate-400">{p.text}</p>
            </a>
          ))}
        </div>
      </section>
    </>
  );
}
