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

/**
 * Index of the first point after the last account switch: a jump of more than 20% between two readings
 * that no known deposit/withdrawal explains (MT5 was logged into another account). Before it, the
 * history belongs to a different account and would flatten the chart.
 */
export function lastSwitch(points: Point[], flows: CashFlow[] = []): number {
  const near = (t: number) => flows.some((f) => Math.abs(Date.parse(f.at) - t) <= 15 * 60_000);
  for (let i = points.length - 1; i > 0; i--) {
    const a = points[i - 1].e, b = points[i].e;
    const jump = a <= 0 || b <= 0 || Math.abs(b / a - 1) > 0.2;
    if (jump && !near(Date.parse(points[i].t))) return i;
  }
  return 0;
}

const compact = (v: number) => Math.abs(v) >= 10_000 ? `${(v / 1000).toFixed(1)}k` : Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2);
const pctLabel = (v: number, d = 1) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(d)}%`;

/** A window onto the time axis: where it starts and how much time it spans. */
type View = { a: number; span: number };
const MIN_SPAN = 60 * 60_000; // squeezed in no further than one hour across

/**
 * The account as an investor sees it. "Value" is what the pool is worth (deposits push it up, losses and
 * cash-outs pull it down; markers show who moved money). "Return" takes deposits and withdrawals out so
 * only trading shows. The latest reading sits in the middle with room to its right. Pinch (or Ctrl +
 * scroll, or the − / + buttons) squeezes and stretches time; drag with a mouse, or Shift + scroll /
 * sideways scroll, slides it left and right. Hover or one finger scrubs to look back.
 */
export function GrowthChart({ points, flows = [], startAt = null, height = 168, onScrub, ccy = "" }: {
  points: Point[]; flows?: CashFlow[]; startAt?: string | null; height?: number;
  onScrub?: (s: Scrub) => void; ccy?: string;
}) {
  const [range, setRange] = useState<Range>("7d");
  const [mode, setMode] = useState<Mode>("value");
  const [scale, setScale] = useState<Scale>("fit");
  const [active, setActive] = useState<number | null>(null);
  const [view, setView] = useState<View | null>(null); // null: follow the latest reading
  const [panning, setPanning] = useState(false);
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

  // Every reading for this account; "Return" starts when tracking started.
  const own = useMemo(() => {
    let o = points.slice(lastSwitch(points, flows));
    if (mode === "return" && startAt) {
      const from = Date.parse(startAt);
      const after = o.filter((p) => Date.parse(p.t) >= from);
      if (after.length >= 2) o = after;
    }
    return { pts: o, ts: o.map((p) => Date.parse(p.t)) };
  }, [points, flows, mode, startAt]);

  const begin = own.ts[0] ?? 0, end = own.ts[own.ts.length - 1] ?? 0;
  const R = RANGE_MS[range];
  /** How much time fits across: from an hour up to a little over all the history there is. */
  const fit = useCallback((span: number) => Math.min(Math.max(2 * R, 2.2 * (end - begin)), Math.max(MIN_SPAN, span)), [R, begin, end]);
  const clamp = useCallback((w: View): View => {
    const span = fit(w.span);
    // Keep some of the line in sight: the latest reading no further left than 10%, the first no further right than 90%.
    const a = Math.max(begin - span * 0.9, Math.min(end - span * 0.1, w.a));
    return { a, span };
  }, [fit, begin, end]);
  // Default: the chosen range, then as much room again, so the latest reading sits in the middle.
  const cur = clamp(view ?? { a: end - R, span: 2 * R });

  const W = 1000, H = height, PAD = 10;
  const v = useMemo(() => {
    if (own.pts.length < 2) return null;
    const t0 = cur.a, t1 = cur.a + cur.span;
    let i0 = own.ts.findIndex((t) => t >= t0);
    if (i0 < 0) i0 = own.ts.length - 2;
    let i1 = i0;
    while (i1 < own.ts.length && own.ts[i1] <= t1) i1++;
    if (i1 - i0 < 2) { i0 = Math.max(0, Math.min(i0, own.ts.length - 2)); i1 = Math.max(i1, i0 + 2); }
    const pts = own.pts.slice(i0, i1), ts = own.ts.slice(i0, i1);
    const inRange = flows.filter((f) => { const t = Date.parse(f.at); return t > ts[0] && t <= ts[ts.length - 1]; })
      .sort((a, b) => Date.parse(a.at) - Date.parse(b.at));
    // Return: equity minus money moved in/out since the first reading in view, against that reading.
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
    }).filter((m) => m.left >= 0 && m.left <= 100);
    const live = i1 === own.ts.length; // the latest reading is in view
    return { pts, ts, ys, xy, line, tk, y, first, last, baseY: y(baseline), markers, t0, t1, live };
  }, [own, flows, mode, scale, cur.a, cur.span, H]);

  const pick = useCallback((i: number | null) => {
    setActive(i);
    if (!v) return;
    onScrub?.(i === null ? null : { p: v.pts[i], change: v.pts[i].e - v.pts[0].e, index: i });
  }, [onScrub, v]);

  const frac = (clientX: number) => {
    const box = ref.current?.getBoundingClientRect();
    return box && box.width ? (clientX - box.left) / box.width : 0;
  };
  const fromX = (clientX: number) => {
    if (!v) return;
    const target = v.t0 + Math.min(1, Math.max(0, frac(clientX))) * (v.t1 - v.t0);
    let lo = 0, hi = v.ts.length - 1;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (v.ts[mid] < target) lo = mid; else hi = mid; }
    pick(target - v.ts[lo] <= v.ts[hi] - target ? lo : hi);
  };
  /** Show more time (factor > 1) or less (< 1), keeping the moment at `f` across the chart where it is. */
  const zoom = (factor: number, f = 0.5) => {
    const span = fit(cur.span * factor);
    setView(clamp({ a: cur.a + f * cur.span - f * span, span }));
    pick(null);
  };

  // Ctrl + scroll (and a trackpad pinch) squeezes; sideways scroll or Shift + scroll slides. Plain
  // scrolling still scrolls the page. React's wheel handler is passive, so this one is wired by hand.
  const latest = useRef({ cur, clamp, fit });
  useEffect(() => { latest.current = { cur, clamp, fit }; });
  const ready = v !== null;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      const { cur: c, clamp: cl, fit: ft } = latest.current;
      const box = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const f = (e.clientX - box.left) / box.width, span = ft(c.span * Math.exp(e.deltaY * 0.01));
        setView(cl({ a: c.a + f * c.span - f * span, span }));
      } else if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        e.preventDefault();
        const d = e.deltaX || e.deltaY;
        setView(cl({ a: c.a + (d / box.width) * c.span, span: c.span }));
      }
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [ready]);

  // Pointers down on the plot, and the gesture they started.
  const ptrs = useRef(new Map<number, number>());
  const gest = useRef<
    | { kind: "pinch"; span: number; d0: number; anchor: number }
    | { kind: "pan"; a: number; x0: number; moved: boolean }
    | { kind: "after" } // a finger left over from a pinch: ignored until all are up
    | null
  >(null);
  const pair = () => {
    const [x1, x2] = [...ptrs.current.values()];
    return { c: (x1 + x2) / 2, d: Math.max(24, Math.abs(x1 - x2)) };
  };

  if (!v) return <p className="gc-empty">The chart appears once this account has reported for a little while.</p>;

  // A hovered point can fall out of view when the window moves; fall back to the latest one.
  const shown = active !== null && active < v.pts.length ? active : v.pts.length - 1;
  const [ax, ay] = v.xy[shown];
  const [lx, ly] = v.xy[v.xy.length - 1];
  const up = v.last >= v.first;
  const moved = view !== null;
  const fmtY = (val: number) => (mode === "value" ? compact(val) : pctLabel(val, v.tk.step < 1 ? 1 : 0));
  const short = cur.span <= 2 * 86_400_000;
  const xLabel = (t: number) => new Date(t).toLocaleString("en-GB", short ? { hour: "2-digit", minute: "2-digit" } : { day: "numeric", month: "short" });
  const tipVal = mode === "value" ? `${money(v.ys[shown])} ${ccy}` : pctLabel(v.ys[shown], 2);
  const tipChg = mode === "value" ? signed(v.ys[shown] - v.first) : `${money(v.pts[shown].e)} ${ccy}`;
  const summary = mode === "value" ? `${signed(v.last - v.first)} ${ccy}` : pctLabel(v.last, 2);
  const area = `${v.line} L${lx.toFixed(1)},${v.baseY} L${v.xy[0][0].toFixed(1)},${v.baseY} Z`;

  return (
    <div className={`gc ${up ? "is-up" : "is-down"}`}>
      <div className="gc-bar">
        <span className={`gc-sum ${up ? "gc-pos" : "gc-neg"}`}>{up ? "▲" : "▼"} {summary}<small> · {moved ? "in view" : range.toUpperCase()}{mode === "return" ? " trading only" : ""}</small></span>
        <span className="gc-ctl">
          <Seg value={moved ? null : range} set={(r) => { setRange(r); setView(null); save({ range: r }); }} opts={[["24h", "24H"], ["7d", "7D"], ["30d", "30D"]]} label="Time range" />
          <Seg value={mode} set={(m) => { setMode(m); save({ mode: m }); }} opts={[["value", "Value"], ["return", <><span className="tab-long">Return %</span><span className="tab-short">Return</span></>]]} label="Show" />
          <Seg value={scale} set={(s) => { setScale(s); save({ scale: s }); }} opts={[["fit", "Zoom"], ["zero", <><span className="tab-long">From 0</span><span className="tab-short">0</span></>]]} label="Scale" />
        </span>
      </div>

      <div className="gc-plot-wrap">
        <div
          ref={ref}
          className={`gc-plot${active !== null ? " is-scrubbing" : ""}${panning ? " is-panning" : ""}`}
          style={{ height: H }}
          role="slider" tabIndex={0}
          aria-label={`${mode === "value" ? "Account value" : "Trading return"} over time. Arrow keys look back; plus and minus squeeze time; 0 returns to now.`}
          aria-valuemin={0} aria-valuemax={v.pts.length - 1} aria-valuenow={shown}
          aria-valuetext={`${tipVal} on ${stamp(v.pts[shown].t)}`}
          onPointerDown={(e) => {
            try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* gone */ }
            ptrs.current.set(e.pointerId, e.clientX);
            if (ptrs.current.size === 2) {
              const { c, d } = pair();
              gest.current = { kind: "pinch", span: cur.span, d0: d, anchor: cur.a + frac(c) * cur.span };
              pick(null);
              return;
            }
            if (e.pointerType === "mouse") { gest.current = { kind: "pan", a: cur.a, x0: e.clientX, moved: false }; return; }
            fromX(e.clientX);
          }}
          onPointerMove={(e) => {
            if (ptrs.current.has(e.pointerId)) ptrs.current.set(e.pointerId, e.clientX);
            const g = gest.current;
            if (g?.kind === "pinch") {
              if (ptrs.current.size < 2) return;
              const { c, d } = pair();
              const span = fit(g.span * (g.d0 / d));
              setView(clamp({ a: g.anchor - frac(c) * span, span }));
              return;
            }
            if (g?.kind === "after") return;
            if (g?.kind === "pan" && e.buttons) {
              const dx = e.clientX - g.x0;
              if (!g.moved && Math.abs(dx) < 4) return;
              if (!g.moved) { g.moved = true; setPanning(true); pick(null); }
              setView(clamp({ a: g.a - (frac(e.clientX) - frac(g.x0)) * cur.span, span: cur.span }));
              return;
            }
            if (e.pointerType === "mouse" || e.buttons) fromX(e.clientX);
          }}
          onPointerUp={(e) => {
            ptrs.current.delete(e.pointerId);
            const g = gest.current;
            if (g?.kind === "pinch") gest.current = ptrs.current.size ? { kind: "after" } : null;
            else if (!ptrs.current.size) gest.current = null;
            setPanning(false);
            if (e.pointerType === "mouse") fromX(e.clientX);
            else pick(null);
          }}
          onPointerCancel={(e) => { ptrs.current.delete(e.pointerId); if (!ptrs.current.size) gest.current = null; setPanning(false); pick(null); }}
          onPointerLeave={(e) => { if (e.pointerType === "mouse") pick(null); }}
          onKeyDown={(e) => {
            if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
              e.preventDefault();
              const step = e.shiftKey ? 10 : 1;
              pick(Math.min(v.pts.length - 1, Math.max(0, shown + (e.key === "ArrowRight" ? step : -step))));
            }
            if (e.key === "+" || e.key === "=") { e.preventDefault(); zoom(1 / 1.5); }
            if (e.key === "-" || e.key === "_") { e.preventDefault(); zoom(1.5); }
            if (e.key === "0") { e.preventDefault(); setView(null); }
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
              <clipPath id="gc-above"><rect x="0" y="-10" width={W} height={Math.max(0, v.baseY + 10)} /></clipPath>
              <clipPath id="gc-below"><rect x="0" y={v.baseY} width={W} height={Math.max(0, H - v.baseY + 10)} /></clipPath>
            </defs>
            {v.tk.out.map((t) => <line key={t} className="gc-grid" x1="0" x2={W} y1={v.y(t)} y2={v.y(t)} />)}
            <path d={area} fill="url(#gc-up)" clipPath="url(#gc-above)" />
            <path d={area} fill="url(#gc-down)" clipPath="url(#gc-below)" />
            <line className="gc-base" x1="0" x2={W} y1={v.baseY} y2={v.baseY} />
            {v.live && lx < W && <line className="gc-now" x1={lx} x2={W} y1={ly} y2={ly} />}
            <path d={v.line} className="gc-line gc-line-up" clipPath="url(#gc-above)" />
            <path d={v.line} className="gc-line gc-line-down" clipPath="url(#gc-below)" />
            {active !== null && <rect className="gc-dim" x={ax} y={0} width={Math.max(0, W - ax)} height={H} />}
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
          {v.live && active === null && lx < W * 0.85 && (
            <span className="gc-nowlab" style={{ left: `calc(${(lx / W) * 100}% + 12px)`, top: `${(ly / H) * 100}%` }} aria-hidden="true">Now {fmtY(v.last)}</span>
          )}
          <i className="gc-cross" style={{ left: `${(ax / W) * 100}%`, opacity: active !== null ? 1 : 0 }} aria-hidden="true" />
          {(active !== null || v.live) && (
            <i className={`gc-dot${active === null ? " is-live" : ""}`} style={{ left: `${(ax / W) * 100}%`, top: `${(ay / H) * 100}%` }} aria-hidden="true" />
          )}
          {active !== null && (
            <span className="gc-tip" style={{ left: `clamp(74px, ${(ax / W) * 100}%, calc(100% - 74px))` }} aria-hidden="true">
              <b>{tipVal}</b><small>{tipChg}</small><small>{stamp(v.pts[shown].t)}</small>
            </span>
          )}
        </div>
        <div className="gc-x" aria-hidden="true">
          <span>{xLabel(v.t0)}</span><span>{xLabel((v.t0 + v.t1) / 2)}</span><span>{xLabel(v.t1)}</span>
        </div>
        <div className="gc-zoom">
          <span className="gc-hint">Pinch or drag to squeeze and slide</span>
          <span className="gc-seg" role="group" aria-label="Squeeze time">
            <button type="button" onClick={() => zoom(1.5)} aria-label="Show more time">−</button>
            <button type="button" onClick={() => zoom(1 / 1.5)} aria-label="Show less time">+</button>
            {moved && <button type="button" onClick={() => setView(null)}>Now</button>}
          </span>
        </div>
      </div>
    </div>
  );
}

function Seg<T extends string>({ value, set, opts, label }: { value: T | null; set: (v: T) => void; opts: [T, React.ReactNode][]; label: string }) {
  return (
    <span className="gc-seg" role="group" aria-label={label}>
      {opts.map(([k, text]) => (
        <button key={k} type="button" aria-pressed={value === k} data-on={value === k} onClick={() => set(k)}>{text}</button>
      ))}
    </span>
  );
}
