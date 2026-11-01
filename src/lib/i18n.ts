// UI language (English / Arabic) and theme (dark / light), stored per browser.
// t("English text") returns the Arabic translation when Arabic is on, or the English text when there is none,
// so server-provided labels (KPI names, widget titles) translate through the same table.
import { createContext, useContext } from 'react';

export type Lang = 'en' | 'ar';
export type Theme = 'dark' | 'light';

const AR: Record<string, string> = {
  // Shell
'Operations overview': 'نظرة عامة على العمليات', 'My overview': 'نظرتي العامة',
  'HR operations agents': 'وكلاء عمليات الموارد البشرية', 'My HR agents': 'وكلاء الموارد البشرية الخاصون بي',
  'Documents · OneDrive': 'المستندات · OneDrive', 'Documents': 'المستندات', 'Sign out': 'تسجيل الخروج', 'Notifications': 'الإشعارات',
  'HR operations overview': 'نظرة عامة على عمليات الموارد البشرية', 'My HR overview': 'نظرة عامة على مواردي البشرية',
  'Live workforce, recruiting, performance and payroll signals': 'مؤشرات مباشرة للقوى العاملة والتوظيف والأداء والرواتب',
  'Your leave, pay, tasks and opportunities at a glance': 'إجازاتك وراتبك ومهامك وفرصك في لمحة',
  'Browse OneDrive and let Gemini extract the key details from any document': 'تصفح OneDrive ودع Gemini يستخرج التفاصيل الرئيسية من أي مستند',
  'Send': 'إرسال', 'Ask agent': 'اسأل الوكيل', 'Ask': 'اسأل', 'Refresh dashboard': 'تحديث لوحة المعلومات',
  'Light theme': 'المظهر الفاتح', 'Dark theme': 'المظهر الداكن', 'Executive report': 'التقرير التنفيذي', 'Send to Teams': 'إرسال إلى Teams',
  'No notifications.': 'لا توجد إشعارات.', 'All caught up on urgent items': 'لا توجد عناصر عاجلة', 'urgent': 'عاجل',
  'Pick a suggestion below or ask your own question.': 'اختر اقتراحًا أدناه أو اطرح سؤالك.',
  'Querying SAP SuccessFactors and thinking…': 'جارٍ الاستعلام من SAP SuccessFactors والتفكير…', 'Checking your HR records…': 'جارٍ التحقق من سجلاتك…',
  // Greeting
  'Good morning': 'صباح الخير', 'Good afternoon': 'مساء الخير', 'Good evening': 'مساء الخير',
  'What needs my attention today?': 'ما الذي يحتاج إلى اهتمامي اليوم؟', 'Prepare the leadership report': 'إعداد تقرير القيادة', 'Triage new cases': 'فرز الحالات الجديدة',
  'Plan time off around the holidays': 'خطط لإجازتك حول العطلات', 'Why did my pay change?': 'لماذا تغير راتبي؟', 'Path to Staff Engineer': 'المسار إلى مهندس أول',
  'Connected to SAP SuccessFactors': 'متصل بـ SAP SuccessFactors', 'Next holiday': 'العطلة القادمة',
  // Filters
  'Division': 'القطاع', 'All divisions': 'جميع القطاعات', 'Period': 'الفترة', 'All': 'الكل', 'Clear filter': 'مسح التصفية',
  '1y': 'سنة', '3y': '3 سنوات', '5y': '5 سنوات', '10y': '10 سنوات', 'Filtered to': 'مصفّى حسب',
  // KPIs (server labels)
  'Active employees': 'الموظفون النشطون', 'Vacant positions': 'الوظائف الشاغرة', 'Open requisitions': 'طلبات التوظيف المفتوحة',
  'Approvals waiting': 'موافقات معلقة', 'Reviews overdue': 'تقييمات متأخرة', 'Pending workflows': 'سير عمل معلق',
  'Annual leave left': 'الإجازة السنوية المتبقية', 'Latest net pay': 'آخر صافي راتب', 'Office days': 'أيام المكتب', 'Open tasks': 'مهام مفتوحة',
  // HR widgets
  'Headcount by division': 'عدد الموظفين حسب القطاع', 'Click a division to filter the dashboard': 'انقر على قطاع لتصفية لوحة المعلومات',
  'Hiring trend': 'اتجاه التوظيف', 'New hires by year': 'التعيينات الجديدة حسب السنة', 'Retention risk': 'مخاطر الاحتفاظ بالموظفين',
  'Employees with a risk-of-loss rating': 'الموظفون الذين لديهم تقييم لخطر الفقدان', 'key talent': 'مواهب رئيسية',
  'Recruiting pipeline': 'مسار التوظيف', 'applications': 'طلبات', 'Performance cycle': 'دورة الأداء', 'Review forms completed': 'نماذج التقييم المكتملة',
  'Most recently overdue': 'المتأخرة مؤخرًا', 'Payroll exceptions': 'استثناءات الرواتب', 'Recurring pay records checked against peers': 'سجلات الرواتب المتكررة مقارنة بالأقران',
  'Employee documents': 'مستندات الموظفين', 'Identity and work-permit documents': 'مستندات الهوية وتصاريح العمل',
  'Timesheet to-dos': 'مهام الجداول الزمنية', 'Missing expiry date': 'تاريخ انتهاء مفقود', 'Workflow requests': 'طلبات سير العمل',
  'Pending approvals by age': 'الموافقات المعلقة حسب العمر', 'Training completion': 'إكمال التدريب', 'Mandatory training by department': 'التدريب الإلزامي حسب القسم',
  'Workforce by country': 'القوى العاملة حسب الدولة', 'Top locations': 'أهم المواقع', 'Top departments': 'أهم الأقسام', 'Key talent at risk': 'مواهب رئيسية معرضة للخطر',
  'SAP SuccessFactors is busy right now. This widget will fill in on the next refresh.': 'SAP SuccessFactors مشغول حاليًا. سيتم ملء هذه الأداة في التحديث التالي.',
  // Employee widgets
  'Leave balance': 'رصيد الإجازات', 'Annual leave, this year': 'الإجازة السنوية لهذا العام', 'days left': 'أيام متبقية', 'Remaining': 'المتبقي', 'Taken': 'المستخدم',
  'Pending approval': 'بانتظار الموافقة', 'Attendance': 'الحضور', 'Last 20 working days': 'آخر 20 يوم عمل', 'Pay over the last 3 months': 'الراتب خلال آخر 3 أشهر',
  'Net pay and deductions': 'صافي الراتب والاستقطاعات', 'Net pay': 'صافي الراتب', 'Deductions': 'الاستقطاعات', 'Your tasks': 'مهامك', 'Upcoming holidays': 'العطلات القادمة',
  'Career opportunities': 'الفرص الوظيفية', 'Internal roles matched to your skills': 'وظائف داخلية مطابقة لمهاراتك', 'Recommended learning': 'التعلم الموصى به',
  'Benefits and allowances': 'المزايا والبدلات', 'IT and facilities requests': 'طلبات تقنية المعلومات والمرافق', 'Tracked in Jira · live status': 'متابعة في Jira · حالة مباشرة',
  'Letters generated instantly': 'خطابات تُنشأ فورًا', 'Office': 'المكتب', 'Remote': 'عن بُعد', 'Late arrival': 'تأخر', 'Leave': 'إجازة',
  // Landing
  'HR that answers, acts': 'موارد بشرية تجيب وتتصرف', 'and keeps up with the work.': 'وتواكب العمل.', 'HR operations': 'عمليات الموارد البشرية',
  'Sign in with your work account': 'سجّل الدخول بحساب العمل', 'Sign in with Microsoft 365': 'تسجيل الدخول باستخدام Microsoft 365', 'Connecting to Microsoft…': 'جارٍ الاتصال بـ Microsoft…',
  'Employee self-service': 'الخدمة الذاتية للموظفين', 'Sign in as an employee': 'تسجيل الدخول كموظف', 'Email': 'البريد الإلكتروني', 'Password': 'كلمة المرور', 'Sign in': 'تسجيل الدخول',
  'How it works': 'كيف يعمل', 'Two journeys, one platform': 'رحلتان ومنصة واحدة',
  // Report
  'Generating report…': 'جارٍ إنشاء التقرير…', 'Download PDF': 'تنزيل PDF', 'Download PowerPoint': 'تنزيل PowerPoint', 'Create Outlook draft': 'إنشاء مسودة في Outlook',
  'Close': 'إغلاق', 'Generated': 'تاريخ الإنشاء',
};

export const translate = (lang: Lang, s: string) => (lang === 'ar' ? AR[s] ?? s : s);

export const PrefsContext = createContext<{ lang: Lang; theme: Theme; setLang: (l: Lang) => void; setTheme: (t: Theme) => void }>({
  lang: 'en', theme: 'dark', setLang: () => undefined, setTheme: () => undefined,
});
export const usePrefs = () => useContext(PrefsContext);
export const useT = () => { const { lang } = usePrefs(); return (s: string) => translate(lang, s); };

const read = (k: string) => { try { return localStorage.getItem(k); } catch { return null; } };
const write = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* private mode */ } };
export const loadPrefs = (): { lang: Lang; theme: Theme } => ({
  lang: 'en', // Arabic is switched off for now; the translation table above is kept for later.
  theme: read('hrms_theme') === 'light' ? 'light' : 'dark',
});
// Applies language direction and theme to <html> and remembers them.
export function applyPrefs({ lang, theme }: { lang: Lang; theme: Theme }) {
  const html = document.documentElement;
  html.lang = lang;
  html.dir = lang === 'ar' ? 'rtl' : 'ltr';
  html.dataset.theme = theme;
  write('hrms_lang', lang);
  write('hrms_theme', theme);
}
