// Lightweight SVG/HTML charts for the dashboards. Colors follow a validated dark-surface categorical
// palette (fixed order, never cycled); text always uses text tokens, never series colors.
import { useState, type KeyboardEvent, type MouseEvent, type ReactNode } from 'react';

// Categorical slots are CSS variables (index.css) so light and dark themes each use their own validated steps.
export const SERIES = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)', 'var(--series-5)'] as const;
export const STATUS = { good: '#0ca30c', warning: '#fab219', serious: '#ec835a', critical: '#d03b3b' } as const;

// ---------- Hover tooltip shared by all charts ----------
interface Tip { x: number; y: number; content: ReactNode }
function useTip() {
  const [tip, setTip] = useState<Tip | null>(null);
  const bind = (content: ReactNode) => ({
    onMouseMove: (e: MouseEvent) => {
      const box = (e.currentTarget as Element).closest('[data-chart]')!.getBoundingClientRect();
      setTip({ x: e.clientX - box.left, y: e.clientY - box.top, content });
    },
    onMouseLeave: () => setTip(null),
  });
  const view = tip && (
    <div className="pointer-events-none absolute z-20 -translate-x-1/2 -translate-y-[calc(100%+10px)] whitespace-nowrap rounded-lg border border-white/10 bg-slate-950/95 px-2.5 py-1.5 text-xs text-slate-200 shadow-xl"
      style={{ left: tip.x, top: tip.y }}>{tip.content}</div>
  );
  return { bind, view };
}

export const Legend = ({ items }: { items: { name: string; color: string; value?: ReactNode }[] }) => (
  <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-400">
    {items.map((i) => (
      <span key={i.name} className="inline-flex items-center gap-1.5">
        <span className="h-2.5 w-2.5 rounded-sm" style={{ background: i.color }} />{i.name}{i.value !== undefined && <span className="font-semibold text-slate-200">{i.value}</span>}
      </span>
    ))}
  </div>
);

// ---------- Horizontal bars (magnitude by category) ----------
type Bar = { label: string; value: number; detail?: string; key?: string; selected?: boolean };
export function HBars({ data, format = (v) => v.toLocaleString(), color = SERIES[0], note, onSelect }: {
  data: Bar[]; format?: (v: number) => string; color?: string; note?: (d: Bar) => ReactNode; onSelect?: (key: string) => void;
}) {
  const { bind, view } = useTip();
  const max = Math.max(...data.map((d) => d.value), 1);
  const anySelected = data.some((d) => d.selected);
  return (
    <div data-chart className="relative space-y-1">
      {data.map((d) => (
        <div key={d.label}
          {...(onSelect ? { role: 'button', tabIndex: 0, onClick: () => onSelect(d.key ?? d.label), onKeyDown: (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(d.key ?? d.label); } } } : {})}
          className={`group grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 rounded-lg px-1.5 py-1 text-xs ${onSelect ? 'cursor-pointer hover:bg-white/[0.04] focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500' : 'cursor-default'} ${d.selected ? 'bg-blue-500/10 ring-1 ring-blue-500/40' : ''}`}
          {...bind(<><b>{d.label}</b>: {format(d.value)}{d.detail ? ` · ${d.detail}` : ''}{onSelect ? <div className="mt-0.5 text-[10px] text-slate-400">{d.selected ? 'Click to clear filter' : 'Click to filter the dashboard'}</div> : null}</>)}>
          <span className={`truncate ${d.selected ? 'font-semibold text-white' : 'text-slate-300'}`}>{d.label}</span>
          <div className="h-2.5 rounded-full bg-white/[0.04]">
            <div className="h-full rounded-r-[4px] rounded-l-sm transition group-hover:brightness-125" style={{ width: `${Math.max(2, (d.value / max) * 100)}%`, background: color, opacity: anySelected && !d.selected ? 0.35 : 1 }} />
          </div>
          <span className="w-16 text-right tabular-nums text-slate-300">{note ? note(d) : format(d.value)}</span>
        </div>
      ))}
      {view}
    </div>
  );
}

