"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";

// Password gate for a password-protected exhibition (feature 8): the
// visitor types the access password, it is checked server-side
// (/api/exhibitions/[id]/unlock), and on success the page reloads with
// the unlock cookie set — the show then opens normally.
export default function ExhibitionPasswordGate({
  exhibitionId,
  title,
}: {
  exhibitionId: string;
  title: string;
}) {
  const t = useT();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [checking, setChecking] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!password) return;
    setChecking(true);
    setError(null);
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!response.ok) {
        setError(t("publish", "wrongPassword"));
        setChecking(false);
        return;
      }
      window.location.reload();
    } catch {
      setError(t("publish", "wrongPassword"));
      setChecking(false);
    }
  }

  return (
    <main className="password-gate">
      <div className="password-gate-card">
        <span className="eyebrow">{t("publish", "passwordProtected")}</span>
        <h1>{title}</h1>
        <p>{t("publish", "passwordProtectedDesc")}</p>
        <form onSubmit={submit}>
          <label htmlFor="exhibition-password">{t("publish", "accessPassword")}</label>
          <input
            id="exhibition-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder={t("publish", "accessPasswordPlaceholder")}
            autoComplete="current-password"
            autoFocus
            required
          />
          {error && (
            <p className="password-gate-error" role="alert">
              {error}
            </p>
          )}
          <button type="submit" disabled={checking || !password}>
            {checking ? t("common", "loading") : t("publish", "enterPassword")}
          </button>
        </form>
      </div>
    </main>
  );
}
