"use client";

import Link from "next/link";
import { useState } from "react";

export function LoginForm() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function signInWithGoogle() {
    setError("");

    setBusy(true);
    window.location.assign("/api/auth/google");
  }

  return (
    <div className="login-form">
      {error && <p className="login-message login-error" role="alert">{error}</p>}
      <button
        aria-label="Continue with Google"
        className="login-submit"
        disabled={busy}
        onClick={signInWithGoogle}
        type="button"
      >
        <span aria-hidden="true" className="google-mark">G</span>
        {busy ? "Opening Google..." : "Continue with Google"}
      </button>
      <p className="login-note">
        Use the Google account invited to MUMAA. Only Joshua and Anna can enter.
      </p>
    </div>
  );
}

export function LoginPage() {
  return (
    <main className="login-page">
      <div className="login-atmosphere" aria-hidden="true" />
      <div className="login-grain" aria-hidden="true" />
      <header className="login-nav">
        <Link className="login-wordmark" href="/">
          <img className="mumaa-logo mumaa-logo-login-nav" src="/images/mumaa-logo.png" alt="Mumaa" />
          <span className="login-wordmark-name">Anna &amp; Joshua</span>
        </Link>
        <span className="login-nav-note">Private archive</span>
      </header>
      <section className="login-card">
        <Link className="login-back" href="/">
          <span aria-hidden="true">↖</span> Return to the story
        </Link>
        <div className="login-layout">
          <div className="login-story-copy">
            <p className="login-kicker">The next page</p>
            <h1>Come back to what is <em>ours.</em></h1>
            <p className="login-intro">
              Your private archive is waiting. The letters, plans, little moments,
              and everything still being written.
            </p>
            <p className="login-signature">for Anna &amp; Joshua</p>
          </div>
          <div className="login-access">
            <img className="mumaa-logo mumaa-logo-login-access" src="/images/mumaa-logo.png" alt="Mumaa" />
            <p className="login-access-label">Private access</p>
            <h2>Enter the archive.</h2>
            <LoginForm />
          </div>
        </div>
      </section>
    </main>
  );
}
