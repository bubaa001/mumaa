"use client";

import { AnimatePresence, motion, useAnimate, useReducedMotion, type Variants } from "motion/react";
import { Feather, Heart, Lock, Send, Trash2 } from "lucide-react";
import { Caveat } from "next/font/google";
import { useEffect, useRef, useState } from "react";
import type { Letter } from "@/lib/letters";
import { Sheet } from "./sheet";
import { useToast } from "./toast";

/** Handwriting for the words on the paper and the names on the envelopes. */
const hand = Caveat({ subsets: ["latin"], weight: ["400", "600"], variable: "--font-hand", display: "swap" });

/*
 * Motion: one "premium" voice for the whole section. A single signature curve for movement on screen,
 * an emphasised curve for things arriving, an accelerating one for things leaving, 350–600ms moves,
 * and paper that settles with only a whisper of overshoot. Reduced motion skips every sequence.
 */
const EASE = [0.4, 0, 0.2, 1] as const;     // signature
const ENTER = [0.05, 0.7, 0.1, 1] as const; // arrivals
const LEAVE = [0.3, 0, 1, 1] as const;      // departures
const PAPER = { type: "spring", stiffness: 260, damping: 26, mass: 0.9 } as const; // ~3% overshoot

const CLOSINGS = ["Forever yours", "All my love", "Yours, always", "With every heartbeat", "Love you endlessly"];

const day = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
const stampDay = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" }).toUpperCase();
const initial = (name: string) => name.trim().charAt(0).toUpperCase() || "♥";
const daysUntil = (iso: string, now: number) => Math.max(0, Math.ceil((Date.parse(iso) - now) / 86_400_000));
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const rise: Variants = {
  hidden: { opacity: 0, y: 18 },
  shown: (i: number = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.6, ease: ENTER, delay: i * 0.08 } }),
};

/**
 * Write to your love: letter paper in handwriting, folded into an envelope, sealed with wax and sent,
 * optionally kept sealed until a day you choose. Below, letters received and sent, as envelopes that
 * open with a little ceremony.
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
      <motion.header className="ll-head" initial="hidden" whileInView="shown" viewport={{ once: true, amount: 0.6 }}>
        <motion.span className="eyebrow" variants={rise} custom={0}>Letters</motion.span>
        <motion.h2 className="ll-title" id="ll-h" variants={rise} custom={1}>Write to your <em>love.</em></motion.h2>
        <motion.p className="ll-lede" variants={rise} custom={2}>Put it on paper, seal it with wax, and send it. Or keep it sealed until a day that matters.</motion.p>
      </motion.header>

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
            <Reading key={open.id} letter={open} mine={open.authorEmail === me}
              onDeleted={() => { setLetters((cur) => cur.filter((l) => l.id !== open.id)); setOpen(null); }} />
          </div>
        )}
      </Sheet>
    </section>
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

  // Dates are in your own time, so they are filled in once the page runs in the browser.
  useEffect(() => setToday(day(new Date().toISOString())), []);

  // The paper grows with the letter instead of scrolling inside a little box.
  useEffect(() => {
    const t = text.current;
    if (!t) return;
    t.style.height = "auto";
    t.style.height = `${Math.max(t.scrollHeight, 204)}px`;
  }, [body]);

  const finish = (letter: Letter) => {
    onSent(letter);
    setBody(""); setLater(false); setOpenAt(""); setSending(null);
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
      if (reduce) finish(r.letter);
      else setSending(r.letter);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "The letter could not be sent.");
    }
    setBusy(false);
  };

  return (
    <div className="ll-desk">
      <AnimatePresence mode="wait" initial={false}>
        {!sending ? (
          <motion.form key="paper" className="ll-paper ll-writing" onSubmit={(e) => { e.preventDefault(); send(); }}
            initial={{ opacity: 0, y: 28, rotate: -0.8 }} whileInView={{ opacity: 1, y: 0, rotate: 0 }} viewport={{ once: true, amount: 0.25 }}
            transition={{ ...PAPER, opacity: { duration: 0.5, ease: EASE } }}
            // Folding up: the sheet creases toward its top edge before it goes into the envelope.
            exit={{ scaleY: 0.18, y: -10, opacity: 0.0, transition: { duration: 0.42, ease: LEAVE } }} style={{ transformOrigin: "50% 0%" }}>
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
              <AnimatePresence initial={false}>
                {later && (
                  <motion.input key="when" type="datetime-local" className="ll-when" value={openAt} onChange={(e) => setOpenAt(e.target.value)} aria-label="When it opens" required
                    initial={{ opacity: 0, x: -8, width: 0 }} animate={{ opacity: 1, x: 0, width: "auto" }} exit={{ opacity: 0, x: -8, width: 0 }}
                    transition={{ duration: 0.35, ease: EASE }} />
                )}
              </AnimatePresence>
              <span className="ll-count" aria-hidden="true">{body.length ? `${body.trim().split(/\s+/).length} words` : ""}</span>
              <motion.button type="submit" className="btn btn-primary ll-send" disabled={!ready || busy}
                whileTap={ready ? { scale: 0.97 } : undefined} transition={{ duration: 0.12, ease: EASE }}>
                <motion.span className="ll-wax ll-wax-sm" aria-hidden="true"
                  animate={busy ? { rotate: [0, -12, 12, 0] } : { rotate: 0 }} transition={busy ? { duration: 0.6, repeat: Infinity, ease: "easeInOut" } : { duration: 0.2 }}>
                  {initial(name)}
                </motion.span>
                {busy ? "Sealing…" : later ? "Seal it" : "Seal & send"} <Send aria-hidden="true" />
              </motion.button>
            </div>
            <AnimatePresence>
              {err && (
                <motion.p className="ll-err" role="alert" initial={{ opacity: 0, x: 0 }} animate={{ opacity: 1, x: [0, -8, 7, -4, 0] }} exit={{ opacity: 0 }}
                  transition={{ duration: 0.38, ease: "easeInOut" }}>{err}</motion.p>
              )}
            </AnimatePresence>
          </motion.form>
        ) : (
          <SendScene key="sending" letter={sending} name={name} onDone={() => finish(sending)} />
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Sealing and sending, as one short scene (~2 s): the folded letter drops into an open envelope, the
 * flap closes, the wax seal is pressed with a ring of warmth, and the envelope lifts away on an arc.
 */
