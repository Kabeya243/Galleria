"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import BrandLogo from "@/components/brand-logo";
import { useT } from "@/lib/i18n";
import { USER_ROLES, passwordChecks } from "@/lib/validation";

// "Continue with Google" (feature 9): a plain link to the OAuth start —
// Google handles the sign-in, the callback signs the visitor in here.
// The button is the same on login and register: Google creates the
// account on first use.
function GoogleButton() {
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
      Continue with Google
    </a>
  );
}

export function AsteriskMark() {
  return (
    <svg viewBox="0 0 200 200" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="9" strokeLinecap="square">
        <line x1="100" y1="8" x2="100" y2="192" />
        <line x1="8" y1="100" x2="192" y2="100" />
        <line x1="35" y1="35" x2="165" y2="165" />
        <line x1="165" y1="35" x2="35" y2="165" />
      </g>
    </svg>
  );
}

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const t = useT();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [country, setCountry] = useState("");
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
    { ok: checks.length, label: "At least 10 characters" },
    { ok: checks.lowercase, label: "A lowercase letter" },
    { ok: checks.uppercase, label: "An uppercase letter" },
    { ok: checks.number, label: "A number" },
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
      if (!response.ok) throw new Error(result.error ?? "Could not send the email right now.");
      if (!result.emailSent) throw new Error(t("auth", "verificationEmailNotSent"));
      setResendMessage(t("auth", "verificationResent"));
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
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
            ? { name, email, password, acceptTerms, role: role || undefined, country: country || undefined }
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
            (isRegister ? "Could not create your account right now." : "Could not sign in right now."),
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
      setError(submitError instanceof Error ? submitError.message : "Something went wrong.");
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-noir">
      <section className="auth-noir-left">
        <Link className="auth-noir-brand" href="/">
          <BrandLogo variant="horizontal" theme="dark" height={44} />
        </Link>
        <div className="auth-noir-star">
          <AsteriskMark />
        </div>
        <p className="auth-noir-copy">© 2026 Lakisa Studio. All rights reserved.</p>
      </section>

      <section className="auth-noir-panel">
        <Link className="auth-noir-switch-top" href={isRegister ? "/login" : "/register"}>
          {isRegister ? "Sign in" : "Create an account"}
        </Link>
        <div className="auth-noir-form-wrap">
          <h1>{isRegister ? "Create an account" : "Login"}</h1>
          {registered ? (
            <>
              <p className="auth-noir-hint" style={{ marginTop: 0 }}>
                {registered.emailSent ? (
                  <>
                    <strong>{t("auth", "checkInboxTitle")}</strong> — {t("auth", "checkInbox")} (
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
                <Link href="/login">Sign in</Link>
              </p>
            </>
          ) : (
            <>
              <GoogleButton />
              <div className="auth-noir-divider" aria-hidden="true">
                <span>or</span>
              </div>
              <form onSubmit={handleSubmit}>
            {isRegister && (
              <div className="auth-noir-field">
                <label htmlFor="auth-name">Your name</label>
                <div className="auth-noir-field-row">
                  <input
                    id="auth-name"
                    autoComplete="name"
                    required
                    minLength={2}
                    maxLength={60}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="How should we call you?"
                  />
                </div>
              </div>
            )}
            {isRegister && (
              <div className="auth-noir-field">
                <label htmlFor="auth-role">Your role</label>
                <div className="auth-noir-field-row">
                  <select
                    id="auth-role"
                    value={role}
                    onChange={(event) => setRole(event.target.value)}
                    aria-label="Your role on Lakisa"
                  >
                    <option value="">Choose your role (optional)</option>
                    {USER_ROLES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
            {isRegister && (
              <div className="auth-noir-field">
                <label htmlFor="auth-country">Country</label>
                <div className="auth-noir-field-row">
                  <input
                    id="auth-country"
                    autoComplete="country-name"
                    maxLength={80}
                    value={country}
                    onChange={(event) => setCountry(event.target.value)}
                    placeholder="Where are you based? (optional)"
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
            <div className="auth-noir-field">
              <label htmlFor="auth-email">Email</label>
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
              <label htmlFor="auth-password">Password</label>
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
                  placeholder={isRegister ? "At least 10 characters" : "Your password"}
                />
                <button
                  type="button"
                  className="auth-noir-eye"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
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
              <p className="auth-noir-hint">
                Use at least 10 characters, including an uppercase letter, a lowercase letter
                and a number.
              </p>
            )}
            {!isRegister && (
              <div className="auth-noir-row">
                <label className="auth-noir-remember">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  Remember me
                </label>
                <Link className="auth-noir-forgot" href="/forgot-password">
                  Forgot?
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
              {submitting ? "…" : isRegister ? "SIGN UP" : "SIGN IN"}
            </button>
          </form>
            </>
          )}
          <p className="auth-noir-switch">
            {isRegister ? "Already have an account?" : "New to Lakisa?"}{" "}
            <Link href={isRegister ? "/login" : "/register"}>
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <p className="auth-noir-terms">
            By continuing, you agree to use Lakisa respectfully and only share work you have
            permission to publish.
          </p>
        </div>
      </section>
    </main>
  );
}
