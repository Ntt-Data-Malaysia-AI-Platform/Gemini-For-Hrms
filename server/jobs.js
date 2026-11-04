// Job portal: mock openings, the candidate's resume, AI job search, field extraction for applications,
// ATS scoring and the top-5 shortlist HR sees. Applications and interviews persist through store.js (Firestore on Cloud Run).
import * as store from './store.js';

// ---------- Skill vocabulary: canonical skill -> words that count as a mention ----------
const SKILLS = {
  azure: ['azure', 'entra id', 'aks'],
  aws: ['aws', 'amazon web services', 'eks'],
  'google cloud': ['google cloud', 'gcp', 'gke'],
  terraform: ['terraform', 'infrastructure as code', 'iac'],
  kubernetes: ['kubernetes', 'k8s', 'aks', 'eks', 'gke'],
  'solution architecture': ['solution architecture', 'solution design', 'solutions architect', 'enterprise architect', 'cloud architect', 'architecture'],
  'cloud migration': ['cloud migration', 'migration'],
  'landing zones': ['landing zone'],
  finops: ['finops', 'cloud cost'],
  security: ['security', 'cissp', 'zero trust'],
  identity: ['identity', 'entra', 'iam'],
  networking: ['networking', 'network design', 'vnet', 'vpc'],
  devops: ['devops', 'sre'],
  'ci/cd': ['ci/cd', 'cicd', 'pipelines', 'github actions', 'azure devops'],
  presales: ['presales', 'pre-sales', 'pre sales'],
  rfp: ['rfp', 'rfi', 'tender', 'bid response'],
  'stakeholder management': ['stakeholder'],
  python: ['python'],
  'data engineering': ['data engineering', 'data pipelines', 'etl'],
  bigquery: ['bigquery'],
  payroll: ['payroll'],
  'sap successfactors': ['successfactors', 'sap hr'],
  compliance: ['compliance', 'statutory'],
  excel: ['excel'],
  'employee relations': ['employee relations'],
  'hr policy': ['hr policy', 'policy'],
  'workforce planning': ['workforce planning', 'headcount planning'],
  'change management': ['change management'],
  react: ['react'],
  typescript: ['typescript'],
  css: ['css', 'tailwind'],
  testing: ['testing', 'jest', 'playwright'],
  'product management': ['product management', 'product manager'],
  ai: ['generative ai', 'machine learning', ' ai ', 'llm'],
  roadmap: ['roadmap'],
};
const found = (text) => { const t = ` ${text.toLowerCase()} `; return new Set(Object.entries(SKILLS).filter(([, words]) => words.some((w) => t.includes(w))).map(([k]) => k)); };

