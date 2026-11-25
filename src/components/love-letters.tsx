"use client";

import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { Feather, Heart, Lock, Send, Trash2 } from "lucide-react";
import { Caveat } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import type { Letter } from "@/lib/letters";
import { ease } from "./motion";
import { Sheet } from "./sheet";
import { useToast } from "./toast";

/** Handwriting for the words on the paper and the names on the envelopes. */
const hand = Caveat({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-hand", display: "swap" });

const CLOSINGS = ["Forever yours", "All my love", "Yours, always", "With every heartbeat", "Love you endlessly"];

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const stampDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase();
const initial = (name: string) => name.trim().charAt(0).toUpperCase() || "♥";
const daysUntil = (iso: string, now: number) => Math.max(0, Math.ceil((Date.parse(iso) - now) / 86_400_000));

/**
 * Write to your love: a sheet of letter paper written in a handwriting font, sealed with wax and sent,
 * optionally kept sealed until a day you choose. Below, the letters received and sent, as envelopes
 * that open when tapped.
 */
export function LoveLetters({ initial: start, error, currentEmail, currentName }: {
  initial: Letter[]; error: string | null; currentEmail: string; currentName: string;
}) {
  const [letters, setLetters] = useState(start);
  const [open, setOpen] = useState<Letter | null>(null);
  const [now, setNow] = useState<number | null>(null);
  const me = currentEmail.toLowerCase();
  const forYou = letters.filter((l) => l.authorEmail !== me);
  const fromYou = letters.filter((l) => l.authorEmail === me);

  useEffect(() => {
    setNow(Date.now());
    const t = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(t);
  }, []);

  // A letter sealed until a time that has now passed: fetch again so its words appear.
  useEffect(() => {
    if (now === null || !letters.some((l) => l.sealed && l.openAt && Date.parse(l.openAt) <= now)) return;
    fetch("/api/letters", { cache: "no-store" }).then((r) => r.json()).then((r: { letters?: Letter[] }) => r.letters && setLetters(r.letters)).catch(() => {});
  }, [now, letters]);

  return (
    <section className={`ll ${hand.variable}`} aria-labelledby="ll-h">
      <header className="ll-head">
        <span className="eyebrow">Letters</span>
        <h2 className="ll-title" id="ll-h">Write to your <em>love.</em></h2>
        <p className="ll-lede">Put it on paper, seal it with wax, and send it. Or keep it sealed until a day that matters.</p>
      </header>

      {error ? <p className="ll-note">{error}</p> : <Composer name={currentName} onSent={(l) => setLetters((cur) => [l, ...cur])} />}

      {letters.length > 0 && (
        <div className="ll-shelves">
          {forYou.length > 0 && <Shelf title="For you" letters={forYou} me={me} now={now} onOpen={setOpen} />}
          {fromYou.length > 0 && <Shelf title="You sent" letters={fromYou} me={me} now={now} onOpen={setOpen} />}
        </div>
      )}

      <Sheet open={!!open} onClose={() => setOpen(null)} eyebrow={open && open.authorEmail === me ? "You wrote" : "A letter for you"}
        title={open ? (open.authorEmail === me ? <>To <em>{open.recipient}</em></> : <>From <em>{open.authorName}</em></>) : ""}>
        {open && (
          <div className={hand.variable}>
            <Reading letter={open} mine={open.authorEmail === me}
              onDeleted={() => { setLetters((cur) => cur.filter((l) => l.id !== open.id)); setOpen(null); }} />
          </div>
        )}
      </Sheet>
    </section>
  );
}

function Composer({ name, onSent }: { name: string; onSent: (l: Letter) => void }) {
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [closing, setClosing] = useState(CLOSINGS[0]);
  const [later, setLater] = useState(false);
  const [openAt, setOpenAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [flying, setFlying] = useState<Letter | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [today, setToday] = useState("");
  const text = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();
  const reduce = useReducedMotion();
  const ready = to.trim().length > 0 && body.trim().length > 0 && (!later || !!openAt);

  // Dates are in your own time, so they are filled in once the page runs in the browser.
  useEffect(() => setToday(day(new Date().toISOString())), []);

  // The paper grows with the letter instead of scrolling inside a little box.
  useEffect(() => {
    const t = text.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.max(t.scrollHeight, 204)}px`;
  }, [body]);

  const send = async () => {
    if (!ready || busy) return;
    setBusy(true); setErr(null);
    try {
      const res = await fetch("/api/letters", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recipient: to, body, closing, openAt: later && openAt ? new Date(openAt).toISOString() : null }),
      });
      const r = (await res.json().catch(() => ({}))) as { letter?: Letter; error?: string };
      if (!res.ok || !r.letter) throw new Error(r.error ?? "The letter could not be sent.");
      const letter = r.letter;
      setFlying(letter);
      window.setTimeout(() => {
        onSent(letter);
        setBody(""); setLater(false); setOpenAt(""); setFlying(null);
        toast(letter.sealed ? "Sealed. It opens on the day you chose." : `Sent to ${letter.recipient} ♥`);
      }, reduce ? 0 : 1500);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The letter could not be sent.");
    }
    setBusy(false);
  };

  return (
    <div className="ll-desk">
      <AnimatePresence mode="wait">
        {!flying ? (
          <motion.form key="paper" className="ll-paper ll-enter" onSubmit={(e) => { e.preventDefault(); send(); }}
            initial={false} animate={{ opacity: 1, y: 0, scale: 1, rotate: 0 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: 30, scaleY: 0.35, scaleX: 0.8, transition: { duration: 0.45, ease } }}>
            <span className="ll-stamp" aria-hidden="true"><Heart /></span>
            <p className="ll-date">{today || " "}</p>
            <label className="ll-to">
              <span>My dearest</span>
              <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="their name" maxLength={80} aria-label="Who the letter is for" required />
              <span aria-hidden="true">,</span>
            </label>
            <textarea ref={text} className="ll-body" value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="Write what your heart wants to say…" maxLength={8000} aria-label="Your letter" required />
            <div className="ll-sign">
              <select value={closing} onChange={(e) => setClosing(e.target.value)} aria-label="How you sign off">
                {CLOSINGS.map((c) => <option key={c}>{c}</option>)}
              </select>
              <span>,</span>
              <span className="ll-signature">{name}</span>
            </div>

            <div className="ll-actions">
              <label className="ll-later">
                <input type="checkbox" checked={later} onChange={(e) => setLater(e.target.checked)} />
                <Lock aria-hidden="true" /> Keep it sealed until a date
              </label>
              {later && (
                <input type="datetime-local" className="ll-when" value={openAt} onChange={(e) => setOpenAt(e.target.value)} aria-label="When it opens" required />
              )}
              <span className="ll-count" aria-hidden="true">{body.length ? `${body.trim().split(/\s+/).length} words` : ""}</span>
              <button type="submit" className="btn btn-primary ll-send" disabled={!ready || busy}>
                <span className="ll-wax ll-wax-sm" aria-hidden="true">{initial(name)}</span>
                {busy ? "Sealing…" : later ? "Seal it" : "Seal & send"} <Send aria-hidden="true" />
              </button>
            </div>
            {err && <p className="ll-err" role="alert">{err}</p>}
          </motion.form>
        ) : (
          <motion.div key="sending" className="ll-sending" aria-hidden="true"
            initial={{ opacity: 0, y: 20, scale: 0.85 }}
            animate={{ opacity: [0, 1, 1, 1, 0], y: [20, 0, 0, 0, -50], x: [0, 0, 0, 0, 220], rotate: [0, 0, -2, -2, 8], scale: [0.85, 1, 1, 1, 0.85] }}
            transition={{ duration: 1.5, times: [0, 0.2, 0.45, 0.75, 1], ease }}>
            <Envelope letter={flying} me={flying.authorEmail} now={null} big />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/** An envelope: the name written across it, a postmark, and a wax seal with the writer's initial. */
function Envelope({ letter: l, me, now, big = false, opening = false }: { letter: Letter; me: string; now: number | null; big?: boolean; opening?: boolean }) {
  const mine = l.authorEmail === me;
  const sealed = l.sealed && !(now !== null && l.openAt && Date.parse(l.openAt) <= now);
  return (
    <span className={`ll-env${big ? " is-big" : ""}${sealed ? " is-sealed" : ""}${opening ? " is-opening" : ""}`}>
      <span className="ll-env-back" />
      <span className="ll-env-front" />
      <span className="ll-env-flap" />
      <span className="ll-postmark">{now === null ? "MUMAA" : stampDay(l.createdAt)}</span>
      <span className="ll-env-to">{mine ? `To ${l.recipient}` : `For ${l.recipient}`}</span>
      <span className="ll-env-from">from {l.authorName}</span>
      <span className="ll-wax">{initial(l.authorName)}</span>
      {sealed && l.openAt && now !== null && (
        <span className="ll-lock"><Lock aria-hidden="true" /> {daysUntil(l.openAt, now)} {daysUntil(l.openAt, now) === 1 ? "day" : "days"}</span>
      )}
    </span>
  );
}

function Shelf({ title, letters, me, now, onOpen }: { title: string; letters: Letter[]; me: string; now: number | null; onOpen: (l: Letter) => void }) {
  return (
    <div className="ll-shelf">
      <h3 className="entry-group-title">{title} <span>{letters.length}</span></h3>
      <ul className="ll-grid">
        {letters.map((l, i) => {
          const sealed = l.sealed && !(now !== null && l.openAt && Date.parse(l.openAt) <= now);
          const mine = l.authorEmail === me;
          return (
            <li key={l.id} style={{ ["--i" as string]: i, ["--tilt" as string]: `${i % 2 ? 0.8 : -0.8}deg` }}>
              <button type="button" className="ll-card" onClick={() => onOpen(l)}
                aria-label={`${mine ? `Your letter to ${l.recipient}` : `Letter from ${l.authorName}`}${sealed ? ", still sealed" : ""}`}>
                <Envelope letter={l} me={me} now={now} />
                <span className="ll-card-meta">{now === null ? " " : sealed && l.openAt ? `Sealed until ${day(l.openAt)}` : `Sent ${day(l.createdAt)}`}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Reading({ letter: l, mine, onDeleted }: { letter: Letter; mine: boolean; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const reduce = useReducedMotion();
  const remove = async () => {
    if (!window.confirm("Take this letter back? It will be gone for both of you.")) return;
    setBusy(true);
    const res = await fetch(`/api/letters?id=${encodeURIComponent(l.id)}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) { toast("Letter taken back"); onDeleted(); }
    else toast(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That did not work.");
  };
  const sealed = l.sealed || l.body === null;
  return (
    <div className="ll-read">
      {sealed ? (
        <div className="ll-sealed">
          <Envelope letter={l} me={mine ? l.authorEmail : ""} now={Date.now()} big />
          <p>This letter is sealed{l.openAt ? <> until <b>{day(l.openAt)}</b></> : ""}. Its words appear here the moment it opens.</p>
        </div>
      ) : (
        <motion.article className="ll-paper is-reading"
          initial={reduce ? false : { opacity: 0, y: 40, scaleY: 0.6 }} animate={{ opacity: 1, y: 0, scaleY: 1 }}
          transition={{ duration: 0.6, ease }} style={{ transformOrigin: "top" }}>
          <span className="ll-stamp" aria-hidden="true"><Heart /></span>
          <p className="ll-date">{day(l.createdAt)}</p>
          <p className="ll-to"><span>My dearest {l.recipient},</span></p>
          <div className="ll-body">{l.body}</div>
          <p className="ll-sign"><span>{l.closing},</span><span className="ll-signature">{l.authorName}</span></p>
        </motion.article>
      )}
      {mine ? (
        <button type="button" className="btn btn-ghost ll-remove" onClick={remove} disabled={busy}>
          <Trash2 aria-hidden="true" /> Take it back
        </button>
      ) : !sealed && <p className="ll-from"><Feather aria-hidden="true" /> Written for you by {l.authorName}</p>}
    </div>
  );
}
