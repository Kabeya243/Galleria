"use client";

import { useState } from "react";
import { GALLERY_NAME_DEFAULTS, type GalleryNamesMap } from "@/lib/gallery-names";
import { roomLayouts, type RoomLayout } from "@/lib/rooms";

// Gallery names in the admin panel: the owner renames any of the 21
// galleries in English and in French. Names live in the database
// (GalleryName, one row per layout), so a rename survives reloads and
// redeploys and shows on /galleries, in the creation dialog and in the
// editor. Saving is per row, errors are inline — never a popup.
const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  borderRadius: 6,
  border: "1px solid var(--ad-border)",
  background: "transparent",
  color: "var(--ad-ink)",
  fontSize: 13,
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

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "var(--ad-btn-bg)",
  borderColor: "transparent",
  color: "var(--ad-btn-ink)",
};

type Draft = Record<RoomLayout, { en: string; fr: string }>;

function initialDraft(names: GalleryNamesMap): Draft {
  const draft = {} as Draft;
  for (const layout of Object.keys(roomLayouts) as RoomLayout[]) {
    const saved = names[layout];
    draft[layout] = {
      en: saved?.en ?? GALLERY_NAME_DEFAULTS[layout].en,
      fr: saved?.fr ?? GALLERY_NAME_DEFAULTS[layout].fr,
    };
  }
  return draft;
}

export default function AdminGalleryNames({
  names,
  canManage = true,
}: {
  names: GalleryNamesMap;
  // A sub-admin with galleries.view only sees the names; renaming
  // needs galleries.manage (checked again server-side).
  canManage?: boolean;
}) {
  const [draft, setDraft] = useState<Draft>(() => initialDraft(names));
  // What the server last confirmed, per layout — the Save button stays
  // disabled until the row differs from it.
  const [saved, setSaved] = useState<Draft>(() => initialDraft(names));
  const [saving, setSaving] = useState<RoomLayout | null>(null);
  const [note, setNote] = useState<Partial<Record<RoomLayout, { ok: boolean; text: string }>>>({});

  async function save(layout: RoomLayout) {
    const row = draft[layout];
    const nameEn = row.en.trim();
    const nameFr = row.fr.trim();
    if (!nameEn || !nameFr) {
      setNote((current) => ({
        ...current,
        [layout]: { ok: false, text: "Both names are required." },
      }));
      return;
    }
    setSaving(layout);
    setNote((current) => ({ ...current, [layout]: undefined }));
    try {
      const res = await fetch("/api/admin/gallery-names", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ layout, nameEn, nameFr }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not save this name.");
      const next = { ...draft, [layout]: { en: nameEn, fr: nameFr } };
      setDraft(next);
      setSaved(next);
      setNote((current) => ({ ...current, [layout]: { ok: true, text: "Saved." } }));
    } catch (error) {
      setNote((current) => ({
        ...current,
        [layout]: {
          ok: false,
          text: error instanceof Error ? error.message : "Could not save this name.",
        },
      }));
    } finally {
      setSaving(null);
    }
  }

  return (
    <div>
      <div className="ad-card ad-table-wrap">
        <table className="ad-table">
          <thead>
            <tr>
              <th>Gallery</th>
              <th>English name</th>
              <th>French name</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            {(Object.keys(roomLayouts) as RoomLayout[]).map((layout) => {
              const row = draft[layout];
              const isSaving = saving === layout;
              const changed =
                row.en.trim() !== saved[layout].en ||
                row.fr.trim() !== saved[layout].fr;
              const rowNote = note[layout];
              return (
                <tr key={layout}>
                  <td>
                    <strong>{GALLERY_NAME_DEFAULTS[layout].en}</strong>
                    <div style={{ color: "var(--ad-muted)", fontSize: 12, marginTop: 2 }}>
                      {layout}
                    </div>
                  </td>
                  <td>
                    <input
                      type="text"
                      aria-label={`English name for ${GALLERY_NAME_DEFAULTS[layout].en}`}
                      style={inputStyle}
                      value={row.en}
                      maxLength={80}
                      disabled={!canManage}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [layout]: { ...current[layout], en: event.target.value },
                        }))
                      }
                    />
                  </td>
                  <td>
                    <input
                      type="text"
                      aria-label={`French name for ${GALLERY_NAME_DEFAULTS[layout].en}`}
                      style={inputStyle}
                      value={row.fr}
                      maxLength={80}
                      disabled={!canManage}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          [layout]: { ...current[layout], fr: event.target.value },
                        }))
                      }
                    />
                  </td>
                  <td>
                    {!canManage ? (
                      <span style={{ color: "var(--ad-muted)", fontSize: 12 }}>Read only</span>
                    ) : (
                      <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                      <button
                        type="button"
                        style={{ ...btnPrimary, opacity: !changed || isSaving ? 0.6 : 1 }}
                        disabled={!changed || isSaving}
                        onClick={() => void save(layout)}
                      >
                        {isSaving ? "Saving…" : "Save"}
                      </button>
                      {rowNote ? (
                        <span
                          role={rowNote.ok ? "status" : "alert"}
                          style={{
                            fontSize: 12,
                            color: rowNote.ok ? "var(--ad-muted)" : "var(--ad-down)",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {rowNote.text}
                        </span>
                      ) : null}
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <p style={{ color: "var(--ad-muted)", fontSize: 13, marginTop: 10 }}>
        Renaming a gallery changes its name everywhere it appears (the catalogue, the creation
        dialog and the editor) in the matching language. The room itself, its 3D model and its
        layout never change.
      </p>
    </div>
  );
}
