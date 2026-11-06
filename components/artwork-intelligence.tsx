"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import styles from "./tools.module.css";
import ProviderPanel, { ModelIntegrationNote } from "@/components/ai-provider-panel";
import type { AiProviderStatus } from "@/lib/ai-providers";
import {
  accessibilityDraft,
  colourName,
  descriptionDraft,
  suggestTags,
  type AiArtworkLike,
} from "@/lib/ai-rules";

// ---------------------------------------------------------------------------
// Artwork Intelligence — analysis of the user's own artworks WITHOUT an AI
// call. Metadata is pre-filled from the artwork record, tags come from
// rules (medium, colours, dimensions, title words), dominant colours come
// from a median-cut quantisation of the real pixels in the browser, and
// the description / accessibility texts are template drafts built from the
// artwork's own data. Nothing here invents provenance, ownership, artist
// identity or history — every generated field is labelled "draft — check
// before use" and stays editable. Free-text description enrichment that
// would need a model is a labelled integration point (see
// lib/ai-providers.ts), never a simulated reply.
// ---------------------------------------------------------------------------

type RGB = [number, number, number];

type ExtractedColor = { hex: string; rgb: RGB; share: number };

type SavedAnalysis = {
  id: string;
  title: string;
  data: Record<string, unknown>;
  artworkId: string | null;
  createdAt: string;
  updatedAt: string;
};

const S: Record<string, CSSProperties> = {
  section: { marginBottom: 36 },
  sectionTitle: { margin: "0 0 4px", fontFamily: "var(--font-display), Georgia, serif", fontSize: 20, fontWeight: 600 },
  sectionNote: { margin: "0 0 16px", color: "var(--muted)", fontSize: 13, lineHeight: 1.5 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 },
  artworkCard: {
    padding: 0, border: "1px solid var(--line)", borderRadius: 10, background: "var(--surface-3, #fff)",
    overflow: "hidden", cursor: "pointer", textAlign: "left", fontFamily: "inherit",
  },
  artworkThumb: { display: "block", width: "100%", height: 110, objectFit: "cover", background: "var(--room-color)" },
  artworkBody: { padding: "10px 12px 12px" },
  artworkTitle: { margin: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.3 },
  artworkMeta: { margin: "4px 0 0", color: "var(--muted)", fontSize: 11, lineHeight: 1.4 },
  field: { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 600 },
  input: {
    minHeight: 40, padding: "0 10px", border: "1px solid var(--line)", borderRadius: 8,
    background: "var(--surface-3, #fff)", color: "var(--ink)", fontSize: 13, fontFamily: "inherit",
  },
  textarea: {
    width: "100%", minHeight: 110, padding: "12px", border: "1px solid var(--line)", borderRadius: 8,
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
  draftTag: {
    display: "inline-block", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700,
    background: "#fdf6e3", color: "#7a5b12", border: "1px solid #e8d9a8", marginLeft: 8, verticalAlign: "middle",
  },
  swatchGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 },
  swatchCard: { border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "var(--surface-3, #fff)" },
  swatchBlock: { height: 84, cursor: "pointer", border: 0, width: "100%", padding: 0, display: "block" },
  swatchBody: { padding: "10px 12px 12px" },
  swatchHex: { margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" },
  swatchMeta: { margin: "4px 0 0", color: "var(--muted)", fontSize: 12, lineHeight: 1.5 },
  tagChip: {
    display: "inline-flex", alignItems: "center", gap: 6, padding: "6px 10px", borderRadius: 999,
    border: "1px solid var(--line)", background: "var(--surface-3, #fff)", fontSize: 12, fontWeight: 600,
    cursor: "pointer", fontFamily: "inherit", color: "var(--ink)",
  },
  tagChipOn: { background: "#e7f2e4", borderColor: "#2e6b34", color: "#2e6b34" },
  previewRow: { display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" },
  previewImg: {
    width: 220, maxWidth: "100%", height: "auto", maxHeight: 260, objectFit: "contain",
    border: "1px solid var(--line)", borderRadius: 10, background: "#fff",
  },
  uploadBox: {
    display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, padding: 16,
    border: "1px dashed var(--line)", borderRadius: 10, background: "var(--room-color)",
  },
  savedRow: {
    display: "flex", gap: 10, alignItems: "center", padding: "12px 0",
    borderBottom: "1px solid var(--line)", flexWrap: "wrap",
  },
  formGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12, marginBottom: 16 },
};

// --- median-cut quantisation (same approach as Color Intelligence) ---------

function rgbToHex(r: number, g: number, b: number): string {
  const part = (value: number) =>
    Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

function medianCut(pixels: RGB[], target: number): ExtractedColor[] {
  if (pixels.length === 0) return [];
  let boxes: RGB[][] = [pixels];
  while (boxes.length < target) {
    let bestIdx = -1;
    let bestRange = -1;
    let bestChannel = 0;
    boxes.forEach((box, idx) => {
      if (box.length < 2) return;
      for (let c = 0; c < 3; c++) {
        let min = 255;
        let max = 0;
        for (const p of box) {
          if (p[c] < min) min = p[c];
          if (p[c] > max) max = p[c];
        }
        if (max - min > bestRange) {
          bestRange = max - min;
          bestIdx = idx;
          bestChannel = c;
        }
      }
    });
    if (bestIdx === -1) break;
    const box = boxes[bestIdx];
    const sorted = [...box].sort((a, b) => a[bestChannel] - b[bestChannel]);
    const mid = Math.floor(sorted.length / 2);
    boxes = [...boxes.slice(0, bestIdx), sorted.slice(0, mid), sorted.slice(mid), ...boxes.slice(bestIdx + 1)];
  }
  const total = pixels.length;
  return boxes
    .map((box) => {
      const n = box.length;
      const rgb: RGB = [0, 1, 2].map((c) => Math.round(box.reduce((sum, p) => sum + p[c], 0) / n)) as RGB;
      return { rgb, hex: rgbToHex(rgb[0], rgb[1], rgb[2]), share: (n / total) * 100 };
    })
    .sort((a, b) => b.share - a.share);
}

async function analyseImage(src: string, crossOrigin: boolean): Promise<ExtractedColor[]> {
  const img = new Image();
  if (crossOrigin) img.crossOrigin = "anonymous";
  const loaded = new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error("load"));
  });
  img.src = src;
  await loaded;
  const maxDim = 200;
  const scale = Math.min(1, maxDim / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) throw new Error("canvas");
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h).data;
  const pixels: RGB[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue;
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  return medianCut(pixels, 6);
}

