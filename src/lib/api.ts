// Client for the HR agents API in server/. The session token lives in sessionStorage (cleared with the tab).

export type Role = 'employee' | 'hr' | 'candidate';

export interface Agent {
  id: string;
  role: Role;
  name: string;
  icon: string;
  description: string;
  prompts: string[];
  sources: string[];
}

export interface Status {
  gemini: string;
  sap: string;
  sapStaleSince: string | null;
  m365: boolean;
  demoHr: boolean;
  teams: boolean;
  services: string[];
}

export interface User {
  name: string;
  title: string;
  dept: string;
  role: Role;
  email: string;
  authMethod: string;
}

export interface TraceItem {
  tool: string;
  args: Record<string, unknown>;
  ms: number;
  source: string;
  ok: boolean;
}

export interface ChatReply {
  reply: string;
  trace: TraceItem[];
  mode: 'gemini' | 'demo';
  changed?: boolean; // true when an agent action changed data (dashboards refresh)
  error?: string;
}

// ---------- Job portal ----------
export interface JobMatch {
  id: string; title: string; dept: string; location: string; type: string; level: string; desc: string; minYears: number;
  matchPct: number; matched: string[]; missing: string[]; preferred: string[]; applied: boolean; reason: string;
}
export interface JobSearch { query: string; summary: string; aiGenerated: boolean; results: JobMatch[] }
export interface AppFields {
  fullName: string; email: string; phone: string; location: string; currentTitle: string; currentEmployer?: string; yearsExperience: number;
  skills: string[]; certifications: string[]; education: string; noticePeriod: string; summary: string; gender?: string;
}
export interface PreparedApplication { job: { id: string; title: string; dept: string; location: string }; fields: AppFields; source: 'gemini' | 'parsed'; required: string[] }
export interface CandidateProfile {
  name: string; title: string; location: string; years: number; skills: string[]; certifications: string[]; education: string; summary: string;
  applications: { reference: string; jobId: string; title: string; submittedAt: string; status: string }[];
}
export interface ScoreRow { key: string; label: string; max: number; pts: number; detail: string }
export interface ShortCandidate {
  rank: number; applicationId: string; name: string; title: string; employer: string | null; location: string; years: number; noticePeriod: string;
  certifications: string[]; education: string; slot: string; score: number; scorecard: ScoreRow[]; matched: string[]; missing: string[]; preferred: string[];
  why: string; isNew: boolean; submittedAt: string;
}
export interface Shortlist {
  job: { id: string; title: string; dept: string; location: string; minYears: number; must: string[] };
  totalApplicants: number; balanced: boolean; aiGenerated: boolean; fairness: string; candidates: ShortCandidate[];
}
export interface HrJob { id: string; title: string; dept: string; location: string; minYears: number; must: string[]; applicants: number }

// ---------- OneDrive ----------
export interface DriveItem {
  id: string | null; name: string; type?: string; isFolder?: boolean; children?: number | null; size?: number | null;
  modified?: string | null; modifiedBy?: string | null; createdBy?: string | null; path?: string; webUrl?: string;
}

// ---------- Dashboards ----------
export type Severity = 'critical' | 'serious' | 'warning' | 'info' | 'good';
export interface Notice { severity: Severity; title: string; detail: string; agent: string; prompt: string }
export interface Kpi { label: string; value: string | number; unit?: string; sub: string; agent: string; prompt: string; sap?: boolean }
type Named = { name: string; count: number };
export interface JiraLink { key?: string; url?: string; status?: string; category?: 'new' | 'indeterminate' | 'done'; assignee?: string | null; updated?: string | null; pending?: boolean; error?: string }

export interface EmployeeDash {
  role: 'employee';
  profile: { name: string; title: string; dept: string; manager: string; location: string; hireDate: string; tenureYears: number };
  kpis: Kpi[];
  leave: { name: string; taken: number; pending: number; remaining: number }[];
  attendance: { date: string; status: string; hours: number }[];
  pay: { period: string; net: number; deductions: number; gross: number; bonus: number }[];
  payComponents: { name: string; value: number; deduction?: boolean }[];
  holidays: { date: string; name: string }[];
  onboarding: { done: number; total: number; pending: { task: string; due: string }[] };
  allowances: { name: string; monthly?: number; annual?: number; used?: number }[];
  requests: { id: string; item: string; category: string; status: string; created: string; jira?: JiraLink }[];
  jira: boolean;
  jobs: { id: string; title: string; dept: string; matchPct: number; closes: string }[];
  learning: { id: string; title: string; hours: number }[];
  notifications: Notice[];
}

// A custom from/to period (YYYY-MM-DD) overrides the preset years.
export interface HrFilters { division: string | null; years: number; from?: string | null; to?: string | null }

