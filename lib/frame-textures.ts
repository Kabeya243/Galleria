import { CanvasTexture, RepeatWrapping, SRGBColorSpace } from "three";
import type { FrameMatKind, FrameTextureKind } from "@/lib/demo-data";

// Procedural frame materials, drawn on canvas from the reference photos —
// no photos are shipped to the browser, so each frame renders from its
// own drawn texture: wood grain, brushed and carved gold, yellow gloss,
// matte and glossy black, red velvet and cream paper mats.
const TILE = 256;

function makeTile(draw: (ctx: CanvasRenderingContext2D, size: number) => void): CanvasTexture | undefined {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = TILE;
  canvas.height = TILE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return undefined;
  draw(ctx, TILE);
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.anisotropy = 4;
  return texture;
}

function grainLines(ctx: CanvasRenderingContext2D, size: number, dark: string, light: string, count: number) {
  for (let i = 0; i < count; i += 1) {
    const y = Math.random() * size;
    const wobble = 2 + Math.random() * 5;
    ctx.strokeStyle = Math.random() > 0.5 ? dark : light;
    ctx.globalAlpha = 0.12 + Math.random() * 0.22;
    ctx.lineWidth = 0.6 + Math.random() * 1.6;
    ctx.beginPath();
    ctx.moveTo(0, y);
    for (let x = 0; x <= size; x += 32) {
      ctx.lineTo(x, y + Math.sin((x / size) * Math.PI * 2 + i) * wobble);
    }
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// One wood tile: base colour, dark and light grain lines, and a few
// darker knots. `grain` (0–1) sets how strong the grain reads — the
// Frame Studio grain control drives it.
function drawWood(ctx: CanvasRenderingContext2D, size: number, base: string, dark: string, light: string, grain: number) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  grainLines(ctx, size, dark, light, Math.round(8 + grain * 52));
  for (let i = 0; i < Math.round(grain * 4); i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.strokeStyle = dark;
    ctx.globalAlpha = 0.4 + grain * 0.2;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.ellipse(x, y, 7 + Math.random() * 5, 4 + Math.random() * 3, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawBrushedMetal(ctx: CanvasRenderingContext2D, size: number, base: string, dark: string, light: string) {
  ctx.fillStyle = base;
  ctx.fillRect(0, 0, size, size);
  grainLines(ctx, size, dark, light, 70);
  const sheen = ctx.createLinearGradient(0, 0, 0, size);
  sheen.addColorStop(0, "rgba(255,255,255,0.16)");
  sheen.addColorStop(0.5, "rgba(255,255,255,0)");
  sheen.addColorStop(1, "rgba(0,0,0,0.14)");
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, size, size);
}

const tileCache = new Map<string, CanvasTexture | undefined>();

// One square tile of the frame material, cached per kind. Bars clone it
// and set their own repeat, so the grain / carving scales with the bar.
// `options.grain` (0–1) strengthens or softens the wood grain; `options`
// are part of the cache key, so a custom grain never pollutes the
// built-in tile. Acrylic has no tile — its bars render semi-transparent.
export function frameTileTexture(kind: FrameTextureKind, options?: { grain?: number }): CanvasTexture | undefined {
  const grain = options?.grain ?? 0.6;
  const key = `${kind}:${kind === "wood" || kind === "oak" || kind === "walnut" || kind === "mahogany" ? grain.toFixed(2) : ""}`;
  const cached = tileCache.get(key);
  if (cached !== undefined || tileCache.has(key)) return cached;
  let texture: CanvasTexture | undefined;
  if (kind === "wood") {
    texture = makeTile((ctx, size) => drawWood(ctx, size, "#8a6242", "#5f4128", "#a97c50", grain));
  } else if (kind === "oak") {
    texture = makeTile((ctx, size) => drawWood(ctx, size, "#c8a06a", "#a37f4e", "#e0c090", Math.max(0.15, grain * 0.6)));
  } else if (kind === "walnut") {
    texture = makeTile((ctx, size) => drawWood(ctx, size, "#4a3226", "#2e1d13", "#6b4a34", grain));
  } else if (kind === "mahogany") {
    texture = makeTile((ctx, size) => drawWood(ctx, size, "#6e2f24", "#4a1d15", "#8f4636", grain));
  } else if (kind === "silver-brushed") {
    texture = makeTile((ctx, size) => drawBrushedMetal(ctx, size, "#c8c8c8", "#9a9a9a", "#e8e8e8"));
  } else if (kind === "aluminium-brushed") {
    texture = makeTile((ctx, size) => drawBrushedMetal(ctx, size, "#9aa0a3", "#6e7477", "#c0c5c8"));
  } else if (kind === "gold-brushed") {
    texture = makeTile((ctx, size) => {
      ctx.fillStyle = "#c9a227";
      ctx.fillRect(0, 0, size, size);
      grainLines(ctx, size, "#8a6d1f", "#e8c96a", 60);
      const sheen = ctx.createLinearGradient(0, 0, 0, size);
      sheen.addColorStop(0, "rgba(255,240,180,0.20)");
      sheen.addColorStop(0.5, "rgba(255,240,180,0)");
      sheen.addColorStop(1, "rgba(90,65,10,0.18)");
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, size, size);
    });
  } else if (kind === "gold-carved") {
    // Carved gold is real ornament geometry now (lib/frame-geometry.ts) —
    // no drawn carving. The bars render as bare gold metal; the texture
    // returns undefined so the material falls back to the spec colour.
    texture = undefined;
  } else if (kind === "yellow-gloss") {
    texture = makeTile((ctx, size) => {
      ctx.fillStyle = "#f5c400";
      ctx.fillRect(0, 0, size, size);
      const sheen = ctx.createLinearGradient(0, 0, size, size);
      sheen.addColorStop(0, "rgba(255,225,77,0.55)");
      sheen.addColorStop(0.45, "rgba(255,225,77,0)");
      sheen.addColorStop(1, "rgba(190,150,0,0.25)");
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, size, size);
    });
  } else if (kind === "black-gloss") {
    texture = makeTile((ctx, size) => {
      ctx.fillStyle = "#161616";
      ctx.fillRect(0, 0, size, size);
      const sheen = ctx.createLinearGradient(0, 0, size, size);
      sheen.addColorStop(0, "rgba(255,255,255,0.14)");
      sheen.addColorStop(0.5, "rgba(255,255,255,0.02)");
      sheen.addColorStop(1, "rgba(255,255,255,0.08)");
      ctx.fillStyle = sheen;
      ctx.fillRect(0, 0, size, size);
    });
  } else if (kind === "black-matte") {
    texture = makeTile((ctx, size) => {
      ctx.fillStyle = "#1c1c1c";
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 900; i += 1) {
        ctx.fillStyle = Math.random() > 0.5 ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.16)";
        ctx.fillRect(Math.random() * size, Math.random() * size, 1.4, 1.4);
      }
    });
  } else {
    texture = undefined;
  }
  tileCache.set(key, texture);
  return texture;
}

