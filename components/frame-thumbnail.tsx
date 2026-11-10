"use client";

import { useEffect, useRef, useState } from "react";
import { FRAME_VARIANTS, specFromFrameConfig } from "@/lib/demo-data";
import type { FrameConfig, FrameVariant } from "@/lib/demo-data";
import {
  drawInnerShadow,
  loadImage,
  paintBeads,
  paintMatSide,
  paintOrnaments,
  paintPhotoBar,
  paintProceduralBar,
  paintProfile,
  paintRingSides,
  paintTrimSide,
} from "@/components/mockup-studio";

// A faithful preview of a frame style, drawn on canvas with the same
// render engine as Mockup Studio (and the same rules as the 3D gallery):
// the real moulding photo strip, tiled without stretching along mitred
// 45-degree bars when the frame carries one (`spec.photo`), otherwise
// the procedural finish for its texture, plus profile relief, beads and
// ornaments — never the old flat SVG motifs (wood / brushed / carved
// gradients), which did not look like the real gallery frames.
//
// The frame never covers the artwork (C6): the canvas is sized to the
// artwork's own aspect ratio, a neutral backing rectangle is painted
// behind the image inside the opening, and the image is drawn
// contain-fit inside the opening — letterboxed on neutral backing when
// its ratio differs, never cropped, never overlapped by frame bars.
// Accepts either a built-in variant or a custom Frame Studio
// configuration, and optionally the artwork's own image instead of the
// neutral placeholder.

const imgCache = new Map<string, HTMLImageElement>();

/** Load an image for display. Falls back to a plain (CORS-less) load when
    the CORS load fails: the image still draws, the canvas is just not
    exportable, which thumbnails never need. */
function loadThumbImage(url: string): Promise<HTMLImageElement> {
  const cached = imgCache.get(url);
  if (cached) return Promise.resolve(cached);
  return loadImage(url)
    .catch(
      () =>
        new Promise<HTMLImageElement>((resolve, reject) => {
          const img = new Image();
          img.onload = () => resolve(img);
          img.onerror = () => reject(new Error(`Could not load image: ${url}`));
          img.src = url;
        }),
    )
    .then((img) => {
      imgCache.set(url, img);
      return img;
    });
}

