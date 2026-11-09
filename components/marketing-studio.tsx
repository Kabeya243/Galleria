"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { archiveToolDocument, deleteToolArchive } from "@/lib/tool-archive";
import styles from "@/components/tools.module.css";

// Marketing Studio — generate exhibition marketing assets from the artist's
// own artworks and exhibitions: posters, social graphics, invitation cards,
// press kits and announcements. Three reusable templates, brand colours
// taken from the artist's own artwork palettes, live canvas preview, and
// export at real pixel sizes (drawn at target size, never upscaled) plus
// print-to-PDF for posters, cards and the press kit.
//
// Design: the existing white-gallery luxury language only. Component styles
// live in the <style> block at the bottom of this file.

export type MarketingArtwork = {
  id: string;
  title: string;
  artist: string;
  year: string;
  medium: string;
  dimensions: string;
  description: string;
  color: string;
  accent: string;
  imageUrl: string | null;
  exhibitionTitle: string;
};

export type MarketingExhibition = { id: string; title: string; description: string; status: string };

type AssetKind = "poster" | "social-square" | "social-story" | "social-landscape" | "invitation" | "press-kit" | "announcement";
type TemplateId = "classic" | "bold" | "minimal";
type PosterSize = "A3" | "A4";

const ASSET_KINDS: { id: AssetKind; label: string; blurb: string }[] = [
  { id: "poster", label: "Poster", blurb: "A3 or A4 at 150 dpi, print-ready PNG or PDF." },
  { id: "social-square", label: "Social: Square 1:1", blurb: "1080 × 1080 px for Instagram / Facebook feeds." },
  { id: "social-story", label: "Social: Story 9:16", blurb: "1080 × 1920 px for Instagram / WhatsApp stories." },
  { id: "social-landscape", label: "Social: Landscape 16:9", blurb: "1200 × 628 px for X, Facebook and email headers." },
  { id: "invitation", label: "Invitation card", blurb: "A5 landscape at 300 dpi, print or share digitally." },
  { id: "press-kit", label: "Press kit", blurb: "Exhibition text, artwork list and contact. Print to PDF." },
  { id: "announcement", label: "Announcement", blurb: "1200 × 628 px banner for a new show or opening." },
];

const TEMPLATES: { id: TemplateId; label: string; blurb: string }[] = [
  { id: "classic", label: "Classic", blurb: "Centred artwork, serif headline, gold rule, the gallery look." },
  { id: "bold", label: "Bold", blurb: "Big colour block and oversized type. Loud, for a launch." },
  { id: "minimal", label: "Minimal", blurb: "Small type, lots of white space. Quiet and confident." },
];

type AssetConfig = {
  kind: AssetKind;
  posterSize: PosterSize;
  template: TemplateId;
  exhibitionId: string;
  artworkId: string;
  headline: string;
  subheadline: string;
  dateText: string;
  venueText: string;
  artistName: string;
  logoText: string;
  bgColor: string;
  accentColor: string;
  textColor: string;
  includeImage: boolean;
  pressText: string;
};

type SavedAsset = { id: string; title: string; data: Record<string, unknown>; updatedAt: string };

function assetSize(cfg: AssetConfig): { w: number; h: number; label: string } {
  switch (cfg.kind) {
    case "poster": return cfg.posterSize === "A3" ? { w: 1754, h: 2480, label: "A3 · 1754 × 2480 px @ 150 dpi" } : { w: 1240, h: 1754, label: "A4 · 1240 × 1754 px @ 150 dpi" };
    case "social-square": return { w: 1080, h: 1080, label: "1080 × 1080 px" };
    case "social-story": return { w: 1080, h: 1920, label: "1080 × 1920 px" };
    case "social-landscape": return { w: 1200, h: 628, label: "1200 × 628 px" };
    case "invitation": return { w: 1748, h: 1240, label: "A5 landscape · 1748 × 1240 px @ 300 dpi" };
    case "announcement": return { w: 1200, h: 628, label: "1200 × 628 px" };
    case "press-kit": return { w: 1240, h: 1754, label: "A4 press sheet" };
  }
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${url}`));
    img.src = url;
  });
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, x: number, y: number, w: number, h: number) {
  const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
}

function drawPlaceholder(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, c1: string, c2: string, label: string) {
  const grad = ctx.createLinearGradient(x, y, x + w, y + h);
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.fillStyle = grad;
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  ctx.font = `600 ${Math.max(18, w * 0.03)}px Georgia, serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  const lines = wrapText(ctx, label, w * 0.8);
  lines.forEach((line, i) => ctx.fillText(line, x + w / 2, y + h / 2 + (i - (lines.length - 1) / 2) * Math.max(22, w * 0.04)));
}

