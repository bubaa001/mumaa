"use client";

import { useState } from "react";
import { useDesk } from "./trading-dashboard";
import { TradeList, type Closed } from "./trading-history";
import { dayKey, signed, tally, type Agent } from "@/lib/trader-view";

/**
 * Trades that closed today, in your own time, with a one-line score and the best bot so far. "Made
 * today" and the open trades sit above it; older days are on the Results tab.
 */
export function TodayTrades({ trades, agents }: { trades: Closed[]; agents: Agent[] }) {
  const { mounted, now, ccy } = useDesk();
  const [limit, setLimit] = useState(10);
  const key = now === null ? null : dayKey(now, mounted);
  const today = key === null ? [] : trades.filter((t) => dayKey(t.closed, mounted) === key);
  const sum = tally(today);
  const byBot = new Map<string, number>();
  for (const t of today) byBot.set(t.bot, (byBot.get(t.bot) ?? 0) + t.profit);
  const top = [...byBot].sort((a, b) => b[1] - a[1])[0];
  const name = (id: string) => agents.find((a) => a.id === id)?.name ?? id;
  const date = now === null ? "" : new Date(now).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });

  return (
    <section className="trade-card today" aria-labelledby="today-h">
      <div className="trade-card-top">
        <h2 className="trade-h" id="today-h">Closed today</h2>
        <span className="trade-muted today-date">{date}</span>
      </div>

      {today.length === 0 ? (
        <p className="trade-muted today-empty">No trades have closed yet today. Each one shows up here the moment it closes.</p>
      ) : (
        <>
          <p className="today-line">
            <b className={sum.net > 0 ? "pos" : sum.net < 0 ? "neg" : ""}>{signed(sum.net)} {ccy}</b>
            <span> from {sum.n} {sum.n === 1 ? "trade" : "trades"} · </span>
            <span className="pos">{sum.wins} won</span><span> · </span><span className="neg">{sum.losses} lost</span>
            {top && top[1] > 0 && byBot.size > 1 && <span> · best so far: {name(top[0])} <span className="pos">{signed(top[1])}</span></span>}
          </p>
          <TradeList trades={today} agents={agents} limit={limit} onMore={() => setLimit((n) => n + 10)} />
        </>
      )}
    </section>
  );
}
