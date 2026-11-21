"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { PageHead } from "./mumaa-shell";
import { AgentsView, AgentState as StateChip } from "./trading-agents";
import { TradeHistory } from "./trading-history";
import { Ranking } from "./trading-ranking";
import { SessionClock } from "./trading-sessions";
import { EquityLine, stamp, type Scrub } from "./trading-chart";
import { ease } from "./motion";
import { InvestorsView } from "@/components/trading-investors";
import type { TraderPosition, TraderPull, TraderResult, TraderState } from "@/lib/trader";
import {
  agentsFrom, ago, closedTrades, isView, money, pct, readyText, rText, signed, tally, VIEWS, when, type Agent, type DeskNav, type DeskView,
} from "@/lib/trader-view";

const POLL_MS = 5_000;
const STALE_S = 120;


type Desk = { now: number | null; mounted: boolean; ccy: string; go: (next: Partial<DeskNav>) => void };
const DeskContext = createContext<Desk>({ now: null, mounted: false, ccy: "", go: () => {} });
export const useDesk = () => useContext(DeskContext);

function urlFor(nav: DeskNav) {
  const q = new URLSearchParams();
  if (nav.view !== "overview") q.set("view", nav.view);
  if (nav.view === "agents" && nav.agent) q.set("agent", nav.agent);
  if (nav.view === "agents" && nav.agent && nav.market) q.set("market", nav.market);
  const s = q.toString();
  return `${window.location.pathname}${s ? `?${s}` : ""}`;
}

function readNav(): DeskNav {
  const q = new URLSearchParams(window.location.search);
  const v = q.get("view");
  return { view: isView(v) ? v : "overview", agent: q.get("agent"), market: q.get("market") };
}