/** One draw routine for preview AND export — the preview canvas and the
 * export canvas run the exact same code, so what you see is what you get. */
function drawAsset(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cfg: AssetConfig,
  art: MarketingArtwork | undefined,
  img: HTMLImageElement | null,
) {
  const s = w / 1080; // scale factor relative to a 1080-wide design
  const serif = "Georgia, 'Times New Roman', serif";
  const sans = "system-ui, -apple-system, sans-serif";
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = cfg.bgColor;
  ctx.fillRect(0, 0, w, h);
  ctx.textBaseline = "alphabetic";

  const headline = cfg.headline || art?.title || cfg.artistName || "Exhibition";
  const details = [cfg.dateText, cfg.venueText].filter(Boolean).join("  ·  ");
  const pad = Math.round(64 * s);

  if (cfg.template === "bold") {
    // Accent block across the top, oversized headline, artwork below.
    const blockH = Math.round(h * 0.42);
    ctx.fillStyle = cfg.accentColor;
    ctx.fillRect(0, 0, w, blockH);
    ctx.fillStyle = cfg.bgColor;
    ctx.font = `700 ${Math.round(34 * s)}px ${sans}`;
    ctx.textAlign = "left";
    ctx.fillText((cfg.logoText || cfg.artistName || "Lakisa").toUpperCase(), pad, Math.round(78 * s));
    ctx.font = `700 ${Math.round(92 * s)}px ${serif}`;
    const lines = wrapText(ctx, headline, w - pad * 2);
    lines.slice(0, 3).forEach((line, i) => ctx.fillText(line, pad, Math.round(190 * s) + i * Math.round(104 * s)));
    const imgY = blockH + pad / 2;
    const imgH = h - imgY - pad - Math.round(120 * s);
    if (cfg.includeImage && art) {
      if (img) drawCover(ctx, img, pad, imgY, w - pad * 2, Math.max(60, imgH));
      else drawPlaceholder(ctx, pad, imgY, w - pad * 2, Math.max(60, imgH), art.color, art.accent, art.title);
    }
    ctx.fillStyle = cfg.textColor;
    ctx.font = `400 ${Math.round(30 * s)}px ${sans}`;
    ctx.textAlign = "left";
    if (cfg.subheadline) ctx.fillText(cfg.subheadline, pad, h - Math.round(96 * s));
    if (details) ctx.fillText(details, pad, h - Math.round(52 * s));
    return;
  }

  if (cfg.template === "minimal") {
    // Small artwork left, small uppercase type right — or centred for stories.
    const imgW = Math.round(w * 0.52);
    const imgH = Math.round(h * 0.62);
    const imgX = pad;
    const imgY = Math.round(h * 0.16);
    if (cfg.includeImage && art) {
      if (img) drawCover(ctx, img, imgX, imgY, imgW, imgH);
      else drawPlaceholder(ctx, imgX, imgY, imgW, imgH, art.color, art.accent, art.title);
    }
    const tx = imgX + imgW + pad;
    ctx.fillStyle = cfg.accentColor;
    ctx.fillRect(tx, imgY, Math.round(48 * s), Math.round(4 * s));
    ctx.fillStyle = cfg.textColor;
    ctx.textAlign = "left";
    ctx.font = `600 ${Math.round(26 * s)}px ${sans}`;
    ctx.fillText((cfg.logoText || cfg.artistName || "").toUpperCase(), tx, imgY + Math.round(64 * s));
    ctx.font = `600 ${Math.round(52 * s)}px ${serif}`;
    const lines = wrapText(ctx, headline, w - tx - pad);
    lines.slice(0, 4).forEach((line, i) => ctx.fillText(line, tx, imgY + Math.round(140 * s) + i * Math.round(62 * s)));
    ctx.font = `400 ${Math.round(28 * s)}px ${sans}`;
    ctx.fillStyle = "#6f6a61";
    let ty = imgY + Math.round(140 * s) + Math.min(4, lines.length) * Math.round(62 * s) + Math.round(24 * s);
    if (cfg.subheadline) { ctx.fillText(cfg.subheadline, tx, ty); ty += Math.round(40 * s); }
    if (details) ctx.fillText(details, tx, ty);
    if (art) {
      ctx.font = `400 ${Math.round(24 * s)}px ${sans}`;
      ctx.fillText([art.title, art.year, art.medium].filter(Boolean).join(" · "), pad, h - pad);
    }
    return;
  }

  // classic — centred artwork, serif headline, gold rule, details.
  ctx.textAlign = "center";
  ctx.fillStyle = cfg.textColor;
  ctx.font = `600 ${Math.round(28 * s)}px ${sans}`;
  ctx.fillText((cfg.logoText || cfg.artistName || "Lakisa").toUpperCase(), w / 2, Math.round(86 * s));
  const imgTop = Math.round(130 * s);
  const imgW = Math.round(w * 0.78);
  const imgH = Math.round(h * 0.52);
  const imgX = (w - imgW) / 2;
  if (cfg.includeImage && art) {
    if (img) drawCover(ctx, img, imgX, imgTop, imgW, imgH);
    else drawPlaceholder(ctx, imgX, imgTop, imgW, imgH, art.color, art.accent, art.title);
  }
  let y = imgTop + imgH + Math.round(72 * s);
  ctx.font = `600 ${Math.round(64 * s)}px ${serif}`;
  const lines = wrapText(ctx, headline, w - pad * 2);
  lines.slice(0, 3).forEach((line, i) => ctx.fillText(line, w / 2, y + i * Math.round(76 * s)));
  y += Math.min(3, lines.length) * Math.round(76 * s) + Math.round(28 * s);
  ctx.fillStyle = cfg.accentColor;
  ctx.fillRect(w / 2 - Math.round(36 * s), y, Math.round(72 * s), Math.round(3 * s));
  y += Math.round(52 * s);
  ctx.fillStyle = cfg.textColor;
  ctx.font = `400 ${Math.round(30 * s)}px ${sans}`;
  if (cfg.subheadline) { ctx.fillText(cfg.subheadline, w / 2, y); y += Math.round(44 * s); }
  if (details) { ctx.fillText(details, w / 2, y); y += Math.round(44 * s); }
  if (art) {
    ctx.fillStyle = "#6f6a61";
    ctx.font = `400 ${Math.round(26 * s)}px ${sans}`;
    ctx.fillText([art.title, art.year, art.medium].filter(Boolean).join(" · "), w / 2, y);
  }
}

