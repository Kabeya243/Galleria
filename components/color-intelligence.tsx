"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import styles from "./tools.module.css";

// ---------------------------------------------------------------------------
// Color Intelligence — real colour analysis of an artwork image, done in the
// browser on a canvas. No fake AI: dominant colours come from a median-cut
// quantisation of the actual pixels, harmonies from HSL hue rotations, and
// contrast from the WCAG relative-luminance formula.
// ---------------------------------------------------------------------------

export type ColorArtwork = {
  id: string;
  title: string;
  medium: string;
  year: string;
  imageUrl: string;
  exhibitionTitle: string;
};

type RGB = [number, number, number];

type ExtractedColor = {
  hex: string;
  rgb: RGB;
  share: number; // percent of sampled pixels
};

type SavedPalette = {
  id: string;
  title: string;
  data: { colors?: string[]; harmony?: string; source?: string; artworkId?: string | null };
  createdAt: string;
  updatedAt: string;
};

type Harmony = "dominant" | "complementary" | "analogous" | "triadic";

const HARMONY_LABELS: Record<Harmony, string> = {
  dominant: "Dominant set",
  complementary: "Complementary",
  analogous: "Analogous",
  triadic: "Triadic",
};

const MAX_COMPARE = 4;

// --- colour math -----------------------------------------------------------

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function rgbToHex(r: number, g: number, b: number): string {
  const part = (value: number) =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

function hexToRgb(hex: string): RGB {
  const clean = hex.replace("#", "");
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [((h * 60) % 360 + 360) % 360, s, l];
}

function hslToRgb(h: number, s: number, l: number): RGB {
  const hue = (((h % 360) + 360) % 360) / 360;
  const sat = clamp01(s);
  const light = clamp01(l);
  if (sat === 0) {
    const v = Math.round(light * 255);
    return [v, v, v];
  }
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const channel = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [
    Math.round(channel(hue + 1 / 3) * 255),
    Math.round(channel(hue) * 255),
    Math.round(channel(hue - 1 / 3) * 255),
  ];
}

function relativeLuminance([r, g, b]: RGB): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(a: RGB, b: RGB): number {
  const l1 = relativeLuminance(a);
  const l2 = relativeLuminance(b);
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

// --- median-cut quantisation ----------------------------------------------

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
    if (bestIdx === -1) break; // every box is a single colour
    const box = boxes[bestIdx];
    const sorted = [...box].sort((a, b) => a[bestChannel] - b[bestChannel]);
    const mid = Math.floor(sorted.length / 2);
    boxes = [
      ...boxes.slice(0, bestIdx),
      sorted.slice(0, mid),
      sorted.slice(mid),
      ...boxes.slice(bestIdx + 1),
    ];
  }
  const total = pixels.length;
  return boxes
    .map((box) => {
      const n = box.length;
      const rgb: RGB = [0, 1, 2].map(
        (c) => Math.round(box.reduce((sum, p) => sum + p[c], 0) / n),
      ) as RGB;
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
  // Throws a SecurityError when the image is cross-origin without CORS.
  const data = ctx.getImageData(0, 0, w, h).data;
  const pixels: RGB[] = [];
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 128) continue; // skip transparent pixels
    pixels.push([data[i], data[i + 1], data[i + 2]]);
  }
  return medianCut(pixels, 6);
}

// --- harmonies -------------------------------------------------------------

function buildHarmony(base: RGB, harmony: Exclude<Harmony, "dominant">, count: number): string[] {
  const [h, s, l] = rgbToHsl(base[0], base[1], base[2]);
  const hueSets: Record<Exclude<Harmony, "dominant">, number[]> = {
    complementary: [h, h + 180],
    analogous: [h - 30, h, h + 30],
    triadic: [h, h + 120, h + 240],
  };
  const hues = hueSets[harmony];
  // Lightness steps so a larger count still gives distinct, usable colours.
  const lightSteps = [0, 0.2, -0.18, 0.34, -0.3, 0.1, -0.1, 0.26];
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const hue = hues[i % hues.length];
    const light = clamp01(l + lightSteps[Math.floor(i / hues.length)]);
    const rgb = hslToRgb(hue, Math.max(0.12, s), light);
    const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
    if (!out.includes(hex)) out.push(hex);
  }
  return out.slice(0, count);
}

