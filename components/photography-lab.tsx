"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Photography Lab: a non-destructive artwork photo editor. The original
// image is never overwritten — every edit is a setting, stored in state (and
// optionally saved via /api/saved-work), and applied to a canvas at export
// time. All rendering is plain Canvas 2D, no libraries.

type CropRect = { x: number; y: number; w: number; h: number }; // normalized 0..1

type EditSettings = {
  exposure: number; // -2..2 stops
  brightness: number; // -100..100
  contrast: number; // -100..100
  saturation: number; // -100..100
  highlights: number; // -100..100
  shadows: number; // -100..100
  temperature: number; // -100..100 (cool .. warm)
  tint: number; // -100..100 (green .. magenta)
  sharpen: number; // 0..100
  rotate: number; // -45..45 degrees (straighten)
  skewX: number; // -30..30 degrees (perspective, horizontal)
  skewY: number; // -30..30 degrees (perspective, vertical)
  cleanBg: number; // 0..100 strength
  cleanThreshold: number; // 200..255 luminance
  crop: CropRect | null; // null = whole image
};

const DEFAULT_SETTINGS: EditSettings = {
  exposure: 0,
  brightness: 0,
  contrast: 0,
  saturation: 0,
  highlights: 0,
  shadows: 0,
  temperature: 0,
  tint: 0,
  sharpen: 0,
  rotate: 0,
  skewX: 0,
  skewY: 0,
  cleanBg: 0,
  cleanThreshold: 240,
  crop: null,
};

const ASPECTS: { label: string; ratio: number | null }[] = [
  { label: "Free", ratio: null },
  { label: "4:5", ratio: 4 / 5 },
  { label: "1:1", ratio: 1 },
  { label: "3:2", ratio: 3 / 2 },
  { label: "16:9", ratio: 16 / 9 },
];

const PREVIEW_MAX = 1100; // long edge of the preview canvas, px
const EXPORT_MAX = 4096; // long edge cap at export, px

type Source =
  | { kind: "artwork"; artworkId: string; title: string; url: string }
  | { kind: "upload"; title: string; url: string };

type SavedEdit = {
  id: string;
  title: string;
  data: Record<string, unknown>;
  artworkId: string | null;
  updatedAt: string;
};

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}

function isDefault(s: EditSettings) {
  return (
    s.exposure === 0 &&
    s.brightness === 0 &&
    s.contrast === 0 &&
    s.saturation === 0 &&
    s.highlights === 0 &&
    s.shadows === 0 &&
    s.temperature === 0 &&
    s.tint === 0 &&
    s.sharpen === 0 &&
    s.rotate === 0 &&
    s.skewX === 0 &&
    s.skewY === 0 &&
    s.cleanBg === 0 &&
    s.crop === null
  );
}

// Scale that keeps a rotated / skewed image covering the whole canvas, so no
// paper-coloured corners show. Conservative: treats skew as extra rotation.
function coverScale(rotDeg: number, skewXDeg: number, skewYDeg: number, w: number, h: number) {
  const a = ((Math.abs(rotDeg) + Math.abs(skewXDeg) + Math.abs(skewYDeg)) * Math.PI) / 180;
  if (a <= 0.001) return 1;
  const cos = Math.cos(a);
  const sin = Math.sin(a);
  return Math.max(w / (w * cos + h * sin), h / (w * sin + h * cos));
}

function settingsChanged(s: EditSettings) {
  return (
    s.exposure !== 0 ||
    s.brightness !== 0 ||
    s.contrast !== 0 ||
    s.saturation !== 0 ||
    s.highlights !== 0 ||
    s.shadows !== 0 ||
    s.temperature !== 0 ||
    s.tint !== 0 ||
    s.sharpen !== 0 ||
    s.cleanBg !== 0
  );
}

// Pixel-level adjustments, applied in place on an ImageData.
function applyPixelAdjustments(data: Uint8ClampedArray, s: EditSettings) {
  const exposureFactor = Math.pow(2, s.exposure);
  const brightAdd = s.brightness * 0.64; // -100..100 -> -64..64
  const c = s.contrast * 2.55; // -255..255
  const contrastFactor = (259 * (c + 255)) / (255 * (259 - c));
  const sat = s.saturation / 100;
  const tempR = s.temperature * 0.6;
  const tempB = -s.temperature * 0.6;
  const tintR = s.tint * 0.35;
  const tintG = -s.tint * 0.3;
  const tintB = s.tint * 0.35;
  const hi = s.highlights / 100;
  const sh = s.shadows / 100;
  const clean = s.cleanBg / 100;
  const threshold = s.cleanThreshold;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Exposure + brightness + contrast
    r = (r * exposureFactor + brightAdd - 128) * contrastFactor + 128;
    g = (g * exposureFactor + brightAdd - 128) * contrastFactor + 128;
    b = (b * exposureFactor + brightAdd - 128) * contrastFactor + 128;

    // White balance: temperature shifts red/blue, tint shifts green/magenta
    r += tempR + tintR;
    g += tintG;
    b += tempB + tintB;

    // Saturation: lerp toward luminance
    const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    r = lum + (r - lum) * (1 + sat);
    g = lum + (g - lum) * (1 + sat);
    b = lum + (b - lum) * (1 + sat);

    // Highlights / shadows: gentle tone shaping around mid-grey
    const t = clamp(lum / 255, 0, 1);
    const tone = t > 0.5 ? 1 + hi * (t - 0.5) : 1 + sh * (0.5 - t);
    r *= tone;
    g *= tone;
    b *= tone;

    // Clean background: near-white pixels drift to pure white. Only pixels
    // brighter than the threshold are touched, and only in proportion to
    // how far above it they sit.
    if (clean > 0) {
      const l = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      if (l > threshold) {
        const w = clean * clamp((l - threshold) / (255 - threshold), 0, 1);
        r += (255 - r) * w;
        g += (255 - g) * w;
        b += (255 - b) * w;
      }
    }

    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  }
}

