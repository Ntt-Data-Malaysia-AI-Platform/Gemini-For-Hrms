// HR view: the top 5 candidates for a role from the job portal, ranked by ATS score, each with a scorecard explaining why.
import { useCallback, useEffect, useState } from 'react';
import { Award, BadgeCheck, Loader2, ShieldCheck, Sparkles, Users } from 'lucide-react';
import { api, type HrJob, type ShortCandidate, type Shortlist } from '../lib/api';

const barColor = (pts: number, max: number) => (pts >= max * 0.8 ? '#199e70' : pts >= max * 0.5 ? '#3987e5' : '#c98500');

function Ring({ score }: { score: number }) {
  const color = score >= 85 ? '#199e70' : score >= 65 ? '#3987e5' : '#c98500';
  return (
    <div className="relative grid h-16 w-16 flex-shrink-0 place-items-center rounded-full" style={{ background: `conic-gradient(${color} ${score * 3.6}deg, rgba(148,163,184,0.18) 0)` }} role="img" aria-label={`ATS score ${score} out of 100`}>
      <div className="grid h-12 w-12 place-items-center rounded-full bg-slate-900 text-center leading-none"><span className="text-base font-black text-white">{score}</span><span className="-mt-3 text-[8px] uppercase tracking-wider text-slate-500">/ 100</span></div>
    </div>
  );
}

