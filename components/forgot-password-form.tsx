"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import BrandLogo from "@/components/brand-logo";
import { useT } from "@/lib/i18n";

export default function ForgotPasswordForm() {
  const t = useT();
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
      if (!response.ok) throw new Error(result.error ?? t("auth", "forgotPasswordCouldNotProcess"));
      setSent(true);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("auth", "somethingWrong"));
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
        <p className="auth-noir-copy">{t("auth", "rights")}</p>
      </section>

      <section className="auth-noir-panel">
        <Link className="auth-noir-switch-top" href="/login">
          {t("auth", "signIn")}
        </Link>
        <div className="auth-noir-form-wrap">
          <h1>{t("auth", "forgotPasswordTitle")}</h1>
          {sent ? (
            <>
              <p className="auth-noir-hint" style={{ marginTop: 0 }}>
                {t("auth", "forgotPasswordSent").replace("{email}", email)}
              </p>
              <p className="auth-noir-switch">
                <Link href="/login">{t("auth", "forgotPasswordBackToSignIn")}</Link>
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <p className="auth-noir-hint" style={{ marginTop: 0 }}>
                {t("auth", "forgotPasswordHint")}
              </p>
              <div className="auth-noir-field">
                <label htmlFor="forgot-email">{t("auth", "email")}</label>
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
                {submitting ? "…" : t("auth", "forgotPasswordSend")}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
