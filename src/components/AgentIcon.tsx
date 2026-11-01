import {
  BarChart3, Bot, Calculator, CalendarDays, Compass, FileText, FolderKanban, HeartPulse, Laptop,
  MessageSquare, Network, Rocket, ScanSearch, ShieldCheck, Star, Target, TrendingDown, TrendingUp, Wallet,
  type LucideIcon,
} from 'lucide-react';

// Agents name their icon on the server; unknown names fall back to a generic bot.
const ICONS: Record<string, LucideIcon> = {
  BarChart3, Calculator, CalendarDays, Compass, FileText, FolderKanban, HeartPulse, Laptop,
  MessageSquare, Network, Rocket, ScanSearch, ShieldCheck, Star, Target, TrendingDown, TrendingUp, Wallet,
};

export const AgentIcon = ({ name, className }: { name: string; className?: string }) => {
  const Icon = ICONS[name] ?? Bot;
  return <Icon className={className} />;
};

// Marks agents and widgets whose requests are tracked in Jira.
export const JiraBadge = () => (
  <span className="inline-flex items-center gap-1 rounded-full border border-sky-500/25 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold text-sky-300">
    <span className="h-1.5 w-1.5 rounded-full bg-sky-400" />Jira
  </span>
);

// Marks agents and widgets backed by live SAP SuccessFactors data.
export const SapBadge = ({ label = 'SAP SuccessFactors' }: { label?: string }) => (
  <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />{label}
  </span>
);
