"use client";

import { AnimatePresence, motion, useAnimate, useReducedMotion } from "motion/react";
import { Lock, PenLine, Send, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Letter } from "@/lib/letters";
import { Sheet } from "./sheet";
import { useToast } from "./toast";

/*
 * Letters by candlelight. A dark panel at the very top of the page holds the newest letter for you as a
 * large envelope (marked New until you open it) and a button to write one; every other letter sits in a
 * row of small envelopes beneath. Letters themselves are fine stationery: cream cotton paper, a thin
 * printed border, a monogram, and the site's serif. One premium motion voice throughout.
 */
const EASE = [0.4, 0, 0.2, 1] as const;     // signature
const ENTER = [0.05, 0.7, 0.1, 1] as const; // arrivals
const LEAVE = [0.3, 0, 1, 1] as const;      // departures
const PAPER = { type: "spring", stiffness: 260, damping: 26, mass: 0.9 } as const;

const CLOSINGS = ["Forever yours", "All my love", "Yours, always", "With every heartbeat", "Love you endlessly"];
const SEEN = "mumaa.letters.seen.v1";

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const initial = (name: string) => name.trim().charAt(0).toUpperCase() || "♥";
const daysUntil = (iso: string, now: number) => Math.max(0, Math.ceil((Date.parse(iso) - now) / 86_400_000));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
function since(iso: string, now: number) {
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} ${h === 1 ? "hour" : "hours"} ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}
const isSealed = (l: Letter, now: number | null) => l.sealed && !(now !== null && l.openAt && Date.parse(l.openAt) <= now);

/** Which letters you have opened on this device, so new ones can say so. */
function useSeen() {
  const [seen, setSeen] = useState<Set<string> | null>(null);
  useEffect(() => {
    try { setSeen(new Set(JSON.parse(localStorage.getItem(SEEN) ?? "[]") as string[])); } catch { setSeen(new Set()); }
  }, []);
  const mark = useCallback((id: string) => {
    setSeen((cur) => {
      const next = new Set(cur ?? []);
      next.add(id);
      try { localStorage.setItem(SEEN, JSON.stringify([...next].slice(-300))); } catch { /* private mode */ }
      return next;
    });
  }, []);
  return { seen, mark };
}

