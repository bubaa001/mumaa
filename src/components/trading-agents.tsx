"use client";

import { ArrowLeft, ChevronRight } from "lucide-react";
import { useDesk, OpenTrades } from "./trading-dashboard";
import { Confidence, MarketCard } from "./trading-market";
import { TF_NAME, type TraderPull, type TraderState } from "@/lib/trader";
import {
  ago, closedTrades, pct, rText, signed, STATE_LABEL, when, type Agent, type AgentState as State,
} from "@/lib/trader-view";

export function AgentState({ state }: { state: State }) {
  const v = STATE_LABEL[state];
  return <span className={`verdict ${v.tone}`} data-state={state}>{v.label}</span>;
}

/**
 * The roster and one open agent. Phones show the list, then the agent full width with a way back;
 * wide screens keep the list beside the agent.
 */
export function AgentsView({ agents, s, data, agentId, marketId }: {
  agents: Agent[]; s: TraderState; data: TraderPull; agentId: string | null; marketId: string | null;
}) {
  const { go, now } = useDesk();
  const open = agents.find((a) => a.id === agentId) ?? null;
  const shown = open ?? agents[0];

  return (
    <div className="agents" data-open={open !== null}>
      <nav className="roster" aria-label="Agents">
        <p className="roster-head">{agents.length} agents · {agents.filter((a) => a.running).length} running</p>
        <ul>
          {agents.map((a) => (
            <li key={a.id}>
              <button type="button" className="roster-row" aria-current={open?.id === a.id ? "true" : undefined} data-shown={shown?.id === a.id}
                data-state={a.state} onClick={() => go({ view: "agents", agent: a.id })}>
                <span className={`roster-dot dot-${a.state}`} aria-hidden="true" />
                <span className="roster-main">
                  <b>{a.name}</b>
                  <small>{a.pairs.join(" · ")}</small>
                </span>
                <span className="roster-conf">
                  {a.confidence ? <Confidence grade={a.confidence.grade} label={a.confidence.label} compact /> : <span className="roster-muted">Unrated</span>}
                </span>
                <span className="roster-side">
                  <span className="roster-state">{STATE_LABEL[a.state].label}</span>
                  <span className={a.openPnl || a.record.net ? ((a.positions.length ? a.openPnl : a.record.net) >= 0 ? "pos" : "neg") : "roster-muted"}>
                    {a.positions.length ? `${signed(a.openPnl)} open` : a.record.n ? signed(a.record.net) : "no trades yet"}
                  </span>
                </span>
                <ChevronRight className="roster-chev" aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
        <p className="roster-foot">Listed by what needs your eye first: in a trade, signalling, paused, watching, stopped. Last update {ago(data.updated_at, now)}.</p>
      </nav>

      {shown && <AgentDetail key={shown.id} agent={shown} s={s} data={data} marketId={marketId} />}
    </div>
  );
}

function AgentDetail({ agent: a, s, data, marketId }: { agent: Agent; s: TraderState; data: TraderPull; marketId: string | null }) {
  const { go, now, mounted, ccy } = useDesk();
  const bt = a.bot?.backtest;
  const market = a.markets.find((m) => m.pair === marketId) ?? a.markets[0];
  const recent = closedTrades(s, data.history ?? []).filter((t) => t.bot === a.id).slice(0, 6);

  return (
    <article className="agent" aria-labelledby={`agent-${a.id}`}>
      <button type="button" className="agent-back" onClick={() => go({ view: "agents", agent: null })}>
        <ArrowLeft aria-hidden="true" /> All agents
      </button>

      <header className="agent-head">
        <div>
          <span className="eyebrow">{a.strategies.join(" · ") || "Trading agent"}</span>
          <h2 className="agent-name" id={`agent-${a.id}`}>{a.name}</h2>
          <p className="agent-meta">
            <span className={`trade-dot ${a.running ? "is-on" : "is-off"}`} aria-hidden="true" />
            {a.running ? "Running" : "Stopped"} · last log {ago(a.bot?.last_seen, now)} · {a.pairs.length} {a.pairs.length === 1 ? "market" : "markets"}
          </p>
        </div>
        <span className="agent-badges">
          {a.confidence && <Confidence grade={a.confidence.grade} label={a.confidence.label} />}
          <AgentState state={a.state} />
        </span>
      </header>

      <dl className="agent-stats">
        <div><dt>Live P/L</dt><dd className={a.record.net > 0 ? "pos" : a.record.net < 0 ? "neg" : ""}>{a.record.n ? signed(a.record.net) : "—"}</dd><small>{ccy}</small></div>
        <div><dt>Live record</dt><dd><span className="pos">{a.record.wins}</span> / <span className="neg">{a.record.losses}</span></dd><small>{pct(a.record.winRate)} won</small></div>
        <div><dt>Backtest win rate</dt><dd>{bt?.win_rate != null ? `${bt.win_rate}%` : "—"}</dd><small>{bt?.profit_factor != null ? `profit factor ${bt.profit_factor}` : "not yet measured"}</small></div>
        <div><dt>Avg per trade</dt><dd>{bt?.avg_r != null ? rText(bt.avg_r) : "—"}</dd><small>backtest</small></div>
        <div><dt>Worst drawdown</dt><dd>{bt?.max_dd != null ? `${bt.max_dd}%` : "—"}</dd><small>backtest</small></div>
        <div><dt>Trades / 2 weeks</dt><dd>{bt?.trades_per_2w ?? "—"}</dd><small>expected</small></div>
      </dl>

      <OpenTrades positions={a.positions} title="This agent’s open trades" />

      {a.markets.length > 0 && market && (
        <section className="agent-markets" aria-label="Markets">
          {a.markets.length > 1 && (
            <div className="pair-tabs" role="tablist" aria-label={`${a.name} markets`}>
              {a.markets.map((m) => (
                <button key={m.pair} type="button" role="tab" aria-selected={m.pair === market.pair} className="pair-tab"
                  onClick={() => go({ view: "agents", agent: a.id, market: m.pair })}>
                  <span className={`roster-dot dot-${m.verdict}`} aria-hidden="true" />
                  {m.pair}
                  <small>{TF_NAME[m.tf ?? "H1"] ?? m.tf}</small>
                </button>
              ))}
            </div>
          )}
          <MarketCard key={market.pair} m={market} trades={s.trades} currency={ccy} />
        </section>
      )}

      <div className="desk-split">
        <section className="trade-card" aria-label="Recent trades">
          <h3 className="trade-h">Recent trades</h3>
          {recent.length === 0 ? <p className="trade-muted">No closed trades yet. They appear here, and under Trades with a replay chart.</p> : (
            <ul className="recent">
              {recent.map((t, i) => (
                <li key={i} className={t.profit >= 0 ? "won" : "lost"}>
                  <span className="recent-main"><b>{t.symbol}</b> <small>{t.side}</small></span>
                  <span className={`recent-pl ${t.profit >= 0 ? "pos" : "neg"}`}>{signed(t.profit)} <small>{ccy}</small></span>
                  <span className="recent-when">{when(t.closed, mounted)}{t.r != null ? ` · ${rText(t.r)}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section className="trade-card" aria-label="Bot log">
          <h3 className="trade-h">Log</h3>
          <pre className="agent-log">{a.bot?.lines.length ? a.bot.lines.slice(-25).join("\n") : "No log yet."}</pre>
        </section>
      </div>
    </article>
  );
}
