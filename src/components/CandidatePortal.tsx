// Job portal for candidates: AI search that matches roles to the resume, and Gemini-assisted applications.
import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { BadgeCheck, Briefcase, Check, CheckCircle2, ChevronRight, FileText, Loader2, LogOut, MapPin, Moon, Search, Sparkles, Sun, X } from 'lucide-react';
import { api, type AppFields, type CandidateProfile, type JobMatch, type JobSearch, type PreparedApplication, type User } from '../lib/api';
import { usePrefs } from '../lib/i18n';
import { Brand } from './Brand';
import { CandidateInterviews } from './InterviewPipeline';

const SUGGESTIONS = ['cloud architect', 'presales', 'azure architect', 'aws architect', 'google cloud', 'multi cloud', 'data platform'];
const initials = (name: string) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();
const when = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const err = (e: unknown) => (e instanceof Error ? e.message : 'Something went wrong. Please try again.');

function MatchRing({ pct }: { pct: number }) {
  const color = pct >= 85 ? '#199e70' : pct >= 65 ? '#3987e5' : '#c98500';
  return (
    <div className="relative grid h-16 w-16 flex-shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${color} ${pct * 3.6}deg, rgba(148,163,184,0.18) 0)` }} role="img" aria-label={`${pct}% match`}>
      <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-900 text-center leading-none">
        <span className="text-sm font-black text-white">{pct}%</span>
        <span className="-mt-3 text-[8px] uppercase tracking-wider text-slate-500">match</span>
      </div>
    </div>
  );
}