export function TradingDashboard({ initial, nav: initialNav, founder = false }: { initial: TraderResult; nav: DeskNav; founder?: boolean }) {
  const [result, setResult] = useState(initial);
  const [now, setNow] = useState<number | null>(null);
  const [nav, setNav] = useState<DeskNav>(initialNav);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setNow(Date.now());
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch("/api/trader", { cache: "no-store" });
        if (res.ok && alive) setResult((await res.json()) as TraderResult);
      } catch { /* keep the last good data */ }
    };
    const poll = setInterval(() => { if (document.visibilityState === "visible") load(); }, POLL_MS);
    const onShow = () => { if (document.visibilityState === "visible") load(); };
    const onPop = () => setNav(readNav());
    document.addEventListener("visibilitychange", onShow);
    window.addEventListener("popstate", onPop);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => {
      alive = false; clearInterval(poll); clearInterval(tick);
      document.removeEventListener("visibilitychange", onShow);
      window.removeEventListener("popstate", onPop);
    };
  }, []);

  const navRef = useRef(nav);
  navRef.current = nav;
  const go = useCallback((next: Partial<DeskNav>) => {
    const merged: DeskNav = { ...navRef.current, ...next };
    if (next.view && next.view !== "agents") { merged.agent = null; merged.market = null; }
    if (next.agent !== undefined && next.market === undefined) merged.market = null;
    navRef.current = merged;
    setNav(merged);
    window.history.pushState(null, "", urlFor(merged));
    // Bring the new view to the top without jumping past the tabs.
    const tabs = tabsRef.current;
    if (tabs) {
      const top = tabs.getBoundingClientRect().top + window.scrollY - 68;
      if (window.scrollY > top) window.scrollTo({ top, behavior: "instant" as ScrollBehavior });
    }
  }, []);

  const data = result.ok ? result.data : null;
  const s = data?.state ?? null;
  // Re-rank once a minute (session countdowns), not on every clock tick.
  const minute = now === null ? null : Math.floor(now / 60_000) * 60_000;
  const agents = useMemo(() => (s ? agentsFrom(s, minute) : []), [s, minute]);
  const desk = useMemo<Desk>(() => ({ now, mounted: now !== null, ccy: s?.account.currency ?? "", go }), [now, s, go]);

  const marketCount = agents.reduce((n, a) => n + a.pairs.length, 0);
  const head = (
    <PageHead eyebrow="Claude trader" title={<>The <em className="serif-em">desk</em></>}
      description={agents.length
        ? `${agents.length} agents on ${marketCount} markets, one account. What each is watching, why it is or isn’t trading, and what it has made.`
        : "What each bot is watching, why it is or isn’t trading, and what it has made or lost."} />
  );

  if (!result.ok || !s || !data) {
    return (
      <>
        {head}
        <section className="notice trade-notice">
          <strong>No bot data yet.</strong>
          <p>{result.ok ? "Start reporter.py on the trading PC and this page fills in within 30 seconds." : result.error}</p>
        </section>
      </>
    );
  }

  const tradesCount = s.positions.length + (data.history?.length || s.trades.length);
  const counts: Partial<Record<DeskView, number>> = { agents: agents.length, trades: tradesCount };

  return (
    <DeskContext.Provider value={desk}>
      {head}
      <DeskHero data={data} s={s} />

      <div className="desk-tabs" ref={tabsRef}>
        <div className="desk-tabs-inner" role="tablist" aria-label="Trading desk">
          {VIEWS.filter((v) => founder || v.id !== "investors").map((v) => {
            const active = nav.view === v.id;
            return (
              <button key={v.id} type="button" role="tab" aria-selected={active} aria-controls="desk-panel"
                className="desk-tab" data-active={active} onClick={() => go({ view: v.id })}>
                {active && <motion.span layoutId="desk-tab-pill" className="desk-tab-pill" transition={{ type: "spring", stiffness: 520, damping: 40 }} />}
                <span className="desk-tab-label">{v.short ? <><span className="tab-long">{v.label}</span><span className="tab-short">{v.short}</span></> : v.label}</span>
                {counts[v.id] !== undefined && <span className="desk-tab-count">{counts[v.id]}</span>}
                {v.id === "trades" && s.positions.length > 0 && <span className="desk-tab-live" aria-label={`${s.positions.length} open`} />}
              </button>
            );
          })}
        </div>
      </div>

      <ViewFade id={nav.view}>
        {nav.view === "overview" && <OverviewView data={data} s={s} agents={agents} />}
        {nav.view === "agents" && <AgentsView agents={agents} s={s} data={data} agentId={nav.agent} marketId={nav.market} />}
        {nav.view === "trades" && <TradesView data={data} s={s} agents={agents} />}
        {nav.view === "rules" && <RulesView s={s} />}
        {nav.view === "investors" && founder && <InvestorsView mounted={now !== null} />}
      </ViewFade>
    </DeskContext.Provider>
  );
}

function ViewFade({ id, children }: { id: string; children: React.ReactNode }) {
  const reduce = useReducedMotion();
  return (
    <motion.div key={id} id="desk-panel" role="tabpanel" className="desk-panel"
      initial={reduce ? false : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.28, ease }}>
      {children}
    </motion.div>
  );
}

/* ─── Account header ─────────────────────────────────────────── */

