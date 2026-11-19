"use client";

import { useEffect, useMemo, useState } from "react";
import { PageHead } from "./mumaa-shell";
import { MarketCard } from "./trading-market";
import { TradeHistory } from "./trading-history";
import { botName, type TraderPosition, type TraderPull, type TraderResult, type TraderTrade } from "@/lib/trader";

const POLL_MS = 5_000;
const STALE_S = 120;

function money(value: number | undefined, currency = "") {
  if (value === undefined || Number.isNaN(value)) return "—";
  const text = value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${text} ${currency}` : text;
}
function signed(value: number) {
  return `${value > 0 ? "+" : ""}${money(value)}`;
}
function ago(iso: string | null | undefined, now: number | null) {
  if (!iso) return "never";
  if (now === null) return "…";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}
/** Local time is only known in the browser; before mount show UTC so server and client HTML match. */
let mounted = false;
function when(iso: string) {
  if (!mounted) return `${iso.slice(0, 16).replace("T", " ")} UTC`;
  return new Date(iso).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function EquityChart({ points }: { points: TraderPull["equity"] }) {
  if (points.length < 2) return <p className="trade-muted">The equity curve appears once the reporter has run for a little while.</p>;
  const w = 600, h = 140, pad = 6;
  const ys = points.map((p) => p.e);
  const min = Math.min(...ys), max = Math.max(...ys);
  const span = max - min || 1;
  const t0 = Date.parse(points[0].t), t1 = Date.parse(points[points.length - 1].t) || t0 + 1;
  const xy = points.map((p) => [
    pad + ((Date.parse(p.t) - t0) / (t1 - t0 || 1)) * (w - 2 * pad),
    h - pad - ((p.e - min) / span) * (h - 2 * pad),
  ]);
  const line = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const up = ys[ys.length - 1] >= ys[0];
  return (
    <figure className="trade-chart">
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" role="img"
        aria-label={`Equity from ${money(ys[0])} to ${money(ys[ys.length - 1])}`}>
        <path d={`${line} L${xy[xy.length - 1][0]},${h} L${xy[0][0]},${h} Z`} className={up ? "area-up" : "area-down"} />
        <path d={line} className={up ? "line-up" : "line-down"} />
      </svg>
      <figcaption>
        <span>{when(points[0].t)}</span>
        <span>low {money(min)} · high {money(max)}</span>
        <span>{when(points[points.length - 1].t)}</span>
      </figcaption>
    </figure>
  );
}

/** One card per open trade: live P/L in money and R, and where price sits between stop and target. */
function OpenTrades({ positions, currency, now }: { positions: TraderPosition[]; currency: string; now: number | null }) {
  if (!positions.length) {
    return (
      <section className="trade-card live-empty" aria-live="polite">
        <span className="trade-dot is-on" aria-hidden="true" />
        <p><b>No open trades.</b> The bots are watching; a trade appears here the moment one opens, with its live profit or loss.</p>
      </section>
    );
  }
  return (
    <section aria-label="Open trades" aria-live="polite">
      <div className="trade-section-head"><h2 className="trade-h">Open trades</h2><p className="trade-muted">Live, every 5 seconds</p></div>
      <div className="live-grid">
        {positions.map((p, i) => {
          const dir = p.side === "BUY" ? 1 : -1;
          const span = p.sl && p.tp ? Math.abs(p.tp - p.sl) : 0;
          // 0% = at the stop, 100% = at the target
          const pct = span ? Math.min(100, Math.max(0, ((dir * (p.now - p.sl)) / span) * 100)) : 50;
          const entryPct = span ? Math.min(100, Math.max(0, ((dir * (p.open - p.sl)) / span) * 100)) : 50;
          const up = p.profit >= 0;
          return (
            <article className={`trade-card live-card ${up ? "is-up" : "is-down"}`} key={i}>
              <header>
                <h3>{p.symbol} <span className="chip">{p.side}</span></h3>
                <span className="trade-muted">{p.lots} lots · opened {ago(p.opened, now)}</span>
              </header>
              <p className="live-pnl">{signed(p.profit)} <small>{currency}</small></p>
              <p className="live-r">{p.r_now === null || p.r_now === undefined ? "" : `${p.r_now > 0 ? "+" : ""}${p.r_now.toFixed(2)}R`}
                {p.risk ? ` · risking ${money(p.risk)} ${currency}` : ""}</p>
              <div className="live-bar" role="img" aria-label={`Price is ${pct.toFixed(0)}% of the way from stop to target`}>
                <div className="live-bar-track"><i className="live-entry" style={{ left: `${entryPct}%` }} /><i className="live-now" style={{ left: `${pct}%` }} /></div>
                <div className="live-bar-labels"><span className="neg">stop {p.sl}</span><span>entry {p.open}</span><span className="pos">target {p.tp}</span></div>
              </div>
              <p className="trade-muted">Now {p.now}</p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function summary(trades: TraderTrade[]) {
  const wins = trades.filter((t) => t.profit > 0), losses = trades.filter((t) => t.profit < 0);
  const won = wins.reduce((s, t) => s + t.profit, 0), lost = losses.reduce((s, t) => s + t.profit, 0);
  const best = trades.reduce<TraderTrade | null>((b, t) => (!b || t.profit > b.profit ? t : b), null);
  const worst = trades.reduce<TraderTrade | null>((b, t) => (!b || t.profit < b.profit ? t : b), null);
  return { n: trades.length, wins: wins.length, losses: losses.length, won, lost, net: won + lost,
    winRate: trades.length ? (wins.length / trades.length) * 100 : null, best, worst };
}

export function TradingDashboard({ initial }: { initial: TraderResult }) {
  const [result, setResult] = useState(initial);
  const [now, setNow] = useState<number | null>(null);

  useEffect(() => {
    mounted = true;
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
    document.addEventListener("visibilitychange", onShow);
    const tick = setInterval(() => setNow(Date.now()), 1000);
    return () => { alive = false; clearInterval(poll); clearInterval(tick); document.removeEventListener("visibilitychange", onShow); };
  }, []);

  const data = result.ok ? result.data : null;
  const s = data?.state ?? null;
  const today = useMemo(() => {
    if (!s) return 0;
    const d = s.generated_at.slice(0, 10);
    return s.trades.filter((t) => t.closed.slice(0, 10) === d).reduce((sum, t) => sum + t.profit, 0);
  }, [s]);

  const head = (
    <PageHead eyebrow="Claude trader" title={<>The <em className="serif-em">desk</em></>}
      description="What each bot is watching, why it is or isn’t trading, and what it has made or lost. Live: updates every 5 seconds." />
  );

  if (!result.ok || !s) {
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

  const ccy = s.account.currency;
  const age = now === null ? 0 : (now - Date.parse(data!.updated_at ?? s.generated_at)) / 1000;
  const stale = age > STALE_S;
  const all = summary(s.trades);
  const markets = s.markets ?? [];
  const perMarket = Array.from(new Set(s.trades.map((t) => t.symbol))).map((sym) => ({ sym, ...summary(s.trades.filter((t) => t.symbol === sym)) }));

  return (
    <>
      {head}

      <div className="trade-strip" role="status">
        <span className={`trade-dot ${stale ? "is-off" : "is-on"}`} aria-hidden="true" />
        <span>{stale ? "Reporter offline — " : "Live — "}last update {ago(data!.updated_at, now)}</span>
        <span className={`chip ${s.account.mode === "DEMO" ? "chip-done" : "chip-sealed"}`}>{s.account.mode} account</span>
        <span className="chip">1:{s.account.leverage}</span>
        <span className="chip">risk {s.settings.risk_pct}% / trade</span>
        {s.settings.kill_switch && <span className="chip chip-sealed">Kill switch ON</span>}
      </div>

      <section className="trade-stats" aria-label="Account">
        <div className="trade-stat"><span>Equity</span><b>{money(s.account.equity)}</b><small>{ccy}</small></div>
        <div className="trade-stat"><span>Open P/L</span><b className={s.account.profit >= 0 ? "pos" : "neg"}>{signed(s.account.profit)}</b><small>{s.positions.length} open</small></div>
        <div className="trade-stat"><span>Closed today</span><b className={today >= 0 ? "pos" : "neg"}>{signed(today)}</b><small>{ccy}</small></div>
        <div className="trade-stat"><span>Net P/L</span><b className={all.net >= 0 ? "pos" : "neg"}>{signed(all.net)}</b><small>made {signed(all.won)} · lost {signed(all.lost)}</small></div>
        <div className="trade-stat"><span>Live win rate</span><b>{all.winRate === null ? "—" : `${all.winRate.toFixed(0)}%`}</b><small>{all.wins} won · {all.losses} lost · backtest 72–82% per bot</small></div>
      </section>

      <OpenTrades positions={s.positions} currency={ccy} now={now} />

      {markets.length > 0 && (
        <section aria-label="Markets">
          <div className="trade-section-head">
            <h2 className="trade-h">Markets</h2>
            <p className="trade-muted">Live candles. Each bot decides on its own closed candle: 5-minute, hourly or 4-hour.</p>
          </div>
          <div className="market-grid">
            {markets.map((m) => <MarketCard key={`${m.bot}-${m.pair}`} m={m} trades={s.trades} currency={ccy} />)}
          </div>
        </section>
      )}

      <section className="trade-card">
        <h2 className="trade-h">Equity, last 30 days</h2>
        <EquityChart points={data!.equity} />
      </section>

      <section className="trade-card">
        <h2 className="trade-h">Open positions</h2>
        {s.positions.length === 0 ? <p className="trade-muted">No open trades.</p> : (
          <div className="trade-table-wrap">
            <table className="trade-table">
              <thead><tr><th>Market</th><th>Side</th><th>Lots</th><th>Entry</th><th>Now</th><th>Stop</th><th>Target</th><th>Progress</th><th>P/L</th><th>Opened</th></tr></thead>
              <tbody>{s.positions.map((p, i) => {
                const dir = p.side === "BUY" ? 1 : -1;
                const toTp = p.tp ? (dir * (p.now - p.open)) / Math.abs(p.tp - p.open) : 0;
                const toSl = p.sl ? (dir * (p.now - p.open)) / Math.abs(p.open - p.sl) : 0;
                const prog = toTp >= 0 ? `${Math.round(toTp * 100)}% to target` : `${Math.round(-toSl * 100)}% to stop`;
                return (
                  <tr key={i}><td>{p.symbol}</td><td>{p.side}</td><td>{p.lots}</td><td>{p.open}</td><td>{p.now}</td>
                    <td>{p.sl}</td><td>{p.tp}</td><td>{prog}</td><td className={p.profit >= 0 ? "pos" : "neg"}>{signed(p.profit)}</td><td>{ago(p.opened, now)}</td></tr>
                );
              })}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="trade-card">
        <h2 className="trade-h">Profit and loss by market</h2>
        {perMarket.length === 0 ? <p className="trade-muted">No closed trades yet. Each market’s wins, losses and net appear here after its first trade.</p> : (
          <div className="trade-table-wrap">
            <table className="trade-table">
              <thead><tr><th>Market</th><th>Trades</th><th>Win rate</th><th>Made</th><th>Lost</th><th>Net</th><th>Best</th><th>Worst</th></tr></thead>
              <tbody>{perMarket.map((m) => (
                <tr key={m.sym}><td>{m.sym}</td><td>{m.n}</td><td>{m.winRate === null ? "—" : `${m.winRate.toFixed(0)}%`}</td>
                  <td className="pos">{signed(m.won)}</td><td className="neg">{signed(m.lost)}</td>
                  <td className={m.net >= 0 ? "pos" : "neg"}>{signed(m.net)}</td>
                  <td>{m.best ? signed(m.best.profit) : "—"}</td><td>{m.worst ? signed(m.worst.profit) : "—"}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <TradeHistory history={data!.history ?? []} currency={ccy} />

      <section className="trade-card">
        <h2 className="trade-h">Every closed trade</h2>
        {s.trades.length === 0 ? <p className="trade-muted">No closed trades yet.</p> : (
          <div className="trade-table-wrap">
            <table className="trade-table">
              <thead><tr><th>Closed</th><th>Market</th><th>Side</th><th>Lots</th><th>Entry</th><th>Exit</th><th>Why it closed</th><th>Result</th><th>P/L</th></tr></thead>
              <tbody>{s.trades.slice(0, 50).map((t, i) => (
                <tr key={i}><td>{when(t.closed)}</td><td>{t.symbol}</td><td>{t.side}</td><td>{t.lots}</td>
                  <td>{t.open}</td><td>{t.close}</td><td>{t.reason === "target" ? "hit target" : t.reason === "stop" ? "hit stop" : "time / manual"}</td>
                  <td>{t.r === null || t.r === undefined ? "—" : `${t.r > 0 ? "+" : ""}${t.r}R`}</td>
                  <td className={t.profit >= 0 ? "pos" : "neg"}>{signed(t.profit)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        )}
      </section>

      <section className="trade-card">
        <div className="trade-card-top">
          <h2 className="trade-h">High-impact news</h2>
          {!s.news.ok && <span className="chip chip-sealed">Feed down — bots not trading</span>}
        </div>
        {Object.keys(s.news.blocked).length > 0 && (
          <p className="trade-block">Paused right now: {Object.entries(s.news.blocked).map(([pair, why]) => `${pair} (${why})`).join(", ")}</p>
        )}
        {s.news.upcoming.length === 0 ? <p className="trade-muted">No high-impact events left this week.</p> : (
          <ul className="trade-news">{s.news.upcoming.map((e, i) => (
            <li key={i}><time>{when(e.time)}</time><span className="chip">{e.currency}</span><span>{e.title}</span></li>
          ))}</ul>
        )}
        <p className="trade-muted">Bots skip new trades from 30 min before to 30 min after each event on the affected pairs (2 hours for the Gold NY-open and J-Dub gold bots).</p>
      </section>

      <section className="trade-grid">
        {Object.entries(s.bots).map(([name, bot]) => (
          <article className="trade-card" key={name}>
            <div className="trade-card-top">
              <h2 className="trade-h">{botName(name)}</h2>
              <span className={`chip ${bot.running ? "chip-done" : ""}`}>{bot.running ? "Running" : "Stopped"}</span>
            </div>
            <p className="trade-muted">{Object.keys(bot.markets).join(" · ")}</p>
            <details className="trade-log">
              <summary>Bot log · {ago(bot.last_seen, now)}</summary>
              <pre>{bot.lines.length ? bot.lines.slice(-25).join("\n") : "No log yet."}</pre>
            </details>
          </article>
        ))}
      </section>
    </>
  );
}
