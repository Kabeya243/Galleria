"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import styles from "@/components/tools.module.css";
import { useT } from "@/lib/i18n";

// The public open-call form (no sign-in): renders the call's fields,
// uploads file answers through the dedicated public upload route, and
// submits the answers. File answers are stored in R2 first and the
// returned key travels with the response.
//
// After a successful submission, a confirmation pop-up opens and
// proposes a free Lakisa account (to follow the application and build
// an exhibition): "Create my free account" goes to /register, "Not
// now" closes the pop-up. The submission is already saved at that
// point, so closing the pop-up changes nothing about it.
export type PublicCallField = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options: string[];
};

export default function OpenCallForm({
  slug,
  fields,
}: {
  slug: string;
  fields: PublicCallField[];
}) {
  const t = useT();
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [files, setFiles] = useState<Record<string, { key: string; name: string } | null>>({});
  const [uploading, setUploading] = useState<Record<string, boolean>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Escape closes the confirmation pop-up, like the other dialogs.
  useEffect(() => {
    if (!showConfirm) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setShowConfirm(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [showConfirm]);

  function setValue(id: string, value: unknown) {
    setValues((current) => ({ ...current, [id]: value }));
  }

  async function uploadFile(fieldId: string, file: File) {
    setError(null);
    setUploading((current) => ({ ...current, [fieldId]: true }));
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/public/open-calls/${encodeURIComponent(slug)}/upload`, {
        method: "POST",
        body: form,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t("openCall", "uploadError"));
        return;
      }
      const uploaded = { key: data.key as string, name: data.name as string };
      setFiles((current) => ({ ...current, [fieldId]: uploaded }));
      setValue(fieldId, uploaded);
    } catch {
      setError(t("openCall", "uploadRetry"));
    } finally {
      setUploading((current) => ({ ...current, [fieldId]: false }));
    }
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/public/open-calls/${encodeURIComponent(slug)}/responses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: values }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? t("openCall", "sendError"));
        return;
      }
      setSubmitted(true);
      setShowConfirm(true);
    } catch {
      setError(t("openCall", "sendRetry"));
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <>
        <div className={styles.emptyBox}>
          <strong>{t("openCall", "receivedTitle")}</strong>
          <p>{t("openCall", "receivedText")}</p>
        </div>
        {showConfirm && (
          <div
            className="publish-dialog-overlay"
            role="presentation"
            onClick={() => setShowConfirm(false)}
          >
            <div
              className="publish-dialog"
              role="dialog"
              aria-modal="true"
              aria-label={t("openCall", "confirmTitle")}
              onClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                className="welcome-tour-close"
                onClick={() => setShowConfirm(false)}
                aria-label={t("common", "close")}
              >
                ×
              </button>
              <h2 className="publish-dialog-title">{t("openCall", "confirmTitle")}</h2>
              <p style={{ margin: "0 0 20px", fontSize: 15, lineHeight: 1.6 }}>
                {t("openCall", "confirmText")}
              </p>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <Link href="/register" className="primary-button">
                  {t("openCall", "createAccount")}
                </Link>
                <button
                  type="button"
                  className="create-dialog-cancel"
                  onClick={() => setShowConfirm(false)}
                >
                  {t("openCall", "notNow")}
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <form onSubmit={submit} style={{ display: "grid", gap: 16 }}>
      {fields.map((field) => {
        const needsOptions = field.type === "select" || field.type === "checkbox";
        return (
          <label key={field.id} className={styles.field}>
            <span>
              {field.label}
              {field.required ? " *" : ""}
            </span>
            {field.type === "short_text" && (
              <input
                value={(values[field.id] as string) ?? ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                required={field.required}
                maxLength={5000}
              />
            )}
            {field.type === "long_text" && (
              <textarea
                value={(values[field.id] as string) ?? ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                required={field.required}
                rows={5}
                maxLength={5000}
              />
            )}
            {field.type === "email" && (
              <input
                type="email"
                value={(values[field.id] as string) ?? ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                required={field.required}
                maxLength={320}
              />
            )}
            {field.type === "number" && (
              <input
                type="number"
                value={(values[field.id] as string) ?? ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                required={field.required}
              />
            )}
            {field.type === "date" && (
              <input
                type="date"
                value={(values[field.id] as string) ?? ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                required={field.required}
              />
            )}
            {field.type === "select" && needsOptions && (
              <select
                value={(values[field.id] as string) ?? ""}
                onChange={(e) => setValue(field.id, e.target.value)}
                required={field.required}
              >
                <option value="">{t("openCall", "chooseFile")}</option>
                {field.options.map((option) => (
                  <option key={option} value={option}>
                    {option}
                  </option>
                ))}
              </select>
            )}
            {field.type === "checkbox" && needsOptions && (
              <span style={{ display: "grid", gap: 6 }}>
                {field.options.map((option) => {
                  const checked = ((values[field.id] as string[]) ?? []).includes(option);
                  return (
                    <label key={option} style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const current = ((values[field.id] as string[]) ?? []).filter(Boolean);
                          setValue(
                            field.id,
                            e.target.checked
                              ? [...current, option]
                              : current.filter((v) => v !== option),
                          );
                        }}
                      />
                      {option}
                    </label>
                  );
                })}
              </span>
            )}
            {field.type === "file" && (
              <span style={{ display: "grid", gap: 6 }}>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/avif,application/pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadFile(field.id, file);
                  }}
                  required={field.required && !files[field.id]}
                />
                {uploading[field.id] && <span style={{ fontSize: 13, color: "var(--muted)" }}>{t("openCall", "uploading")}</span>}
                {files[field.id] && (
                  <span style={{ fontSize: 13 }}>{t("openCall", "uploaded")} {files[field.id]?.name}</span>
                )}
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  {t("openCall", "fileHint")}
                </span>
              </span>
            )}
          </label>
        );
      })}
      {error && (
        <p role="alert" style={{ color: "#9a2b2b", fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}
      <div>
        <button type="submit" className="primary-button" disabled={submitting}>
          {submitting ? t("openCall", "sending") : t("openCall", "sendApplication")}
        </button>
      </div>
    </form>
  );
}
