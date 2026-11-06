"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import styles from "./tools.module.css";
import ProviderPanel, { ModelIntegrationNote } from "@/components/ai-provider-panel";
import type { AiProviderStatus } from "@/lib/ai-providers";
import {
  arrangementSuggestions,
  conceptDraft,
  CONCEPT_THEMES,
  installationChecklist,
  lightingSuggestions,
  recommendTemplates,
  wallColoursFrom,
  type AiArtworkLike,
  type RoomTemplateLike,
} from "@/lib/ai-rules";

// ---------------------------------------------------------------------------
// AI Exhibition Architect — rules-based exhibition planning from the user's
// own data. Concept drafts, arrangement, template matches, lighting and
// wall colours are all computed from artworks, dimensions, colours, rooms
// and the 40 templates. The two things that genuinely need a model
// (free-text concept writing, natural-language arrangement advice) are
// labelled integration points that call /api/ai/generate — and stay off
// with an honest "not connected" note until a provider is configured.
// ---------------------------------------------------------------------------

export type ArchitectRoom = {
  id: string;
  name: string;
  layout: string;
  lightType: string;
  wallColor: string;
  exhibitionTitle: string;
};

type SavedConcept = {
  id: string;
  title: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
};

type JourneyStop = { id: string; roomId: string; note: string };

const S: Record<string, CSSProperties> = {
  section: { marginBottom: 36 },
  sectionTitle: { margin: "0 0 4px", fontFamily: "var(--font-display), Georgia, serif", fontSize: 20, fontWeight: 600 },
  sectionNote: { margin: "0 0 16px", color: "var(--muted)", fontSize: 13, lineHeight: 1.5 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 12 },
  card: {
    padding: 0,
    border: "1px solid var(--line)",
    borderRadius: 10,
    background: "var(--surface-3, #fff)",
    overflow: "hidden",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
  },
  thumb: { display: "block", width: "100%", height: 110, objectFit: "cover", background: "var(--room-color)" },
  cardBody: { padding: "10px 12px 12px" },
  cardTitle: { margin: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.3 },
  cardMeta: { margin: "4px 0 0", color: "var(--muted)", fontSize: 11, lineHeight: 1.4 },
  field: { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 600 },
  select: {
    minHeight: 40, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 8,
    background: "var(--surface-3, #fff)", color: "var(--ink)", fontSize: 13, fontFamily: "inherit",
  },
  input: {
    minHeight: 40, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 8,
    background: "var(--surface-3, #fff)", color: "var(--ink)", fontSize: 13, fontFamily: "inherit",
  },
  textarea: {
    width: "100%", minHeight: 140, padding: "12px", border: "1px solid var(--line)", borderRadius: 8,
    background: "var(--surface-3, #fff)", color: "var(--ink)", fontSize: 13, lineHeight: 1.65,
    fontFamily: "inherit", resize: "vertical" as const, boxSizing: "border-box" as const,
  },
  ghostButton: {
    minHeight: 40, padding: "0 14px", border: "1px solid var(--line)", borderRadius: 8,
    background: "transparent", color: "var(--ink)", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit",
  },
  controls: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 16 },
  status: { margin: "12px 0 0", color: "var(--muted)", fontSize: 13, lineHeight: 1.55 },
  errorBox: {
    padding: 14, border: "1px solid #c0392b", borderRadius: 10, background: "#fdf3f2",
    color: "#7b241c", fontSize: 13, lineHeight: 1.55,
  },
  infoBox: {
    padding: 14, border: "1px solid var(--line)", borderRadius: 10, background: "var(--room-color)",
    fontSize: 13, lineHeight: 1.6, marginBottom: 16,
  },
  listItem: {
    border: "1px solid var(--line)", borderRadius: 10, padding: "12px 14px",
    background: "var(--surface-3, #fff)", marginBottom: 10,
  },
  listTitle: { margin: "0 0 4px", fontSize: 14, fontWeight: 700 },
  listText: { margin: 0, color: "var(--muted)", fontSize: 12, lineHeight: 1.55 },
  chip: {
    display: "inline-block", padding: "3px 9px", borderRadius: 999, fontSize: 11, fontWeight: 700,
    background: "var(--room-color)", border: "1px solid var(--line)", marginRight: 6, marginBottom: 4,
  },
  swatch: { width: 26, height: 26, borderRadius: 6, border: "1px solid rgba(0,0,0,0.12)", flexShrink: 0 },
  savedRow: {
    display: "flex", gap: 10, alignItems: "center", padding: "12px 0",
    borderBottom: "1px solid var(--line)", flexWrap: "wrap",
  },
  board: {
    border: "1px solid var(--line)", borderRadius: 12, overflow: "hidden",
    background: "var(--surface-3, #fff)",
  },
  boardHeader: { padding: "16px 18px 0" },
  boardTitle: { margin: "0 0 4px", fontFamily: "var(--font-display), Georgia, serif", fontSize: 22, fontWeight: 600 },
  checkRow: { display: "flex", gap: 10, alignItems: "flex-start", padding: "10px 0", borderBottom: "1px solid var(--line)", fontSize: 13, lineHeight: 1.5 },
};

