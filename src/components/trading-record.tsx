"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, Check, Copy } from "lucide-react";
import type { RecordResult } from "@/lib/performance-server";

const pct = (v: number | null, d = 1) => (v === null ? "—" : `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v * 100).toFixed(d)}%`);
const GATE_DAYS = 90;

/** The public track record at a glance, its share link, and progress to the business plan's 90-day gate. */
export function TrackRecordCard() {
  const [res, setRes] = useState<RecordResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/performance").then((r) => r.json()).then((j: RecordResult) => { if (live) setRes(j); })
      .catch(() => { if (live) setRes({ ok: false, error: "Could not reach the server." }); });
    return () => { live = false; };
  }, []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/performance`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* clipboard blocked: the link is still on the page */ }
  };

  const r = res?.ok ? res.record : null;
  const days = r ? Math.floor(r.days) : 0;
  const gate = Math.min(days / GATE_DAYS, 1);

  return (
    <section className="trade-card rec" aria-labelledby="ov-record">
      <div className="trade-card-top">
        <h2 className="trade-h" id="ov-record">Public track record</h2>
        <span className="rec-actions">
          <button type="button" className="desk-link" onClick={copy}>{copied ? <><Check aria-hidden="true" /> Copied</> : <><Copy aria-hidden="true" /> Copy link</>}</button>
          <a className="desk-link" href="/performance" target="_blank" rel="noopener">Open <ArrowUpRight aria-hidden="true" /></a>
        </span>
      </div>
      {!res ? <p className="trade-muted">Loading…</p> : !res.ok ? <p className="trade-muted">{res.error}</p> : !r ? (
        <p className="trade-muted">Starts with the first trading day.</p>
      ) : (
        <>
          <dl className="rec-stats">
            <div><dt>Return</dt><dd className={r.growth > 0 ? "pos" : r.growth < 0 ? "neg" : ""}>{pct(r.growth, 2)}</dd></div>
            <div><dt>Worst drop</dt><dd className={r.maxDrawdown < 0 ? "neg" : ""}>{pct(r.maxDrawdown, 2)}</dd></div>
            <div><dt>Trades</dt><dd>{r.trades}</dd></div>
            <div><dt>Win rate</dt><dd>{pct(r.winRate, 0)}</dd></div>
          </dl>
          <div className="rec-gate">
            <span className="rec-gate-label">
              <b>{days >= GATE_DAYS ? "90-day gate reached" : `Day ${days} of ${GATE_DAYS}`}</b>
              <small> · checks on day 30, 60 and 90; nothing is sold before they pass</small>
            </span>
            <span className="rec-bar" role="progressbar" aria-valuemin={0} aria-valuemax={GATE_DAYS} aria-valuenow={Math.min(days, GATE_DAYS)}
              aria-label="Days of track record">
              <span style={{ width: `${gate * 100}%` }} className={r.growth >= 0 ? "is-up" : "is-down"} />
            </span>
          </div>
          <p className="trade-muted">
            {res.verified
              ? <>Verified: <a href={res.verified.url} target="_blank" rel="noopener noreferrer">{res.verified.label} ↗</a></>
              : <>Counts only from {new Date(r.start).toLocaleDateString("en-GB", { day: "numeric", month: "long" })}, when tracking began, so it can differ from the numbers above. Share the link with anyone: it shows percentages, never amounts.</>}
          </p>
        </>
      )}
    </section>
  );
}
