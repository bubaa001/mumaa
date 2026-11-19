"use client";

import Link from "next/link";
import { AnimatePresence, motion, useInView, useReducedMotion, useScroll, useSpring, useTransform } from "motion/react";
import { ArrowRight, ArrowUpRight, Heart } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { Reveal, RevealGroup, RevealItem, ScrollWords } from "./motion";

const messages = [
  { from: "her", time: "01:30", text: "Joshua I love u mimi eeeiiii" },
  { from: "her", time: "01:31", text: "Nakupenda Nakupenda Nakupenda tena yah" },
  { from: "her", time: "01:32", text: "My biggest supporting system" },
  { from: "him", time: "01:34", text: "My happiness" },
] as const;

const words = ["Nakupenda", "My happiness", "Favourite person", "My home", "Support system", "Joshu wangu", "Till then"];

const lexicon = [
  ["Nakupenda", "Swahili · I love you", "The word that became our heartbeat, then became a promise."],
  ["Favourite person", "Two words", "They mean more than they should. My home."],
  ["Support system", "A statement of trust", "Someone to lean on when things get heavy."],
  ["Aim higher", "Her encouragement", "Love that pushes you toward your best."],
] as const;

const letters = [
  ["15 September 2025", "I’ll miss you.", "Distance was not the end of us."],
  ["16 September 2025", "I love you. Stay safe. Till then.", "A temporary goodbye, not a final one."],
  ["17 September 2025", "All the best.", "You can encourage me and make me laugh in the same breath."],
] as const;

export function PublicEntrance() {
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll();
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.3 });

  return (
    <main className="story">
      <motion.div aria-hidden="true" className="story-progress" style={{ scaleX: reduce ? 0 : progress }} />

      <nav className="story-nav" aria-label="MUMAA">
        <Link className="wordmark" href="/">mumaa<b>.</b></Link>
        <span className="story-nav-meta">Anna &amp; Joshua — a story in messages</span>
        <Link className="story-nav-enter" href="/login">
          Enter <ArrowUpRight aria-hidden="true" />
        </Link>
      </nav>

      <Hero />
      <Prologue />
      <Thread />
      <Language />
      <Letters />
      <Song />
      <Declaration />
      <Finale />
    </main>
  );
}

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const photoY = useTransform(scrollYProgress, [0, 1], ["0%", "18%"]);
  const photoScale = useTransform(scrollYProgress, [0, 1], [1.08, 1.18]);
  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "-30%"]);
  const fade = useTransform(scrollYProgress, [0, 0.7], [1, 0]);

  const line = (text: React.ReactNode, delay: number) => (
    <span className="hero-line">
      <span style={{ "--d": `${delay}s` } as React.CSSProperties}>{text}</span>
    </span>
  );

  return (
    <header className="hero" ref={ref}>
      <motion.div
        className="hero-photo"
        style={reduce ? undefined : { y: photoY, scale: photoScale }}
      >
        <img src="/images/anna/anna-profile.jpg" alt="" />
      </motion.div>

      <motion.div className="hero-inner" style={reduce ? undefined : { y: textY, opacity: fade }}>
        <h1 className="hero-names" aria-label="Anna and Joshua">
          {line("Anna", 0.2)}
          {line(<><span className="hero-amp">&amp;</span>Joshua</>, 0.34)}
        </h1>
        <div className="hero-foot enter" style={{ "--d": "0.9s" } as React.CSSProperties}>
          <p>
            An intimate account of us, told through the conversations that made our
            relationship what it is.
          </p>
          <span className="hero-scroll"><i aria-hidden="true" /> Scroll to read</span>
        </div>
      </motion.div>
    </header>
  );
}

function Prologue() {
  return (
    <section className="section">
      <div className="section-inner">
        <Reveal><span className="eyebrow">Prologue</span></Reveal>
        <ScrollWords
          className="prologue-text"
          text="A relationship isn’t made memorable by saying “I love you” a thousand times. It’s the teasing, the questions, the reassurance, and the promises around those words."
        />
        <Reveal className="prologue-aside">
          <p>
            This is another side of our story worth preserving. Not only how we fell in
            love, but how we kept finding ways to make each other feel loved.
          </p>
          <span className="eyebrow">One year of messages</span>
        </Reveal>
      </div>
    </section>
  );
}