// ---------- Mock openings ----------
export const JOBS = [
  { id: 'J-101', title: 'Multi-Cloud Solutions Architect', dept: 'Cloud & Infrastructure', location: 'Kuala Lumpur, Malaysia', type: 'Full-time · Hybrid', level: 'Senior', minYears: 8, titleWords: ['architect', 'cloud'],
    must: ['azure', 'aws', 'google cloud', 'solution architecture', 'terraform', 'cloud migration'], nice: ['kubernetes', 'finops', 'security', 'presales'], certs: ['azure solutions architect', 'aws solutions architect', 'professional cloud architect'],
    desc: 'Design and lead multi-cloud platforms across Azure, AWS and Google Cloud for enterprise clients.' },
  { id: 'J-102', title: 'Azure Cloud Architect', dept: 'Cloud & Infrastructure', location: 'Kuala Lumpur, Malaysia', type: 'Full-time · Hybrid', level: 'Senior', minYears: 7, titleWords: ['architect', 'azure'],
    must: ['azure', 'solution architecture', 'landing zones', 'terraform', 'security'], nice: ['kubernetes', 'devops', 'finops', 'cloud migration'], certs: ['azure solutions architect', 'az-305'],
    desc: 'Own Azure landing zones, governance and migration designs for regulated customers.' },
  { id: 'J-103', title: 'AWS Cloud Architect', dept: 'Cloud & Infrastructure', location: 'Cyberjaya, Malaysia', type: 'Full-time · Hybrid', level: 'Senior', minYears: 7, titleWords: ['architect', 'aws'],
    must: ['aws', 'solution architecture', 'terraform', 'cloud migration', 'security'], nice: ['kubernetes', 'devops', 'finops', 'networking'], certs: ['aws solutions architect'],
    desc: 'Architect secure, cost-efficient AWS workloads and lead large migrations.' },
  { id: 'J-104', title: 'Google Cloud Architect', dept: 'Cloud & Infrastructure', location: 'Kuala Lumpur, Malaysia', type: 'Full-time · Hybrid', level: 'Senior', minYears: 7, titleWords: ['architect', 'google'],
    must: ['google cloud', 'solution architecture', 'kubernetes', 'terraform', 'data engineering'], nice: ['bigquery', 'security', 'cloud migration', 'finops'], certs: ['professional cloud architect'],
    desc: 'Design data and application platforms on Google Cloud, including GKE and Gemini-based solutions.' },
  { id: 'J-105', title: 'Cloud Presales Solution Architect', dept: 'Sales & Solutions', location: 'Kuala Lumpur, Malaysia', type: 'Full-time · Hybrid', level: 'Senior', minYears: 6, titleWords: ['presales', 'solution', 'architect'],
    must: ['presales', 'solution architecture', 'rfp', 'stakeholder management', 'azure'], nice: ['aws', 'google cloud', 'cloud migration', 'finops'], certs: ['architect'],
    desc: 'Shape deals with customers: discovery workshops, solution design, RFP responses and executive demos.' },
  { id: 'J-106', title: 'Senior DevOps Engineer', dept: 'Cloud & Infrastructure', location: 'Penang, Malaysia', type: 'Full-time · Onsite', level: 'Senior', minYears: 5, titleWords: ['devops', 'engineer'],
    must: ['devops', 'kubernetes', 'ci/cd', 'terraform', 'python'], nice: ['aws', 'azure', 'security'], certs: ['kubernetes', 'ckad', 'cka'],
    desc: 'Build CI/CD, Kubernetes platforms and automation for product teams.' },
  { id: 'J-107', title: 'Cloud Security Architect', dept: 'Cyber Security', location: 'Kuala Lumpur, Malaysia', type: 'Full-time · Hybrid', level: 'Senior', minYears: 8, titleWords: ['security', 'architect'],
    must: ['security', 'identity', 'azure', 'networking', 'solution architecture'], nice: ['aws', 'google cloud', 'devops'], certs: ['cissp', 'security'],
    desc: 'Define zero-trust, identity and network security patterns across cloud platforms.' },
  { id: 'J-108', title: 'Data Platform Architect', dept: 'Data & AI', location: 'Kuala Lumpur, Malaysia', type: 'Full-time · Hybrid', level: 'Senior', minYears: 8, titleWords: ['data', 'architect'],
    must: ['data engineering', 'bigquery', 'solution architecture', 'python', 'google cloud'], nice: ['azure', 'aws', 'ai'], certs: ['professional data engineer', 'architect'],
    desc: 'Lead lakehouse and analytics platform design for enterprise data programmes.' },
  { id: 'J-109', title: 'HR Business Partner', dept: 'Human Resources', location: 'Kuala Lumpur, Malaysia', type: 'Full-time · Onsite', level: 'Mid', minYears: 6, titleWords: ['hr', 'partner'],
    must: ['stakeholder management', 'employee relations', 'hr policy', 'workforce planning'], nice: ['sap successfactors', 'change management'], certs: ['cipd', 'shrm'],
    desc: 'Partner with business leaders on workforce planning, employee relations and policy.' },
  { id: 'J-110', title: 'Payroll Specialist', dept: 'Human Resources', location: 'Kuala Lumpur, Malaysia', type: 'Full-time · Onsite', level: 'Mid', minYears: 3, titleWords: ['payroll'],
    must: ['payroll', 'sap successfactors', 'compliance', 'excel'], nice: ['hr policy'], certs: [],
    desc: 'Run monthly payroll, statutory filings and pay exception reviews.' },
  { id: 'J-111', title: 'Frontend Engineer', dept: 'Engineering', location: 'Remote, Malaysia', type: 'Full-time · Remote', level: 'Mid', minYears: 3, titleWords: ['frontend', 'engineer'],
    must: ['react', 'typescript', 'css', 'testing'], nice: ['python'], certs: [],
    desc: 'Build responsive product interfaces in React and TypeScript.' },
  { id: 'J-112', title: 'Product Manager, AI Agents', dept: 'Product', location: 'Kuala Lumpur, Malaysia', type: 'Full-time · Hybrid', level: 'Senior', minYears: 5, titleWords: ['product', 'manager'],
    must: ['product management', 'ai', 'stakeholder management', 'roadmap'], nice: ['google cloud', 'azure'], certs: [],
    desc: 'Own the roadmap for AI agent products used by enterprise HR and operations teams.' },
];
const jobById = (id) => JOBS.find((j) => j.id === id);

// ---------- The signed-in candidate's resume (mock) ----------
export const RESUME = {
  fullName: 'Riyadh Karim', email: 'riyadh@gmail.com', phone: '+60 12-345 6789', location: 'Kuala Lumpur, Malaysia',
  currentTitle: 'Principal Cloud Architect', currentEmployer: 'Northbridge Digital', yearsExperience: 12, noticePeriod: '30 days',
  education: 'BSc Computer Science, University of Malaya',
  skills: ['Azure', 'AWS', 'Google Cloud', 'Terraform', 'Kubernetes', 'Solution architecture', 'Cloud migration', 'Landing zones', 'FinOps', 'Security', 'Identity (Entra ID)', 'Networking', 'Presales', 'RFP responses', 'Stakeholder management', 'DevOps', 'CI/CD', 'Python'],
  certifications: ['Azure Solutions Architect Expert', 'AWS Solutions Architect Professional', 'Google Professional Cloud Architect', 'TOGAF 9'],
  summary: 'Principal cloud architect with 12 years designing and migrating enterprise workloads across Azure, AWS and Google Cloud, and leading presales for multi-million-dollar cloud programmes.',
};
export const RESUME_TEXT = `RIYADH KARIM
Principal Cloud Architect | Kuala Lumpur, Malaysia
Email: riyadh@gmail.com | Phone: +60 12-345 6789

SUMMARY
Principal cloud architect with 12 years designing and migrating enterprise workloads across Azure, AWS and Google Cloud, and leading presales for multi-million-dollar cloud programmes.

EXPERIENCE
Principal Cloud Architect, Northbridge Digital (2020 - present)
- Lead multi-cloud solution architecture for banking and telco customers on Azure, AWS and Google Cloud.
- Built landing zones and Terraform modules used across 40+ subscriptions; reduced cloud spend 22% through FinOps reviews.
- Run presales: discovery workshops, RFP responses, architecture demos and executive proposals.
Senior Cloud Engineer, Axiata Digital (2015 - 2020)
- Migrated 120+ workloads to Azure and AWS; built Kubernetes platforms and CI/CD pipelines in Python and Azure DevOps.
- Designed identity (Entra ID), networking and zero-trust security patterns.

SKILLS
Azure, AWS, Google Cloud, Terraform, Kubernetes, Solution architecture, Cloud migration, Landing zones, FinOps, Security, Identity (Entra ID), Networking, Presales, RFP responses, Stakeholder management, DevOps, CI/CD, Python

CERTIFICATIONS
Azure Solutions Architect Expert; AWS Solutions Architect Professional; Google Professional Cloud Architect; TOGAF 9

EDUCATION
BSc Computer Science, University of Malaya

AVAILABILITY
Notice period: 30 days`;

