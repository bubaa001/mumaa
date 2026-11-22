"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, Copy, MessageCircle, Plus, Trash2, Undo2, X } from "lucide-react";
import { FOUNDER_FEE, type Ledger, type InvestorView, type FlowRow } from "@/lib/investors";
import { money, signed, when } from "@/lib/trader-view";
import { Sheet } from "./sheet";

type Resp = { ok: true; ledger: Ledger } | { ok: false; error: string };
type Act = (body: Record<string, unknown>) => Promise<boolean>;

const pctText = (v: number | null, digits = 1) =>
  v === null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(digits)}%`;
const tone = (v: number) => (v > 0.0049 ? "pos" : v < -0.0049 ? "neg" : "");
const LABEL = { start: "Founder stake", deposit: "Deposit", withdrawal: "Withdrawal", fee_paid: "Fee paid", fee_earned: "Fee earned" } as const;

/** Founder-only: who owns what in the shared account, new deposits to assign, and the monthly fee. */
export function InvestorsView({ mounted }: { mounted: boolean }) {
  const [resp, setResp] = useState<Resp | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<number | null>(null);

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

  const act: Act = useCallback(async (body) => {
    setBusy(true); setErr(null);
    let ok = false;
    try {
      const res = await fetch("/api/investors", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const r = (await res.json()) as Resp & { error?: string };
      if (r.ok) { setResp(r); ok = true; } else setErr(r.error ?? "That did not work.");
    } catch { setErr("Could not reach the server."); }
    setBusy(false);
    return ok;
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
  const selected = l.investors.find((i) => i.id === open) ?? null;

  return (
    <div className="inv">
      {l.unassigned.length > 0 && <Unassigned key={l.unassigned[0].id} l={l} busy={busy} act={act} mounted={mounted} />}
      {err && <p className="trade-block" role="alert">{err}</p>}

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
        <ul className="inv-list">{l.investors.map((i) => <Row key={i.id} i={i} ccy={ccy} onOpen={() => setOpen(i.id)} />)}</ul>
        <p className="trade-muted">Tap a person for their statement, to rename or remove them, or to undo a deposit.
          Profit is after fees. Fee: {FOUNDER_FEE * 100}% of new profit above each investor’s previous best, settled on the 1st of each month.</p>
      </section>

      <section className="trade-card" aria-labelledby="inv-hist">
        <h2 className="trade-h" id="inv-hist">History</h2>
        <History l={l} ccy={ccy} mounted={mounted} busy={busy} act={act} />
      </section>

      <Sheet open={!!selected} onClose={() => setOpen(null)} eyebrow={selected?.founder ? "Founder" : "Investor"}
        title={selected?.name ?? ""}>
        {selected && <Statement key={selected.id} i={selected} l={l} mounted={mounted} busy={busy} act={act} onRemoved={() => setOpen(null)} />}
      </Sheet>
    </div>
  );
}

const HUES = [18, 42, 152, 200, 262, 320, 6, 96];
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("") || "?";
const hueOf = (name: string) => HUES[[...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % HUES.length];

/** One investor, ticker style: who, what they put in · what it is worth now, up or down since joining. */
function Row({ i, ccy, onOpen }: { i: InvestorView; ccy: string; onOpen: () => void }) {
  const pct = i.profitPct ?? 0;
  const dir = pct > 0.00005 ? "up" : pct < -0.00005 ? "down" : "flat";
  const net = i.deposited - i.withdrawn;
  return (
    <li>
      <button type="button" className="inv-row" onClick={onOpen} aria-label={`${i.name}: open statement`}>
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
      </button>
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

/** A new deposit or withdrawal: one person's, several people's (split), or not investor money. */
function Unassigned({ l, busy, act, mounted }: { l: Ledger; busy: boolean; mounted: boolean; act: Act }) {
  const f = l.unassigned[0];
  const [mode, setMode] = useState<"one" | "split">("one");
  const [pick, setPick] = useState<string>("");
  const dep = f.amount > 0;
  return (
    <section className="trade-card inv-alert" aria-labelledby="inv-new">
      <h2 className="trade-h" id="inv-new">{dep ? "New deposit" : "New withdrawal"}: whose money?</h2>
      <p><b className={dep ? "pos" : "neg"}>{signed(f.amount)} {l.currency}</b> on {when(f.at, mounted)}
        {l.unassigned.length > 1 && <span className="trade-muted"> · {l.unassigned.length - 1} more after this one</span>}</p>
      <p className="trade-muted">Until it is assigned, the numbers below treat it as nobody’s, so they are slightly off.</p>

      <div className="inv-seg" role="tablist" aria-label="How to assign">
        <button type="button" role="tab" aria-selected={mode === "one"} className={mode === "one" ? "is-on" : ""} onClick={() => setMode("one")}>One person</button>
        <button type="button" role="tab" aria-selected={mode === "split"} className={mode === "split" ? "is-on" : ""} onClick={() => setMode("split")}
          disabled={l.investors.length < 2}>Split between people</button>
      </div>

      {mode === "one" ? (
        <div className="inv-add">
          <select className="field-input" value={pick} onChange={(e) => setPick(e.target.value)} aria-label="Investor">
            <option value="">Choose…</option>
            {l.investors.map((i) => <option key={i.id} value={i.id}>{i.name}{i.founder ? " (you)" : ""}</option>)}
            <option value="ignore">Not investor money (bonus / profit)</option>
          </select>
          <button type="button" className="btn btn-primary" disabled={busy || !pick}
            onClick={() => act({ action: "assign", flow: f.id, investor: pick === "ignore" ? null : Number(pick), ignore: pick === "ignore" })}>Assign</button>
        </div>
      ) : (
        <SplitForm f={f} l={l} busy={busy} act={act} />
      )}
      {l.investors.length < 2 && <p className="trade-muted">Add the investor first (Investors, below), then choose them here.</p>}
    </section>
  );
}

function SplitForm({ f, l, busy, act }: { f: FlowRow; l: Ledger; busy: boolean; act: Act }) {
  const sign = f.amount > 0 ? 1 : -1;
  const total = Math.abs(f.amount);
  const [rows, setRows] = useState<{ investor: string; amount: string }[]>([{ investor: "", amount: "" }, { investor: "", amount: "" }]);
  const num = (s: string) => { const v = Number(s.replace(",", ".")); return Number.isFinite(v) ? v : 0; };
  const used = rows.reduce((s, r) => s + num(r.amount), 0);
  const left = Math.round((total - used) * 100) / 100;
  const ids = rows.map((r) => r.investor).filter(Boolean);
  const ready = rows.length >= 2 && rows.every((r) => r.investor && num(r.amount) > 0) && new Set(ids).size === ids.length && Math.abs(left) < 0.005;
  const set = (k: number, patch: Partial<{ investor: string; amount: string }>) => setRows(rows.map((r, j) => (j === k ? { ...r, ...patch } : r)));

  return (
    <div className="inv-split">
      {rows.map((r, k) => (
        <div className="inv-split-row" key={k}>
          <select className="field-input" value={r.investor} onChange={(e) => set(k, { investor: e.target.value })} aria-label={`Person ${k + 1}`}>
            <option value="">Who…</option>
            {l.investors.map((i) => <option key={i.id} value={i.id} disabled={ids.includes(String(i.id)) && r.investor !== String(i.id)}>{i.name}{i.founder ? " (you)" : ""}</option>)}
          </select>
          <input className="field-input" inputMode="decimal" placeholder={`Amount (${l.currency})`} value={r.amount}
            onChange={(e) => set(k, { amount: e.target.value })} aria-label={`Amount for person ${k + 1}`} />
          {rows.length > 2 && <button type="button" className="icon-btn" aria-label="Remove this person" onClick={() => setRows(rows.filter((_, j) => j !== k))}><X aria-hidden="true" /></button>}
        </div>
      ))}
      <div className="inv-split-foot">
        <button type="button" className="desk-link" onClick={() => setRows([...rows, { investor: "", amount: "" }])}
          disabled={rows.length >= Math.min(20, l.investors.length)}><Plus aria-hidden="true" /> Add a person</button>
        <span className={Math.abs(left) < 0.005 ? "pos" : "trade-muted"}>
          {Math.abs(left) < 0.005 ? "Adds up ✓" : left > 0 ? `${left.toFixed(2)} ${l.currency} still to share` : `${(-left).toFixed(2)} ${l.currency} too much`}
        </span>
      </div>
      <button type="button" className="btn btn-primary" disabled={busy || !ready}
        onClick={() => act({ action: "split", flow: f.id, parts: rows.map((r) => ({ investor: Number(r.investor), amount: sign * num(r.amount) })) })}>
        Save the split
      </button>
    </div>
  );
}

/** One person: what they own, what happened, and the tools to manage them. */
function Statement({ i, l, mounted, busy, act, onRemoved }: {
  i: InvestorView; l: Ledger; mounted: boolean; busy: boolean; act: Act; onRemoved: () => void;
}) {
  const ccy = l.currency;
  const [name, setName] = useState(i.name);
  const [copied, setCopied] = useState(false);
  const net = i.deposited - i.withdrawn;
  const events = [...i.events].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  const hasMoney = i.events.length > 0;
  const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });

  const summary = [
    `Mumaa Trading: statement for ${i.name}`,
    `As of ${day(new Date().toISOString())}`,
    ``,
    `Put in: ${money(i.deposited, ccy)} ${ccy}${i.withdrawn ? ` · taken out: ${money(i.withdrawn, ccy)} ${ccy}` : ""}`,
    `Worth now: ${money(i.value, ccy)} ${ccy}`,
    `Profit after fees: ${signed(i.profit)} ${ccy} (${pctText(i.profitPct, 2)})`,
    i.founder ? `Fees earned: ${money(i.feesEarned, ccy)} ${ccy}` : `Fees paid so far: ${money(i.feesPaid, ccy)} ${ccy}`,
    `Share of the account: ${(i.share * 100).toFixed(1)}%`,
    ``,
    `Trading carries risk; the value can go down as well as up.`,
  ].join("\n");

  const copy = async () => {
    try { await navigator.clipboard.writeText(summary); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { /* blocked */ }
  };
  const undo = async (flow: number, split?: boolean) => {
    const msg = split
      ? "Undo this shared deposit for everyone in it? It goes back to “whose money?” and you can assign it again."
      : "Undo this? It goes back to “whose money?” and you can assign it again.";
    if (window.confirm(msg)) await act({ action: "unassign", flow });
  };

  return (
    <div className="inv-st">
      <dl className="inv-st-stats">
        <div><dt>Worth now</dt><dd>{money(i.value, ccy)} <small>{ccy}</small></dd></div>
        <div><dt>Profit after fees</dt><dd className={tone(i.profit)}>{signed(i.profit)} <small>({pctText(i.profitPct, 2)})</small></dd></div>
        <div><dt>Put in (net)</dt><dd>{money(net, ccy)}</dd></div>
        <div><dt>Share of pool</dt><dd>{(i.share * 100).toFixed(1)}%</dd></div>
        {i.founder
          ? <div><dt>Fees earned</dt><dd className={tone(i.feesEarned)}>{money(i.feesEarned, ccy)}</dd></div>
          : <>
              <div><dt>Fees paid</dt><dd>{money(i.feesPaid, ccy)}</dd></div>
              <div><dt>Fee building up</dt><dd>{money(i.feeDueNow, ccy)}</dd></div>
              <div><dt>Previous best (no fee below)</dt><dd>{money(i.basis, ccy)}</dd></div>
            </>}
      </dl>

      <div className="inv-st-share">
        <button type="button" className="btn btn-ghost" onClick={copy}>{copied ? <><Check aria-hidden="true" /> Copied</> : <><Copy aria-hidden="true" /> Copy statement</>}</button>
        <a className="btn btn-ghost" href={`https://wa.me/?text=${encodeURIComponent(summary)}`} target="_blank" rel="noopener noreferrer">
          <MessageCircle aria-hidden="true" /> Send on WhatsApp
        </a>
      </div>

      <h3 className="inv-st-h">History</h3>
      {events.length === 0 ? <p className="trade-muted">No money in yet.</p> : (
        <ul className="inv-st-events">
          {events.map((e, k) => (
            <li key={k}>
              <span><b>{LABEL[e.kind]}</b>{e.split && <small> · shared deposit</small>}<small> · {when(e.at, mounted)}</small></span>
              <span className={tone(e.amount)}>{signed(e.amount)} {ccy}</span>
              {e.flow !== undefined && (e.kind === "deposit" || e.kind === "withdrawal")
                ? <button type="button" className="desk-link" disabled={busy} onClick={() => undo(e.flow!, e.split)}><Undo2 aria-hidden="true" /> Undo</button>
                : <span />}
            </li>
          ))}
        </ul>
      )}

      <h3 className="inv-st-h">Manage</h3>
      <form className="inv-add" onSubmit={(e) => { e.preventDefault(); if (name.trim() && name.trim() !== i.name) act({ action: "rename", investor: i.id, name: name.trim() }); }}>
        <input className="field-input" value={name} maxLength={60} aria-label="Name" onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="btn btn-ghost" disabled={busy || !name.trim() || name.trim() === i.name}>Rename</button>
      </form>
      {!i.founder && (
        hasMoney
          ? <p className="trade-muted">To remove {i.name}, first undo their deposits above (or keep them: their history stays in the books).</p>
          : <button type="button" className="btn btn-ghost inv-danger" disabled={busy}
              onClick={async () => { if (window.confirm(`Remove ${i.name}? They have no money in the books.`) && await act({ action: "remove", investor: i.id })) onRemoved(); }}>
              <Trash2 aria-hidden="true" /> Remove {i.name}
            </button>
      )}
    </div>
  );
}