const matCache = new Map<string, CanvasTexture | undefined>();

export function matTexture(kind: FrameMatKind, color: string): CanvasTexture | undefined {
  const key = `${kind}:${color}`;
  const cached = matCache.get(key);
  if (cached !== undefined || matCache.has(key)) return cached;
  let texture: CanvasTexture | undefined;
  if (kind === "velvet") {
    texture = makeTile((ctx, size) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, size, size);
      // Velvet nap: short strokes in slightly lighter and darker red.
      for (let i = 0; i < 2600; i += 1) {
        ctx.strokeStyle = Math.random() > 0.5 ? "rgba(255,120,130,0.10)" : "rgba(40,0,5,0.14)";
        ctx.lineWidth = 1;
        const x = Math.random() * size;
        const y = Math.random() * size;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + (Math.random() - 0.5) * 2, y + 2 + Math.random() * 3);
        ctx.stroke();
      }
    });
  } else if (kind === "paper") {
    texture = makeTile((ctx, size) => {
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, size, size);
      for (let i = 0; i < 500; i += 1) {
        ctx.fillStyle = Math.random() > 0.5 ? "rgba(120,100,60,0.05)" : "rgba(255,255,255,0.06)";
        ctx.fillRect(Math.random() * size, Math.random() * size, 2, 1);
      }
    });
  } else {
    texture = frameTileTexture("yellow-gloss");
  }
  matCache.set(key, texture);
  return texture;
}
