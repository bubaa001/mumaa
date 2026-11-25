"use client";

import { useState } from "react";
import { useDesk } from "./trading-dashboard";
import { TradeHistory, type Closed } from "./trading-history";
import { Ranking } from "./trading-ranking";
import { GrowthChart, type CashFlow } from "./trading-growth";
import { TrackRecordCard } from "./trading-record";
import type { TraderPull } from "@/lib/trader";
import { dayKey, pct, signed, tally, type Agent } from "@/lib/trader-view";

type Period = "today" | "7d" | "30d" | "all";
const PERIODS: [Period, string][] = [["today", "Today"], ["7d", "7 days"], ["30d", "30 days"], ["all", "All"]];
const DAY = 86_400_000;

/**
 * How the bots are doing over time: the account's growth, then one period (today, 7 days, 30 days or
 * everything) that drives the totals, the bot ranking and the trade history below it.
 */
export function ResultsView({ data, trades, agents, flows, startAt }: {
  data: TraderPull; trades: Closed[]; agents: Agent[]; flows: CashFlow[]; startAt: string | null;
}) {
  const { now, mounted, ccy } = useDesk();
  const [period, setPeriod] = useState<Period>("7d");
  const at = now ?? (Date.parse(data.updated_at ?? data.state?.generated_at ?? "") || 0);
  const today = dayKey(at, mounted);
  const inPeriod = trades.filter((t) => {
    if (period === "all") return true;
    if (period === "today") return dayKey(t.closed, mounted) === today;
    return Date.parse(t.closed) >= at - (period === "7d" ? 7 : 30) * DAY;
  });
  const sum = tally(inPeriod);
  const tone = (v: number) => (v > 0 ? "pos" : v < 0 ? "neg" : "");
  const label = PERIODS.find(([p]) => p === period)![1].toLowerCase();

  return (
    <>
      <section className="desk-hero results-growth" aria-labelledby="res-growth">
        <h2 className="trade-h" id="res-growth">Account growth</h2>
        <GrowthChart points={data.equity} flows={flows} startAt={startAt} ccy={ccy} />
      </section>

      <section className="trade-card" aria-labelledby="res-sum">
        <div className="trade-card-top">
          <h2 className="trade-h" id="res-sum">Results</h2>
          <div className="seg" role="group" aria-label="Period">
            {PERIODS.map(([p, text]) => (
              <button key={p} type="button" aria-pressed={period === p} onClick={() => setPeriod(p)}>{text}</button>
            ))}
          </div>
        </div>
        <dl className="today-stats">
          <div><dt>Made</dt><dd className={tone(sum.net)}>{sum.n ? signed(sum.net) : "—"}</dd><small>{ccy} · {label}</small></div>
          <div><dt>Trades</dt><dd>{sum.n}</dd><small>{sum.n ? <><span className="pos">{sum.wins} won</span> · <span className="neg">{sum.losses} lost</span></> : "none closed"}</small></div>
          <div><dt>Won</dt><dd>{pct(sum.winRate)}</dd><small>of closed trades</small></div>
          <div><dt>Best / worst</dt><dd className="today-bot"><span className="pos">{sum.best && sum.best.profit > 0 ? signed(sum.best.profit) : "—"}</span> / <span className="neg">{sum.worst && sum.worst.profit < 0 ? signed(sum.worst.profit) : "—"}</span></dd><small>single trade</small></div>
        </dl>
        <p className="trade-muted results-note">The ranking and history below show the same period. Trades still open count once they close.</p>
      </section>

      <Ranking key={`r-${period}`} trades={inPeriod} agents={agents} />
      <TradeHistory key={`h-${period}`} trades={inPeriod} agents={agents} />
      <TrackRecordCard />
    </>
  );
}
