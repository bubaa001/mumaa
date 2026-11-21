"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { TraderPull } from "@/lib/trader";
import { money, signed } from "@/lib/trader-view";
import { stamp, type Scrub } from "./trading-chart";

type Point = TraderPull["equity"][number];
/** Money moved in (+) or out (-) of the account; `who` only for the founder's view. */
export type CashFlow = { at: string; amount: number; who: string | null };

type Range = "24h" | "7d" | "30d";
type Mode = "value" | "return";
type Scale = "fit" | "zero";
const RANGE_MS: Record<Range, number> = { "24h": 86_400_000, "7d": 7 * 86_400_000, "30d": 30 * 86_400_000 };
const PREFS = "mumaa.growth.v1";

function niceTicks(min: number, max: number, count = 4) {
  if (!(max > min)) { const d = Math.abs(min) * 0.005 || 1; min -= d; max += d; }
  const raw = (max - min) / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const n = raw / mag;
  const step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * mag;
  const lo = Math.floor(min / step) * step, hi = Math.ceil(max / step) * step;
  const out: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) out.push(Number(v.toFixed(10)));
  return { lo, hi, out, step };
}

const compact = (v: number) => Math.abs(v) >= 10_000 ? `${(v / 1000).toFixed(1)}k` : Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2);
const pctLabel = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%`;

/**
 * The account as an investor sees it. "Value" is what the pool is worth (deposits push it up, losses and
 * cash-outs pull it down; markers show who moved money). "Return" takes deposits and withdrawals out so
 * only trading shows. Range, mode and scale are adjustable; the axis is labelled; scrub to look back.
 */
export function GrowthChart({ points, flows = [], startAt = null, height = 168, onScrub, ccy = "" }: {
  points: Point[]; flows?: CashFlow[]; startAt?: string | null; height?: number;
  onScrub?: (s: Scrub) => void; ccy?: string;
}) {
  const [range, setRange] = useState<Range>("7d");
  const [mode, setMode] = useState<Mode>("value");
  const [scale, setScale] = useState<Scale>("fit");
  const [active, setActive] = useState<number | null>(null);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const p = JSON.parse(localStorage.getItem(PREFS) ?? "{}") as Partial<{ range: Range; mode: Mode; scale: Scale }>;
      if (p.range && p.range in RANGE_MS) setRange(p.range);
      if (p.mode === "value" || p.mode === "return") setMode(p.mode);
      if (p.scale === "fit" || p.scale === "zero") setScale(p.scale);
    } catch { /* private mode: defaults */ }
  }, []);
  const save = (next: Partial<{ range: Range; mode: Mode; scale: Scale }>) => {
    try { localStorage.setItem(PREFS, JSON.stringify({ range, mode, scale, ...next })); } catch { /* ignore */ }
  };

  const W = 1000, H = height, PAD = 10;
  const v = useMemo(() => {
    if (points.length < 2) return null;
    const end = Date.parse(points[points.length - 1].t);
    let from = end - RANGE_MS[range];
    if (mode === "return" && startAt) from = Math.max(from, Date.parse(startAt));
    let pts = points.filter((p) => Date.parse(p.t) >= from);
    if (pts.length < 2) pts = points.slice(-2);
    const ts = pts.map((p) => Date.parse(p.t));
    const t0 = ts[0], t1 = ts[ts.length - 1];
    const inRange = flows.filter((f) => { const t = Date.parse(f.at); return t > t0 && t <= t1; })
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    // Return: equity minus money moved in/out since the start of the window, against the starting value.
    let k = 0, cum = 0;
    const base = pts[0].e || 1;
    const ys = pts.map((p, i) => {
      while (k < inRange.length && Date.parse(inRange[k].at) <= ts[i]) cum += inRange[k++].amount;
      return mode === "value" ? p.e : ((p.e - cum) / base - 1) * 100;
    });
    const first = ys[0], last = ys[ys.length - 1];
    let lo = Math.min(...ys), hi = Math.max(...ys);
    if (scale === "zero") { lo = Math.min(lo, 0); hi = Math.max(hi, 0); }
    const tk = niceTicks(lo, hi, 4);
    const y = (val: number) => PAD + (1 - (val - tk.lo) / (tk.hi - tk.lo || 1)) * (H - 2 * PAD);
    const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * W;
    const xy = ys.map((val, i) => [x(ts[i]), y(val)] as const);
    const line = xy.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
    const baseline = mode === "value" ? first : 0;
    const markers = inRange.map((f) => {
      const t = Date.parse(f.at);
      let j = ts.findIndex((tt) => tt >= t);
      if (j < 0) j = ts.length - 1;
      return { f, left: (x(t) / W) * 100, top: (xy[j][1] / H) * 100 };
    });
    return { pts, ts, ys, xy, line, tk, y, first, last, baseY: y(baseline), markers, t0, t1 };
  }, [points, flows, range, mode, scale, startAt, H]);

  const pick = useCallback((i: number | null) => {
    setActive(i);
    if (!v) return;
    onScrub?.(i === null ? null : { p: v.pts[i], change: v.pts[i].e - v.pts[0].e, index: i });
  }, [onScrub, v]);

  const fromX = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box || !v) return;
    const f = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    const target = v.t0 + f * (v.t1 - v.t0);
    let lo = 0, hi = v.ts.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (v.ts[mid] < target) lo = mid; else hi = mid; }
    pick(target - v.ts[lo] <= v.ts[hi] - target ? lo : hi);
  };

  if (!v) return <p className="gc-empty">The chart appears once the reporter has run for a little while.</p>;

  const shown = active ?? v.pts.length - 1;
  const [ax, ay] = v.xy[shown];
  const up = v.last >= v.first;
  const fmtY = (val: number) => (mode === "value" ? compact(val) : pctLabel(val, v.tk.step < 1 ? 1 : 0));
  const xLabel = (t: number) => new Date(t).toLocaleString("en-GB", range === "24h" ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" });
  const tipVal = mode === "value" ? `${money(v.ys[shown])} ${ccy}` : pctLabel(v.ys[shown], 2);
  const tipChg = mode === "value" ? signed(v.ys[shown] - v.first) : `${money(v.pts[shown].e)} ${ccy}`;
  const summary = mode === "value" ? `${signed(v.last - v.first)} ${ccy}` : pctLabel(v.last, 2);

  return (
    <div className={`gc ${up ? "is-up" : "is-down"}`}>
      <div className="gc-bar">
        <span className={`gc-sum ${up ? "gc-pos" : "gc-neg"}`}>{up ? "▲" : "▼"} {summary}<small> · {range.toUpperCase()}{mode === "return" ? " trading only" : ""}</small></span>
        <span className="gc-ctl">
          <Seg value={range} set={(r) => { setRange(r); save({ range: r }); }} opts={[["24h", "24H"], ["7d", "7D"], ["30d", "30D"]]} label="Time range" />
          <Seg value={mode} set={(m) => { setMode(m); save({ mode: m }); }} opts={[["value", "Value"], ["return", "Return %"]]} label="Show" />
          <Seg value={scale} set={(s) => { setScale(s); save({ scale: s }); }} opts={[["fit", "Zoom"], ["zero", "From 0"]]} label="Scale" />
        </span>
      </div>

      <div className="gc-plot-wrap">
        <div
          ref={ref}
          className={`gc-plot${active !== null ? " is-scrubbing" : ""}`}
          style={{ height: H }}
          role="slider" tabIndex={0}
          aria-label={mode === "value" ? "Account value over time" : "Trading return over time"}
          aria-valuemin={0} aria-valuemax={v.pts.length - 1} aria-valuenow={shown}
          aria-valuetext={`${tipVal} on ${stamp(v.pts[shown].t)}`}
          onPointerDown={(e) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* gone */ } fromX(e.clientX); }}
          onPointerMove={(e) => { if (e.pointerType === "mouse" || e.buttons) fromX(e.clientX); }}
          onPointerUp={(e) => { if (e.pointerType !== "mouse") pick(null); }}
          onPointerCancel={() => pick(null)}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") pick(null); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              const step = e.shiftKey ? 10 : 1;
              pick(Math.min(v.pts.length - 1, Math.max(0, shown + (e.key === "ArrowRight" ? step : -step))));
            }
            if (e.key === "Escape") pick(null);
          }}
          onBlur={() => pick(null)}
        >
          <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
            <defs>
              <linearGradient id="gc-up" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="var(--up)" stopOpacity="0.32" /><stop offset="1" stopColor="var(--up)" stopOpacity="0" />
              </linearGradient>
              <linearGradient id="gc-down" x1="0" x2="0" y1="1" y2="0">
                <stop offset="0" stopColor="var(--down)" stopOpacity="0.32" /><stop offset="1" stopColor="var(--down)" stopOpacity="0" />
              </linearGradient>
              <clipPath id="gc-above"><rect x="0" y="0" width={W} height={Math.max(0, v.baseY)} /></clipPath>
              <clipPath id="gc-below"><rect x="0" y={v.baseY} width={W} height={Math.max(0, H - v.baseY)} /></clipPath>
            </defs>
            {v.tk.out.map((t) => <line key={t} className="gc-grid" x1="0" x2={W} y1={v.y(t)} y2={v.y(t)} />)}
            <path d={`${v.line} L${W},${v.baseY} L0,${v.baseY} Z`} fill="url(#gc-up)" clipPath="url(#gc-above)" />
            <path d={`${v.line} L${W},${v.baseY} L0,${v.baseY} Z`} fill="url(#gc-down)" clipPath="url(#gc-below)" />
            <line className="gc-base" x1="0" x2={W} y1={v.baseY} y2={v.baseY} />
            <path d={v.line} className="gc-line gc-line-up" clipPath="url(#gc-above)" />
            <path d={v.line} className="gc-line gc-line-down" clipPath="url(#gc-below)" />
            {active !== null && <rect className="gc-dim" x={ax} y={0} width={W - ax} height={H} />}
          </svg>
          {v.tk.out.map((t) => (
            <span key={t} className="gc-ylab" style={{ top: `${(v.y(t) / H) * 100}%` }}>{fmtY(t)}</span>
          ))}
          {v.markers.map((m, i) => (
            <span key={i} className={`gc-flow ${m.f.amount > 0 ? "gc-in" : "gc-out"}`} style={{ left: `${m.left}%`, top: `${m.top}%` }}
              tabIndex={0} aria-label={`${m.f.amount > 0 ? "Deposit" : "Cash out"} ${signed(m.f.amount)} ${ccy}${m.f.who ? ` by ${m.f.who}` : ""}`}
              data-tip={`${m.f.amount > 0 ? "Deposit" : "Cash out"} ${signed(m.f.amount)}${m.f.who ? ` · ${m.f.who}` : ""}`}>
              {m.f.amount > 0 ? "+" : "−"}
            </span>
          ))}
          <i className="gc-cross" style={{ left: `${(ax / W) * 100}%`, opacity: active !== null ? 1 : 0 }} aria-hidden="true" />
          <i className={`gc-dot${active === null ? " is-live" : ""}`} style={{ left: `${(ax / W) * 100}%`, top: `${(ay / H) * 100}%` }} aria-hidden="true" />
          {active !== null && (
            <span className="gc-tip" style={{ left: `clamp(74px, ${(ax / W) * 100}%, calc(100% - 74px))` }} aria-hidden="true">
              <b>{tipVal}</b><small>{tipChg}</small><small>{stamp(v.pts[shown].t)}</small>
            </span>
          )}
        </div>
        <div className="gc-x" aria-hidden="true">
          <span>{xLabel(v.t0)}</span><span>{xLabel((v.t0 + v.t1) / 2)}</span><span>{xLabel(v.t1)}</span>
        </div>
      </div>
    </div>
  );
}

function Seg<T extends string>({ value, set, opts, label }: { value: T; set: (v: T) => void; opts: [T, string][]; label: string }) {
  return (
    <span className="gc-seg" role="group" aria-label={label}>
      {opts.map(([k, text]) => (
        <button key={k} type="button" aria-pressed={value === k} data-on={value === k} onClick={() => set(k)}>{text}</button>
      ))}
    </span>
  );
}
