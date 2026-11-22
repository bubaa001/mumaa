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

export type DeskView = "overview" | "agents" | "trades" | "rules" | "investors";
export type DeskNav = { view: DeskView; agent: string | null; market: string | null };
export const VIEWS: { id: DeskView; label: string; short?: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "agents", label: "Agents" },
  { id: "trades", label: "Trades" },
  { id: "rules", label: "News & rules", short: "News" },
  { id: "investors", label: "Investors" },   // founder only (see TradingDashboard)
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
  /** Backtest confidence across this agent's markets; a range when they differ. Null when unrated. */
  confidence: { grade: Grade; label: string } | null;
  /** How close its nearest market is to opening a trade. */
  ready: Readiness;
};

/**
 * How close a market is to a trade: how many of its entry conditions hold right now and, when its
 * trading session is closed, how long until it opens. `score` orders the desk: in a trade, then a live
 * signal, then markets in an open session by conditions met, then closed sessions soonest first,
 * then news pauses, then stopped bots.
 */
export type Readiness = { met: number; total: number; opensIn: number | null; score: number };

const RANK: Record<AgentState, number> = { in_trade: 40, signal: 30, watching: 10, paused: 5, stopped: 0 };
const WEEK = 7 * 86_400_000;

export function readinessOf(m: TraderMarket, now: number | null): Readiness {
  const total = m.checks.length;
  const met = m.checks.filter((c) => c.ok).length;
  let opensIn: number | null = null;
  if (now !== null) {
    for (const c of m.checks) {
      if (c.ok) continue;
      const s = sessionOf(c.label);
      if (!s) continue;
      const at = sessionAt(s, now);
      if (!at.open && Number.isFinite(at.next)) opensIn = Math.min(opensIn ?? Infinity, at.next - now);
    }
  }
  // A closed session sits below every open one (-1), and further down the longer the wait.
  const wait = opensIn === null ? 0 : 1 + Math.min(opensIn, WEEK) / WEEK;
  return { met, total, opensIn, score: RANK[m.verdict] + (total ? met / total : 0) - wait };
}

const NO_MARKETS: Readiness = { met: 0, total: 0, opensIn: null, score: -1 };

type Grade = "High" | "Medium" | "Low";
const GRADES: Grade[] = ["Low", "Medium", "High"];

function confidenceOf(ms: TraderMarket[]): Agent["confidence"] {
  const ranks = ms.map((m) => m.record?.confidence).filter((g): g is Grade => !!g).map((g) => GRADES.indexOf(g));
  if (!ranks.length) return null;
  const lo = Math.min(...ranks), hi = Math.max(...ranks);
  const avg = Math.round(ranks.reduce((a, b) => a + b, 0) / ranks.length);
  return { grade: GRADES[avg], label: lo === hi ? GRADES[lo] : `${GRADES[lo]}–${GRADES[hi]}` };
}

/** Every bot the reporter knows about, from its process list or its markets, with its rolled-up state. */
export function agentsFrom(s: TraderState, now: number | null = null): Agent[] {
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
    const sorted = sortMarkets(mine, now);
    const pairs = sorted.length ? sorted.map((m) => m.pair) : Object.keys(bot?.markets ?? {});
    let ready = sorted.length ? readinessOf(sorted[0], now) : NO_MARKETS;
    if (state === "stopped") ready = { ...ready, score: ready.score - 100 };
    else if (state === "in_trade") ready = { ...ready, score: Math.max(ready.score, RANK.in_trade + 1) };
    return {
      id, name: botName(id), bot, running, state, markets: sorted, pairs, ready,
      strategies: Array.from(new Set(mine.map((m) => m.name).filter(Boolean))),
      positions, openPnl: positions.reduce((sum, p) => sum + p.profit, 0),
      trades, record: tally(trades), confidence: confidenceOf(mine),
    };
  });
  return agents.sort((a, b) => b.ready.score - a.ready.score || a.name.localeCompare(b.name));
}

function sortMarkets(ms: TraderMarket[], now: number | null) {
  const score = new Map(ms.map((m) => [m, readinessOf(m, now).score]));
  return [...ms].sort((a, b) => score.get(b)! - score.get(a)!);
}

