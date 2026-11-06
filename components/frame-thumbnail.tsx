"use client";

import { FRAME_VARIANTS, specFromFrameConfig } from "@/lib/demo-data";
import type { FrameConfig, FrameVariant } from "@/lib/demo-data";

// A small faithful preview of a frame style: the same border width,
// mat, trim and motif the 3D render uses, drawn as SVG so the user can
// see the frame before choosing it. Accepts either a built-in variant
// or a custom Frame Studio configuration, and optionally the artwork's
// own image instead of the neutral placeholder — the compare view uses
// the same drawing at a larger size, so what is compared is what hangs.
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
  const key = config ? `custom-${config.base}-${config.width}-${config.color.replace("#", "")}` : variant;
  const fw = Math.min(10, Math.max(0, 1.5 + spec.width * 45)); // frame band, px
  const mw = spec.mat ? Math.min(9, Math.max(0, 1 + spec.mat.width * 28)) : 0; // mat, px
  const fg = Math.min(5, spec.floatGap * 30); // float gap, px
  const trimW = spec.trim ? Math.max(0.8, spec.trim.width * 40) : 0;
  const x0 = 0.5;
  const y0 = 0.5;
  const ow = 47;
  const oh = 35;
  const opening = { x: x0 + fw, y: y0 + fw, w: ow - 2 * fw, h: oh - 2 * fw };
  const art = {
    x: x0 + fw + mw + fg,
    y: y0 + fw + mw + fg,
    w: ow - 2 * (fw + mw + fg),
    h: oh - 2 * (fw + mw + fg),
  };
  const fillId = `frame-fill-${key}`;
  const beadR = 0.9;
  const beadYs = [y0 + fw - 1.1, y0 + oh - fw + 1.1];
  const beadXs = [x0 + fw - 1.1, x0 + ow - fw + 1.1];
  const beadTop: number[] = [];
  for (let x = opening.x + 2.5; x < opening.x + opening.w - 1; x += 3.4) beadTop.push(x);
  const beadSide: number[] = [];
  for (let y = opening.y + 2.5; y < opening.y + opening.h - 1; y += 3.4) beadSide.push(y);
  const isWood = spec.texture === "wood" || spec.texture === "oak" || spec.texture === "walnut" || spec.texture === "mahogany";
  const isBrushed = spec.texture === "gold-brushed" || spec.texture === "silver-brushed" || spec.texture === "aluminium-brushed";
  const glassOpacity = spec.glass === "clear" ? 0.14 : spec.glass === "non-reflective" ? 0.05 : spec.glass === "museum" ? 0.09 : 0;
  // The inner-edge line that hints at the bar's edge profile.
  const profileStroke =
    spec.profile === "stepped"
      ? "rgba(255,255,255,0.55)"
      : spec.profile === "bevelled"
        ? "rgba(0,0,0,0.4)"
        : spec.profile === "rounded"
          ? "rgba(255,255,255,0.35)"
          : spec.profile === "scooped"
            ? "rgba(0,0,0,0.5)"
            : null;

  return (
    <svg width={width} height={height} viewBox="0 0 48 36" aria-hidden="true">
      <defs>
        <linearGradient id={`${fillId}-gold`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#e8c96a" />
          <stop offset="0.5" stopColor={spec.color} />
          <stop offset="1" stopColor="#8a6d1f" />
        </linearGradient>
        <linearGradient id={`${fillId}-yellow`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffe14d" />
          <stop offset="0.5" stopColor="#f5c400" />
          <stop offset="1" stopColor="#d9a800" />
        </linearGradient>
        <linearGradient id={`${fillId}-black`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#333333" />
          <stop offset="0.5" stopColor="#161616" />
          <stop offset="1" stopColor="#222222" />
        </linearGradient>
        <linearGradient id={`${fillId}-art`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#e8ddc9" />
          <stop offset="0.5" stopColor="#cfc0a0" />
          <stop offset="1" stopColor="#b3a284" />
        </linearGradient>
        <linearGradient id={`${fillId}-glass`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity={glassOpacity} />
          <stop offset="0.45" stopColor="#ffffff" stopOpacity="0" />
          <stop offset="1" stopColor="#ffffff" stopOpacity={glassOpacity * 0.6} />
        </linearGradient>
        <pattern id={`${fillId}-wood`} width="14" height="7" patternUnits="userSpaceOnUse">
          <rect width="14" height="7" fill={spec.color} />
          <path d="M0 2 Q 7 0 14 2" stroke="#000000" strokeWidth="0.8" fill="none" opacity="0.28" />
          <path d="M0 5 Q 7 7 14 5" stroke="#ffffff" strokeWidth="0.8" fill="none" opacity="0.22" />
        </pattern>
        <pattern id={`${fillId}-carved`} width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#a67c37" />
          <circle cx="5" cy="5" r="3.2" fill="none" stroke="#6b4a1f" strokeWidth="1.6" />
          <circle cx="5" cy="5" r="3.2" fill="none" stroke="#d4af37" strokeWidth="0.8" />
          <circle cx="5" cy="5" r="1" fill="#8a6d1f" />
        </pattern>
        <pattern id={`${fillId}-brushed`} width="10" height="4" patternUnits="userSpaceOnUse">
          <rect width="10" height="4" fill={spec.color} />
          <line x1="0" y1="1" x2="10" y2="1" stroke="#ffffff" strokeWidth="0.7" opacity="0.5" />
          <line x1="0" y1="3" x2="10" y2="3" stroke="#000000" strokeWidth="0.7" opacity="0.35" />
        </pattern>
        <pattern id={`${fillId}-matte`} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#1c1c1c" />
          <circle cx="1.5" cy="1.5" r="0.5" fill="#333333" />
          <circle cx="4.5" cy="4.5" r="0.5" fill="#000000" />
        </pattern>
        <clipPath id={`${fillId}-art-clip`}>
          <rect x={art.x} y={art.y} width={art.w} height={art.h} />
        </clipPath>
      </defs>
      {variant === "none" && !config ? (
        <>
          {imageUrl ? (
            <image href={imageUrl} x={4} y={3} width={40} height={30} preserveAspectRatio="xMidYMid slice" />
          ) : (
            <rect x={4} y={3} width={40} height={30} fill={`url(#${fillId}-art)`} />
          )}
          <rect x={4} y={3} width={40} height={30} fill="none" stroke="#999" strokeWidth="0.8" strokeDasharray="3 2" />
        </>
      ) : (
        <>
          <rect
            x={x0}
            y={y0}
            width={ow}
            height={oh}
            fill={
              isWood
                ? `url(#${fillId}-wood)`
                : spec.texture === "gold-carved"
                  ? `url(#${fillId}-carved)`
                  : isBrushed
                    ? `url(#${fillId}-brushed)`
                    : spec.texture === "yellow-gloss"
                      ? `url(#${fillId}-yellow)`
                      : spec.texture === "black-gloss"
                        ? `url(#${fillId}-black)`
                        : spec.texture === "black-matte"
                          ? `url(#${fillId}-matte)`
                          : spec.texture === "acrylic"
                            ? spec.color
                            : spec.color
            }
            fillOpacity={spec.texture === "acrylic" ? 0.45 : 1}
            stroke={spec.texture === "acrylic" ? "#ffffff" : "#00000033"}
            strokeWidth="0.5"
            strokeDasharray={spec.texture === "acrylic" ? "2 1.5" : undefined}
          />
          {/* Mat, or the dark tray a floated work hangs against. */}
          {spec.mat ? (
            <rect x={opening.x} y={opening.y} width={opening.w} height={opening.h} fill={spec.mat.color} />
          ) : spec.floatGap > 0 ? (
            <rect x={opening.x} y={opening.y} width={opening.w} height={opening.h} fill={spec.trayColor ?? "#2a2a2a"} />
          ) : null}
          {/* Beaded inner edge. */}
          {spec.bead && (
            <g fill="#d4af37">
              {beadTop.map((x) => (
                <circle key={`t${x}`} cx={x} cy={beadYs[0]} r={beadR} />
              ))}
              {beadTop.map((x) => (
                <circle key={`b${x}`} cx={x} cy={beadYs[1]} r={beadR} />
              ))}
              {beadSide.map((y) => (
                <circle key={`l${y}`} cx={beadXs[0]} cy={y} r={beadR} />
              ))}
              {beadSide.map((y) => (
                <circle key={`r${y}`} cx={beadXs[1]} cy={y} r={beadR} />
              ))}
            </g>
          )}
          {/* Thin gold trim rings. */}
          {spec.trim && (spec.trim.at === "mat" || spec.trim.at === "both") && (
            <rect x={opening.x + trimW / 2} y={opening.y + trimW / 2} width={opening.w - trimW} height={opening.h - trimW} fill="none" stroke={spec.trim.color} strokeWidth={trimW} />
          )}
          {/* Edge profile hint: a line just inside the frame band. */}
          {profileStroke && (
            <rect x={opening.x} y={opening.y} width={opening.w} height={opening.h} fill="none" stroke={profileStroke} strokeWidth="1.2" rx={spec.profile === "rounded" ? 1 : 0} />
          )}
          {/* Artwork: the real image when available, else the placeholder. */}
          {imageUrl ? (
            <g clipPath={`url(#${fillId}-art-clip)`}>
              <image href={imageUrl} x={art.x} y={art.y} width={art.w} height={art.h} preserveAspectRatio="xMidYMid slice" />
            </g>
          ) : (
            <>
              <rect x={art.x} y={art.y} width={art.w} height={art.h} fill={artworkColor ?? `url(#${fillId}-art)`} />
              {!artworkColor && (
                <>
                  <circle cx={art.x + art.w * 0.32} cy={art.y + art.h * 0.36} r={Math.min(art.w, art.h) * 0.16} fill="#8a7a5c" opacity="0.55" />
                  <rect x={art.x + art.w * 0.55} y={art.y + art.h * 0.6} width={art.w * 0.3} height={art.h * 0.14} fill="#d7c6a9" opacity="0.8" />
                </>
              )}
            </>
          )}
          {spec.trim && (spec.trim.at === "artwork" || spec.trim.at === "both") && (
            <rect x={art.x - trimW / 2} y={art.y - trimW / 2} width={art.w + trimW} height={art.h + trimW} fill="none" stroke={spec.trim.color} strokeWidth={trimW} />
          )}
          {/* Glass: a faint diagonal sheen over the artwork. */}
          {glassOpacity > 0 && (
            <rect x={art.x} y={art.y} width={art.w} height={art.h} fill={`url(#${fillId}-glass)`} />
          )}
        </>
      )}
    </svg>
  );
}
