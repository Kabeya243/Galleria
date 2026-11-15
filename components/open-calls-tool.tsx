"use client";

import { useCallback, useEffect, useState } from "react";
import { OPEN_CALL_FIELD_LABELS, OPEN_CALL_FIELD_TYPES, type OpenCallFieldType } from "@/lib/open-calls";
import styles from "./tools.module.css";

// Open Calls manager (owner): create a call, build its form, publish
// it, and read the responses. All data lives in the database (Prisma
// OpenCall / OpenCallField / OpenCallResponse); nothing in localStorage.
type FieldRow = {
  id?: string;
  label: string;
  type: OpenCallFieldType;
  required: boolean;
  options: string[];
};

type CallSummary = {
  id: string;
  title: string;
  slug: string;
  description: string;
  deadline: string | null;
  status: string;
  responseCount: number;
  fieldCount: number;
  createdAt: string;
};

type CallDetail = CallSummary & {
  fields: FieldRow[];
  responses: { id: string; answers: Record<string, unknown>; createdAt: string }[];
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  published: "Published",
  closed: "Closed",
};

const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "avif"];

// One work a response can contribute to an exhibition: the image file
// plus the details the form asked for next to it. The launch call
// asks per work for a file, a title, a medium and dimensions
// (launch-work1 + launch-work1-title + ...), so the matching fields
// are found by id suffix first, then by label.
type ImportCandidate = {
  fileFieldId: string;
  fileName: string;
  fileKey: string;
  selected: boolean;
  title: string;
  artist: string;
  medium: string;
  dimensions: string;
};

function textAnswer(fields: FieldRow[], answers: Record<string, unknown>, fieldId: string): string {
  const value = answers[fieldId];
  return typeof value === "string" ? value : "";
}

function buildImportCandidates(
  fields: FieldRow[],
  answers: Record<string, unknown>,
): ImportCandidate[] {
  const artistField = fields.find(
    (f) =>
      f.type !== "file" &&
      /name|artist/i.test(f.label),
  );
  const artist = artistField?.id ? textAnswer(fields, answers, artistField.id) : "";
  const candidates: ImportCandidate[] = [];
  for (const field of fields) {
    if (field.type !== "file" || !field.id) continue;
    const file = answers[field.id] as { key?: string; name?: string } | undefined;
    if (!file || typeof file !== "object" || !file.key || !file.name) continue;
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
    if (!IMAGE_EXTENSIONS.includes(extension)) continue;
    const bySuffix = (suffix: string) =>
      fields.find((f) => f.id === `${field.id}-${suffix}`)?.id;
    const byLabel = (keyword: RegExp) =>
      fields.find((f) => f.type !== "file" && keyword.test(f.label))?.id;
    const titleId = bySuffix("title") ?? byLabel(/title/i);
    const mediumId = bySuffix("medium") ?? byLabel(/medium/i);
    const dimensionsId = bySuffix("dimensions") ?? byLabel(/dimension/i);
    candidates.push({
      fileFieldId: field.id,
      fileName: file.name,
      fileKey: file.key,
      selected: true,
      title:
        (titleId ? textAnswer(fields, answers, titleId) : "") ||
        file.name.replace(/\.[^.]+$/, "") ||
        "Untitled work",
      artist,
      medium: mediumId ? textAnswer(fields, answers, mediumId) : "",
      dimensions: dimensionsId ? textAnswer(fields, answers, dimensionsId) : "",
    });
  }
  return candidates;
}

function publicUrl(slug: string): string {
  if (typeof window === "undefined") return `/open-calls/${slug}`;
  return `${window.location.origin}/open-calls/${slug}`;
}

function answerText(value: unknown): string {
  if (value === undefined || value === null || value === "") return "N/A";
  if (typeof value === "object") {
    if (Array.isArray(value)) return value.join(", ");
    const file = value as { name?: string };
    return file.name ?? "File";
  }
  return String(value);
}

