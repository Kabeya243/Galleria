"use client";

import { FRAME_VARIANTS } from "@/lib/demo-data";
import type { FrameVariant } from "@/lib/demo-data";

// A small faithful preview of a frame style: the same border width,
// mat, trim and motif the 3D render uses, drawn as SVG so the user can
// see the frame before choosing it. The artwork in the middle is a
// neutral placeholder — the frame is the subject.
export default function FrameThumbnail({ variant }: { variant: FrameVariant }) {
  const spec = FRAME_VARIANTS[variant] ?? FRAME_VARIANTS.wood;
  const key = variant;
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

  return (
    <svg width={48} height={36} viewBox="0 0 48 36" aria-hidden="true">
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
        <pattern id={`${fillId}-wood`} width="14" height="7" patternUnits="userSpaceOnUse">
          <rect width="14" height="7" fill="#8a6242" />
          <path d="M0 2 Q 7 0 14 2" stroke="#5f4128" strokeWidth="0.8" fill="none" opacity="0.7" />
          <path d="M0 5 Q 7 7 14 5" stroke="#a97c50" strokeWidth="0.8" fill="none" opacity="0.7" />
        </pattern>
        <pattern id={`${fillId}-carved`} width="10" height="10" patternUnits="userSpaceOnUse">
          <rect width="10" height="10" fill="#a67c37" />
          <circle cx="5" cy="5" r="3.2" fill="none" stroke="#6b4a1f" strokeWidth="1.6" />
          <circle cx="5" cy="5" r="3.2" fill="none" stroke="#d4af37" strokeWidth="0.8" />
          <circle cx="5" cy="5" r="1" fill="#8a6d1f" />
        </pattern>
        <pattern id={`${fillId}-brushed`} width="10" height="4" patternUnits="userSpaceOnUse">
          <rect width="10" height="4" fill={spec.color} />
          <line x1="0" y1="1" x2="10" y2="1" stroke="#e8c96a" strokeWidth="0.7" opacity="0.6" />
          <line x1="0" y1="3" x2="10" y2="3" stroke="#8a6d1f" strokeWidth="0.7" opacity="0.6" />
        </pattern>
        <pattern id={`${fillId}-matte`} width="6" height="6" patternUnits="userSpaceOnUse">
          <rect width="6" height="6" fill="#1c1c1c" />
          <circle cx="1.5" cy="1.5" r="0.5" fill="#333333" />
          <circle cx="4.5" cy="4.5" r="0.5" fill="#000000" />
        </pattern>
      </defs>
      {variant === "none" ? (
        <>
          <rect x={4} y={3} width={40} height={30} fill={`url(#${fillId}-art)`} />
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
              spec.texture === "wood"
                ? `url(#${fillId}-wood)`
                : spec.texture === "gold-carved"
                  ? `url(#${fillId}-carved)`
                  : spec.texture === "gold-brushed"
                    ? `url(#${fillId}-brushed)`
                    : spec.texture === "yellow-gloss"
                      ? `url(#${fillId}-yellow)`
                      : spec.texture === "black-gloss"
                        ? `url(#${fillId}-black)`
                        : spec.texture === "black-matte"
                          ? `url(#${fillId}-matte)`
                          : spec.color
            }
            stroke="#00000033"
            strokeWidth="0.5"
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
          {/* Artwork. */}
          <rect x={art.x} y={art.y} width={art.w} height={art.h} fill={`url(#${fillId}-art)`} />
          <circle cx={art.x + art.w * 0.32} cy={art.y + art.h * 0.36} r={Math.min(art.w, art.h) * 0.16} fill="#8a7a5c" opacity="0.55" />
          <rect x={art.x + art.w * 0.55} y={art.y + art.h * 0.6} width={art.w * 0.3} height={art.h * 0.14} fill="#d7c6a9" opacity="0.8" />
          {spec.trim && (spec.trim.at === "artwork" || spec.trim.at === "both") && (
            <rect x={art.x - trimW / 2} y={art.y - trimW / 2} width={art.w + trimW} height={art.h + trimW} fill="none" stroke={spec.trim.color} strokeWidth={trimW} />
          )}
        </>
      )}
    </svg>
  );
}
