"use client";

import { useState } from "react";

// Galleries management inside the admin panel: every room template in
// the code, with a delete button. Deleting only hides the template
// (its id is recorded in the database), so exhibitions already built
// with it keep working and the removal survives reloads and redeploys.
// Delete always asks for confirmation first, inline — never a popup.
export type AdminGalleryTemplate = {
  key: string;
  label: string;
  category: string;
  width: number;
  depth: number;
  height: number;
  // e.g. "Creation model · minimalist" or "Reference room · public exhibition".
  note?: string;
};

const btnBase: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid var(--ad-border)",
  background: "transparent",
  color: "var(--ad-ink)",
};

const btnDanger: React.CSSProperties = {
  ...btnBase,
  background: "var(--ad-down)",
  borderColor: "transparent",
  color: "#ffffff",
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "var(--ad-btn-bg)",
  borderColor: "transparent",
  color: "var(--ad-btn-ink)",
};

export default function AdminGalleries({
  templates,
  hidden: initialHidden,
  canManage = true,
}: {
  templates: AdminGalleryTemplate[];
  hidden: string[];
  // A sub-admin with galleries.view only sees the list; hiding and
  // restoring need galleries.manage (checked again server-side).
  canManage?: boolean;
}) {
  const [hidden, setHidden] = useState<Set<string>>(new Set(initialHidden));
  // Layout id waiting for its delete to be confirmed (null = none).
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function hide(layout: string) {
    setBusy(layout);
    setError(null);
    try {
      const res = await fetch("/api/admin/hidden-templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout }),
      });
      if (!res.ok) throw new Error("hide failed");
      const data = await res.json();
      setHidden(new Set<string>(Array.isArray(data.hidden) ? data.hidden : []));
      setConfirming(null);
    } catch {
      setError("Could not hide this gallery. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  async function restore(layout: string) {
    setBusy(layout);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/hidden-templates?layout=${encodeURIComponent(layout)}`,
        { method: "DELETE" },
      );
      if (!res.ok) throw new Error("restore failed");
      const data = await res.json();
      setHidden(new Set<string>(Array.isArray(data.hidden) ? data.hidden : []));
    } catch {
      setError("Could not restore this gallery. Please try again.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div>
      <div className="ad-card ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Gallery</th>
              <th>Category</th>
              <th>Size</th>
              <th>Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {templates.map((template) => {
              const isHidden = hidden.has(template.key);
              const isConfirming = confirming === template.key;
              const isBusy = busy === template.key;
              return (
                <tr key={template.key}>
                  <td>
                    <strong>{template.label}</strong>
                    {template.note ? (
                      <div style={{ color: "var(--ad-muted)", fontSize: 12, marginTop: 2 }}>
                        {template.note}
                      </div>
                    ) : null}
                  </td>
                  <td>{template.category}</td>
                  <td>
                    {template.width} × {template.depth} m · {template.height} m
                  </td>
                  <td>{isHidden ? "Hidden" : "Visible"}</td>
                  <td>
                    {!canManage ? (
                      <span style={{ color: "var(--ad-muted)", fontSize: 12 }}>
                        Read only
                      </span>
                    ) : isHidden ? (
                      <button
                        type="button"
                        style={{ ...btnPrimary, opacity: isBusy ? 0.6 : 1 }}
                        disabled={isBusy}
                        onClick={() => restore(template.key)}
                      >
                        {isBusy ? "Restoring…" : "Restore"}
                      </button>
                    ) : isConfirming ? (
                      <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                        <button
                          type="button"
                          style={{ ...btnDanger, opacity: isBusy ? 0.6 : 1 }}
                          disabled={isBusy}
                          onClick={() => hide(template.key)}
                        >
                          {isBusy ? "Deleting…" : "Confirm delete"}
                        </button>
                        <button
                          type="button"
                          style={btnBase}
                          disabled={isBusy}
                          onClick={() => setConfirming(null)}
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        type="button"
                        style={btnBase}
                        onClick={() => setConfirming(template.key)}
                      >
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error ? (
        <p role="alert" style={{ color: "var(--ad-down)", fontSize: 13, marginTop: 10 }}>
          {error}
        </p>
      ) : null}
      <p style={{ color: "var(--ad-muted)", fontSize: 13, marginTop: 10 }}>
        Deleting a gallery only hides it from the catalogue, the creation dialog and the editor.
        Exhibitions already built with it keep working. Use Restore to bring one back.
      </p>
    </div>
  );
}
