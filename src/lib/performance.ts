/**
 * Public track record. Pure: turns the raw rows from trader_public_record() into percentages and
 * trade statistics that are safe to show anyone. No money amounts, lot sizes or account details
 * leave this function, only returns, R multiples and counts.
 *
 * Return = time-weighted: between two equity readings the growth is (equity after - money moved in
 * between) / equity before, so deposits and withdrawals never count as profit or loss.
 */

export type RawPoint = { t: string; e: number };
export type RawFlow = { t: string; amount: number };
export type RawTrade = {
  bot: string | null; symbol: string | null; side: string | null;
  profit: number | null; r: number | null; opened: string | null; closed: string;
};
export type RawRecord = {
  start: string | null; updated_at: string | null; currency: string | null; equity: number | null;
  daily: RawPoint[]; recent: RawPoint[]; flows: RawFlow[]; trades: RawTrade[];
};

export type RecordPoint = { t: string; growth: number };        // growth: 0.05 = +5% since start
export type AgentStat = { bot: string; trades: number; winRate: number; avgR: number | null };
export type PublicTrade = { bot: string; symbol: string; side: string; r: number | null; win: boolean; closed: string };
export type PublicRecord = {
  start: string; updatedAt: string | null; days: number;
  growth: number; maxDrawdown: number; series: RecordPoint[];
  trades: number; wins: number; winRate: number | null; profitFactor: number | null;
  avgR: number | null; bestR: number | null; worstR: number | null;
  agents: AgentStat[]; recent: PublicTrade[];
  early: boolean;                                              // under 30 days or 30 trades
};

const DAY = 86_400_000;

/** Merges the long daily closes with the last 30 days of hourly points, from `start` on. */
export function mergeSeries(daily: RawPoint[], recent: RawPoint[], startT: number): RawPoint[] {
  const firstRecent = recent.length ? Date.parse(recent[0].t) : Infinity;
  return [...daily.filter((p) => Date.parse(p.t) < firstRecent), ...recent]
    .filter((p) => Date.parse(p.t) >= startT && p.e > 0)
    .sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
}

/** Time-weighted growth: money moved between two readings is taken out before measuring. */
export function timeWeighted(points: RawPoint[], flows: RawFlow[]): RecordPoint[] {
  if (!points.length) return [];
  const out: RecordPoint[] = [{ t: points[0].t, growth: 0 }];
  let index = 1;
  let fi = 0;
  const fl = [...flows].sort((a, b) => Date.parse(a.t) - Date.parse(b.t));
  const t0 = Date.parse(points[0].t);
  while (fi < fl.length && Date.parse(fl[fi].t) <= t0) fi++;
  for (let i = 1; i < points.length; i++) {
    const t = Date.parse(points[i].t);
    let moved = 0;
    while (fi < fl.length && Date.parse(fl[fi].t) <= t) moved += fl[fi++].amount;
    const before = points[i - 1].e;
    if (before > 0) index *= (points[i].e - moved) / before;
    out.push({ t: points[i].t, growth: index - 1 });
  }
  return out;
}

export function maxDrawdown(series: RecordPoint[]): number {
  let peak = 1, dd = 0;
  for (const p of series) {
    const v = 1 + p.growth;
    peak = Math.max(peak, v);
    dd = Math.min(dd, v / peak - 1);
  }
  return dd;
}

export function buildRecord(raw: RawRecord, now = Date.now()): PublicRecord | null {
  const pts0 = mergeSeries(raw.daily, raw.recent, 0);
  const start = raw.start ?? pts0[0]?.t ?? null;
  if (!start) return null;
  const startT = Date.parse(start);
  const pts = mergeSeries(raw.daily, raw.recent, startT);
  // the live reading closes the series, so the page is never behind the dashboard
  if (raw.equity && raw.equity > 0 && raw.updated_at && (!pts.length || Date.parse(raw.updated_at) > Date.parse(pts[pts.length - 1].t))) {
    pts.push({ t: raw.updated_at, e: raw.equity });
  }
  const series = timeWeighted(pts, raw.flows.filter((f) => Date.parse(f.t) > startT));

  const trades = raw.trades.filter((t) => Date.parse(t.closed) >= startT && t.profit !== null);
  const wins = trades.filter((t) => (t.profit ?? 0) > 0).length;
  const gain = trades.reduce((s, t) => s + Math.max(t.profit ?? 0, 0), 0);
  const loss = trades.reduce((s, t) => s + Math.min(t.profit ?? 0, 0), 0);
  const rs = trades.map((t) => t.r).filter((r): r is number => typeof r === "number" && Number.isFinite(r));
  const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null);

  const byBot = new Map<string, RawTrade[]>();
  for (const t of trades) {
    const k = t.bot ?? "other";
    byBot.set(k, [...(byBot.get(k) ?? []), t]);
  }
  const agents: AgentStat[] = [...byBot.entries()].map(([bot, ts]) => ({
    bot, trades: ts.length,
    winRate: ts.filter((t) => (t.profit ?? 0) > 0).length / ts.length,
    avgR: mean(ts.map((t) => t.r).filter((r): r is number => typeof r === "number" && Number.isFinite(r))),
  })).sort((a, b) => b.trades - a.trades);

  const days = Math.max(0, (now - startT) / DAY);
  return {
    start, updatedAt: raw.updated_at, days,
    growth: series.length ? series[series.length - 1].growth : 0,
    maxDrawdown: maxDrawdown(series), series,
    trades: trades.length, wins,
    winRate: trades.length ? wins / trades.length : null,
    profitFactor: loss < 0 ? gain / -loss : null,
    avgR: mean(rs), bestR: rs.length ? Math.max(...rs) : null, worstR: rs.length ? Math.min(...rs) : null,
    agents,
    recent: trades.slice(0, 20).map((t) => ({
      bot: t.bot ?? "other", symbol: (t.symbol ?? "").replace(/[cm]$/, ""), side: t.side ?? "",
      r: typeof t.r === "number" && Number.isFinite(t.r) ? t.r : null, win: (t.profit ?? 0) > 0, closed: t.closed,
    })),
    early: days < 30 || trades.length < 30,
  };
}