function DeskHero({ data, s }: { data: TraderPull; s: TraderState }) {
  const { now, ccy } = useDesk();
  const age = now === null ? 0 : (now - Date.parse(data.updated_at ?? s.generated_at)) / 1000;
  const stale = age > STALE_S;
  const all = tally(s.trades);
  const day = s.generated_at.slice(0, 10);
  const today = s.trades.filter((t) => t.closed.slice(0, 10) === day).reduce((sum, t) => sum + t.profit, 0);
  const start = data.equity[0]?.e;
  const change = start ? s.account.equity - start : null;
  const tone = (v: number) => (v > 0 ? "pos" : v < 0 ? "neg" : "");
  const [scrub, setScrub] = useState<Scrub>(null);

  return (
    <section className="desk-hero" aria-label="Account">
      <div className="desk-status" role="status">
        <span className={`trade-dot ${stale ? "is-off" : "is-on"}`} aria-hidden="true" />
        <span>{stale ? "Reporter offline · " : "Live · "}updated {ago(data.updated_at, now)}</span>
        <span className="desk-status-tags">
          <span className={`chip ${s.account.mode === "DEMO" ? "chip-done" : "chip-sealed"}`}>{s.account.mode}</span>
          <span className="chip">1:{s.account.leverage}</span>
          <span className="chip">{s.settings.risk_pct}% risk</span>
          {s.settings.kill_switch && <span className="chip chip-sealed">Kill switch on</span>}
        </span>
      </div>

      <div className="desk-hero-grid">
        <div className="desk-equity">
          <span className="desk-label">Equity</span>
          <p className="desk-equity-value" aria-live="off">{money(scrub ? scrub.p.e : s.account.equity)}<small>{ccy}</small></p>
          <p className="desk-equity-sub">
            {scrub ? (
              <>
                <span className={tone(scrub.change)}>{signed(scrub.change)} since the start</span>
                <span>{stamp(scrub.p.t)}</span>
              </>
            ) : (
              <>
                {change !== null && <span className={tone(change)}>{signed(change)} over 30 days</span>}
                <span>balance {money(s.account.balance)}</span>
              </>
            )}
          </p>
          <div className="desk-spark">
            <EquityLine points={data.equity} height={64} tone="dark" tooltip={false} onScrub={setScrub} />
            {data.equity.length > 1 && <p className="desk-spark-hint">{scrub ? "Let go to return to now" : "Drag or hover the line to look back"}</p>}
          </div>
        </div>
        <dl className="desk-kpis">
          <div><dt>Open P/L</dt><dd className={tone(s.account.profit)}>{signed(s.account.profit)}</dd><small>{s.positions.length} open</small></div>
          <div><dt>Closed today</dt><dd className={tone(today)}>{signed(today)}</dd><small>{ccy}</small></div>
          <div><dt>Net P/L</dt><dd className={tone(all.net)}>{signed(all.net)}</dd><small>{all.n} closed trades</small></div>
          <div><dt>Win rate</dt><dd>{pct(all.winRate)}</dd><small><span className="pos">{all.wins} won</span> · <span className="neg">{all.losses} lost</span></small></div>
        </dl>
      </div>
    </section>
  );
}

/* ─── Overview ──────────────────────────────────────────────── */

