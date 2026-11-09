"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import BrandLogo from "@/components/brand-logo";
import { AsteriskMark } from "@/components/auth-form";
import { useT } from "@/lib/i18n";

// Email verification landing page (Nov 2026): confirms the link sent
// at signup. The token is verified once, on mount, against
// /api/auth/verify-email; an invalid or expired link offers a resend
// form instead of a dead end. A verified visitor signs in from the
// login form — no session is created here.
export default function VerifyEmailForm({ token }: { token: string }) {
  const t = useT();
  const [status, setStatus] = useState<"verifying" | "done" | "failed">("verifying");
  const [email, setEmail] = useState("");
  const [resendMessage, setResendMessage] = useState("");
  const [resendError, setResendError] = useState("");
  const [resending, setResending] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("failed");
      return;
    }
    let cancelled = false;
    fetch(`/api/auth/verify-email?token=${encodeURIComponent(token)}`)
      .then((response) => {
        if (!cancelled) setStatus(response.ok ? "done" : "failed");
      })
      .catch(() => {
        if (!cancelled) setStatus("failed");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleResend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResendMessage("");
    setResendError("");
    setResending(true);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not send the email right now.");
      if (!result.emailSent) throw new Error(t("auth", "verificationEmailNotSent"));
      setResendMessage(t("auth", "verificationResent"));
    } catch (submitError) {
      setResendError(submitError instanceof Error ? submitError.message : "Something went wrong.");
    } finally {
      setResending(false);
    }
  }

  return (
    <main className="auth-noir">
      <section className="auth-noir-left">
        <Link className="auth-noir-brand" href="/">
          <BrandLogo variant="horizontal" theme="dark" height={60} />
        </Link>
        <div className="auth-noir-star">
          <AsteriskMark />
        </div>
        <p className="auth-noir-copy">© 2026 Lakisa Studio. All rights reserved.</p>
      </section>

      <section className="auth-noir-panel">
        <Link className="auth-noir-switch-top" href="/login">
          Sign in
        </Link>
        <div className="auth-noir-form-wrap">
          <h1>{t("auth", "verifyEmailTitle")}</h1>
          {status === "verifying" && (
            <p className="auth-noir-hint" style={{ marginTop: 0 }} aria-live="polite">
              {t("auth", "verifying")}
            </p>
          )}
          {status === "done" && (
            <>
              <p className="auth-noir-hint" style={{ marginTop: 0 }}>
                {t("auth", "verifySuccess")}
              </p>
              <p className="auth-noir-switch">
                <Link href="/login">Sign in</Link>
              </p>
            </>
          )}
          {status === "failed" && (
            <>
              <p className="auth-noir-hint" style={{ marginTop: 0 }}>
                {t("auth", "verifyFailed")}
              </p>
              <form onSubmit={handleResend}>
                <div className="auth-noir-field">
                  <label htmlFor="verify-email">{t("auth", "verifyEmailLabel")}</label>
                  <div className="auth-noir-field-row">
                    <input
                      id="verify-email"
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
                {resendMessage && (
                  <p className="auth-noir-hint" style={{ marginTop: 0 }} role="status">
                    {resendMessage}
                  </p>
                )}
                {resendError && (
                  <p className="auth-noir-error" role="alert">
                    {resendError}
                  </p>
                )}
                <button type="submit" className="auth-noir-submit" disabled={resending}>
                  {resending ? "…" : "RESEND"}
                </button>
              </form>
            </>
          )}
        </div>
      </section>
    </main>
  );
}