// ---------- Mock applicants already in the pool (self-declared gender is used for slate balance only) ----------
const mk = (n, id, name, gender, title, yrs, skills, certs, edu, loc, notice, jobIds, summary) => ({
  id: `APP-${1000 + n}`, candidateId: id, status: 'Under review', submittedAt: `2026-10-${String(10 + (n % 18)).padStart(2, '0')}T09:00:00Z`, jobIds,
  fields: { fullName: name, email: `${name.toLowerCase().replace(/[^a-z]+/g, '.')}@example.com`, phone: '+60 11-0000 0000', location: loc, currentTitle: title, yearsExperience: yrs, skills, certifications: certs, education: edu, noticePeriod: notice, summary, gender },
});
const SEED = [
  mk(1, 'C-2001', 'Aisha Rahman', 'Female', 'Principal Cloud Architect', 14, ['Azure', 'AWS', 'Google Cloud', 'Terraform', 'Kubernetes', 'Solution architecture', 'Cloud migration', 'FinOps', 'Security', 'Presales'], ['Azure Solutions Architect Expert', 'AWS Solutions Architect Professional', 'Professional Cloud Architect'], 'MSc Computing', 'Kuala Lumpur, Malaysia', '60 days', ['J-101', 'J-105'], 'Leads multi-cloud transformation programmes and has migrated 200+ workloads.'),
  mk(2, 'C-2002', 'Daniel Tan', 'Male', 'Cloud Solutions Architect', 11, ['Azure', 'AWS', 'Terraform', 'Solution architecture', 'Cloud migration', 'Kubernetes', 'DevOps'], ['AWS Solutions Architect Professional', 'Azure Solutions Architect Expert'], 'BEng Software Engineering', 'Petaling Jaya, Malaysia', '30 days', ['J-101', 'J-102'], 'Architect for banking cloud migrations on Azure and AWS.'),
  mk(3, 'C-2003', 'Priya Nair', 'Female', 'Senior Cloud Architect', 9, ['AWS', 'Google Cloud', 'Terraform', 'Solution architecture', 'Cloud migration', 'BigQuery', 'Security'], ['Professional Cloud Architect', 'AWS Solutions Architect Associate'], 'BSc Information Systems', 'Kuala Lumpur, Malaysia', '45 days', ['J-101', 'J-104'], 'Designs data-centric platforms on Google Cloud and AWS.'),
  mk(4, 'C-2004', 'Marcus Lee', 'Male', 'Cloud Engineer', 8, ['AWS', 'Azure', 'Terraform', 'Kubernetes', 'CI/CD', 'DevOps'], ['AWS Solutions Architect Associate'], 'BSc Computer Science', 'Cyberjaya, Malaysia', '30 days', ['J-101', 'J-106'], 'Platform engineer moving into architecture.'),
  mk(5, 'C-2005', 'Sofia Alvarez', 'Female', 'Enterprise Architect', 12, ['Azure', 'Solution architecture', 'Landing zones', 'Security', 'Identity', 'Networking', 'Presales', 'RFP', 'Stakeholder management'], ['Azure Solutions Architect Expert', 'TOGAF'], 'MBA, BSc Engineering', 'Kuala Lumpur, Malaysia', '60 days', ['J-101', 'J-102', 'J-105'], 'Enterprise architect for regulated industries with strong presales experience.'),
  mk(6, 'C-2006', "James O'Connor", 'Male', 'Head of Cloud Practice', 15, ['Azure', 'AWS', 'Google Cloud', 'Solution architecture', 'Presales', 'RFP', 'Stakeholder management', 'Cloud migration', 'FinOps'], ['Azure Solutions Architect Expert', 'Professional Cloud Architect'], 'BSc Computer Science', 'Singapore', '90 days', ['J-101', 'J-105'], 'Runs a 40-person cloud practice and leads multi-cloud pursuits.'),
  mk(7, 'C-2007', 'Nurul Huda', 'Female', 'Cloud Engineer', 7, ['Azure', 'Terraform', 'DevOps', 'Kubernetes', 'CI/CD'], ['AZ-104'], 'BSc IT', 'Shah Alam, Malaysia', '30 days', ['J-101', 'J-102'], 'Azure platform engineer.'),
  mk(8, 'C-2008', 'Wei Zhang', 'Male', 'Cloud Architect', 10, ['AWS', 'Google Cloud', 'Kubernetes', 'Terraform', 'Data engineering', 'BigQuery', 'Python'], ['Professional Cloud Architect', 'AWS Solutions Architect Professional'], 'MSc Data Science', 'Kuala Lumpur, Malaysia', '30 days', ['J-101', 'J-104'], 'Cloud and data architect on AWS and Google Cloud.'),
  mk(9, 'C-2009', 'Fatima Zahra', 'Female', 'Solutions Consultant', 6, ['Azure', 'Presales', 'RFP', 'Stakeholder management', 'Solution architecture'], ['AZ-305'], 'BBA Information Systems', 'Kuala Lumpur, Malaysia', '30 days', ['J-101', 'J-105'], 'Presales consultant for Azure solutions.'),
  mk(10, 'C-2010', 'Kenji Sato', 'Male', 'Systems Engineer', 5, ['AWS', 'Linux', 'Networking', 'Python'], [], 'BEng Electrical', 'Penang, Malaysia', '30 days', ['J-101', 'J-103'], 'Infrastructure engineer exploring cloud architecture.'),
  mk(11, 'C-2011', 'Olivia Brown', 'Female', 'Cloud Security Architect', 13, ['Azure', 'AWS', 'Security', 'Identity', 'Networking', 'Solution architecture', 'Landing zones'], ['CISSP', 'Azure Solutions Architect Expert'], 'MSc Cyber Security', 'Kuala Lumpur, Malaysia', '60 days', ['J-107', 'J-102', 'J-101'], 'Security architect for cloud landing zones and zero-trust.'),
  mk(12, 'C-2012', 'Arjun Mehta', 'Male', 'AWS Architect', 9, ['AWS', 'Solution architecture', 'Terraform', 'Cloud migration', 'Security', 'Kubernetes', 'FinOps'], ['AWS Solutions Architect Professional'], 'BTech Computer Science', 'Cyberjaya, Malaysia', '45 days', ['J-103', 'J-101'], 'AWS architect for large migrations.'),
  mk(13, 'C-2013', 'Linh Tran', 'Female', 'Presales Consultant', 8, ['Presales', 'RFP', 'Solution architecture', 'Stakeholder management', 'Azure', 'AWS'], ['AWS Solutions Architect Associate'], 'BSc Business IT', 'Kuala Lumpur, Malaysia', '30 days', ['J-105'], 'Presales lead for cloud and managed services.'),
  mk(14, 'C-2014', 'Ahmad Faiz', 'Male', 'DevOps Engineer', 7, ['DevOps', 'Kubernetes', 'CI/CD', 'Terraform', 'Python', 'AWS'], ['CKA', 'CKAD'], 'BSc Computer Science', 'Penang, Malaysia', '30 days', ['J-106'], 'Kubernetes and CI/CD specialist.'),
  mk(15, 'C-2015', 'Grace Lim', 'Female', 'Payroll Executive', 4, ['Payroll', 'SAP SuccessFactors', 'Compliance', 'Excel'], [], 'Diploma Accounting', 'Kuala Lumpur, Malaysia', '30 days', ['J-110'], 'Payroll processing and statutory filings.'),
  mk(16, 'C-2016', 'Hannah Wright', 'Female', 'HR Business Partner', 7, ['Stakeholder management', 'Employee relations', 'HR policy', 'Workforce planning'], ['CIPD'], 'BA Human Resources', 'Kuala Lumpur, Malaysia', '60 days', ['J-109'], 'HRBP for technology business units.'),
];

