"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import BrandLogo from "@/components/brand-logo";

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/forgot-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not process the request right now.");
      setSent(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-noir">
      <section className="auth-noir-left">
        <Link className="auth-noir-brand" href="/">
          <BrandLogo variant="horizontal" theme="dark" height={60} />
        </Link>
        <div className="auth-noir-mark">
          <BrandLogo variant="principal" theme="dark" />
        </div>
        <p className="auth-noir-copy">© 2026 Lakisa Studio. All rights reserved.</p>
      </section>

      <section className="auth-noir-panel">
        <Link className="auth-noir-switch-top" href="/login">
          Sign in
        </Link>
        <div className="auth-noir-form-wrap">
          <h1>Reset your password</h1>
          {sent ? (
            <>
              <p className="auth-noir-hint" style={{ marginTop: 0 }}>
                Check your inbox. If an account exists for {email}, a reset link is on its way.
                It expires in 1 hour.
              </p>
              <p className="auth-noir-switch">
                <Link href="/login">Back to sign in</Link>
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="auth-noir-hint" style={{ marginTop: 0 }}>
                Enter the email address of your account. If it exists, we&apos;ll send you a
                reset link.
              </p>
              <div className="auth-noir-field">
                <label htmlFor="forgot-email">Email</label>
                <div className="auth-noir-field-row">
                  <input
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    required
                    maxLength={254}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="you@example.com"
                  />
                </div>
              </div>
              {error && (
                <p className="auth-noir-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="auth-noir-submit" disabled={submitting}>
                {submitting ? "…" : "SEND"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
