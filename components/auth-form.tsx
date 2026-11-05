"use client";

import Link from "next/link";
import { Eye, EyeOff } from "lucide-react";
import { useState, type FormEvent } from "react";
import { USER_ROLES } from "@/lib/validation";

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
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [country, setCountry] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const isRegister = mode === "register";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          isRegister
            ? { name, email, password, role: role || undefined, country: country || undefined }
            : { email, password, rememberMe },
        ),
      });
      const result = await response.json();
      if (!response.ok) {
        throw new Error(
          result.error ??
            (isRegister ? "Could not create your account right now." : "Could not sign in right now."),
        );
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
          SANAA<sup>®</sup>
        </Link>
        <div className="auth-noir-star">
          <AsteriskMark />
        </div>
        <p className="auth-noir-copy">© 2026 SANAA Studio. All rights reserved.</p>
      </section>

      <section className="auth-noir-panel">
        <Link className="auth-noir-switch-top" href={isRegister ? "/login" : "/register"}>
          {isRegister ? "Sign in" : "Create an account"}
        </Link>
        <div className="auth-noir-form-wrap">
          <h1>{isRegister ? "Create an account" : "Login"}</h1>
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
                    aria-label="Your role on SANAA"
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
            {isRegister && (
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
            {error && (
              <p className="auth-noir-error" role="alert">
                {error}
              </p>
            )}
            <button type="submit" className="auth-noir-submit" disabled={submitting}>
              {submitting ? "…" : isRegister ? "SIGN UP" : "SIGN IN"}
            </button>
          </form>
          <p className="auth-noir-switch">
            {isRegister ? "Already have an account?" : "New to SANAA?"}{" "}
            <Link href={isRegister ? "/login" : "/register"}>
              {isRegister ? "Sign in" : "Create an account"}
            </Link>
          </p>
          <p className="auth-noir-terms">
            By continuing, you agree to use SANAA respectfully and only share work you have
            permission to publish.
          </p>
        </div>
      </section>
    </main>
  );
}