// ---------- Persistence of submitted applications ----------
const submitted = await store.load('applications', []);
const save = () => store.save('applications', submitted);

// All applications as one flat list: {id, jobId, candidateName, fields, submittedAt, status, mine}
const pool = () => [
  ...SEED.flatMap((a) => a.jobIds.map((jobId) => ({ id: `${a.id}-${jobId}`, jobId, fields: a.fields, submittedAt: a.submittedAt, status: a.status }))),
  ...submitted,
];

// ---------- Interview rounds: one-click scheduling, status per round, candidate confirmation ----------
const interviews = await store.load('interviews', {});
const saveInterviews = () => store.save('interviews', interviews);

const ROUNDS = [
  { n: 1, name: 'HR screen', panel: 'HR · Priya Menon' },
  { n: 2, name: 'Technical interview', panel: 'Cloud practice panel' },
  { n: 3, name: 'Final panel', panel: 'Hiring manager and Practice Head' },
];
const NS = 'Not scheduled', CP = 'Confirmation pending', SC = 'Scheduled', DONE = 'Completed';
// Mixed progress for the candidates already in the pool, chosen from the application id so it stays stable.
const PATTERNS = [[NS, NS, NS], [DONE, CP, NS], [DONE, SC, NS], [DONE, DONE, CP], [CP, NS, NS], [SC, NS, NS], [DONE, NS, NS], [NS, NS, NS], [DONE, DONE, SC]];
const hash = (s) => [...String(s)].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7);
const slotAt = (dayOffset, hour) => { const d = new Date(); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + dayOffset); d.setUTCHours(hour - 8, 0, 0, 0); return d.toISOString(); }; // hour is Malaysia time (UTC+8)

// Seeded interviews fall on business days at normal interview hours (Malaysia time).
const bizAt = (offset, hour) => { let o = offset; const dir = offset < 0 ? -1 : 1; while ([0, 6].includes(new Date(slotAt(o, 12)).getUTCDay())) o += dir; return slotAt(o, hour); };
const HOURS = [10, 11, 14, 15];

function seedRounds(a) {
  const p = a.mine ? [NS, NS, NS] : PATTERNS[hash(a.id) % PATTERNS.length];
  return ROUNDS.map((r, i) => ({ ...r, status: p[i], when: p[i] === DONE ? bizAt(-(3 - i) * 4 - (hash(a.id) % 3), HOURS[(hash(a.id) + i) % 4]) : p[i] === NS ? null : bizAt(2 + i + (hash(a.id) % 3), HOURS[(hash(a.id) + i) % 4]) }));
}
const roundsFor = (a) => interviews[a.id] || seedRounds(a);

