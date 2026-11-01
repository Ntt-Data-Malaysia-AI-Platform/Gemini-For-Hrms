// Executive HR report for the current dashboard filters: SAP SuccessFactors figures plus a Gemini-written narrative.
// The browser turns it into a PDF (print), a PowerPoint deck or an Outlook draft.
import { hrDashboard } from './dashboard.js';

const NARRATIVE = `You write monthly HR executive reports for leadership. From the JSON metrics (SAP SuccessFactors), write Markdown:
### <one-line headline with the most important figure in bold>
> <two-sentence executive summary>
#### Key metrics
| Metric | Value | Comment |
(6 to 8 rows from the data)
#### Risks
- **<risk>**: <one sentence with the figure>  (3 to 4 bullets)
#### Recommended actions
- <short imperative action, at most 12 words>  (3 bullets)
Use only figures present in the data. Format numbers with thousands separators. No preamble.`;

const pick = (d) => ({
  scope: d.filters.label, period: d.filters.span,
  kpis: d.kpis.map(({ label, value, sub }) => ({ label, value, sub })),
  headcountByDivision: d.headcount?.map(({ name, headcount, vacant, vacancyRatePct }) => ({ name, headcount, vacant, vacancyRatePct })),
  hiresByYear: d.hires, applications: d.applications, reviews: d.reviews && { total: d.reviews.total, completionPct: d.reviews.completionPct },
  retention: d.risk && { distribution: d.risk.distribution, highRiskDivisions: d.risk.divisions, keyTalentAtRisk: d.risk.regrettable },
  compliance: d.compliance && { documentsTracked: d.compliance.tracked, status: d.compliance.status, timesheetTodos: d.compliance.timesheets },
  workflows: d.workflows && { pending: d.workflows.pending, byAge: d.workflows.byAge },
  payroll: d.payroll?.findings,
});

async function narrative(metrics) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-3.5-flash'}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: NARRATIVE }] }, contents: [{ role: 'user', parts: [{ text: JSON.stringify(metrics) }] }], generationConfig: { temperature: 0.3 } }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) return null;
    return (await res.json()).candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('').trim() || null;
  } catch {
    return null;
  }
}

export async function executiveReport(filters) {
  const d = await hrDashboard(filters);
  const metrics = pick(d);
  const fallback = `### HR executive report: ${metrics.scope}\n> Figures from SAP SuccessFactors for ${metrics.period}.\n\n#### Key metrics\n| Metric | Value | Comment |\n|---|---|---|\n${metrics.kpis.map((k) => `| ${k.label} | ${k.value} | ${k.sub} |`).join('\n')}`;
  return {
    title: `HR Executive Report · ${metrics.scope}`,
    period: metrics.period,
    generatedAt: new Date().toISOString(),
    dashboard: d,
    narrative: (await narrative(metrics)) || fallback,
  };
}