/** "4 of 5 conditions · session opens in 6 h 10 min", for lists. */
export function readyText(r: Readiness, state: AgentState) {
  if (state === "in_trade") return "In a trade now";
  if (state === "signal") return "Setup complete · entering";
  if (state === "stopped") return "Bot not running";
  if (!r.total) return "Waiting for data";
  const met = `${r.met} of ${r.total} conditions`;
  if (state === "paused") return `${met} · paused`;
  return r.opensIn !== null ? `${met} · session opens in ${countdown(r.opensIn)}` : `${met} met`;
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

/* ─── Trading sessions ───────────────────────────────────────── */

export type Session = {
  key: string;
  name: string;
  /** Minutes after midnight in `tz`. */
  start: number;
  end: number;
  tz: "UTC" | "America/New_York";
  source: string;
  agents: string[];
};

const WINDOW = /\((\d{1,2})(?::(\d\d))?\s*[–-]\s*(\d{1,2})(?::(\d\d))?\s*(UTC|NY)\)/i;

/**
 * The time windows the bots trade in, read from their own checklists
 * ("Asian session (00–06 UTC)", "Inside the trade window (9:45-11:45 NY)"), so new bots appear here on their own.
 */
export function sessionsFrom(agents: Agent[]): Session[] {
  const found = new Map<string, Session>();
  for (const a of agents) {
    for (const m of a.markets) {
      for (const c of m.checks) {
        const parsed = sessionOf(c.label);
        if (!parsed) continue;
        const s = found.get(parsed.key) ?? parsed;
        if (!s.agents.includes(a.name)) s.agents.push(a.name);
        found.set(parsed.key, s);
      }
    }
  }
  return [...found.values()];
}

/** A session window from a checklist label like "Asian session (21–06 UTC)", or null. */
export function sessionOf(label: string): Session | null {
  if (!/session|window/i.test(label)) return null;
  const x = label.match(WINDOW);
  if (!x) return null;
  const start = Number(x[1]) * 60 + Number(x[2] ?? 0);
  const end = Number(x[3]) * 60 + Number(x[4] ?? 0);
  const tz = x[5].toUpperCase() === "NY" ? "America/New_York" : "UTC";
  const raw = label.slice(0, label.indexOf("(")).replace(/^inside the\s+/i, "").trim();
  let named = raw.charAt(0).toUpperCase() + raw.slice(1);
  if (tz === "UTC" && /^session$/i.test(named)) {
    // a bare "Session (…)": name it after the market that is open when it starts
    const h = Math.floor(start / 60);
    named = h >= 21 || h < 6 ? "Asian session" : h < 12 ? "London session" : "London–New York session";
  }
  const name = tz === "UTC" || /new york|ny/i.test(named) ? named : `New York ${raw}`;
  return { key: `${tz}-${start}-${end}`, name, start, end, tz, source: x[0].slice(1, -1), agents: [] };
}

function tzOffset(t: number, tz: string) {
  if (tz === "UTC") return 0;
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(t).map((x) => [x.type, x.value]));
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - Math.floor(t / 1000) * 1000;
}

/** The instant a wall-clock minute happens in `tz` on the calendar day of `t` (shifted by `days`). */
function zoned(t: number, tz: string, days: number, minutes: number) {
  const local = new Date(t + tzOffset(t, tz));
  const guess = Date.UTC(local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate() + days, 0, minutes);
  const first = guess - tzOffset(guess, tz);
  return guess - tzOffset(first, tz);
}

export type SessionNow = { open: boolean; start: number; end: number; next: number; progress: number };

/** Whether a session is open at `now`, and when it next starts or ends (epoch ms). */
export function sessionAt(s: Session, now: number): SessionNow {
  const length = ((s.end - s.start + 1440) % 1440 || 1440) * 60_000;
  let upcoming = Infinity;
  for (let d = -1; d <= 8; d++) {
    const start = zoned(now, s.tz, d, s.start);
    if (weekend(start)) continue;
    const end = start + length;
    if (start <= now && now < end) return { open: true, start, end, next: end, progress: (now - start) / length };
    if (start > now && start < upcoming) upcoming = start;
  }
  return { open: false, start: upcoming, end: upcoming + length, next: upcoming, progress: 0 };
}

/** Forex and gold close from Friday 21:00 to Sunday 21:00 UTC; a window starting then never trades. */
function weekend(t: number) {
  const d = new Date(t), day = d.getUTCDay(), h = d.getUTCHours();
  return day === 6 || (day === 5 && h >= 21) || (day === 0 && h < 21);
}

export function countdown(ms: number) {
  const m = Math.max(0, Math.round(ms / 60_000));
  const h = Math.floor(m / 60);
  if (h >= 24) return `${Math.floor(h / 24)} d ${h % 24} h`;
  return h ? `${h} h ${String(m % 60).padStart(2, "0")} min` : `${m} min`;
}