// What the one-click button should do for this candidate
function nextAction(rounds) {
  const r = rounds.find((x) => x.status !== DONE);
  if (!r) return null;
  if (r.status === NS) return { type: 'schedule', round: r.n, label: `Schedule Round ${r.n}` };
  if (r.status === CP) return { type: 'resend', round: r.n, label: `Resend Round ${r.n} invite` };
  return { type: 'wait', round: r.n, label: `Round ${r.n} scheduled` };
}

// Next free slot: business days starting tomorrow, four interviews a day (Malaysia time)
function nextSlot() {
  const taken = Object.values(interviews).flat().filter((r) => r.when && r.status !== DONE).length;
  let day = 1, left = taken;
  const free = () => { const dow = new Date(slotAt(day, 12)).getUTCDay(); return dow !== 0 && dow !== 6; };
  while (!free()) day++;
  while (left >= 4) { left -= 4; day++; while (!free()) day++; }
  return slotAt(day, [10, 11, 14, 15][left]);
}

const findApp = (id) => pool().find((a) => a.id === id);

export function scheduleNext(applicationId) {
  const a = findApp(applicationId);
  if (!a) throw new Error('Unknown application.');
  const rounds = roundsFor(a).map((r) => ({ ...r }));
  const act = nextAction(rounds);
  if (!act) throw new Error('All interview rounds are already completed.');
  if (act.type === 'wait') throw new Error(`Round ${act.round} is already scheduled.`);
  const r = rounds.find((x) => x.n === act.round);
  if (act.type === 'schedule') { r.status = CP; r.when = nextSlot(); }
  r.invitedAt = new Date().toISOString();
  interviews[a.id] = rounds; saveInterviews();
  return { applicationId: a.id, candidate: a.fields.fullName, round: r.n, roundName: r.name, status: r.status, when: r.when, panel: r.panel, resent: act.type === 'resend', next: nextAction(rounds) };
}

// The candidate confirms the proposed slot in the portal
export function confirmInterview(user, reference) {
  const a = submitted.find((x) => x.id === reference && x.candidateEmail === user.email);
  if (!a) throw new Error('Application not found.');
  const rounds = roundsFor(a).map((r) => ({ ...r }));
  const r = rounds.find((x) => x.status === CP);
  if (!r) throw new Error('There is no interview waiting for your confirmation.');
  r.status = SC; r.confirmedAt = new Date().toISOString();
  interviews[a.id] = rounds; saveInterviews();
  return { reference, round: r.n, when: r.when };
}
const interviewOf = (a) => { const rounds = roundsFor(a); return { rounds, next: nextAction(rounds) }; };

