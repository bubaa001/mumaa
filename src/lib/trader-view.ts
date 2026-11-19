/** Pure helpers that turn the reporter's state into what the desk shows: agents, totals and labels. */
import {
  botName,
  type TraderBot,
  type TraderMarket,
  type TraderPosition,
  type TraderReplay,
  type TraderState,
  type TraderTrade,
} from "./trader";

export type AgentState = TraderMarket["verdict"];

export type DeskView = "overview" | "agents" | "trades" | "rules";
export type DeskNav = { view: DeskView; agent: string | null; market: string | null };
export const VIEWS: { id: DeskView; label: string; short?: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "agents", label: "Agents" },
  { id: "trades", label: "Trades" },
  { id: "rules", label: "News & rules", short: "News" },
];
export const isView = (v: unknown): v is DeskView => VIEWS.some((x) => x.id === v);

/** Most urgent first: this is the order agents are listed in and how one agent's markets roll up. */
export const STATE_ORDER: AgentState[] = ["in_trade", "signal", "paused", "watching", "stopped"];

export const STATE_LABEL: Record<AgentState, { label: string; tone: string }> = {
  in_trade: { label: "In a trade", tone: "tone-live" },
  signal: { label: "Signal now", tone: "tone-live" },
  watching: { label: "Watching", tone: "tone-calm" },
  paused: { label: "Paused", tone: "tone-warn" },
  stopped: { label: "Stopped", tone: "tone-off" },
};

export type Tally = {
  n: number; wins: number; losses: number; won: number; lost: number; net: number;
  winRate: number | null; best: TraderTrade | null; worst: TraderTrade | null;
};

export function tally(trades: TraderTrade[]): Tally {
  let wins = 0, losses = 0, won = 0, lost = 0;
  let best: TraderTrade | null = null, worst: TraderTrade | null = null;
  for (const t of trades) {
    if (t.profit > 0) { wins++; won += t.profit; }
    else if (t.profit < 0) { losses++; lost += t.profit; }
    if (!best || t.profit > best.profit) best = t;
    if (!worst || t.profit < worst.profit) worst = t;
  }
  return { n: trades.length, wins, losses, won, lost, net: won + lost,
    winRate: trades.length ? (wins / trades.length) * 100 : null, best, worst };
}

export type Agent = {
  id: string;
  name: string;
  bot: TraderBot | null;
  running: boolean;
  state: AgentState;
  markets: TraderMarket[];
  pairs: string[];
  strategies: string[];
  positions: TraderPosition[];
  openPnl: number;
  trades: TraderTrade[];
  record: Tally;
};

/** Every bot the reporter knows about, from its process list or its markets, with its rolled-up state. */
export function agentsFrom(s: TraderState): Agent[] {
  const markets = s.markets ?? [];
  const ids = Array.from(new Set([...Object.keys(s.bots), ...markets.map((m) => m.bot)]));
  const agents = ids.map((id): Agent => {
    const bot = s.bots[id] ?? null;
    const mine = markets.filter((m) => m.bot === id);
    const positions = s.positions.filter((p) => p.bot === id);
    const trades = s.trades.filter((t) => t.bot === id);
    const running = bot ? bot.running : mine.some((m) => m.verdict !== "stopped");
    let state: AgentState = "watching";
    if (!running) state = "stopped";
    else if (positions.length) state = "in_trade";
    else state = STATE_ORDER.find((v) => mine.some((m) => m.verdict === v)) ?? "watching";
    const pairs = mine.length ? mine.map((m) => m.pair) : Object.keys(bot?.markets ?? {});
    return {
      id, name: botName(id), bot, running, state, markets: sortMarkets(mine), pairs,
      strategies: Array.from(new Set(mine.map((m) => m.name).filter(Boolean))),
      positions, openPnl: positions.reduce((sum, p) => sum + p.profit, 0),
      trades, record: tally(trades),
    };
  });
  return agents.sort((a, b) => STATE_ORDER.indexOf(a.state) - STATE_ORDER.indexOf(b.state));
}

function sortMarkets(ms: TraderMarket[]) {
  return [...ms].sort((a, b) => STATE_ORDER.indexOf(a.verdict) - STATE_ORDER.indexOf(b.verdict));
}

/** Replays when the history table has them; otherwise the reporter's recent closed trades, without charts. */
export function closedTrades(s: TraderState, history: TraderReplay[]): (TraderTrade & { replay?: TraderReplay })[] {
  if (history.length) return history.map((r) => ({ ...r, replay: r }));
  return s.trades;
}

export function money(value: number | undefined | null, currency = "") {
  if (value === undefined || value === null || Number.isNaN(value)) return "—";
  const text = value.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return currency ? `${text} ${currency}` : text;
}

export function signed(value: number) {
  return `${value > 0 ? "+" : value < 0 ? "−" : ""}${money(Math.abs(value))}`;
}

export function rText(r: number | null | undefined) {
  if (r === null || r === undefined) return "";
  return `${r > 0 ? "+" : r < 0 ? "−" : ""}${Math.abs(r).toFixed(2).replace(/\.?0+$/, "")}R`;
}

export function pct(value: number | null | undefined, digits = 0) {
  return value === null || value === undefined ? "—" : `${value.toFixed(digits)}%`;
}

export function ago(iso: string | null | undefined, now: number | null) {
  if (!iso) return "never";
  if (now === null) return "…";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.round(s / 60)} min ago`;
  if (s < 86400) return `${Math.round(s / 3600)} h ago`;
  return `${Math.round(s / 86400)} d ago`;
}

export function duration(a: string, b: string) {
  const m = Math.max(0, Math.round((Date.parse(b) - Date.parse(a)) / 60000));
  return m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${Math.floor(m / 1440)} d ${Math.floor((m % 1440) / 60)} h`;
}

/** Local time only exists in the browser; before mount print UTC so server and client HTML match. */
export function when(iso: string, mounted: boolean, withDay = true) {
  if (!mounted) return `${iso.slice(0, 16).replace("T", " ")} UTC`;
  return new Date(iso).toLocaleString("en-GB", {
    ...(withDay ? { weekday: "short" } : {}), day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export const REASON: Record<string, string> = { target: "Hit target", stop: "Hit stop", closed: "Time / manual" };