// --- component -------------------------------------------------------------

export default function ArtworkIntelligence({
  artworks,
  providerStatus,
}: {
  artworks: AiArtworkLike[];
  providerStatus: AiProviderStatus;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [upload, setUpload] = useState<{ name: string; dataUrl: string } | null>(null);
  const [colors, setColors] = useState<ExtractedColor[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Editable metadata, pre-filled from the artwork record.
  const [meta, setMeta] = useState({ title: "", artist: "", year: "", medium: "", dimensions: "" });
  const [description, setDescription] = useState("");
  const [descriptionSource, setDescriptionSource] = useState<"record" | "template" | "model" | "edited" | "">("");
  const [accessibility, setAccessibility] = useState("");
  const [accessibilitySource, setAccessibilitySource] = useState<"template" | "edited" | "">("");
  const [chosenTags, setChosenTags] = useState<string[]>([]);
  const [tagFilter, setTagFilter] = useState("");

  const [saveName, setSaveName] = useState("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState<SavedAnalysis[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [modelBusy, setModelBusy] = useState(false);
  const [modelError, setModelError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedArtwork = artworks.find((a) => a.id === selectedId) ?? null;
  const sourceLabel = upload ? upload.name : selectedArtwork ? selectedArtwork.title : null;
  const sourceUrl = upload ? upload.dataUrl : selectedArtwork?.imageUrl ?? null;

  const dominantHexes = useMemo(() => (colors ?? []).map((c) => c.hex), [colors]);
  const tags = useMemo(
    () => (selectedArtwork ? suggestTags({ ...selectedArtwork, ...meta }, dominantHexes) : []),
    [selectedArtwork, meta, dominantHexes],
  );

  const loadSaved = useCallback(async () => {
    setSavedLoading(true);
    try {
      const res = await fetch("/api/saved-work?kind=ai-analysis");
      if (!res.ok) throw new Error("fetch");
      const json = (await res.json()) as { saved?: SavedAnalysis[] };
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

  // Analyse whenever the source image changes.
  useEffect(() => {
    if (!sourceUrl) {
      setColors(null);
      setStatus("idle");
      setError(null);
      return;
    }
    let cancelled = false;
    setStatus("loading");
    setError(null);
    setColors(null);
    analyseImage(sourceUrl, !upload)
      .then((result) => {
        if (cancelled) return;
        setColors(result);
        setStatus("done");
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setStatus("error");
        if (err instanceof Error && err.message === "load") {
          setError("This image could not be loaded. It may have been moved or deleted — try another artwork or upload a file.");
        } else {
          setError(
            "This image cannot be read for analysis — its host does not allow cross-origin pixel access, so the canvas is blocked. Download the image and upload it directly instead.",
          );
        }
      });
    return () => {
      cancelled = true;
    };
  }, [sourceUrl, upload]);

  const pickArtwork = useCallback((artwork: AiArtworkLike) => {
    setSelectedId(artwork.id);
    setUpload(null);
    setMeta({
      title: artwork.title ?? "",
      artist: artwork.artist ?? "",
      year: artwork.year ?? "",
      medium: artwork.medium ?? "",
      dimensions: artwork.dimensions ?? "",
    });
    const existing = (artwork.description ?? "").trim();
    setDescription(existing);
    setDescriptionSource(existing ? "record" : "");
    setAccessibility("");
    setAccessibilitySource("");
    setChosenTags([]);
    setTagFilter("");
    setModelError(null);
  }, []);

  const onUploadFile = useCallback((file: File | undefined) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("error");
      setError("That file is not an image. Choose a JPG, PNG or WebP file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setUpload({ name: file.name, dataUrl: String(reader.result) });
      setSelectedId(null);
      setMeta({ title: file.name.replace(/\.[^.]+$/, ""), artist: "", year: "", medium: "", dimensions: "" });
      setDescription("");
      setDescriptionSource("");
      setAccessibility("");
      setAccessibilitySource("");
      setChosenTags([]);
    };
    reader.onerror = () => {
      setStatus("error");
      setError("That file could not be read. Try another image.");
    };
    reader.readAsDataURL(file);
  }, []);

  const generateDescriptionDraft = useCallback(() => {
    if (!selectedArtwork && !upload) return;
    const draft = descriptionDraft(
      {
        id: selectedArtwork?.id ?? "upload",
        title: meta.title || selectedArtwork?.title || "Untitled",
        artist: meta.artist,
        year: meta.year,
        medium: meta.medium,
        dimensions: meta.dimensions,
      },
      dominantHexes,
    );
    setDescription(draft);
    setDescriptionSource("template");
  }, [selectedArtwork, upload, meta, dominantHexes]);

  const generateAccessibilityDraft = useCallback(() => {
    if (!selectedArtwork && !upload) return;
    const draft = accessibilityDraft(
      {
        id: selectedArtwork?.id ?? "upload",
        title: meta.title || selectedArtwork?.title || "Untitled",
        artist: meta.artist,
        year: meta.year,
        medium: meta.medium,
        dimensions: meta.dimensions,
      },
      dominantHexes,
    );
    setAccessibility(draft);
    setAccessibilitySource("template");
  }, [selectedArtwork, upload, meta, dominantHexes]);

  const enrichWithModel = useCallback(async () => {
    if (!providerStatus.configured || (!selectedArtwork && !upload)) return;
    setModelBusy(true);
    setModelError(null);
    try {
      const prompt = [
        "Write a short, honest catalogue description (80-120 words) for this artwork, using ONLY the facts below. Do not invent provenance, ownership, exhibition history, artist biography or meaning beyond what is given. If a fact is missing, leave it out rather than guessing.",
        `Title: ${meta.title || "Untitled"}`,
        `Artist: ${meta.artist || "not recorded"}`,
        `Year: ${meta.year || "not recorded"}`,
        `Medium: ${meta.medium || "not recorded"}`,
        `Dimensions: ${meta.dimensions || "not recorded"}`,
        dominantHexes.length > 0 ? `Dominant colours measured from the image: ${dominantHexes.join(", ")}` : "",
      ].join("\n");
      const res = await fetch("/api/ai/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          system: "You write catalogue descriptions for a gallery. Plain language, no hype, never invent facts.",
        }),
      });
      const json = (await res.json()) as { text?: string; model?: string; provider?: string; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Model request failed.");
      setDescription(json.text ?? "");
      setDescriptionSource("model");
    } catch (err) {
      setModelError(err instanceof Error ? err.message : "Model request failed.");
    } finally {
      setModelBusy(false);
    }
  }, [providerStatus.configured, selectedArtwork, upload, meta, dominantHexes]);

  const copyHex = useCallback(async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(hex);
      window.setTimeout(() => setCopied((current) => (current === hex ? null : current)), 1600);
    } catch {
      setCopied(null);
    }
  }, []);

  const toggleTag = useCallback((tag: string) => {
    setChosenTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );
  }, []);

  const saveAnalysis = useCallback(async () => {
    if (!selectedArtwork && !upload) return;
    const title = saveName.trim() || `Analysis — ${meta.title || sourceLabel || "untitled"}`;
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch("/api/saved-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "ai-analysis",
          title,
          data: {
            meta,
            description,
            descriptionSource,
            accessibility,
            accessibilitySource,
            tags: chosenTags,
            dominantColors: dominantHexes,
            source: sourceLabel,
          },
          artworkId: selectedId,
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
  }, [selectedArtwork, upload, saveName, meta, sourceLabel, description, descriptionSource, accessibility, accessibilitySource, chosenTags, dominantHexes, selectedId, loadSaved]);

  const loadAnalysis = useCallback((item: SavedAnalysis) => {
    const data = item.data;
    if (data.meta && typeof data.meta === "object") {
      const m = data.meta as Record<string, unknown>;
      setMeta({
        title: typeof m.title === "string" ? m.title : "",
        artist: typeof m.artist === "string" ? m.artist : "",
        year: typeof m.year === "string" ? m.year : "",
        medium: typeof m.medium === "string" ? m.medium : "",
        dimensions: typeof m.dimensions === "string" ? m.dimensions : "",
      });
    }
    if (typeof data.description === "string") setDescription(data.description);
    if (typeof data.descriptionSource === "string") {
      setDescriptionSource(data.descriptionSource as "record" | "template" | "model" | "edited");
    }
    if (typeof data.accessibility === "string") setAccessibility(data.accessibility);
    if (Array.isArray(data.tags)) {
      setChosenTags(data.tags.filter((t): t is string => typeof t === "string"));
    }
    if (typeof item.artworkId === "string") {
      const artwork = artworks.find((a) => a.id === item.artworkId);
      if (artwork) {
        setSelectedId(artwork.id);
        setUpload(null);
      }
    }
    setSaveStatus(`Loaded “${item.title}”. Edit anything — nothing is overwritten until you save again.`);
  }, [artworks]);

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

  const visibleTags = tagFilter.trim()
    ? tags.filter((t) => t.tag.includes(tagFilter.trim().toLowerCase()))
    : tags;

  return (
    <div>
      <ProviderPanel status={providerStatus} />

      {/* 1 — Pick an artwork or upload ------------------------------------ */}
      <section style={S.section}>
        <h2 style={S.sectionTitle}>1 · Choose an artwork</h2>
        <p style={S.sectionNote}>
          Pick one of your artworks, or upload an image from your device. The analysis reads the
          actual pixels — nothing is uploaded anywhere.
        </p>
        {artworks.length === 0 ? (
          <div className={styles.emptyBox}>
            <strong>No artworks with images yet.</strong>
            <p>
              Add a work with an image in the editor and it will show up here — or upload an image
              directly below.
            </p>
          </div>
        ) : (
          <div style={S.grid}>
            {artworks.map((artwork) => {
              const active = selectedId === artwork.id;
              return (
                <button
                  key={artwork.id}
                  type="button"
                  onClick={() => pickArtwork(artwork)}
                  style={{
                    ...S.artworkCard,
                    outline: active ? "2px solid var(--accent)" : "none",
                    outlineOffset: 1,
                  }}
                  aria-pressed={active}
                >
                  {artwork.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={artwork.imageUrl} alt={artwork.title} style={S.artworkThumb} />
                  ) : (
                    <span style={{ ...S.artworkThumb, background: artwork.color ?? "#b8a184", display: "block" }} />
                  )}
                  <span style={{ ...S.artworkBody, display: "block" }}>
                    <span style={{ ...S.artworkTitle, display: "block" }}>{artwork.title}</span>
                    <span style={{ ...S.artworkMeta, display: "block" }}>
                      {artwork.medium}
                      {artwork.year ? ` · ${artwork.year}` : ""} · {artwork.exhibitionTitle}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
        <div style={{ ...S.uploadBox, marginTop: 12 }}>
          <span style={{ fontSize: 13, fontWeight: 600 }}>Or upload an image</span>
          <span style={{ fontSize: 12, color: "var(--muted)" }}>
            JPG, PNG or WebP. The file stays in your browser — it is never sent to the server.
          </span>
          <span style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button type="button" className="galleries-open-button" onClick={() => fileRef.current?.click()}>
              Choose an image
            </button>
            {upload && (
              <button
                type="button"
                style={S.ghostButton}
                onClick={() => {
                  setUpload(null);
                }}
              >
                Clear upload
              </button>
            )}
          </span>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(event) => {
              onUploadFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
      </section>

      {!sourceUrl && (
        <div className={styles.emptyBox}>
          <strong>Nothing to analyse yet.</strong>
          <p>Select an artwork above or upload an image, and its colours, tags and drafts will appear here.</p>
        </div>
      )}

      {sourceUrl && status === "loading" && <p style={S.status}>Reading the pixels of {sourceLabel}…</p>}

      {status === "error" && error && (
        <div style={S.errorBox} role="alert">
          <strong>Couldn’t analyse this image.</strong>
          <br />
          {error}
        </div>
      )}

      {sourceUrl && (
        <>
          {/* 2 — Metadata --------------------------------------------------- */}
          <section style={S.section}>
            <h2 style={S.sectionTitle}>2 · Metadata<span style={S.draftTag}>draft — check before use</span></h2>
            <p style={S.sectionNote}>
              Pre-filled from the artwork record. Correct anything — these are your facts, not
              facts found by a model. Nothing here is invented: fields the record does not have
              stay blank.
            </p>
            <div style={S.formGrid}>
              <label style={S.field}>
                Title
                <input style={S.input} value={meta.title} onChange={(e) => setMeta((m) => ({ ...m, title: e.target.value }))} />
              </label>
              <label style={S.field}>
                Artist
                <input style={S.input} value={meta.artist} onChange={(e) => setMeta((m) => ({ ...m, artist: e.target.value }))} placeholder="Not recorded" />
              </label>
              <label style={S.field}>
                Year
                <input style={S.input} value={meta.year} onChange={(e) => setMeta((m) => ({ ...m, year: e.target.value }))} placeholder="Not recorded" />
              </label>
              <label style={S.field}>
                Medium
                <input style={S.input} value={meta.medium} onChange={(e) => setMeta((m) => ({ ...m, medium: e.target.value }))} placeholder="Not recorded" />
              </label>
              <label style={S.field}>
                Dimensions
                <input style={S.input} value={meta.dimensions} onChange={(e) => setMeta((m) => ({ ...m, dimensions: e.target.value }))} placeholder="e.g. 120 × 89 cm" />
              </label>
            </div>
          </section>

          {/* 3 — Dominant colours ------------------------------------------- */}
          {status === "done" && colors && colors.length > 0 && (
            <section style={S.section}>
              <h2 style={S.sectionTitle}>3 · Dominant colours</h2>
              <p style={S.sectionNote}>
                The six colours that cover the most of {sourceLabel} — found by median-cut
                quantisation of the real pixels. Tap any swatch to copy its hex.
              </p>
              <div style={S.previewRow}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={sourceUrl ?? ""} alt={sourceLabel ?? "Artwork"} style={S.previewImg} />
                <div style={{ flex: 1, minWidth: 240 }}>
                  <div style={S.swatchGrid}>
                    {colors.map((color) => (
                      <div key={color.hex} style={S.swatchCard}>
                        <button
                          type="button"
                          aria-label={`Copy ${color.hex}`}
                          onClick={() => void copyHex(color.hex)}
                          style={{ ...S.swatchBlock, background: color.hex }}
                        />
                        <div style={S.swatchBody}>
                          <p style={S.swatchHex}>
                            {color.hex}{" "}
                            {copied === color.hex && <span style={{ color: "var(--accent)", fontWeight: 700 }}>copied</span>}
                          </p>
                          <p style={S.swatchMeta}>
                            {colourName(color.hex)}
                            <br />
                            {color.share.toFixed(1)}% of the image
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* 4 — Suggested tags ---------------------------------------------- */}
          <section style={S.section}>
            <h2 style={S.sectionTitle}>4 · Suggested tags<span style={S.draftTag}>draft — check before use</span></h2>
            <p style={S.sectionNote}>
              Suggested from the medium, dimensions, year, title words and the measured colours —
              never from guessed subject matter. Tick the ones that fit; add your own below.
            </p>
            {tags.length === 0 ? (
              <p style={S.status}>No tags suggested yet — fill in the medium or title above, or wait for the colour analysis.</p>
            ) : (
              <>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
                  {visibleTags.map((t) => {
                    const on = chosenTags.includes(t.tag);
                    return (
                      <button
                        key={t.tag}
                        type="button"
                        title={t.reason}
                        onClick={() => toggleTag(t.tag)}
                        style={{ ...S.tagChip, ...(on ? S.tagChipOn : {}) }}
                        aria-pressed={on}
                      >
                        {on ? "✓ " : ""}{t.tag}
                      </button>
                    );
                  })}
                </div>
                <p style={{ ...S.status, marginTop: 0 }}>
                  {visibleTags.map((t) => `${t.tag} — ${t.reason}`).slice(0, 3).join(" · ")}
                </p>
              </>
            )}
            <div style={{ ...S.controls, marginTop: 12 }}>
              <label style={{ ...S.field, minWidth: 200 }}>
                Add your own tag
                <input
                  style={S.input}
                  value={tagFilter}
                  onChange={(e) => setTagFilter(e.target.value)}
                  placeholder="Type a tag, press Enter to add"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      const tag = tagFilter.trim().toLowerCase().replace(/\s+/g, "-");
                      if (tag && !chosenTags.includes(tag)) setChosenTags((c) => [...c, tag]);
                      setTagFilter("");
                    }
                  }}
                />
              </label>
              {chosenTags.length > 0 && (
                <span style={{ fontSize: 13 }}>
                  Chosen: {chosenTags.join(", ")}{" "}
                  <button type="button" style={{ ...S.ghostButton, minHeight: 30, padding: "0 10px" }} onClick={() => setChosenTags([])}>
                    Clear
                  </button>
                </span>
              )}
            </div>
          </section>

          {/* 5 — Description draft ------------------------------------------- */}
          <section style={S.section}>
            <h2 style={S.sectionTitle}>5 · Description draft<span style={S.draftTag}>draft — check before use</span></h2>
            <p style={S.sectionNote}>
              A template draft built only from this artwork's own data — title, artist, year,
              medium, dimensions and measured colours. It states facts, never invents them.
            </p>
            <div style={S.controls}>
              <button type="button" className="galleries-open-button" onClick={generateDescriptionDraft}>
                Generate draft from template
              </button>
              <button
                type="button"
                style={S.ghostButton}
                onClick={() => void enrichWithModel()}
                disabled={!providerStatus.configured || modelBusy}
              >
                {modelBusy ? "Writing…" : "Enrich with a model"}
              </button>
            </div>
            <ModelIntegrationNote status={providerStatus} feature="Free-text description enrichment" />
            <textarea
              style={{ ...S.textarea, marginTop: 12 }}
              value={description}
              onChange={(e) => {
                setDescription(e.target.value);
                setDescriptionSource("edited");
              }}
              placeholder="Generate a draft, or write the description yourself."
              aria-label="Description draft"
            />
            {descriptionSource && (
              <p style={S.status}>
                {descriptionSource === "record" && "From the artwork record as saved."}
                {descriptionSource === "template" && "Draft generated from a template — edit it to make it yours."}
                {descriptionSource === "model" && `Draft written by ${providerStatus.label}${providerStatus.model ? ` (${providerStatus.model})` : ""} — check every fact before use.`}
                {descriptionSource === "edited" && "Edited by you."}
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

          {/* 6 — Accessibility description ------------------------------------ */}
          <section style={S.section}>
            <h2 style={S.sectionTitle}>6 · Accessibility description<span style={S.draftTag}>draft — check before use</span></h2>
            <p style={S.sectionNote}>
              A template draft for screen readers and alt text. It covers the facts the record
              holds, then asks you to add what the work actually shows — a model cannot see it
              either, so that part is always yours.
            </p>
            <div style={S.controls}>
              <button type="button" className="galleries-open-button" onClick={generateAccessibilityDraft}>
                Generate draft from template
              </button>
            </div>
            <textarea
              style={{ ...S.textarea, marginTop: 12 }}
              value={accessibility}
              onChange={(e) => {
                setAccessibility(e.target.value);
                setAccessibilitySource("edited");
              }}
              placeholder="Generate a draft, or write the accessibility description yourself."
              aria-label="Accessibility description draft"
            />
            {accessibilitySource && (
              <p style={S.status}>
                {accessibilitySource === "template" && "Draft generated from a template — add what the work shows, then edit."}
                {accessibilitySource === "edited" && "Edited by you."}
              </p>
            )}
          </section>

          {/* 7 — Save ---------------------------------------------------------- */}
          <section style={S.section}>
            <h2 style={S.sectionTitle}>7 · Save this analysis</h2>
            <p style={S.sectionNote}>
              Saves the metadata, drafts, chosen tags and measured colours as one analysis you can
              reload and keep editing.
            </p>
            <div style={S.controls}>
              <label style={{ ...S.field, flex: 1, minWidth: 200 }}>
                Analysis name
                <input
                  style={S.input}
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  placeholder={`Analysis — ${meta.title || sourceLabel || "untitled"}`}
                />
              </label>
              <button type="button" className="galleries-open-button" onClick={() => void saveAnalysis()} disabled={saving}>
                {saving ? "Saving…" : "Save analysis"}
              </button>
            </div>
            {saveStatus && <p style={S.status}>{saveStatus}</p>}
          </section>
        </>
      )}

      {/* Saved analyses ------------------------------------------------------ */}
      <section style={S.section}>
        <h2 style={S.sectionTitle}>Your saved analyses</h2>
        {savedLoading ? (
          <p style={S.status}>Loading your saved analyses…</p>
        ) : saved.length === 0 ? (
          <p style={S.status}>No saved analyses yet. Analyse a work above and save it to find it here.</p>
        ) : (
          <div>
            {saved.map((item) => {
              const itemColors = Array.isArray(item.data.dominantColors)
                ? (item.data.dominantColors as string[])
                : [];
              const itemTags = Array.isArray(item.data.tags) ? (item.data.tags as string[]) : [];
              return (
                <div key={item.id} style={S.savedRow}>
                  <span style={{ display: "inline-flex", gap: 4 }}>
                    {itemColors.slice(0, 6).map((hex) => (
                      <span
                        key={hex}
                        title={hex}
                        style={{ width: 22, height: 22, borderRadius: 6, border: "1px solid rgba(0,0,0,0.12)", background: hex }}
                      />
                    ))}
                  </span>
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
                    {itemTags.length > 0 ? itemTags.slice(0, 4).join(", ") : ""}
                  </span>
                  <span style={{ marginLeft: "auto", display: "inline-flex", gap: 8 }}>
                    <button type="button" style={S.ghostButton} onClick={() => loadAnalysis(item)}>
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
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
