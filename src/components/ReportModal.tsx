import { useEffect, useState } from 'react';
import { Download, FileText, Loader2, Mail, X } from 'lucide-react';
import { api, type ExecReport, type HrFilters, type User } from '../lib/api';
import { downloadDeck, outlookDraft } from '../lib/exporters';
import { useT } from '../lib/i18n';
import { Markdown } from './Markdown';

// Executive report for the current dashboard filters. "Download PDF" prints just this panel (see index.css @media print).
export function ReportModal({ filters, user, onClose }: { filters: HrFilters; user: User; onClose: () => void }) {
  const t = useT();
  const [report, setReport] = useState<ExecReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'pptx' | 'mail' | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const viaM365 = user.authMethod === 'Microsoft 365';

  useEffect(() => { api.report(filters).then(setReport).catch((e) => setError(e.message)); }, [filters]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const run = async (kind: 'pptx' | 'mail') => {
    if (!report) return;
    setBusy(kind); setError(null); setNotice(null);
    try {
      if (kind === 'pptx') { await downloadDeck(report); setNotice('PowerPoint downloaded.'); }
      else if (await outlookDraft(report)) setNotice('Draft created in Outlook with the deck attached. Review it there and send.');
    } catch (e) { setError(e instanceof Error ? e.message : 'Export failed.'); }
    finally { setBusy(null); }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 backdrop-blur-sm print:static print:block print:bg-white print:p-0" role="dialog" aria-modal="true" aria-label={t('Executive report')}>
      <div id="print-report" className="w-full max-w-4xl rounded-2xl border border-white/10 bg-slate-900 shadow-2xl shadow-black/60 print:max-w-none print:rounded-none print:border-0 print:shadow-none">
        <header className="flex flex-wrap items-center gap-2 border-b border-white/10 px-5 py-4 print:hidden">
          <FileText className="h-5 w-5 text-blue-300" />
          <h2 className="me-auto text-base font-bold text-white">{t('Executive report')}</h2>
          <button onClick={() => window.print()} disabled={!report} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50"><Download className="h-3.5 w-3.5" />{t('Download PDF')}</button>
          <button onClick={() => run('pptx')} disabled={!report || !!busy} className="flex items-center gap-1.5 rounded-xl border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-white/5 disabled:opacity-50">
            {busy === 'pptx' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}{t('Download PowerPoint')}
          </button>
          {viaM365 && (
            <button onClick={() => run('mail')} disabled={!report || !!busy} className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
              {busy === 'mail' ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Mail className="h-3.5 w-3.5" />}{t('Create Outlook draft')}
            </button>
          )}
          <button onClick={onClose} className="rounded-lg p-1.5 text-slate-400 hover:bg-white/5 hover:text-white" aria-label={t('Close')}><X className="h-4 w-4" /></button>
        </header>

        {(error || notice) && <div className={`mx-5 mt-4 rounded-xl px-3 py-2 text-xs print:hidden ${error ? 'border border-red-500/25 bg-red-500/10 text-red-300' : 'border border-emerald-500/25 bg-emerald-500/10 text-emerald-200'}`}>{error || notice}</div>}

        {!report && !error && <div className="flex items-center gap-2 px-5 py-16 text-sm text-slate-400"><Loader2 className="h-4 w-4 animate-spin" />{t('Generating report…')}</div>}

        {report && (
          <article className="space-y-5 px-6 py-6 print:px-0">
            <div className="flex flex-wrap items-end justify-between gap-3 border-b border-white/10 pb-4">
              <div>
                <img src="/ntt-data-logo-white.png" alt="NTT DATA" className="mb-3 h-6 print:hidden" />
                <img src="/ntt-data-logo-blue.png" alt="NTT DATA" className="mb-3 hidden h-6 print:block" />
                <h1 className="text-2xl font-black text-white">{report.title}</h1>
                <p className="text-sm text-slate-400">{report.period} · Source: SAP SuccessFactors</p>
              </div>
              <p className="text-xs text-slate-500">{t('Generated')} {new Date(report.generatedAt).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {report.dashboard.kpis.map((k) => (
                <div key={k.label} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                  <div className="text-xs text-slate-400">{t(k.label)}</div>
                  <div className="text-xl font-black text-white">{k.value}</div>
                  <div className="truncate text-[11px] text-slate-500">{k.sub}</div>
                </div>
              ))}
            </div>
            <Markdown text={report.narrative} />
          </article>
        )}
      </div>
    </div>
  );
}
