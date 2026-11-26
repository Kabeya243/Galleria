"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import BrandLogo from "@/components/brand-logo";
import LanguageSwitcher from "@/components/language-switcher";
import { useT } from "@/lib/i18n";
import { USER_ROLES, passwordChecks } from "@/lib/validation";

// Display labels for the signup "Your role" select: the option values
// stay the English enum from lib/validation.ts (the server validates
// them), only the label is translated.
const ROLE_LABEL_KEYS = {
  Artist: "roleArtist",
  Curator: "roleCurator",
  Gallery: "roleGallery",
  Collector: "roleCollector",
  "Art Advisor": "roleArtAdvisor",
  Institution: "roleInstitution",
  Other: "roleOther",
} as const;

// "Continue with Google" (feature 9): a plain link to the OAuth start —
// Google handles the sign-in, the callback signs the visitor in here.
// The button is the same on login and register: Google creates the
// account on first use.
function GoogleButton() {
  const t = useT();
  return (
    <a className="auth-noir-google" href="/api/auth/google">
      <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <path
          fill="#4285F4"
          d="M23.5 12.3c0-.9-.1-1.5-.3-2.2H12v4.3h6.5c-.1 1.1-.8 2.7-2.4 3.8l3.7 2.9c2.2-2.1 3.7-5.1 3.7-8.8z"
        />
        <path
          fill="#34A853"
          d="M12 24c3.2 0 5.9-1.1 7.9-2.9l-3.7-2.9c-1 .7-2.4 1.2-4.2 1.2-3.2 0-5.9-2.1-6.8-5.1L1.3 17.2C3.3 21.2 7.3 24 12 24z"
        />
        <path
          fill="#FBBC05"
          d="M5.2 14.3c-.2-.7-.4-1.5-.4-2.3s.1-1.6.4-2.3L1.3 6.8C.5 8.4 0 10.1 0 12s.5 3.6 1.3 5.2l3.9-2.9z"
        />
        <path
          fill="#EA4335"
          d="M12 4.7c1.8 0 3 .8 3.7 1.4l3.3-3.2C17.9 1.1 15.2 0 12 0 7.3 0 3.3 2.8 1.3 6.8l3.9 2.9c.9-2.9 3.6-5 6.8-5z"
        />
      </svg>
      {t("auth", "continueWithGoogle")}
    </a>
  );
}

