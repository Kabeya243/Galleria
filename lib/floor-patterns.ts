// Procedural floor-pattern textures (Claude's fpat from the standalone
// HTML file): parquet planks, herringbone zigzag, 8 × 8 checkerboard.
// Same canvas-texture model as the Sunlight floor (see sunlightTex in
// components/gallery-scene.tsx): 512 px canvas, sRGB, repeat 5 × 6.
// Browser only (needs a 2D canvas context); cached per pattern.

import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import type { FloorPatternKey } from "@/lib/editor-params";

const R = (a: number, b: number) => a + Math.random() * (b - a);

function makePatternTexture(pattern: Exclude<FloorPatternKey, "original">): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 512;
  const g = c.getContext("2d")!;
  if (pattern === "damier") {
    // 8 × 8 checkerboard, warm off-white against mid grey.
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        g.fillStyle = (x + y) % 2 ? "#e8e6e1" : "#8b8b8f";
        g.fillRect(x * 64, y * 64, 64, 64);
      }
    }
  } else if (pattern === "parquet") {
    // Eight vertical planks, warm wood tones.
    for (let i = 0; i < 8; i++) {
      g.fillStyle = `hsl(34,45%,${R(55, 68)}%)`;
      g.fillRect(i * 64, 0, 62, 512);
    }
  } else {
    // Herringbone: 9 × 9 cells, each a short plank rotated ±45°.
    for (let y = 0; y < 9; y++) {
      for (let x = 0; x < 9; x++) {
        g.save();
        g.translate(x * 64, y * 64);
        g.rotate(((x + y) % 2 ? 1 : -1) * Math.PI / 4);
        g.fillStyle = `hsl(32,45%,${R(52, 66)}%)`;
        g.fillRect(-28, -8, 56, 16);
        g.restore();
      }
    }
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  t.repeat.set(5, 6);
  return t;
}

const cache = new Map<Exclude<FloorPatternKey, "original">, CanvasTexture>();

// The pattern texture for a floor-pattern key, or null for "original"
// (the room keeps its own floor). Cached: one texture per pattern per
// page load, like the Sunlight textures.
export function floorPatternTexture(pattern: FloorPatternKey): CanvasTexture | null {
  if (pattern === "original") return null;
  let texture = cache.get(pattern);
  if (!texture) {
    texture = makePatternTexture(pattern);
    cache.set(pattern, texture);
  }
  return texture;
}
