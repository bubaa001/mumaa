"use client";

import { useMemo } from "react";
import { useDesk } from "./trading-dashboard";
import { countdown, sessionAt, sessionsFrom, signed, type Agent } from "@/lib/trader-view";
import type { TraderState } from "@/lib/trader";

/** One sentence at the top of the overview: what is happening right now, in plain words. */
export function RightNow({ s, agents }: { s: TraderState; agents: Agent[] }) {
  const { now, ccy } = useDesk();
  const sessions = useMemo(() => sessionsFrom(agents), [agents]);
  const n = s.positions.length;
  const blocked = Object.keys(s.news.blocked).length;

  let tone = "calm";
  let head: string;
  let sub: string;
  if (s.settings.kill_switch) {
    tone = "warn"; head = "Trading is switched off."; sub = "The bots are not opening new trades until you switch them back on.";
  } else if (n > 0) {
    tone = s.account.profit >= 0 ? "up" : "down";
    head = `${n} trade${n === 1 ? " is" : "s are"} open now: ${signed(s.account.profit)} ${ccy} so far.`;
    sub = "Each trade already has its own stop and target, so you don’t need to do anything.";
  } else if (!s.news.ok) {
    tone = "warn"; head = "Waiting: the news calendar is down."; sub = "To stay safe, no bot opens a trade until it is back.";
  } else if (now === null) {
    head = "Checking the markets…"; sub = "";
  } else {
    const at = sessions.map((x) => ({ x, at: sessionAt(x, now) }));
    const open = at.filter((r) => r.at.open);
    const next = at.filter((r) => !r.at.open).sort((a, b) => a.at.next - b.at.next)[0];
    if (open.length) {
      head = "The bots are watching the market. No trade open yet.";
      sub = `They only trade when every condition is met${blocked ? `; ${blocked} market(s) are paused for news` : ""}. Most hours end with no trade, and that is normal.`;
    } else if (next) {
      head = "Markets are quiet. The bots are resting.";
      sub = `The next bots start in ${countdown(next.at.next - now)} (${next.x.agents.slice(0, 2).join(", ")}${next.x.agents.length > 2 ? "…" : ""}).`;
    } else {
      head = "The bots are watching the market."; sub = "";
    }
  }
  return (
    <section className={`plain-now is-${tone}`} aria-live="polite">
      <span className="plain-now-dot" aria-hidden="true" />
      <div>
        <p className="plain-now-head">{head}</p>
        {sub && <p className="plain-now-sub">{sub}</p>}
      </div>
    </section>
  );
}

const WORDS: [string, string][] = [
  ["Account value", "What the account is worth right now, including any open trades."],
  ["USC (cent account)", "Your account counts in US cents: 100 USC = $1. So 825 USC is about $8.25."],
  ["Made today / recently", "Profit or loss from trades that have finished. Open trades are not included until they close."],
  ["Trades won", "Out of the finished trades, how many made money."],
  ["Conditions", "Each bot has a short checklist (time of day, trend, price level). It only trades when every item is ticked."],
  ["Session", "The hours a bot is allowed to trade, shown in your own time. Outside them it just waits."],
  ["Tested win rate", "How often the bot’s rules won when tested on past years of prices. Real results can be lower."],
  ["R", "A trade’s result compared with what it risked. +0.4R means it made 40% of the amount it could have lost."],
  ["Stop / target", "Every trade is opened with a price where it closes at a small loss (stop) or takes its profit (target)."],
];

/** A short glossary at the bottom of the overview, closed by default. */
export function Glossary() {
  return (
    <details className="trade-card plain-words">
      <summary><span className="trade-h">What do these words mean?</span></summary>
      <dl>
        {WORDS.map(([w, d]) => <div key={w}><dt>{w}</dt><dd>{d}</dd></div>)}
      </dl>
    </details>
  );
}
