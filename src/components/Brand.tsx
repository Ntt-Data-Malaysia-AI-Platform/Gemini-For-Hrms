import { usePrefs } from '../lib/i18n';

// NTT DATA logo with a transparent background: white on the dark theme, brand blue on the light theme.
export const Brand = ({ compact = false }: { compact?: boolean }) => {
  const { theme } = usePrefs();
  return (
    <div className="flex items-center gap-2.5">
      <img src={theme === 'light' ? '/ntt-data-logo-blue.png' : '/ntt-data-logo-white.png'} alt="NTT DATA" className={compact ? 'h-5' : 'h-7'} />
      <span className={`border-s border-white/20 ps-2.5 font-semibold tracking-tight text-slate-200 ${compact ? 'text-sm' : 'text-base'}`}>HRMS</span>
    </div>
  );
};