function defaultConfig(artistName: string, exhibitions: MarketingExhibition[], artworks: MarketingArtwork[]): AssetConfig {
  const firstArt = artworks[0];
  return {
    kind: "poster",
    posterSize: "A3",
    template: "classic",
    exhibitionId: exhibitions[0]?.id ?? "",
    artworkId: firstArt?.id ?? "",
    headline: exhibitions[0]?.title ?? "",
    subheadline: "",
    dateText: "",
    venueText: "",
    artistName,
    logoText: artistName,
    bgColor: "#fdfdfc",
    accentColor: "#000000",
    textColor: "#141414",
    includeImage: true,
    pressText: exhibitions[0]?.description ?? "",
  };
}

function configFromSaved(data: Record<string, unknown>, artistName: string, exhibitions: MarketingExhibition[], artworks: MarketingArtwork[]): AssetConfig {
  const base = defaultConfig(artistName, exhibitions, artworks);
  const merged = { ...base, ...(data as Partial<AssetConfig>) };
  return merged;
}

const PALETTE_PRESETS = [
  { label: "Gallery white / black", bg: "#fdfdfc", accent: "#000000", text: "#141414" },
  { label: "Ink black / gold", bg: "#141414", accent: "#c9a35c", text: "#f5f1e8" },
  { label: "Warm paper / rust", bg: "#f5efe4", accent: "#9a4a2b", text: "#1d1a16" },
  { label: "Sage / ink", bg: "#eef0ea", accent: "#4c5b4a", text: "#1d1a16" },
];

