import type { Metadata } from "next";
import { pullPublicRecord } from "@/lib/performance-server";
import type { PublicRecord, RecordPoint } from "@/lib/performance";
import { botName } from "@/lib/trader";

// Public: no sign-in. Shows percentages and R multiples only, never money amounts or account details.
export const revalidate = 300;

export const metadata: Metadata = {
  title: "Mumaa Trading · Live track record",
  description: "Rule-based forex and gold trading agents. Every closed trade since tracking began, wins and losses.",
  robots: { index: false, follow: false },   // shared by link only until the record is long enough
};

const pct = (v: number | null, d = 1) => (v === null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(d)}%`);
const rTxt = (v: number | null) => (v === null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(2)}R`);
const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
const dayTime = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "UTC" });

export default async function PerformancePage() {
  const res = await pullPublicRecord();
  return (
    <main className="perf">
      <header className="perf-head">
        <p className="perf-kicker">Mumaa Trading</p>
        <h1 className="perf-title">Live track record</h1>
        <p className="perf-lead">Rule-based trading agents on forex and gold, running 24/7 on a real account.
          Every closed trade since tracking began is counted here, wins and losses alike.</p>
      </header>
      {!res.ok ? (
        <section className="perf-card"><p>{res.error}</p></section>
      ) : !res.record ? (
        <section className="perf-card"><p>The record starts with the first trading day. Check back soon.</p></section>
      ) : (
        <Record r={res.record} verified={res.verified} />
      )}
      <footer className="perf-foot">
        <p><b>Not investment advice.</b> This page shows what happened, not what will happen. Past results do not
          predict future results, and trading with leverage can lose more than the profits shown. We do not take
          money through this page.</p>
        <p>Returns are time-weighted: deposits and withdrawals are taken out, so only trading moves the line.
          R is a trade&rsquo;s result measured in units of the amount it risked. Times are UTC.</p>
      </footer>
    </main>
  );
}

function Record({ r, verified }: { r: PublicRecord; verified: { url: string; label: string } | null }) {
  const stats: [string, string, string?][] = [
    ["Return since start", pct(r.growth, 2), r.growth > 0 ? "pos" : r.growth < 0 ? "neg" : undefined],
    ["Worst drop from a high", pct(r.maxDrawdown, 2), r.maxDrawdown < 0 ? "neg" : undefined],
    ["Closed trades", String(r.trades)],
    ["Win rate", pct(r.winRate, 0)],
    ["Profit factor", r.profitFactor === null ? "—" : r.profitFactor.toFixed(2)],
    ["Average trade", rTxt(r.avgR)],
  ];
  return (
    <>
      <section className="perf-card" aria-labelledby="perf-since">
        <div className="perf-since">
          <h2 id="perf-since">Since {day(r.start)} · {Math.floor(r.days)} {Math.floor(r.days) === 1 ? "day" : "days"}</h2>
          {r.early && <span className="perf-badge">Early days: too short to judge</span>}
        </div>
        <dl className="perf-stats">
          {stats.map(([k, v, tone]) => <div key={k}><dt>{k}</dt><dd className={tone}>{v}</dd></div>)}
        </dl>
        <GrowthLine series={r.series} />
        {r.updatedAt && <p className="perf-muted">Last update {dayTime(r.updatedAt)} UTC. Refreshes every 5 minutes.</p>}
      </section>

      <section className="perf-card" aria-labelledby="perf-verify">
        <h2 id="perf-verify">Independent check</h2>
        {verified ? (
          <p>The same account, tracked by a third party: <a className="perf-link" href={verified.url} target="_blank" rel="noopener noreferrer">{verified.label} ↗</a></p>
        ) : (
          <p className="perf-muted">A third-party verified record (read-only broker access) is being set up. Until then,
            treat these numbers as self-reported.</p>
        )}
      </section>

      {r.agents.length > 0 && (
        <section className="perf-card" aria-labelledby="perf-agents">
          <h2 id="perf-agents">By agent</h2>
          <div className="perf-table-wrap">
            <table className="perf-table">
              <thead><tr><th>Agent</th><th>Trades</th><th>Win rate</th><th>Average</th></tr></thead>
              <tbody>{r.agents.map((a) => (
                <tr key={a.bot}><td>{botName(a.bot)}</td><td>{a.trades}</td><td>{pct(a.winRate, 0)}</td>
                  <td className={a.avgR === null ? "" : a.avgR >= 0 ? "pos" : "neg"}>{rTxt(a.avgR)}</td></tr>
              ))}</tbody>
            </table>
          </div>
        </section>
      )}

      {r.recent.length > 0 && (
        <section className="perf-card" aria-labelledby="perf-trades">
          <h2 id="perf-trades">Latest trades</h2>
          <div className="perf-table-wrap">
            <table className="perf-table">
              <thead><tr><th>Closed</th><th>Market</th><th>Side</th><th>Agent</th><th>Result</th></tr></thead>
              <tbody>{r.recent.map((t, i) => (
                <tr key={i}><td>{dayTime(t.closed)}</td><td>{t.symbol}</td><td>{t.side}</td><td>{botName(t.bot)}</td>
                  <td className={t.win ? "pos" : "neg"}>{t.r === null ? (t.win ? "Win" : "Loss") : rTxt(t.r)}</td></tr>
              ))}</tbody>
            </table>
          </div>
          <p className="perf-muted">The 20 most recent of {r.trades} closed trades.</p>
        </section>
      )}
    </>
  );
}

