"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
        body: JSON.stringify({ name, email, password }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not sign in.");
      window.location.assign("/");
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Could not sign in.");
      setSubmitting(false);
    }
  }

  return (
    <main className="auth-page">
      <div className="auth-art-panel">
        <Link className="brand-lockup auth-brand" href="/"><span className="brand-mark">s.</span><span className="brand-name">SANAA</span></Link>
        <div className="auth-artwork">
          <div className="auth-art-frame"><div className="auth-art-picture"><i /><b /><span /></div></div>
          <span className="auth-art-label">A ROOM OF YOUR OWN · 2026</span>
        </div>
        <p className="auth-quote">“Art should live<br />where people can find it.”</p>
        <span className="auth-panel-footer">A NEW WAY TO SHARE WHAT YOU SEE.</span>
      </div>
      <section className="auth-form-panel">
        <div className="auth-form-wrap">
          <Link className="auth-mobile-brand brand-lockup" href="/"><span className="brand-mark">s.</span><span className="brand-name">SANAA</span></Link>
          <span className="auth-eyebrow">{isRegister ? "YOUR OWN CREATIVE SPACE" : "WELCOME BACK"}</span>
          <h1>{isRegister ? "Make room for your art." : "Good to see you again."}</h1>
          <p className="auth-subtitle">{isRegister ? "Create your account and start curating." : "Sign in to continue building your exhibitions."}</p>
          <form onSubmit={handleSubmit} className="auth-form">
            {isRegister && <label>Your name<input autoComplete="name" required minLength={2} maxLength={60} value={name} onChange={(event) => setName(event.target.value)} placeholder="How should we call you?" /></label>}
            <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" /></label>
            <label>Password<input type="password" autoComplete={isRegister ? "new-password" : "current-password"} required minLength={10} maxLength={72} value={password} onChange={(event) => setPassword(event.target.value)} placeholder={isRegister ? "At least 10 characters" : "Your password"} /></label>
            {isRegister && <span className="password-hint">Use at least 10 characters, including an uppercase letter, a lowercase letter and a number.</span>}
            {error && <p className="auth-error" role="alert">{error}</p>}
            <button type="submit" className="auth-submit" disabled={submitting}>{submitting ? "One moment…" : isRegister ? "Create your account" : "Sign in"} <span>→</span></button>
          </form>
          <p className="auth-switch">{isRegister ? "Already have an account?" : "New to SANAA?"} <Link href={isRegister ? "/login" : "/register"}>{isRegister ? "Sign in" : "Create an account"}</Link></p>
          <p className="auth-terms">By continuing, you agree to use SANAA respectfully and only share work you have permission to publish.</p>
        </div>
      </section>
    </main>
  );
}