function CandidateCard({ c, must }: { c: ShortCandidate; must: string[] }) {
  const top = c.slot === 'Top profile';
  return (
    <article className={`rounded-2xl border p-4 ${top ? 'border-cyan-400/50 bg-cyan-400/[0.06]' : 'border-white/[0.08] bg-white/[0.03]'}`}>
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="flex gap-3">
          <div className="flex flex-col items-center gap-1.5">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-blue-500 text-xs font-bold text-white">{c.rank}</span>
            <Ring score={c.score} />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-base font-bold text-white">{c.name}</h4>
              <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${top ? 'border-cyan-400/50 bg-cyan-400/15 text-cyan-200' : 'border-white/15 bg-white/5 text-slate-300'}`}>{top && <Award className="h-3 w-3" />}{c.slot}</span>
              {c.isNew && <span className="rounded-full bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">New from portal</span>}
            </div>
            <p className="text-xs text-slate-400">{c.title}{c.employer ? ` · ${c.employer}` : ''} · {c.years} yrs · {c.location}</p>
            <p className="mt-0.5 text-[11px] text-slate-500">Notice {c.noticePeriod} · {c.education}</p>
            <p className="mt-2 flex items-start gap-1.5 rounded-lg bg-blue-500/10 px-2.5 py-1.5 text-xs text-blue-100"><Sparkles className="mt-0.5 h-3 w-3 flex-shrink-0 text-cyan-300" />{c.why}</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {must.map((s) => {
                const ok = c.matched.includes(s);
                return <span key={s} className={`rounded-full border px-2 py-0.5 text-[11px] font-medium ${ok ? 'border-cyan-400/30 bg-cyan-400/10 text-cyan-200' : 'border-amber-400/30 bg-amber-400/10 text-amber-200'}`}>{ok ? '✓ ' : 'gap: '}{s}</span>;
              })}
            </div>
            {c.certifications.length > 0 && <p className="mt-2 flex items-start gap-1.5 text-[11px] text-slate-400"><BadgeCheck className="mt-0.5 h-3 w-3 flex-shrink-0 text-emerald-300" />{c.certifications.join(' · ')}</p>}
          </div>
        </div>
        <div>
          <div className="mb-1.5 flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-cyan-300"><span>Scorecard</span><span className="text-slate-400">{c.score} / 100</span></div>
          <ul className="space-y-1.5">
            {c.scorecard.map((r) => (
              <li key={r.key} title={r.detail}>
                <div className="flex items-baseline justify-between text-xs"><span className="font-semibold text-slate-200">{r.label}</span><span className="tabular-nums text-slate-400">{r.pts}/{r.max}</span></div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full" style={{ width: `${(r.pts / r.max) * 100}%`, background: barColor(r.pts, r.max) }} /></div>
                <div className="mt-0.5 truncate text-[10px] text-slate-500">{r.detail}</div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

export function ShortlistPanel({ onAsk }: { onAsk: (agentId: string, prompt: string) => void }) {
  const [jobs, setJobs] = useState<HrJob[]>([]);
  const [jobId, setJobId] = useState('J-101');
  const [balanced, setBalanced] = useState(true);
  const [data, setData] = useState<Shortlist | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    try { setData(await api.recruiting.shortlist(jobId, balanced)); setError(null); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not load the shortlist.'); }
    finally { setLoading(false); }
  }, [jobId, balanced]);

  useEffect(() => { api.recruiting.jobs().then((r) => setJobs(r.jobs)).catch(() => undefined); }, []);
  useEffect(() => { load(); }, [load]);
  // New portal applications appear without a reload.
  useEffect(() => { const id = window.setInterval(() => load(true), 15000); return () => window.clearInterval(id); }, [load]);

  const counts = data ? { top: data.candidates.filter((c) => c.slot === 'Top profile').length, men: data.candidates.filter((c) => c.slot.endsWith('Man')).length, women: data.candidates.filter((c) => c.slot.endsWith('Woman')).length } : null;

  return (
    <section className="flex flex-col rounded-2xl border border-white/[0.07] bg-slate-900/70 p-4 shadow-lg shadow-black/20 backdrop-blur">
      <header className="mb-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2"><h3 className="text-sm font-semibold text-white">Candidate shortlist</h3><span className="rounded-full border border-cyan-400/30 bg-cyan-400/10 px-2 py-0.5 text-[10px] font-bold text-cyan-200">Job portal · ATS</span></div>
          <p className="text-xs text-slate-500">Top 5 from applications received, ranked by ATS scan with the reason for each</p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <label className="text-[11px] font-semibold text-slate-400">Role
            <select value={jobId} onChange={(e) => setJobId(e.target.value)} className="ml-2 max-w-[230px] rounded-xl border border-white/10 bg-slate-950 px-2.5 py-1.5 text-xs font-normal text-white outline-none focus:border-blue-500">
              {(jobs.length ? jobs : [{ id: 'J-101', title: 'Multi-Cloud Solutions Architect', applicants: 0 } as HrJob]).map((j) => <option key={j.id} value={j.id}>{j.title} ({j.applicants})</option>)}
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[11px] font-semibold text-slate-300">
            <input type="checkbox" checked={balanced} onChange={(e) => setBalanced(e.target.checked)} className="h-4 w-4 accent-blue-500" />Balanced slate
          </label>
          <button onClick={() => onAsk('recruitment', `Show the top 5 candidates for the ${data?.job.title ?? 'Multi-Cloud Solutions Architect'} role`)} className="flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-medium text-blue-300 hover:bg-blue-500/10"><Sparkles className="h-3 w-3" />Ask agent</button>
        </div>
      </header>

      {loading && !data ? (
        <div className="flex items-center gap-2 py-10 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin text-cyan-300" />Scanning applications and building scorecards…</div>
      ) : error ? (
        <p className="py-6 text-center text-xs text-red-300" role="alert">{error}</p>
      ) : data && counts && (
        <>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/[0.06] px-2.5 py-1"><Users className="h-3.5 w-3.5 text-cyan-300" />{data.totalApplicants} applicants scanned</span>
            {balanced ? (
              <span className="rounded-full bg-white/[0.06] px-2.5 py-1">Slate: {counts.top} top profile · {counts.men} men · {counts.women} women</span>
            ) : <span className="rounded-full bg-white/[0.06] px-2.5 py-1">Pure score ranking</span>}
            {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />}
          </div>
          <div className="space-y-3">{data.candidates.map((c) => <CandidateCard key={c.applicationId} c={c} must={data.job.must} />)}</div>
          <p className="mt-3 flex items-start gap-2 text-[11px] text-slate-500"><ShieldCheck className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-emerald-300" />{data.fairness}</p>
        </>
      )}
    </section>
  );
}