function SendScene({ letter, name, onDone }: { letter: Letter; name: string; onDone: () => void }) {
  const [scope, animate] = useAnimate();
  useEffect(() => {
    let live = true;
    (async () => {
      const $ = (s: string) => scope.current?.querySelector(s) as Element;
      await animate(scope.current, { opacity: [0, 1], y: [24, 0] }, { duration: 0.4, ease: ENTER });
      // 1. the folded letter slips into the pocket
      await animate($(".ll-e3-paper"), { y: ["-115%", "8%"] }, { duration: 0.55, ease: EASE });
      // 2. the flap swings shut (secondary: the shadow under it deepens)
      animate($(".ll-e3-shadow"), { opacity: [0, 0.5] }, { duration: 0.4, ease: EASE });
      await animate($(".ll-e3-flap"), { rotateX: [180, 0] }, { duration: 0.45, ease: EASE });
      // 3. the seal is pressed: lands a touch big, squashes, settles; a warm ring spreads (ambient)
      animate($(".ll-e3-ring"), { scale: [0.4, 2.4], opacity: [0.55, 0] }, { duration: 0.7, ease: ENTER });
      await animate($(".ll-e3-seal"), { scale: [1.9, 0.88, 1], opacity: [0, 1, 1], rotate: [-14, 3, 0] }, { duration: 0.42, ease: ENTER, times: [0, 0.6, 1] });
      await wait(260);
      // 4. anticipation, then away on an upward arc
      await animate(scope.current, { y: 6, scale: 0.98 }, { duration: 0.16, ease: EASE });
      await animate(scope.current, { x: [0, 60, 240], y: [6, -70, -150], rotate: [0, -6, 10], opacity: [1, 1, 0], scale: [0.98, 0.9, 0.7] },
        { duration: 0.6, ease: LEAVE, times: [0, 0.45, 1] });
      if (live) onDone();
    })();
    return () => { live = false; };
  }, [animate, scope, onDone]);

  return (
    <div className="ll-scene" aria-live="polite">
      <span className="sr-only">Sealing your letter to {letter.recipient}…</span>
      <div ref={scope} className="ll-e3" aria-hidden="true">
        <span className="ll-e3-back" />
        <span className="ll-e3-paper"><i /><i /><i /><i /></span>
        <span className="ll-e3-front"><span className="ll-e3-to">To {letter.recipient}</span></span>
        <span className="ll-e3-shadow" />
        <span className="ll-e3-flap" style={{ transform: "rotateX(180deg)" }} />
        <span className="ll-e3-ring" />
        <span className="ll-wax ll-e3-seal" style={{ opacity: 0 }}>{initial(name)}</span>
      </div>
    </div>
  );
}