// Modest 3x3 sharpening convolution. `amount` 0..1.
function applySharpen(imageData: ImageData, amount: number) {
  const { width: w, height: h, data } = imageData;
  const src = new Uint8ClampedArray(data);
  const a = amount * 0.5;
  const center = 1 + 4 * a;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const v =
          center * src[i + ch] -
          a *
            (src[i - 4 + ch] +
              src[i + 4 + ch] +
              src[i - w * 4 + ch] +
              src[i + w * 4 + ch]);
        data[i + ch] = v;
      }
    }
  }
}

// Draw the (possibly cropped, rotated, skewed, adjusted) image onto a canvas
// of `outW` x `outH`. `applyCrop` false renders the whole source — used for
// the crop editor and the before/after original.
function renderImage(
  canvas: HTMLCanvasElement,
  img: HTMLImageElement,
  s: EditSettings,
  outW: number,
  outH: number,
  applyCrop: boolean,
  original: boolean,
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  canvas.width = Math.max(1, Math.round(outW));
  canvas.height = Math.max(1, Math.round(outH));

  // Fill with the gallery paper colour so rotated corners read as paper.
  ctx.fillStyle = "#fdfdfc";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const crop = applyCrop && s.crop ? s.crop : { x: 0, y: 0, w: 1, h: 1 };
  const sx = crop.x * img.naturalWidth;
  const sy = crop.y * img.naturalHeight;
  const sw = crop.w * img.naturalWidth;
  const sh = crop.h * img.naturalHeight;

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  if (!original) {
    const rot = (s.rotate * Math.PI) / 180;
    ctx.rotate(rot);
    ctx.transform(1, Math.tan((s.skewY * Math.PI) / 180), Math.tan((s.skewX * Math.PI) / 180), 1, 0, 0);
    const cover = coverScale(s.rotate, s.skewX, s.skewY, canvas.width, canvas.height);
    ctx.scale(cover, cover);
  }
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, sx, sy, sw, sh, -canvas.width / 2, -canvas.height / 2, canvas.width, canvas.height);
  ctx.restore();

  if (!original && (settingsChanged(s) || s.sharpen > 0)) {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (settingsChanged(s)) applyPixelAdjustments(imageData.data, s);
    if (s.sharpen > 0) applySharpen(imageData, s.sharpen / 100);
    ctx.putImageData(imageData, 0, 0);
  }
}

function parseSavedSettings(data: Record<string, unknown>): EditSettings | null {
  const raw = data.settings;
  if (!raw || typeof raw !== "object") return null;
  const merged = { ...DEFAULT_SETTINGS, ...(raw as Partial<EditSettings>) };
  // Guard the crop shape — a bad saved value must never break the editor.
  if (merged.crop) {
    const c = merged.crop as CropRect;
    if (
      typeof c.x !== "number" ||
      typeof c.y !== "number" ||
      typeof c.w !== "number" ||
      typeof c.h !== "number" ||
      c.w <= 0 ||
      c.h <= 0
    ) {
      merged.crop = null;
    }
  }
  return merged;
}

