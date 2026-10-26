"use client";
/* Small SVG/HTML charts (no chart library). Colours (validated for colour-blind separation):
   competency K = violet #7c3aed, interest M = teal #0d9488; skill levels = one violet ramp. */
import Link from "next/link";
import { ReactNode, useState } from "react";

export const C_K = "#7c3aed";
export const C_M = "#0d9488";
export const LEVEL_RAMP = { beginner: "#c4b5fd", intermediate: "#8b5cf6", advanced: "#5b21b6" } as const;

function Tip({ show, children }: { show: boolean; children: ReactNode }) {
  if (!show) return null;
  return <div className="pointer-events-none absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-full rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg whitespace-nowrap">{children}</div>;
}

/* ---- ring gauge for a single 0-100 score ---- */
export function Ring({ value, size = 76, stroke = 8, color = C_K, label }: { value: number; size?: number; stroke?: number; color?: string; label?: string }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r, v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={`${(v / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center leading-none">
        <div><span className="font-bold text-slate-900" style={{ fontSize: size * 0.26 }}>{Math.round(v)}</span>
          {label && <span className="block text-[10px] text-slate-400 mt-0.5">{label}</span>}</div>
      </div>
    </div>
  );
}

/* ---- stacked horizontal bars: fit = K part + M part ---- */
export type FitRow = { slug: string; name: string; fit: number; kPart: number; mPart: number; href?: string; highlight?: boolean };
export function FitBars({ rows, labels }: { rows: FitRow[]; labels: { k: string; m: string; fit: string } }) {
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-4 text-xs text-slate-600">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C_K }} />{labels.k}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C_M }} />{labels.m}</span>
      </div>
      <ul className="space-y-1.5">
        {rows.map((r, i) => {
          const body = (
            <div className="relative grid grid-cols-[minmax(110px,190px)_1fr_42px] items-center gap-3 rounded-md px-1 py-1 hover:bg-slate-50"
              onMouseEnter={() => setHover(r.slug)} onMouseLeave={() => setHover(null)}>
              <span className={`truncate text-sm ${r.highlight ? "font-semibold text-slate-900" : "text-slate-600"}`}>{i + 1}. {r.name}</span>
              <div className="relative flex h-3.5 items-center gap-[2px]">
                {r.kPart > 0 && <div className="h-full rounded-l-[4px]" style={{ width: `${r.kPart}%`, background: C_K, borderTopRightRadius: r.mPart ? 0 : 4, borderBottomRightRadius: r.mPart ? 0 : 4 }} />}
                {r.mPart > 0 && <div className="h-full rounded-r-[4px]" style={{ width: `${r.mPart}%`, background: C_M, borderTopLeftRadius: r.kPart ? 0 : 4, borderBottomLeftRadius: r.kPart ? 0 : 4 }} />}
                <div className="absolute inset-y-0 left-0 -z-10 w-full rounded bg-slate-100" />
                <Tip show={hover === r.slug}>{r.name} · {labels.fit} {r.fit.toFixed(1)} = {labels.k} {r.kPart.toFixed(1)} + {labels.m} {r.mPart.toFixed(1)}</Tip>
              </div>
              <span className="text-right text-sm font-semibold tabular-nums text-slate-800">{Math.round(r.fit)}</span>
            </div>
          );
          return <li key={r.slug}>{r.href ? <Link href={r.href}>{body}</Link> : body}</li>;
        })}
      </ul>
    </div>
  );
}

/* ---- radar for coverage per skill category (0..1), with a 100% reference ---- */
export function Radar({ axes, size = 300, color = C_K, refLabel, valueLabel }: {
  axes: { label: string; value: number; detail?: string }[]; size?: number; color?: string; refLabel: string; valueLabel: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const n = axes.length, cx = size / 2, cy = size / 2, R = size / 2 - 64;
  const lines = (label: string) => {                // wrap long category names into two lines
    if (label.length <= 12 || !label.includes(" ")) return [label];
    const w = label.split(" "), mid = Math.ceil(w.length / 2);
    return [w.slice(0, mid).join(" "), w.slice(mid).join(" ")];
  };
  const pt = (i: number, v: number) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
    return [cx + Math.cos(a) * R * v, cy + Math.sin(a) * R * v];
  };
  const poly = (vals: number[]) => vals.map((v, i) => pt(i, v).join(",")).join(" ");
  return (
    <div className="relative mx-auto" style={{ width: size }}>
      <svg width={size} height={size} role="img" aria-label={valueLabel} style={{ overflow: "visible" }}>
        {[0.25, 0.5, 0.75, 1].map((g) => <polygon key={g} points={poly(axes.map(() => g))} fill="none" stroke="#e2e8f0" strokeWidth={1} />)}
        {axes.map((_, i) => { const [x, y] = pt(i, 1); return <line key={i} x1={cx} y1={cy} x2={x} y2={y} stroke="#e2e8f0" />; })}
        <polygon points={poly(axes.map((a) => Math.max(0.02, a.value)))} fill={color} fillOpacity={0.18} stroke={color} strokeWidth={2} strokeLinejoin="round" />
        {axes.map((a, i) => {
          const [x, y] = pt(i, Math.max(0.02, a.value));
          return <circle key={i} cx={x} cy={y} r={hover === i ? 6 : 4} fill={color} stroke="#fff" strokeWidth={2}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className="cursor-pointer" />;
        })}
        {axes.map((a, i) => {
          const [x, y] = pt(i, 1.2);
          const anchor = Math.abs(x - cx) < 8 ? "middle" : x > cx ? "start" : "end";
          return (
            <text key={i} x={x} y={y - (lines(a.label).length - 1) * 6} textAnchor={anchor} dominantBaseline="middle" className="fill-slate-500 text-[11px]">
              {lines(a.label).map((l, j) => <tspan key={j} x={x} dy={j ? "1.15em" : 0}>{l}</tspan>)}
              <tspan x={x} dy="1.2em" className="fill-slate-800 font-semibold">{Math.round(a.value * 100)}%</tspan>
            </text>
          );
        })}
      </svg>
      {hover !== null && (
        <div className="absolute left-1/2 top-2 -translate-x-1/2 rounded-lg bg-slate-900 px-3 py-2 text-xs text-white shadow-lg">
          {axes[hover].label}: {Math.round(axes[hover].value * 100)}% {axes[hover].detail ? `· ${axes[hover].detail}` : ""}
        </div>
      )}
      <div className="mt-1 flex justify-center gap-4 text-xs text-slate-500">
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />{valueLabel}</span>
        <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm border border-slate-300" />{refLabel}</span>
      </div>
    </div>
  );
}

/* ---- simple single-hue horizontal bars (e.g. % of job ads per skill) ---- */
export function Bars({ items, max = 100, unit = "%", color = "#8b5cf6", marker }: {
  items: { label: string; value: number; note?: string; mark?: boolean }[]; max?: number; unit?: string; color?: string; marker?: string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={it.label} className="relative grid grid-cols-[minmax(90px,160px)_1fr_44px] items-center gap-3 text-sm"
          onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}>
          <span className="truncate text-slate-700">{it.label}{it.mark && marker && <span className="ml-1 text-emerald-600" title={marker}>•</span>}</span>
          <div className="relative h-2.5 rounded bg-slate-100">
            <div className="h-full rounded-[4px]" style={{ width: `${Math.min(100, (it.value / max) * 100)}%`, background: color }} />
            <Tip show={hover === i}>{it.label}: {it.value}{unit}{it.note ? ` · ${it.note}` : ""}</Tip>
          </div>
          <span className="text-right text-xs tabular-nums text-slate-500">{Math.round(it.value)}{unit}</span>
        </li>
      ))}
    </ul>
  );
}

/* ---- stacked counts by level per category ---- */
export function LevelStack({ rows, labels }: { rows: { label: string; beginner: number; intermediate: number; advanced: number }[]; labels: Record<keyof typeof LEVEL_RAMP, string> }) {
  const max = Math.max(1, ...rows.map((r) => r.beginner + r.intermediate + r.advanced));
  const [hover, setHover] = useState<string | null>(null);
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-3 text-xs text-slate-600">
        {(Object.keys(LEVEL_RAMP) as (keyof typeof LEVEL_RAMP)[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: LEVEL_RAMP[k] }} />{labels[k]}</span>
        ))}
      </div>
      <ul className="space-y-1.5">
        {rows.map((r) => {
          const total = r.beginner + r.intermediate + r.advanced;
          return (
            <li key={r.label} className="relative grid grid-cols-[minmax(90px,150px)_1fr_24px] items-center gap-3 text-sm"
              onMouseEnter={() => setHover(r.label)} onMouseLeave={() => setHover(null)}>
              <span className="truncate text-slate-700">{r.label}</span>
              <div className="relative flex h-3 gap-[2px]" style={{ width: `${(total / max) * 100}%` }}>
                {(Object.keys(LEVEL_RAMP) as (keyof typeof LEVEL_RAMP)[]).map((k) => r[k] > 0 && (
                  <div key={k} className="h-full first:rounded-l-[4px] last:rounded-r-[4px]" style={{ flex: r[k], background: LEVEL_RAMP[k] }} />
                ))}
                <Tip show={hover === r.label}>{r.label}: {labels.beginner} {r.beginner} · {labels.intermediate} {r.intermediate} · {labels.advanced} {r.advanced}</Tip>
              </div>
              <span className="text-right text-xs tabular-nums text-slate-500">{total}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
