"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";

// Publish dialog (feature 8): who can open the show — public (listed),
// private link (published, never listed) or password (asked before
// entering). A password-protected show needs a password of at least 8
// characters, stored as a bcrypt hash server-side.
export type PublishVisibility = "public" | "private-link" | "password";

export default function ExhibitionPublishDialog({
  currentVisibility,
  onClose,
  onPublish,
}: {
  currentVisibility: PublishVisibility;
  onClose: () => void;
  onPublish: (visibility: PublishVisibility, password?: string, publishToFeed?: boolean) => Promise<void>;
}) {
  const t = useT();
  const [visibility, setVisibility] = useState<PublishVisibility>(currentVisibility);
  const [password, setPassword] = useState("");
  // "Ne pas publier dans le fil": only meaningful for a public show —
  // private-link and password shows never reach the feed anyway.
  const [excludeFromFeed, setExcludeFromFeed] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const needsPassword = visibility === "password";
  const passwordOk = !needsPassword || password.length >= 8;

  const choices: { id: PublishVisibility; name: string; desc: string }[] = [
    { id: "public", name: t("publish", "visibilityPublic"), desc: t("publish", "visibilityPublicDesc") },
    { id: "private-link", name: t("publish", "visibilityPrivateLink"), desc: t("publish", "visibilityPrivateLinkDesc") },
    { id: "password", name: t("publish", "visibilityPassword"), desc: t("publish", "visibilityPasswordDesc") },
  ];

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!passwordOk) return;
    setPublishing(true);
    setError(null);
    try {
      await onPublish(
        visibility,
        needsPassword ? password : undefined,
        visibility === "public" ? !excludeFromFeed : undefined,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("publish", "publish"));
      setPublishing(false);
    }
  }

  return (
    <div className="publish-dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="publish-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("publish", "visibility")}
        onClick={(event) => event.stopPropagation()}
      >
        <form onSubmit={submit}>
          <h2 className="publish-dialog-title">{t("publish", "visibility")}</h2>
          <fieldset className="publish-dialog-choices">
            <div className="publish-dialog-choice-list">
              {choices.map((choice) => (
                <label
                  key={choice.id}
                  className={`publish-dialog-choice ${visibility === choice.id ? "publish-dialog-choice-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={choice.id}
                    checked={visibility === choice.id}
                    onChange={() => setVisibility(choice.id)}
                  />
                  <span className="publish-dialog-choice-name">{choice.name}</span>
                  <span className="publish-dialog-choice-desc">{choice.desc}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {visibility === "public" && (
            <label className="publish-dialog-feed">
              <input
                type="checkbox"
                checked={excludeFromFeed}
                onChange={(event) => setExcludeFromFeed(event.target.checked)}
              />
              <span>
                <span className="publish-dialog-feed-name">{t("publish", "excludeFromFeed")}</span>
                <span className="publish-dialog-feed-desc">{t("publish", "excludeFromFeedDesc")}</span>
              </span>
            </label>
          )}
          {needsPassword && (
            <div className="publish-dialog-password">
              <label htmlFor="publish-access-password">{t("publish", "accessPassword")} *</label>
              <input
                id="publish-access-password"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder={t("publish", "accessPasswordPlaceholder")}
                autoComplete="new-password"
                required
                minLength={8}
              />
            </div>
          )}
          {error && (
            <p className="publish-dialog-error" role="alert">
              {error}
            </p>
          )}
          <div className="publish-dialog-actions">
            <button type="button" className="publish-dialog-cancel" onClick={onClose} disabled={publishing}>
              {t("common", "cancel")}
            </button>
            <button type="submit" className="publish-dialog-submit" disabled={publishing || !passwordOk}>
              {publishing ? t("common", "loading") : t("publish", "publish")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
