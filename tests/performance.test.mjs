import test from "node:test";
import assert from "node:assert/strict";
import { buildRecord, timeWeighted, maxDrawdown } from "../src/lib/performance.ts";

const close = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-9, `${msg}: ${a} != ${b}`);
const pt = (t, e) => ({ t, e });

test("deposits are not profit: time-weighted growth ignores money moved in", () => {
  // 800 -> 880 (+10%), then +1000 deposit, then 1880 -> 2068 (+10%)
  const s = timeWeighted([pt("2026-11-21T00:00:00Z", 800), pt("2026-11-22T00:00:00Z", 880),
    pt("2026-11-23T00:00:00Z", 1880), pt("2026-11-24T00:00:00Z", 2068)], [{ t: "2026-11-22T12:00:00Z", amount: 1000 }]);
  close(s.at(-1).growth, 0.21, "1.1 x 1.1 - 1");
  close(s[2].growth, 0.1, "the deposit itself adds nothing");
});

test("withdrawals are not losses", () => {
  const s = timeWeighted([pt("2026-11-21T00:00:00Z", 1000), pt("2026-11-22T00:00:00Z", 500)], [{ t: "2026-11-21T12:00:00Z", amount: -500 }]);
  close(s.at(-1).growth, 0, "flat");
});

test("max drawdown from the running high", () => {
  close(maxDrawdown([{ t: "a", growth: 0 }, { t: "b", growth: 0.2 }, { t: "c", growth: -0.04 }, { t: "d", growth: 0.3 }]), 0.96 / 1.2 - 1, "dd");
});

test("record: only trades and flows after the start, no money amounts out", () => {
  const raw = {
    start: "2026-11-21T00:00:00Z", updated_at: "2026-11-22T00:00:00Z", currency: "USC", equity: 840,
    daily: [pt("2026-11-20T00:00:00Z", 5000), pt("2026-11-21T00:00:00Z", 800)], recent: [],
    flows: [{ t: "2026-11-20T10:00:00Z", amount: 700 }],
    trades: [
      { bot: "forex", symbol: "EURUSDc", side: "BUY", profit: 30, r: 0.3, opened: null, closed: "2026-11-21T10:00:00Z" },
      { bot: "forex", symbol: "EURUSDc", side: "SELL", profit: -10, r: -1, opened: null, closed: "2026-11-21T11:00:00Z" },
      { bot: "gold", symbol: "XAUUSDc", side: "BUY", profit: 20, r: 0.25, opened: null, closed: "2026-11-21T12:00:00Z" },
      { bot: "gold", symbol: "XAUUSDc", side: "BUY", profit: 99, r: 1, opened: null, closed: "2026-11-19T12:00:00Z" },
    ],
  };
  const r = buildRecord(raw, Date.parse("2026-11-23T00:00:00Z"));
  close(r.growth, 0.05, "800 -> 840");
  assert.equal(r.trades, 3);
  close(r.winRate, 2 / 3, "win rate");
  close(r.profitFactor, 5, "50 / 10");
  assert.equal(r.recent[0].symbol, "EURUSD");
  assert.equal(r.early, true);
  assert.ok(!JSON.stringify(r).includes("840") && !JSON.stringify(r).includes('"profit"') && !JSON.stringify(r).includes('"e"'), "no amounts in the public record");
});