/* ─── The shelves of envelopes ────────────────────────────────────────── */

/** An envelope: the name written across it, a postmark, and a wax seal with the writer's initial. */
function Envelope({ letter: l, me, now }: { letter: Letter; me: string; now: number | null }) {
  const mine = l.authorEmail === me;
  const sealed = l.sealed && !(now !== null && l.openAt && Date.parse(l.openAt) <= now);
  return (
    <span className={`ll-env${sealed ? " is-sealed" : ""}`}>
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
      <motion.ul className="ll-grid" layout>
        <AnimatePresence initial={false}>
          {letters.map((l, i) => {
            const sealed = l.sealed && !(now !== null && l.openAt && Date.parse(l.openAt) <= now);
            const mine = l.authorEmail === me;
            const tilt = i % 2 ? 0.8 : -0.8;
            return (
              <motion.li key={l.id} layout
                // Envelopes are dropped onto the table one after another, then settle at a slight angle.
                initial={{ opacity: 0, y: -22, rotate: tilt * -4, scale: 0.96 }}
                whileInView={{ opacity: 1, y: 0, rotate: tilt, scale: 1 }}
                viewport={{ once: true, amount: 0.4 }}
                exit={{ opacity: 0, scale: 0.9, y: 10, transition: { duration: 0.25, ease: LEAVE } }}
                transition={{ ...PAPER, delay: Math.min(i, 6) * 0.06, opacity: { duration: 0.35, ease: EASE, delay: Math.min(i, 6) * 0.06 } }}>
                <motion.button type="button" className="ll-card" onClick={() => onOpen(l)}
                  whileHover={{ y: -5, rotate: -tilt }} whileTap={{ scale: 0.98 }} transition={{ duration: 0.35, ease: EASE }}
                  aria-label={`${mine ? `Your letter to ${l.recipient}` : `Letter from ${l.authorName}`}${sealed ? ", still sealed" : ""}`}>
                  <Envelope letter={l} me={me} now={now} />
                  <span className="ll-card-meta">{now === null ? " " : sealed && l.openAt ? `Sealed until ${day(l.openAt)}` : `Sent ${day(l.createdAt)}`}</span>
                </motion.button>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </motion.ul>
    </div>
  );
}

/* ─── Opening and reading ─────────────────────────────────────────────── */

function Reading({ letter: l, mine, onDeleted }: { letter: Letter; mine: boolean; onDeleted: () => void }) {
  const [busy, setBusy] = useState(false);
  const reduce = useReducedMotion();
  const sealed = l.sealed || l.body === null;
  const [phase, setPhase] = useState<"envelope" | "letter">(sealed || reduce ? "letter" : "envelope");
  const toast = useToast();
  const remove = async () => {
    if (!window.confirm("Take this letter back? It will be gone for both of you.")) return;
    setBusy(true);
    const res = await fetch(`/api/letters?id=${encodeURIComponent(l.id)}`, { method: "DELETE" });
    setBusy(false);
    if (res.ok) { toast("Letter taken back"); onDeleted(); }
    else toast(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That did not work.");
  };
  const paragraphs = (l.body ?? "").split(/\n{2,}/);

  return (
    <div className="ll-read">
      {sealed ? (
        <div className="ll-sealed">
          <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0, rotate: [0, 0, -2, 2, -1, 0] }}
            transition={{ duration: 0.9, ease: EASE, times: [0, 0.45, 0.6, 0.75, 0.9, 1] }}>
            <Envelope letter={{ ...l, sealed: true }} me={mine ? l.authorEmail : ""} now={Date.now()} />
          </motion.div>
          <motion.p initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: ENTER, delay: 0.25 }}>
            This letter is sealed{l.openAt ? <> until <b>{day(l.openAt)}</b></> : ""}. Its words appear here the moment it opens.
          </motion.p>
        </div>
      ) : phase === "envelope" ? (
        <OpenScene letter={l} onOpened={() => setPhase("letter")} />
      ) : (
        <motion.article className="ll-paper is-reading"
          initial={reduce ? false : { opacity: 0, y: 30, scaleY: 0.55 }} animate={{ opacity: 1, y: 0, scaleY: 1 }}
          transition={{ ...PAPER, opacity: { duration: 0.3, ease: EASE } }} style={{ transformOrigin: "50% 0%" }}>
          <span className="ll-stamp" aria-hidden="true"><Heart /></span>
          <motion.p className="ll-date" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25, duration: 0.4 }}>{day(l.createdAt)}</motion.p>
          <motion.p className="ll-to" initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3, duration: 0.45, ease: ENTER }}>
            <span>My dearest {l.recipient},</span>
          </motion.p>
          <div className="ll-body">
            {paragraphs.map((p, i) => (
              <motion.p key={i} className="ll-para" initial={reduce ? false : { opacity: 0, y: 8, filter: "blur(3px)" }}
                animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} transition={{ delay: 0.42 + Math.min(i, 5) * 0.09, duration: 0.55, ease: ENTER }}>
                {p}
              </motion.p>
            ))}
          </div>
          <motion.p className="ll-sign" initial={reduce ? false : { opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + Math.min(paragraphs.length, 5) * 0.09, duration: 0.6, ease: ENTER }}>
            <span>{l.closing},</span><span className="ll-signature">{l.authorName}</span>
          </motion.p>
        </motion.article>
      )}
      {phase === "letter" && (mine ? (
        <motion.button type="button" className="btn btn-ghost ll-remove" onClick={remove} disabled={busy}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6, duration: 0.4 }}>
          <Trash2 aria-hidden="true" /> Take it back
        </motion.button>
      ) : !sealed && (
        <motion.p className="ll-from" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8, duration: 0.4 }}>
          <Feather aria-hidden="true" /> Written for you by {l.authorName}
        </motion.p>
      ))}
    </div>
  );
}

