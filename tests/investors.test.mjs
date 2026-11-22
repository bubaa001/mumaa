// node --test tests/   (Node 22.6+ runs the .ts import directly)
import test from "node:test";
import assert from "node:assert/strict";
import { buildLedger } from "../src/lib/investors.ts";

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-6, `${msg}: ${a} != ${b}`);
const inv = [
  { id: 1, name: "Joshua", is_founder: true, created_at: "2026-11-21T00:00:00Z" },
  { id: 2, name: "Brother", is_founder: false, created_at: "2026-11-21T00:00:00Z" },
];
const seed = { id: 1, deal_id: null, at: "2026-11-21T10:00:00Z", amount: 800, nav_before: 0, kind: "seed", status: "assigned", investor_id: 1, comment: null };
const dep = (id, at, amount, nav, status = "assigned", investor_id = 2) =>
  ({ id, deal_id: 100 + id, at, amount, nav_before: nav, kind: amount > 0 ? "deposit" : "withdrawal", status, investor_id, comment: null });
const mark = (month, at, equity) => ({ month, at, equity });
const startMark = mark("2026-11-01", "2026-11-21T10:00:00Z", 800);
const view = (l, id) => l.investors.find((x) => x.id === id);
const sum = (l) => l.investors.reduce((s, x) => s + x.value, 0);

test("not started without a seed", () => {
  const l = buildLedger({ investors: [], flows: [], marks: [], equity: 825, currency: "USC", updated_at: null });
  assert.equal(l.started, false);
});

test("a deposit buys units at the price before it, so it is not profit", () => {
  // account grew 800 -> 880 (+10%) before the brother put in 1000
  const flows = [seed, dep(2, "2026-11-25T10:00:00Z", 1000, 880)];
  const l = buildLedger({ investors: inv, flows, marks: [startMark], equity: 1880, currency: "USC", updated_at: null });
  close(l.price, 1.1, "price");
  close(view(l, 2).units, 1000 / 1.1, "brother units");
  close(view(l, 2).value, 1000, "brother value right after depositing");
  close(view(l, 2).profit, 0, "brother profit");
  close(view(l, 1).value, 880, "founder keeps the gain made before");
  close(sum(l), 1880, "values add up to equity");
});

test("20% fee on new profit at month start, paid to the founder", () => {
  const flows = [seed, dep(2, "2026-11-25T10:00:00Z", 1000, 880)];
  const units = 800 + 1000 / 1.1;
  const eq = 1.21 * units;                                   // +10% more by 1 December
  const marks = [startMark, mark("2026-12-01", "2026-12-01T00:00:30Z", eq)];
  const l = buildLedger({ investors: inv, flows, marks, equity: eq, currency: "USC", updated_at: null });
  const b = view(l, 2), f = view(l, 1);
  close(b.feesPaid, 20, "fee = 20% of the 100 profit");
  close(b.value, 1080, "brother after fee");
  close(b.basis, 1080, "high-water mark moves up");
  close(f.feesEarned, 20, "founder earned");
  close(f.value, 800 * 1.21 + 20, "founder value");
  close(sum(l), eq, "values add up to equity");
  close(b.feeDueNow, 0, "nothing more due at the same price");
});

test("high-water mark: no fee after a loss until the previous best is beaten", () => {
  const flows = [seed, dep(2, "2026-11-25T10:00:00Z", 1000, 880)];
  const units = 800 + 1000 / 1.1;
  const m1 = 1.21 * units;
  // Jan 1: price falls 10% -> no fee. Feb 1: back to exactly the Dec price -> still no fee.
  const unitsAfterFee = units;                                // fees move units, total unchanged
  const marks = [startMark, mark("2026-12-01", "2026-12-01T00:00:30Z", m1),
    mark("2027-01-01", "2027-01-01T00:00:30Z", 1.089 * unitsAfterFee),
    mark("2027-02-01", "2027-02-01T00:00:30Z", 1.21 * unitsAfterFee)];
  const l = buildLedger({ investors: inv, flows, marks, equity: 1.331 * unitsAfterFee, currency: "USC", updated_at: null });
  const b = view(l, 2);
  close(b.feesPaid, 20, "only December's fee was charged");
  // today +10% above the high-water mark: fee due now = 20% of (1080*1.1 - 1080)
  close(b.feeDueNow, 0.2 * (1080 * 1.1 - 1080), "fee accruing this month");
});

test("withdrawal sells units at the price before it and scales the high-water mark", () => {
  const flows = [seed, dep(2, "2026-11-25T10:00:00Z", 1000, 800), dep(3, "2026-11-28T10:00:00Z", -500, 1800)];
  // price before withdrawal = 1800 / 1800 units = 1.0 -> sells 500 units, half of the brother's 1000
  const l = buildLedger({ investors: inv, flows, marks: [startMark], equity: 1300, currency: "USC", updated_at: null });
  const b = view(l, 2);
  close(b.units, 500, "units left");
  close(b.basis, 500, "basis halved");
  close(b.withdrawn, 500, "withdrawn");
  close(sum(l), 1300, "values add up to equity");
});

test("unassigned money is listed; ignored money (bonus) counts as profit for everyone", () => {
  const flows = [seed, dep(2, "2026-11-25T10:00:00Z", 1000, 800, "unassigned", null),
    { ...dep(3, "2026-11-26T10:00:00Z", 80, 800, "ignored", null) }];
  const l = buildLedger({ investors: inv, flows, marks: [startMark], equity: 880, currency: "USC", updated_at: null });
  assert.equal(l.unassigned.length, 1);
  close(view(l, 1).value, 880, "bonus goes to the owners");
});

test("money moved before tracking started is ignored", () => {
  const flows = [dep(9, "2026-11-01T10:00:00Z", 300, 500), seed];
  const l = buildLedger({ investors: inv, flows, marks: [startMark], equity: 800, currency: "USC", updated_at: null });
  assert.equal(l.unassigned.length, 0);
  close(view(l, 1).value, 800, "founder owns all");
});

test("split deposit: each person buys units at the same price, values add up", () => {
  const flows = [seed, { ...dep(2, "2026-11-25T10:00:00Z", 1500, 880), status: "split", investor_id: null }];
  const inv3 = [...inv, { id: 3, name: "Brother 2", is_founder: false, created_at: "2026-11-21T00:00:00Z" }];
  const parts = [{ flow_id: 2, investor_id: 2, amount: 1000 }, { flow_id: 2, investor_id: 3, amount: 500 }];
  const l = buildLedger({ investors: inv3, flows, parts, marks: [startMark], equity: 2380, currency: "USC", updated_at: null });
  close(view(l, 2).value, 1000, "brother 1");
  close(view(l, 3).value, 500, "brother 2");
  close(view(l, 1).value, 880, "founder");
  close(sum(l), 2380, "values add up to equity");
  assert.equal(view(l, 3).events[0].flow, 2);
  assert.equal(view(l, 3).events[0].split, true);
});

test("a split with no parts yet is skipped, not counted for anyone", () => {
  const flows = [seed, { ...dep(2, "2026-11-25T10:00:00Z", 1500, 800), status: "split", investor_id: null }];
  const l = buildLedger({ investors: inv, flows, marks: [startMark], equity: 2300, currency: "USC", updated_at: null });
  close(view(l, 1).value, 2300, "unowned money sits with the owners");
});