function uid(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export default function AiArchitect({
  artworks,
  templates,
  rooms,
  providerStatus,
}: {
  artworks: AiArtworkLike[];
  templates: RoomTemplateLike[];
  rooms: ArchitectRoom[];
  providerStatus: AiProviderStatus;
}) {
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [theme, setTheme] = useState<string>(CONCEPT_THEMES[0]);
  const [concept, setConcept] = useState("");
  const [conceptSource, setConceptSource] = useState<"template" | "model" | "edited" | "">("");
  const [templateKey, setTemplateKey] = useState<string>("");
  const [roomId, setRoomId] = useState<string>("");
  const [journey, setJourney] = useState<JourneyStop[]>([]);
  const [journeyNote, setJourneyNote] = useState("");
  const [checks, setChecks] = useState<Record<string, boolean>>({});
  const [saveName, setSaveName] = useState("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedConcept[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [modelBusy, setModelBusy] = useState<"concept" | "advice" | null>(null);
  const [modelError, setModelError] = useState<string | null>(null);
  const [modelAdvice, setModelAdvice] = useState<{ text: string; model: string; provider: string } | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const boardRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => selectedIds.map((id) => artworks.find((a) => a.id === id)!).filter(Boolean),
    [selectedIds, artworks],
  );
  const selectedTemplate = templates.find((t) => t.key === templateKey) ?? null;
  const selectedRoom = rooms.find((r) => r.id === roomId) ?? null;

  const arrangement = useMemo(() => arrangementSuggestions(selected), [selected]);
  const recommendations = useMemo(() => recommendTemplates(templates, selected), [templates, selected]);
  const dominantHexes = useMemo(
    () => [...new Set(selected.flatMap((a) => [a.color, a.accent]).filter(Boolean) as string[])].slice(0, 6),
    [selected],
  );
  const wallColours = useMemo(
    () => (dominantHexes.length > 0 ? wallColoursFrom(dominantHexes[0]) : []),
    [dominantHexes],
  );
  const lighting = useMemo(
    () => lightingSuggestions(selectedRoom?.lightType ?? "spot-warm", selected, dominantHexes),
    [selectedRoom, selected, dominantHexes],
  );
  const checklist = useMemo(
    () => installationChecklist(selected, journey.map((j) => rooms.find((r) => r.id === j.roomId)?.name ?? j.roomId)),
    [selected, journey, rooms],
  );

  const loadSaved = useCallback(async () => {
    setSavedLoading(true);
    try {
      const res = await fetch("/api/saved-work?kind=ai-concept");
      if (!res.ok) throw new Error("fetch");
      const json = (await res.json()) as { saved?: SavedConcept[] };
      setSaved(json.saved ?? []);
    } catch {
      setSaved([]);
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  const toggleArtwork = useCallback((id: string) => {
    setSelectedIds((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  }, []);

  const generateConceptDraft = useCallback(() => {
    setConcept(conceptDraft(theme, selected, selectedTemplate?.label));
    setConceptSource("template");
    setModelError(null);
  }, [theme, selected, selectedTemplate]);

  const generateWithModel = useCallback(async () => {
    if (!providerStatus.configured) return;
    setModelBusy("concept");
    setModelError(null);
    try {
      const prompt = [
        `Write a short exhibition concept (120-180 words) for a show themed "${theme}".`,
        `Works: ${selected.map((a) => `${a.title} (${a.medium ?? "medium unknown"}${a.dimensions ? `, ${a.dimensions}` : ""})`).join("; ") || "none selected yet"}.`,
        selectedTemplate ? `Room: ${selectedTemplate.label} (${selectedTemplate.width} × ${selectedTemplate.depth} m).` : "",
        "Plain, human language. No hype, no invented artist biography or provenance.",
      ].join("\n");
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          system: "You write exhibition concepts for a gallery. Keep it concrete and honest.",
        }),
      });
      const json = (await res.json()) as { text?: string; model?: string; provider?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Model request failed.");
      setConcept(json.text ?? "");
      setConceptSource("model");
    } catch (err) {
      setModelError(err instanceof Error ? err.message : "Model request failed.");
    } finally {
      setModelBusy(null);
    }
  }, [providerStatus.configured, theme, selected, selectedTemplate]);

  const askModelAdvice = useCallback(async () => {
    if (!providerStatus.configured || selected.length === 0) return;
    setModelBusy("advice");
    setModelError(null);
    setModelAdvice(null);
    try {
      const prompt = [
        "Give arrangement advice for hanging these works in one room. Be concrete and practical.",
        ...selected.map(
          (a) => `- ${a.title}: ${a.medium ?? "medium unknown"}${a.dimensions ? `, ${a.dimensions}` : ""}, dominant colour ${a.color ?? "unknown"}`,
        ),
        selectedTemplate ? `Room: ${selectedTemplate.label}, ${selectedTemplate.width} × ${selectedTemplate.depth} m.` : "",
        "Do not invent facts about the works beyond what is listed.",
      ].join("\n");
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          system: "You are a gallery hanging advisor. Concrete, practical, honest about uncertainty.",
          maxTokens: 600,
        }),
      });
      const json = (await res.json()) as { text?: string; model?: string; provider?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Model request failed.");
      setModelAdvice({ text: json.text ?? "", model: json.model ?? "", provider: json.provider ?? "" });
    } catch (err) {
      setModelError(err instanceof Error ? err.message : "Model request failed.");
    } finally {
      setModelBusy(null);
    }
  }, [providerStatus.configured, selected, selectedTemplate]);

  const addJourneyStop = useCallback(() => {
    if (!roomId) return;
    setJourney((current) => [...current, { id: uid(), roomId, note: journeyNote.trim() }]);
    setJourneyNote("");
  }, [roomId, journeyNote]);

  const moveJourneyStop = useCallback((id: string, direction: -1 | 1) => {
    setJourney((current) => {
      const idx = current.findIndex((s) => s.id === id);
      const next = idx + direction;
      if (idx < 0 || next < 0 || next >= current.length) return current;
      const copy = [...current];
      [copy[idx], copy[next]] = [copy[next], copy[idx]];
      return copy;
    });
  }, []);

  const saveConcept = useCallback(async () => {
    if (selected.length === 0 && !concept.trim()) return;
    const title = saveName.trim() || `${theme} — ${selected.length} work${selected.length === 1 ? "" : "s"}`;
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch("/api/saved-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "ai-concept",
          title,
          data: {
            theme,
            concept,
            conceptSource,
            artworkIds: selectedIds,
            templateKey: templateKey || null,
            journey: journey.map((j) => ({ roomId: j.roomId, note: j.note })),
            checklist: checklist.map((c) => ({ label: c.label, done: checks[c.label] ?? false })),
          },
        }),
      });
      if (!res.ok) throw new Error("save");
      setSaveStatus(`Saved as “${title}”.`);
      setSaveName("");
      await loadSaved();
    } catch {
      setSaveStatus("Could not save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }, [selected, concept, saveName, theme, conceptSource, selectedIds, templateKey, journey, checklist, checks, loadSaved]);

  const loadConcept = useCallback(
    (item: SavedConcept) => {
      const data = item.data;
      if (typeof data.theme === "string") setTheme(data.theme);
      if (typeof data.concept === "string") {
        setConcept(data.concept);
        setConceptSource((data.conceptSource as "template" | "model" | "edited") || "edited");
      }
      if (Array.isArray(data.artworkIds)) {
        setSelectedIds(data.artworkIds.filter((id): id is string => typeof id === "string"));
      }
      if (typeof data.templateKey === "string") setTemplateKey(data.templateKey);
      if (Array.isArray(data.journey)) {
        setJourney(
          data.journey
            .filter((j): j is { roomId: string; note?: string } => !!j && typeof (j as { roomId?: unknown }).roomId === "string")
            .map((j) => ({ id: uid(), roomId: j.roomId, note: j.note ?? "" })),
        );
      }
      setSaveStatus(`Loaded “${item.title}”. Edit anything — nothing is overwritten until you save again.`);
    },
    [],
  );

  const deleteSaved = useCallback(
    async (id: string) => {
      await fetch(`/api/saved-work?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setConfirmDeleteId(null);
      await loadSaved();
    },
    [loadSaved],
  );

  const renameSaved = useCallback(
    async (id: string) => {
      const title = renameValue.trim();
      if (!title) return;
      await fetch("/api/saved-work", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title }),
      });
      setRenameId(null);
      await loadSaved();
    },
    [renameValue, loadSaved],
  );

  const downloadMoodboard = useCallback(() => {
    if (selected.length === 0) return;
    const width = 1200;
    const pad = 56;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    const titleH = 110;
    const thumbH = 300;
    const swatchH = 90;
    canvas.height = pad * 2 + titleH + thumbH + 40 + swatchH + 60;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = selectedTemplate?.wallColor ?? "#f5f2eb";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#000000";
    ctx.font = "700 20px 'DM Sans', sans-serif";
    ctx.fillText("SANAA · AI EXHIBITION ARCHITECT", pad, pad + 8);
    ctx.fillStyle = "#141414";
    ctx.font = "600 46px Georgia, serif";
    ctx.fillText(`${theme} — moodboard`, pad, pad + 66, width - pad * 2);
    // Thumbs: real images where they load, recorded colour blocks otherwise.
    const thumbs = selected.slice(0, 4);
    const thumbW = (width - pad * 2 - (thumbs.length - 1) * 16) / thumbs.length;
    const drawFallback = (index: number, artwork: AiArtworkLike) => {
      const x = pad + index * (thumbW + 16);
      const y = pad + titleH;
      ctx.fillStyle = artwork.color ?? "#b8a184";
      ctx.fillRect(x, y, thumbW, thumbH);
      ctx.fillStyle = "#141414";
      ctx.font = "600 22px 'DM Sans', sans-serif";
      ctx.fillText(artwork.title, x, y + thumbH + 32, thumbW);
    };
    let pending = thumbs.length;
    const finish = () => {
      // Palette strip.
      const palette = dominantHexes.slice(0, 6);
      const swatchW = palette.length > 0 ? (width - pad * 2 - (palette.length - 1) * 12) / palette.length : 0;
      palette.forEach((hex, i) => {
        const x = pad + i * (swatchW + 12);
        const y = pad + titleH + thumbH + 40;
        ctx.fillStyle = hex;
        ctx.fillRect(x, y, swatchW, swatchH);
        ctx.fillStyle = "#141414";
        ctx.font = "700 20px 'DM Sans', sans-serif";
        ctx.fillText(hex, x, y + swatchH + 32);
      });
      canvas.toBlob((blob) => {
        if (!blob) return;
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `moodboard-${theme.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }, "image/png");
    };
    if (thumbs.length === 0) {
      finish();
      return;
    }
    thumbs.forEach((artwork, index) => {
      const x = pad + index * (thumbW + 16);
      const y = pad + titleH;
      if (!artwork.imageUrl) {
        drawFallback(index, artwork);
        if (--pending === 0) finish();
        return;
      }
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const scale = Math.max(thumbW / img.naturalWidth, thumbH / img.naturalHeight);
        const dw = img.naturalWidth * scale;
        const dh = img.naturalHeight * scale;
        ctx.save();
        ctx.beginPath();
        ctx.rect(x, y, thumbW, thumbH);
        ctx.clip();
        ctx.drawImage(img, x + (thumbW - dw) / 2, y + (thumbH - dh) / 2, dw, dh);
        ctx.restore();
        ctx.fillStyle = "#141414";
        ctx.font = "600 22px 'DM Sans', sans-serif";
        ctx.fillText(artwork.title, x, y + thumbH + 32, thumbW);
        if (--pending === 0) finish();
      };
      img.onerror = () => {
        drawFallback(index, artwork);
        if (--pending === 0) finish();
      };
      img.src = artwork.imageUrl;
    });
  }, [selected, theme, selectedTemplate, dominantHexes]);

  return (
    <div>
      <ProviderPanel status={providerStatus} />

      {artworks.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No artworks yet.</strong>
          <p>
            Add a work with an image in the editor and it will show up here — the Architect plans
            from your real works, not from placeholders.
          </p>
        </div>
      ) : (
        <>
          {/* 1 — Select works ------------------------------------------------ */}
          <section style={S.section}>
            <h2 style={S.sectionTitle}>1 · Choose the works</h2>
            <p style={S.sectionNote}>
              Tick the works for this show. Every suggestion below is computed from these works —
              their sizes, colours and media.
            </p>
            <div style={S.grid}>
              {artworks.map((artwork) => {
                const active = selectedIds.includes(artwork.id);
                return (
                  <button
                    key={artwork.id}
                    type="button"
                    onClick={() => toggleArtwork(artwork.id)}
                    style={{
                      ...S.card,
                      outline: active ? "2px solid var(--accent)" : "none",
                      outlineOffset: 1,
                    }}
                    aria-pressed={active}
                  >
                    {artwork.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={artwork.imageUrl} alt={artwork.title} style={S.thumb} loading="lazy" />
                    ) : (
                      <span style={{ ...S.thumb, background: artwork.color ?? "#b8a184", display: "block" }} />
                    )}
                    <span style={{ ...S.cardBody, display: "block" }}>
                      <span style={{ ...S.cardTitle, display: "block" }}>{artwork.title}</span>
                      <span style={{ ...S.cardMeta, display: "block" }}>
                        {artwork.medium}
                        {artwork.dimensions ? ` · ${artwork.dimensions}` : ""} · {artwork.exhibitionTitle}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
            {selected.length > 0 && (
              <p style={S.status}>
                {selected.length} work{selected.length === 1 ? "" : "s"} selected.{" "}
                <button
                  type="button"
                  style={{ ...S.ghostButton, minHeight: 30, padding: "0 10px" }}
                  onClick={() => setSelectedIds([])}
                >
                  Clear selection
                </button>
              </p>
            )}
          </section>

          {selected.length === 0 && (
            <div className={styles.emptyBox}>
              <strong>Nothing planned yet.</strong>
              <p>Select at least one work above and the concept, arrangement, room matches and plan will appear.</p>
            </div>
          )}

          {selected.length > 0 && (
            <>
              {/* 2 — Concept ------------------------------------------------- */}
              <section style={S.section}>
                <h2 style={S.sectionTitle}>2 · Concept</h2>
                <p style={S.sectionNote}>
                  Pick a theme and generate a draft from a template — the draft names your actual
                  works. Edit it freely; generating again never overwrites your edits without
                  asking.
                </p>
                <div style={S.controls}>
                  <label style={S.field}>
                    Theme
                    <select style={S.select} value={theme} onChange={(e) => setTheme(e.target.value)}>
                      {CONCEPT_THEMES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="button" className="galleries-open-button" onClick={generateConceptDraft}>
                    Generate draft from template
                  </button>
                  <button
                    type="button"
                    style={S.ghostButton}
                    onClick={() => void generateWithModel()}
                    disabled={!providerStatus.configured || modelBusy === "concept"}
                  >
                    {modelBusy === "concept" ? "Writing…" : "Write with a model"}
                  </button>
                </div>
                <ModelIntegrationNote
                  status={providerStatus}
                  feature="Free-text concept writing"
                />
                <textarea
                  style={{ ...S.textarea, marginTop: 12 }}
                  value={concept}
                  onChange={(e) => {
                    setConcept(e.target.value);
                    setConceptSource("edited");
                  }}
                  placeholder="Your concept draft will appear here — or write your own."
                  aria-label="Exhibition concept draft"
                />
                {conceptSource && (
                  <p style={S.status}>
                    {conceptSource === "template" && "Draft generated from a template — edit it to make it yours."}
                    {conceptSource === "model" && `Draft written by ${providerStatus.label}${providerStatus.model ? ` (${providerStatus.model})` : ""} — check it before use.`}
                    {conceptSource === "edited" && "Edited by you."}
                  </p>
                )}
                {modelError && (
                  <div style={{ ...S.errorBox, marginTop: 12 }} role="alert">
                    <strong>Model request failed.</strong>
                    <br />
                    {modelError}
                  </div>
                )}
              </section>

              {/* 3 — Arrangement -------------------------------------------- */}
              <section style={S.section}>
                <h2 style={S.sectionTitle}>3 · Arrangement</h2>
                <p style={S.sectionNote}>
                  Computed from your works' sizes and recorded colours. Largest works anchor the
                  walls; works that share a colour family hang together.
                </p>
                <div style={S.infoBox}>
                  <strong>Suggested sequence:</strong> {arrangement.sequence.map((id) => artworks.find((a) => a.id === id)?.title).join(" → ")}
                  <br />
                  <span style={{ color: "var(--muted)" }}>{arrangement.sequenceReason}</span>
                </div>
                {arrangement.groups.map((group) => (
                  <div key={group.id} style={S.listItem}>
                    <p style={S.listTitle}>{group.label}</p>
                    <p style={S.listText}>{group.reason}</p>
                    <p style={{ margin: "8px 0 0" }}>
                      {group.artworkIds.map((id) => {
                        const a = artworks.find((x) => x.id === id);
                        return a ? <span key={id} style={S.chip}>{a.title}</span> : null;
                      })}
                      {group.artworkIds.includes(arrangement.anchors.find((x) => group.artworkIds.includes(x)) ?? "") && (
                        <span style={{ ...S.chip, background: "#e7f2e4" }}>anchor</span>
                      )}
                    </p>
                  </div>
                ))}
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    style={S.ghostButton}
                    onClick={() => void askModelAdvice()}
                    disabled={!providerStatus.configured || modelBusy === "advice"}
                  >
                    {modelBusy === "advice" ? "Asking…" : "Ask a model for arrangement advice"}
                  </button>
                  <ModelIntegrationNote status={providerStatus} feature="Natural-language arrangement advice" />
                  {modelAdvice && (
                    <div style={{ ...S.infoBox, marginTop: 12 }}>
                      <strong>Model advice — {modelAdvice.provider} ({modelAdvice.model}):</strong>
                      <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{modelAdvice.text}</p>
                    </div>
                  )}
                </div>
              </section>

              {/* 4 — Room & template ---------------------------------------- */}
              <section style={S.section}>
                <h2 style={S.sectionTitle}>4 · Room &amp; template</h2>
                <p style={S.sectionNote}>
                  The 40 gallery templates, ranked by how well they fit your selected works — wall
                  length, widest work and mood.
                </p>
                <div style={S.controls}>
                  <label style={{ ...S.field, flex: 1, minWidth: 220 }}>
                    Your room (for lighting advice)
                    <select style={S.select} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                      <option value="">No specific room</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} — {r.exhibitionTitle}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ ...S.field, flex: 1, minWidth: 220 }}>
                    Template for this show
                    <select style={S.select} value={templateKey} onChange={(e) => setTemplateKey(e.target.value)}>
                      <option value="">Choose a template…</option>
                      {templates.map((t) => (
                        <option key={t.key} value={t.key}>
                          {t.label} — {t.width} × {t.depth} m
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {recommendations.map((rec) => (
                  <div
                    key={rec.key}
                    style={{
                      ...S.listItem,
                      outline: templateKey === rec.key ? "2px solid var(--accent)" : "none",
                    }}
                  >
                    <p style={S.listTitle}>
                      {rec.label} <span style={{ color: "var(--muted)", fontWeight: 400 }}>· {rec.category} · fit score {rec.score}</span>
                    </p>
                    <ul style={{ margin: "6px 0 8px", paddingLeft: 18, color: "var(--muted)", fontSize: 12, lineHeight: 1.6 }}>
                      {rec.reasons.map((reason, i) => (
                        <li key={i}>{reason}</li>
                      ))}
                    </ul>
                    <button type="button" style={S.ghostButton} onClick={() => setTemplateKey(rec.key)}>
                      {templateKey === rec.key ? "Selected" : "Use this template"}
                    </button>
                  </div>
                ))}
              </section>

              {/* 5 — Lighting & wall colours -------------------------------- */}
              <section style={S.section}>
                <h2 style={S.sectionTitle}>5 · Light &amp; wall colour</h2>
                <p style={S.sectionNote}>
                  Rule-based, from the room's light type and the selected works' recorded colours.
                </p>
                {lighting.map((tip, i) => (
                  <div key={i} style={S.listItem}>
                    <p style={S.listTitle}>{tip.title}</p>
                    <p style={S.listText}>{tip.detail}</p>
                  </div>
                ))}
                {wallColours.length > 0 && (
                  <>
                    <p style={{ ...S.status, marginTop: 16 }}>
                      Wall colours drawn from the dominant colour of your selection ({dominantHexes[0]}):
                    </p>
                    <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 8 }}>
                      {wallColours.map((wall) => (
                        <div key={wall.name} style={{ ...S.listItem, flex: "1 1 200px", marginBottom: 0 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 10 }}>
                            <span style={{ ...S.swatch, background: wall.hex, width: 40, height: 40 }} />
                            <span>
                              <strong style={{ fontSize: 13 }}>{wall.name}</strong>
                              <br />
                              <span style={{ color: "var(--muted)", fontSize: 12 }}>{wall.hex}</span>
                            </span>
                          </span>
                          <p style={{ ...S.listText, marginTop: 8 }}>{wall.note}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </section>

              {/* 6 — Moodboard ---------------------------------------------- */}
              <section style={S.section}>
                <h2 style={S.sectionTitle}>6 · Moodboard</h2>
                <p style={S.sectionNote}>
                  Your selected works, the room and the palette on one board. Download it as a PNG
                  to share with the team.
                </p>
                <div ref={boardRef} style={{ ...S.board, background: selectedTemplate?.wallColor ?? "#f5f2eb" }}>
                  <div style={S.boardHeader}>
                    <p style={{ margin: 0, color: "var(--accent)", fontSize: 11, fontWeight: 700, letterSpacing: "0.08em" }}>
                      SANAA · AI EXHIBITION ARCHITECT
                    </p>
                    <h3 style={S.boardTitle}>{theme} — moodboard</h3>
                    <p style={{ margin: "0 0 16px", color: "var(--muted)", fontSize: 13 }}>
                      {selected.length} work{selected.length === 1 ? "" : "s"}
                      {selectedTemplate ? ` · ${selectedTemplate.label}` : ""}
                      {selectedRoom ? ` · ${selectedRoom.name}` : ""}
                    </p>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12, padding: "0 18px 18px" }}>
                    {selected.slice(0, 8).map((a) => (
                      <figure key={a.id} style={{ margin: 0 }}>
                        {a.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.imageUrl} alt={a.title} style={{ width: "100%", height: 150, objectFit: "cover", borderRadius: 8, background: "#fff" }} loading="lazy" />
                        ) : (
                          <span style={{ display: "block", width: "100%", height: 150, borderRadius: 8, background: a.color ?? "#b8a184" }} />
                        )}
                        <figcaption style={{ fontSize: 12, fontWeight: 600, marginTop: 6 }}>{a.title}</figcaption>
                      </figure>
                    ))}
                  </div>
                  {dominantHexes.length > 0 && (
                    <div style={{ display: "flex", gap: 8, padding: "0 18px 18px" }}>
                      {dominantHexes.map((hex) => (
                        <span key={hex} title={hex} style={{ ...S.swatch, flex: 1, height: 36, borderRadius: 8, background: hex }} />
                      ))}
                    </div>
                  )}
                </div>
                <div style={{ marginTop: 12 }}>
                  <button type="button" style={S.ghostButton} onClick={downloadMoodboard}>
                    Download moodboard (PNG)
                  </button>
                </div>
              </section>

              {/* 7 — Visitor journey ----------------------------------------- */}
              <section style={S.section}>
                <h2 style={S.sectionTitle}>7 · Visitor journey</h2>
                <p style={S.sectionNote}>
                  The ordered path through your rooms. Add rooms in visit order, reorder them, and
                  note what each stop should do.
                </p>
                {journey.length === 0 ? (
                  <p style={S.status}>No journey yet — pick a room below and add it as a stop.</p>
                ) : (
                  <ol style={{ margin: "0 0 16px", paddingLeft: 20 }}>
                    {journey.map((stop, index) => {
                      const room = rooms.find((r) => r.id === stop.roomId);
                      return (
                        <li key={stop.id} style={{ marginBottom: 10, fontSize: 13, lineHeight: 1.5 }}>
                          <strong>
                            Stop {index + 1}: {room?.name ?? stop.roomId}
                          </strong>
                          {stop.note ? ` — ${stop.note}` : ""}
                          <span style={{ display: "inline-flex", gap: 6, marginLeft: 10 }}>
                            <button type="button" style={{ ...S.ghostButton, minHeight: 28, padding: "0 8px" }} onClick={() => moveJourneyStop(stop.id, -1)} disabled={index === 0}>
                              ↑
                            </button>
                            <button type="button" style={{ ...S.ghostButton, minHeight: 28, padding: "0 8px" }} onClick={() => moveJourneyStop(stop.id, 1)} disabled={index === journey.length - 1}>
                              ↓
                            </button>
                            <button type="button" style={{ ...S.ghostButton, minHeight: 28, padding: "0 8px" }} onClick={() => setJourney((c) => c.filter((s) => s.id !== stop.id))}>
                              Remove
                            </button>
                          </span>
                        </li>
                      );
                    })}
                  </ol>
                )}
                <div style={S.controls}>
                  <label style={{ ...S.field, flex: 1, minWidth: 200 }}>
                    Room
                    <select style={S.select} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
                      <option value="">Choose a room…</option>
                      {rooms.map((r) => (
                        <option key={r.id} value={r.id}>
                          {r.name} — {r.exhibitionTitle}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label style={{ ...S.field, flex: 2, minWidth: 220 }}>
                    What should this stop do? (optional)
                    <input style={S.input} value={journeyNote} onChange={(e) => setJourneyNote(e.target.value)} placeholder="e.g. Open with the anchor work" />
                  </label>
                  <button type="button" className="galleries-open-button" onClick={addJourneyStop} disabled={!roomId}>
                    Add stop
                  </button>
                </div>
              </section>

              {/* 8 — Installation plan --------------------------------------- */}
              <section style={S.section}>
                <h2 style={S.sectionTitle}>8 · Installation plan</h2>
                <p style={S.sectionNote}>
                  Checklist generated from your selected works and rooms. Tick items as they are
                  done — the state is saved with the concept.
                </p>
                {checklist.map((item) => (
                  <label key={item.label} style={S.checkRow}>
                    <input
                      type="checkbox"
                      checked={checks[item.label] ?? false}
                      onChange={(e) => setChecks((c) => ({ ...c, [item.label]: e.target.checked }))}
                    />
                    <span>
                      <strong>{item.label}</strong>
                      {item.detail ? <span style={{ color: "var(--muted)" }}> — {item.detail}</span> : ""}
                    </span>
                  </label>
                ))}
              </section>

              {/* 9 — Save ----------------------------------------------------- */}
              <section style={S.section}>
                <h2 style={S.sectionTitle}>9 · Save this concept</h2>
                <p style={S.sectionNote}>
                  Saves the theme, concept draft, selection, template, journey and checklist as
                  one concept you can reload and keep editing.
                </p>
                <div style={S.controls}>
                  <label style={{ ...S.field, flex: 1, minWidth: 200 }}>
                    Concept name
                    <input
                      style={S.input}
                      value={saveName}
                      onChange={(e) => setSaveName(e.target.value)}
                      placeholder={`${theme} — ${selected.length} works`}
                    />
                  </label>
                  <button type="button" className="galleries-open-button" onClick={() => void saveConcept()} disabled={saving}>
                    {saving ? "Saving…" : "Save concept"}
                  </button>
                </div>
                {saveStatus && <p style={S.status}>{saveStatus}</p>}
              </section>
            </>
          )}
        </>
      )}

      {/* Saved concepts ---------------------------------------------------- */}
      <section style={S.section}>
        <h2 style={S.sectionTitle}>Your saved concepts</h2>
        {savedLoading ? (
          <p style={S.status}>Loading your saved concepts…</p>
        ) : saved.length === 0 ? (
          <p style={S.status}>No saved concepts yet. Plan a show above and save it to find it here.</p>
        ) : (
          <div>
            {saved.map((item) => (
              <div key={item.id} style={S.savedRow}>
                {renameId === item.id ? (
                  <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                    <input
                      style={{ ...S.input, minHeight: 34 }}
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void renameSaved(item.id);
                      }}
                    />
                    <button type="button" style={S.ghostButton} onClick={() => void renameSaved(item.id)}>
                      Save
                    </button>
                    <button type="button" style={S.ghostButton} onClick={() => setRenameId(null)}>
                      Cancel
                    </button>
                  </span>
                ) : (
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{item.title}</span>
                )}
                <span style={{ color: "var(--muted)", fontSize: 12 }}>
                  {typeof item.data.theme === "string" ? `${item.data.theme} · ` : ""}
                  {Array.isArray(item.data.artworkIds) ? `${item.data.artworkIds.length} works` : ""}
                </span>
                <span style={{ marginLeft: "auto", display: "inline-flex", gap: 8 }}>
                  <button type="button" style={S.ghostButton} onClick={() => loadConcept(item)}>
                    Load
                  </button>
                  <button
                    type="button"
                    style={S.ghostButton}
                    onClick={() => {
                      setRenameId(item.id);
                      setRenameValue(item.title);
                    }}
                  >
                    Rename
                  </button>
                  <button
                    type="button"
                    style={S.ghostButton}
                    onClick={() => {
                      if (confirmDeleteId === item.id) {
                        setConfirmDeleteId(null);
                        void deleteSaved(item.id);
                      } else {
                        setConfirmDeleteId(item.id);
                        window.setTimeout(
                          () => setConfirmDeleteId((c) => (c === item.id ? null : c)),
                          10000,
                        );
                      }
                    }}
                  >
                    {confirmDeleteId === item.id ? "Click again to delete" : "Delete"}
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
