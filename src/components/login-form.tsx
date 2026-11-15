"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type FormMode = "password" | "magic";

export function LoginForm() {
  const [mode, setMode] = useState<FormMode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("");
    setError("");

    if (!email.trim()) {
      setError("Enter your email address.");
      return;
    }

    if (!isSupabaseConfigured()) {
      setError("Sign in is not configured yet. Add the Supabase public variables to continue.");
      return;
    }

    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    const result =
      mode === "password"
        ? await supabase.auth.signInWithPassword({ email: email.trim(), password })
        : await supabase.auth.signInWithOtp({
            email: email.trim(),
            options: {
              emailRedirectTo: `${window.location.origin}/auth/callback`,
            },
          });

    if (result.error) {
      setError("We could not sign you in with those details.");
    } else if (mode === "magic") {
      setStatus("Check your email for a secure sign-in link.");
    } else {
      window.location.assign("/home");
    }
    setBusy(false);
  }

  async function recoverPassword() {
    setStatus("");
    setError("");
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }
    if (!isSupabaseConfigured()) {
      setError("Password recovery is not configured yet.");
      return;
    }

    setBusy(true);
    const { error: recoveryError } = await createSupabaseBrowserClient().auth.resetPasswordForEmail(
      email.trim(),
      { redirectTo: `${window.location.origin}/auth/update-password` },
    );
    setBusy(false);
    if (recoveryError) setError("We could not send a recovery email.");
    else setStatus("If that address is approved, a recovery link is on its way.");
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <div className="login-mode" aria-label="Sign-in method">
        <button
          className={mode === "password" ? "login-mode-active" : ""}
          onClick={() => setMode("password")}
          type="button"
        >
          Password
        </button>
        <button
          className={mode === "magic" ? "login-mode-active" : ""}
          onClick={() => setMode("magic")}
          type="button"
        >
          Magic link
        </button>
      </div>

      <label htmlFor="email">Email address</label>
      <input
        autoComplete="email"
        id="email"
        onChange={(event) => setEmail(event.target.value)}
        placeholder="you@example.com"
        required
        type="email"
        value={email}
      />

      {mode === "password" && (
        <>
          <div className="login-label-row">
            <label htmlFor="password">Password</label>
            <button className="login-link" onClick={recoverPassword} type="button">
              Forgot password?
            </button>
          </div>
          <div className="password-field">
            <input
              autoComplete="current-password"
              id="password"
              minLength={8}
              onChange={(event) => setPassword(event.target.value)}
              required
              type={showPassword ? "text" : "password"}
              value={password}
            />
            <button
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="password-toggle"
              onClick={() => setShowPassword((visible) => !visible)}
              type="button"
            >
              {showPassword ? "Hide" : "Show"}
            </button>
          </div>
        </>
      )}

      {error && <p className="login-message login-error" role="alert">{error}</p>}
      {status && <p className="login-message login-success" role="status">{status}</p>}

      <button className="login-submit" disabled={busy} type="submit">
        {busy ? "Opening..." : mode === "password" ? "Sign in" : "Send magic link"}
      </button>
      <p className="login-note">Only the two invited members can enter MUMAA.</p>
    </form>
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
          Sign in to the private archive you are building together.
        </p>
        <LoginForm />
      </section>
    </main>
  );
}
