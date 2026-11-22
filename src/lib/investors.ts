/**
 * Investor ledger for one shared trading account. Pure: replays the raw rows from Supabase
 * (investors, deposits/withdrawals, month-start equity marks) into who owns what.
 *
 * Units: tracking starts with the founder owning the whole account at 1 unit = 1 USC. A deposit buys
 * units at the price just before the money arrived (equity / units), a withdrawal sells them, so new
 * money is never mistaken for trading profit and late joiners don't share in earlier gains.
 *
 * Founder fee: FOUNDER_FEE of each investor's NEW profit, taken on the first of each month at that
 * day's price, paid to the founder as units. "New" means above the investor's high-water mark
 * (`basis`): what they put in plus profit already charged. After a loss nothing is charged until
 * they are back above their previous best. The founder pays no fee.
 */

export const FOUNDER_FEE = 0.2;

export type InvestorRow = { id: number; name: string; is_founder: boolean; created_at: string };
export type FlowRow = {
  id: number; deal_id: number | null; at: string; amount: number; nav_before: number | null;
  kind: "seed" | "deposit" | "withdrawal"; status: "unassigned" | "assigned" | "ignored" | "split";
  investor_id: number | null; comment: string | null;
};
/** One person's share of a split deposit/withdrawal (same sign as the flow). */
export type PartRow = { flow_id: number; investor_id: number; amount: number };
export type MarkRow = { month: string; equity: number; at: string };
export type InvestorPull = {
  investors: InvestorRow[]; flows: FlowRow[]; marks: MarkRow[]; parts?: PartRow[];
  equity: number | null; currency: string | null; updated_at: string | null;
};

export type LedgerEvent = {
  at: string; investor: number; kind: "start" | "deposit" | "withdrawal" | "fee_paid" | "fee_earned";
  amount: number; units: number; price: number;
  flow?: number;          // the deposit/withdrawal row this came from (to undo it)
  split?: boolean;        // part of a deposit shared between several people
};
export type InvestorView = {
  id: number; name: string; founder: boolean;
  units: number; value: number; share: number;          // share of the account, 0..1
  deposited: number; withdrawn: number; profit: number; profitPct: number | null;
  feesPaid: number; feesEarned: number;
  basis: number; feeDueNow: number;                     // fee if the month were settled at today's price
  events: LedgerEvent[];
};
export type Ledger = {
  started: boolean; startedAt: string | null; currency: string;
  equity: number; units: number; price: number; priceChange: number | null;
  investors: InvestorView[];
  unassigned: FlowRow[];        // oldest first; must be assigned for the numbers to be right
  missingNav: FlowRow[];        // assigned flows with no equity reading (should not happen)
  ignored: FlowRow[];           // marked "not investor money" (newest first), so they can be undone
};

type Acc = { units: number; basis: number; deposited: number; withdrawn: number; feesPaid: number; feesEarned: number; events: LedgerEvent[] };

const EPS = 1e-9;

