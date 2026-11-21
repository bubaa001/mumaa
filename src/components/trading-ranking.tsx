"use client";

import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { useDesk } from "./trading-dashboard";
import { TradeList, type Closed, type Result } from "./trading-history";
import { pct, signed, tally, type Agent, type Tally } from "@/lib/trader-view";

const PAGE = 10;
type Row = { key: string; name: string; sub: string; trades: Closed[]; t: Tally };

/** Agents (or markets) ranked by what they have actually made, each opening into its won and lost trades. */
export function Ranking({ trades, agents }: { trades: Closed[]; agents: Agent[] }) {
  const { ccy } = useDesk();
  const [by, setBy] = useState<"agent" | "market">("agent");
  const [open, setOpen] = useState<string | null>(null);

  const groups: Row[] = by === "agent"
    ? agents.map((a) => {
        const mine = trades.filter((t) => t.bot === a.id);
        return { key: a.id, name: a.name, sub: a.pairs.join(" · "), trades: mine, t: tally(mine) };
      })
    : Array.from(new Set(trades.map((t) => t.symbol))).map((sym) => {
        const mine = trades.filter((t) => t.symbol === sym);
        return { key: sym, name: sym, sub: `${new Set(mine.map((t) => t.bot)).size} agents`, trades: mine, t: tally(mine) };
      });
  const ranked = groups.filter((g) => g.t.n > 0).sort((a, b) => b.t.net - a.t.net || (b.t.winRate ?? 0) - (a.t.winRate ?? 0));
  const waiting = groups.filter((g) => g.t.n === 0);

  return (
    <section className="trade-card ranking" aria-labelledby="rank-h">
      <div className="trade-card-top">
        <div>
          <h2 className="trade-h" id="rank-h">Ranking</h2>
          <p className="trade-muted rank-note">By live profit, then win rate. Tap one to see its wins and losses.</p>
        </div>
        <div className="seg" role="group" aria-label="Rank">
          <button type="button" aria-pressed={by === "agent"} onClick={() => { setBy("agent"); setOpen(null); }}>Agents</button>
          <button type="button" aria-pressed={by === "market"} onClick={() => { setBy("market"); setOpen(null); }}>Markets</button>
        </div>
      </div>

      {ranked.length === 0 ? <p className="trade-muted">No closed trades yet. The ranking fills in after the first trade closes.</p> : (
        <ol className="rank-list">
          {ranked.map((g, i) => (
            <RankRow key={g.key} row={g} place={i + 1} ccy={ccy} agents={agents} showAgent={by === "market"}
              open={open === g.key} onToggle={() => setOpen(open === g.key ? null : g.key)} />
          ))}
        </ol>
      )}
      {waiting.length > 0 && (
        <p className="rank-waiting">Not ranked yet, no closed trades: {waiting.map((g) => g.name).join(" · ")}</p>
      )}
    </section>
  );
}

function RankRow({ row: g, place, ccy, agents, showAgent, open, onToggle }: {
  row: Row; place: number; ccy: string; agents: Agent[]; showAgent: boolean; open: boolean; onToggle: () => void;
}) {
  const [result, setResult] = useState<Result>("all");
  const [limit, setLimit] = useState(PAGE);
  const t = g.t;
  const list = g.trades.filter((x) => result === "all" || (result === "won" ? x.profit > 0 : x.profit < 0));
  const wonPct = t.n ? (t.wins / t.n) * 100 : 0;
  const panel = `rank-panel-${g.key}`;

  return (
    <li className={`rank${place === 1 ? " is-first" : ""}${open ? " is-open" : ""}`}>
      <button type="button" className="rank-row" aria-expanded={open} aria-controls={panel} onClick={onToggle}>
        <span className="rank-place" aria-label={`Rank ${place}`}>{String(place).padStart(2, "0")}</span>
        <span className="rank-name">
          <b>{g.name}</b>
          {place === 1 && <span className="rank-best">Best</span>}
          <small>{g.sub}</small>
        </span>
        <span className="rank-wl">
          <span className="rank-split" aria-hidden="true"><i style={{ width: `${wonPct}%` }} /></span>
          <small><span className="pos">{t.wins} won</span> · <span className="neg">{t.losses} lost</span> · {pct(t.winRate)}</small>
        </span>
        <span className={`rank-net ${t.net > 0 ? "pos" : t.net < 0 ? "neg" : ""}`}>{signed(t.net)}<small>{ccy}</small></span>
        <ChevronDown className="rank-chev" aria-hidden="true" />
      </button>

      {open && (
        <div className="rank-panel" id={panel}>
          <dl className="rank-stats">
            <div><dt>Made</dt><dd className="pos">{signed(t.won)}</dd></div>
            <div><dt>Lost</dt><dd className="neg">{signed(t.lost)}</dd></div>
            <div><dt>Avg per trade</dt><dd>{signed(t.net / t.n)}</dd></div>
            <div><dt>Best trade</dt><dd className="pos">{t.best ? signed(t.best.profit) : "—"}</dd></div>
            <div><dt>Worst trade</dt><dd className="neg">{t.worst ? signed(t.worst.profit) : "—"}</dd></div>
          </dl>
          <div className="seg" role="group" aria-label="Result">
            {(["all", "won", "lost"] as Result[]).map((r) => (
              <button type="button" key={r} aria-pressed={result === r} onClick={() => { setResult(r); setLimit(PAGE); }}>
                {r === "all" ? `All ${t.n}` : r === "won" ? `Won ${t.wins}` : `Lost ${t.losses}`}
              </button>
            ))}
          </div>
          {list.length === 0 ? <p className="trade-muted">None {result === "won" ? "won" : "lost"} yet.</p> : (
            <TradeList trades={list} agents={agents} limit={limit} onMore={() => setLimit((n) => n + PAGE)} showAgent={showAgent} />
          )}
        </div>
      )}
    </li>
  );
}