export default function AuthForm({
  mode,
  initialReferralCode,
}: {
  mode: "login" | "register";
  // Prefilled from /register?ref=CODE when the visitor follows a
  // referral link (Nov 2026).
  initialReferralCode?: string;
}) {
  const t = useT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [country, setCountry] = useState("");
  // Optional referral code (Nov 2026): the code of the account that
  // invited this visitor. An unknown code is ignored by the server.
  const [referralCode, setReferralCode] = useState(initialReferralCode ?? "");
  // Mandatory since Nov 2026: the visitor must tick "I agree to the
  // Terms of Use and Privacy Policy" — the submit button stays
  // disabled until then, and the server rejects the call anyway.
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // After signup: no session is created — the visitor must verify
  // their email first, so the form becomes a "check your inbox"
  // screen (emailSent false = SMTP not configured: the support
  // message is shown instead, and a resend can be tried).
  const [registered, setRegistered] = useState<{ email: string; emailSent: boolean } | null>(null);
  // After a sign-in refused for an unverified email: the form offers
  // a resend link instead of a dead end.
  const [needsVerification, setNeedsVerification] = useState<string | null>(null);
  const [resendMessage, setResendMessage] = useState("");
  const [resending, setResending] = useState(false);
  const isRegister = mode === "register";
  // Live password checklist (feature 9): each rule ticks off as the
  // visitor types, using the same rules as the server schema.
  const checks = passwordChecks(password);
  const checklist = [
    { ok: checks.length, label: t("auth", "ruleLength") },
    { ok: checks.lowercase, label: t("auth", "ruleLower") },
    { ok: checks.uppercase, label: t("auth", "ruleUpper") },
    { ok: checks.number, label: t("auth", "ruleNumber") },
  ];

  async function handleResendVerification(targetEmail: string) {
    setResendMessage("");
    setError("");
    setResending(true);
    try {
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: targetEmail }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? t("auth", "couldNotSendEmail"));
      if (!result.emailSent) throw new Error(t("auth", "verificationEmailNotSent"));
      setResendMessage(t("auth", "verificationResent"));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("auth", "somethingWrong"));
    } finally {
      setResending(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setResendMessage("");
    if (isRegister && !acceptTerms) {
      setError(t("auth", "acceptTermsRequired"));
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isRegister
            ? {
                name,
                email,
                password,
                acceptTerms,
                role: role || undefined,
                country: country || undefined,
                referralCode: referralCode.trim() ? referralCode.trim().toUpperCase() : undefined,
              }
            : { email, password, rememberMe },
        ),
      });
      const result = await response.json();
      if (!response.ok) {
        if (result.emailNotVerified) {
          setNeedsVerification(result.email ?? email);
        }
        throw new Error(
          result.error ??
            (isRegister ? t("auth", "couldNotCreateAccount") : t("auth", "couldNotSignIn")),
        );
      }
      if (isRegister) {
        // No session is created at signup: the visitor verifies their
        // email first (see /verify-email). The link itself is only
        // ever sent by email — never shown here.
        setRegistered({ email, emailSent: result.verificationEmailSent === true });
        setSubmitting(false);
        return;
      }
      window.location.assign("/");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : t("auth", "somethingWrong"));
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
        <Link className="auth-noir-switch-top" href={isRegister ? "/login" : "/register"}>
          {isRegister ? t("auth", "signIn") : t("auth", "createAccount")}
        </Link>
        <div className="auth-noir-form-wrap">
          <div style={{ display: "flex", justifyContent: "flex-start", marginBottom: 24 }}>
            <LanguageSwitcher />
          </div>
          <h1>{isRegister ? t("auth", "createAccount") : t("auth", "login")}</h1>
          {registered ? (
            <>
              <p className="auth-noir-hint" style={{ marginTop: 0 }}>
                {registered.emailSent ? (
                  <>
                    <strong>{t("auth", "checkInboxTitle")}</strong>: {t("auth", "checkInbox")} (
                    {registered.email})
                  </>
                ) : (
                  <>{t("auth", "verificationEmailNotSent")}</>
                )}
              </p>
              <p className="auth-noir-hint" style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className="auth-noir-link-button"
                  onClick={() => handleResendVerification(registered.email)}
                  disabled={resending}
                >
                  {t("auth", "resendVerification")}
                </button>
              </p>
              {resendMessage && (
                <p className="auth-noir-hint" style={{ marginTop: 0 }} role="status">
                  {resendMessage}
                </p>
              )}
              {error && (
                <p className="auth-noir-error" role="alert">
                  {error}
                </p>
              )}
              <p className="auth-noir-switch">
                <Link href="/login">{t("auth", "signIn")}</Link>
              </p>
            </>
          ) : (
            <>
              <GoogleButton />
              <div className="auth-noir-divider" aria-hidden="true">
                <span>{t("auth", "or")}</span>
              </div>
              <form onSubmit={handleSubmit}>
            {isRegister && (
              <div className="auth-noir-field">
                <label htmlFor="auth-name">{t("auth", "yourName")}</label>
                <div className="auth-noir-field-row">
                  <input
                    id="auth-name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={60}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder={t("auth", "namePlaceholder")}
                  />
                </div>
              </div>
            )}
            {isRegister && (
              <div className="auth-noir-field">
                <label htmlFor="auth-role">{t("auth", "yourRole")}</label>
                <div className="auth-noir-field-row">
                  <select
                    id="auth-role"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    aria-label={t("auth", "roleAria")}
                  >
                    <option value="">{t("auth", "chooseRole")}</option>
                    {USER_ROLES.map((item) => (
                      <option key={item} value={item}>
                        {t("auth", ROLE_LABEL_KEYS[item])}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            {isRegister && (
              <div className="auth-noir-field">
                <label htmlFor="auth-country">{t("auth", "country")}</label>
                <div className="auth-noir-field-row">
                  <input
                    id="auth-country"
                    autoComplete="country-name"
                    maxLength={80}
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    placeholder={t("auth", "countryPlaceholder")}
                    list="auth-country-list"
                  />
                  <datalist id="auth-country-list">
                    {[
                      "Uganda",
                      "Kenya",
                      "Senegal",
                      "DR Congo",
                      "Nigeria",
                      "Ghana",
                      "South Africa",
                      "Rwanda",
                      "Tanzania",
                      "Ethiopia",
                      "France",
                      "Belgium",
                      "United Kingdom",
                      "United States",
                      "Canada",
                      "Germany",
                      "Netherlands",
                      "Spain",
                      "Italy",
                      "United Arab Emirates",
                    ].map((item) => (
                      <option key={item} value={item} />
                    ))}
                  </datalist>
                </div>
              </div>
            )}
            {isRegister && (
              <div className="auth-noir-field">
                <label htmlFor="auth-referral">{t("pricing", "referralCodePlaceholder")}</label>
                <div className="auth-noir-field-row">
                  <input
                    id="auth-referral"
                    autoComplete="off"
                    maxLength={20}
                    value={referralCode}
                    onChange={(event) => setReferralCode(event.target.value.toUpperCase())}
                    placeholder={t("pricing", "referralCodePlaceholder")}
                  />
                </div>
              </div>
            )}
            <div className="auth-noir-field">
              <label htmlFor="auth-email">{t("auth", "email")}</label>
              <div className="auth-noir-field-row">
                <input
                  id="auth-email"
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
            <div className="auth-noir-field">
              <label htmlFor="auth-password">{t("auth", "password")}</label>
              <div className="auth-noir-field-row">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  autoComplete={isRegister ? "new-password" : "current-password"}
                  required
                  minLength={10}
                  maxLength={72}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder={isRegister ? t("auth", "ruleLength") : t("auth", "passwordPlaceholder")}
                />
                <button
                  type="button"
                  className="auth-noir-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? t("auth", "hidePassword") : t("auth", "showPassword")}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>
            {isRegister && password.length > 0 && (
              <ul className="auth-noir-checklist" aria-live="polite">
                {checklist.map((item) => (
                  <li key={item.label} className={item.ok ? "auth-noir-check-ok" : ""}>
                    <span aria-hidden="true">{item.ok ? "✓" : "○"}</span> {item.label}
                  </li>
                ))}
              </ul>
            )}
            {isRegister && password.length === 0 && (
              <p className="auth-noir-hint">{t("auth", "passwordHint")}</p>
            )}
            {!isRegister && (
              <div className="auth-noir-row">
                <label className="auth-noir-remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  {t("auth", "rememberMe")}
                </label>
                <Link className="auth-noir-forgot" href="/forgot-password">
                  {t("auth", "forgot")}
                </Link>
              </div>
            )}
            {isRegister && (
              <div className="auth-noir-row auth-noir-terms-check">
                <label className="auth-noir-remember">
                  <input
                    type="checkbox"
                    checked={acceptTerms}
                    onChange={(event) => setAcceptTerms(event.target.checked)}
                    required
                  />
                  <span>
                    {t("auth", "agreeTermsPrefix")}
                    <Link href="/terms">{t("footer", "terms")}</Link>
                    {t("auth", "agreeTermsAnd")}
                    <Link href="/privacy">{t("footer", "privacy")}</Link>
                    {t("auth", "agreeTermsSuffix")}
                  </span>
                </label>
              </div>
            )}
            {error && (
              <p className="auth-noir-error" role="alert">
                {error}
              </p>
            )}
            {needsVerification && (
              <p className="auth-noir-hint" style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className="auth-noir-link-button"
                  onClick={() => handleResendVerification(needsVerification)}
                  disabled={resending}
                >
                  {t("auth", "resendVerification")}
                </button>
              </p>
            )}
            {resendMessage && (
              <p className="auth-noir-hint" style={{ marginTop: 0 }} role="status">
                {resendMessage}
              </p>
            )}
            <button
              type="submit"
              className="auth-noir-submit"
              disabled={submitting || (isRegister && !acceptTerms)}
            >
              {submitting ? "…" : isRegister ? t("auth", "signUp") : t("auth", "signInBtn")}
            </button>
          </form>
            </>
          )}
          <p className="auth-noir-switch">
            {isRegister ? t("auth", "alreadyHave") : t("auth", "newToSanaa")}{" "}
            <Link href={isRegister ? "/login" : "/register"}>
              {isRegister ? t("auth", "signIn") : t("auth", "createAccount")}
            </Link>
          </p>
          <p className="auth-noir-terms">{t("auth", "terms")}</p>
        </div>
      </section>
    </main>
  );
}