// ---------- Gemini (JSON), with fallbacks everywhere ----------
async function gemJson(system, payload, ms = 30000) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${process.env.GEMINI_MODEL || 'gemini-3.5-flash'}:generateContent`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({ systemInstruction: { parts: [{ text: system }] }, contents: [{ role: 'user', parts: [{ text: typeof payload === 'string' ? payload : JSON.stringify(payload) }] }], generationConfig: { temperature: 0.2, responseMimeType: 'application/json' } }),
      signal: AbortSignal.timeout(ms),
    });
    if (!res.ok) return null;
    const text = (await res.json()).candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
    return JSON.parse(text.replace(/^```json\s*|```$/g, '').trim());
  } catch { return null; }
}

// ---------- ATS scoring: skills, experience, certifications, role fit. Gender, name and age are never inputs. ----------
export function ats(fields, job) {
  const skills = Array.isArray(fields.skills) ? fields.skills : [];
  const certs = Array.isArray(fields.certifications) ? fields.certifications : [];
  const scan = [skills.join(' '), fields.currentTitle || '', fields.summary || '', certs.join(' ')].join(' ');
  const have = found(scan);
  const matched = job.must.filter((s) => have.has(s));
  const missing = job.must.filter((s) => !have.has(s));
  const niceMatched = job.nice.filter((s) => have.has(s));
  const yrs = Number(fields.yearsExperience) || 0;
  const certText = certs.join(' ').toLowerCase();
  const certHits = job.certs.filter((c) => certText.includes(c));
  const certNeed = Math.min(2, job.certs.length);
  const titleText = `${fields.currentTitle || ''} ${fields.summary || ''}`.toLowerCase();
  const titleHits = job.titleWords.filter((w) => titleText.includes(w));
  const need = ['fullName', 'email', 'phone', 'location', 'currentTitle', 'yearsExperience', 'skills', 'certifications', 'education', 'noticePeriod'];
  const filled = need.filter((k) => (Array.isArray(fields[k]) ? fields[k].length : String(fields[k] ?? '').trim())).length;
  const parts = [
    { key: 'skills', label: 'Required skills', max: 40, pts: Math.round(40 * (matched.length / job.must.length)), detail: `${matched.length} of ${job.must.length} required skills found${missing.length ? `; missing ${missing.join(', ')}` : ''}` },
    { key: 'experience', label: 'Experience', max: 20, pts: Math.round(20 * Math.min(1, yrs / job.minYears)), detail: `${yrs} years against ${job.minYears}+ required` },
    { key: 'certifications', label: 'Certifications', max: 15, pts: certNeed ? Math.round(15 * Math.min(1, certHits.length / certNeed)) : 15, detail: certHits.length ? `${certHits.length} relevant: ${certs.filter((c) => job.certs.some((k) => c.toLowerCase().includes(k))).join(', ')}` : 'No directly relevant certification found' },
    { key: 'role', label: 'Role fit', max: 10, pts: Math.round(10 * (titleHits.length / job.titleWords.length)), detail: `Current role "${fields.currentTitle || 'n/a'}" vs ${job.title}` },
    { key: 'bonus', label: 'Nice-to-have skills', max: 10, pts: job.nice.length ? Math.round(10 * (niceMatched.length / job.nice.length)) : 10, detail: niceMatched.length ? `Also has ${niceMatched.join(', ')}` : 'None of the preferred skills found' },
    { key: 'complete', label: 'Application completeness', max: 5, pts: Math.round(5 * (filled / need.length)), detail: `${filled} of ${need.length} key fields provided` },
  ];
  return { total: parts.reduce((s, p) => s + p.pts, 0), parts, matched, missing, niceMatched };
}

// ---------- Candidate: AI job search against the resume ----------
const STOP = new Set(['a', 'an', 'the', 'for', 'and', 'or', 'in', 'of', 'to', 'role', 'roles', 'job', 'jobs', 'looking', 'find', 'me', 'my', 'with', 'at', 'on']);
const relevance = (query, job) => {
  const words = query.toLowerCase().split(/[^a-z0-9+/#]+/).filter((w) => w && !STOP.has(w));
  if (!words.length) return 1;
  const hay = `${job.title} ${job.dept} ${job.desc} ${job.must.join(' ')} ${job.nice.join(' ')}`.toLowerCase();
  const title = job.title.toLowerCase();
  const hit = words.filter((w) => hay.includes(w) || hay.includes(w.replace(/s$/, '')));
  const inTitle = words.filter((w) => title.includes(w)).length;
  return Math.min(1, (hit.length + inTitle * 0.5) / words.length);
};

export async function searchJobs(user, query = '') {
  const q = String(query).slice(0, 200).trim();
  const scored = JOBS.map((job) => {
    const s = ats(RESUME, job);
    const rel = relevance(q, job);
    return { job, s, rel, rank: q ? 0.7 * s.total + 30 * rel : s.total };
  }).filter((r) => !q || r.rel >= 0.5).sort((a, b) => b.rank - a.rank);
  const top = scored.slice(0, 8).sort((x, y) => y.s.total - x.s.total || y.rel - x.rel);
  const mine = new Set(submitted.filter((a) => a.candidateEmail === user.email).map((a) => a.jobId));

  const ai = top.length ? await gemJson(
    'You are a career assistant for a job portal. Given the candidate resume and matching roles, return JSON {"summary": string (two sentences addressed to the candidate, no markdown), "reasons": {jobId: string}} where each reason is one sentence (max 25 words) saying why this role fits the resume, naming concrete skills, certifications or years. Only use facts in the data.',
    { query: q, resume: { title: RESUME.currentTitle, years: RESUME.yearsExperience, skills: RESUME.skills, certifications: RESUME.certifications, summary: RESUME.summary }, roles: top.map((r) => ({ id: r.job.id, title: r.job.title, matched: r.s.matched, missing: r.s.missing, score: r.s.total })) },
  ) : null;

  return {
    query: q,
    summary: ai?.summary || (top.length ? `I found ${top.length} roles that fit your resume${q ? ` for "${q}"` : ''}. The strongest is ${top[0].job.title} at ${top[0].s.total}% match.` : `No roles matched "${q}". Try a broader search such as "cloud architect".`),
    aiGenerated: Boolean(ai),
    results: top.map((r) => ({
      id: r.job.id, title: r.job.title, dept: r.job.dept, location: r.job.location, type: r.job.type, level: r.job.level, desc: r.job.desc, minYears: r.job.minYears,
      matchPct: r.s.total, matched: r.s.matched, missing: r.s.missing, preferred: r.s.niceMatched, applied: mine.has(r.job.id),
      reason: ai?.reasons?.[r.job.id] || `Your resume covers ${r.s.matched.length} of ${r.job.must.length} required skills${r.s.matched.length ? ` (${r.s.matched.slice(0, 3).join(', ')})` : ''} and ${RESUME.yearsExperience} years of experience.`,
    })),
  };
}

// ---------- Candidate: Gemini extracts the submission fields from the resume ----------
const REQUIRED = ['fullName', 'email', 'phone', 'location', 'currentTitle', 'yearsExperience', 'skills', 'education', 'noticePeriod'];
export async function prepareApplication(user, jobId) {
  const job = jobById(jobId);
  if (!job) throw new Error('That role is no longer open.');
  const ai = await gemJson(
    'Extract job-application fields from the resume text. Return JSON with exactly these keys: fullName, email, phone, location, currentTitle, currentEmployer, yearsExperience (number), skills (array of strings), certifications (array of strings), education, noticePeriod, summary (two sentences tailored to the target role, factual). Use null for anything not in the resume. Do not infer or output gender, age, nationality or marital status.',
    { targetRole: job.title, resume: RESUME_TEXT },
  );
  const base = ai && typeof ai === 'object' ? ai : null;
  const { fullName, email, phone, location, currentTitle, currentEmployer, yearsExperience, skills, certifications, education, noticePeriod, summary } = { ...RESUME, ...Object.fromEntries(Object.entries(base || {}).filter(([, v]) => v !== null && v !== '' && !(Array.isArray(v) && !v.length))) };
  const properName = (n) => (n && n === n.toUpperCase() ? n.toLowerCase().replace(/(^|[s'-])([a-z])/g, (m, p, c) => p + c.toUpperCase()) : n);
  const fields = { fullName: properName(fullName), email: email || user.email, phone, location, currentTitle, currentEmployer, yearsExperience: Number(yearsExperience) || 0, skills: Array.isArray(skills) ? skills : [], certifications: Array.isArray(certifications) ? certifications : [], education, noticePeriod, summary };
  return { job: { id: job.id, title: job.title, dept: job.dept, location: job.location }, fields, source: base ? 'gemini' : 'parsed', required: REQUIRED };
}

// ---------- Candidate: submit ----------
export function submitApplication(user, jobId, f = {}) {
  const job = jobById(jobId);
  if (!job) throw new Error('That role is no longer open.');
  const list = (v) => (Array.isArray(v) ? v : String(v || '').split(/[,;\n]/)).map((s) => String(s).trim()).filter(Boolean).slice(0, 40);
  const fields = {
    fullName: String(f.fullName || '').trim().slice(0, 120), email: String(f.email || user.email).trim().slice(0, 160), phone: String(f.phone || '').trim().slice(0, 40),
    location: String(f.location || '').trim().slice(0, 120), currentTitle: String(f.currentTitle || '').trim().slice(0, 120), currentEmployer: String(f.currentEmployer || '').trim().slice(0, 120),
    yearsExperience: Math.max(0, Math.min(60, Number(f.yearsExperience) || 0)), skills: list(f.skills), certifications: list(f.certifications),
    education: String(f.education || '').trim().slice(0, 160), noticePeriod: String(f.noticePeriod || '').trim().slice(0, 40), summary: String(f.summary || '').trim().slice(0, 600),
    // Optional self-declared answer, used only to monitor and balance the shortlist; never an input to the ATS score.
    gender: ['Male', 'Female'].includes(f.gender) ? f.gender : 'Prefer not to say',
  };
  const missing = REQUIRED.filter((k) => (Array.isArray(fields[k]) ? !fields[k].length : !String(fields[k] ?? '').trim()));
  if (missing.length) throw new Error(`Please complete: ${missing.join(', ')}.`);
  const existing = submitted.findIndex((a) => a.candidateEmail === user.email && a.jobId === jobId);
  const rec = { id: existing >= 0 ? submitted[existing].id : `APP-${3000 + submitted.length + 1}`, jobId, candidateEmail: user.email, fields, submittedAt: new Date().toISOString(), status: 'Received', mine: true };
  if (existing >= 0) submitted[existing] = rec; else submitted.push(rec);
  save();
  return { reference: rec.id, job: { id: job.id, title: job.title }, submittedAt: rec.submittedAt };
}

export const myApplications = (user) => submitted.filter((a) => a.candidateEmail === user.email)
  .map((a) => ({ reference: a.id, jobId: a.jobId, title: jobById(a.jobId)?.title || a.jobId, submittedAt: a.submittedAt, status: a.status, interview: interviewOf(a) }))
  .sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

export const candidateProfile = (user) => ({
  name: RESUME.fullName, title: RESUME.currentTitle, location: RESUME.location, years: RESUME.yearsExperience, skills: RESUME.skills, certifications: RESUME.certifications,
  education: RESUME.education, summary: RESUME.summary, applications: myApplications(user),
});

// ---------- HR: jobs with applicant counts, and the top-5 shortlist ----------
export const openJobs = () => JOBS.map((j) => ({ id: j.id, title: j.title, dept: j.dept, location: j.location, minYears: j.minYears, must: j.must, applicants: pool().filter((a) => a.jobId === j.id).length }))
  .filter((j) => j.applicants > 0).sort((a, b) => b.applicants - a.applicants);

const rationaleCache = new Map();

export async function shortlist(jobId, balanced = true) {
  const job = jobById(jobId);
  if (!job) throw new Error('Unknown job.');
  const apps = pool().filter((a) => a.jobId === jobId);
  const scored = apps.map((a) => ({ a, s: ats(a.fields, job) }))
    .sort((x, y) => y.s.total - x.s.total || (Number(y.a.fields.yearsExperience) || 0) - (Number(x.a.fields.yearsExperience) || 0) || x.a.submittedAt.localeCompare(y.a.submittedAt));

  // Compose the slate. Balanced: best overall profile, then best 2 men and best 2 women from the rest (gender is self-declared and
  // used only for slate composition). Any gap is filled by the next-best scores. Unbalanced: pure top 5 by score.
  let slate = []; const slot = new Map();
  if (balanced) {
    const [top, ...rest] = scored;
    if (top) { slate.push(top); slot.set(top.a.id, 'Top profile'); }
    for (const g of ['Male', 'Female']) for (const r of rest.filter((x) => x.a.fields.gender === g).slice(0, 2)) { slate.push(r); slot.set(r.a.id, `Slate · ${g === 'Male' ? 'Man' : 'Woman'}`); }
    for (const r of rest) { if (slate.length >= 5) break; if (!slate.includes(r)) { slate.push(r); slot.set(r.a.id, 'Next best score'); } }
  } else {
    slate = scored.slice(0, 5); slate.forEach((r, i) => slot.set(r.a.id, i === 0 ? 'Top profile' : 'Score rank'));
  }
  slate.sort((x, y) => y.s.total - x.s.total);

  const base = (r) => {
    const strong = r.s.parts.filter((p) => p.pts >= p.max * 0.8).map((p) => p.label.toLowerCase());
    return `${r.a.fields.fullName || 'This candidate'} scores ${r.s.total}/100: ${r.s.matched.length} of ${job.must.length} required skills, ${r.a.fields.yearsExperience} years' experience${strong.length ? ` and strong ${strong.slice(0, 3).join(', ')}` : ''}.${r.s.missing.length ? ` Gap: ${r.s.missing.join(', ')}.` : ' No required-skill gaps.'}`;
  };
  const cacheKey = `${jobId}|${slate.map((r) => `${r.a.id}:${r.s.total}`).join(',')}`;
  let notes = rationaleCache.get(cacheKey);
  if (!notes) {
    const ai = await gemJson(
      'You explain a recruiting shortlist to an HR analyst. For each candidate return one or two plain sentences (max 40 words) on why they are on the shortlist, using only the scorecard facts. Never mention gender or name-based assumptions. Return JSON {"notes": {applicationId: string}}.',
      { role: job.title, candidates: slate.map((r) => ({ id: r.a.id, score: r.s.total, matched: r.s.matched, missing: r.s.missing, years: r.a.fields.yearsExperience, certifications: r.a.fields.certifications, scorecard: r.s.parts.map((p) => `${p.label} ${p.pts}/${p.max}`) })) },
    );
    notes = ai?.notes || {};
    rationaleCache.set(cacheKey, notes);
  }

  const compose = { men: slate.filter((r) => r.a.fields.gender === 'Male').length, women: slate.filter((r) => r.a.fields.gender === 'Female').length };
  return {
    job: { id: job.id, title: job.title, dept: job.dept, location: job.location, minYears: job.minYears, must: job.must },
    totalApplicants: apps.length, balanced, aiGenerated: Object.keys(notes).length > 0,
    composition: { topProfile: balanced ? 1 : 0, men: compose.men, women: compose.women },
    candidates: slate.map((r, i) => ({
      rank: i + 1, applicationId: r.a.id, name: r.a.fields.fullName, title: r.a.fields.currentTitle, employer: r.a.fields.currentEmployer || null, location: r.a.fields.location,
      years: r.a.fields.yearsExperience, noticePeriod: r.a.fields.noticePeriod, certifications: r.a.fields.certifications, education: r.a.fields.education,
      slot: slot.get(r.a.id), score: r.s.total, scorecard: r.s.parts, matched: r.s.matched, missing: r.s.missing, preferred: r.s.niceMatched,
      why: notes[r.a.id] || base(r), isNew: Boolean(r.a.mine), submittedAt: r.a.submittedAt, interview: interviewOf(r.a),
    })),
    fairness: 'Scores use skills, experience, certifications and role fit only. Name, gender and age are not scoring inputs. Gender is a self-declared field used only to compose a balanced slate.',
  };
}

