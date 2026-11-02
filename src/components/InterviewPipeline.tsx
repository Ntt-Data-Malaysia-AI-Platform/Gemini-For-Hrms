// Interview rounds for one application: a status per round, plus the one-click action HR (or the candidate) can take.
import { useState } from 'react';
import { CalendarCheck, CalendarPlus, CheckCircle2, Circle, Clock, Loader2, Send } from 'lucide-react';
import { api, type InterviewRound, type InterviewState, type InterviewStatus } from '../lib/api';

export const fmtWhen = (iso: string | null) => (iso
  ? `${new Date(iso).toLocaleString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Kuala_Lumpur' })} MYT`
  : '');

const STATUS: Record<InterviewStatus, { icon: typeof Circle; cls: string }> = {
  Completed: { icon: CheckCircle2, cls: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300' },
  Scheduled: { icon: CalendarCheck, cls: 'border-sky-400/30 bg-sky-400/10 text-sky-300' },
  'Confirmation pending': { icon: Clock, cls: 'border-amber-400/30 bg-amber-400/10 text-amber-300' },
  'Not scheduled': { icon: Circle, cls: 'border-white/10 bg-white/[0.04] text-slate-400' },
};

export function StatusChip({ status }: { status: InterviewStatus }) {
  const s = STATUS[status];
  const Icon = s.icon;
  return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${s.cls}`}><Icon className="h-3 w-3" />{status}</span>;
}

export function RoundCell({ r }: { r: InterviewRound }) {
  return (
    <li className="min-w-0 rounded-xl border border-white/[0.07] bg-slate-950/40 px-3 py-2">
      <div className="truncate text-[11px] font-bold uppercase tracking-wide text-slate-400">Round {r.n} · {r.name}</div>
      <div className="mt-1"><StatusChip status={r.status} /></div>
      <div className="mt-1 min-h-[1rem] truncate text-[11px] text-slate-500">{r.when ? fmtWhen(r.when) : ' '}</div>
    </li>
  );
}

// HR view: three round cells and a single button that schedules, or resends, the next step.
export function HrInterviewPipeline({ applicationId, interview, onChanged }: { applicationId: string; interview: InterviewState; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null);
  const next = interview.next;
  const act = async () => {
    setBusy(true); setNote(null);
    try {
      const r = await api.recruiting.schedule(applicationId);
      setNote({ ok: true, text: `${r.resent ? 'Invite re-sent' : 'Invite sent'} for Round ${r.round} (${r.roundName}) · ${fmtWhen(r.when)} · ${r.panel}. Waiting for the candidate to confirm.` });
      onChanged();
    } catch (e) { setNote({ ok: false, text: e instanceof Error ? e.message : 'Could not schedule.' }); } finally { setBusy(false); }
  };
  return (
    <div className="mt-3 border-t border-white/[0.07] pt-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300">Interview pipeline</span>
        {next && next.type !== 'wait' ? (
          <button onClick={act} disabled={busy} className={`inline-flex items-center gap-1.5 rounded-xl px-3.5 py-1.5 text-xs font-bold disabled:opacity-60 ${next.type === 'schedule' ? 'bg-gradient-to-r from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-600/25 hover:brightness-110' : 'border border-amber-400/40 bg-amber-400/10 text-amber-200 hover:bg-amber-400/20'}`}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : next.type === 'schedule' ? <CalendarPlus className="h-3.5 w-3.5" /> : <Send className="h-3.5 w-3.5" />}{next.label}
          </button>
        ) : (
          <span className="text-xs font-semibold text-slate-400">{next ? `${next.label}, awaiting the interview` : 'All rounds completed'}</span>
        )}
      </div>
      <ol className="grid gap-2 sm:grid-cols-3">{interview.rounds.map((r) => <RoundCell key={r.n} r={r} />)}</ol>
      {note && <p className={`mt-2 text-xs ${note.ok ? 'text-emerald-300' : 'text-red-300'}`} role="status">{note.text}</p>}
    </div>
  );
}

// Candidate view: rounds that have started, with a confirm button when a slot is waiting on them.
export function CandidateInterviews({ reference, interview, onChanged }: { reference: string; interview: InterviewState; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const started = interview.rounds.filter((r) => r.status !== 'Not scheduled');
  if (!started.length) return null;
  const confirm = async () => {
    setBusy(true); setError(null);
    try { await api.candidate.confirmInterview(reference); onChanged(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not confirm.'); } finally { setBusy(false); }
  };
  return (
    <div className="mt-2 space-y-1.5 border-t border-white/[0.06] pt-2">
      {started.map((r) => (
        <div key={r.n} className="text-[11px]">
          <div className="flex flex-wrap items-center justify-between gap-1.5"><span className="font-semibold text-slate-200">Round {r.n} · {r.name}</span><StatusChip status={r.status} /></div>
          <div className="text-slate-500">{fmtWhen(r.when)} · {r.panel}</div>
          {r.status === 'Confirmation pending' && (
            <button onClick={confirm} disabled={busy} className="mt-1.5 inline-flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-500 to-indigo-600 px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60">
              {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarCheck className="h-3.5 w-3.5" />}Confirm this slot
            </button>
          )}
        </div>
      ))}
      {error && <p className="text-xs text-red-300" role="alert">{error}</p>}
    </div>
  );
}