function presentationBackgrounds(base: RGB): { name: string; hex: string; note: string }[] {
  const [h, s] = rgbToHsl(base[0], base[1], base[2]);
  const muted = hslToRgb(h + 180, s * 0.35, 0.86);
  const deep = hslToRgb(h, Math.min(s, 0.45), 0.14);
  const neutral = hslToRgb(h, s * 0.14, 0.94);
  return [
    {
      name: "Muted complement",
      hex: rgbToHex(muted[0], muted[1], muted[2]),
      note: "Soft opposite of the dominant colour — the work stands out without fighting the wall.",
    },
    {
      name: "Deep tone",
      hex: rgbToHex(deep[0], deep[1], deep[2]),
      note: "A dark room pulled from the painting itself — bright colours glow against it.",
    },
    {
      name: "Light neutral",
      hex: rgbToHex(neutral[0], neutral[1], neutral[2]),
      note: "A near-white tinted with the painting's own hue — the classic gallery wall, warmed.",
    },
  ];
}

// --- inline styles (design tokens come from globals.css; nothing new) ------

const S: Record<string, CSSProperties> = {
  section: { marginBottom: 36 },
  sectionTitle: {
    margin: "0 0 4px",
    fontFamily: "var(--font-display), Georgia, serif",
    fontSize: 20,
    fontWeight: 600,
  },
  sectionNote: { margin: "0 0 16px", color: "var(--muted)", fontSize: 13, lineHeight: 1.5 },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 },
  artworkCard: {
    padding: 0,
    border: "1px solid var(--line)",
    borderRadius: 10,
    background: "var(--surface-3, #fff)",
    overflow: "hidden",
    cursor: "pointer",
    textAlign: "left",
    fontFamily: "inherit",
  },
  artworkThumb: { display: "block", width: "100%", height: 110, objectFit: "cover", background: "var(--room-color)" },
  artworkBody: { padding: "10px 12px 12px" },
  artworkTitle: { margin: 0, fontSize: 13, fontWeight: 600, lineHeight: 1.3 },
  artworkMeta: { margin: "4px 0 0", color: "var(--muted)", fontSize: 11, lineHeight: 1.4 },
  uploadBox: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 8,
    padding: 16,
    border: "1px dashed var(--line)",
    borderRadius: 10,
    background: "var(--room-color)",
  },
  previewRow: { display: "flex", gap: 16, flexWrap: "wrap", alignItems: "flex-start" },
  previewImg: {
    width: 220,
    maxWidth: "100%",
    height: "auto",
    maxHeight: 260,
    objectFit: "contain",
    border: "1px solid var(--line)",
    borderRadius: 10,
    background: "#fff",
  },
  swatchGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))", gap: 12 },
  swatchCard: {
    border: "1px solid var(--line)",
    borderRadius: 10,
    overflow: "hidden",
    background: "var(--surface-3, #fff)",
  },
  swatchBlock: { height: 84, cursor: "pointer", border: 0, width: "100%", padding: 0, display: "block" },
  swatchBody: { padding: "10px 12px 12px" },
  swatchHex: { margin: 0, fontSize: 14, fontWeight: 700, letterSpacing: "0.02em" },
  swatchMeta: { margin: "4px 0 0", color: "var(--muted)", fontSize: 12, lineHeight: 1.5 },
  copiedTag: { color: "var(--accent)", fontWeight: 700 },
  controls: { display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end", marginBottom: 16 },
  field: { display: "flex", flexDirection: "column", gap: 6, fontSize: 12, fontWeight: 600 },
  select: {
    minHeight: 40,
    padding: "0 10px",
    border: "1px solid var(--line)",
    borderRadius: 8,
    background: "var(--surface-3, #fff)",
    color: "var(--ink)",
    fontSize: 13,
    fontFamily: "inherit",
  },
  input: {
    minHeight: 40,
    padding: "0 10px",
    border: "1px solid var(--line)",
    borderRadius: 8,
    background: "var(--surface-3, #fff)",
    color: "var(--ink)",
    fontSize: 13,
    fontFamily: "inherit",
  },
  ghostButton: {
    minHeight: 40,
    padding: "0 14px",
    border: "1px solid var(--line)",
    borderRadius: 8,
    background: "transparent",
    color: "var(--ink)",
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
    fontFamily: "inherit",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 13, background: "var(--surface-3, #fff)" },
  th: { textAlign: "left", padding: "10px 12px", borderBottom: "1px solid var(--line)", color: "var(--muted)", fontSize: 11, letterSpacing: "0.08em", textTransform: "uppercase" as const },
  td: { padding: "10px 12px", borderBottom: "1px solid var(--line)", verticalAlign: "middle" },
  badge: {
    display: "inline-block",
    padding: "3px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
  },
  bgGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 },
  bgCard: { border: "1px solid var(--line)", borderRadius: 10, overflow: "hidden", background: "var(--surface-3, #fff)" },
  bgPreview: { height: 170, display: "grid", placeItems: "center", padding: 18 },
  bgPreviewImg: { maxWidth: "100%", maxHeight: "100%", objectFit: "contain" as const, boxShadow: "0 4px 18px rgba(0,0,0,0.25)" },
  bgBody: { padding: "12px 14px 14px" },
  savedRow: {
    display: "flex",
    gap: 10,
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid var(--line)",
    flexWrap: "wrap",
  },
  miniSwatch: { width: 22, height: 22, borderRadius: 6, border: "1px solid rgba(0,0,0,0.12)", flexShrink: 0 },
  compareGrid: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 16 },
  compareCol: { border: "1px solid var(--line)", borderRadius: 10, padding: 14, background: "var(--surface-3, #fff)" },
  checkboxRow: { display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", padding: "4px 0" },
  status: { margin: "12px 0 0", color: "var(--muted)", fontSize: 13 },
  errorBox: {
    padding: 14,
    border: "1px solid #c0392b",
    borderRadius: 10,
    background: "#fdf3f2",
    color: "#7b241c",
    fontSize: 13,
    lineHeight: 1.55,
  },
};

