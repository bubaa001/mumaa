/** Reads the trading bots' status, pushed from the PC by claude-trader/reporter.py. */

export type TraderPosition = {
  bot: string; symbol: string; side: "BUY" | "SELL"; lots: number;
  open: number; now: number; sl: number; tp: number; profit: number; opened: string;
  risk?: number | null; r_now?: number | null;
};
export type TraderTrade = {
  bot: string; symbol: string; side: "BUY" | "SELL"; lots: number; open: number; close: number;
  profit: number; opened: string; closed: string; reason: string; r?: number | null; strategy?: string;
};
export type TraderCheck = { label: string; ok: boolean; detail: string };
export type TraderRecord = {
  trades: number; per_month: number; win_rate: number; avg_r: number; profit_factor: number; max_dd: number;
  oos_win_rate: number; oos_avg_r: number; best_r: number; worst_r: number; robust_pct: number;
  confidence: "High" | "Medium" | "Low"; score: number; period: string;
};
export type TraderMarket = {
  pair: string; bot: string; error?: string;
  strategy: string; name: string; how: string; params: Record<string, unknown>;
  candle_time: string; price: number; signal: number;
  checks: TraderCheck[]; gates: TraderCheck[]; setup_ok: boolean;
  meter: { label: string; value: number | null; target: number; unit: string };
  candles: [number, number, number, number, number][];
  overlay: Record<string, (number | null)[]>;
  atr: number; would_sl: number; would_tp: number;
  verdict: "in_trade" | "stopped" | "paused" | "signal" | "watching"; why: string;
  position: TraderPosition | null; record?: TraderRecord;
};
export type TraderBot = {
  running: boolean; markets: Record<string, string>; last_seen: string | null; log_age_s?: number;
  lines: string[];
  backtest?: { win_rate: number; avg_r: number; profit_factor: number; max_dd: number; trades_per_2w: number };
};
export type TraderState = {
  generated_at: string;
  account: { mode: string; currency: string; leverage: number; balance: number; equity: number;
    margin: number; free_margin: number; profit: number };
  settings: { risk_pct: number; daily_loss_pct: number; max_open: number; max_same_usd_dir: number; kill_switch: boolean };
  bots: Record<string, TraderBot>;
  positions: TraderPosition[];
  trades: TraderTrade[];
  markets?: TraderMarket[];
  news: { ok: boolean; error?: string; upcoming: { time: string; currency: string; title: string }[]; blocked: Record<string, string> };
};
export type TraderPull = {
  state: TraderState | null;
  updated_at: string | null;
  equity: { t: string; e: number; b: number }[];
};

export type TraderResult = { ok: true; data: TraderPull } | { ok: false; error: string };

export async function pullTrader(): Promise<TraderResult> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  const token = process.env.TRADER_READ_TOKEN;
  if (!url || !key || !token) return { ok: false, error: "The trading page is not configured yet (TRADER_READ_TOKEN missing)." };
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/rest/v1/rpc/trader_pull`, {
      method: "POST",
      cache: "no-store",
      headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ p_token: token }),
    });
    if (res.status === 404) return { ok: false, error: "The trading tables are not set up in Supabase yet." };
    if (!res.ok) return { ok: false, error: `Could not read bot status (${res.status}).` };
    return { ok: true, data: (await res.json()) as TraderPull };
  } catch {
    return { ok: false, error: "Could not reach the database." };
  }
}
