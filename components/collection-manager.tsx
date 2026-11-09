"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

// Collection Manager — every artwork the signed-in user owns, across all
// their exhibitions, in one table. Search, filter by medium / availability
// / exhibition, sort, tags, and bulk actions (tag, set availability,
// delete with inline confirm). Extra collection fields — provenance,
// inventory number, ownership, condition report, location, documents /
// notes — live in /api/saved-work as kind "collection-record" rows keyed
// by artworkId, because the Artwork table has no such columns.
//
// Design: the existing white-gallery luxury language only — white paper,
// near-black ink, discrete gold accent, Fraunces + DM Sans. Component
// styles live in the <style> block at the bottom of this file so
// globals.css stays untouched.

export type CollectionArtwork = {
  id: string;
  title: string;
  artist: string;
  year: string;
  medium: string;
  dimensions: string;
  imageUrl: string | null;
  exhibitionId: string;
  exhibitionTitle: string;
  createdAt: string;
};

export type CollectionRecordRow = {
  id: string;
  title: string;
  data: string;
  artworkId: string | null;
  updatedAt: string;
};

export type Availability = "Available" | "On loan" | "Sold" | "Reserved" | "Not for sale";

export const AVAILABILITIES: Availability[] = ["Available", "On loan", "Sold", "Reserved", "Not for sale"];

export type CollectionRecordData = {
  tags: string[];
  availability: Availability;
  location: string;
  provenance: string;
  inventoryNumber: string;
  ownership: string;
  condition: string;
  notes: string;
};

const EMPTY_RECORD: CollectionRecordData = {
  tags: [],
  availability: "Available",
  location: "",
  provenance: "",
  inventoryNumber: "",
  ownership: "",
  condition: "",
  notes: "",
};

type RecordEntry = { recordId: string | null; data: CollectionRecordData };

function parseRecord(row: CollectionRecordRow): CollectionRecordData {
  let raw: Record<string, unknown> = {};
  try {
    raw = JSON.parse(row.data) as Record<string, unknown>;
  } catch {
    raw = {};
  }
  const tags = Array.isArray(raw.tags) ? raw.tags.filter((t): t is string => typeof t === "string") : [];
  const availability =
    typeof raw.availability === "string" && (AVAILABILITIES as string[]).includes(raw.availability)
      ? (raw.availability as Availability)
      : "Available";
  const str = (v: unknown) => (typeof v === "string" ? v : "");
  return {
    tags,
    availability,
    location: str(raw.location),
    provenance: str(raw.provenance),
    inventoryNumber: str(raw.inventoryNumber),
    ownership: str(raw.ownership),
    condition: str(raw.condition),
    notes: str(raw.notes),
  };
}

type SortKey = "title" | "year" | "created";

