"use client";

import { useCallback, useEffect, useState } from "react";
import { FOUNDER_FEE, type Ledger, type InvestorView } from "@/lib/investors";
import { money, signed, when } from "@/lib/trader-view";

type Resp = { ok: true; ledger: Ledger } | { ok: false; error: string };

const pctText = (v: number | null, digits = 1) =>
  v === null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(digits)}%`;
const tone = (v: number) => (v > 0.0049 ? "pos" : v < -0.0049 ? "neg" : "");

/** Founder-only: who owns what in the shared account, new deposits to assign, and the monthly fee. */
export function InvestorsView({ mounted }: { mounted: boolean }) {
  const [resp, setResp] = useState<Resp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/investors", { cache: "no-store" });
      setResp((await res.json()) as Resp);
    } catch { setErr("Could not reach the server."); }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(() => { if (document.visibilityState === "visible") load(); }, 30_000);
    return () => clearInterval(t);
  }, [load]);

  const act = useCallback(async (body: Record<string, unknown>) => {
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/investors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const r = (await res.json()) as Resp & { error?: string };
      if (r.ok) setResp(r); else setErr(r.error ?? "That did not work.");
    } catch { setErr("Could not reach the server."); }
    setBusy(false);
  }, []);

  if (!resp) return <section className="trade-card"><p className="trade-muted">Loading investors…</p></section>;
  if (!resp.ok) {
    return (
      <section className="notice trade-notice">
        <strong>Investor tracking is not available yet.</strong>
        <p>{resp.error}</p>
      </section>
    );
  }
  const l = resp.ledger;
  const ccy = l.currency;

  if (!l.started) {
    return (
      <section className="trade-card" aria-labelledby="inv-start">
        <h2 className="trade-h" id="inv-start">Start investor tracking</h2>
        <p>The account holds <b>{money(l.equity, ccy)}</b> right now. Starting makes that your founder stake:
          the account is split into units at 1 unit = 1 {ccy || "unit"}, and from then on every deposit or
          withdrawal is picked up from MT5 automatically for you to say whose money it is.</p>
        <p className="trade-muted">Your fee: {FOUNDER_FEE * 100}% of each investor’s new profit, taken on the 1st of every month,
          only above their previous best (high-water mark). You pay no fee on your own stake.</p>
        {err && <p className="trade-block">{err}</p>}
        <button type="button" className="btn btn-primary" disabled={busy || !(l.equity > 0)} onClick={() => act({ action: "start", name: "Joshua" })}>
          {busy ? "Starting…" : "Start tracking"}
        </button>
      </section>
    );
  }

  const founder = l.investors.find((i) => i.founder);
  const others = l.investors.filter((i) => !i.founder);
  const feesEarned = founder?.feesEarned ?? 0;
  const feeAccruing = others.reduce((s, i) => s + i.feeDueNow, 0);

  return (
    <div className="inv">
      {l.unassigned.length > 0 && (
        <Unassigned l={l} busy={busy} onAssign={(flow, investor, ignore) => act({ action: "assign", flow, investor, ignore })} mounted={mounted} />
      )}
      {err && <p className="trade-block">{err}</p>}

      <section className="trade-card" aria-labelledby="inv-sum">
        <h2 className="trade-h" id="inv-sum">The pool</h2>
        <dl className="rules">
          <div><dt>Account value</dt><dd>{money(l.equity, ccy)}</dd></div>
          <div><dt>Unit price</dt><dd>{l.price.toFixed(4)} <span className={tone(l.price - 1)}>({pctText(l.priceChange)} since start)</span></dd></div>
          <div><dt>Your stake</dt><dd>{money(founder?.value, ccy)} · {((founder?.share ?? 0) * 100).toFixed(1)}% of the account</dd></div>
          <div><dt>Your fees earned</dt><dd className={tone(feesEarned)}>{money(feesEarned, ccy)}</dd></div>
          <div><dt>Fee building up this month</dt><dd>{money(feeAccruing, ccy)} <span className="trade-muted">(taken on the 1st)</span></dd></div>
          <div><dt>Tracking since</dt><dd>{l.startedAt ? when(l.startedAt, mounted) : "—"}</dd></div>
        </dl>
        {l.missingNav.length > 0 && <p className="trade-block">{l.missingNav.length} deposit(s) had no account reading at that moment and are not counted yet.</p>}
      </section>

      <section className="trade-card" aria-labelledby="inv-list">
        <div className="trade-card-top">
          <h2 className="trade-h" id="inv-list">Investors</h2>
          <AddInvestor busy={busy} onAdd={(name) => act({ action: "add", name })} />
        </div>
        <ul className="inv-list">{l.investors.map((i) => <Row key={i.id} i={i} ccy={ccy} />)}</ul>
        <p className="trade-muted">Profit is after fees. “Fees” is what an investor has paid you, or for you what you have earned.
          Fee: {FOUNDER_FEE * 100}% of new profit above each investor’s previous best, settled on the 1st of each month.</p>
      </section>

      <section className="trade-card" aria-labelledby="inv-hist">
        <h2 className="trade-h" id="inv-hist">History</h2>
        <History l={l} ccy={ccy} mounted={mounted} />
      </section>
    </div>
  );
}

const HUES = [18, 42, 152, 200, 262, 320, 6, 96];
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
const hueOf = (name: string) => HUES[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % HUES.length];

/** One investor, ticker style: who, what they put in · what it is worth now, up or down since joining. */
function Row({ i, ccy }: { i: InvestorView; ccy: string }) {
  const pct = i.profitPct ?? 0;
  const dir = pct > 0.00005 ? "up" : pct < -0.00005 ? "down" : "flat";
  const net = i.deposited - i.withdrawn;
  return (
    <li className="inv-row">
      <span className="inv-avatar" style={{ ["--h" as string]: hueOf(i.name) }} aria-hidden="true">
        {initials(i.name)}
        {i.founder && <span className="inv-badge" title="Founder">✓</span>}
      </span>
      <span className="inv-who">
        <span className="inv-name">{i.name}{i.founder && <span className="inv-tag">founder</span>}</span>
        <span className="inv-sub">put in {money(net, ccy)} · {(i.share * 100).toFixed(1)}% of pool
          {i.founder ? (i.feesEarned ? ` · fees +${money(i.feesEarned)}` : "") : (i.feesPaid ? ` · fees ${money(i.feesPaid)}` : "")}</span>
      </span>
      <span className="inv-now">
        <span className="inv-value">{money(i.value)} <small>{ccy}</small></span>
        <span className={`inv-change inv-${dir}`}>
          {dir === "up" ? "▲" : dir === "down" ? "▼" : "•"} {Math.abs(pct * 100).toFixed(2)}%
          <span className="inv-abs"> ({signed(i.profit)})</span>
        </span>
      </span>
    </li>
  );
}

function AddInvestor({ busy, onAdd }: { busy: boolean; onAdd: (name: string) => void }) {
  const [name, setName] = useState("");
  return (
    <form className="inv-add" onSubmit={(e) => { e.preventDefault(); if (name.trim()) { onAdd(name.trim()); setName(""); } }}>
      <input className="field-input" value={name} maxLength={60} placeholder="New investor’s name" aria-label="New investor’s name"
        onChange={(e) => setName(e.target.value)} />
      <button type="submit" className="btn btn-ghost" disabled={busy || !name.trim()}>Add</button>
    </form>
  );
}

function Unassigned({ l, busy, onAssign, mounted }: {
  l: Ledger; busy: boolean; mounted: boolean; onAssign: (flow: number, investor: number | null, ignore: boolean) => void;
}) {
  const f = l.unassigned[0];
  const [pick, setPick] = useState<string>("");
  const others = l.investors;
  const dep = f.amount > 0;
  return (
    <section className="trade-card inv-alert" aria-labelledby="inv-new">
      <h2 className="trade-h" id="inv-new">{dep ? "New deposit" : "New withdrawal"}: whose money?</h2>
      <p><b className={dep ? "pos" : "neg"}>{signed(f.amount)} {l.currency}</b> on {when(f.at, mounted)}
        {l.unassigned.length > 1 && <span className="trade-muted"> · {l.unassigned.length - 1} more after this one</span>}</p>
      <p className="trade-muted">Until it is assigned, the numbers below treat it as nobody’s, so they are slightly off.</p>
      <div className="inv-add">
        <select className="field-input" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Investor">
          <option value="">Choose…</option>
          {others.map((i) => <option key={i.id} value={i.id}>{i.name}{i.founder ? " (you)" : ""}</option>)}
          <option value="ignore">Not investor money (bonus / profit)</option>
        </select>
        <button type="button" className="btn btn-primary" disabled={busy || !pick}
          onClick={() => onAssign(f.id, pick === "ignore" ? null : Number(pick), pick === "ignore")}>Assign</button>
      </div>
      {others.length < 2 && <p className="trade-muted">Add the investor first (Investors, below), then choose them here.</p>}
    </section>
  );
}

function History({ l, ccy, mounted }: { l: Ledger; ccy: string; mounted: boolean }) {
  const names = new Map(l.investors.map((i) => [i.id, i.name]));
  const LABEL = { start: "Founder stake", deposit: "Deposit", withdrawal: "Withdrawal", fee_paid: "Fee paid", fee_earned: "Fee earned" } as const;
  const rows = l.investors.flatMap((i) => i.events).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 60);
  if (!rows.length) return <p className="trade-muted">Nothing yet.</p>;
  return (
    <div className="trade-table-wrap">
      <table className="trade-table">
        <thead><tr><th>When</th><th>Who</th><th>What</th><th>Amount</th><th>Unit price</th></tr></thead>
        <tbody>{rows.map((e, k) => (
          <tr key={k}>
            <td>{when(e.at, mounted)}</td><td>{names.get(e.investor)}</td><td>{LABEL[e.kind]}</td>
            <td className={tone(e.amount)}>{signed(e.amount)} {ccy}</td><td>{e.price.toFixed(4)}</td>
          </tr>
        ))}</tbody>
      </table>
    </div>
  );
}
