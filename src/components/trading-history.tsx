"use client";

import { useState } from "react";
import { useDesk } from "./trading-dashboard";
import type { TraderReplay, TraderTrade } from "@/lib/trader";
import { duration, REASON, rText, signed, tally, pct, when, type Agent } from "@/lib/trader-view";

const PAGE = 15;

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

export type Closed = TraderTrade & { replay?: TraderReplay };
export type Result = "all" | "won" | "lost";

/** Every closed trade, filterable by agent and result, each opening into a replay of how it went. */
export function TradeHistory({ trades, agents }: { trades: Closed[]; agents: Agent[] }) {
  const { mounted, ccy } = useDesk();
  const [agent, setAgent] = useState<string>("all");
  const [result, setResult] = useState<Result>("all");
  const [limit, setLimit] = useState(PAGE);

  const byAgent = agent === "all" ? trades : trades.filter((t) => t.bot === agent);
  const list = byAgent.filter((t) => result === "all" || (result === "won" ? t.profit > 0 : t.profit < 0));
  const sum = tally(list);
  const withTrades = agents.filter((a) => trades.some((t) => t.bot === a.id));
  const name = (id: string) => agents.find((a) => a.id === id)?.name ?? id;

  return (
    <section className="trade-card" aria-labelledby="history-h">
      <div className="trade-card-top">
        <h2 className="trade-h" id="history-h">History</h2>
        {trades.length > 0 && <span className="trade-muted history-sum">{sum.n} shown · <span className={sum.net >= 0 ? "pos" : "neg"}>{signed(sum.net)} {ccy}</span> · {pct(sum.winRate)} won</span>}
      </div>

      {trades.length > 0 && (
        <div className="history-filters">
          <div className="filter-scroll" role="group" aria-label="Agent">
            <button type="button" className="filter" aria-pressed={agent === "all"} onClick={() => { setAgent("all"); setLimit(PAGE); }}>All agents</button>
            {withTrades.map((a) => (
              <button type="button" key={a.id} className="filter" aria-pressed={agent === a.id} onClick={() => { setAgent(a.id); setLimit(PAGE); }}>{a.name}</button>
            ))}
          </div>
          <div className="seg" role="group" aria-label="Result">
            {(["all", "won", "lost"] as Result[]).map((r) => (
              <button type="button" key={r} aria-pressed={result === r} onClick={() => { setResult(r); setLimit(PAGE); }}>
                {r === "all" ? "All" : r === "won" ? "Won" : "Lost"}
              </button>
            ))}
          </div>
        </div>
      )}

      {trades.length === 0 ? (
        <p className="trade-muted">No closed trades yet. Each trade is saved here once it closes, with a chart of how it went.</p>
      ) : list.length === 0 ? (
        <p className="trade-muted">Nothing matches these filters.</p>
      ) : (
        <TradeList trades={list} agents={agents} limit={limit} onMore={() => setLimit((n) => n + PAGE)} />
      )}
    </section>
  );
}

/** Closed trades as rows that open into a replay chart and the trade's details. */
export function TradeList({ trades, agents, limit, onMore, showAgent = true }: {
  trades: Closed[]; agents: Agent[]; limit: number; onMore: () => void; showAgent?: boolean;
}) {
  const { mounted } = useDesk();
  const name = (id: string) => agents.find((a) => a.id === id)?.name ?? id;
  return (
    <div className="history">
      {trades.slice(0, limit).map((t, i) => {
        const r = t.replay;
        return (
          <details key={r?.id ?? `${t.closed}-${i}`} className={`history-item ${t.profit >= 0 ? "won" : "lost"}`}>
            <summary>
              <span className="h-pair">{t.symbol} <small>{t.side}</small></span>
              <span className="h-agent">{showAgent ? name(t.bot) : REASON[t.reason] ?? t.reason}</span>
              <span className={`h-pl ${t.profit >= 0 ? "pos" : "neg"}`}>{signed(t.profit)}</span>
              <span className="h-when">{when(t.closed, mounted)}</span>
              <span className="h-r">{rText(t.r)}</span>
            </summary>
            {r && <ReplayChart r={r} />}
            <dl className="trade-dl">
              <div><dt>Entry → exit</dt><dd>{t.open} → {t.close}</dd></div>
              <div><dt>Why it closed</dt><dd>{REASON[t.reason] ?? t.reason}</dd></div>
              <div><dt>Lasted</dt><dd>{duration(t.opened, t.closed)}</dd></div>
              {r && <div><dt>Best it got</dt><dd className="pos">{r.best_r == null ? r.best_move : rText(r.best_r)}</dd></div>}
              {r && <div><dt>Worst it got</dt><dd className="neg">{r.worst_r == null ? r.worst_move : rText(r.worst_r)}</dd></div>}
              {r && <div><dt>Stop / target</dt><dd>{r.sl || "—"} / {r.tp || "—"}</dd></div>}
              {!r && <div><dt>Lots</dt><dd>{t.lots}</dd></div>}
            </dl>
          </details>
        );
      })}
      {trades.length > limit && (
        <button type="button" className="btn btn-ghost history-more" onClick={onMore}>
          Show {Math.min(PAGE, trades.length - limit)} more
        </button>
      )}
    </div>
  );
}
