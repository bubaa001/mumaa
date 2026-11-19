"use client";

import { botName, TF_NAME, type TraderCheck, type TraderMarket, type TraderTrade } from "@/lib/trader";

const VERDICT: Record<TraderMarket["verdict"], { label: string; tone: string }> = {
  in_trade: { label: "In a trade", tone: "tone-live" },
  signal: { label: "Signal now", tone: "tone-live" },
  watching: { label: "Watching", tone: "tone-calm" },
  paused: { label: "Paused", tone: "tone-warn" },
  stopped: { label: "Bot stopped", tone: "tone-off" },
};

const OVERLAY_LABEL: Record<string, string> = {
  mean: "40h average", upper: "upper band", lower: "lower band", ema: "200h trend",
};

function digits(v: number) {
  const s = String(v);
  return s.includes(".") ? Math.min(5, s.split(".")[1].length) : 0;
}

/** H1 candles with the strategy's own lines drawn on top; the last candle is the one still forming. */
export function CandleChart({ m }: { m: TraderMarket }) {
  const w = 640, h = 220, padR = 64, padY = 12;
  const c = m.candles;
  if (!c.length) return null;
  const pos = m.position;
  const levels = pos ? [pos.open, pos.sl, pos.tp].filter((v) => v > 0) : [];
  const ov = Object.entries(m.overlay);
  const vals = [
    ...c.flatMap((k) => [k[2], k[3]]),
    ...ov.flatMap(([, s]) => s.filter((v): v is number => v !== null)),
    ...levels,
  ];
  const lo = Math.min(...vals), hi = Math.max(...vals);
  const span = hi - lo || 1;
  const y = (v: number) => padY + (1 - (v - lo) / span) * (h - 2 * padY);
  const step = (w - padR) / c.length;
  const body = Math.max(2, step * 0.62);
  const nd = digits(m.price);
  const x = (i: number) => i * step + step / 2;

  return (
    <figure className="candles">
      <svg viewBox={`0 0 ${w} ${h}`} role="img"
        aria-label={`${m.pair} last ${c.length} ${TF_NAME[m.tf ?? "H1"] ?? "hourly"} candles, now ${m.price}`}>
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} className="grid" x1={0} x2={w - padR} y1={padY + f * (h - 2 * padY)} y2={padY + f * (h - 2 * padY)} />
        ))}
        {ov.map(([name, series]) => {
          // overlays cover the closed candles only (one fewer than candles when a forming bar is present)
          const pts = series.map((v, i) => (v === null ? null : `${x(i).toFixed(1)},${y(v).toFixed(1)}`)).filter(Boolean);
          return <polyline key={name} className={`ov ov-${name}`} points={pts.join(" ")} />;
        })}
        {c.map(([t, o, hgh, low, cl], i) => {
          const up = cl >= o;
          const live = i === c.length - 1;
          return (
            <g key={t} className={`${up ? "up" : "down"}${live ? " live" : ""}`}>
              <line x1={x(i)} x2={x(i)} y1={y(hgh)} y2={y(low)} />
              <rect x={x(i) - body / 2} width={body} y={y(Math.max(o, cl))} height={Math.max(1, Math.abs(y(o) - y(cl)))} rx={1} />
            </g>
          );
        })}
        {pos && [
          { v: pos.open, cls: "lvl-entry", t: "entry" },
          { v: pos.sl, cls: "lvl-sl", t: "stop" },
          { v: pos.tp, cls: "lvl-tp", t: "target" },
        ].filter((l) => l.v > 0).map((l) => (
          <g key={l.t} className={l.cls}>
            <line x1={0} x2={w - padR} y1={y(l.v)} y2={y(l.v)} />
            <text x={4} y={y(l.v) - 4}>{l.t}</text>
          </g>
        ))}
        <g className="last">
          <line x1={0} x2={w - padR} y1={y(m.price)} y2={y(m.price)} />
          <rect x={w - padR + 2} y={y(m.price) - 10} width={padR - 4} height={20} rx={5} />
          <text x={w - padR / 2} y={y(m.price) + 4} textAnchor="middle">{m.price.toFixed(nd)}</text>
        </g>
      </svg>
      <figcaption>
        <span className="legend"><i className="lg-live" /> forming candle</span>
        {ov.map(([name]) => <span className="legend" key={name}><i className={`lg-${name}`} />{OVERLAY_LABEL[name] ?? name}</span>)}
        {pos && <span className="legend"><i className="lg-sl" />stop · <i className="lg-tp" />target</span>}
      </figcaption>
    </figure>
  );
}

function Check({ c }: { c: TraderCheck }) {
  return (
    <li className={c.ok ? "ok" : "no"}>
      <span className="mark" aria-hidden="true">{c.ok ? "✓" : "·"}</span>
      <span className="sr-only">{c.ok ? "met:" : "not met:"}</span>
      <span>{c.label}</span>
      {c.detail && <small>{c.detail}</small>}
    </li>
  );
}