export default function OpenCallsTool() {
  const [calls, setCalls] = useState<CallSummary[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CallDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  // Add-to-exhibition import (per response).
  const [exhibitions, setExhibitions] = useState<{ id: string; title: string }[]>([]);
  const [exhibitionsLoaded, setExhibitionsLoaded] = useState(false);
  const [importResponseId, setImportResponseId] = useState<string | null>(null);
  const [importExhibitionId, setImportExhibitionId] = useState("");
  const [importWorks, setImportWorks] = useState<ImportCandidate[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    count: number;
    exhibitionId: string;
    exhibitionTitle: string;
  } | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const loadExhibitions = useCallback(async () => {
    if (exhibitionsLoaded) return;
    try {
      const res = await fetch("/api/exhibitions");
      if (!res.ok) throw new Error("Could not load your exhibitions.");
      const json = (await res.json()) as { exhibitions?: { id: string; title: string }[] };
      const list = (json.exhibitions ?? []).map((e) => ({ id: e.id, title: e.title }));
      setExhibitions(list);
      setExhibitionsLoaded(true);
      if (list.length > 0) setImportExhibitionId((current) => current || list[0].id);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Could not load your exhibitions.");
    }
  }, [exhibitionsLoaded]);

  const openImport = useCallback(
    (response: { id: string; answers: Record<string, unknown> }) => {
      if (!detail) return;
      setImportResponseId(response.id);
      setImportWorks(buildImportCandidates(detail.fields, response.answers));
      setImportResult(null);
      setImportError(null);
      void loadExhibitions();
    },
    [detail, loadExhibitions],
  );

  const runImport = useCallback(async () => {
    if (!detail || !importResponseId || !importExhibitionId) return;
    const selected = importWorks.filter((w) => w.selected);
    if (selected.length === 0) {
      setImportError("Select at least one work to add.");
      return;
    }
    setImporting(true);
    setImportError(null);
    setImportResult(null);
    try {
      const res = await fetch(
        `/api/open-calls/${encodeURIComponent(detail.id)}/responses/${encodeURIComponent(importResponseId)}/import`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            exhibitionId: importExhibitionId,
            works: selected.map((w) => ({
              fileFieldId: w.fileFieldId,
              title: w.title,
              artist: w.artist,
              medium: w.medium,
              dimensions: w.dimensions,
            })),
          }),
        },
      );
      const json = (await res.json()) as {
        artworks?: { id: string; title: string }[];
        exhibitionTitle?: string;
        error?: string;
        failed?: { error: string }[];
      };
      if (!res.ok) throw new Error(json.error ?? "Could not add those works.");
      const exhibition = exhibitions.find((e) => e.id === importExhibitionId);
      setImportResult({
        count: json.artworks?.length ?? 0,
        exhibitionId: importExhibitionId,
        exhibitionTitle: json.exhibitionTitle ?? exhibition?.title ?? "the exhibition",
      });
      if (json.failed && json.failed.length > 0) {
        setImportError(
          `${json.failed.length} work${json.failed.length > 1 ? "s" : ""} could not be added: ${json.failed[0].error}`,
        );
      }
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Could not add those works.");
    } finally {
      setImporting(false);
    }
  }, [detail, importResponseId, importExhibitionId, importWorks, exhibitions]);

  // Create form.
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [deadline, setDeadline] = useState("");

  // Builder state (edited locally, saved with Save).
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [fields, setFields] = useState<FieldRow[]>([]);
  const [newLabel, setNewLabel] = useState("");
  const [newType, setNewType] = useState<OpenCallFieldType>("short_text");
  const [newRequired, setNewRequired] = useState(false);
  const [newOptions, setNewOptions] = useState("");

  const loadCalls = useCallback(async () => {
    try {
      const res = await fetch("/api/open-calls");
      if (!res.ok) throw new Error("Could not load your open calls.");
      const json = (await res.json()) as { openCalls?: CallSummary[] };
      setCalls(json.openCalls ?? []);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Could not load your open calls.");
    } finally {
      setLoaded(true);
    }
  }, []);

  const loadDetail = useCallback(async (id: string) => {
    setDetailLoading(true);
    try {
      const res = await fetch(`/api/open-calls/${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error("Could not load this open call.");
      const json = (await res.json()) as { openCall?: CallDetail };
      const call = json.openCall;
      if (!call) throw new Error("Could not load this open call.");
      setDetail(call);
      setEditTitle(call.title);
      setEditDescription(call.description);
      setEditDeadline(call.deadline ? call.deadline.slice(0, 16) : "");
      setFields(call.fields);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this open call.");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCalls();
  }, [loadCalls]);

  async function createCall(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    setNotice(null);
    if (!title.trim()) {
      setError("Give the open call a title.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/open-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          deadline: deadline || null,
          fields: [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not create the open call.");
        return;
      }
      setTitle("");
      setDescription("");
      setDeadline("");
      setNotice(`"${data.openCall.title}" created. Build its form below, then publish it.`);
      await loadCalls();
      setSelectedId(data.openCall.id as string);
      await loadDetail(data.openCall.id as string);
    } catch {
      setError("Could not create the open call. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function saveDetail() {
    if (!detail) return;
    setError(null);
    setNotice(null);
    if (!editTitle.trim()) {
      setError("Give the open call a title.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/open-calls/${encodeURIComponent(detail.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          deadline: editDeadline || null,
          fields: fields.map((f) => ({
            label: f.label,
            type: f.type,
            required: f.required,
            options: f.options,
          })),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not save the open call.");
        return;
      }
      setNotice("Saved.");
      await loadCalls();
      await loadDetail(detail.id);
    } catch {
      setError("Could not save the open call. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: "draft" | "published" | "closed") {
    if (!detail) return;
    setError(null);
    setNotice(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/open-calls/${encodeURIComponent(detail.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? "Could not change the status.");
        return;
      }
      setNotice(
        status === "published"
          ? `Published. Share the public link: ${publicUrl(detail.slug)}`
          : status === "closed"
            ? "Closed. The public form no longer accepts responses."
            : "Back to draft. The public link no longer works.",
      );
      await loadCalls();
      await loadDetail(detail.id);
    } catch {
      setError("Could not change the status. Try again.");
    } finally {
      setSaving(false);
    }
  }

  async function deleteCall(id: string) {
    setError(null);
    setNotice(null);
    try {
      const res = await fetch(`/api/open-calls/${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete the open call.");
      setNotice("Open call deleted.");
      setConfirmingDeleteId(null);
      if (selectedId === id) {
        setSelectedId(null);
        setDetail(null);
      }
      await loadCalls();
    } catch {
      setError("Could not delete the open call. Try again.");
    }
  }

  function addField() {
    if (!newLabel.trim()) {
      setError("Give the field a label.");
      return;
    }
    const needsOptions = newType === "select" || newType === "checkbox";
    const options = newOptions
      .split("\n")
      .map((o) => o.trim())
      .filter(Boolean);
    if (needsOptions && options.length === 0) {
      setError("A dropdown or checkbox field needs at least one choice (one per line).");
      return;
    }
    setError(null);
    setFields((current) => [
      ...current,
      { label: newLabel.trim(), type: newType, required: newRequired, options },
    ]);
    setNewLabel("");
    setNewOptions("");
    setNewRequired(false);
  }

  function moveField(index: number, direction: -1 | 1) {
    setFields((current) => {
      const next = [...current];
      const target = index + direction;
      if (target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function copyLink(slug: string) {
    try {
      await navigator.clipboard.writeText(publicUrl(slug));
      setCopied(slug);
      window.setTimeout(() => setCopied((c) => (c === slug ? null : c)), 2500);
    } catch {
      setError("Could not copy the link. Copy it from the address bar of the public page.");
    }
  }

  const selected = detail ?? calls.find((c) => c.id === selectedId) ?? null;

  return (
    <div>
      {error && (
        <p role="alert" className={styles.resultNote} style={{ color: "var(--ad-down, #9a2b2b)" }}>
          {error}
        </p>
      )}
      {notice && (
        <p role="status" className={styles.resultNote}>
          {notice}
        </p>
      )}

      <form onSubmit={createCall} style={{ display: "grid", gap: 12, marginBottom: 28 }}>
        <h2 style={{ margin: 0, fontSize: 17 }}>Create an open call</h2>
        <label className={styles.field}>
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Residency 2027: open call for painters" maxLength={160} />
        </label>
        <label className={styles.field}>
          <span>Description</span>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What is this call for, who can apply, what happens next…" rows={3} />
        </label>
        <label className={styles.field}>
          <span>Deadline (optional)</span>
          <input type="datetime-local" value={deadline} onChange={(e) => setDeadline(e.target.value)} />
        </label>
        <div>
          <button type="submit" className="primary-button" disabled={saving}>
            {saving ? "Creating…" : "Create open call"}
          </button>
        </div>
      </form>

      {!loaded ? (
        <div className={styles.emptyBox}>
          <strong>Loading your open calls…</strong>
        </div>
      ) : loadError ? (
        <div className={styles.emptyBox}>
          <strong>Could not load your open calls.</strong>
          <p>{loadError}</p>
        </div>
      ) : calls.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No open calls yet.</strong>
          <p>Create one above: give it a title, build its form, publish it, and share the public link.</p>
        </div>
      ) : (
        <div className={styles.tableScroll} style={{ marginBottom: 28 }}>
          <table className={styles.inventoryTable}>
            <thead>
              <tr>
                <th>Title</th>
                <th>Status</th>
                <th>Deadline</th>
                <th>Fields</th>
                <th>Responses</th>
                <th>Public link</th>
                <th aria-label="Actions" />
              </tr>
            </thead>
            <tbody>
              {calls.map((call) => (
                <tr key={call.id} style={selectedId === call.id ? { background: "var(--room-color)" } : undefined}>
                  <td>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedId(call.id);
                        void loadDetail(call.id);
                      }}
                      style={{ background: "none", border: "none", padding: 0, cursor: "pointer", color: "var(--ink)", font: "inherit", fontWeight: 600, textAlign: "left" }}
                    >
                      {call.title}
                    </button>
                  </td>
                  <td>{STATUS_LABEL[call.status] ?? call.status}</td>
                  <td>{call.deadline ? new Date(call.deadline).toLocaleDateString("en-GB") : "No deadline"}</td>
                  <td>{call.fieldCount}</td>
                  <td>{call.responseCount}</td>
                  <td>
                    {call.status === "published" ? (
                      <button type="button" className={styles.iconButton} onClick={() => void copyLink(call.slug)} title={publicUrl(call.slug)}>
                        {copied === call.slug ? "Copied" : "Copy link"}
                      </button>
                    ) : (
                      "Not published"
                    )}
                  </td>
                  <td>
                    {confirmingDeleteId === call.id ? (
                      <span style={{ display: "inline-flex", gap: 6 }}>
                        <button type="button" className={styles.iconButton} onClick={() => void deleteCall(call.id)}>
                          Confirm delete
                        </button>
                        <button type="button" className={styles.iconButton} onClick={() => setConfirmingDeleteId(null)}>
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button type="button" className={styles.iconButton} onClick={() => setConfirmingDeleteId(call.id)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedId && detailLoading && (
        <div className={styles.emptyBox}>
          <strong>Loading the open call…</strong>
        </div>
      )}

      {detail && selected && (
        <div>
          <h2 style={{ margin: "0 0 4px", fontSize: 20 }}>{selected.title}</h2>
          <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: 13 }}>
            {STATUS_LABEL[selected.status] ?? selected.status}
            {selected.deadline ? ` · Deadline ${new Date(selected.deadline).toLocaleString("en-GB")}` : " · No deadline"}
            {selected.status === "published" ? (
              <>
                {" · "}
                <a href={publicUrl(selected.slug)} target="_blank" rel="noreferrer">
                  {publicUrl(selected.slug)}
                </a>
              </>
            ) : null}
          </p>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
            {selected.status !== "published" && (
              <button type="button" className="primary-button" onClick={() => void setStatus("published")} disabled={saving || fields.length === 0}>
                Publish
              </button>
            )}
            {selected.status === "published" && (
              <button type="button" className="primary-button" onClick={() => void setStatus("closed")} disabled={saving}>
                Close the call
              </button>
            )}
            {selected.status === "closed" && (
              <button type="button" className="primary-button" onClick={() => void setStatus("published")} disabled={saving}>
                Reopen
              </button>
            )}
            {selected.status === "published" && (
              <button type="button" className={styles.iconButton} onClick={() => void setStatus("draft")} disabled={saving}>
                Back to draft
              </button>
            )}
            <span style={{ fontSize: 13, color: "var(--muted)", alignSelf: "center" }}>
              {fields.length === 0
                ? "Add at least one field below before publishing."
                : "Publishing makes the public link live."}
            </span>
          </div>

          <h3 style={{ fontSize: 15, margin: "0 0 10px" }}>Details</h3>
          <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
            <label className={styles.field}>
              <span>Title</span>
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} maxLength={160} />
            </label>
            <label className={styles.field}>
              <span>Description</span>
              <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
            </label>
            <label className={styles.field}>
              <span>Deadline (optional)</span>
              <input type="datetime-local" value={editDeadline} onChange={(e) => setEditDeadline(e.target.value)} />
            </label>
          </div>

          <h3 style={{ fontSize: 15, margin: "0 0 10px" }}>Form fields ({fields.length})</h3>
          {fields.length === 0 ? (
            <div className={styles.emptyBox} style={{ marginBottom: 16 }}>
              <strong>No fields yet.</strong>
              <p>Add the questions applicants must answer: a name, an email, a portfolio link, a file…</p>
            </div>
          ) : (
            <ul style={{ listStyle: "none", margin: "0 0 16px", padding: 0, display: "grid", gap: 8 }}>
              {fields.map((field, index) => (
                <li
                  key={field.id ?? `new-${index}`}
                  style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", border: "1px solid var(--line)", borderRadius: 8, padding: "10px 12px" }}
                >
                  <strong style={{ fontSize: 14 }}>{field.label}</strong>
                  <span style={{ fontSize: 13, color: "var(--muted)" }}>
                    {OPEN_CALL_FIELD_LABELS[field.type]}
                    {field.required ? " · Required" : " · Optional"}
                    {field.options.length > 0 ? ` · ${field.options.join(", ")}` : ""}
                  </span>
                  <span style={{ marginLeft: "auto", display: "inline-flex", gap: 6 }}>
                    <button type="button" className={styles.iconButton} onClick={() => moveField(index, -1)} disabled={index === 0} aria-label="Move up">
                      ↑
                    </button>
                    <button type="button" className={styles.iconButton} onClick={() => moveField(index, 1)} disabled={index === fields.length - 1} aria-label="Move down">
                      ↓
                    </button>
                    <button type="button" className={styles.iconButton} onClick={() => setFields((c) => c.filter((_, i) => i !== index))}>
                      Remove
                    </button>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "end", marginBottom: 16 }}>
            <label className={styles.field} style={{ minWidth: 220, flex: 1 }}>
              <span>New field label</span>
              <input value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Portfolio link" maxLength={120} />
            </label>
            <label className={styles.field}>
              <span>Type</span>
              <select value={newType} onChange={(e) => setNewType(e.target.value as OpenCallFieldType)}>
                {OPEN_CALL_FIELD_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {OPEN_CALL_FIELD_LABELS[type]}
                  </option>
                ))}
              </select>
            </label>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, paddingBottom: 10 }}>
              <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)} />
              Required
            </label>
            <button type="button" className="primary-button" onClick={addField}>
              Add field
            </button>
          </div>
          {(newType === "select" || newType === "checkbox") && (
            <label className={styles.field} style={{ marginBottom: 16 }}>
              <span>Choices (one per line)</span>
              <textarea value={newOptions} onChange={(e) => setNewOptions(e.target.value)} rows={3} placeholder={"Painting\nSculpture\nPhotography"} />
            </label>
          )}
          <div style={{ marginBottom: 28 }}>
            <button type="button" className="primary-button" onClick={() => void saveDetail()} disabled={saving}>
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>

          <div
            style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", margin: "0 0 10px" }}
          >
            <h3 style={{ fontSize: 15, margin: 0 }}>Responses ({detail.responses.length})</h3>
            {detail.responses.length > 0 && (
              <a
                className="primary-button"
                href={`/api/open-calls/${encodeURIComponent(detail.id)}/export`}
                style={{ marginLeft: "auto", textDecoration: "none" }}
              >
                Download responses (CSV)
              </a>
            )}
          </div>
          <p style={{ fontSize: 13, color: "#555", margin: "0 0 14px" }}>
            The CSV holds every response with its files as download links. To hang a
            submitted work in one of your exhibitions, use “Add to exhibition” on its
            row: the file is copied into your library and added to the exhibition you
            choose.
          </p>
          {detail.responses.length === 0 ? (
            <div className={styles.emptyBox}>
              <strong>No responses yet.</strong>
              <p>Once the call is published and shared, applications appear here.</p>
            </div>
          ) : (
            <div className={styles.tableScroll}>
              <table className={styles.inventoryTable}>
                <thead>
                  <tr>
                    <th>Received</th>
                    {detail.fields.map((field) => (
                      <th key={field.id ?? field.label}>{field.label}</th>
                    ))}
                    <th>Use it</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.responses.map((response) => (
                    <tr key={response.id}>
                      <td>{new Date(response.createdAt).toLocaleString("en-GB")}</td>
                      {detail.fields.map((field) => {
                        const value = field.id ? response.answers[field.id] : undefined;
                        const file = value as { key?: string; name?: string } | undefined;
                        return (
                          <td key={field.id ?? field.label}>
                            {field.type === "file" && file && typeof file === "object" && file.key ? (
                              <a href={`/api/open-calls/files/${file.key}`} target="_blank" rel="noreferrer">
                                {file.name ?? "File"}
                              </a>
                            ) : (
                              answerText(value)
                            )}
                          </td>
                        );
                      })}
                      <td>
                        <button
                          type="button"
                          className={styles.iconButton}
                          onClick={() => openImport(response)}
                        >
                          Add to exhibition
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {importResponseId && detail && (
            <div
              style={{
                marginTop: 20,
                padding: 16,
                border: "1px solid #ddd",
                borderRadius: 10,
                background: "#faf9f6",
              }}
            >
              <h4 style={{ fontSize: 15, margin: "0 0 6px" }}>Add to exhibition</h4>
              <p style={{ fontSize: 13, color: "#555", margin: "0 0 14px" }}>
                Response received{" "}
                {new Date(
                  detail.responses.find((r) => r.id === importResponseId)?.createdAt ?? "",
                ).toLocaleString("en-GB")}
                . Each image below becomes a work in the exhibition you choose, and
                joins your library (“Mes œuvres”). The submission itself stays
                untouched.
              </p>
              {exhibitions.length === 0 ? (
                <p style={{ fontSize: 13 }}>
                  You have no exhibition yet.{" "}
                  <a href="/dashboard">Create one in your dashboard first</a>, then come back
                  here.
                </p>
              ) : (
                <>
                  <label className={styles.field} style={{ maxWidth: 420, marginBottom: 14 }}>
                    <span>Exhibition</span>
                    <select
                      value={importExhibitionId}
                      onChange={(e) => setImportExhibitionId(e.target.value)}
                    >
                      {exhibitions.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.title}
                        </option>
                      ))}
                    </select>
                  </label>
                  {importWorks.length === 0 ? (
                    <p style={{ fontSize: 13 }}>
                      This response has no image file to hang (only PDFs or no files).
                      Download its files from the table above instead.
                    </p>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12, marginBottom: 14 }}>
                      {importWorks.map((work, index) => (
                        <div
                          key={work.fileFieldId}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            padding: 12,
                            border: "1px solid #e3e0d9",
                            borderRadius: 8,
                            background: "#fff",
                          }}
                        >
                          <label
                            style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}
                          >
                            <input
                              type="checkbox"
                              checked={work.selected}
                              onChange={(e) =>
                                setImportWorks((current) =>
                                  current.map((w, i) =>
                                    i === index ? { ...w, selected: e.target.checked } : w,
                                  ),
                                )
                              }
                            />
                            <a
                              href={`/api/open-calls/files/${work.fileKey}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {work.fileName}
                            </a>
                          </label>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                              gap: 8,
                            }}
                          >
                            <label className={styles.field} style={{ margin: 0 }}>
                              <span>Title</span>
                              <input
                                value={work.title}
                                onChange={(e) =>
                                  setImportWorks((current) =>
                                    current.map((w, i) =>
                                      i === index ? { ...w, title: e.target.value } : w,
                                    ),
                                  )
                                }
                                maxLength={200}
                              />
                            </label>
                            <label className={styles.field} style={{ margin: 0 }}>
                              <span>Artist</span>
                              <input
                                value={work.artist}
                                onChange={(e) =>
                                  setImportWorks((current) =>
                                    current.map((w, i) =>
                                      i === index ? { ...w, artist: e.target.value } : w,
                                    ),
                                  )
                                }
                                maxLength={200}
                              />
                            </label>
                            <label className={styles.field} style={{ margin: 0 }}>
                              <span>Medium</span>
                              <input
                                value={work.medium}
                                onChange={(e) =>
                                  setImportWorks((current) =>
                                    current.map((w, i) =>
                                      i === index ? { ...w, medium: e.target.value } : w,
                                    ),
                                  )
                                }
                                maxLength={200}
                              />
                            </label>
                            <label className={styles.field} style={{ margin: 0 }}>
                              <span>Dimensions</span>
                              <input
                                value={work.dimensions}
                                onChange={(e) =>
                                  setImportWorks((current) =>
                                    current.map((w, i) =>
                                      i === index ? { ...w, dimensions: e.target.value } : w,
                                    ),
                                  )
                                }
                                maxLength={100}
                              />
                            </label>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => void runImport()}
                      disabled={
                        importing || importWorks.filter((w) => w.selected).length === 0
                      }
                    >
                      {importing
                        ? "Adding…"
                        : `Add ${importWorks.filter((w) => w.selected).length} work${
                            importWorks.filter((w) => w.selected).length > 1 ? "s" : ""
                          } to exhibition`}
                    </button>
                    <button
                      type="button"
                      className={styles.iconButton}
                      onClick={() => {
                        setImportResponseId(null);
                        setImportResult(null);
                        setImportError(null);
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </>
              )}
              {importError && (
                <p style={{ color: "#a00", fontSize: 13, margin: "12px 0 0" }}>{importError}</p>
              )}
              {importResult && (
                <p style={{ color: "#1a7a2e", fontSize: 13, margin: "12px 0 0" }}>
                  Added {importResult.count} work{importResult.count > 1 ? "s" : ""} to “
                  {importResult.exhibitionTitle}”.{" "}
                  <a href={`/editor/${importResult.exhibitionId}`}>Open the exhibition</a> to
                  arrange them on the wall.
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