function Chip({ children, tone = 'cyan' }: { children: ReactNode; tone?: 'cyan' | 'muted' | 'amber' }) {
  const cls = tone === 'cyan' ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200' : tone === 'amber' ? 'border-amber-400/30 bg-amber-400/10 text-amber-200' : 'border-white/10 bg-white/[0.04] text-slate-300';
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

function JobCard({ job, onApply }: { job: JobMatch; onApply: (j: JobMatch) => void }) {
  return (
    <article className="rounded-2xl border border-white/[0.08] bg-slate-900/70 p-4 shadow-lg shadow-black/20 transition hover:border-blue-500/40">
      <div className="flex gap-4">
        <MatchRing pct={job.matchPct} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className="text-base font-bold text-white">{job.title}</h3>
              <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-400">
                <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" />{job.dept}</span>
                <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{job.location}</span>
                <span>{job.type}</span><span>{job.minYears}+ years</span>
              </p>
            </div>
            {job.applied ? (
              <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-400/30 bg-emerald-400/10 px-3 py-1.5 text-xs font-semibold text-emerald-300"><CheckCircle2 className="h-3.5 w-3.5" />Applied</span>
            ) : (
              <button onClick={() => onApply(job)} className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-blue-600/25 hover:brightness-110">Apply with Gemini<ChevronRight className="h-3.5 w-3.5" /></button>
            )}
          </div>
          <p className="mt-2 text-sm text-slate-300">{job.desc}</p>
          <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-blue-500/10 px-2.5 py-1.5 text-xs text-blue-100"><Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0 text-cyan-300" />{job.reason}</p>
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {job.matched.map((s) => <Chip key={s}><Check className="mr-1 h-3 w-3" />{s}</Chip>)}
            {job.missing.map((s) => <Chip key={s} tone="amber">gap: {s}</Chip>)}
          </div>
        </div>
      </div>
    </article>
  );
}

// ---------- Application dialog: Gemini reads the resume, the candidate reviews, then submits ----------
const REQUIRED_LABEL: Record<string, string> = { fullName: 'Full name', email: 'Email', phone: 'Phone', location: 'Location', currentTitle: 'Current title', yearsExperience: 'Years of experience', skills: 'Skills', education: 'Education', noticePeriod: 'Notice period' };

function ApplyDialog({ job, onClose, onDone }: { job: JobMatch; onClose: () => void; onDone: (ref: string) => void }) {
  const [prep, setPrep] = useState<PreparedApplication | null>(null);
  const [f, setF] = useState<AppFields | null>(null);
  const [skillsText, setSkillsText] = useState('');
  const [certText, setCertText] = useState('');
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    api.candidate.prepare(job.id).then((p) => {
      if (!live) return;
      setPrep(p); setF({ ...p.fields, gender: 'Prefer not to say' });
      setSkillsText(p.fields.skills.join(', ')); setCertText(p.fields.certifications.join(', '));
    }).catch((e) => live && setError(err(e)));
    return () => { live = false; };
  }, [job.id]);

  const set = <K extends keyof AppFields>(k: K, v: AppFields[K]) => setF((x) => (x ? { ...x, [k]: v } : x));
  const filled = (k: string) => {
    if (!f) return false;
    if (k === 'skills') return skillsText.trim().length > 0;
    const v = (f as unknown as Record<string, unknown>)[k];
    return v !== undefined && v !== null && String(v).trim() !== '' && !(k === 'yearsExperience' && Number(v) <= 0);
  };
  const required = prep?.required ?? [];
  const missing = required.filter((k) => !filled(k));

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!f) return;
    setBusy(true); setError(null);
    try {
      const r = await api.candidate.apply(job.id, { ...f, skills: skillsText.split(/[,\n;]/).map((s) => s.trim()).filter(Boolean), certifications: certText.split(/[,\n;]/).map((s) => s.trim()).filter(Boolean) });
      setDone(r.reference); onDone(r.reference);
    } catch (x) { setError(err(x)); } finally { setBusy(false); }
  };

  const input = (k: keyof AppFields, label: string, props: { type?: string; wide?: boolean } = {}) => {
    const bad = prep && required.includes(k) && !filled(k);
    return (
      <label className={`block text-[11px] font-semibold text-slate-400 ${props.wide ? 'sm:col-span-2' : ''}`}>{label}{required.includes(k) && <span className="text-cyan-300"> *</span>}
        <input type={props.type ?? 'text'} value={String((f as unknown as Record<string, unknown>)[k] ?? '')} onChange={(e) => set(k, (props.type === 'number' ? Number(e.target.value) : e.target.value) as never)}
          className={`mt-1 w-full rounded-xl border bg-slate-950 px-3 py-2 text-sm font-normal text-white outline-none focus:ring-2 focus:ring-blue-500/20 ${bad ? 'border-amber-400/60' : 'border-white/10 focus:border-blue-500'}`} />
      </label>
    );
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-3 sm:p-6" role="dialog" aria-modal="true" aria-label={`Apply for ${job.title}`}>
      <div className="agent-glow flex max-h-[92vh] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-blue-500/40 bg-slate-900">
        <div className="flex items-start gap-3 border-b border-white/[0.06] px-5 py-4">
          <div className="grid h-11 w-11 flex-shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600"><FileText className="h-5 w-5 text-white" /></div>
          <div className="min-w-0 flex-1"><h2 className="text-base font-bold text-white">Apply: {job.title}</h2><p className="text-xs text-slate-400">{job.dept} · {job.location}</p></div>
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>

        {done ? (
          <div className="px-6 py-10 text-center">
            <div className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-full bg-emerald-400/15 ring-1 ring-emerald-400/40"><BadgeCheck className="h-8 w-8 text-emerald-300" /></div>
            <h3 className="text-xl font-black text-white">Application submitted</h3>
            <p className="mt-1 text-sm text-slate-300">Reference <span className="font-bold text-cyan-300">{done}</span> for {job.title}.</p>
            <ol className="mx-auto mt-5 max-w-sm space-y-2 text-left text-sm text-slate-300">
              <li className="flex gap-2"><span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-cyan-400 text-[11px] font-bold text-slate-900">1</span>Your application is scanned against the role requirements.</li>
              <li className="flex gap-2"><span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-cyan-400 text-[11px] font-bold text-slate-900">2</span>HR reviews the top-ranked shortlist for this role.</li>
              <li className="flex gap-2"><span className="grid h-5 w-5 flex-shrink-0 place-items-center rounded-full bg-cyan-400 text-[11px] font-bold text-slate-900">3</span>You are contacted if you move forward.</li>
            </ol>
            <button onClick={onClose} className="mt-6 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-blue-500">Back to jobs</button>
          </div>
        ) : !f ? (
          <div className="px-6 py-14 text-center">
            {error ? <p className="text-sm text-red-300">{error}</p> : (<>
              <Loader2 className="mx-auto mb-4 h-8 w-8 animate-spin text-cyan-300" />
              <p className="text-sm font-semibold text-white">Gemini is reading your resume…</p>
              <p className="mt-1 text-xs text-slate-400">Extracting the fields this application needs.</p>
            </>)}
          </div>
        ) : (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 py-4">
              <div className="flex flex-wrap items-center gap-2 rounded-xl border border-cyan-400/25 bg-cyan-400/10 px-3 py-2 text-xs text-cyan-100">
                <Sparkles className="h-4 w-4 flex-shrink-0 text-cyan-300" />
                <span className="font-semibold">{prep?.source === 'gemini' ? 'Extracted by Gemini from your resume.' : 'Filled from your resume.'}</span>
                <span className="text-cyan-200/80">{required.length - missing.length} of {required.length} required fields complete. Review and edit before submitting.</span>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {input('fullName', 'Full name')}{input('email', 'Email', { type: 'email' })}
                {input('phone', 'Phone')}{input('location', 'Location')}
                {input('currentTitle', 'Current title')}{input('currentEmployer', 'Current employer')}
                {input('yearsExperience', 'Years of experience', { type: 'number' })}{input('noticePeriod', 'Notice period')}
                {input('education', 'Education', { wide: true })}
                <label className="block text-[11px] font-semibold text-slate-400 sm:col-span-2">Skills <span className="text-cyan-300">*</span> <span className="font-normal text-slate-500">(comma separated)</span>
                  <textarea rows={2} value={skillsText} onChange={(e) => setSkillsText(e.target.value)} className={`mt-1 w-full rounded-xl border bg-slate-950 px-3 py-2 text-sm font-normal text-white outline-none focus:ring-2 focus:ring-blue-500/20 ${!skillsText.trim() ? 'border-amber-400/60' : 'border-white/10 focus:border-blue-500'}`} />
                </label>
                <label className="block text-[11px] font-semibold text-slate-400 sm:col-span-2">Certifications <span className="font-normal text-slate-500">(comma separated)</span>
                  <textarea rows={2} value={certText} onChange={(e) => setCertText(e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm font-normal text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                </label>
                <label className="block text-[11px] font-semibold text-slate-400 sm:col-span-2">Summary for this role
                  <textarea rows={3} value={f.summary} onChange={(e) => set('summary', e.target.value)} className="mt-1 w-full rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm font-normal text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20" />
                </label>
              </div>
              <div className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <label className="block text-[11px] font-semibold text-slate-300">Gender <span className="font-normal text-slate-500">(optional, self-declared)</span>
                  <select value={f.gender} onChange={(e) => set('gender', e.target.value)} className="mt-1 w-full max-w-xs rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-sm font-normal text-white outline-none focus:border-blue-500">
                    <option>Prefer not to say</option><option>Female</option><option>Male</option>
                  </select>
                </label>
                <p className="mt-1.5 text-[11px] text-slate-500">Used only for equal-opportunity monitoring and shortlist balance. It is never part of your ATS score.</p>
              </div>
              <label className="flex items-start gap-2 text-xs text-slate-300">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} className="mt-0.5 h-4 w-4 accent-blue-500" />
                I confirm the details are accurate and agree to NTT DATA processing them for this application.
              </label>
              {error && <p className="rounded-lg border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300" role="alert">{error}</p>}
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] px-5 py-3">
              <p className="text-xs text-slate-500">{missing.length ? `Still needed: ${missing.map((k) => REQUIRED_LABEL[k] ?? k).join(', ')}` : 'All required fields are complete.'}</p>
              <div className="flex gap-2">
                <button type="button" onClick={onClose} className="rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-300 hover:bg-white/5">Cancel</button>
                <button type="submit" disabled={busy || missing.length > 0 || !consent} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-5 py-2 text-sm font-bold text-white disabled:opacity-50">
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}Submit application
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}

export function CandidatePortal({ user, onSignOut }: { user: User; onSignOut: () => void }) {
  const { theme, setTheme } = usePrefs();
  const [profile, setProfile] = useState<CandidateProfile | null>(null);
  const [query, setQuery] = useState('');
  const [data, setData] = useState<JobSearch | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [applying, setApplying] = useState<JobMatch | null>(null);

  const loadProfile = useCallback(() => api.candidate.profile().then(setProfile).catch(() => undefined), []);
  const run = useCallback(async (q: string) => {
    setLoading(true); setError(null);
    try { setData(await api.candidate.search(q)); } catch (e) { setError(err(e)); } finally { setLoading(false); }
  }, []);
  useEffect(() => { loadProfile(); run(''); }, [loadProfile, run]);

  const onSearch = (e: FormEvent) => { e.preventDefault(); run(query); };
  const pick = (s: string) => { setQuery(s); run(s); };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200">
      <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-white/[0.06] bg-slate-900/80 px-4 py-3 backdrop-blur sm:px-6">
        <Brand compact />
        <span className="hidden rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2.5 py-0.5 text-[11px] font-semibold text-cyan-200 sm:inline">Careers</span>
        <div className="flex-1" />
        <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="rounded-xl border border-white/10 bg-white/[0.04] p-2 text-slate-300 hover:bg-white/10 hover:text-white" aria-label={theme === 'dark' ? 'Light theme' : 'Dark theme'}>
          {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </button>
        <div className="flex items-center gap-2.5 border-l border-white/10 pl-3">
          <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-sm font-bold text-white">{initials(user.name)}</div>
          <div className="hidden leading-tight sm:block"><div className="text-xs font-semibold text-white">{user.name}</div><div className="text-[10px] text-slate-500">Candidate</div></div>
        </div>
        <button onClick={onSignOut} className="rounded-xl p-2 text-slate-400 hover:bg-white/5 hover:text-white" aria-label="Sign out"><LogOut className="h-4 w-4" /></button>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <section className="agent-glow relative overflow-hidden rounded-3xl border border-blue-500/40 bg-gradient-to-br from-blue-600/20 via-slate-900 to-indigo-600/10 p-5 sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-indigo-500/15 blur-3xl" />
          <p className="relative text-[11px] font-bold uppercase tracking-[0.18em] text-blue-300">AI job search</p>
          <h1 className="relative mt-1 text-2xl font-black tracking-tight text-white sm:text-4xl">Find roles that fit your resume</h1>
          <p className="relative mt-1.5 max-w-2xl text-sm text-slate-300 sm:text-base">Search in plain words. Gemini matches every opening against your resume and shows why each role fits.</p>
          <form onSubmit={onSearch} className="relative mt-5 flex gap-2 rounded-2xl border border-white/15 bg-slate-950/80 p-1.5 pl-4 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-500/25">
            <Search className="my-auto h-5 w-5 flex-shrink-0 text-slate-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Search jobs" placeholder="Try: cloud architect, presales, azure…" className="min-w-0 flex-1 bg-transparent py-2.5 text-base text-white outline-none placeholder:text-slate-500" />
            <button type="submit" disabled={loading} className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 px-5 text-sm font-bold text-white disabled:opacity-60">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}<span className="hidden sm:inline">AI search</span>
            </button>
          </form>
          <div className="relative mt-3 flex flex-wrap gap-2">
            {SUGGESTIONS.map((s) => <button key={s} onClick={() => pick(s)} className="rounded-full border border-white/10 bg-white/[0.06] px-3 py-1 text-xs text-slate-200 transition hover:border-cyan-400/50 hover:bg-white/10">{s}</button>)}
          </div>
        </section>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <section aria-live="polite">
            {error && <p className="mb-3 rounded-xl border border-red-500/25 bg-red-500/10 px-4 py-3 text-sm text-red-300" role="alert">{error}</p>}
            {loading ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin text-cyan-300" />Gemini is matching roles to your resume…</div>
                {[0, 1, 2].map((i) => <div key={i} className="h-36 animate-pulse rounded-2xl bg-white/[0.04]" />)}
              </div>
            ) : data && (
              <div className="space-y-3">
                <div className="rounded-xl border-l-4 border-l-blue-500 bg-gradient-to-r from-blue-500/10 to-transparent px-4 py-3 text-sm text-slate-200">
                  <div className="mb-0.5 flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-300"><Sparkles className="h-3 w-3" />{data.query ? `Results for "${data.query}"` : 'Best matches for your resume'}</div>
                  {data.summary}
                </div>
                {data.results.map((j) => <JobCard key={j.id} job={j} onApply={setApplying} />)}
              </div>
            )}
          </section>

          <aside className="space-y-4">
            {profile && (
              <section className="rounded-2xl border border-white/[0.08] bg-slate-900/70 p-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-violet-500 to-fuchsia-600 text-base font-bold text-white">{initials(profile.name)}</div>
                  <div className="min-w-0"><div className="truncate text-sm font-bold text-white">{profile.name}</div><div className="truncate text-xs text-slate-400">{profile.title}</div></div>
                </div>
                <p className="mt-3 text-xs text-slate-400">{profile.years} years · {profile.location}</p>
                <p className="mt-1 text-xs text-slate-300">{profile.summary}</p>
                <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-cyan-300">Skills read from your resume</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">{profile.skills.map((s) => <Chip key={s} tone="muted">{s}</Chip>)}</div>
                <div className="mt-3 text-[11px] font-bold uppercase tracking-wider text-cyan-300">Certifications</div>
                <ul className="mt-1.5 space-y-1 text-xs text-slate-300">{profile.certifications.map((c) => <li key={c} className="flex gap-1.5"><BadgeCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-300" />{c}</li>)}</ul>
              </section>
            )}
            <section className="rounded-2xl border border-white/[0.08] bg-slate-900/70 p-4">
              <h2 className="text-sm font-bold text-white">My applications</h2>
              {profile?.applications.length ? (
                <ul className="mt-2 space-y-2">{profile.applications.map((a) => (
                  <li key={a.reference} className="rounded-xl border border-white/[0.06] bg-white/[0.03] px-3 py-2">
                    <div className="text-sm font-semibold text-white">{a.title}</div>
                    <div className="flex items-center justify-between text-[11px] text-slate-400"><span>{a.reference} · {when(a.submittedAt)}</span><Chip>{a.status}</Chip></div>
                    <CandidateInterviews reference={a.reference} interview={a.interview} onChanged={loadProfile} />
                  </li>))}</ul>
              ) : <p className="mt-2 text-xs text-slate-500">No applications yet. Pick a role and use Apply with Gemini.</p>}
            </section>
          </aside>
        </div>
      </main>

      {applying && <ApplyDialog job={applying} onClose={() => setApplying(null)} onDone={() => { loadProfile(); setData((d) => d && { ...d, results: d.results.map((r) => (r.id === applying.id ? { ...r, applied: true } : r)) }); }} />}
    </div>
  );
}