// --- component -------------------------------------------------------------

export default function ColorIntelligence({ artworks }: { artworks: ColorArtwork[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [upload, setUpload] = useState<{ name: string; dataUrl: string } | null>(null);
  const [colors, setColors] = useState<ExtractedColor[] | null>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);
  const [harmony, setHarmony] = useState<Harmony>("dominant");
  const [paletteSize, setPaletteSize] = useState(6);
  const [copied, setCopied] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedPalette[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [saveName, setSaveName] = useState("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [renameId, setRenameId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [loadedSaved, setLoadedSaved] = useState<SavedPalette | null>(null);
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [comparePalettes, setComparePalettes] = useState<Record<string, ExtractedColor[]>>({});
  const [compareLoading, setCompareLoading] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  const selectedArtwork = artworks.find((a) => a.id === selectedId) ?? null;
  const sourceLabel = upload
    ? upload.name
    : selectedArtwork
      ? `${selectedArtwork.title} (${selectedArtwork.exhibitionTitle})`
      : null;
  const sourceUrl = upload ? upload.dataUrl : selectedArtwork?.imageUrl ?? null;

  const loadSaved = useCallback(async () => {
    setSavedLoading(true);
    try {
      const res = await fetch("/api/saved-work?kind=palette");
      if (!res.ok) throw new Error("fetch");
      const json = (await res.json()) as { saved?: SavedPalette[] };
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

  const palette: string[] = useMemo(() => {
    if (loadedSaved?.data.colors?.length) return loadedSaved.data.colors;
    if (!colors || colors.length === 0) return [];
    if (harmony === "dominant") return colors.slice(0, paletteSize).map((c) => c.hex);
    return buildHarmony(colors[0].rgb, harmony, paletteSize);
  }, [colors, harmony, paletteSize, loadedSaved]);

  const backgrounds = useMemo(
    () => (colors && colors.length > 0 ? presentationBackgrounds(colors[0].rgb) : []),
    [colors],
  );

  const copyHex = useCallback(async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex);
      setCopied(hex);
      window.setTimeout(() => setCopied((current) => (current === hex ? null : current)), 1600);
    } catch {
      setCopied(null);
    }
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
      setLoadedSaved(null);
    };
    reader.onerror = () => {
      setStatus("error");
      setError("That file could not be read. Try another image.");
    };
    reader.readAsDataURL(file);
  }, []);

  const pickArtwork = useCallback((id: string) => {
    setSelectedId(id);
    setUpload(null);
    setLoadedSaved(null);
  }, []);

  const toggleCompare = useCallback(
    (artwork: ColorArtwork) => {
      setCompareIds((current) => {
        if (current.includes(artwork.id)) return current.filter((id) => id !== artwork.id);
        if (current.length >= MAX_COMPARE) return current;
        return [...current, artwork.id];
      });
      setComparePalettes((current) => {
        if (current[artwork.id]) return current;
        setCompareLoading((loading) => ({ ...loading, [artwork.id]: true }));
        analyseImage(artwork.imageUrl, true)
          .then((result) => {
            setComparePalettes((prev) => ({ ...prev, [artwork.id]: result }));
          })
          .catch(() => {
            setComparePalettes((prev) => ({ ...prev, [artwork.id]: [] }));
          })
          .finally(() => {
            setCompareLoading((loading) => ({ ...loading, [artwork.id]: false }));
          });
        return current;
      });
    },
    [],
  );

  const savePalette = useCallback(async () => {
    if (palette.length === 0) return;
    const title = saveName.trim() || `Palette — ${sourceLabel ?? "untitled"}`;
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch("/api/saved-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "palette",
          title,
          data: { colors: palette, harmony, source: sourceLabel, artworkId: selectedId },
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
  }, [palette, saveName, sourceLabel, harmony, selectedId, loadSaved]);

  const deleteSaved = useCallback(
    async (id: string) => {
      if (!window.confirm("Delete this saved palette?")) return;
      await fetch(`/api/saved-work?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (loadedSaved?.id === id) setLoadedSaved(null);
      await loadSaved();
    },
    [loadedSaved, loadSaved],
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

  const copyHexList = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(palette.join("\n"));
      setSaveStatus("Hex list copied to the clipboard.");
    } catch {
      setSaveStatus("Copy failed — select the list below and copy it by hand.");
    }
  }, [palette]);

  const downloadJson = useCallback(() => {
    const blob = new Blob(
      [JSON.stringify({ name: sourceLabel, harmony, colors: palette }, null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `palette-${(sourceLabel ?? "colours").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [palette, sourceLabel, harmony]);

  const downloadBoard = useCallback(() => {
    if (palette.length === 0) return;
    const width = 1200;
    const pad = 64;
    const swatchH = 220;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = pad * 2 + 130 + swatchH + 90;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fdfdfc";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#a67c37";
    ctx.font = "700 22px 'DM Sans', sans-serif";
    ctx.fillText("SANAA · COLOR INTELLIGENCE", pad, pad + 10);
    ctx.fillStyle = "#141414";
    ctx.font = "600 54px Georgia, serif";
    ctx.fillText(sourceLabel ?? "Palette", pad, pad + 80, width - pad * 2);
    const swatchW = (width - pad * 2 - (palette.length - 1) * 16) / palette.length;
    palette.forEach((hex, i) => {
      const x = pad + i * (swatchW + 16);
      const y = pad + 130;
      ctx.fillStyle = hex;
      ctx.fillRect(x, y, swatchW, swatchH);
      ctx.strokeStyle = "rgba(0,0,0,0.15)";
      ctx.strokeRect(x + 0.5, y + 0.5, swatchW - 1, swatchH - 1);
      ctx.fillStyle = "#141414";
      ctx.font = "700 26px 'DM Sans', sans-serif";
      ctx.fillText(hex, x, y + swatchH + 42);
      const rgb = hexToRgb(hex);
      ctx.fillStyle = "#6f6f6c";
      ctx.font = "400 22px 'DM Sans', sans-serif";
      ctx.fillText(`rgb(${rgb[0]}, ${rgb[1]}, ${rgb[2]})`, x, y + swatchH + 74);
    });
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `colour-board-${(sourceLabel ?? "palette").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
      a.click();
      URL.revokeObjectURL(url);
    }, "image/png");
  }, [palette, sourceLabel]);

  const white: RGB = [255, 255, 255];
  const black: RGB = [0, 0, 0];

  return (
    <div>
      {/* 1 — Pick an artwork or upload ------------------------------------ */}
      <section style={S.section}>
        <h2 style={S.sectionTitle}>Choose an artwork</h2>
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
                  onClick={() => pickArtwork(artwork.id)}
                  style={{
                    ...S.artworkCard,
                    outline: active ? "2px solid var(--accent)" : "none",
                    outlineOffset: 1,
                  }}
                  aria-pressed={active}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={artwork.imageUrl} alt={artwork.title} style={S.artworkThumb} />
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
                  setLoadedSaved(null);
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

      {/* Empty state ------------------------------------------------------ */}
      {!sourceUrl && (
        <div className={styles.emptyBox}>
          <strong>Nothing to analyse yet.</strong>
          <p>
            Select an artwork above or upload an image, and its dominant colours, harmonies and
            contrast will appear here.
          </p>
        </div>
      )}

      {sourceUrl && status === "loading" && (
        <p style={S.status}>Reading the pixels of {sourceLabel}…</p>
      )}

      {status === "error" && error && (
        <div style={S.errorBox} role="alert">
          <strong>Couldn’t analyse this image.</strong>
          <br />
          {error}
        </div>
      )}

      {status === "done" && colors && colors.length > 0 && (
        <>
          {/* 2 — Dominant colours ----------------------------------------- */}
          <section style={S.section}>
            <h2 style={S.sectionTitle}>Dominant colours</h2>
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
                          {copied === color.hex && <span style={S.copiedTag}>copied</span>}
                        </p>
                        <p style={S.swatchMeta}>
                          rgb({color.rgb[0]}, {color.rgb[1]}, {color.rgb[2]})
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

          {/* 3 — Palettes & harmonies ------------------------------------- */}
          <section style={S.section}>
            <h2 style={S.sectionTitle}>Palettes &amp; harmonies</h2>
            <p style={S.sectionNote}>
              Built from the dominant colour by rotating its hue. Tap any swatch to copy its hex.
            </p>
            <div style={S.controls}>
              <label style={S.field}>
                Harmony
                <select
                  style={S.select}
                  value={harmony}
                  onChange={(event) => {
                    setHarmony(event.target.value as Harmony);
                    setLoadedSaved(null);
                  }}
                >
                  {(Object.keys(HARMONY_LABELS) as Harmony[]).map((key) => (
                    <option key={key} value={key}>
                      {HARMONY_LABELS[key]}
                    </option>
                  ))}
                </select>
              </label>
              <label style={S.field}>
                Colours in palette
                <select
                  style={S.select}
                  value={paletteSize}
                  onChange={(event) => {
                    setPaletteSize(Number(event.target.value));
                    setLoadedSaved(null);
                  }}
                >
                  {[3, 4, 5, 6, 7, 8].map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
              {loadedSaved && (
                <span style={{ fontSize: 12, color: "var(--muted)" }}>
                  Showing saved palette “{loadedSaved.title}” — change the harmony or size to go
                  back to the live palette.
                </span>
              )}
            </div>
            <div style={S.swatchGrid}>
              {palette.map((hex) => (
                <div key={hex} style={S.swatchCard}>
                  <button
                    type="button"
                    aria-label={`Copy ${hex}`}
                    onClick={() => void copyHex(hex)}
                    style={{ ...S.swatchBlock, background: hex }}
                  />
                  <div style={S.swatchBody}>
                    <p style={S.swatchHex}>
                      {hex} {copied === hex && <span style={S.copiedTag}>copied</span>}
                    </p>
                    <p style={S.swatchMeta}>
                      rgb({hexToRgb(hex).join(", ")})
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 4 — Contrast analysis ---------------------------------------- */}
          <section style={S.section}>
            <h2 style={S.sectionTitle}>Contrast analysis</h2>
            <p style={S.sectionNote}>
              WCAG contrast ratios for each palette colour against white and black. AA means the
              pair is readable as normal text (4.5:1 or more); 3:1 is enough for large text only.
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Colour</th>
                    <th style={S.th}>On white</th>
                    <th style={S.th}>On black</th>
                    <th style={S.th}>Best as</th>
                  </tr>
                </thead>
                <tbody>
                  {palette.map((hex) => {
                    const rgb = hexToRgb(hex);
                    const onWhite = contrastRatio(rgb, white);
                    const onBlack = contrastRatio(rgb, black);
                    const passWhite = onWhite >= 4.5;
                    const passBlack = onBlack >= 4.5;
                    const verdict = passWhite && passBlack
                      ? "Text on white or black"
                      : passWhite
                        ? "Text on white"
                        : passBlack
                          ? "Text on black"
                          : "Background only — pair with white or black text";
                    return (
                      <tr key={hex}>
                        <td style={S.td}>
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                            <span style={{ ...S.miniSwatch, background: hex }} />
                            <strong>{hex}</strong>
                          </span>
                        </td>
                        <td style={S.td}>
                          {onWhite.toFixed(2)}:1{" "}
                          <span
                            style={{
                              ...S.badge,
                              background: passWhite ? "#e7f2e4" : "#fdf3f2",
                              color: passWhite ? "#2e6b34" : "#7b241c",
                            }}
                          >
                            {passWhite ? "AA pass" : onWhite >= 3 ? "Large text only" : "Fail"}
                          </span>
                        </td>
                        <td style={S.td}>
                          {onBlack.toFixed(2)}:1{" "}
                          <span
                            style={{
                              ...S.badge,
                              background: passBlack ? "#e7f2e4" : "#fdf3f2",
                              color: passBlack ? "#2e6b34" : "#7b241c",
                            }}
                          >
                            {passBlack ? "AA pass" : onBlack >= 3 ? "Large text only" : "Fail"}
                          </span>
                        </td>
                        <td style={S.td}>{verdict}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {/* 5 — Presentation backgrounds --------------------------------- */}
          <section style={S.section}>
            <h2 style={S.sectionTitle}>Present it on these walls</h2>
            <p style={S.sectionNote}>
              Wall colours drawn from the painting itself — so the room frames the work instead of
              competing with it.
            </p>
            <div style={S.bgGrid}>
              {backgrounds.map((bg) => (
                <div key={bg.name} style={S.bgCard}>
                  <div style={{ ...S.bgPreview, background: bg.hex }}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={sourceUrl ?? ""} alt={sourceLabel ?? "Artwork"} style={S.bgPreviewImg} />
                  </div>
                  <div style={S.bgBody}>
                    <p style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700 }}>
                      {bg.name} —{" "}
                      <button
                        type="button"
                        onClick={() => void copyHex(bg.hex)}
                        style={{
                          background: "none",
                          border: 0,
                          padding: 0,
                          cursor: "pointer",
                          color: "var(--accent)",
                          fontWeight: 700,
                          fontSize: 14,
                          fontFamily: "inherit",
                        }}
                      >
                        {bg.hex}
                      </button>{" "}
                      {copied === bg.hex && <span style={S.copiedTag}>copied</span>}
                    </p>
                    <p style={{ margin: 0, color: "var(--muted)", fontSize: 12, lineHeight: 1.5 }}>
                      {bg.note}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 7 — Save & export -------------------------------------------- */}
          <section style={S.section}>
            <h2 style={S.sectionTitle}>Save &amp; export this palette</h2>
            <p style={S.sectionNote}>
              Save the palette to come back to it, or take it with you as a hex list, JSON file or
              a colour board image.
            </p>
            <div style={S.controls}>
              <label style={{ ...S.field, flex: 1, minWidth: 200 }}>
                Palette name
                <input
                  style={S.input}
                  value={saveName}
                  onChange={(event) => setSaveName(event.target.value)}
                  placeholder={sourceLabel ? `Palette — ${sourceLabel}` : "Palette name"}
                />
              </label>
              <button type="button" className="galleries-open-button" onClick={() => void savePalette()} disabled={saving}>
                {saving ? "Saving…" : "Save palette"}
              </button>
              <button type="button" style={S.ghostButton} onClick={() => void copyHexList()}>
                Copy hex list
              </button>
              <button type="button" style={S.ghostButton} onClick={downloadJson}>
                Download JSON
              </button>
              <button type="button" style={S.ghostButton} onClick={downloadBoard}>
                Download colour board (PNG)
              </button>
            </div>
            {saveStatus && <p style={S.status}>{saveStatus}</p>}
            <p style={{ ...S.status, fontFamily: "monospace", fontSize: 12, wordBreak: "break-all" }}>
              {palette.join(", ")}
            </p>
          </section>
        </>
      )}

      {/* 6 — Compare across artworks -------------------------------------- */}
      {artworks.length > 1 && (
        <section style={S.section}>
          <h2 style={S.sectionTitle}>Compare across artworks</h2>
          <p style={S.sectionNote}>
            Tick two or more artworks to see their palettes side by side. (Up to {MAX_COMPARE}.)
          </p>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 16 }}>
            {artworks.map((artwork) => (
              <label key={artwork.id} style={{ ...S.checkboxRow, marginRight: 16 }}>
                <input
                  type="checkbox"
                  checked={compareIds.includes(artwork.id)}
                  disabled={!compareIds.includes(artwork.id) && compareIds.length >= MAX_COMPARE}
                  onChange={() => toggleCompare(artwork)}
                />
                {artwork.title}
              </label>
            ))}
          </div>
          {compareIds.length > 0 && (
            <div style={S.compareGrid}>
              {compareIds.map((id) => {
                const artwork = artworks.find((a) => a.id === id);
                if (!artwork) return null;
                const result = comparePalettes[id];
                return (
                  <div key={id} style={S.compareCol}>
                    <p style={{ margin: "0 0 10px", fontWeight: 700, fontSize: 14 }}>{artwork.title}</p>
                    {compareLoading[id] && <p style={S.status}>Reading pixels…</p>}
                    {!compareLoading[id] && result && result.length === 0 && (
                      <p style={S.status}>This image could not be read — try uploading it directly.</p>
                    )}
                    {!compareLoading[id] && result && result.length > 0 && (
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {result.map((color) => (
                          <button
                            key={color.hex}
                            type="button"
                            onClick={() => void copyHex(color.hex)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              width: "100%",
                              padding: 0,
                              border: 0,
                              background: "none",
                              cursor: "pointer",
                              textAlign: "left",
                              fontFamily: "inherit",
                              color: "var(--ink)",
                            }}
                          >
                            <span style={{ ...S.miniSwatch, width: 34, height: 34, background: color.hex }} />
                            <span style={{ fontSize: 13 }}>
                              <strong>{color.hex}</strong>
                              <br />
                              <span style={{ color: "var(--muted)", fontSize: 12 }}>
                                {color.share.toFixed(1)}% of the image
                              </span>
                            </span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {compareIds.length === 1 && (
            <p style={S.status}>Tick one more artwork to compare.</p>
          )}
        </section>
      )}

      {/* Saved palettes ---------------------------------------------------- */}
      <section style={S.section}>
        <h2 style={S.sectionTitle}>Your saved palettes</h2>
        {savedLoading ? (
          <p style={S.status}>Loading your saved palettes…</p>
        ) : saved.length === 0 ? (
          <p style={S.status}>
            No saved palettes yet. Analyse an artwork above and save its palette to find it here.
          </p>
        ) : (
          <div>
            {saved.map((item) => {
              const itemColors = item.data.colors ?? [];
              return (
                <div key={item.id} style={S.savedRow}>
                  <span style={{ display: "inline-flex", gap: 4 }}>
                    {itemColors.slice(0, 6).map((hex) => (
                      <span key={hex} style={{ ...S.miniSwatch, background: hex }} title={hex} />
                    ))}
                  </span>
                  {renameId === item.id ? (
                    <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
                      <input
                        style={{ ...S.input, minHeight: 34 }}
                        value={renameValue}
                        onChange={(event) => setRenameValue(event.target.value)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") void renameSaved(item.id);
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
                    {item.data.harmony ? `${HARMONY_LABELS[(item.data.harmony as Harmony) ?? "dominant"] ?? item.data.harmony} · ` : ""}
                    {item.data.source ?? ""}
                  </span>
                  <span style={{ marginLeft: "auto", display: "inline-flex", gap: 8 }}>
                    <button
                      type="button"
                      style={S.ghostButton}
                      onClick={() => {
                        setLoadedSaved(item);
                        setStatus("done");
                      }}
                    >
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
                    <button type="button" style={S.ghostButton} onClick={() => void deleteSaved(item.id)}>
                      Delete
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