function Thread() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.4 });
  const reduce = useReducedMotion();
  // Rendered complete on the server; replayed only if the thread starts below the fold.
  const [shown, setShown] = useState<number>(messages.length);
  const [armed, setArmed] = useState(false);
  const typing = armed && inView && shown < messages.length;

  useLayoutEffect(() => {
    if (reduce || !ref.current) return;
    if (ref.current.getBoundingClientRect().top > window.innerHeight * 0.6) {
      setShown(0);
      setArmed(true);
    }
  }, [reduce]);

  useEffect(() => {
    if (!armed || !inView || shown >= messages.length) return;
    const timer = window.setTimeout(() => setShown((count) => count + 1), shown === 0 ? 700 : 1100);
    return () => window.clearTimeout(timer);
  }, [armed, inView, shown]);

  return (
    <section className="section" style={{ background: "var(--paper-2)" }}>
      <div className="section-inner thread-layout">
        <div>
          <Reveal className="section-head" >
            <span className="chapter-no">Chapter 01 — Favourite person</span>
            <h2 className="display">How we became each other’s <em>favourite person.</em></h2>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="thread-note">
              Short messages are easy to overlook in a long chat history. These are the
              ones that deserve to be kept. Becoming someone’s favourite person isn’t
              about being perfect. It’s about feeling safe, supported, and loved.
            </p>
          </Reveal>
        </div>

        <div className="thread" ref={ref} aria-label="Messages between Anna and Joshua">
          <div className="thread-top">
            <img className="thread-avatar" src="/images/anna/anna-sunglasses.jpg" alt="" />
            <div>
              <strong>Anna</strong>
              <small>{typing ? "typing…" : "online"}</small>
            </div>
          </div>
          {messages.slice(0, shown).map((message, index) => (
            <motion.div
              key={index}
              initial={armed ? { opacity: 0, y: 12, scale: 0.92 } : false}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: "spring", stiffness: 380, damping: 26 }}
              style={{ display: "flex", flexDirection: "column" }}
            >
              <span className={`bubble-time ${message.from === "him" ? "bubble-time-him" : ""}`}>
                {message.from === "her" ? "Anna" : "Joshua"} · {message.time}
              </span>
              <div className={`bubble bubble-${message.from}`}>{message.text}</div>
            </motion.div>
          ))}
          <AnimatePresence>
            {typing && (
              <motion.div
                className="typing"
                aria-hidden="true"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                style={messages[shown]?.from === "him" ? { alignSelf: "flex-end" } : undefined}
              >
                <i /><i /><i />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </section>
  );
}