export function buildLedger(p: InvestorPull, fee = FOUNDER_FEE): Ledger {
  const currency = p.currency ?? "";
  const seed = p.flows.find((f) => f.kind === "seed") ?? null;
  const founder = p.investors.find((i) => i.is_founder) ?? null;
  const equity = p.equity ?? 0;
  if (!seed || !founder) {
    return { started: false, startedAt: null, currency, equity, units: 0, price: 1, priceChange: null,
      investors: [], unassigned: [], missingNav: [], ignored: [] };
  }

  const acc = new Map<number, Acc>();
  const get = (id: number) => {
    let a = acc.get(id);
    if (!a) acc.set(id, (a = { units: 0, basis: 0, deposited: 0, withdrawn: 0, feesPaid: 0, feesEarned: 0, events: [] }));
    return a;
  };
  for (const i of p.investors) get(i.id);
  let total = 0;
  const unassigned: FlowRow[] = [];
  const missingNav: FlowRow[] = [];

  // Founder stake at the start: 1 unit per USC.
  const f0 = get(founder.id);
  f0.units = seed.amount; f0.basis = seed.amount; f0.deposited = seed.amount; total = seed.amount;
  f0.events.push({ at: seed.at, investor: founder.id, kind: "start", amount: seed.amount, units: seed.amount, price: 1 });

  const seedT = Date.parse(seed.at);
  type Ev = { t: number; order: number; flow?: FlowRow; mark?: MarkRow };
  const evs: Ev[] = [];
  for (const f of p.flows) {
    if (f.kind === "seed" || Date.parse(f.at) <= seedT) continue;
    if (f.status === "unassigned") unassigned.push(f);
    evs.push({ t: Date.parse(f.at), order: 1, flow: f });
  }
  // A month mark settles the PREVIOUS month; the mark taken when tracking started settles nothing.
  for (const m of p.marks) {
    const t = Date.parse(m.at);
    if (t > seedT + 60_000) evs.push({ t, order: 0, mark: m });
  }
  evs.sort((a, b) => a.t - b.t || a.order - b.order);

  const settle = (price: number, at: string, apply: boolean) => {
    const due = new Map<number, number>();
    for (const i of p.investors) {
      if (i.is_founder) continue;
      const a = get(i.id);
      const value = a.units * price;
      if (a.units <= EPS || value <= a.basis + EPS) { due.set(i.id, 0); continue; }
      const charge = fee * (value - a.basis);
      due.set(i.id, charge);
      if (!apply) continue;
      const u = charge / price;
      a.units -= u; a.basis = value - charge; a.feesPaid += charge;
      f0.units += u; f0.feesEarned += charge;
      a.events.push({ at, investor: i.id, kind: "fee_paid", amount: -charge, units: -u, price });
      f0.events.push({ at, investor: founder.id, kind: "fee_earned", amount: charge, units: u, price });
    }
    return due;
  };

  const partsOf = new Map<number, PartRow[]>();
  for (const pt of p.parts ?? []) partsOf.set(pt.flow_id, [...(partsOf.get(pt.flow_id) ?? []), pt]);

  // One person's money in or out, at the price just before the flow arrived.
  const move = (f: FlowRow, investor: number, amount: number, price: number, split: boolean) => {
    const a = get(investor);
    if (amount > 0) {
      const u = amount / price;
      a.units += u; a.basis += amount; a.deposited += amount; total += u;
      a.events.push({ at: f.at, investor, kind: "deposit", amount, units: u, price, flow: f.id, split });
    } else {
      const want = -amount / price;
      const u = Math.min(want, a.units);       // can't sell more than they own
      const frac = a.units > EPS ? u / a.units : 0;
      a.units -= u; a.basis *= 1 - frac; a.withdrawn += -amount; total -= u;
      a.events.push({ at: f.at, investor, kind: "withdrawal", amount, units: -u, price, flow: f.id, split });
    }
  };

  for (const e of evs) {
    if (e.mark) {
      if (total > EPS) settle(e.mark.equity / total, e.mark.at, true);
      continue;
    }
    const f = e.flow!;
    const parts = f.status === "split" ? partsOf.get(f.id) ?? [] : [];
    if (f.status === "split" ? !parts.length : f.status !== "assigned" || f.investor_id === null) continue;   // ignored: stays in equity as profit
    if (f.nav_before === null || !(f.nav_before > 0) || total <= EPS) { missingNav.push(f); continue; }
    const price = f.nav_before / total;       // one price for every part of a split
    if (f.status === "split") for (const pt of parts) move(f, pt.investor_id, pt.amount, price, true);
    else move(f, f.investor_id!, f.amount, price, false);
  }

  // Units are moved by fees, never created, so the founder's units include fees earned.
  total = [...acc.values()].reduce((s, a) => s + a.units, 0);
  const price = total > EPS ? equity / total : 1;
  const dueNow = settle(price, new Date().toISOString(), false);
  const investors: InvestorView[] = p.investors.map((i) => {
    const a = get(i.id);
    const value = a.units * price;
    const net = a.deposited - a.withdrawn;
    const profit = value - net;
    return {
      id: i.id, name: i.name, founder: i.is_founder, units: a.units, value,
      share: total > EPS ? a.units / total : 0,
      deposited: a.deposited, withdrawn: a.withdrawn, profit,
      profitPct: a.deposited > EPS ? profit / a.deposited : null,
      feesPaid: a.feesPaid, feesEarned: a.feesEarned, basis: a.basis,
      feeDueNow: dueNow.get(i.id) ?? 0, events: a.events,
    };
  }).sort((x, y) => Number(y.founder) - Number(x.founder) || y.value - x.value);

  return { started: true, startedAt: seed.at, currency, equity, units: total, price,
    priceChange: price - 1, investors, unassigned, missingNav,
    ignored: p.flows.filter((f) => f.status === "ignored" && f.kind !== "seed" && Date.parse(f.at) > seedT).reverse() };
}