export function LoveLetters({ initial: start, error, currentEmail, currentName }: {
  initial: Letter[]; error: string | null; currentEmail: string; currentName: string;
}) {
  const [letters, setLetters] = useState(start);
  const [reading, setReading] = useState<Letter | null>(null);
  const [writing, setWriting] = useState(false);
  const [now, setNow] = useState<number | null>(null);
  const { seen, mark } = useSeen();
  const me = currentEmail.toLowerCase();
  const received = letters.filter((l) => l.authorEmail !== me);
  // The letter that takes the stage: the newest one for you that you haven't opened, else the newest for you.
  const featured = useMemo(
    () => received.find((l) => seen && !seen.has(l.id) && !isSealed(l, now)) ?? received[0] ?? null,
    [received, seen, now],
  );
  const rest = letters.filter((l) => l.id !== featured?.id);
  const unread = seen ? received.filter((l) => !seen.has(l.id) && !isSealed(l, now)).length : 0;

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

  const open = (l: Letter) => { setReading(l); if (!isSealed(l, now)) mark(l.id); };

  return (
    <section className="ll" aria-labelledby="ll-h">
      <span className="ll-glow" aria-hidden="true" />
      <motion.div className="ll-top" initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: ENTER }}>
        <div className="ll-heading">
          <span className="ll-eyebrow">Letters{unread > 0 && <b className="ll-new-dot" aria-label={`${unread} new`}>{unread} new</b>}</span>
          <h2 className="ll-title" id="ll-h">Words for <em>each other.</em></h2>
        </div>
        {!error && (
          <motion.button type="button" className="ll-write" onClick={() => setWriting(true)} whileTap={{ scale: 0.97 }} transition={{ duration: 0.12 }}>
            <PenLine aria-hidden="true" /> Write a letter
          </motion.button>
        )}
      </motion.div>

      {error ? (
        <p className="ll-note">{error}</p>
      ) : featured ? (
        <Featured letter={featured} now={now} fresh={!!seen && !seen.has(featured.id) && !isSealed(featured, now)} onOpen={() => open(featured)} />
      ) : (
        <motion.div className="ll-empty" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease: ENTER, delay: 0.15 }}>
          <EnvelopeArt name="" wax="♥" />
          <p>No letter for you yet. Be the first to write one.</p>
        </motion.div>
      )}

      {rest.length > 0 && (
        <div className="ll-row-wrap">
          <span className="ll-row-label">All letters</span>
          <ul className="ll-row">
            <AnimatePresence initial={false}>
              {rest.map((l, i) => {
                const mine = l.authorEmail === me;
                const sealed = isSealed(l, now);
                const fresh = !mine && !!seen && !seen.has(l.id) && !sealed;
                return (
                  <motion.li key={l.id} layout initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2, ease: LEAVE } }}
                    transition={{ ...PAPER, delay: 0.15 + Math.min(i, 6) * 0.05 }}>
                    <motion.button type="button" className="ll-mini" onClick={() => open(l)} whileHover={{ y: -4 }} whileTap={{ scale: 0.97 }}
                      transition={{ duration: 0.3, ease: EASE }}
                      aria-label={`${mine ? `Your letter to ${l.recipient}` : `Letter from ${l.authorName}`}${sealed ? ", still sealed" : ""}${fresh ? ", new" : ""}`}>
                      <EnvelopeArt name={mine ? l.recipient : l.authorName} wax={initial(l.authorName)} small sealed={sealed} />
                      <span className="ll-mini-text">
                        <b>{mine ? `To ${l.recipient}` : `From ${l.authorName}`}{fresh && <i className="ll-new">New</i>}</b>
                        <small>{now === null ? " " : sealed && l.openAt ? `Opens in ${daysUntil(l.openAt, now)} days` : since(l.createdAt, now)}</small>
                      </span>
                    </motion.button>
                  </motion.li>
                );
              })}
            </AnimatePresence>
          </ul>
        </div>
      )}

      <Sheet open={writing} onClose={() => setWriting(false)} eyebrow="A letter" title={<>Write to your <em>love.</em></>}>
        {writing && <Composer name={currentName} onSent={(l) => { setLetters((cur) => [l, ...cur]); setWriting(false); }} />}
      </Sheet>

      <Sheet open={!!reading} onClose={() => setReading(null)} eyebrow={reading && reading.authorEmail === me ? "You wrote" : "A letter for you"}
        title={reading ? (reading.authorEmail === me ? <>To <em>{reading.recipient}</em></> : <>From <em>{reading.authorName}</em></>) : ""}>
        {reading && (
          <Reading key={reading.id} letter={reading} mine={reading.authorEmail === me}
            onDeleted={() => { setLetters((cur) => cur.filter((l) => l.id !== reading.id)); setReading(null); }} />
        )}
      </Sheet>
    </section>
  );
}

/* ─── The newest letter, on stage ─────────────────────────────────────── */

function Featured({ letter: l, now, fresh, onOpen }: { letter: Letter; now: number | null; fresh: boolean; onOpen: () => void }) {
  const sealed = isSealed(l, now);
  return (
    <motion.button type="button" className="ll-stage" onClick={onOpen}
      initial={{ opacity: 0, y: 24, rotate: -1.5 }} animate={{ opacity: 1, y: 0, rotate: 0 }} transition={{ ...PAPER, delay: 0.12 }}
      whileHover="hover" whileTap={{ scale: 0.985 }}
      aria-label={`${sealed ? "Sealed letter" : "Open the letter"} from ${l.authorName}`}>
      <motion.span className="ll-stage-env" variants={{ hover: { y: -6, rotate: -0.6 } }} transition={{ duration: 0.4, ease: EASE }}>
        <EnvelopeArt name={l.recipient} wax={initial(l.authorName)} sealed={sealed} live={fresh} />
      </motion.span>
      <span className="ll-stage-text">
        {fresh && <span className="ll-new">New</span>}
        <span className="ll-stage-from">From {l.authorName}</span>
        <span className="ll-stage-when">
          {now === null ? " " : sealed && l.openAt ? <><Lock aria-hidden="true" /> Sealed · opens {day(l.openAt)}</> : `Arrived ${since(l.createdAt, now)}`}
        </span>
        <span className="ll-stage-cta">{sealed ? "See it" : "Open the letter"} →</span>
      </span>
    </motion.button>
  );
}

