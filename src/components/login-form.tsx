"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useState } from "react";

const errors: Record<string, string> = {
  "not-allowed": "That Google account isn’t invited. Only Anna and Joshua can enter.",
  configuration: "Google sign-in isn’t set up on this deployment yet.",
};

function GoogleMark() {
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z" />
      <path fill="#FF3D00" d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z" />
      <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2c-2 1.5-4.5 2.4-7.2 2.4-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z" />
      <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z" />
    </svg>
  );
}

export function LoginPage({ error }: { error?: string }) {
  const [busy, setBusy] = useState(false);
  const message = error ? errors[error] ?? "Sign-in didn’t finish. Please try again." : "";

  const item = (delay: number) => ({
    className: "enter",
    style: { "--d": `${delay}s` } as React.CSSProperties,
  });

  return (
    <main className="login">
      <figure className="login-visual" style={{ margin: 0 }}>
        <img src="/images/anna/anna-sunglasses.jpg" alt="Anna smiling in the sun" />
        <figcaption>Come back to what is <em>ours.</em></figcaption>
      </figure>

      <section className="login-panel">
        <div className="login-top">
          <Link className="wordmark" href="/">mumaa<b>.</b></Link>
          <Link className="text-link" href="/">
            <ArrowLeft aria-hidden="true" /> The story
          </Link>
        </div>

        <div className="login-body">
          <span {...item(0.3)} className="eyebrow enter">Private archive</span>
          <h1 {...item(0.4)} className="display enter">
            Welcome <em>home.</em>
          </h1>
          <p {...item(0.5)}>
            The letters, plans, little moments, and everything still being written are
            waiting for you.
          </p>
          {message && (
            <p className="notice" role="alert">{message}</p>
          )}
          <div {...item(0.6)}>
            <button
              className="btn btn-primary google-btn"
              disabled={busy}
              onClick={() => {
                setBusy(true);
                window.location.assign("/api/auth/google");
              }}
              type="button"
            >
              <span style={{ display: "grid", placeItems: "center", width: 26, height: 26, borderRadius: "50%", background: "#fff" }}>
                <GoogleMark />
              </span>
              {busy ? "Opening Google…" : "Continue with Google"}
            </button>
          </div>
          <p {...item(0.7)} className="login-note enter">
            Only the two Google accounts invited to MUMAA can enter.
          </p>
        </div>

        <span className="login-foot">for Anna &amp; Joshua</span>
      </section>
    </main>
  );
}