function Language() {
  const row = (reverse = false) => (
    <div className={`marquee ${reverse ? "marquee-reverse" : ""}`} aria-hidden="true">
      {[0, 1].map((copy) => (
        <div className="marquee-track" key={copy}>
          {(reverse ? [...words].reverse() : words).map((word) => (
            <span key={word} style={{ display: "contents" }}>
              <span>{word}</span>
              <b />
            </span>
          ))}
        </div>
      ))}
    </div>
  );

  return (
    <section className="section" style={{ paddingInline: 0 }}>
      <div className="section-inner" style={{ paddingInline: "var(--gutter)" }}>
        <Reveal className="section-head">
          <span className="chapter-no">Chapter 02 — Our language</span>
          <h2 className="display">A language only <em>we</em> speak.</h2>
        </Reveal>
      </div>
      {row()}
      {row(true)}
      <div className="section-inner" style={{ paddingInline: "var(--gutter)" }}>
        <RevealGroup className="lexicon">
          {lexicon.map(([word, kind, meaning], index) => (
            <RevealItem className="lexicon-row" key={word}>
              <small>0{index + 1}</small>
              <div>
                <h3>{word}</h3>
                <small>{kind}</small>
              </div>
              <p>{meaning}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>
    </section>
  );
}

function Letters() {
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end end"] });

  return (
    <section className="section">
      <div className="section-inner">
        <Reveal className="section-head">
          <span className="chapter-no">Chapter 03 — September</span>
          <h2 className="display">The goodbye that was only <em>“till then.”</em></h2>
        </Reveal>
        <div className="letters" ref={ref}>
          {letters.map(([date, quote, note], index) => (
            <Letter key={date} index={index} total={letters.length} progress={scrollYProgress} date={date} quote={quote} note={note} />
          ))}
        </div>
        <Reveal>
          <p className="letters-close">
            I’m not beside you right now, but I want you to know that <em className="serif-em">I am still here.</em>
          </p>
        </Reveal>
      </div>
    </section>
  );
}

function Letter({
  index,
  total,
  progress,
  date,
  quote,
  note,
}: {
  index: number;
  total: number;
  progress: ReturnType<typeof useScroll>["scrollYProgress"];
  date: string;
  quote: string;
  note: string;
}) {
  const reduce = useReducedMotion();
  const scale = useTransform(progress, [index / total, 1], [1, 1 - (total - index - 1) * 0.04]);
  return (
    <motion.article
      className="letter"
      style={{ ["--i" as string]: index, scale: reduce ? 1 : scale }}
    >
      <div className="letter-head">
        <span>{date}</span>
        <span className="letter-stamp" aria-hidden="true">{index + 15}</span>
      </div>
      <blockquote>{quote}</blockquote>
      <div className="letter-foot">
        <p>{note}</p>
        <span>always, bubaa.</span>
      </div>
    </motion.article>
  );
}

function Song() {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start end", "end start"] });
  const vinylX = useTransform(scrollYProgress, [0.1, 0.55], ["18%", "46%"]);

  return (
    <section className="section section-night">
      <div className="section-inner song" ref={ref}>
        <div className="vinyl-wrap" aria-hidden="true">
          <motion.div className="vinyl-slide" style={{ x: reduce ? "40%" : vinylX }}>
            <div className="vinyl" />
          </motion.div>
          <div className="vinyl-sleeve"><span>Those Eyes</span></div>
        </div>
        <Reveal className="song-copy">
          <span className="chapter-no">Chapter 04 — On repeat</span>
          <strong>Those Eyes</strong>
          <span className="song-artist">New West</span>
          <div className="eq" aria-hidden="true"><i /><i /><i /><i /><i /></div>
          <p>“When I listen to it I just imagine you. You appear in my mind.”</p>
        </Reveal>
      </div>
    </section>
  );
}

function Declaration() {
  return (
    <section className="section section-night declaration" style={{ borderTop: "1px solid var(--night-line)" }}>
      <Reveal>
        <span className="declaration-time">04:13 AM</span>
        <blockquote>
          “So you’re my own heavenly piece, and my home too. <em>I love you, Anna.</em>”
        </blockquote>
        <cite>— Joshua</cite>
      </Reveal>
    </section>
  );
}

function Finale() {
  const reduce = useReducedMotion();
  return (
    <>
      <section className="section finale" id="finale">
        <div className="section-inner">
          <Reveal><span className="eyebrow">The last page, for now</span></Reveal>
          <ScrollWords
            className="finale-copy"
            text="And if everything were deleted tomorrow, every message, screenshot, and clever little line, I would still want you in the room when I rebuild it."
          />
          <Reveal>
            <motion.span
              className="heart"
              aria-hidden="true"
              animate={reduce ? undefined : { scale: [1, 1.16, 1, 1.1, 1] }}
              transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 0.6, ease: "easeInOut" }}
            >
              <Heart fill="currentColor" strokeWidth={0} width="100%" height="100%" />
            </motion.span>
            <p className="finale-sign">Joshua</p>
            <p className="finale-sub">for Anna. always.</p>
            <Link className="btn btn-primary btn-lg" href="/login">
              Enter our private world <ArrowRight aria-hidden="true" />
            </Link>
          </Reveal>
        </div>
      </section>
      <footer className="story-footer">
        <span>mumaa — a private world for two</span>
        <span>Made for Anna</span>
      </footer>
    </>
  );
}