export default function FrameThumbnail({
  variant,
  config,
  imageUrl,
  artworkColor,
  width = 48,
  height = 36,
}: {
  variant: FrameVariant;
  config?: FrameConfig | null;
  imageUrl?: string | null;
  artworkColor?: string;
  width?: number;
  height?: number;
}) {
  const spec = config ? specFromFrameConfig(config) : FRAME_VARIANTS[variant] ?? FRAME_VARIANTS.wood;
  const specKey = config ? `custom:${JSON.stringify(config)}` : variant;
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [artImg, setArtImg] = useState<HTMLImageElement | null>(null);
  const [artFailed, setArtFailed] = useState(false);
  const [photoImg, setPhotoImg] = useState<HTMLImageElement | null>(null);

  // The artwork's own aspect ratio: the canvas is sized to it, so a
  // portrait work gets a portrait opening instead of being squeezed into
  // a landscape box with frame texture showing at the sides.
  const ratio = artImg ? artImg.naturalWidth / Math.max(1, artImg.naturalHeight) : width / Math.max(1, height);
  let cssW = width;
  let cssH = cssW / Math.max(0.2, Math.min(5, ratio));
  const MAX_H = 400;
  if (cssH > MAX_H) {
    cssH = MAX_H;
    cssW = cssH * ratio;
  }

  useEffect(() => {
    let cancelled = false;
    setArtImg(null);
    setArtFailed(false);
    if (!imageUrl) return;
    loadThumbImage(imageUrl)
      .then((img) => {
        if (!cancelled) setArtImg(img);
      })
      .catch(() => {
        if (!cancelled) setArtFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [imageUrl]);

  useEffect(() => {
    let cancelled = false;
    setPhotoImg(null);
    if (!spec.photo) return;
    loadThumbImage(spec.photo)
      .then((img) => {
        if (!cancelled) setPhotoImg(img);
      })
      .catch(() => {
        if (!cancelled) setPhotoImg(null);
      });
    return () => {
      cancelled = true;
    };
  }, [spec.photo]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const dpr = Math.min(2, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);

    const W = cssW;
    const H = cssH;
    // Neutral backing behind the image: warm paper white, or the tray
    // colour for shadow boxes. The frame texture never shows here.
    const backing = spec.trayColor ?? "#f5f1e8";

    if (variant === "none" && !config) {
      ctx.fillStyle = backing;
      ctx.fillRect(0, 0, W, H);
      drawArtwork(ctx, artImg, artFailed, artworkColor, 0, 0, W, H);
      ctx.strokeStyle = "#999";
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(0.5, 0.5, W - 1, H - 1);
      ctx.setLineDash([]);
      return;
    }

    // Frame band, mat and float gap, scaled to the thumbnail size.
    let fw = spec.width <= 0 ? 0 : Math.max(2, Math.min(W * 0.22, W * spec.width * 1.05));
    let mw = spec.mat ? Math.max(2, Math.min(W * 0.2, W * spec.mat.width * 0.9)) : 0;
    let fg = spec.floatGap > 0 ? Math.max(2, Math.min(W * 0.18, W * spec.floatGap * 0.9)) : 0;
    // Keep a usable opening on tiny thumbnails: shrink the insets
    // proportionally instead of letting them swallow the artwork.
    const inset = fw + mw + fg;
    if (inset * 2 >= Math.min(W, H) - 6) {
      const scale = (Math.min(W, H) / 2 - 3) / Math.max(1, inset);
      fw *= scale;
      mw *= scale;
      fg *= scale;
    }
    const tw = spec.trim ? Math.max(1, Math.min(4, W * spec.trim.width * 0.9)) : 0;
    const pxPerCm = W / 100;

    // Backing for the whole opening, before any ring is painted.
    ctx.fillStyle = backing;
    ctx.fillRect(fw, fw, W - 2 * fw, H - 2 * fw);

    // Frame border: the real moulding photo when the frame carries one,
    // otherwise the procedural finish. Beads and ornaments are NOT drawn
    // on photo frames — the photo already carries them.
    if (fw > 0) {
      const hasPhoto = !!photoImg && !!spec.photo;
      ctx.save();
      if (spec.texture === "acrylic") ctx.globalAlpha = spec.opacity ?? 0.4;
      paintRingSides(ctx, 0, 0, W, H, fw, (c, len, w, side) => {
        if (hasPhoto && photoImg) paintPhotoBar(c, photoImg, len, w);
        else paintProceduralBar(c, spec, len, w, side);
        paintProfile(c, spec.profile, len, w);
        if (spec.bead && !spec.photo) paintBeads(c, spec, len, w);
        if (spec.ornament && spec.ornament !== "none" && !spec.photo) {
          paintOrnaments(c, spec, len, w, pxPerCm);
        }
      });
      ctx.restore();
    }

    // Passe-partout ring (the tray gap stays tray-coloured, not mat).
    if (mw > 0) {
      paintRingSides(ctx, fw, fw, W - fw, H - fw, mw, (c, len, w, side) => {
        paintMatSide(c, spec.mat?.color ?? "#f2ead8", spec.mat?.texture, len, w, side);
      });
    }
    // Thin gold trim ring between frame and mat.
    if (spec.trim && (spec.trim.at === "mat" || spec.trim.at === "both") && tw > 0) {
      paintRingSides(ctx, fw + mw, fw + mw, W - fw - mw, H - fw - mw, tw, (c, len, w) => {
        paintTrimSide(c, spec.trim?.color ?? "#d4af37", len, w);
      });
    }

    // The artwork itself, strictly inside the opening: contain-fit on the
    // neutral backing, so the frame can never overlap it.
    const ax = fw + mw + fg;
    const ay = fw + mw + fg;
    const aw = W - 2 * (fw + mw + fg);
    const ah = H - 2 * (fw + mw + fg);
    ctx.fillStyle = backing;
    ctx.fillRect(ax, ay, aw, ah);
    drawArtwork(ctx, artImg, artFailed, artworkColor, ax, ay, aw, ah);

    // Thin gold trim ring around the artwork.
    if (spec.trim && (spec.trim.at === "artwork" || spec.trim.at === "both") && tw > 0) {
      paintRingSides(ctx, ax - tw, ay - tw, ax + aw + tw, ay + ah + tw, tw, (c, len, w) => {
        paintTrimSide(c, spec.trim?.color ?? "#d4af37", len, w);
      });
    }
    // The mat opening shades the artwork just inside it.
    if (mw > 0) {
      drawInnerShadow(ctx, ax, ay, aw, ah, Math.max(3, mw * 0.18), 0.16);
    }
    // Glass: a faint diagonal sheen over the artwork only.
    if (spec.glass === "clear") {
      const g = ctx.createLinearGradient(ax, ay, ax + aw, ay + ah);
      g.addColorStop(0, "rgba(255,255,255,0.16)");
      g.addColorStop(0.4, "rgba(255,255,255,0.02)");
      g.addColorStop(1, "rgba(255,255,255,0.06)");
      ctx.fillStyle = g;
      ctx.fillRect(ax, ay, aw, ah);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [specKey, artImg, artFailed, photoImg, cssW, cssH]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      style={{ width: cssW, height: cssH, display: "block", borderRadius: 1 }}
    />
  );
}

/** Draw the artwork image contain-fit inside (x, y, w, h), centred on
    the backing already painted there. Never crops, never overflows. */
function drawArtwork(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  failed: boolean,
  artworkColor: string | undefined,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  if (img && !failed) {
    const scale = Math.min(w / img.naturalWidth, h / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
    return;
  }
  // Placeholder when there is no image: the artwork's own colour with a
  // soft abstract composition, same as the mockup stand-in.
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = artworkColor ?? "#e8ddc9";
  ctx.fillRect(x, y, w, h);
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.beginPath();
  ctx.arc(x + w * 0.32, y + h * 0.36, Math.min(w, h) * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.fillRect(x + w * 0.55, y + h * 0.6, w * 0.3, h * 0.14);
  ctx.restore();
}