// Recent portal submissions, for the HR notification
export const recentSubmissions = () => submitted.slice(-5).reverse().map((a) => ({ name: a.fields.fullName, jobId: a.jobId, title: jobById(a.jobId)?.title, at: a.submittedAt }));

// ---------- Agent tool for the Recruitment Operations agent ----------
export const jobsTools = {
  schedule_interview_round: {
    description: 'One-click scheduling of the next interview round for a shortlisted portal candidate. Pass the candidate name (or application ID like APP-3001) and optionally the job. It proposes the next free slot, sends the invite and sets that round to Confirmation pending until the candidate confirms. Also resends a pending invite.',
    parameters: { type: 'OBJECT', properties: { candidate: { type: 'STRING', description: 'Candidate name or application ID' }, job: { type: 'STRING', description: 'Job ID like J-101 or part of the title, to pick the right application' } }, required: ['candidate'] },
    source: 'Job portal',
    run: async (u, { candidate, job }) => {
      const q = String(candidate || '').toLowerCase();
      const j = job ? JOBS.find((x) => x.id.toLowerCase() === String(job).toLowerCase() || x.title.toLowerCase().includes(String(job).toLowerCase())) : null;
      const hits = pool().filter((a) => (a.id.toLowerCase() === q || (a.fields.fullName || '').toLowerCase().includes(q)) && (!j || a.jobId === j.id));
      if (!hits.length) return { error: `No candidate matches "${candidate}".` };
      if (new Set(hits.map((h) => h.jobId)).size > 1) return { error: 'That candidate applied to several roles. Say which role: ' + hits.map((h) => `${h.id} (${jobById(h.jobId)?.title})`).join('; ') };
      try { return { ...scheduleNext(hits[0].id), role: jobById(hits[0].jobId)?.title }; } catch (e) { return { error: e.message }; }
    },
  },
  shortlist_candidates: {
    description: 'Get the ATS-ranked top 5 candidates from the job portal for one open role, with a scorecard for each. Pass jobId (for example J-101) or the job title. By default the slate is balanced: the best overall profile plus the best 2 men and best 2 women. Use balanced=false for a pure score ranking.',
    parameters: { type: 'OBJECT', properties: { job: { type: 'STRING', description: 'Job ID like J-101, or part of the job title' }, balanced: { type: 'BOOLEAN', description: 'false for a pure top 5 by score' } }, required: ['job'] },
    source: 'Job portal',
    run: async (u, { job, balanced = true }) => {
      const q = String(job || '').toLowerCase();
      const j = JOBS.find((x) => x.id.toLowerCase() === q) || JOBS.find((x) => x.title.toLowerCase().includes(q));
      if (!j) return { error: `No open role matches "${job}". Open roles: ${openJobs().map((x) => `${x.id} ${x.title}`).join('; ')}` };
      const s = await shortlist(j.id, balanced !== false);
      return { role: s.job.title, jobId: s.job.id, totalApplicants: s.totalApplicants, balancedSlate: s.balanced, note: s.fairness, candidates: s.candidates.map((c) => ({ rank: c.rank, applicationId: c.applicationId, candidate: c.name, currentRole: c.title, years: c.years, slot: c.slot, atsScore: c.score, requiredSkillsMatched: `${c.matched.length}/${s.job.must.length}`, missing: c.missing, why: c.why })) };
    },
  },
};