function OverviewView({ data, s, agents }: { data: TraderPull; s: TraderState; agents: Agent[] }) {
  const { go, mounted, ccy } = useDesk();
  const recent = closedTrades(s, data.history ?? []).slice(0, 5);
  const watching = agents.filter((a) => a.state === "watching").length;
  const next = s.news.upcoming[0];
  const blocked = Object.keys(s.news.blocked);

  return (
    <>
      {(blocked.length > 0 || !s.news.ok) && (
        <button type="button" className="desk-alert" onClick={() => go({ view: "rules" })}>
          <span>{!s.news.ok ? "News feed is down, so the bots aren’t opening trades." : `Paused for news: ${blocked.join(", ")}.`}</span>
          <ArrowRight aria-hidden="true" />
        </button>
      )}

      <OpenTrades positions={s.positions} />
      {s.positions.length === 0 && (
        <p className="desk-quiet">
          <span className="trade-dot is-on" aria-hidden="true" />
          No open trades. {watching} of {agents.length} agents are watching; a trade shows up here the moment one opens.
        </p>
      )}

      <SessionClock agents={agents} />

      <section className="desk-section" aria-labelledby="ov-agents">
        <div className="desk-section-head">
          <h2 className="trade-h" id="ov-agents">Agents <small className="trade-muted">closest to a trade first</small></h2>
          <button type="button" className="desk-link" onClick={() => go({ view: "agents" })}>Open the agents <ArrowRight aria-hidden="true" /></button>
        </div>
        <div className="agent-tiles">
          {agents.map((a) => (
            <button type="button" key={a.id} className="agent-tile" data-state={a.state} onClick={() => go({ view: "agents", agent: a.id })}>
              <span className="agent-tile-top">
                <span className="agent-tile-name">{a.name}</span>
                <StateChip state={a.state} />
              </span>
              <span className="agent-tile-pairs">{a.pairs.join(" · ")}{a.confidence && <> · {a.confidence.label} confidence</>}</span>
              <ReadyMeter agent={a} />
              <span className="agent-tile-stats">
                <span><small>Live</small><b className={a.record.net > 0 ? "pos" : a.record.net < 0 ? "neg" : ""}>{a.record.n ? signed(a.record.net) : "—"}</b></span>
                <span><small>Trades</small><b>{a.record.n}</b></span>
                <span><small>Backtest</small><b>{a.bot?.backtest?.win_rate != null ? `${Math.round(a.bot.backtest.win_rate)}%` : "—"}</b></span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="desk-split">
        <section className="trade-card" aria-labelledby="ov-equity">
          <div className="trade-card-top"><h2 className="trade-h" id="ov-equity">Equity, 30 days</h2></div>
          <EquityChart points={data.equity} />
        </section>
        <section className="trade-card" aria-labelledby="ov-recent">
          <div className="trade-card-top">
            <h2 className="trade-h" id="ov-recent">Latest trades</h2>
            {recent.length > 0 && <button type="button" className="desk-link" onClick={() => go({ view: "trades" })}>All <ArrowRight aria-hidden="true" /></button>}
          </div>
          {recent.length === 0 ? <p className="trade-muted">No closed trades yet.</p> : (
            <ul className="recent">
              {recent.map((t, i) => (
                <li key={i} className={t.profit >= 0 ? "won" : "lost"}>
                  <span className="recent-main"><b>{t.symbol}</b> <small>{t.side} · {agents.find((a) => a.id === t.bot)?.name ?? t.bot}</small></span>
                  <span className={`recent-pl ${t.profit >= 0 ? "pos" : "neg"}`}>{signed(t.profit)} <small>{ccy}</small></span>
                  <span className="recent-when">{when(t.closed, mounted)}{t.r != null ? ` · ${rText(t.r)}` : ""}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {next && (
        <button type="button" className="desk-next" onClick={() => go({ view: "rules" })}>
          <span className="desk-label">Next high-impact news</span>
          <span><span className="chip">{next.currency}</span> {next.title} · {when(next.time, mounted)}</span>
          <ArrowRight aria-hidden="true" />
        </button>
      )}
    </>
  );
}

/** Conditions met for the agent's nearest market, as a short bar and a line of text. */
export function ReadyMeter({ agent: a }: { agent: Agent }) {
  const r = a.ready;
  const full = a.state === "in_trade" || a.state === "signal";
  const share = full ? 1 : r.total ? r.met / r.total : 0;
  return (
    <span className="ready" data-state={a.state} data-waiting={r.opensIn !== null}>
      <span className="ready-bar" aria-hidden="true"><i style={{ width: `${Math.round(share * 100)}%` }} /></span>
      <span className="ready-text">{readyText(r, a.state)}</span>
    </span>
  );
}

/* ─── Trades ────────────────────────────────────────────────── */

function TradesView({ data, s, agents }: { data: TraderPull; s: TraderState; agents: Agent[] }) {
  const closed = closedTrades(s, data.history ?? []);
  return (
    <>
      <OpenTrades positions={s.positions} />
      <Ranking trades={closed} agents={agents} />
      <TradeHistory trades={closed} agents={agents} />
    </>
  );
}

/* ─── News & rules ──────────────────────────────────────────── */

function RulesView({ s }: { s: TraderState }) {
  const { mounted, ccy } = useDesk();
  const a = s.account, r = s.settings;
  return (
    <div className="desk-split">
      <section className="trade-card" aria-labelledby="ru-news">
        <div className="trade-card-top">
          <h2 className="trade-h" id="ru-news">High-impact news</h2>
          {!s.news.ok && <span className="chip chip-sealed">Feed down · not trading</span>}
        </div>
        {Object.keys(s.news.blocked).length > 0 && (
          <p className="trade-block">Paused right now: {Object.entries(s.news.blocked).map(([pair, why]) => `${pair} (${why})`).join(", ")}</p>
        )}
        {s.news.upcoming.length === 0 ? <p className="trade-muted">No high-impact events left this week.</p> : (
          <ul className="trade-news">{s.news.upcoming.map((e, i) => (
            <li key={i}><time>{when(e.time, mounted)}</time><span className="chip">{e.currency}</span><span>{e.title}</span></li>
          ))}</ul>
        )}
        <p className="trade-muted">No new trades from 30 minutes before to 30 minutes after each event on the affected pairs. The Gold NY-open and J-Dub gold bots stand aside for 2 hours.</p>
      </section>

      <section className="trade-card" aria-labelledby="ru-rules">
        <h2 className="trade-h" id="ru-rules">House rules</h2>
        <dl className="rules">
          <div><dt>Risk per trade</dt><dd>{r.risk_pct}% of equity</dd></div>
          <div><dt>Daily loss limit</dt><dd>{r.daily_loss_pct}% · all agents stop for the day</dd></div>
          <div><dt>Most trades open at once</dt><dd>{r.max_open}</dd></div>
          <div><dt>Same-direction USD trades</dt><dd>{r.max_same_usd_dir} at most</dd></div>
          <div><dt>Kill switch</dt><dd className={r.kill_switch ? "neg" : ""}>{r.kill_switch ? "On · nothing trades" : "Off"}</dd></div>
        </dl>
        <h3 className="market-sub">Account</h3>
        <dl className="rules">
          <div><dt>Mode</dt><dd>{a.mode} · 1:{a.leverage}</dd></div>
          <div><dt>Balance</dt><dd>{money(a.balance, ccy)}</dd></div>
          <div><dt>Margin in use</dt><dd>{money(a.margin, ccy)}</dd></div>
          <div><dt>Free margin</dt><dd>{money(a.free_margin, ccy)}</dd></div>
        </dl>
      </section>
    </div>
  );
}

/* ─── Shared pieces ─────────────────────────────────────────── */

/** One card per open trade: live P/L in money and R, and where price sits between stop and target. */
export function OpenTrades({ positions, title = "Open trades" }: { positions: TraderPosition[]; title?: string }) {
  const { now, ccy } = useDesk();
  if (!positions.length) return null;
  return (
    <section className="desk-section" aria-label={title} aria-live="polite">
      <div className="desk-section-head"><h2 className="trade-h">{title}</h2><p className="trade-muted">Live, every 5 seconds</p></div>
      <div className="live-grid">
        {positions.map((p, i) => {
          const dir = p.side === "BUY" ? 1 : -1;
          const span = p.sl && p.tp ? Math.abs(p.tp - p.sl) : 0;
          const at = span ? Math.min(100, Math.max(0, ((dir * (p.now - p.sl)) / span) * 100)) : 50;
          const entry = span ? Math.min(100, Math.max(0, ((dir * (p.open - p.sl)) / span) * 100)) : 50;
          const up = p.profit >= 0;
          return (
            <article className={`trade-card live-card ${up ? "is-up" : "is-down"}`} key={`${p.bot}-${p.symbol}-${i}`}>
              <header>
                <h3>{p.symbol} <span className="chip">{p.side}</span></h3>
                <span className="trade-muted">{p.lots} lots · {ago(p.opened, now)}</span>
              </header>
              <p className="live-pnl">{signed(p.profit)} <small>{ccy}</small></p>
              <p className="live-r">{rText(p.r_now)}{p.risk ? ` · risking ${money(p.risk)} ${ccy}` : ""}</p>
              <div className="live-bar" role="img" aria-label={`Price is ${at.toFixed(0)}% of the way from stop to target`}>
                <div className="live-bar-track"><i className="live-entry" style={{ left: `${entry}%` }} /><i className="live-now" style={{ left: `${at}%` }} /></div>
                <div className="live-bar-labels"><span className="neg">stop {p.sl}</span><span>now {p.now}</span><span className="pos">target {p.tp}</span></div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function EquityChart({ points }: { points: TraderPull["equity"] }) {
  const { mounted } = useDesk();
  if (points.length < 2) return <p className="trade-muted">The equity curve appears once the reporter has run for a little while.</p>;
  const ys = points.map((p) => p.e);
  return (
    <figure className="trade-chart">
      <EquityLine points={points} height={180} />
      <figcaption>
        <span>{when(points[0].t, mounted, false)}</span>
        <span>low {money(Math.min(...ys))} · high {money(Math.max(...ys))}</span>
        <span>{when(points[points.length - 1].t, mounted, false)}</span>
      </figcaption>
    </figure>
  );
}
