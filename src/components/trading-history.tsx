"use client";

import type { TraderReplay } from "@/lib/trader";

function signed(v: number) {
  return `${v > 0 ? "+" : ""}${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
function duration(a: string, b: string) {
  const m = Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000));
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`;
}
const REASON: Record<string, string> = { target: "hit target", stop: "hit stop", closed: "time / manual" };

/** Candles around one closed trade, with its entry, stop, target, and where it opened and closed. */
function ReplayChart({ r }: { r: TraderReplay }) {
  const c = r.candles;
  if (!c.length) return <p className="trade-muted">No candles were saved for this trade.</p>;
  const w = 640, h = 220, padR = 70, padY = 12;
  const levels = [r.open, r.close, r.sl, r.tp].filter((v) => v > 0);
  const vals = [...c.flatMap((k) => [k[2], k[3]]), ...levels];
  const lo = Math.min(...vals), hi = Math.max(...vals), span = hi - lo || 1;
  const y = (v: number) => padY + (1 - (v - lo) / span) * (h - 2 * padY);
  const step = (w - padR) / c.length, body = Math.max(2, step * 0.6);
  const x = (i: number) => i * step + step / 2;
  const t0 = c[0][0], t1 = c[c.length - 1][0] || t0 + 1;
  const xt = (ts: number) => ((ts - t0) / (t1 - t0 || 1)) * (w - padR - step) + step / 2;
  const tOpen = Date.parse(r.opened) / 1000, tClose = Date.parse(r.closed) / 1000;
  const line = (v: number, cls: string, label: string) => v > 0 && (
    <g className={cls} key={label}>
      <line x1={0} x2={w - padR} y1={y(v)} y2={y(v)} />
      <text x={w - padR + 6} y={y(v) + 4}>{label}</text>
    </g>
  );
  return (
    <figure className="candles replay">
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`${r.symbol} ${r.side} from ${r.open} to ${r.close}, ${signed(r.profit)}`}>
        <rect className="in-trade" x={xt(tOpen)} width={Math.max(2, xt(tClose) - xt(tOpen))} y={0} height={h} />
        {c.map(([t, o, hh, l, cl], i) => (
          <g key={t} className={cl >= o ? "up" : "down"}>
            <line x1={x(i)} x2={x(i)} y1={y(hh)} y2={y(l)} />
            <rect x={x(i) - body / 2} width={body} y={y(Math.max(o, cl))} height={Math.max(1, Math.abs(y(o) - y(cl)))} rx={1} />
          </g>
        ))}
        {line(r.tp, "lvl-tp", "target")}
        {line(r.sl, "lvl-sl", "stop")}
        {line(r.open, "lvl-entry", "entry")}
        <circle className="mark-open" cx={xt(tOpen)} cy={y(r.open)} r={5} />
        <circle className={`mark-close ${r.profit >= 0 ? "won" : "lost"}`} cx={xt(tClose)} cy={y(r.close)} r={6} />
      </svg>
      <figcaption>
        <span className="legend"><i className="lg-zone" />time in trade</span>
        <span className="legend"><i className="lg-tp" />target · <i className="lg-sl" />stop</span>
        <span className="legend">● entry · ◉ exit · {r.tf} candles</span>
      </figcaption>
    </figure>
  );
}

export function TradeHistory({ history, currency }: { history: TraderReplay[]; currency: string }) {
  return (
    <section className="trade-card">
      <div className="trade-card-top">
        <h2 className="trade-h">Trade history</h2>
        <span className="trade-muted">{history.length ? `${history.length} trades · tap one to replay it` : ""}</span>
      </div>
      {history.length === 0 ? (
        <p className="trade-muted">No closed trades yet. Each trade is saved here once it closes, with a chart of how it went.</p>
      ) : (
        <div className="history">
          {history.map((r) => (
            <details key={r.id} className={`history-item ${r.profit >= 0 ? "won" : "lost"}`}>
              <summary>
                <span className="h-when">{new Date(r.closed).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                <span className="h-pair">{r.symbol} <small>{r.side}</small></span>
                <span className={`h-pl ${r.profit >= 0 ? "pos" : "neg"}`}>{signed(r.profit)} <small>{currency}</small></span>
                <span className="h-r">{r.r === null || r.r === undefined ? "" : `${r.r > 0 ? "+" : ""}${r.r}R`}</span>
              </summary>
              <ReplayChart r={r} />
              <dl className="trade-dl">
                <div><dt>Entry → exit</dt><dd>{r.open} → {r.close}</dd></div>
                <div><dt>Why it closed</dt><dd>{REASON[r.reason] ?? r.reason}</dd></div>
                <div><dt>Lasted</dt><dd>{duration(r.opened, r.closed)}</dd></div>
                <div><dt>Best it got</dt><dd className="pos">{r.best_r === null || r.best_r === undefined ? r.best_move : `+${r.best_r}R`}</dd></div>
                <div><dt>Worst it got</dt><dd className="neg">{r.worst_r === null || r.worst_r === undefined ? r.worst_move : `${r.worst_r}R`}</dd></div>
                <div><dt>Stop / target</dt><dd>{r.sl || "—"} / {r.tp || "—"}</dd></div>
              </dl>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
