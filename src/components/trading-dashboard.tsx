"use client";

import { motion, useReducedMotion } from "motion/react";
import { ArrowRight } from "lucide-react";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { PageHead } from "./mumaa-shell";
import { AgentsView, AgentState as StateChip } from "./trading-agents";
import { TradeHistory } from "./trading-history";
import { Ranking } from "./trading-ranking";
import { SessionClock } from "./trading-sessions";
import { Glossary, RightNow } from "./trading-plain";
import { EquityLine, stamp, type Scrub } from "./trading-chart";
import { ease } from "./motion";
import { InvestorsSkeleton, InvestorsView } from "@/components/trading-investors";
import { TrackRecordCard } from "@/components/trading-record";
import { GrowthChart, lastSwitch, type CashFlow } from "@/components/trading-growth";
import type { Ledger } from "@/lib/investors";
import type { TraderPosition, TraderPull, TraderResult, TraderState } from "@/lib/trader";
import {
  agentsFrom, ago, closedTrades, isView, money, pct, readyText, rText, signed, tally, VIEWS, when, type Agent, type DeskNav, type DeskView,
} from "@/lib/trader-view";

const POLL_MS = 5_000;
/** Cent accounts: 100 USC = 1 US dollar. */
const usd = (v: number, ccy: string) => (ccy === "USC" ? `about $${(v / 100).toFixed(2)} · cent account, 100 USC = $1` : "");
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

  const cash = useCashFlows(founder);

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

  // A bot that is switched off (paused) and holds no trade is not counted as one of "your bots".
  const live = agents.filter((a) => a.state !== "stopped" || a.positions.length > 0);
  const head = (
    <PageHead eyebrow="Trading" title={<>Your <em className="serif-em">bots</em></>}
      description={live.length
        ? `${live.length} bots trade forex and gold for you, day and night. See what they are doing right now, what they have made, and who owns what.`
        : "See what the bots are doing right now and what they have made or lost."} />
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
  const counts: Partial<Record<DeskView, number>> = { agents: live.length, trades: tradesCount };

  return (
    <DeskContext.Provider value={desk}>
      {head}
      <DeskHero data={data} s={s} cash={cash} />

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
        {/* client-only: rendered after mount so it never hydrates over server HTML (it stuck on "Loading" when opened by link) */}
        {nav.view === "investors" && founder && (now !== null ? <InvestorsView mounted /> : <InvestorsSkeleton />)}
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

function DeskHero({ data, s, cash }: { data: TraderPull; s: TraderState; cash: Cash }) {
  const { now, ccy } = useDesk();
  const age = now === null ? 0 : (now - Date.parse(data.updated_at ?? s.generated_at)) / 1000;
  const stale = age > STALE_S;
  const all = tally(s.trades);
  const day = s.generated_at.slice(0, 10);
  const today = s.trades.filter((t) => t.closed.slice(0, 10) === day).reduce((sum, t) => sum + t.profit, 0);
  const tone = (v: number) => (v > 0 ? "pos" : v < 0 ? "neg" : "");
  const [scrub, setScrub] = useState<Scrub>(null);

  return (
    <section className="desk-hero" aria-label="Account">
      <div className="desk-status" role="status">
        <span className={`trade-dot ${stale ? "is-off" : "is-on"}`} aria-hidden="true" />
        <span>{stale ? "Reporter offline · " : "Live · "}updated {ago(data.updated_at, now)}</span>
        <span className="desk-status-tags">
          <span className={`chip ${s.account.mode === "DEMO" ? "chip-done" : "chip-sealed"}`}>{s.account.mode === "DEMO" ? "Practice money" : "Real money"}</span>
          {s.settings.kill_switch && <span className="chip chip-sealed">Stopped by you</span>}
        </span>
      </div>

      <div className="desk-hero-grid">
        <div className="desk-equity">
          <span className="desk-label">Account value</span>
          <p className="desk-equity-value" aria-live="off">{money(scrub ? scrub.p.e : s.account.equity)}<small>{ccy}</small></p>
          <p className="desk-equity-sub">
            {scrub ? (
              <>
                <span className={tone(scrub.change)}>{signed(scrub.change)} since the start</span>
                <span>{stamp(scrub.p.t)}</span>
              </>
            ) : (
              <>
                <span>{usd(s.account.equity, ccy)}</span>
              </>
            )}
          </p>
          <div className="desk-spark">
            <GrowthChart points={data.equity} flows={cash.flows} startAt={cash.startAt} onScrub={setScrub} ccy={ccy} />
          </div>
        </div>
        <dl className="desk-kpis">
          <div><dt>In open trades</dt><dd className={tone(s.account.profit)}>{signed(s.account.profit)}</dd><small>{s.positions.length ? `${s.positions.length} open now` : "none open"}</small></div>
          <div><dt>Made today</dt><dd className={tone(today)}>{signed(today)}</dd><small>{ccy}</small></div>
          <div><dt>Made recently</dt><dd className={tone(all.net)}>{signed(all.net)}</dd><small>from {all.n} finished trades</small></div>
          <div><dt>Trades won</dt><dd>{pct(all.winRate)}</dd><small><span className="pos">{all.wins} won</span> · <span className="neg">{all.losses} lost</span></small></div>
        </dl>
      </div>
    </section>
  );
}

/* ─── Overview ──────────────────────────────────────────────── */

function OverviewView({ data, s, agents }: { data: TraderPull; s: TraderState; agents: Agent[] }) {
  const { go, mounted, ccy, now } = useDesk();
  const live = agents.filter((a) => a.state !== "stopped" || a.positions.length > 0);
  const recent = closedTrades(s, data.history ?? []).slice(0, 5);
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

      <RightNow s={s} agents={live} />
      <OpenTrades positions={s.positions} />

      <SessionClock agents={live} limit={3} />

      <section className="desk-section" aria-labelledby="ov-agents">
        <div className="desk-section-head">
          <h2 className="trade-h" id="ov-agents">Bots closest to a trade</h2>
          <button type="button" className="desk-link" onClick={() => go({ view: "agents" })}>See all {live.length} <ArrowRight aria-hidden="true" /></button>
        </div>
        <div className="agent-tiles">
          {live.slice(0, 4).map((a) => (
            <button type="button" key={a.id} className="agent-tile" data-state={a.state} onClick={() => go({ view: "agents", agent: a.id })}>
              <span className="agent-tile-top">
                <span className="agent-tile-name">{a.name}</span>
                <StateChip state={a.state} done={a.done} />
              </span>
              <span className="agent-tile-pairs">{a.pairs.join(" · ")}{a.confidence && <> · {a.confidence.label} confidence</>}</span>
              <ReadyMeter agent={a} />
              <span className="agent-tile-stats">
                {a.done && now !== null ? (() => {
                  // A finished bot's number is money already banked today, not a trade still to come.
                  const today = tally(a.trades.filter((t) => new Date(t.closed).toDateString() === new Date(now).toDateString())).net;
                  return <span><small>Made today</small><b className={today > 0 ? "pos" : today < 0 ? "neg" : ""}>{signed(today)}</b></span>;
                })() : (
                  <span><small>Made</small><b className={a.record.net > 0 ? "pos" : a.record.net < 0 ? "neg" : ""}>{a.record.n ? signed(a.record.net) : "—"}</b></span>
                )}
                <span><small>Trades</small><b>{a.record.n}</b></span>
                <span><small>Tested win rate</small><b>{a.bot?.backtest?.win_rate != null ? `${Math.round(a.bot.backtest.win_rate)}%` : "—"}</b></span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <div className="desk-split">
        <section className="trade-card" aria-labelledby="ov-equity">
          <div className="trade-card-top"><h2 className="trade-h" id="ov-equity">Equity, this account</h2></div>
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

      <TrackRecordCard />
      <Glossary />

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
      <span className="ready-text">{readyText(r, a.state, a.done)}</span>
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
        <p className="trade-muted">No new trades from 30 minutes before to 30 minutes after each event on the affected pairs.</p>
      </section>

      <section className="trade-card" aria-labelledby="ru-rules">
        <h2 className="trade-h" id="ru-rules">House rules</h2>
        <dl className="rules">
          <div><dt>Risk per trade</dt><dd>{r.risk_pct}% of equity</dd></div>
          <div><dt>Daily loss limit</dt><dd>{r.daily_loss_pct}% · all agents stop for the day</dd></div>
          <div><dt>Most trades open at once</dt><dd>{r.max_open} across all agents{r.max_per_market ? ` · ${r.max_per_market} per market, ${r.max_gold ?? r.max_per_market} on gold` : ""}</dd></div>
          <div><dt>Gold agents</dt><dd>Smallest lot (0.01) · skip when the spread is over 2.5× normal</dd></div>
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

function EquityChart({ points: all }: { points: TraderPull["equity"] }) {
  const { mounted } = useDesk();
  const points = all.slice(lastSwitch(all));   // only this account (no demo history)
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

/* ─── Deposits / cash-outs for the chart (founder only: names are private) ── */

type Cash = { flows: CashFlow[]; startAt: string | null };
const NO_CASH: Cash = { flows: [], startAt: null };

function useCashFlows(founder: boolean): Cash {
  const [cash, setCash] = useState<Cash>(NO_CASH);
  useEffect(() => {
    if (!founder) return;
    let alive = true;
    const load = async () => {
      try {
        const r = (await (await fetch("/api/investors", { cache: "no-store" })).json()) as { ok: boolean; ledger?: Ledger };
        if (!alive || !r.ok || !r.ledger?.started) return;
        const l = r.ledger;
        const named = l.investors.flatMap((i) => i.events
          .filter((e) => e.kind === "deposit" || e.kind === "withdrawal")
          .map((e) => ({ at: e.at, amount: e.amount, who: i.name })));
        const open = l.unassigned.map((f) => ({ at: f.at, amount: f.amount, who: "not assigned yet" }));
        setCash({ flows: [...named, ...open], startAt: l.startedAt });
      } catch { /* chart works without markers */ }
    };
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 60_000);
    return () => { alive = false; clearInterval(t); };
  }, [founder]);
  return cash;
}