export default function CollectionManager({
  artworks: initialArtworks,
  initialRecords,
}: {
  artworks: CollectionArtwork[];
  initialRecords: CollectionRecordRow[];
}) {
  const [artworks, setArtworks] = useState<CollectionArtwork[]>(initialArtworks);
  const [records, setRecords] = useState<Record<string, RecordEntry>>(() => {
    const map: Record<string, RecordEntry> = {};
    for (const row of initialRecords) {
      if (row.artworkId) map[row.artworkId] = { recordId: row.id, data: parseRecord(row) };
    }
    return map;
  });

  const [query, setQuery] = useState("");
  const [mediumFilter, setMediumFilter] = useState("all");
  const [availabilityFilter, setAvailabilityFilter] = useState("all");
  const [exhibitionFilter, setExhibitionFilter] = useState("all");
  const [sortKey, setSortKey] = useState<SortKey>("created");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openId, setOpenId] = useState<string | null>(null);

  // Detail editor draft (one artwork at a time).
  const [draft, setDraft] = useState<CollectionRecordData>(EMPTY_RECORD);
  const [draftDirty, setDraftDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Bulk bar state.
  const [bulkTag, setBulkTag] = useState("");
  const [bulkAvailability, setBulkAvailability] = useState<Availability>("Available");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [newTag, setNewTag] = useState("");

  const recordFor = useCallback(
    (artworkId: string): RecordEntry => records[artworkId] ?? { recordId: null, data: EMPTY_RECORD },
    [records],
  );

  const openDetail = useCallback(
    (artworkId: string) => {
      if (openId === artworkId) {
        setOpenId(null);
        return;
      }
      setOpenId(artworkId);
      setDraft({ ...recordFor(artworkId).data, tags: [...recordFor(artworkId).data.tags] });
      setDraftDirty(false);
      setStatus(null);
      setError(null);
      setNewTag("");
    },
    [openId, recordFor],
  );

  // Keep the draft in step when another action rewrites the record.
  useEffect(() => {
    if (openId) {
      setDraft({ ...recordFor(openId).data, tags: [...recordFor(openId).data.tags] });
      setDraftDirty(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records]);

  const mediums = useMemo(
    () => Array.from(new Set(artworks.map((a) => a.medium).filter(Boolean))).sort(),
    [artworks],
  );
  const exhibitions = useMemo(
    () =>
      Array.from(new Map(artworks.map((a) => [a.exhibitionId, a.exhibitionTitle])).entries()).sort((a, b) =>
        a[1].localeCompare(b[1]),
      ),
    [artworks],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = artworks.filter((a) => {
      if (q && !`${a.title} ${a.artist}`.toLowerCase().includes(q)) return false;
      if (mediumFilter !== "all" && a.medium !== mediumFilter) return false;
      if (exhibitionFilter !== "all" && a.exhibitionId !== exhibitionFilter) return false;
      if (availabilityFilter !== "all" && recordFor(a.id).data.availability !== availabilityFilter) return false;
      return true;
    });
    const sorted = [...list];
    if (sortKey === "title") sorted.sort((a, b) => a.title.localeCompare(b.title));
    else if (sortKey === "year") sorted.sort((a, b) => (b.year || "").localeCompare(a.year || ""));
    else sorted.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return sorted;
  }, [artworks, query, mediumFilter, availabilityFilter, exhibitionFilter, sortKey, recordFor]);

  const counts = useMemo(() => {
    const c = { total: artworks.length, available: 0, onLoan: 0, sold: 0, reserved: 0 };
    for (const a of artworks) {
      const av = recordFor(a.id).data.availability;
      if (av === "Available") c.available += 1;
      else if (av === "On loan") c.onLoan += 1;
      else if (av === "Sold") c.sold += 1;
      else if (av === "Reserved") c.reserved += 1;
    }
    return c;
  }, [artworks, recordFor]);

  const allFilteredSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setConfirmBulkDelete(false);
  };

  const toggleSelectAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allFilteredSelected) filtered.forEach((a) => next.delete(a.id));
      else filtered.forEach((a) => next.add(a.id));
      return next;
    });
    setConfirmBulkDelete(false);
  };

  // --- Persistence -------------------------------------------------------
  const saveRecord = useCallback(
    async (artworkId: string, data: CollectionRecordData, title: string) => {
      const entry = records[artworkId];
      const res = await fetch("/api/saved-work", {
        method: entry?.recordId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          entry?.recordId
            ? { id: entry.recordId, data }
            : { kind: "collection-record", title, data, artworkId },
        ),
      });
      if (!res.ok) throw new Error("save");
      const json = (await res.json()) as { saved?: { id: string } };
      const recordId = json.saved?.id ?? entry?.recordId ?? null;
      setRecords((prev) => ({ ...prev, [artworkId]: { recordId, data } }));
      return recordId;
    },
    [records],
  );

  const saveDraft = async () => {
    if (!openId) return;
    const artwork = artworks.find((a) => a.id === openId);
    if (!artwork) return;
    setSaving(true);
    setStatus(null);
    setError(null);
    try {
      await saveRecord(openId, draft, `Collection record: ${artwork.title}`);
      setDraftDirty(false);
      setStatus(`Saved the record for “${artwork.title}”.`);
    } catch {
      setError("Could not save. Check your connection and try again.");
    } finally {
      setSaving(false);
    }
  };

  const applyBulkTag = async () => {
    const tag = bulkTag.trim();
    if (!tag || selected.size === 0) return;
    setBulkBusy(true);
    setStatus(null);
    setError(null);
    try {
      const ids = [...selected];
      for (const id of ids) {
        const artwork = artworks.find((a) => a.id === id);
        if (!artwork) continue;
        const current = recordFor(id).data;
        if (current.tags.includes(tag)) continue;
        await saveRecord(id, { ...current, tags: [...current.tags, tag] }, `Collection record: ${artwork.title}`);
      }
      setStatus(`Added the tag “${tag}” to ${ids.length} artwork${ids.length === 1 ? "" : "s"}.`);
      setBulkTag("");
    } catch {
      setError("Some tags could not be saved. Check your connection and try again.");
    } finally {
      setBulkBusy(false);
    }
  };

  const applyBulkAvailability = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    setStatus(null);
    setError(null);
    try {
      const ids = [...selected];
      for (const id of ids) {
        const artwork = artworks.find((a) => a.id === id);
        if (!artwork) continue;
        const current = recordFor(id).data;
        await saveRecord(id, { ...current, availability: bulkAvailability }, `Collection record: ${artwork.title}`);
      }
      setStatus(`Set ${ids.length} artwork${ids.length === 1 ? "" : "s"} to “${bulkAvailability}”.`);
    } catch {
      setError("Some availability changes could not be saved. Check your connection and try again.");
    } finally {
      setBulkBusy(false);
    }
  };

  const applyBulkDelete = async () => {
    if (selected.size === 0) return;
    setBulkBusy(true);
    setStatus(null);
    setError(null);
    try {
      const ids = [...selected];
      const deleted: string[] = [];
      for (const id of ids) {
        const res = await fetch(`/api/artworks/${encodeURIComponent(id)}`, { method: "DELETE" });
        if (res.ok) deleted.push(id);
      }
      if (deleted.length === 0) throw new Error("delete");
      setArtworks((prev) => prev.filter((a) => !deleted.includes(a.id)));
      setRecords((prev) => {
        const next = { ...prev };
        for (const id of deleted) delete next[id];
        return next;
      });
      setSelected(new Set());
      setConfirmBulkDelete(false);
      if (deleted.length < ids.length) {
        setError(`Deleted ${deleted.length} of ${ids.length} artworks. The rest could not be deleted. Try again.`);
      } else {
        setStatus(`Deleted ${deleted.length} artwork${deleted.length === 1 ? "" : "s"}.`);
      }
      if (openId && deleted.includes(openId)) setOpenId(null);
    } catch {
      setError("Could not delete. Check your connection and try again.");
    } finally {
      setBulkBusy(false);
    }
  };

  const addTagToDraft = () => {
    const tag = newTag.trim();
    if (!tag || draft.tags.includes(tag)) return;
    setDraft((d) => ({ ...d, tags: [...d.tags, tag] }));
    setDraftDirty(true);
    setNewTag("");
  };

  const removeTagFromDraft = (tag: string) => {
    setDraft((d) => ({ ...d, tags: d.tags.filter((t) => t !== tag) }));
    setDraftDirty(true);
  };

  const openArtwork = openId ? artworks.find((a) => a.id === openId) ?? null : null;

  return (
    <div className="cm-wrap">
      <div className="cm-stats" aria-label="Collection summary">
        <div>
          <strong>{counts.total}</strong>
          <span>works</span>
        </div>
        <div>
          <strong>{counts.available}</strong>
          <span>available</span>
        </div>
        <div>
          <strong>{counts.onLoan}</strong>
          <span>on loan</span>
        </div>
        <div>
          <strong>{counts.sold}</strong>
          <span>sold</span>
        </div>
        <div>
          <strong>{counts.reserved}</strong>
          <span>reserved</span>
        </div>
      </div>

      <div className="cm-toolbar">
        <input
          type="search"
          className="cm-search"
          placeholder="Search by title or artist…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search by title or artist"
        />
        <select value={mediumFilter} onChange={(e) => setMediumFilter(e.target.value)} aria-label="Filter by medium">
          <option value="all">All media</option>
          {mediums.map((m) => (
            <option key={m} value={m}>
              {m}
            </option>
          ))}
        </select>
        <select
          value={availabilityFilter}
          onChange={(e) => setAvailabilityFilter(e.target.value)}
          aria-label="Filter by availability"
        >
          <option value="all">All availability</option>
          {AVAILABILITIES.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
        <select
          value={exhibitionFilter}
          onChange={(e) => setExhibitionFilter(e.target.value)}
          aria-label="Filter by exhibition"
        >
          <option value="all">All exhibitions</option>
          {exhibitions.map(([id, title]) => (
            <option key={id} value={id}>
              {title}
            </option>
          ))}
        </select>
        <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)} aria-label="Sort by">
          <option value="created">Newest first</option>
          <option value="title">Title A–Z</option>
          <option value="year">Year, newest</option>
        </select>
      </div>

      {status && <p className="cm-status" role="status">{status}</p>}
      {error && <p className="cm-error" role="alert">{error}</p>}

      {selected.size > 0 && (
        <div className="cm-bulk" role="region" aria-label="Bulk actions">
          <strong>
            {selected.size} selected
          </strong>
          <input
            type="text"
            placeholder="Tag to add…"
            value={bulkTag}
            onChange={(e) => setBulkTag(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void applyBulkTag();
            }}
            aria-label="Tag to add to selected artworks"
          />
          <button type="button" className="cm-btn" onClick={() => void applyBulkTag()} disabled={bulkBusy || !bulkTag.trim()}>
            Add tag
          </button>
          <select
            value={bulkAvailability}
            onChange={(e) => setBulkAvailability(e.target.value as Availability)}
            aria-label="Availability to set on selected artworks"
          >
            {AVAILABILITIES.map((a) => (
              <option key={a} value={a}>
                {a}
              </option>
            ))}
          </select>
          <button type="button" className="cm-btn" onClick={() => void applyBulkAvailability()} disabled={bulkBusy}>
            Set availability
          </button>
          {confirmBulkDelete ? (
            <>
              <span className="cm-confirm">Delete {selected.size} artwork{selected.size === 1 ? "" : "s"} for good?</span>
              <button type="button" className="cm-btn cm-btn-danger" onClick={() => void applyBulkDelete()} disabled={bulkBusy}>
                Yes, delete
              </button>
              <button type="button" className="cm-btn cm-btn-ghost" onClick={() => setConfirmBulkDelete(false)}>
                Keep them
              </button>
            </>
          ) : (
            <button type="button" className="cm-btn cm-btn-danger" onClick={() => setConfirmBulkDelete(true)} disabled={bulkBusy}>
              Delete selected
            </button>
          )}
          <button
            type="button"
            className="cm-btn cm-btn-ghost"
            onClick={() => {
              setSelected(new Set());
              setConfirmBulkDelete(false);
            }}
          >
            Clear selection
          </button>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="cm-empty">
          <strong>No artworks match.</strong>
          <p>Try a different search or clear the filters, your collection is still there.</p>
          <button
            type="button"
            className="cm-btn"
            onClick={() => {
              setQuery("");
              setMediumFilter("all");
              setAvailabilityFilter("all");
              setExhibitionFilter("all");
            }}
          >
            Clear search and filters
          </button>
        </div>
      ) : (
        <div className="cm-table-wrap">
          <table className="cm-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleSelectAll}
                    aria-label="Select all filtered artworks"
                  />
                </th>
                <th>Work</th>
                <th>Artist</th>
                <th>Year</th>
                <th>Medium</th>
                <th>Dimensions</th>
                <th>Exhibition</th>
                <th>Availability</th>
                <th>Location</th>
                <th>Tags</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((a, index) => {
                const rec = recordFor(a.id).data;
                const isOpen = openId === a.id;
                return (
                  <tr key={a.id} className={isOpen ? "cm-row-open" : undefined}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selected.has(a.id)}
                        onChange={() => toggleSelect(a.id)}
                        aria-label={`Select ${a.title}`}
                      />
                    </td>
                    <td>
                      <button type="button" className="cm-title-btn" onClick={() => openDetail(a.id)} aria-expanded={isOpen}>
                        {a.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.imageUrl} alt="" className="cm-thumb" loading={index < 8 ? "eager" : "lazy"} />
                        ) : (
                          <span className="cm-thumb cm-thumb-blank" aria-hidden="true" />
                        )}
                        <span>{a.title}</span>
                      </button>
                    </td>
                    <td>{a.artist || "N/A"}</td>
                    <td>{a.year || "N/A"}</td>
                    <td>{a.medium || "N/A"}</td>
                    <td>{a.dimensions || "N/A"}</td>
                    <td>{a.exhibitionTitle}</td>
                    <td>
                      <span className={`cm-avail cm-avail-${rec.availability.replace(/\s+/g, "-").toLowerCase()}`}>
                        {rec.availability}
                      </span>
                    </td>
                    <td>{rec.location || "N/A"}</td>
                    <td>
                      {rec.tags.length === 0 ? (
                        "N/A"
                      ) : (
                        <span className="cm-tags">
                          {rec.tags.map((t) => (
                            <span key={t} className="cm-tag">{t}</span>
                          ))}
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {openArtwork && (
        <section className="cm-detail" aria-label={`Collection record for ${openArtwork.title}`}>
          <div className="cm-detail-head">
            <div>
              <p className="cm-eyebrow">COLLECTION RECORD</p>
              <h2>{openArtwork.title}</h2>
              <p className="cm-detail-sub">
                {openArtwork.artist || "Unknown artist"}
                {openArtwork.year ? ` · ${openArtwork.year}` : ""} · {openArtwork.exhibitionTitle}
              </p>
            </div>
            <button type="button" className="cm-btn cm-btn-ghost" onClick={() => setOpenId(null)}>
              Close
            </button>
          </div>

          <div className="cm-form">
            <label className="cm-field">
              <span>Availability</span>
              <select
                value={draft.availability}
                onChange={(e) => {
                  setDraft((d) => ({ ...d, availability: e.target.value as Availability }));
                  setDraftDirty(true);
                }}
              >
                {AVAILABILITIES.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label className="cm-field">
              <span>Location</span>
              <input
                type="text"
                value={draft.location}
                placeholder="e.g. Studio shelf 2, Kampala"
                onChange={(e) => {
                  setDraft((d) => ({ ...d, location: e.target.value }));
                  setDraftDirty(true);
                }}
              />
            </label>
            <label className="cm-field">
              <span>Inventory number</span>
              <input
                type="text"
                value={draft.inventoryNumber}
                placeholder="e.g. KI-2026-014"
                onChange={(e) => {
                  setDraft((d) => ({ ...d, inventoryNumber: e.target.value }));
                  setDraftDirty(true);
                }}
              />
            </label>
            <label className="cm-field">
              <span>Ownership</span>
              <input
                type="text"
                value={draft.ownership}
                placeholder="e.g. Artist, on consignment, private collection"
                onChange={(e) => {
                  setDraft((d) => ({ ...d, ownership: e.target.value }));
                  setDraftDirty(true);
                }}
              />
            </label>
            <label className="cm-field cm-field-wide">
              <span>Provenance</span>
              <textarea
                rows={2}
                value={draft.provenance}
                placeholder="Where this work has been: previous owners, exhibitions, sales…"
                onChange={(e) => {
                  setDraft((d) => ({ ...d, provenance: e.target.value }));
                  setDraftDirty(true);
                }}
              />
            </label>
            <label className="cm-field cm-field-wide">
              <span>Condition report</span>
              <textarea
                rows={2}
                value={draft.condition}
                placeholder="Surface, frame, edges, any damage or repairs…"
                onChange={(e) => {
                  setDraft((d) => ({ ...d, condition: e.target.value }));
                  setDraftDirty(true);
                }}
              />
            </label>
            <label className="cm-field cm-field-wide">
              <span>Documents &amp; notes</span>
              <textarea
                rows={3}
                value={draft.notes}
                placeholder="Certificates, shipping notes, insurance, links, anything to remember…"
                onChange={(e) => {
                  setDraft((d) => ({ ...d, notes: e.target.value }));
                  setDraftDirty(true);
                }}
              />
            </label>
          </div>

          <div className="cm-tags-editor">
            <span className="cm-field-label">Tags</span>
            <span className="cm-tags">
              {draft.tags.map((t) => (
                <span key={t} className="cm-tag cm-tag-removable">
                  {t}
                  <button type="button" onClick={() => removeTagFromDraft(t)} aria-label={`Remove tag ${t}`}>
                    ×
                  </button>
                </span>
              ))}
              {draft.tags.length === 0 && <span className="cm-muted">No tags yet.</span>}
            </span>
            <span className="cm-tag-add">
              <input
                type="text"
                placeholder="Add a tag…"
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addTagToDraft();
                  }
                }}
                aria-label="Add a tag"
              />
              <button type="button" className="cm-btn" onClick={addTagToDraft} disabled={!newTag.trim()}>
                Add
              </button>
            </span>
          </div>

          <div className="cm-detail-actions">
            <button type="button" className="galleries-open-button" onClick={() => void saveDraft()} disabled={saving || !draftDirty}>
              {saving ? "Saving…" : draftDirty ? "Save record" : "Saved"}
            </button>
            {draftDirty && <span className="cm-muted">Unsaved changes.</span>}
          </div>
        </section>
      )}

      <style>{`
        .cm-wrap { display: flex; flex-direction: column; gap: 18px; }
        .cm-stats { display: flex; gap: 12px; flex-wrap: wrap; }
        .cm-stats div { background: #fff; border: 1px solid #e8e2d6; border-radius: 12px; padding: 12px 18px; min-width: 110px; }
        .cm-stats strong { display: block; font-family: Fraunces, Georgia, serif; font-size: 26px; line-height: 1.1; color: #141414; }
        .cm-stats span { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #6b6455; }
        .cm-toolbar { display: flex; gap: 10px; flex-wrap: wrap; }
        .cm-toolbar input[type="search"], .cm-toolbar select { background: #fff; border: 1px solid #ddd6c8; border-radius: 8px; padding: 9px 12px; font: inherit; font-size: 14px; color: #141414; }
        .cm-search { flex: 1 1 240px; }
        .cm-status { margin: 0; color: #5c6b4a; font-size: 14px; }
        .cm-error { margin: 0; color: #8a2f2f; font-size: 14px; }
        .cm-bulk { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; background: #f7f3ea; border: 1px solid #e0d7c2; border-radius: 12px; padding: 12px 14px; }
        .cm-bulk input[type="text"], .cm-bulk select { background: #fff; border: 1px solid #ddd6c8; border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 14px; color: #141414; }
        .cm-confirm { color: #8a2f2f; font-weight: 600; font-size: 14px; }
        .cm-btn { background: #141414; color: #fdfdfc; border: 1px solid #141414; border-radius: 8px; padding: 8px 14px; font: inherit; font-size: 14px; cursor: pointer; }
        .cm-btn:disabled { opacity: .5; cursor: not-allowed; }
        .cm-btn-ghost { background: transparent; color: #141414; }
        .cm-btn-danger { background: #8a2f2f; border-color: #8a2f2f; }
        .cm-empty { background: #fff; border: 1px solid #e8e2d6; border-radius: 12px; padding: 28px; text-align: center; }
        .cm-empty p { color: #6b6455; margin: 8px 0 16px; }
        .cm-table-wrap { overflow-x: auto; background: #fff; border: 1px solid #e8e2d6; border-radius: 12px; }
        .cm-table { width: 100%; border-collapse: collapse; font-size: 14px; min-width: 900px; }
        .cm-table th, .cm-table td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #efe9dc; vertical-align: middle; }
        .cm-table th { font-size: 11px; letter-spacing: .09em; text-transform: uppercase; color: #6b6455; background: #faf8f2; }
        .cm-table tbody tr:last-child td { border-bottom: none; }
        .cm-row-open td { background: #f7f3ea; }
        .cm-title-btn { display: flex; align-items: center; gap: 10px; background: none; border: none; padding: 0; font: inherit; font-weight: 600; color: #141414; cursor: pointer; text-align: left; }
        .cm-thumb { width: 40px; height: 40px; object-fit: cover; border-radius: 6px; border: 1px solid #e8e2d6; flex: none; }
        .cm-thumb-blank { background: #e8e2d6; }
        .cm-avail { display: inline-block; padding: 3px 9px; border-radius: 999px; font-size: 12px; font-weight: 600; white-space: nowrap; }
        .cm-avail-available { background: #e6efe0; color: #3f5a2e; }
        .cm-avail-on-loan { background: #fdf0d5; color: #7a5a12; }
        .cm-avail-sold { background: #eee; color: #555; }
        .cm-avail-reserved { background: #e8eef7; color: #2f4a6b; }
        .cm-avail-not-for-sale { background: #f7e8e8; color: #7a2f2f; }
        .cm-tags { display: inline-flex; gap: 6px; flex-wrap: wrap; }
        .cm-tag { display: inline-flex; align-items: center; gap: 4px; background: #f0ead9; color: #5c4a1f; border: 1px solid #ddd2b2; border-radius: 999px; padding: 2px 9px; font-size: 12px; white-space: nowrap; }
        .cm-tag button { background: none; border: none; cursor: pointer; color: inherit; font-size: 14px; line-height: 1; padding: 0; }
        .cm-detail { background: #fff; border: 1px solid #e0d7c2; border-radius: 14px; padding: 22px; }
        .cm-detail-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 16px; margin-bottom: 18px; }
        .cm-eyebrow { font-size: 11px; letter-spacing: .12em; color: #ffffff; font-weight: 700; margin: 0 0 4px; }
        .cm-detail h2 { font-family: Fraunces, Georgia, serif; font-size: 24px; margin: 0; }
        .cm-detail-sub { color: #6b6455; margin: 4px 0 0; font-size: 14px; }
        .cm-form { display: grid; grid-template-columns: repeat(2, 1fr); gap: 14px; }
        .cm-field { display: flex; flex-direction: column; gap: 6px; }
        .cm-field-wide { grid-column: 1 / -1; }
        .cm-field > span, .cm-field-label { font-size: 12px; letter-spacing: .08em; text-transform: uppercase; color: #6b6455; font-weight: 700; }
        .cm-field input, .cm-field select, .cm-field textarea { background: #fdfdfc; border: 1px solid #ddd6c8; border-radius: 8px; padding: 9px 12px; font: inherit; font-size: 14px; color: #141414; width: 100%; box-sizing: border-box; }
        .cm-field textarea { resize: vertical; }
        .cm-tags-editor { display: flex; flex-direction: column; gap: 8px; margin-top: 16px; }
        .cm-tag-add { display: flex; gap: 8px; }
        .cm-tag-add input { background: #fdfdfc; border: 1px solid #ddd6c8; border-radius: 8px; padding: 8px 10px; font: inherit; font-size: 14px; color: #141414; }
        .cm-detail-actions { display: flex; align-items: center; gap: 12px; margin-top: 20px; }
        .cm-muted { color: #6b6455; font-size: 14px; }
        @media (max-width: 720px) {
          .cm-form { grid-template-columns: 1fr; }
          .cm-detail { padding: 16px; }
        }
      `}</style>
    </div>
  );
}
