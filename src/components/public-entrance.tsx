"use client";

import Link from "next/link";
import { motion, useReducedMotion } from "motion/react";

export function PublicEntrance() {
  const reduceMotion = useReducedMotion();

  return (
    <main className="entrance">
      <section className="entrance-hero">
        <div className="entrance-image" role="img" aria-label="A quiet blue-hour horizon">
          <div className="entrance-image-wash" />
          <p className="entrance-image-note">A place for the days you keep</p>
        </div>
        <div className="entrance-panel">
          <motion.div
            className="entrance-copy"
            initial={reduceMotion ? false : { opacity: 0, y: 18 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="entrance-mark">M</div>
            <p className="entrance-kicker">A private world for two</p>
            <h1>
              Keep the
              <br />
              <em>good things.</em>
            </h1>
            <p className="entrance-description">
              Memories, letters, plans, and the ordinary moments that become yours.
            </p>
            <Link className="entrance-primary" href="/login">
              Enter MUMAA <span aria-hidden="true">↗</span>
            </Link>
          </motion.div>
          <div className="entrance-footer">
            <span>Shared exclusively by two people</span>
            <span>Est. 2026</span>
          </div>
        </div>
      </section>

      <section className="entrance-intro">
        <p className="entrance-intro-kicker">The archive begins here</p>
        <h2>A living record of the life you are making together.</h2>
        <div className="entrance-intro-rule" />
        <p>
          MUMAA gives the important things somewhere to stay. Enter your shared space to
          write, remember, plan, and leave something for later.
        </p>
      </section>
    </main>
  );
}