/**
 * Opening a letter (~1.6 s): the seal lifts away, the flap swings open toward you, and the letter
 * rises out of the envelope before unfolding into the full page. Tapping skips ahead.
 */
function OpenScene({ letter, onOpened }: { letter: Letter; onOpened: () => void }) {
  const [scope, animate] = useAnimate();
  const done = useRef(false);
  const finish = () => { if (!done.current) { done.current = true; onOpened(); } };
  useEffect(() => {
    let live = true;
    (async () => {
      const $ = (s: string) => scope.current?.querySelector(s) as Element;
      await animate(scope.current, { opacity: [0, 1], y: [20, 0], scale: [0.96, 1] }, { duration: 0.38, ease: ENTER });
      await animate($(".ll-e3-seal"), { y: -18, scale: 1.15, opacity: 0, rotate: 12 }, { duration: 0.3, ease: LEAVE });
      animate($(".ll-e3-shadow"), { opacity: 0 }, { duration: 0.3 });
      await animate($(".ll-e3-flap"), { rotateX: 180 }, { duration: 0.45, ease: EASE });
      animate($(".ll-e3-flap"), { zIndex: 0 }, { duration: 0 });
      await animate($(".ll-e3-paper"), { y: "-78%" }, { duration: 0.45, ease: ENTER });
      await wait(80);
      if (live) finish();
    })();
    return () => { live = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animate, scope]);

  return (
    <button type="button" className="ll-scene ll-scene-open" onClick={finish} aria-label="Open the letter">
      <div ref={scope} className="ll-e3">
        <span className="ll-e3-back" />
        <span className="ll-e3-paper" style={{ transform: "translateY(8%)" }}><i /><i /><i /><i /></span>
        <span className="ll-e3-front"><span className="ll-e3-to">For {letter.recipient}</span></span>
        <span className="ll-e3-shadow" style={{ opacity: 0.5 }} />
        <span className="ll-e3-flap" />
        <span className="ll-wax ll-e3-seal">{initial(letter.authorName)}</span>
      </div>
      <span className="ll-scene-hint">Tap to open</span>
    </button>
  );
}