// ---------- Columns (one series over an ordered axis) ----------
export function Columns({ data, height = 150, color = SERIES[0], format = (v) => v.toLocaleString(), unit = '' }: {
  data: { label: string; value: number }[]; height?: number; color?: string; format?: (v: number) => string; unit?: string;
}) {
  const { bind, view } = useTip();
  const max = Math.max(...data.map((d) => d.value), 1);
  const w = 100 / data.length;
  // Dense series (e.g. 24 months): label every nth tick and rely on the tooltip for values.
  const every = Math.ceil(data.length / 8);
  const dense = data.length > 12;
  return (
    // Time runs left to right even in Arabic, so the SVG bars and HTML labels stay aligned.
    <div data-chart className="relative" dir="ltr">
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }} role="img" aria-label={data.map((d) => `${d.label}: ${format(d.value)}${unit}`).join(', ')}>
        {[0.5, 1].map((f) => <line key={f} x1="0" x2="100" y1={height - 18 - (height - 36) * f} y2={height - 18 - (height - 36) * f} stroke="rgba(255,255,255,0.05)" vectorEffect="non-scaling-stroke" />)}
        {data.map((d, i) => {
          const h = Math.max(1.5, (d.value / max) * (height - 36));
          return (
            <g key={i} {...bind(<><b>{d.label}</b>: {format(d.value)}{unit}</>)}>
              <rect x={i * w} y="0" width={w} height={height} fill="transparent" />
              <rect x={i * w + w * 0.2} y={height - 18 - h} width={w * 0.6} height={h} rx="1.2" style={{ fill: color }} className="transition-opacity hover:opacity-80" />
            </g>
          );
        })}
        <line x1="0" x2="100" y1={height - 18} y2={height - 18} stroke="rgba(255,255,255,0.15)" vectorEffect="non-scaling-stroke" />
      </svg>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 grid text-center text-[11px] text-slate-500" style={{ gridTemplateColumns: `repeat(${data.length},1fr)` }}>
        {data.map((d, i) => <span key={i} className="whitespace-nowrap">{i % every === 0 ? d.label : ''}</span>)}
      </div>
      {!dense && (
        <div className="pointer-events-none absolute inset-x-0 top-0 grid text-center text-[11px] font-semibold text-slate-300" style={{ gridTemplateColumns: `repeat(${data.length},1fr)`, height: height - 18 }}>
          {data.map((d, i) => <span key={i} className="self-end" style={{ marginBottom: Math.max(1.5, (d.value / max) * (height - 36)) + 2 }}>{format(d.value)}</span>)}
        </div>
      )}
      {view}
    </div>
  );
}

// ---------- Stacked columns (parts of a whole per period) ----------
export function StackedColumns({ data, series, height = 160, format = (v) => v.toLocaleString() }: {
  data: { label: string; values: number[] }[]; series: { name: string; color: string }[]; height?: number; format?: (v: number) => string;
}) {
  const { bind, view } = useTip();
  const max = Math.max(...data.map((d) => d.values.reduce((a, b) => a + b, 0)), 1);
  const plot = height - 20;
  return (
    <div className="space-y-3">
      <div data-chart className="relative">
        <div className="flex items-end justify-around gap-4 border-b border-white/15" style={{ height: plot }}>
          {data.map((d) => (
            <div key={d.label} className="flex h-full w-full max-w-[56px] flex-col-reverse gap-[2px]"
              {...bind(<div className="space-y-0.5"><b>{d.label}</b>{series.map((s, i) => <div key={s.name}>{s.name}: {format(d.values[i])}</div>)}</div>)}>
              {d.values.map((v, i) => (
                <div key={i} className={`w-full ${i === d.values.length - 1 ? 'rounded-t-[4px]' : ''}`} style={{ height: `${(v / max) * 100}%`, background: series[i].color }} />
              ))}
            </div>
          ))}
        </div>
        <div className="mt-1 flex justify-around text-[11px] text-slate-500">{data.map((d) => <span key={d.label} className="w-full max-w-[56px] text-center">{d.label}</span>)}</div>
        {view}
      </div>
      <Legend items={series} />
    </div>
  );
}

