"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

const reveal = {
  hidden: { opacity: 0, y: 28, filter: "blur(7px)" },
  visible: { opacity: 1, y: 0, filter: "blur(0px)" },
};

function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? false : reveal.hidden}
      whileInView={reduceMotion ? undefined : reveal.visible}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.85, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

export function PublicEntrance() {
  return (
    <main className="story-page">
      <nav className="story-nav" aria-label="MUMAA">
        <div className="story-nav-inner">
          <span className="story-live" aria-hidden="true" />
          <span>Anna &amp; Joshua</span>
          <span className="story-nav-separator">/</span>
          <a href="#finale">open</a>
        </div>
      </nav>

      <section className="story-hero" id="hero">
        <div className="story-hero-glow" aria-hidden="true" />
        <div className="story-hero-names" aria-label="Anna and Joshua">
          <span>Anna</span>
          <i>&amp;</i>
          <span>Joshua</span>
        </div>
        <div className="story-hero-copy">
          <p>
            An intimate account of Anna and Joshua, told through the conversations
            that made their relationship what it is.
          </p>
          <span className="story-hero-line" aria-hidden="true" />
        </div>
      </section>

      <section className="story-prologue story-container">
        <Reveal>
          <span className="story-chapter">Prologue</span>
          <p className="story-lead">
            A relationship is not made memorable by saying “I love you” a thousand
            times. It becomes memorable through the little things around those words:
            teasing, questions, reassurance, and promises that make two people feel
            less alone.
          </p>
          <p className="story-body">
            This is another side of our story worth preserving. Not only how we fell
            in love, but how we kept finding ways to make each other feel loved.
          </p>
          <p className="story-meta">One year of messages / read from the beginning</p>
        </Reveal>
      </section>

      <section className="story-section story-container">
        <Reveal>
          <span className="story-chapter">Chapter 01 / Favourite person</span>
          <h2>The way we became each other&apos;s <em>favourite person.</em></h2>
        </Reveal>
        <div className="story-messages">
          <Reveal className="story-message story-message-her">
            <small>Anna / 01:30 AM</small>
            Joshua I love u mimi eeeiiii
          </Reveal>
          <Reveal className="story-message story-message-her">
            <small>Anna / 01:31 AM</small>
            Nakupenda Nakupenda Nakupenda tena yah
          </Reveal>
          <Reveal className="story-message story-message-her">
            <small>Anna / 01:32 AM</small>
            My biggest supporting system
          </Reveal>
          <Reveal className="story-message story-message-him">
            <small>Joshua / 01:34 AM</small>
            My happiness
          </Reveal>
        </div>
        <Reveal className="story-note">
          It is easy to overlook short messages in a long chat history. These are the
          messages that deserve to be kept. Becoming someone&apos;s favourite person is
          not about being perfect. It is about feeling safe, supported, and loved.
        </Reveal>
      </section>

      <section className="story-section story-container story-vocabulary">
        <Reveal>
          <span className="story-chapter">Chapter 02 / Our language</span>
          <h2>Our own <em>language</em> of love.</h2>
        </Reveal>
        <div className="story-words" aria-label="Words from our conversations">
          <span>Nakupenda</span>
          <span className="story-word-accent">My happiness</span>
          <span>Favourite person</span>
          <span className="story-word-accent">My home</span>
          <span>Support system</span>
          <span className="story-word-accent">Joshu wangu</span>
        </div>
        <div className="story-vocabulary-grid">
          {[
            ["Nakupenda", "The word that became our heartbeat and then became a promise."],
            ["Favourite person", "Two words that mean more than they should. My home."],
            ["Support system", "A statement of trust. Someone to lean on when things get heavy."],
            ["Aim higher", "Her encouragement. Love that pushes you toward your best."],
          ].map(([title, body]) => (
            <Reveal className="story-vocabulary-item" key={title}>
              <h3>{title}</h3>
              <p>{body}</p>
            </Reveal>
          ))}
        </div>
      </section>

      <section className="story-section story-letters">
        <div className="story-container">
          <Reveal>
            <span className="story-chapter">Chapter 03 / September</span>
            <h2>The goodbye that was only <em>“till then.”</em></h2>
          </Reveal>
          <div className="story-letter-stack">
            {[
              ["15 September 2025", "I’ll miss you.", "Distance was not the end of us."],
              ["16 September 2025", "I love you. Stay safe. Till then.", "A temporary goodbye, not a final one."],
              ["17 September 2025", "All the best.", "You can encourage me and make me laugh in the same breath."],
            ].map(([date, quote, note]) => (
              <Reveal className="story-letter" key={date}>
                <small>{date}</small>
                <blockquote>{quote}</blockquote>
                <p>{note}</p>
                <span>always, bubaa.</span>
              </Reveal>
            ))}
          </div>
          <Reveal className="story-body story-letter-close">
            I am not beside you right now, but I want you to know that I am still
            here.
          </Reveal>
        </div>
      </section>

      <section className="story-section story-container">
        <Reveal>
          <span className="story-chapter">Chapter 04 / The song</span>
          <h2>The song that became <em>you.</em></h2>
        </Reveal>
        <Reveal className="story-song">
          <small>Now playing / on repeat</small>
          <strong>Those Eyes</strong>
          <i>New West</i>
          <p>“When I listen to it I just imagine you. You appear in my mind.”</p>
        </Reveal>
      </section>

      <section className="story-declaration">
        <Reveal>
          <span className="story-chapter">Chapter 05 / 04:13</span>
          <p>“So you&apos;re my own heavenly piece, and my home too. I love you, Anna.”</p>
          <small>Joshua</small>
        </Reveal>
      </section>

      <section className="story-finale story-container" id="finale">
        <Reveal>
          <span className="story-chapter">The last page / for now</span>
          <p className="story-finale-copy">
            And if everything were deleted tomorrow, every message, screenshot, and
            clever little line, I would still want you in the room when I rebuild it.
          </p>
          <div className="story-heart" aria-hidden="true">♥</div>
          <p className="story-signature">Joshua</p>
          <p className="story-signature-note">for Anna. always.</p>
          <Link className="story-enter" href="/login">Enter the private archive <span>↗</span></Link>
        </Reveal>
      </section>
    </main>
  );
}
