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
      <section className="login-card">
        <Link className="login-back" href="/">
          <span aria-hidden="true">←</span> Back to entrance
        </Link>
        <div className="login-mark">M</div>
        <p className="login-kicker">Welcome back</p>
        <h1>Enter your shared world.</h1>
        <p className="login-intro">
          Continue with the Google account invited to your private archive.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
