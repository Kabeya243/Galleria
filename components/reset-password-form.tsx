"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import { AsteriskMark } from "@/components/auth-form";

export default function ResetPasswordForm({ token }: { token: string }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError("The new passwords don't match.");
      return;
    }
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, newPassword }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not reset your password right now.");
      setDone(true);
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
          SANAA<sup>®</sup>
        </Link>
        <div className="auth-noir-star">
          <AsteriskMark />
        </div>
        <p className="auth-noir-copy">© 2026 SANAA Studio. All rights reserved.</p>
      </section>

      <section className="auth-noir-panel">
        <Link className="auth-noir-switch-top" href="/login">
          Sign in
        </Link>
        <div className="auth-noir-form-wrap">
          <h1>Choose a new password</h1>
          {!token ? (
            <p className="auth-noir-hint" style={{ marginTop: 0 }}>
              This reset link is incomplete.{" "}
              <Link href="/forgot-password">Request a new one</Link>.
            </p>
          ) : done ? (
            <>
              <p className="auth-noir-hint" style={{ marginTop: 0 }}>
                Your password has been changed.
              </p>
              <p className="auth-noir-switch">
                <Link href="/login">Sign in</Link>
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="auth-noir-field">
                <label htmlFor="reset-password">New password</label>
                <div className="auth-noir-field-row">
                  <input
                    id="reset-password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={10}
                    maxLength={72}
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    placeholder="At least 10 characters"
                  />
                </div>
              </div>
              <div className="auth-noir-field">
                <label htmlFor="reset-confirm">Confirm new password</label>
                <div className="auth-noir-field-row">
                  <input
                    id="reset-confirm"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={10}
                    maxLength={72}
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                  />
                </div>
              </div>
              <p className="auth-noir-hint">
                Use at least 10 characters, including an uppercase letter, a lowercase letter
                and a number.
              </p>
              {error && (
                <p className="auth-noir-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="auth-noir-submit" disabled={submitting}>
                {submitting ? "…" : "RESET"}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
