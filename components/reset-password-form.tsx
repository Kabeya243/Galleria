"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";
import BrandLogo from "@/components/brand-logo";
import { useT } from "@/lib/i18n";

export default function ResetPasswordForm({ token }: { token: string }) {
  const t = useT();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword !== confirmPassword) {
      setError(t("auth", "resetPasswordMismatch"));
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
      if (!response.ok) throw new Error(result.error ?? t("auth", "resetPasswordCouldNotReset"));
      setDone(true);
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
          <h1>{t("auth", "resetPasswordTitle")}</h1>
          {!token ? (
            <p className="auth-noir-hint" style={{ marginTop: 0 }}>
              {t("auth", "resetPasswordLinkIncomplete")}{" "}
              <Link href="/forgot-password">{t("auth", "resetPasswordRequestNew")}</Link>.
            </p>
          ) : done ? (
            <>
              <p className="auth-noir-hint" style={{ marginTop: 0 }}>
                {t("auth", "resetPasswordChanged")}
              </p>
              <p className="auth-noir-switch">
                <Link href="/login">{t("auth", "signIn")}</Link>
              </p>
            </>
          ) : (
            <form onSubmit={handleSubmit}>
              <div className="auth-noir-field">
                <label htmlFor="reset-password">{t("auth", "resetPasswordNewPassword")}</label>
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
                    placeholder={t("auth", "ruleLength")}
                  />
                </div>
              </div>
              <div className="auth-noir-field">
                <label htmlFor="reset-confirm">{t("auth", "resetPasswordConfirmPassword")}</label>
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
              <p className="auth-noir-hint">{t("auth", "passwordHint")}</p>
              {error && (
                <p className="auth-noir-error" role="alert">
                  {error}
                </p>
              )}
              <button type="submit" className="auth-noir-submit" disabled={submitting}>
                {submitting ? "…" : t("auth", "resetPasswordReset")}
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  );
}