export function Confidence({ grade, label, compact = false }: { grade: "High" | "Medium" | "Low"; label?: string; compact?: boolean }) {
  const n = grade === "High" ? 3 : grade === "Medium" ? 2 : 1;
  const text = label ?? grade;
  return (
    <span className={`conf conf-${grade.toLowerCase()}${compact ? " conf-compact" : ""}`}
      title="Based on backtest trade count, results on unseen data, and how many nearby settings were also profitable"
      aria-label={`${text} confidence`}>
      <span className="conf-bars" aria-hidden="true">{[1, 2, 3].map((i) => <i key={i} data-on={i <= n} />)}</span>
      <span aria-hidden="true">{compact ? text : `${text} confidence`}</span>
    </span>
  );
}

function money(v: number) {
  return `${v > 0 ? "+" : ""}${v.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function MarketCard({ m, trades, currency }: { m: TraderMarket; trades: TraderTrade[]; currency: string }) {
  if (m.error) {
    return <article className="trade-card market"><h3 className="market-pair">{m.pair}</h3><p className="trade-muted">Couldn’t read this market: {m.error}</p></article>;
  }
  const v = VERDICT[m.verdict];
  const mine = trades.filter((t) => t.symbol === m.pair && t.bot === m.bot);
  const wins = mine.filter((t) => t.profit > 0);
  const losses = mine.filter((t) => t.profit < 0);
  const pnl = mine.reduce((s, t) => s + t.profit, 0);
  const rec = m.record;
  const meterPct = m.meter.value === null ? 0 : Math.min(100, (Math.abs(m.meter.value) / m.meter.target) * 100);

  return (
    <article className="trade-card market">
      <header className="market-head">
        <div>
          <h3 className="market-pair">{m.pair}</h3>
          <p className="market-strat">{m.name} · {TF_NAME[m.tf ?? "H1"] ?? m.tf} candles · {botName(m.bot)}</p>
        </div>
        <div className="market-badges">
          {rec && <Confidence grade={rec.confidence} />}
          <span className={`verdict ${v.tone}`}>{v.label}</span>
        </div>
      </header>

      <p className="market-why"><b>{m.verdict === "watching" ? "Why not trading: " : m.verdict === "signal" ? "Why trading: " : m.verdict === "in_trade" ? "Now: " : "Why not trading: "}</b>{m.why}</p>

      <CandleChart m={m} />

      <div className="market-body">
        <section>
          <h4 className="market-sub">Entry checklist</h4>
          <ul className="checks">{m.checks.map((c) => <Check c={c} key={c.label} />)}</ul>
          <div className="meter" aria-label={`${m.meter.label} ${m.meter.value ?? "unknown"} of ${m.meter.target}${m.meter.unit}`}>
            <div className="meter-top"><span>{m.meter.label}</span><span>{m.meter.value ?? "—"}{m.meter.unit} / {m.meter.target}{m.meter.unit}</span></div>
            <div className="meter-track"><div className="meter-fill" style={{ width: `${meterPct}%` }} data-full={meterPct >= 100} /></div>
          </div>
          <h4 className="market-sub">Bot safety gates</h4>
          <ul className="checks">{m.gates.map((c) => <Check c={c} key={c.label} />)}</ul>
        </section>

        <section>
          <h4 className="market-sub">Record</h4>
          <dl className="trade-dl market-dl">
            <div><dt>Backtest win rate</dt><dd>{rec ? `${rec.win_rate}%` : "—"}</dd></div>
            <div><dt>Live win rate</dt><dd>{mine.length ? `${Math.round((wins.length / mine.length) * 100)}%` : "—"}</dd></div>
            <div><dt>Live P/L</dt><dd className={pnl >= 0 ? "pos" : "neg"}>{mine.length ? money(pnl) : "—"}</dd></div>
            <div><dt>Avg per trade</dt><dd>{rec ? `${rec.avg_r > 0 ? "+" : ""}${rec.avg_r}R` : "—"}</dd></div>
            <div><dt>Trades / month</dt><dd>{rec?.per_month ?? "—"}</dd></div>
            <div><dt>Worst drawdown</dt><dd>{rec ? `${rec.max_dd}%` : "—"}</dd></div>
            <div><dt>Won / lost live</dt><dd><span className="pos">{wins.length}</span> / <span className="neg">{losses.length}</span></dd></div>
            <div><dt>Unseen-data win rate</dt><dd>{rec ? `${rec.oos_win_rate}%` : "—"}</dd></div>
            <div><dt>Nearby settings profitable</dt><dd>{rec ? `${rec.robust_pct}%` : "—"}</dd></div>
          </dl>
          <details className="market-how">
            <summary>How this strategy trades</summary>
            <p>{m.how}</p>
            <p className="trade-muted">
              Stop {m.would_sl} · target {m.would_tp} away at current volatility (ATR {m.atr}).
              {rec && ` Backtest ${rec.period}, ${rec.trades} trades, costs and news filter included.`} Amounts in {currency}.
            </p>
          </details>
        </section>
      </div>
    </article>
  );
}