function History({ l, ccy, mounted, busy, act }: { l: Ledger; ccy: string; mounted: boolean; busy: boolean; act: Act }) {
  const names = new Map(l.investors.map((i) => [i.id, i.name]));
  const rows = l.investors.flatMap((i) => i.events).sort((a, b) => Date.parse(b.at) - Date.parse(a.at)).slice(0, 60);
  const undoIgnored = async (f: FlowRow) => {
    if (window.confirm("This was marked “not investor money”. Undo, so you can assign it to someone?")) await act({ action: "unassign", flow: f.id });
  };
  if (!rows.length && !l.ignored.length) return <p className="trade-muted">Nothing yet.</p>;
  return (
    <>
      <div className="trade-table-wrap">
        <table className="trade-table">
          <thead><tr><th>When</th><th>Who</th><th>What</th><th>Amount</th><th>Unit price</th></tr></thead>
          <tbody>{rows.map((e, k) => (
            <tr key={k}>
              <td>{when(e.at, mounted)}</td><td>{names.get(e.investor)}</td><td>{LABEL[e.kind]}{e.split && <small>shared</small>}</td>
              <td className={tone(e.amount)}>{signed(e.amount)} {ccy}</td><td>{e.price.toFixed(4)}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>
      {l.ignored.length > 0 && (
        <>
          <h3 className="inv-st-h">Not investor money</h3>
          <ul className="inv-st-events">
            {l.ignored.map((f) => (
              <li key={f.id}>
                <span><b>{f.amount > 0 ? "Deposit" : "Withdrawal"}</b><small> · {when(f.at, mounted)}</small></span>
                <span className={tone(f.amount)}>{signed(f.amount)} {ccy}</span>
                <button type="button" className="desk-link" disabled={busy} onClick={() => undoIgnored(f)}><Undo2 aria-hidden="true" /> Undo</button>
              </li>
            ))}
          </ul>
        </>
      )}
    </>
  );
}