/** Growth since start, drawn on the server. Above zero in green, below in red. */
function GrowthLine({ series }: { series: RecordPoint[] }) {
  if (series.length < 2) return <p className="perf-muted">The chart appears after the first few hours of readings.</p>;
  const W = 720, H = 220, L = 52, R = 12, T = 12, B = 28;
  const t0 = Date.parse(series[0].t), t1 = Date.parse(series[series.length - 1].t);
  const vs = series.map((p) => p.growth);
  let lo = Math.min(0, ...vs), hi = Math.max(0, ...vs);
  const pad = Math.max((hi - lo) * 0.12, 0.002);
  lo -= pad; hi += pad;
  const x = (t: string) => L + ((Date.parse(t) - t0) / Math.max(t1 - t0, 1)) * (W - L - R);
  const y = (v: number) => T + ((hi - v) / (hi - lo)) * (H - T - B);
  const path = series.map((p, i) => `${i ? "L" : "M"}${x(p.t).toFixed(1)},${y(p.growth).toFixed(1)}`).join(" ");
  const area = `${path} L${x(series[series.length - 1].t).toFixed(1)},${y(0).toFixed(1)} L${L},${y(0).toFixed(1)} Z`;
  const step = (hi - lo) / 4;
  const ticks = [0, 1, 2, 3, 4].map((i) => lo + step * i);
  const last = series[series.length - 1];
  return (
    <svg className="perf-chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Growth since start: ${pct(last.growth, 2)}`}>
      <defs>
        <clipPath id="perf-up"><rect x="0" y="0" width={W} height={y(0)} /></clipPath>
        <clipPath id="perf-down"><rect x="0" y={y(0)} width={W} height={H} /></clipPath>
      </defs>
      {ticks.map((v, i) => (
        <g key={i}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="perf-grid" />
          <text x={L - 8} y={y(v) + 4} textAnchor="end" className="perf-axis">{pct(v, Math.abs(hi - lo) < 0.05 ? 1 : 0)}</text>
        </g>
      ))}
      <line x1={L} x2={W - R} y1={y(0)} y2={y(0)} className="perf-zero" />
      <path d={area} className="perf-area-up" clipPath="url(#perf-up)" />
      <path d={area} className="perf-area-down" clipPath="url(#perf-down)" />
      <path d={path} className="perf-line" />
      <circle cx={x(last.t)} cy={y(last.growth)} r="4" className={last.growth >= 0 ? "perf-dot-up" : "perf-dot-down"} />
      <text x={L} y={H - 8} className="perf-axis">{day(series[0].t)}</text>
      <text x={W - R} y={H - 8} textAnchor="end" className="perf-axis">{day(last.t)}</text>
    </svg>
  );
}