export default function PhotographyLab({
  artworks,
}: {
  artworks: { id: string; title: string; medium: string; year: string; imageUrl: string }[];
}) {
  const [source, setSource] = useState<Source | null>(null);
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [imgError, setImgError] = useState<string | null>(null);
  const [loadingImage, setLoadingImage] = useState(false);
  const [settings, setSettings] = useState<EditSettings>(DEFAULT_SETTINGS);
  const [mode, setMode] = useState<"edit" | "crop">("edit");
  const [showOriginal, setShowOriginal] = useState(false);
  const [detecting, setDetecting] = useState(false);
  const [detectNote, setDetectNote] = useState<string | null>(null);
  const [exportFormat, setExportFormat] = useState<"png" | "jpeg" | "webp">("png");
  const [exporting, setExporting] = useState(false);
  const [exportNote, setExportNote] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [saved, setSaved] = useState<SavedEdit[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [saveName, setSaveName] = useState("");
  const [saving, setSaving] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const dragRef = useRef<{ handle: string; startX: number; startY: number; crop: CropRect } | null>(null);

  // ---- source loading -------------------------------------------------
  const loadSource = useCallback((next: Source) => {
    setLoadingImage(true);
    setImgError(null);
    setDetectNote(null);
    setExportNote(null);
    const image = new Image();
    image.onload = () => {
      setImg(image);
      setLoadingImage(false);
      setSource(next);
    };
    image.onerror = () => {
      setImg(null);
      setLoadingImage(false);
      setImgError("That image could not be opened. Try another artwork or upload a file.");
    };
    image.src = next.url;
  }, []);

  const pickArtwork = useCallback(
    (artworkId: string) => {
      const art = artworks.find((a) => a.id === artworkId);
      if (!art) return;
      setSettings(DEFAULT_SETTINGS);
      setMode("edit");
      loadSource({ kind: "artwork", artworkId: art.id, title: art.title, url: art.imageUrl });
    },
    [artworks, loadSource],
  );

  const onUploadFile = useCallback(
    (file: File | undefined) => {
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        setImgError("Please choose an image file (JPG, PNG or WebP).");
        return;
      }
      const reader = new FileReader();
      reader.onload = () => {
        setSettings(DEFAULT_SETTINGS);
        setMode("edit");
        loadSource({ kind: "upload", title: file.name.replace(/\.[^.]+$/, ""), url: String(reader.result) });
      };
      reader.onerror = () => setImgError("That file could not be read.");
      reader.readAsDataURL(file);
    },
    [loadSource],
  );

  // ---- preview rendering ----------------------------------------------
  const previewSize = img
    ? (() => {
        const w = img.naturalWidth;
        const h = img.naturalHeight;
        const crop = mode === "edit" && settings.crop ? settings.crop : null;
        const cw = crop ? crop.w * w : w;
        const ch = crop ? crop.h * h : h;
        const scale = Math.min(1, PREVIEW_MAX / Math.max(cw, ch));
        return { w: Math.max(1, Math.round(cw * scale)), h: Math.max(1, Math.round(ch * scale)) };
      })()
    : { w: 0, h: 0 };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !img) return;
    // In crop mode the preview shows the whole image so the rectangle can
    // be placed; in edit mode it shows the cropped result.
    const applyCrop = mode === "edit";
    renderImage(canvas, img, settings, previewSize.w, previewSize.h, applyCrop, showOriginal);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [img, settings, mode, showOriginal, previewSize.w, previewSize.h]);

  // ---- edge detection ---------------------------------------------------
  const detectEdges = useCallback(() => {
    if (!img) return;
    setDetecting(true);
    setDetectNote(null);
    // Run on the next frame so the "Detecting…" state paints first.
    requestAnimationFrame(() => {
      try {
        const maxSide = 600;
        const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
        const w = Math.max(1, Math.round(img.naturalWidth * scale));
        const h = Math.max(1, Math.round(img.naturalHeight * scale));
        const off = document.createElement("canvas");
        off.width = w;
        off.height = h;
        const ctx = off.getContext("2d");
        if (!ctx) throw new Error("canvas unavailable");
        ctx.drawImage(img, 0, 0, w, h);
        const { data } = ctx.getImageData(0, 0, w, h);
        // Background = near-white and low saturation; everything else counts
        // as artwork. A row/column is "content" when >8% of its pixels are
        // non-background — tolerant of dust and uneven light.
        const isBg = (i: number) => {
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
          const sat = Math.max(r, g, b) - Math.min(r, g, b);
          return lum > 228 && sat < 28;
        };
        const colContent = (x: number) => {
          let hits = 0;
          for (let y = 0; y < h; y++) if (!isBg((y * w + x) * 4)) hits++;
          return hits / h > 0.08;
        };
        const rowContent = (y: number) => {
          let hits = 0;
          for (let x = 0; x < w; x++) if (!isBg((y * w + x) * 4)) hits++;
          return hits / w > 0.08;
        };
        let left = 0;
        while (left < w - 1 && !colContent(left)) left++;
        let right = w - 1;
        while (right > 0 && !colContent(right)) right--;
        let top = 0;
        while (top < h - 1 && !rowContent(top)) top++;
        let bottom = h - 1;
        while (bottom > 0 && !rowContent(bottom)) bottom--;
        const margin = 0.01;
        const rect: CropRect = {
          x: clamp(left / w - margin, 0, 0.9),
          y: clamp(top / h - margin, 0, 0.9),
          w: clamp((right - left) / w + margin * 2, 0.05, 1),
          h: clamp((bottom - top) / h + margin * 2, 0.05, 1),
        };
        rect.w = clamp(rect.w, 0.05, 1 - rect.x);
        rect.h = clamp(rect.h, 0.05, 1 - rect.y);
        const coverage = rect.w * rect.h;
        if (coverage > 0.95 || coverage < 0.05) {
          setDetectNote(
            "No clear edge found — the photo may already fill the frame, or the background is not light enough for detection. Adjust the crop by hand.",
          );
        } else {
          setSettings((s) => ({ ...s, crop: rect }));
          setMode("crop");
          setDetectNote(
            "Edges detected — this is an estimate. Drag the rectangle to adjust it, then switch back to Edit to see the result.",
          );
        }
      } catch {
        setDetectNote("Edge detection failed on this image. Adjust the crop by hand.");
      } finally {
        setDetecting(false);
      }
    });
  }, [img]);

  // ---- crop overlay dragging -------------------------------------------
  const onCropPointerDown = (e: React.PointerEvent<HTMLElement>, handle: string) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      handle,
      startX: e.clientX,
      startY: e.clientY,
      crop: settings.crop ?? { x: 0.05, y: 0.05, w: 0.9, h: 0.9 },
    };
    if (!settings.crop) setSettings((s) => ({ ...s, crop: dragRef.current!.crop }));
  };

  const onCropPointerMove = (e: React.PointerEvent<HTMLElement>) => {
    const drag = dragRef.current;
    const stage = stageRef.current;
    if (!drag || !stage) return;
    const rect = stage.getBoundingClientRect();
    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    const c = { ...drag.crop };
    if (drag.handle === "move") {
      c.x = clamp(c.x + dx, 0, 1 - c.w);
      c.y = clamp(c.y + dy, 0, 1 - c.h);
    } else {
      // Corner handles: anchor the opposite corner, grow/shrink this one.
      if (drag.handle.includes("e")) c.w = clamp(c.w + dx, 0.05, 1 - c.x);
      if (drag.handle.includes("s")) c.h = clamp(c.h + dy, 0.05, 1 - c.y);
      if (drag.handle.includes("w")) {
        const nx = clamp(c.x + dx, 0, c.x + c.w - 0.05);
        c.w = c.w + (c.x - nx);
        c.x = nx;
      }
      if (drag.handle.includes("n")) {
        const ny = clamp(c.y + dy, 0, c.y + c.h - 0.05);
        c.h = c.h + (c.y - ny);
        c.y = ny;
      }
    }
    setSettings((s) => ({ ...s, crop: c }));
  };

  const endCropDrag = () => {
    dragRef.current = null;
  };

  const applyAspect = (ratio: number | null) => {
    if (!img) return;
    if (ratio === null) {
      setSettings((s) => ({ ...s, crop: null }));
      return;
    }
    const imgRatio = img.naturalWidth / img.naturalHeight;
    let w = 0.9;
    let h = 0.9;
    // Fit the requested ratio inside a 90% box.
    if (ratio >= imgRatio) {
      w = 0.9;
      h = (0.9 * imgRatio) / ratio;
    } else {
      h = 0.9;
      w = (0.9 * ratio) / imgRatio;
    }
    setSettings((s) => ({ ...s, crop: { x: (1 - w) / 2, y: (1 - h) / 2, w, h } }));
    setMode("crop");
  };

  // ---- export ------------------------------------------------------------
  const exportSize = img
    ? (() => {
        const crop = settings.crop;
        const cw = crop ? crop.w * img.naturalWidth : img.naturalWidth;
        const ch = crop ? crop.h * img.naturalHeight : img.naturalHeight;
        const scale = Math.min(1, EXPORT_MAX / Math.max(cw, ch));
        return {
          w: Math.max(1, Math.round(cw * scale)),
          h: Math.max(1, Math.round(ch * scale)),
          nativeW: Math.round(cw),
          nativeH: Math.round(ch),
        };
      })()
    : null;

  const exportImage = useCallback(() => {
    if (!img || !source) return;
    setExporting(true);
    setExportNote(null);
    // Let the button state paint before the heavy canvas work.
    setTimeout(() => {
      try {
        const size = exportSize;
        if (!size) throw new Error("no image");
        const out = document.createElement("canvas");
        renderImage(out, img, settings, size.w, size.h, true, false);
        const mime =
          exportFormat === "png" ? "image/png" : exportFormat === "jpeg" ? "image/jpeg" : "image/webp";
        out.toBlob(
          (blob) => {
            setExporting(false);
            if (!blob) {
              setExportNote("Export failed — the browser could not write the file. Try PNG.");
              return;
            }
            const base = (source.title || "artwork").replace(/[^a-zA-Z0-9-_]+/g, "-").replace(/^-+|-+$/g, "") || "artwork";
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = `${base}-edited-${size.w}x${size.h}.${exportFormat === "jpeg" ? "jpg" : exportFormat}`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            setTimeout(() => URL.revokeObjectURL(url), 5000);
            setExportNote(
              `Exported ${size.w} × ${size.h} px ${exportFormat.toUpperCase()} — the true resolution of this file, never upscaled. Your original is untouched.`,
            );
          },
          mime,
          0.92,
        );
      } catch {
        setExporting(false);
        setExportNote("Export failed. Try again, or reload the page and re-open the image.");
      }
    }, 30);
  }, [img, source, settings, exportFormat, exportSize]);

  // ---- saved edits ---------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    fetch("/api/saved-work?kind=photo-edit")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("load failed"))))
      .then((json) => {
        if (!cancelled) setSaved((json.saved ?? []) as SavedEdit[]);
      })
      .catch(() => {
        if (!cancelled) setNotice("Saved edits could not be loaded — saving may still work.");
      })
      .finally(() => {
        if (!cancelled) setSavedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const saveEdit = useCallback(async () => {
    if (!img || !source) return;
    const title = saveName.trim() || `${source.title} — edit`;
    setSaving(true);
    setNotice(null);
    try {
      const res = await fetch("/api/saved-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "photo-edit",
          title,
          data: { settings, sourceTitle: source.title },
          artworkId: source.kind === "artwork" ? source.artworkId : undefined,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) throw new Error(json?.error || "save failed");
      setSaved((list) => [json.saved as SavedEdit, ...list]);
      setSaveName("");
      setNotice(`Saved as “${title}”.`);
    } catch {
      setNotice("Could not save this edit. Check you are still signed in and try again.");
    } finally {
      setSaving(false);
    }
  }, [img, source, saveName, settings]);

  const applySaved = useCallback(
    (entry: SavedEdit) => {
      const parsed = parseSavedSettings(entry.data);
      if (!parsed) {
        setNotice("That saved edit could not be read.");
        return;
      }
      setSettings(parsed);
      setMode("edit");
      if (entry.artworkId) {
        const art = artworks.find((a) => a.id === entry.artworkId);
        if (art) {
          loadSource({ kind: "artwork", artworkId: art.id, title: art.title, url: art.imageUrl });
          setNotice(`Applied “${entry.title}” to ${art.title}.`);
          return;
        }
      }
      setNotice(`Applied “${entry.title}”. Open the matching photo to see it on the image.`);
    },
    [artworks, loadSource],
  );

  const renameSaved = useCallback(async (id: string, title: string) => {
    const clean = title.trim();
    if (!clean) return;
    try {
      const res = await fetch("/api/saved-work", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title: clean }),
      });
      if (!res.ok) throw new Error("rename failed");
      setSaved((list) => list.map((e) => (e.id === id ? { ...e, title: clean } : e)));
      setRenamingId(null);
    } catch {
      setNotice("Could not rename that edit.");
    }
  }, []);

  const deleteSaved = useCallback(async (id: string, title: string) => {
    if (!window.confirm(`Delete the saved edit “${title}”? This cannot be undone.`)) return;
    try {
      const res = await fetch(`/api/saved-work?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setSaved((list) => list.filter((e) => e.id !== id));
    } catch {
      setNotice("Could not delete that edit.");
    }
  }, []);

  const set = <K extends keyof EditSettings>(key: K, value: EditSettings[K]) =>
    setSettings((s) => ({ ...s, [key]: value }));

  const crop = settings.crop ?? { x: 0.05, y: 0.05, w: 0.9, h: 0.9 };

  return (
    <div className="plab">
      <style>{`
        .plab { display: grid; gap: 24px; }
        .plab-grid { display: grid; grid-template-columns: minmax(0, 1.35fr) minmax(280px, 1fr); gap: 28px; align-items: start; }
        @media (max-width: 860px) { .plab-grid { grid-template-columns: 1fr; } }
        .plab-stage { position: relative; border: 1px solid var(--line); border-radius: 8px; background: var(--room-color); min-height: 320px; display: grid; place-items: center; overflow: hidden; padding: 16px; }
        .plab-stage canvas { max-width: 100%; height: auto; display: block; background: #fdfdfc; box-shadow: 0 1px 6px rgba(0,0,0,.08); }
        .plab-stage-inner { position: relative; line-height: 0; }
        .plab-empty { padding: 48px 24px; text-align: center; color: var(--muted); line-height: 1.6; max-width: 460px; }
        .plab-empty strong { display: block; color: var(--ink); font-size: 16px; margin-bottom: 8px; }
        .plab-cropbox { position: absolute; border: 2px solid #a67c37; background: rgba(166,124,55,.06); box-shadow: 0 0 0 9999px rgba(20,20,18,.35); cursor: move; touch-action: none; }
        .plab-handle { position: absolute; width: 18px; height: 18px; background: #fdfdfc; border: 2px solid #a67c37; border-radius: 50%; touch-action: none; }
        .plab-handle-nw { left: -9px; top: -9px; cursor: nwse-resize; }
        .plab-handle-ne { right: -9px; top: -9px; cursor: nesw-resize; }
        .plab-handle-sw { left: -9px; bottom: -9px; cursor: nesw-resize; }
        .plab-handle-se { right: -9px; bottom: -9px; cursor: nwse-resize; }
        .plab-bar { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-top: 12px; }
        .plab-bar .plab-meta { margin-left: auto; color: var(--muted); font-size: 12px; }
        .plab-seg { display: inline-flex; border: 1px solid var(--line); border-radius: 6px; overflow: hidden; }
        .plab-seg button { border: 0; background: transparent; padding: 8px 12px; font-size: 12px; font-weight: 600; color: var(--muted); cursor: pointer; }
        .plab-seg button[aria-pressed="true"] { background: var(--ink); color: var(--paper); }
        .plab-btn { display: inline-flex; align-items: center; gap: 6px; border: 1px solid var(--line); border-radius: 5px; background: var(--paper); color: var(--ink); padding: 9px 13px; font-size: 12px; font-weight: 600; cursor: pointer; }
        .plab-btn:hover:not(:disabled) { border-color: var(--ink); }
        .plab-btn:disabled { opacity: .5; cursor: default; }
        .plab-btn-gold { border-color: #a67c37; color: #a67c37; }
        .plab-btn-dark { background: #343d35; border-color: #343d35; color: #fffdfa; }
        .plab-btn-dark:hover:not(:disabled) { background: #49564a; border-color: #49564a; }
        .plab-controls { display: grid; gap: 22px; }
        .plab-section { border: 1px solid var(--line); border-radius: 8px; padding: 18px; background: var(--paper); }
        .plab-section h3 { margin: 0 0 4px; font-size: 14px; }
        .plab-section > p { margin: 0 0 14px; color: var(--muted); font-size: 12px; line-height: 1.6; }
        .plab-slider { display: grid; grid-template-columns: 118px 1fr 44px; gap: 10px; align-items: center; padding: 6px 0; font-size: 12px; }
        .plab-slider label { color: var(--muted); font-weight: 600; }
        .plab-slider output { text-align: right; font-variant-numeric: tabular-nums; }
        .plab-slider input[type="range"] { width: 100%; accent-color: #a67c37; }
        .plab-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
        .plab-select, .plab-input { height: 38px; padding: 0 10px; border: 1px solid var(--line); border-radius: 5px; background: var(--paper); color: var(--ink); font-size: 13px; outline: none; min-width: 0; }
        .plab-select:focus, .plab-input:focus { border-color: var(--ink); }
        .plab-input { flex: 1; }
        .plab-note { margin: 10px 0 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
        .plab-note strong { color: var(--ink); }
        .plab-compare { user-select: none; -webkit-user-select: none; }
        .plab-saved { display: grid; gap: 8px; }
        .plab-saved-item { display: flex; gap: 8px; align-items: center; border: 1px solid var(--line); border-radius: 6px; padding: 8px 10px; font-size: 12px; }
        .plab-saved-item strong { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .plab-saved-item small { color: var(--muted); }
        .plab-link { border: 0; background: transparent; color: var(--muted); font-size: 12px; cursor: pointer; padding: 4px 2px; text-decoration: underline; text-underline-offset: 2px; }
        .plab-link:hover { color: var(--ink); }
        .plab-source { display: grid; gap: 10px; }
        .plab-source .plab-row { gap: 10px; }
        .plab-source select { flex: 1; }
      `}</style>

      {/* ---- Source picker ---- */}
      <div className="plab-section plab-source">
        <h3>1 · Choose a photo</h3>
        <p>
          Pick one of your artworks, or upload a photo from this device. The original file is never changed —
          edits live as settings until you export.
        </p>
        <div className="plab-row">
          <select
            className="plab-select"
            aria-label="Artwork with a photo"
            value={source?.kind === "artwork" ? source.artworkId : ""}
            onChange={(e) => {
              if (e.target.value) pickArtwork(e.target.value);
            }}
          >
            <option value="">{artworks.length ? "Your artworks with photos…" : "No artworks with photos yet"}</option>
            {artworks.map((a) => (
              <option key={a.id} value={a.id}>
                {a.title}
                {a.year ? ` (${a.year})` : ""}
                {a.medium ? ` — ${a.medium}` : ""}
              </option>
            ))}
          </select>
          <button type="button" className="plab-btn" onClick={() => fileRef.current?.click()}>
            Upload a photo
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              onUploadFile(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
        {source && (
          <p className="plab-note">
            <strong>Editing:</strong> {source.title}
            {img ? ` · ${img.naturalWidth} × ${img.naturalHeight} px` : ""}
            {source.kind === "artwork" ? " · from your inventory" : " · uploaded from this device"}
          </p>
        )}
      </div>

      <div className="plab-grid">
        {/* ---- Preview ---- */}
        <div>
          <div className="plab-stage" ref={stageRef}>
            {!img && !loadingImage && (
              <div className="plab-empty">
                <strong>No photo open yet.</strong>
                Choose one of your artworks above, or upload a photo of a work on paper. For the best result,
                photograph the work straight on, in even daylight, with the whole sheet — including its white
                border — in the frame. The lab will help you straighten it, crop to the edge, and clean the
                background.
              </div>
            )}
            {loadingImage && <div className="plab-empty">Opening your photo…</div>}
            {imgError && !img && (
              <div className="plab-empty">
                <strong>Could not open that photo.</strong>
                {imgError}
              </div>
            )}
            {img && (
              <div className="plab-stage-inner">
                <canvas ref={canvasRef} aria-label="Photo preview" />
                {mode === "crop" && (
                  <div
                    className="plab-cropbox"
                    style={{
                      left: `${crop.x * 100}%`,
                      top: `${crop.y * 100}%`,
                      width: `${crop.w * 100}%`,
                      height: `${crop.h * 100}%`,
                    }}
                    onPointerDown={(e) => onCropPointerDown(e, "move")}
                    onPointerMove={onCropPointerMove}
                    onPointerUp={endCropDrag}
                    onPointerCancel={endCropDrag}
                    role="group"
                    aria-label="Crop rectangle — drag to move, drag a corner to resize"
                  >
                    {(["nw", "ne", "sw", "se"] as const).map((h) => (
                      <span
                        key={h}
                        className={`plab-handle plab-handle-${h}`}
                        onPointerDown={(e) => {
                          e.stopPropagation();
                          onCropPointerDown(e, h);
                        }}
                        onPointerMove={onCropPointerMove}
                        onPointerUp={endCropDrag}
                        onPointerCancel={endCropDrag}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {img && (
            <div className="plab-bar">
              <div className="plab-seg" role="group" aria-label="Preview mode">
                <button type="button" aria-pressed={mode === "edit"} onClick={() => setMode("edit")}>
                  Edit view
                </button>
                <button type="button" aria-pressed={mode === "crop"} onClick={() => setMode("crop")}>
                  Crop view
                </button>
              </div>
              <button
                type="button"
                className="plab-btn plab-compare"
                onPointerDown={() => setShowOriginal(true)}
                onPointerUp={() => setShowOriginal(false)}
                onPointerLeave={() => setShowOriginal(false)}
                onPointerCancel={() => setShowOriginal(false)}
                onContextMenu={(e) => e.preventDefault()}
              >
                Hold to see original
              </button>
              <span className="plab-meta">
                {showOriginal
                  ? "Showing the original photo"
                  : mode === "crop"
                    ? "Drag the gold rectangle to set the crop"
                    : exportSize
                      ? `Export will be ${exportSize.w} × ${exportSize.h} px`
                      : ""}
              </span>
            </div>
          )}
          {imgError && img && <p className="plab-note">{imgError}</p>}
        </div>

        {/* ---- Controls ---- */}
        <div className="plab-controls">
          <fieldset className="plab-section" disabled={!img} style={{ border: "1px solid var(--line)" }}>
            <h3>2 · Crop &amp; straighten</h3>
            <p>
              Fix the framing first. Edge detection scans in from the borders for the first non-white row and
              column — it is an estimate, so check the rectangle before you export.
            </p>
            <div className="plab-row" style={{ marginBottom: 12 }}>
              {ASPECTS.map((a) => (
                <button
                  key={a.label}
                  type="button"
                  className="plab-btn"
                  onClick={() => applyAspect(a.ratio)}
                  aria-pressed={
                    a.ratio === null
                      ? settings.crop === null
                      : !!settings.crop &&
                        Math.abs(settings.crop.w / settings.crop.h - a.ratio) < 0.02
                  }
                >
                  {a.label}
                </button>
              ))}
            </div>
            <div className="plab-row">
              <button type="button" className="plab-btn plab-btn-gold" onClick={detectEdges} disabled={detecting}>
                {detecting ? "Detecting…" : "Detect artwork edges"}
              </button>
              <button
                type="button"
                className="plab-btn"
                onClick={() => {
                  setSettings((s) => ({ ...s, crop: null }));
                  setMode("edit");
                }}
              >
                Clear crop
              </button>
            </div>
            {detectNote && <p className="plab-note">{detectNote}</p>}
            <Slider label="Rotate" value={settings.rotate} min={-45} max={45} step={0.1} unit="°" onChange={(v) => set("rotate", v)} />
            <Slider label="Skew — horizontal" value={settings.skewX} min={-30} max={30} step={0.1} unit="°" onChange={(v) => set("skewX", v)} />
            <Slider label="Skew — vertical" value={settings.skewY} min={-30} max={30} step={0.1} unit="°" onChange={(v) => set("skewY", v)} />
          </fieldset>

          <fieldset className="plab-section" disabled={!img} style={{ border: "1px solid var(--line)" }}>
            <h3>3 · Light &amp; colour</h3>
            <p>Applied live to the preview. Nothing is written to your original photo.</p>
            <Slider label="Exposure" value={settings.exposure} min={-2} max={2} step={0.05} unit="" onChange={(v) => set("exposure", v)} />
            <Slider label="Brightness" value={settings.brightness} min={-100} max={100} step={1} unit="" onChange={(v) => set("brightness", v)} />
            <Slider label="Contrast" value={settings.contrast} min={-100} max={100} step={1} unit="" onChange={(v) => set("contrast", v)} />
            <Slider label="Highlights" value={settings.highlights} min={-100} max={100} step={1} unit="" onChange={(v) => set("highlights", v)} />
            <Slider label="Shadows" value={settings.shadows} min={-100} max={100} step={1} unit="" onChange={(v) => set("shadows", v)} />
            <Slider label="Saturation" value={settings.saturation} min={-100} max={100} step={1} unit="" onChange={(v) => set("saturation", v)} />
            <Slider label="Temperature" value={settings.temperature} min={-100} max={100} step={1} unit="" onChange={(v) => set("temperature", v)} />
            <Slider label="Tint" value={settings.tint} min={-100} max={100} step={1} unit="" onChange={(v) => set("tint", v)} />
            <Slider label="Sharpen" value={settings.sharpen} min={0} max={100} step={1} unit="" onChange={(v) => set("sharpen", v)} />
          </fieldset>

          <fieldset className="plab-section" disabled={!img} style={{ border: "1px solid var(--line)" }}>
            <h3>4 · Clean background</h3>
            <p>
              For photos of works on white paper. Pixels brighter than the threshold drift toward pure white —
              it only ever touches near-white areas, never the artwork itself. Keep the strength low if the paper
              has warm tones you want to keep.
            </p>
            <Slider label="Strength" value={settings.cleanBg} min={0} max={100} step={1} unit="%" onChange={(v) => set("cleanBg", v)} />
            <Slider label="Threshold" value={settings.cleanThreshold} min={200} max={255} step={1} unit="" onChange={(v) => set("cleanThreshold", v)} />
          </fieldset>

          <div className="plab-section">
            <h3>5 · Reset, save &amp; export</h3>
            <p>
              Export renders your settings at the original resolution (capped at 4096 px on the long edge, never
              upscaled). The file downloads to this device; your original stays exactly as it was.
            </p>
            <div className="plab-row" style={{ marginBottom: 12 }}>
              <button type="button" className="plab-btn" disabled={!img || isDefault(settings)} onClick={() => setSettings(DEFAULT_SETTINGS)}>
                Reset all edits
              </button>
              <select
                className="plab-select"
                aria-label="Export format"
                value={exportFormat}
                onChange={(e) => setExportFormat(e.target.value as "png" | "jpeg" | "webp")}
              >
                <option value="png">PNG</option>
                <option value="jpeg">JPEG</option>
                <option value="webp">WebP</option>
              </select>
              <button type="button" className="plab-btn plab-btn-dark" disabled={!img || exporting} onClick={exportImage}>
                {exporting ? "Exporting…" : "Export edited photo"}
              </button>
            </div>
            {exportSize && img && (
              <p className="plab-note">
                Export size: <strong>{exportSize.w} × {exportSize.h} px</strong>
                {exportSize.nativeW !== exportSize.w || exportSize.nativeH !== exportSize.h
                  ? ` (scaled down from ${exportSize.nativeW} × ${exportSize.nativeH} px to fit the 4096 px cap)`
                  : " (full original resolution)"}
                .
              </p>
            )}
            {exportNote && <p className="plab-note">{exportNote}</p>}

            <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
              <div className="plab-row">
                <input
                  className="plab-input"
                  type="text"
                  placeholder="Name this edit — e.g. “Nose Ring, catalogue crop”"
                  value={saveName}
                  onChange={(e) => setSaveName(e.target.value)}
                  disabled={!img}
                  maxLength={200}
                />
                <button type="button" className="plab-btn" disabled={!img || saving} onClick={saveEdit}>
                  {saving ? "Saving…" : "Save edit"}
                </button>
              </div>
              {notice && <p className="plab-note">{notice}</p>}
              <div className="plab-saved" style={{ marginTop: 14 }}>
                {savedLoading && <p className="plab-note">Loading your saved edits…</p>}
                {!savedLoading && saved.length === 0 && (
                  <p className="plab-note">No saved edits yet. Saved edits keep your settings for an artwork, so you can re-apply them later.</p>
                )}
                {saved.map((entry) => (
                  <div key={entry.id} className="plab-saved-item">
                    {renamingId === entry.id ? (
                      <input
                        className="plab-input"
                        value={renameValue}
                        autoFocus
                        maxLength={200}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") void renameSaved(entry.id, renameValue);
                          if (e.key === "Escape") setRenamingId(null);
                        }}
                      />
                    ) : (
                      <strong>{entry.title}</strong>
                    )}
                    <small>{new Date(entry.updatedAt).toLocaleDateString()}</small>
                    {renamingId === entry.id ? (
                      <>
                        <button type="button" className="plab-link" onClick={() => void renameSaved(entry.id, renameValue)}>
                          Save
                        </button>
                        <button type="button" className="plab-link" onClick={() => setRenamingId(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <>
                        <button type="button" className="plab-link" onClick={() => applySaved(entry)}>
                          Apply
                        </button>
                        <button
                          type="button"
                          className="plab-link"
                          onClick={() => {
                            setRenamingId(entry.id);
                            setRenameValue(entry.title);
                          }}
                        >
                          Rename
                        </button>
                        <button type="button" className="plab-link" onClick={() => void deleteSaved(entry.id, entry.title)}>
                          Delete
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <p className="plab-note" style={{ marginTop: 10 }}>
                To change a saved edit, apply it, adjust the settings, and save it again under the same name —
                then delete the older copy.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function Slider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  const shown = Number.isInteger(step) ? String(Math.round(value)) : value.toFixed(1);
  return (
    <div className="plab-slider">
      <label>{label}</label>
      <input
        type="range"
        aria-label={label}
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
      />
      <output>
        {shown}
        {unit}
      </output>
    </div>
  );
}
