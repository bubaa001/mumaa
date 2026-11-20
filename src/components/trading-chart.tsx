"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import type { TraderPull } from "@/lib/trader";
import { money, signed } from "@/lib/trader-view";

type Point = TraderPull["equity"][number];
export type Scrub = { p: Point; change: number; index: number } | null;

/** "Thu, Nov 19, 4:12 PM" in the viewer's own time. */
export const stamp = (t: string) =>
  new Date(t).toLocaleString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

/**
 * An equity line you can scrub: hover with a mouse, or drag a finger along it on a phone.
 * A crosshair and dot follow the pointer and `onScrub` reports the point under it.
 */
export function EquityLine({ points, height, tone = "light", tooltip = true, onScrub, label = "Equity" }: {
  points: Point[];
  height: number;
  tone?: "light" | "dark";
  tooltip?: boolean;
  onScrub?: (s: Scrub) => void;
  label?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState<number | null>(null);
  const w = 1000, h = height, pad = 6;

  const geo = useMemo(() => {
    const ts = points.map((p) => Date.parse(p.t));
    const ys = points.map((p) => p.e);
    const t0 = ts[0], t1 = ts[ts.length - 1];
    const min = Math.min(...ys), max = Math.max(...ys), span = max - min || 1;
    const x = (t: number) => ((t - t0) / (t1 - t0 || 1)) * w;
    const y = (v: number) => pad + (1 - (v - min) / span) * (h - 2 * pad);
    const xy = points.map((p, i) => [x(ts[i]), y(p.e)] as const);
    const line = xy.map(([px, py], i) => `${i ? "L" : "M"}${px.toFixed(1)},${py.toFixed(1)}`).join(" ");
    return { ts, ys, xy, line, min, max };
  }, [points, h]);

  const pick = useCallback((index: number | null) => {
    setActive(index);
    onScrub?.(index === null ? null : { p: points[index], change: points[index].e - points[0].e, index });
  }, [onScrub, points]);

  const fromClientX = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    if (!box) return;
    const f = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    const target = geo.ts[0] + f * (geo.ts[geo.ts.length - 1] - geo.ts[0]);
    // binary search for the nearest point in time
    let lo = 0, hi = geo.ts.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (geo.ts[mid] < target) lo = mid; else hi = mid; }
    pick(target - geo.ts[lo] <= geo.ts[hi] - target ? lo : hi);
  };

  if (points.length < 2) return null;
  const up = geo.ys[geo.ys.length - 1] >= geo.ys[0];
  const shown = active ?? points.length - 1;
  const [ax, ay] = geo.xy[shown];
  const left = (ax / w) * 100, top = (ay / h) * 100;
  const change = points[shown].e - points[0].e;

  return (
    <div
      ref={ref}
      className={`eql eql-${tone} ${up ? "is-up" : "is-down"}${active !== null ? " is-scrubbing" : ""}`}
      style={{ height }}
      role="slider"
      tabIndex={0}
      aria-label={`${label} over time`}
      aria-valuemin={0}
      aria-valuemax={points.length - 1}
      aria-valuenow={shown}
      aria-valuetext={`${money(points[shown].e)} on ${stamp(points[shown].t)}`}
      onPointerDown={(e) => { try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointer already gone */ } fromClientX(e.clientX); }}
      onPointerMove={(e) => { if (e.pointerType === "mouse" || e.buttons) fromClientX(e.clientX); }}
      onPointerUp={(e) => { if (e.pointerType !== "mouse") pick(null); }}
      onPointerCancel={() => pick(null)}
      onPointerLeave={(e) => { if (e.pointerType === "mouse") pick(null); }}
      onKeyDown={(e) => {
        if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
          e.preventDefault();
          const step = e.shiftKey ? 10 : 1;
          pick(Math.min(points.length - 1, Math.max(0, shown + (e.key === "ArrowRight" ? step : -step))));
        }
        if (e.key === "Escape") pick(null);
      }}
      onBlur={() => pick(null)}
    >
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id={`eq-fill-${tone}`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor="currentColor" stopOpacity={tone === "dark" ? 0.28 : 0.18} />
            <stop offset="1" stopColor="currentColor" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={`${geo.line} L${w},${h} L0,${h} Z`} className="eq-area" fill={`url(#eq-fill-${tone})`} />
        <path d={geo.line} className="eq-line" pathLength={1} />
        {active !== null && <rect className="eq-dim" x={ax} y={0} width={w - ax} height={h} />}
      </svg>
      <i className="eq-cross" style={{ left: `${left}%`, opacity: active !== null ? 1 : 0 }} aria-hidden="true" />
      <i className={`eq-dot${active === null ? " is-live" : ""}`} style={{ left: `${left}%`, top: `${top}%` }} aria-hidden="true" />
      {tooltip && active !== null && (
        <span className="eq-tip" style={{ left: `clamp(70px, ${left}%, calc(100% - 70px))` }} aria-hidden="true">
          <b>{money(points[shown].e)}</b>
          <small className={change > 0 ? "pos" : change < 0 ? "neg" : ""}>{signed(change)}</small>
          <small>{stamp(points[shown].t)}</small>
        </span>
      )}
    </div>
  );
}
