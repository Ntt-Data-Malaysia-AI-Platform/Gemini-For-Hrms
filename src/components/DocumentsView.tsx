import { useCallback, useEffect, useState, type FormEvent } from 'react';
import {
  ChevronRight, Cloud, ExternalLink, FileImage, FileSpreadsheet, FileText, Folder, Loader2, Presentation, Search, Sparkles, X,
} from 'lucide-react';
import { api, type DriveItem, type User } from '../lib/api';
import { connectOneDrive, graphToken } from '../lib/msal';
import { Markdown } from './Markdown';

type Ask = (agentId: string, prompt: string) => void;

const ICON = { Folder, Word: FileText, PDF: FileText, Text: FileText, Excel: FileSpreadsheet, CSV: FileSpreadsheet, PowerPoint: Presentation, Image: FileImage } as const;
const TINT: Record<string, string> = { Folder: 'text-amber-300', Word: 'text-blue-300', PDF: 'text-red-300', Excel: 'text-emerald-300', CSV: 'text-emerald-300', PowerPoint: 'text-orange-300', Image: 'text-pink-300' };
const size = (n?: number | null) => (n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${Math.round(n / 1024)} KB` : `${(n / 1048576).toFixed(1)} MB`);
const date = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');

function TypeIcon({ type }: { type?: string }) {
  const Icon = ICON[(type ?? '') as keyof typeof ICON] ?? FileText;
  return <Icon className={`h-4 w-4 flex-shrink-0 ${TINT[type ?? ''] ?? 'text-slate-400'}`} />;
}

export function DocumentsView({ user, onAsk }: { user: User; onAsk: Ask }) {
  const viaM365 = user.authMethod === 'Microsoft 365';
  const [token, setToken] = useState<string | null>(null);
  const [checking, setChecking] = useState(viaM365);
  const [trail, setTrail] = useState<DriveItem[]>([{ id: null, name: 'My files' }]);
  const [items, setItems] = useState<DriveItem[]>([]);
  const [query, setQuery] = useState('');
  const [searching, setSearching] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<DriveItem | null>(null);
  const [analysis, setAnalysis] = useState<{ id: string; text: string } | null>(null);
  const [analysing, setAnalysing] = useState(false);

  useEffect(() => {
    if (!viaM365) return;
    graphToken().then(setToken).catch((e) => setError(e.message)).finally(() => setChecking(false));
  }, [viaM365]);

  const open = useCallback(async (folder: DriveItem, nextTrail: DriveItem[]) => {
    if (!token) return;
    setLoading(true); setError(null); setSearching(null);
    try { setItems((await api.onedrive.list(token, folder.id)).items); setTrail(nextTrail); }
    catch (e) { setError(e instanceof Error ? e.message : 'Could not open OneDrive.'); }
    finally { setLoading(false); }
  }, [token]);

  useEffect(() => { if (token) open({ id: null, name: 'My files' }, [{ id: null, name: 'My files' }]); }, [token, open]);

  const runSearch = async (e: FormEvent) => {
    e.preventDefault();
    if (!token || !query.trim()) return;
    setLoading(true); setError(null);
    try { setItems((await api.onedrive.search(token, query)).items); setSearching(query); }
    catch (err) { setError(err instanceof Error ? err.message : 'Search failed.'); }
    finally { setLoading(false); }
  };

  const analyse = async (it: DriveItem) => {
    if (!token || !it.id) return;
    setAnalysing(true); setError(null);
    try {
      const fresh = (await graphToken()) ?? token; // analysis can take a while; use the freshest token
      const d = await api.onedrive.details(fresh, it.id);
      setAnalysis({ id: it.id, text: d.analysis ?? d.note ?? 'No details extracted.' });
    } catch (e) { setError(e instanceof Error ? e.message : 'Analysis failed.'); }
    finally { setAnalysing(false); }
  };

  const pick = (it: DriveItem) => {
    if (it.isFolder) return open(it, [...trail, it]);
    setSelected(it);
    if (analysis?.id !== it.id) setAnalysis(null);
  };

  if (!viaM365 || (!checking && !token)) {
    return (
      <div className="mx-auto mt-12 max-w-md rounded-2xl border border-white/[0.07] bg-slate-900/70 p-8 text-center">
        <div className="mx-auto mb-4 grid h-14 w-14 place-items-center rounded-2xl bg-sky-500/10 ring-1 ring-sky-500/25"><Cloud className="h-7 w-7 text-sky-300" /></div>
        <h2 className="mb-1 text-lg font-semibold text-white">Connect your OneDrive</h2>
        {viaM365 ? (
          <>
            <p className="mb-5 text-sm text-slate-400">Browse HR documents, search across your files and let Gemini extract the key details, completeness checks and discrepancies.</p>
            <button onClick={() => connectOneDrive().catch((e) => setError(e.message))} className="rounded-xl bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500">Connect OneDrive</button>
            <p className="mt-3 text-[11px] text-slate-500">You will be asked to allow read access to your files (Files.Read.All).</p>
          </>
        ) : (
          <p className="text-sm text-slate-400">OneDrive is available when you sign in with your Microsoft 365 work account.</p>
        )}
        {error && <p className="mt-4 text-xs text-red-300">{error}</p>}
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
      <section className="min-w-0 rounded-2xl border border-white/[0.07] bg-slate-900/70 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <nav className="flex min-w-0 flex-wrap items-center gap-1 text-sm">
            {searching ? (
              <span className="flex items-center gap-2 text-slate-300">Results for “{searching}”
                <button onClick={() => { setQuery(''); open(trail[trail.length - 1], trail); }} className="rounded-md p-0.5 text-slate-500 hover:bg-white/5 hover:text-white" aria-label="Clear search"><X className="h-3.5 w-3.5" /></button>
              </span>
            ) : trail.map((t, i) => (
              <span key={`${t.id}-${i}`} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="h-3.5 w-3.5 text-slate-600" />}
                <button onClick={() => open(t, trail.slice(0, i + 1))} className={`rounded-md px-1.5 py-0.5 ${i === trail.length - 1 ? 'font-semibold text-white' : 'text-slate-400 hover:bg-white/5 hover:text-white'}`}>{t.name}</button>
              </span>
            ))}
          </nav>
          <form onSubmit={runSearch} className="relative w-full sm:w-72">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search OneDrive (e.g. offer letter)" aria-label="Search OneDrive"
              className="w-full rounded-xl border border-white/10 bg-slate-950/60 py-2 pl-9 pr-3 text-sm text-white outline-none placeholder:text-slate-500 focus:border-sky-500" />
          </form>
        </div>
        {error && <div className="mb-3 rounded-xl border border-red-500/25 bg-red-500/10 px-3 py-2 text-xs text-red-300">{error}</div>}
        <div className="overflow-hidden rounded-xl border border-white/[0.06]">
          <div className="grid grid-cols-[minmax(0,1fr)_110px_120px_70px] gap-3 border-b border-white/[0.06] bg-white/[0.03] px-3 py-2 text-[11px] font-semibold uppercase tracking-wide text-slate-500">
            <span>Name</span><span className="hidden sm:block">Modified</span><span className="hidden md:block">Modified by</span><span className="text-right">Size</span>
          </div>
          {(loading || checking) && <div className="flex items-center gap-2 px-3 py-6 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" /> Loading OneDrive…</div>}
          {!loading && !checking && items.map((it) => (
            <button key={it.id} onClick={() => pick(it)}
              className={`grid w-full grid-cols-[minmax(0,1fr)_110px_120px_70px] items-center gap-3 border-b border-white/[0.04] px-3 py-2.5 text-left text-sm transition last:border-b-0 ${selected?.id === it.id ? 'bg-sky-500/10' : 'hover:bg-white/[0.04]'}`}>
              <span className="flex min-w-0 items-center gap-2.5"><TypeIcon type={it.type} /><span className="truncate text-slate-200">{it.name}</span>{it.isFolder && it.children != null && <span className="text-[11px] text-slate-500">{it.children}</span>}</span>
              <span className="hidden text-xs text-slate-400 sm:block">{date(it.modified)}</span>
              <span className="hidden truncate text-xs text-slate-400 md:block">{it.modifiedBy}</span>
              <span className="text-right text-xs tabular-nums text-slate-500">{it.isFolder ? '' : size(it.size)}</span>
            </button>
          ))}
          {!loading && !checking && !items.length && <p className="px-3 py-8 text-center text-sm text-slate-500">{searching ? 'No documents match that search.' : 'This folder is empty.'}</p>}
        </div>
      </section>

      <aside className="rounded-2xl border border-white/[0.07] bg-slate-900/70 p-4">
        {!selected ? (
          <div className="grid h-full min-h-[240px] place-items-center text-center text-sm text-slate-500">
            <div><FileText className="mx-auto mb-2 h-8 w-8 text-slate-600" />Select a document to see its details and analyse it with Gemini.</div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-xl bg-white/[0.05]"><TypeIcon type={selected.type} /></div>
              <div className="min-w-0">
                <h3 className="break-words text-sm font-semibold text-white">{selected.name}</h3>
                <p className="text-xs text-slate-500">{selected.type} · {size(selected.size)}</p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-2 text-xs">
              {[['Modified', date(selected.modified)], ['Modified by', selected.modifiedBy], ['Created by', selected.createdBy], ['Location', selected.path]].map(([k, v]) => (
                <div key={k} className="rounded-lg bg-white/[0.04] px-3 py-2"><dt className="text-[10px] uppercase tracking-wider text-slate-500">{k}</dt><dd className="truncate text-slate-200">{v || '—'}</dd></div>
              ))}
            </dl>
            <div className="grid grid-cols-2 gap-2">
              <button onClick={() => analyse(selected)} disabled={analysing} className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-60">
                {analysing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}{analysing ? 'Reading document…' : 'Analyse with Gemini'}
              </button>
              <a href={selected.webUrl} target="_blank" rel="noreferrer" className="flex items-center justify-center gap-1.5 rounded-xl border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5"><ExternalLink className="h-3.5 w-3.5" /> Open in OneDrive</a>
            </div>
            <button onClick={() => onAsk('doc-processing', `Review the OneDrive document "${selected.name}" (id ${selected.id}): extract its key details and flag anything missing or inconsistent.`)}
              className="w-full rounded-xl border border-dashed border-white/15 py-2 text-xs text-slate-400 hover:border-blue-500/50 hover:text-white">Ask the Document agent about this file</button>
            {analysis?.id === selected.id && (
              <div className="rounded-xl border border-white/[0.07] bg-slate-950/50 p-3 text-sm"
                onClick={(e) => { const s = (e.target as HTMLElement).closest<HTMLElement>('[data-step]')?.dataset.step; if (s) onAsk('doc-processing', `${s} (document: "${selected.name}", id ${selected.id})`); }}>
                <Markdown text={analysis.text} />
              </div>
            )}
          </div>
        )}
      </aside>
    </div>
  );
}