export interface HrDash {
  role: 'hr';
  sapAvailable: boolean;
  filters: { division: string | null; years: number | null; from: string | null; to: string | null; custom: boolean; divisions: string[]; ranges: number[]; label: string; span: string };
  kpis: Kpi[];
  headcount: { division: string; name: string; headcount: number; vacant: number; vacancyRatePct: number; selected: boolean }[] | null;
  hires: { label: string; hires: number }[] | null;
  countries: Named[] | null;
  departments: Named[] | null;
  applications: Named[] | null;
  busiestReqs: { jobReqId: string; department: string | null; location: string | null; applications: number; status: string }[] | null;
  reviews: { total: number; completionPct: number; overdue: { form: string; dueDate: string; daysOverdue: number }[] } | null;
  risk: { distribution: Named[]; divisions: { division: string; rated: number; high: number; highRiskPct: number }[]; regrettable: number; regrettableList: { name: string; title: string; performance: string }[] } | null;
  payroll: { findings: Named[]; top: { userId: string; payComponent: string; issue: string; detail: string; severity: string }[] } | null;
  compliance: { tracked: number; status: Named[]; documents: { employee: string; document: string; expires: string | null; state: string }[]; missingExpiry: number; timesheets: number; alerts: number } | null;
  workflows: { pending: number; byAge: Named[]; byType: Named[]; latest: { id: string; type: string; step: string; created: string; ageDays: number; requestedBy: string }[]; todos: Named[] } | null;
  trainingByDept: { name: string; pct: number }[];
  cases: { id: string; subject: string; employee: string; priority: string | null; category: string | null; received: string }[];
  notifications: Notice[];
}

export interface ExecReport { title: string; period: string; generatedAt: string; dashboard: HrDash; narrative: string }

const TOKEN = 'hr_agents_session';
export const getToken = () => sessionStorage.getItem(TOKEN);
export const setToken = (t: string) => sessionStorage.setItem(TOKEN, t);
export const clearToken = () => sessionStorage.removeItem(TOKEN);

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function call<T>(path: string, body?: unknown, graph?: string | null): Promise<T> {
  const res = await fetch(path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: {
      'content-type': 'application/json',
      ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}),
      ...(graph ? { 'x-graph-token': graph } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  return data as T;
}

const qs = (f?: HrFilters) => {
  if (!f) return '';
  const p = new URLSearchParams({ years: String(f.years) });
  if (f.division) p.set('division', f.division);
  if (f.from && f.to) { p.set('from', f.from); p.set('to', f.to); }
  return `?${p}`;
};

export const api = {
  catalog: () => call<{ agents: Agent[]; status: Status }>('/api/catalog'),
  login: (email: string, password: string) => call<{ token: string }>('/api/auth/login', { email, password }),
  m365: (idToken: string) => call<{ token: string }>('/api/auth/m365', { idToken }),
  demoHr: () => call<{ token: string }>('/api/auth/demo-hr', {}),
  me: () => call<{ user: User; status: Status; agents: Agent[] }>('/api/me'),
  chat: (agentId: string, message: string, history: { role: string; text: string }[], graph?: string | null, lang: 'en' | 'ar' = 'en') =>
    call<ChatReply>('/api/chat', { agentId, message, history, lang }, graph),
  onedrive: {
    list: (graph: string, folder?: string | null) => call<{ folder: DriveItem; items: DriveItem[] }>(`/api/onedrive/list${folder ? `?folder=${encodeURIComponent(folder)}` : ''}`, undefined, graph),
    search: (graph: string, q: string) => call<{ query: string; items: DriveItem[] }>(`/api/onedrive/search?q=${encodeURIComponent(q)}`, undefined, graph),
    details: (graph: string, id: string) => call<DriveItem & { analysis: string | null; note?: string }>(`/api/onedrive/details?id=${encodeURIComponent(id)}`, undefined, graph),
  },
  dashboard: (f?: HrFilters) => call<EmployeeDash | HrDash>(`/api/dashboard${qs(f)}`),
  report: (f?: HrFilters) => call<ExecReport>(`/api/report${qs(f)}`),
  teamsNotify: (title: string, subtitle: string, items: Notice[]) => call<{ sent: number }>('/api/teams/notify', { title, subtitle, items }),
  candidate: {
    profile: () => call<CandidateProfile>('/api/candidate/profile'),
    search: (query: string) => call<JobSearch>('/api/candidate/search', { query }),
    prepare: (jobId: string) => call<PreparedApplication>('/api/candidate/prepare', { jobId }),
    apply: (jobId: string, fields: AppFields) => call<{ reference: string; job: { id: string; title: string }; submittedAt: string }>('/api/candidate/apply', { jobId, fields }),
  },
  recruiting: {
    jobs: () => call<{ jobs: HrJob[] }>('/api/hr/recruiting/jobs'),
    shortlist: (jobId: string, balanced: boolean) => call<Shortlist>(`/api/hr/recruiting/shortlist?jobId=${encodeURIComponent(jobId)}&balanced=${balanced ? 1 : 0}`),
  },
  logout: () => call('/api/logout', {}),
};
