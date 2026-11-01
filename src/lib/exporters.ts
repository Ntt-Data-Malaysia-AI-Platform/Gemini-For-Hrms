// Executive report exports: PowerPoint (native editable charts), Outlook draft (Microsoft Graph), PDF via print.
import type { ExecReport } from './api';
import { mailToken } from './msal';
import { toHtml } from '../components/Markdown';

const BRAND = { bg: '0F172A', panel: '1E293B', text: 'F1F5F9', muted: '94A3B8', accent: '3987E5', green: '199E70' };
const SERIES = ['3987E5', 'D95926', '199E70', 'C98500', 'D55181'];

// Pull the headline, summary and bullet sections out of the report narrative.
function sections(md: string) {
  const headline = md.match(/^###\s+(.+)$/m)?.[1].replace(/\*\*/g, '') ?? '';
  const summary = (md.match(/^>\s?(.+)$/gm) ?? []).map((l) => l.replace(/^>\s?/, '').replace(/\*\*/g, '')).join(' ');
  const list = (title: RegExp) => {
    const block = md.split(/^####\s+/m).find((b) => title.test(b.split('\n')[0]));
    return block ? block.split('\n').filter((l) => /^\s*[-*]\s/.test(l)).map((l) => l.replace(/^\s*[-*]\s/, '').replace(/\*\*/g, '').trim()) : [];
  };
  return { headline, summary, risks: list(/risk/i), actions: list(/action|next/i) };
}

const fileName = (r: ExecReport, ext: string) => `${r.title.replace(/[^\w-]+/g, '_')}_${r.generatedAt.slice(0, 10)}.${ext}`;

async function buildDeck(r: ExecReport) {
  const { default: PptxGenJS } = await import('pptxgenjs');
  const pres = new PptxGenJS();
  pres.layout = 'LAYOUT_WIDE';
  pres.title = r.title;
  const d = r.dashboard;
  const s = sections(r.narrative);
  const base = () => {
    const slide = pres.addSlide();
    slide.background = { color: BRAND.bg };
    slide.addImage({ path: '/ntt-data-logo-white.png', x: 11.35, y: 0.3, w: 1.6, h: 0.42 });
    slide.addText(`${r.title} · ${r.period}`, { x: 0.5, y: 7.0, w: 9, h: 0.3, fontSize: 9, color: BRAND.muted });
    return slide;
  };
  const heading = (slide: ReturnType<typeof base>, text: string) => slide.addText(text, { x: 0.5, y: 0.35, w: 10.5, h: 0.6, fontSize: 24, bold: true, color: BRAND.text });

  // 1. Title
  let slide = base();
  slide.addText('HR Executive Report', { x: 0.6, y: 2.2, w: 11, h: 0.9, fontSize: 40, bold: true, color: BRAND.text });
  slide.addText(`${d.filters.label} · ${r.period}`, { x: 0.6, y: 3.1, w: 11, h: 0.5, fontSize: 18, color: '7DD3FC' });
  slide.addText(`Source: SAP SuccessFactors · Generated ${new Date(r.generatedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`, { x: 0.6, y: 3.7, w: 11, h: 0.4, fontSize: 12, color: BRAND.muted });

  // 2. Summary + KPIs
  slide = base();
  heading(slide, s.headline || 'Executive summary');
  slide.addText(s.summary, { x: 0.5, y: 1.05, w: 12.3, h: 0.9, fontSize: 14, color: BRAND.text, fill: { color: BRAND.panel }, margin: 12 });
  d.kpis.slice(0, 6).forEach((k, i) => {
    const x = 0.5 + (i % 3) * 4.15, y = 2.3 + Math.floor(i / 3) * 2.15;
    slide.addShape(pres.ShapeType.roundRect, { x, y, w: 3.95, h: 1.95, fill: { color: BRAND.panel }, line: { color: '334155' }, rectRadius: 0.12 });
    slide.addText(k.label, { x: x + 0.2, y: y + 0.15, w: 3.6, h: 0.35, fontSize: 12, color: BRAND.muted });
    slide.addText(String(k.value), { x: x + 0.2, y: y + 0.55, w: 3.6, h: 0.75, fontSize: 32, bold: true, color: BRAND.text });
    slide.addText(k.sub, { x: x + 0.2, y: y + 1.35, w: 3.6, h: 0.45, fontSize: 10, color: BRAND.muted });
  });

  // 3. Workforce charts
  if (d.headcount && d.hires) {
    slide = base();
    heading(slide, 'Workforce and hiring');
    const axis = { catAxisLabelColor: BRAND.muted, valAxisLabelColor: BRAND.muted, valGridLine: { color: '334155', size: 0.5 }, catAxisLabelFontSize: 10, valAxisLabelFontSize: 9, dataLabelColor: BRAND.text, showValue: true, dataLabelFontSize: 9 };
    slide.addText('Headcount by division', { x: 0.5, y: 1.0, w: 6, h: 0.4, fontSize: 14, bold: true, color: BRAND.text });
    slide.addChart(pres.ChartType.bar, [{ name: 'Headcount', labels: d.headcount.map((h) => h.name), values: d.headcount.map((h) => h.headcount) }],
      { x: 0.5, y: 1.4, w: 6.1, h: 5.3, barDir: 'bar', chartColors: [SERIES[0]], ...axis });
    slide.addText('New hires by year', { x: 6.9, y: 1.0, w: 6, h: 0.4, fontSize: 14, bold: true, color: BRAND.text });
    slide.addChart(pres.ChartType.bar, [{ name: 'Hires', labels: d.hires.map((h) => h.label), values: d.hires.map((h) => h.hires) }],
      { x: 6.9, y: 1.4, w: 5.9, h: 5.3, barDir: 'col', chartColors: [SERIES[2]], ...axis });
  }

  // 4. Retention and compliance
  if (d.risk || d.compliance) {
    slide = base();
    heading(slide, 'Retention risk and compliance');
    if (d.risk) {
      slide.addText('Risk-of-loss ratings', { x: 0.5, y: 1.0, w: 6, h: 0.4, fontSize: 14, bold: true, color: BRAND.text });
      const order = ['High', 'Medium', 'Low'];
      slide.addChart(pres.ChartType.doughnut, [{ name: 'Risk', labels: order.map((o) => `${o} risk`), values: order.map((o) => d.risk!.distribution.find((x) => x.name === o)?.count ?? 0) }],
        { x: 0.5, y: 1.4, w: 6, h: 4.2, chartColors: ['D03B3B', 'FAB219', '0CA30C'], holeSize: 60, showLegend: true, legendColor: BRAND.text, legendPos: 'b', dataLabelColor: 'FFFFFF', showPercent: true });
      slide.addText(`${d.risk.regrettable} high performers are at high risk of leaving.`, { x: 0.5, y: 5.8, w: 6, h: 0.5, fontSize: 12, color: BRAND.text });
    }
    if (d.compliance) {
      const rows = [['Employee', 'Document', 'Status'], ...d.compliance.documents.map((x) => [x.employee, x.document, x.expires ? `${x.state} (${x.expires})` : x.state])];
      slide.addText('Employee documents needing action', { x: 6.9, y: 1.0, w: 6, h: 0.4, fontSize: 14, bold: true, color: BRAND.text });
      slide.addTable(rows.map((row, i) => row.map((text) => ({ text, options: { color: i ? BRAND.text : BRAND.muted, bold: !i, fill: { color: i ? BRAND.panel : BRAND.bg }, fontSize: 10 } }))),
        { x: 6.9, y: 1.45, w: 5.9, colW: [2.1, 1.9, 1.9], border: { type: 'solid', color: '334155', pt: 0.5 } });
      slide.addText(`${d.compliance.missingExpiry} documents have no expiry date · ${d.compliance.timesheets} timesheet to-dos open`, { x: 6.9, y: 5.8, w: 5.9, h: 0.5, fontSize: 12, color: BRAND.text });
    }
  }

  // 5. Risks and actions
  slide = base();
  heading(slide, 'Risks and recommended actions');
  const bullets = (items: string[]) => items.map((text) => ({ text, options: { bullet: true, color: BRAND.text, fontSize: 14, paraSpaceAfter: 8 } }));
  slide.addText('Risks', { x: 0.5, y: 1.05, w: 6, h: 0.4, fontSize: 16, bold: true, color: 'EC835A' });
  slide.addText(bullets(s.risks.length ? s.risks : ['No material risks identified.']), { x: 0.5, y: 1.5, w: 6, h: 5, valign: 'top' });
  slide.addText('Recommended actions', { x: 6.9, y: 1.05, w: 6, h: 0.4, fontSize: 16, bold: true, color: '34D399' });
  slide.addText(bullets(s.actions.length ? s.actions : ['Review the dashboard with division leads.']), { x: 6.9, y: 1.5, w: 6, h: 5, valign: 'top' });
  return pres;
}

export async function downloadDeck(r: ExecReport) {
  await (await buildDeck(r)).writeFile({ fileName: fileName(r, 'pptx') });
}

// Creates an Outlook draft (not sent) with the narrative in the body and the deck attached, then opens it.
export async function outlookDraft(r: ExecReport) {
  const token = await mailToken(true);
  if (!token) return null; // redirected to Microsoft for consent
  const contentBytes = await (await buildDeck(r)).write({ outputType: 'base64' }) as string;
  const res = await fetch('https://graph.microsoft.com/v1.0/me/messages', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify({
      subject: `${r.title} · ${r.period}`,
      body: { contentType: 'HTML', content: `<div style="font-family:Segoe UI,Arial,sans-serif">${toHtml(r.narrative)}<p style="color:#64748b;font-size:12px">Generated by NTT DATA HRMS from SAP SuccessFactors.</p></div>` },
      attachments: [{ '@odata.type': '#microsoft.graph.fileAttachment', name: fileName(r, 'pptx'), contentType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation', contentBytes }],
    }),
  });
  if (!res.ok) throw new Error(res.status === 403 ? 'Microsoft 365 denied mail access (the app needs Mail.ReadWrite).' : `Could not create the Outlook draft (${res.status}).`);
  const draft = await res.json();
  window.open(draft.webLink, '_blank', 'noopener');
  return draft.webLink as string;
}