// ---------- Donut (share of a small whole) ----------
export function Donut({ data, center, sub, size = 132 }: { data: { name: string; value: number; color: string }[]; center: ReactNode; sub?: string; size?: number }) {
  const { bind, view } = useTip();
  const total = data.reduce((s, d) => s + d.value, 0) || 1;
  const r = 15.9155, c = 100;
  let offset = 25;
  return (
    <div className="flex flex-wrap items-center gap-5">
      <div data-chart className="relative flex-shrink-0" style={{ width: size, height: size }}>
        <svg viewBox="0 0 42 42" className="h-full w-full -rotate-0" role="img" aria-label={data.map((d) => `${d.name}: ${d.value}`).join(', ')}>
          <circle cx="21" cy="21" r={r} fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" />
          {data.filter((d) => d.value > 0).map((d) => {
            const len = (d.value / total) * c;
            const seg = (
              <circle key={d.name} cx="21" cy="21" r={r} fill="none" style={{ stroke: d.color }} strokeWidth="5" strokeDasharray={`${Math.max(0, len - 0.8)} ${c - Math.max(0, len - 0.8)}`} strokeDashoffset={offset}
                className="cursor-default transition-opacity hover:opacity-80" {...bind(<><b>{d.name}</b>: {d.value.toLocaleString()} ({Math.round((d.value / total) * 100)}%)</>)} />
            );
            offset -= len;
            return seg;
          })}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
          <div><div className="text-xl font-black text-white">{center}</div>{sub && <div className="text-[10px] uppercase tracking-wider text-slate-500">{sub}</div>}</div>
        </div>
        {view}
      </div>
      <div className="min-w-0 space-y-1.5">
        {data.map((d) => (
          <div key={d.name} className="flex items-center gap-2 text-xs text-slate-400">
            <span className="h-2.5 w-2.5 flex-shrink-0 rounded-sm" style={{ background: d.color }} />
            <span className="truncate">{d.name}</span><span className="ml-auto pl-3 font-semibold tabular-nums text-slate-200">{d.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Progress bar ----------
export const Progress = ({ label, value, max = 100, color = SERIES[0], right }: { label: string; value: number; max?: number; color?: string; right?: ReactNode }) => (
  <div className="text-xs">
    <div className="mb-1 flex justify-between gap-2"><span className="truncate text-slate-300">{label}</span><span className="tabular-nums text-slate-400">{right ?? `${Math.round((value / max) * 100)}%`}</span></div>
    <div className="h-2 rounded-full bg-white/[0.05]"><div className="h-full rounded-full" style={{ width: `${Math.min(100, (value / max) * 100)}%`, background: color }} /></div>
  </div>
);

// ---------- Attendance strip (one cell per working day) ----------
const ATT: Record<string, string> = { Office: SERIES[0], Remote: SERIES[2], 'Late arrival': SERIES[1], Leave: SERIES[4] };
export function AttendanceStrip({ days }: { days: { date: string; status: string; hours: number }[] }) {
  const { bind, view } = useTip();
  const counts = Object.keys(ATT).map((k) => ({ name: k, color: ATT[k], value: days.filter((d) => d.status === k).length }));
  return (
    <div className="space-y-3">
      <div data-chart className="relative grid grid-cols-10 gap-1.5">
        {days.map((d) => (
          <div key={d.date} className="aspect-square cursor-default rounded-md ring-white/40 transition hover:ring-2" style={{ background: ATT[d.status] }}
            {...bind(<><b>{new Date(d.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })}</b> · {d.status}{d.hours ? ` · ${d.hours}h` : ''}</>)} />
        ))}
        {view}
      </div>
      <Legend items={counts} />
    </div>
  );
}