export default function MarketingStudio({
  userName,
  artworks,
  exhibitions,
  initialExhibitionId,
  initialArtworkId,
}: {
  userName: string;
  artworks: MarketingArtwork[];
  exhibitions: MarketingExhibition[];
  // Deep-link context (Art in Context step 10): open with this
  // exhibition / artwork already selected instead of the newest ones.
  initialExhibitionId?: string;
  initialArtworkId?: string;
}) {
  const [cfg, setCfg] = useState<AssetConfig>(() => {
    const base = defaultConfig(userName, exhibitions, artworks);
    const linkedEx = exhibitions.find((e) => e.id === initialExhibitionId);
    if (linkedEx) {
      base.exhibitionId = linkedEx.id;
      base.headline = linkedEx.title;
      base.pressText = linkedEx.description ?? "";
    }
    if (initialArtworkId && artworks.some((a) => a.id === initialArtworkId)) base.artworkId = initialArtworkId;
    return base;
  });
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);
  const [imgLoading, setImgLoading] = useState(false);
  const [saved, setSaved] = useState<SavedAsset[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const [saveTitle, setSaveTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [exportMsg, setExportMsg] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const cfgRef = useRef(cfg);
  cfgRef.current = cfg;
  const imgRef = useRef(img);
  imgRef.current = img;

  const selectedArt = useMemo(() => artworks.find((a) => a.id === cfg.artworkId), [artworks, cfg.artworkId]);
  const selectedEx = useMemo(() => exhibitions.find((e) => e.id === cfg.exhibitionId), [exhibitions, cfg.exhibitionId]);
  const size = assetSize(cfg);
  const isPressKit = cfg.kind === "press-kit";
  const pressArtworks = useMemo(
    () => (selectedEx ? artworks.filter((a) => a.exhibitionTitle === selectedEx.title) : artworks),
    [selectedEx, artworks],
  );

  // Load the artwork image (CORS-safe); on failure the canvas draws a
  // colour stand-in from the artwork's own palette and says so honestly.
  useEffect(() => {
    let cancelled = false;
    if (!selectedArt?.imageUrl) {
      setImg(null);
      setImgError(null);
      return;
    }
    setImgLoading(true);
    loadImage(selectedArt.imageUrl)
      .then((loaded) => {
        if (!cancelled) {
          setImg(loaded);
          setImgError(null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setImg(null);
          setImgError(`Could not load the image for “${selectedArt.title}” (the file may not allow cross-origin use). The preview and export use a colour stand-in from the artwork's palette instead.`);
        }
      })
      .finally(() => {
        if (!cancelled) setImgLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedArt]);

  // Live preview redraw — same draw routine as the export.
  useEffect(() => {
    if (isPressKit) return;
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scale = Math.min(1, 560 / size.w);
    canvas.width = Math.round(size.w * scale);
    canvas.height = Math.round(size.h * scale);
    ctx.save();
    ctx.scale(scale, scale);
    drawAsset(ctx, size.w, size.h, cfg, selectedArt, img);
    ctx.restore();
  }, [cfg, selectedArt, img, size.w, size.h, isPressKit]);

  const refreshSaved = useCallback(async () => {
    setSavedLoading(true);
    setSavedError(null);
    try {
      const res = await fetch("/api/saved-work?kind=marketing-asset");
      if (!res.ok) throw new Error("Could not load your saved designs.");
      const json = (await res.json()) as { saved: SavedAsset[] };
      setSaved(json.saved ?? []);
    } catch (err) {
      setSavedError(err instanceof Error ? err.message : "Could not load your saved designs.");
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshSaved();
  }, [refreshSaved]);

  const update = useCallback((patch: Partial<AssetConfig>) => {
    setCfg((c) => ({ ...c, ...patch }));
  }, []);

  const pickExhibition = useCallback(
    (id: string) => {
      const ex = exhibitions.find((e) => e.id === id);
      const firstArt = artworks.find((a) => a.exhibitionTitle === ex?.title);
      setCfg((c) => ({
        ...c,
        exhibitionId: id,
        headline: ex?.title ?? c.headline,
        pressText: ex?.description ?? c.pressText,
        artworkId: firstArt?.id ?? c.artworkId,
      }));
    },
    [exhibitions, artworks],
  );

  const applyPalette = useCallback((preset: (typeof PALETTE_PRESETS)[number]) => {
    setCfg((c) => ({ ...c, bgColor: preset.bg, accentColor: preset.accent, textColor: preset.text }));
  }, []);

  const useArtworkColours = useCallback(() => {
    if (!selectedArt) return;
    setCfg((c) => ({ ...c, accentColor: selectedArt.accent, bgColor: "#fdfdfc", textColor: "#141414" }));
  }, [selectedArt]);

  const doSave = useCallback(async () => {
    const title = saveTitle.trim() || cfgRef.current.headline.trim() || "Untitled design";
    setSaving(true);
    setSaveMsg(null);
    try {
      let savedId: string | null = loadedId;
      if (loadedId) {
        const res = await fetch("/api/saved-work", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: loadedId, title, data: cfgRef.current }),
        });
        if (!res.ok) throw new Error("Could not update this design.");
        setSaveMsg(`Updated “${title}”.`);
      } else {
        const res = await fetch("/api/saved-work", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "marketing-asset", title, data: cfgRef.current }),
        });
        if (!res.ok) throw new Error("Could not save this design.");
        const json = (await res.json()) as { saved: SavedAsset };
        savedId = json.saved.id;
        setLoadedId(json.saved.id);
        setSaveMsg(`Saved “${title}”.`);
      }
      // R2 archive copy, same mechanism as Atelier designs (best-effort).
      if (savedId) {
        const archived = await archiveToolDocument("marketing-asset", savedId, cfgRef.current);
        if (archived.archived) setSaveMsg((prev) => `${prev ?? ""} Archived in your account.`);
      }
      setSaveTitle("");
      await refreshSaved();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Could not save this design.");
    } finally {
      setSaving(false);
    }
  }, [saveTitle, loadedId, refreshSaved]);

  const doLoad = useCallback(
    (row: SavedAsset) => {
      setCfg(configFromSaved(row.data, userName, exhibitions, artworks));
      setLoadedId(row.id);
      setSaveTitle(row.title);
      setSaveMsg(`Loaded “${row.title}”.`);
    },
    [userName, exhibitions, artworks],
  );

  const doDelete = useCallback(
    async (id: string, title: string) => {
      try {
        const res = await fetch(`/api/saved-work?id=${encodeURIComponent(id)}`, { method: "DELETE" });
        if (!res.ok) throw new Error("Could not delete this design.");
        await deleteToolArchive("marketing-asset", id);
        if (loadedId === id) setLoadedId(null);
        setConfirmDeleteId(null);
        await refreshSaved();
        setSaveMsg(`Deleted “${title}”.`);
      } catch {
        setSaveMsg("Could not delete this design.");
      }
    },
    [loadedId, refreshSaved],
  );

  const newDesign = useCallback(() => {
    setCfg(defaultConfig(userName, exhibitions, artworks));
    setLoadedId(null);
    setSaveTitle("");
    setSaveMsg("Started a new design.");
  }, [userName, exhibitions, artworks]);

  const exportImage = useCallback(
    async (format: "png" | "jpeg") => {
      setExporting(true);
      setExportMsg(null);
      try {
        const { w, h } = assetSize(cfgRef.current);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas is not available in this browser.");
        const art = artworks.find((a) => a.id === cfgRef.current.artworkId);
        drawAsset(ctx, w, h, cfgRef.current, art, imgRef.current);
        const blob = await new Promise<Blob | null>((resolve) =>
          canvas.toBlob(resolve, format === "png" ? "image/png" : "image/jpeg", 0.92),
        );
        if (!blob) throw new Error("Could not create the image file.");
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `${(cfgRef.current.headline || "marketing-asset").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "marketing-asset"}-${w}x${h}.${format === "png" ? "png" : "jpg"}`;
        a.click();
        URL.revokeObjectURL(url);
        setExportMsg(`Exported ${w} × ${h} px ${format.toUpperCase()}, drawn at full size, not upscaled.`);
      } catch (err) {
        setExportMsg(err instanceof Error ? err.message : "Export failed.");
      } finally {
        setExporting(false);
      }
    },
    [artworks],
  );

  const printAsset = useCallback(() => {
    setExportMsg("Printing… use your printer's PDF option to save a PDF.");
    window.print();
  }, []);

  const copyPressText = useCallback(async () => {
    const lines = [
      cfg.headline,
      "",
      cfg.pressText,
      "",
      `Works (${pressArtworks.length}):`,
      ...pressArtworks.map((a) => `• ${a.title}${a.year ? `, ${a.year}` : ""}${a.medium ? `, ${a.medium}` : ""}${a.dimensions ? ` (${a.dimensions})` : ""}`),
      "",
      `Contact: ${cfg.artistName}${cfg.dateText ? ` · ${cfg.dateText}` : ""}${cfg.venueText ? ` · ${cfg.venueText}` : ""}`,
    ].join("\n");
    try {
      await navigator.clipboard.writeText(lines);
      setExportMsg("Press kit text copied to the clipboard.");
    } catch {
      setExportMsg("Could not copy. Select the text in the preview and copy it manually.");
    }
  }, [cfg, pressArtworks]);

  return (
    <div className="mk">
      <div className="mk-editor">
        <section className="mk-card">
          <h2>Asset type</h2>
          <div className="mk-kinds">
            {ASSET_KINDS.map((k) => (
              <button key={k.id} type="button" className={`mk-kind ${cfg.kind === k.id ? "active" : ""}`} onClick={() => update({ kind: k.id })} aria-pressed={cfg.kind === k.id}>
                <strong>{k.label}</strong>
                <span>{k.blurb}</span>
              </button>
            ))}
          </div>
          {cfg.kind === "poster" && (
            <label className={styles.field}>
              Poster size
              <select value={cfg.posterSize} onChange={(e) => update({ posterSize: e.target.value as PosterSize })}>
                <option value="A3">A3: 1754 × 2480 px @ 150 dpi</option>
                <option value="A4">A4: 1240 × 1754 px @ 150 dpi</option>
              </select>
            </label>
          )}
          <p className="mk-note">Export size: <strong>{size.label}</strong></p>
        </section>

        <section className="mk-card">
          <h2>Template</h2>
          <div className="mk-kinds">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" className={`mk-kind ${cfg.template === t.id ? "active" : ""}`} onClick={() => update({ template: t.id })} aria-pressed={cfg.template === t.id}>
                <strong>{t.label}</strong>
                <span>{t.blurb}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="mk-card">
          <h2>Content</h2>
          <label className={styles.field}>
            Exhibition
            <select value={cfg.exhibitionId} onChange={(e) => pickExhibition(e.target.value)}>
              {exhibitions.map((e) => (
                <option key={e.id} value={e.id}>{e.title}</option>
              ))}
            </select>
          </label>
          <label className={styles.field}>
            Featured artwork
            <select value={cfg.artworkId} onChange={(e) => update({ artworkId: e.target.value })}>
              {artworks.map((a) => (
                <option key={a.id} value={a.id}>{a.title}, {a.exhibitionTitle}</option>
              ))}
            </select>
          </label>
          <label className="mk-check">
            <input type="checkbox" checked={cfg.includeImage} onChange={(e) => update({ includeImage: e.target.checked })} />
            Show the artwork image on the asset
          </label>
          <label className={styles.field}>
            Headline
            <input value={cfg.headline} onChange={(e) => update({ headline: e.target.value })} />
          </label>
          <label className={styles.field}>
            Subheadline
            <input value={cfg.subheadline} onChange={(e) => update({ subheadline: e.target.value })} placeholder="e.g. Solo exhibition" />
          </label>
          <div className="mk-row">
            <label className={styles.field}>
              Dates
              <input value={cfg.dateText} onChange={(e) => update({ dateText: e.target.value })} placeholder="19 Nov – 19 Dec 2026" />
            </label>
            <label className={styles.field}>
              Venue
              <input value={cfg.venueText} onChange={(e) => update({ venueText: e.target.value })} placeholder="Gallery, City" />
            </label>
          </div>
          {isPressKit && (
            <label className={styles.field}>
              Exhibition text
              <textarea value={cfg.pressText} rows={6} onChange={(e) => update({ pressText: e.target.value })} />
            </label>
          )}
        </section>

        <section className="mk-card">
          <h2>Brand</h2>
          <label className={styles.field}>
            Artist / logo text
            <input value={cfg.logoText} onChange={(e) => update({ logoText: e.target.value })} />
          </label>
          <div className="mk-palette-label">Colour presets</div>
          <div className="mk-palettes">
            {PALETTE_PRESETS.map((p) => (
              <button key={p.label} type="button" className="mk-palette" onClick={() => applyPalette(p)} title={p.label}>
                <span className="mk-sw" style={{ background: p.bg, borderColor: p.accent }}><i style={{ background: p.accent }} /></span>
                {p.label}
              </button>
            ))}
            <button type="button" className="mk-palette" onClick={useArtworkColours} disabled={!selectedArt} title="Use the featured artwork's own colours">
              <span className="mk-sw" style={{ background: selectedArt?.color ?? "#ddd", borderColor: selectedArt?.accent ?? "#999" }}>
                <i style={{ background: selectedArt?.accent ?? "#999" }} />
              </span>
              From featured artwork
            </button>
          </div>
          <div className="mk-row">
            <label className={styles.field}>
              Background
              <span className="mk-color-row">
                <input type="color" value={cfg.bgColor} onChange={(e) => update({ bgColor: e.target.value })} aria-label="Background colour" />
                <input value={cfg.bgColor} onChange={(e) => update({ bgColor: e.target.value })} />
              </span>
            </label>
            <label className={styles.field}>
              Accent
              <span className="mk-color-row">
                <input type="color" value={cfg.accentColor} onChange={(e) => update({ accentColor: e.target.value })} aria-label="Accent colour" />
                <input value={cfg.accentColor} onChange={(e) => update({ accentColor: e.target.value })} />
              </span>
            </label>
          </div>
        </section>

        <section className="mk-card">
          <h2>Export &amp; save</h2>
          {isPressKit ? (
            <div className="mk-actions">
              <button type="button" className="mk-btn primary" onClick={printAsset}>Print / save as PDF</button>
              <button type="button" className="mk-btn secondary" onClick={() => void copyPressText()}>Copy press text</button>
            </div>
          ) : (
            <div className="mk-actions">
              <button type="button" className="mk-btn primary" onClick={() => void exportImage("png")} disabled={exporting}>
                {exporting ? "Exporting…" : `Export PNG · ${size.w} × ${size.h}`}
              </button>
              <button type="button" className="mk-btn secondary" onClick={() => void exportImage("jpeg")} disabled={exporting}>Export JPEG</button>
              <button type="button" className="mk-btn secondary" onClick={printAsset}>Print / PDF</button>
            </div>
          )}
          {exportMsg && <p className="mk-msg" role="status">{exportMsg}</p>}
          {imgLoading && <p className="mk-msg">Loading artwork image…</p>}
          {imgError && <p className="mk-error">{imgError}</p>}
          <label className={styles.field}>
            Design name (for your saved list)
            <input value={saveTitle} onChange={(e) => setSaveTitle(e.target.value)} placeholder={cfg.headline || "Untitled design"} />
          </label>
          <div className="mk-actions">
            <button type="button" className="mk-btn primary" onClick={() => void doSave()} disabled={saving}>
              {saving ? "Saving…" : loadedId ? "Update design" : "Save design"}
            </button>
            <button type="button" className="mk-btn secondary" onClick={newDesign}>New design</button>
          </div>
          {saveMsg && <p className="mk-msg" role="status">{saveMsg}</p>}
        </section>

        <section className="mk-card">
          <h2>Your saved designs</h2>
          {savedLoading ? (
            <p className="mk-note">Loading your saved designs…</p>
          ) : savedError ? (
            <p className="mk-error">{savedError}</p>
          ) : saved.length === 0 ? (
            <p className="mk-note">No saved designs yet.</p>
          ) : (
            <ul className="mk-saved">
              {saved.map((row) => (
                <li key={row.id}>
                  <button type="button" className="mk-saved-title" onClick={() => doLoad(row)}>{row.title}</button>
                  <span className="mk-muted">{new Date(row.updatedAt).toLocaleDateString()}</span>
                  {confirmDeleteId === row.id ? (
                    <>
                      <button type="button" className="mk-danger" onClick={() => void doDelete(row.id, row.title)}>Confirm delete</button>
                      <button type="button" className="mk-btn secondary" onClick={() => setConfirmDeleteId(null)}>Cancel</button>
                    </>
                  ) : (
                    <button type="button" className="mk-danger" onClick={() => setConfirmDeleteId(row.id)}>Delete</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* ---- Preview ---- */}
      <div className="mk-preview-col">
        <div className="mk-preview-bar">
          <strong>Live preview</strong>
          <span className="mk-muted">{isPressKit ? "A4 press sheet" : `${size.label} · preview scaled`}</span>
        </div>
        {isPressKit ? (
          <div className="mk-press print-area">
            <p className="mk-press-eyebrow">Press kit: {cfg.artistName}</p>
            <h2>{cfg.headline || "Exhibition"}</h2>
            <p className="mk-press-meta">{[cfg.dateText, cfg.venueText].filter(Boolean).join(" · ")}</p>
            <p className="mk-press-text">{cfg.pressText || "No exhibition text yet. Write it in the Content panel."}</p>
            <h3>Works in the exhibition ({pressArtworks.length})</h3>
            {pressArtworks.length === 0 ? (
              <p className="mk-note">No artworks in this exhibition yet.</p>
            ) : (
              <ul>
                {pressArtworks.map((a) => (
                  <li key={a.id}>
                    <strong>{a.title}</strong>
                    {a.year ? `, ${a.year}` : ""}{a.medium ? `, ${a.medium}` : ""}{a.dimensions ? ` (${a.dimensions})` : ""}
                  </li>
                ))}
              </ul>
            )}
            <h3>Contact</h3>
            <p>{cfg.artistName}{cfg.dateText ? ` · ${cfg.dateText}` : ""}{cfg.venueText ? ` · ${cfg.venueText}` : ""}</p>
          </div>
        ) : (
          <div className="mk-canvas-wrap print-area">
            <canvas ref={previewRef} aria-label="Marketing asset preview" />
          </div>
        )}
      </div>

      <style>{`
        .mk { display: grid; grid-template-columns: minmax(340px, 460px) 1fr; gap: 28px; align-items: start; }
        @media (max-width: 1080px) { .mk { grid-template-columns: 1fr; } }
        .mk-editor { display: flex; flex-direction: column; gap: 18px; }
        .mk-card { border: 1px solid var(--line); border-radius: 10px; background: var(--paper); padding: 20px; display: flex; flex-direction: column; gap: 12px; }
        .mk-card h2 { margin: 0; font-size: 17px; font-family: Fraunces, Georgia, serif; }
        .mk-card textarea { padding: 10px; border: 1px solid var(--line); border-radius: 5px; background: var(--paper); color: var(--ink); font: inherit; font-size: 14px; resize: vertical; }
        .mk-note { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.55; }
        .mk-muted { color: var(--muted); font-size: 12px; }
        .mk-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
        @media (max-width: 560px) { .mk-row { grid-template-columns: 1fr; } }
        .mk-kinds { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        @media (max-width: 560px) { .mk-kinds { grid-template-columns: 1fr; } }
        .mk-kind { text-align: left; border: 1px solid var(--line); border-radius: 8px; background: var(--paper); color: var(--ink); padding: 10px 12px; cursor: pointer; font: inherit; display: flex; flex-direction: column; gap: 2px; }
        .mk-kind strong { font-size: 14px; }
        .mk-kind span { font-size: 12px; color: var(--muted); line-height: 1.45; }
        .mk-kind.active { border-color: var(--ink); box-shadow: 0 0 0 1px var(--ink); }
        .mk-check { display: flex; align-items: center; gap: 8px; font-size: 14px; cursor: pointer; }
        .mk-check input { accent-color: #ffffff; width: 16px; height: 16px; }
        .mk-palette-label { font-size: 12px; font-weight: 600; color: var(--muted); }
        .mk-palettes { display: flex; flex-direction: column; gap: 6px; }
        .mk-palette { display: flex; align-items: center; gap: 10px; border: 1px solid var(--line); border-radius: 6px; background: var(--paper); color: var(--ink); padding: 7px 10px; font: inherit; font-size: 13px; cursor: pointer; text-align: left; }
        .mk-palette:disabled { opacity: 0.5; cursor: not-allowed; }
        .mk-sw { width: 28px; height: 28px; border-radius: 50%; border: 1px solid var(--line); display: grid; place-items: center; flex: none; }
        .mk-sw i { width: 12px; height: 12px; border-radius: 50%; display: block; }
        .mk-color-row { display: flex; gap: 8px; align-items: center; }
        .mk-color-row input[type="color"] { width: 44px; height: 40px; padding: 2px; border: 1px solid var(--line); border-radius: 5px; background: var(--paper); cursor: pointer; }
        .mk-color-row input:last-child { flex: 1; }
        .mk-btn { border-radius: 6px; padding: 10px 16px; font: inherit; font-size: 14px; font-weight: 600; cursor: pointer; border: 1px solid var(--ink); }
        .mk-btn.primary { background: var(--ink); color: var(--paper); }
        .mk-btn.secondary { background: transparent; color: var(--ink); }
        .mk-btn:disabled { opacity: 0.55; cursor: wait; }
        .mk-actions { display: flex; gap: 10px; flex-wrap: wrap; }
        .mk-msg { margin: 0; font-size: 13px; color: var(--muted); }
        .mk-error { margin: 0; font-size: 13px; color: #9a2b2b; }
        .mk-saved { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
        .mk-saved li { display: flex; gap: 10px; align-items: center; flex-wrap: wrap; font-size: 13px; }
        .mk-saved-title { background: none; border: none; padding: 0; cursor: pointer; font: inherit; font-weight: 600; color: var(--ink); text-align: left; }
        .mk-danger { background: none; border: none; padding: 0; cursor: pointer; font: inherit; color: #9a2b2b; }
        .mk-preview-col { position: sticky; top: 16px; }
        @media (max-width: 1080px) { .mk-preview-col { position: static; } }
        .mk-preview-bar { display: flex; justify-content: space-between; align-items: center; gap: 12px; margin-bottom: 12px; flex-wrap: wrap; }
        .mk-preview-bar strong { font-family: Fraunces, Georgia, serif; font-size: 17px; }
        .mk-canvas-wrap { background: #ece9e3; border: 1px solid var(--line); border-radius: 10px; padding: 16px; display: grid; place-items: center; overflow: auto; }
        .mk-canvas-wrap canvas { max-width: 100%; height: auto; display: block; box-shadow: 0 2px 18px rgba(0,0,0,0.18); }
        .mk-press { background: #fdfdfc; border: 1px solid var(--line); border-radius: 10px; padding: 36px 40px; color: #141414; max-width: 720px; margin: 0 auto; }
        .mk-press-eyebrow { font-size: 12px; letter-spacing: 0.2em; text-transform: uppercase; color: #ffffff; margin: 0 0 10px; }
        .mk-press h2 { font-family: Fraunces, Georgia, serif; font-size: 32px; margin: 0 0 8px; }
        .mk-press h3 { font-family: Fraunces, Georgia, serif; font-size: 18px; margin: 28px 0 10px; }
        .mk-press-meta { color: #6f6a61; font-size: 14px; margin: 0 0 20px; }
        .mk-press-text { font-size: 15px; line-height: 1.7; white-space: pre-wrap; margin: 0; }
        .mk-press ul { margin: 0; padding-left: 18px; font-size: 14px; line-height: 1.9; }
        .mk-press p { font-size: 14px; line-height: 1.6; }
        @media print {
          body * { visibility: hidden !important; }
          .print-area, .print-area * { visibility: visible !important; }
          .print-area { position: absolute !important; inset: 0 auto auto 0 !important; width: 100% !important; max-width: none !important; border: none !important; border-radius: 0 !important; box-shadow: none !important; padding: 0 !important; margin: 0 !important; }
          .print-area canvas { max-width: 100% !important; box-shadow: none !important; }
        }
      `}</style>
    </div>
  );
}