/** A cream envelope with a crisp flap, the name written across it, and a deep red wax seal. */
function EnvelopeArt({ name, wax, small = false, sealed = false, live = false }: { name: string; wax: string; small?: boolean; sealed?: boolean; live?: boolean }) {
  return (
    <span className={`ll-env${small ? " is-small" : ""}${sealed ? " is-sealed" : ""}${live ? " is-live" : ""}`} aria-hidden="true">
      <span className="ll-env-body" />
      <span className="ll-env-flap" />
      {name && <span className="ll-env-name">{name}</span>}
      <span className="ll-seal">{wax}</span>
      {sealed && <span className="ll-env-lock"><Lock /></span>}
    </span>
  );
}

/* ─── Writing ─────────────────────────────────────────────────────────── */

function Composer({ name, onSent }: { name: string; onSent: (l: Letter) => void }) {
  const [to, setTo] = useState("");
  const [body, setBody] = useState("");
  const [closing, setClosing] = useState(CLOSINGS[0]);
  const [later, setLater] = useState(false);
  const [openAt, setOpenAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [sending, setSending] = useState<Letter | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [today, setToday] = useState("");
  const text = useRef<HTMLTextAreaElement>(null);
  const toast = useToast();
  const reduce = useReducedMotion();
  const ready = to.trim().length > 0 && body.trim().length > 0 && (!later || !!openAt);

  useEffect(() => setToday(day(new Date().toISOString())), []);
  useEffect(() => {
    const t = text.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.max(t.scrollHeight, 220)}px`;
  }, [body]);

  const finish = (letter: Letter) => {
    onSent(letter);
    toast(letter.sealed ? "Sealed. It opens on the day you chose." : `Sent to ${letter.recipient} ♥`);
  };

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
      if (reduce) finish(r.letter); else setSending(r.letter);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The letter could not be sent.");
    }
    setBusy(false);
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      {!sending ? (
        <motion.form key="paper" className="ll-compose" onSubmit={(e) => { e.preventDefault(); send(); }}
          exit={{ scaleY: 0.2, y: -10, opacity: 0, transition: { duration: 0.42, ease: LEAVE } }} style={{ transformOrigin: "50% 0%" }}>
          <motion.div className="ll-paper" initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ ...PAPER, delay: 0.1 }}>
            <span className="ll-monogram" aria-hidden="true">{initial(name)}<i>&amp;</i>{to ? initial(to) : "·"}</span>
            <p className="ll-date">{today || " "}</p>
            <label className="ll-to">
              <span>My dearest</span>
              <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="their name" maxLength={80} aria-label="Who the letter is for" required autoFocus />
              <span aria-hidden="true">,</span>
            </label>
            <textarea ref={text} className="ll-body" value={body} onChange={(e) => setBody(e.target.value)}
              placeholder="Write what your heart wants to say…" maxLength={8000} aria-label="Your letter" required />
            <div className="ll-sign">
              <select value={closing} onChange={(e) => setClosing(e.target.value)} aria-label="How you sign off">
                {CLOSINGS.map((c) => <option key={c}>{c}</option>)}
              </select>
              <span className="ll-signature">{name}</span>
            </div>
          </motion.div>

          <div className="ll-actions">
            <label className="ll-later">
              <input type="checkbox" checked={later} onChange={(e) => setLater(e.target.checked)} />
              <Lock aria-hidden="true" /> Keep it sealed until a date
            </label>
            <AnimatePresence initial={false}>
              {later && (
                <motion.input key="when" type="datetime-local" className="ll-when" value={openAt} onChange={(e) => setOpenAt(e.target.value)} aria-label="When it opens" required
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3, ease: EASE }} />
              )}
            </AnimatePresence>
            <motion.button type="submit" className="btn btn-primary ll-send" disabled={!ready || busy} whileTap={ready ? { scale: 0.97 } : undefined}>
              <motion.span className="ll-seal ll-seal-sm" aria-hidden="true"
                animate={busy ? { rotate: [0, -12, 12, 0] } : { rotate: 0 }} transition={busy ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}>
                {initial(name)}
              </motion.span>
              {busy ? "Sealing…" : later ? "Seal it" : "Seal & send"} <Send aria-hidden="true" />
            </motion.button>
          </div>
          <AnimatePresence>
            {err && (
              <motion.p className="ll-err" role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1, x: [0, -8, 7, -4, 0] }} exit={{ opacity: 0 }}
                transition={{ duration: 0.38, ease: "easeInOut" }}>{err}</motion.p>
            )}
          </AnimatePresence>
        </motion.form>
      ) : (
        <SendScene key="sending" letter={sending} name={name} onDone={() => finish(sending)} />
      )}
    </AnimatePresence>
  );
}

/** Sealing and sending (~3 s): the letter folds in thirds and slips in, the flap shuts, a drop of red wax
 * falls and splashes, the seal is pressed into it, little hearts float up, and the envelope sways and flies
 * away along a dotted trail. */
function SendScene({ letter, name, onDone }: { letter: Letter; name: string; onDone: () => void }) {
  const [scope, animate] = useAnimate();
  useEffect(() => {
    let live = true;
    (async () => {
      const $ = (s: string) => scope.current?.querySelector(s) as Element;
      const $$ = (s: string) => Array.from(scope.current?.querySelectorAll(s) ?? []) as Element[];
      await animate(scope.current, { opacity: [0, 1], y: [24, 0] }, { duration: 0.4, ease: ENTER });
      await animate($(".ll-e3-paper"), { y: "-115%", scaleY: [1, 0.66, 0.34] }, { duration: 0.5, ease: EASE, times: [0, 0.5, 1] });
      await animate($(".ll-e3-paper"), { y: ["-115%", "8%"] }, { duration: 0.45, ease: EASE });
      animate($(".ll-e3-shadow"), { opacity: [0, 0.5] }, { duration: 0.4, ease: EASE });
      await animate($(".ll-e3-flap"), { rotateX: [180, 0] }, { duration: 0.42, ease: EASE });
      await animate($(".ll-e3-drip"), { y: [-120, 0], opacity: [0, 1, 1], scaleY: [1.5, 1.3, 1] }, { duration: 0.32, ease: [0.5, 0, 1, 1] });
      animate($(".ll-e3-drip"), { scaleX: [1, 2.6], scaleY: [1, 0.35], opacity: [1, 0] }, { duration: 0.2, ease: EASE });
      animate($(".ll-e3-ring"), { scale: [0.4, 2.4], opacity: [0.55, 0] }, { duration: 0.7, ease: ENTER });
      await animate($(".ll-e3-seal"), { scale: [1.9, 0.86, 1], opacity: [0, 1, 1], rotate: [-20, 4, 0] }, { duration: 0.42, ease: ENTER, times: [0, 0.6, 1] });
      $$(".ll-e3-heart").forEach((h, i) => animate(h, { y: [0, -90 - i * 14], x: [0, (i - 2) * 16], opacity: [0, 1, 0], scale: [0.5, 1.1, 0.8], rotate: [0, (i - 2) * 12] },
        { duration: 1.1, ease: ENTER, delay: i * 0.07 }));
      await wait(380);
      await animate(scope.current, { rotate: [0, -3, 3, 0], y: [0, 4, 0] }, { duration: 0.4, ease: "easeInOut" });
      animate($(".ll-e3-trail path"), { pathLength: [0, 1], opacity: [0, 1, 0.6] }, { duration: 0.8, ease: EASE });
      await animate($(".ll-e3-fly"), { x: [0, 40, 230], y: [0, -50, -190], rotate: [0, -6, -16], scale: [1, 0.85, 0.4], opacity: [1, 1, 0] },
        { duration: 0.85, ease: LEAVE, times: [0, 0.35, 1] });
      await wait(150);
      if (live) onDone();
    })();
    return () => { live = false; };
  }, [animate, scope, onDone]);

  return (
    <div className="ll-scene" aria-live="polite">
      <span className="sr-only">Sealing your letter to {letter.recipient}…</span>
      <div ref={scope} className="ll-e3" aria-hidden="true">
        <svg className="ll-e3-trail" viewBox="0 0 300 220" preserveAspectRatio="none">
          <path d="M150 140 C 190 150, 230 90, 210 70 C 195 55, 175 75, 195 90 C 225 110, 260 40, 296 6" pathLength={1} style={{ opacity: 0 }} />
        </svg>
        <span className="ll-e3-fly">
          <span className="ll-e3-back" />
          <span className="ll-e3-paper"><i /><i /><i /><i /></span>
          <span className="ll-e3-front"><span className="ll-e3-to">{letter.recipient}</span></span>
          <span className="ll-e3-shadow" />
          <span className="ll-e3-flap" style={{ transform: "rotateX(180deg)" }} />
          <span className="ll-e3-drip" style={{ opacity: 0 }} />
          <span className="ll-e3-ring" />
          <span className="ll-seal ll-e3-seal" style={{ opacity: 0 }}>{initial(name)}</span>
        {[0, 1, 2, 3, 4].map((i) => <span key={i} className="ll-e3-heart" style={{ left: `${30 + i * 10}%` }}>♥</span>)}
        </span>
      </div>
    </div>
  );
}

/* ─── Opening and reading ─────────────────────────────────────────────── */

function Reading({ letter: l, mine, onDeleted }: { letter: Letter; mine: boolean; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const [asking, setAsking] = useState(false);
  const reduce = useReducedMotion();
  const sealed = l.sealed || l.body === null;
  const [phase, setPhase] = useState<"envelope" | "letter">(sealed || reduce ? "letter" : "envelope");
  const toast = useToast();
  const remove = async () => {
    setBusy(true);
    const res = await fetch(`/api/letters?id=${encodeURIComponent(l.id)}`, { method: "DELETE" }).catch(() => null);
    setBusy(false);
    if (res?.ok) { toast("Letter deleted"); onDeleted(); return; }
    setAsking(false);
    toast(((await res?.json().catch(() => ({}))) as { error?: string } | undefined)?.error ?? "The letter could not be deleted.");
  };
  const paragraphs = (l.body ?? "").split(/\n{2,}/);

  return (
    <div className="ll-read">
      {sealed ? (
        <div className="ll-sealed">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0, rotate: [0, 0, -2, 2, -1, 0] }}
            transition={{ duration: 0.9, ease: EASE, times: [0, 0.45, 0.6, 0.75, 0.9, 1] }}>
            <EnvelopeArt name={l.recipient} wax={initial(l.authorName)} sealed />
          </motion.div>
          <p>This letter is sealed{l.openAt ? <> until <b>{day(l.openAt)}</b></> : ""}. Its words appear the moment it opens.</p>
        </div>
      ) : phase === "envelope" ? (
        <OpenScene letter={l} onOpened={() => setPhase("letter")} />
      ) : (
        <motion.article className="ll-paper is-reading"
          initial={reduce ? false : { opacity: 0, y: 30, scaleY: 0.6 }} animate={{ opacity: 1, y: 0, scaleY: 1 }}
          transition={{ ...PAPER, opacity: { duration: 0.3, ease: EASE } }} style={{ transformOrigin: "50% 0%" }}>
          <span className="ll-monogram" aria-hidden="true">{initial(l.authorName)}<i>&amp;</i>{initial(l.recipient)}</span>
          <motion.p className="ll-date" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 0.4 }}>{day(l.createdAt)}</motion.p>
          <motion.p className="ll-to" initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.45, ease: ENTER }}>
            My dearest {l.recipient},
          </motion.p>
          <div className="ll-body">
            {paragraphs.map((p, i) => (
              <motion.p key={i} className="ll-para" initial={reduce ? false : { opacity: 0, y: 8, filter: "blur(3px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.42 + Math.min(i, 5) * 0.09, duration: 0.55, ease: ENTER }}>
                {p}
              </motion.p>
            ))}
          </div>
          <motion.div className="ll-sign" initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 + Math.min(paragraphs.length, 5) * 0.09, duration: 0.6, ease: ENTER }}>
            <span>{l.closing},</span><span className="ll-signature">{l.authorName}</span>
          </motion.div>
        </motion.article>
      )}
      {phase === "letter" && (
        <motion.div className="ll-delete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: sealed ? 0.2 : 0.6, duration: 0.4 }}>
          <AnimatePresence mode="wait" initial={false}>
            {!asking ? (
              <motion.button key="ask" type="button" className="btn btn-ghost ll-remove" onClick={() => setAsking(true)}
                initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.2, ease: EASE }}>
                <Trash2 aria-hidden="true" /> Delete letter
              </motion.button>
            ) : (
              <motion.div key="confirm" className="ll-confirm" role="alertdialog" aria-label="Delete this letter?"
                initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4 }} transition={{ duration: 0.28, ease: ENTER }}>
                <p><b>Delete this letter?</b> It will be gone for both of you{mine ? "" : `, and ${l.authorName} won’t be able to see it either`}. This can’t be undone.</p>
                <div className="ll-confirm-actions">
                  <button type="button" className="btn btn-ghost" onClick={() => setAsking(false)} disabled={busy} autoFocus>Keep it</button>
                  <button type="button" className="btn ll-danger" onClick={remove} disabled={busy}>
                    <Trash2 aria-hidden="true" /> {busy ? "Deleting…" : "Delete"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}

/** Opening (~2 s): the envelope drops in and settles, the wax seal cracks in two and the halves tumble
 * away, the flap swings open, and the letter rises out still folded and opens fold by fold as hearts drift up.
 * Tapping skips ahead. */
function OpenScene({ letter, onOpened }: { letter: Letter; onOpened: () => void }) {
  const [scope, animate] = useAnimate();
  const done = useRef(false);
  const finish = useCallback(() => { if (!done.current) { done.current = true; onOpened(); } }, [onOpened]);
  useEffect(() => {
    let live = true;
    (async () => {
      const $ = (s: string) => scope.current?.querySelector(s) as Element;
      const $$ = (s: string) => Array.from(scope.current?.querySelectorAll(s) ?? []) as Element[];
      await animate(scope.current, { opacity: [0, 1], y: [-50, 8, 0], rotate: [-5, 1.5, 0] }, { duration: 0.55, ease: ENTER, times: [0, 0.7, 1] });
      await animate($(".ll-e3-crack"), { opacity: [0, 1], scaleY: [0, 1] }, { duration: 0.18, ease: EASE });
      animate($(".ll-e3-half.is-l"), { x: -46, y: 70, rotate: -50, opacity: 0 }, { duration: 0.6, ease: LEAVE });
      animate($(".ll-e3-half.is-r"), { x: 46, y: 80, rotate: 60, opacity: 0 }, { duration: 0.6, ease: LEAVE });
      animate($(".ll-e3-crack"), { opacity: 0 }, { duration: 0.1 });
      animate($(".ll-e3-shadow"), { opacity: 0 }, { duration: 0.3 });
      await wait(160);
      await animate($(".ll-e3-flap"), { rotateX: 180 }, { duration: 0.45, ease: EASE });
      animate($(".ll-e3-flap"), { zIndex: 0 }, { duration: 0 });
      await animate($(".ll-e3-paper"), { y: "-78%" }, { duration: 0.42, ease: ENTER });
      $$(".ll-e3-heart").forEach((h, i) => animate(h, { y: [0, -110 - i * 10], x: [0, (i - 2) * 18], opacity: [0, 1, 0], scale: [0.5, 1, 0.7] },
        { duration: 1.2, ease: ENTER, delay: i * 0.06 }));
      await animate($(".ll-e3-paper"), { scaleY: [0.34, 0.67, 1] }, { duration: 0.4, ease: EASE, times: [0, 0.5, 1] });
      await wait(120);
      if (live) finish();
    })();
    return () => { live = false; };
  }, [animate, scope, finish]);

  return (
    <button type="button" className="ll-scene ll-scene-open" onClick={finish} aria-label="Open the letter">
      <div ref={scope} className="ll-e3">
        <span className="ll-e3-back" />
        <span className="ll-e3-paper" style={{ transform: "translateY(8%) scaleY(0.34)" }}><i /><i /><i /><i /></span>
        <span className="ll-e3-front"><span className="ll-e3-to">{letter.recipient}</span></span>
        <span className="ll-e3-shadow" style={{ opacity: 0.5 }} />
        <span className="ll-e3-flap" />
        <span className="ll-seal ll-e3-seal ll-e3-half is-l">{initial(letter.authorName)}</span>
        <span className="ll-seal ll-e3-seal ll-e3-half is-r">{initial(letter.authorName)}</span>
        <span className="ll-e3-crack" style={{ opacity: 0 }} />
        {[0, 1, 2, 3, 4].map((i) => <span key={i} className="ll-e3-heart" style={{ left: `${30 + i * 10}%` }}>♥</span>)}
      </div>
      <span className="ll-scene-hint">Tap to open</span>
    </button>
  );
}
