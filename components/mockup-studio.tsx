"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FRAME_VARIANTS, type FrameVariant } from "@/lib/demo-data";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type MockupArtwork = {
  id: string;
  title: string;
  medium: string;
  dimensions: string;
  year: string;
  color: string;
  accent: string;
  imageUrl: string | null;
  exhibitionTitle: string;
};

type Arrangement = "single" | "diptych" | "triptych" | "grid" | "salon";
type Glass = "none" | "clear" | "non-reflective";
type Lighting = "warm" | "cool" | "daylight";
type WallMaterial = "paint" | "plaster" | "brick" | "wood" | "concrete";
type ExportFormat = "png" | "jpeg" | "webp";

type MockupConfig = {
  scene: string;
  arrangement: Arrangement;
  artworkIds: string[];
  widthCm: number;
  heightCm: number;
  posX: number; // 0–100, centre across the wall
  hangCm: number; // centre height above the floor, cm
  tilt: number; // perspective tilt, degrees (-12..12)
  frame: FrameVariant;
  matOn: boolean;
  matColor: string;
  glass: Glass;
  lighting: Lighting;
  shadow: boolean;
  shadowStrength: number; // 0–100
  wallColor: string;
  wallMaterial: WallMaterial;
  brightness: number; // 0.6–1.3
  spacing: number; // gap between works in an arrangement, cm
  resolution: "1080p" | "2k" | "4k";
  format: ExportFormat;
};

const DEFAULT_CONFIG: MockupConfig = {
  scene: "living-room",
  arrangement: "single",
  artworkIds: [],
  widthCm: 100,
  heightCm: 80,
  posX: 50,
  hangCm: 155,
  tilt: 0,
  frame: "wood",
  matOn: false,
  matColor: "#f2ead8",
  glass: "none",
  lighting: "daylight",
  shadow: true,
  shadowStrength: 45,
  wallColor: "",
  wallMaterial: "paint",
  brightness: 1,
  spacing: 12,
  resolution: "1080p",
  format: "png",
};

const RESOLUTIONS: Record<MockupConfig["resolution"], { w: number; h: number; label: string }> = {
  "1080p": { w: 1920, h: 1080, label: "1080p · 1920 × 1080" },
  "2k": { w: 2560, h: 1440, label: "2K · 2560 × 1440" },
  "4k": { w: 3840, h: 2160, label: "4K · 3840 × 2160" },
};

const ARRANGEMENT_COUNT: Record<Arrangement, number> = {
  single: 1,
  diptych: 2,
  triptych: 3,
  grid: 4,
  salon: 5,
};

const ARRANGEMENT_LABELS: Record<Arrangement, string> = {
  single: "Single",
  diptych: "Diptych",
  triptych: "Triptych",
  grid: "Grid 2 × 2",
  salon: "Salon cluster",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse "120 × 89 cm" (or "120x89", "120 x 89") into cm. Falls back to 100×80. */
function parseDimensions(dimensions: string): { w: number; h: number } {
  const m = dimensions.replace(",", ".").match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)/);
  if (!m) return { w: 100, h: 80 };
  const w = Math.min(400, Math.max(10, parseFloat(m[1])));
  const h = Math.min(400, Math.max(10, parseFloat(m[2])));
  return { w, h };
}

function shade(hex: string, amt: number): string {
  const n = hex.replace("#", "");
  const num = parseInt(n.length === 3 ? n.split("").map((c) => c + c).join("") : n, 16);
  const r = Math.min(255, Math.max(0, (num >> 16) + amt));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amt));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amt));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const n = hex.replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
  const num = parseInt(full, 16);
  return `rgba(${(num >> 16) & 0xff},${(num >> 8) & 0xff},${num & 0xff},${alpha})`;
}

/** Load an artwork image with CORS so the canvas stays exportable. */
function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`Could not load image: ${url}`));
    img.src = url;
  });
}

/** Procedural stand-in for artworks without an uploaded image. */
function drawPlaceholderArt(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  art: MockupArtwork,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = art.color;
  ctx.fillRect(x, y, w, h);
  // Soft abstract composition in the artwork's own colours.
  ctx.fillStyle = hexToRgba(art.accent, 0.85);
  ctx.beginPath();
  ctx.arc(x + w * 0.62, y + h * 0.42, Math.min(w, h) * 0.34, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hexToRgba("#ffffff", 0.28);
  ctx.beginPath();
  ctx.arc(x + w * 0.3, y + h * 0.3, Math.min(w, h) * 0.16, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = hexToRgba("#000000", 0.25);
  ctx.fillRect(x, y + h * 0.78, w, h * 0.06);
  ctx.restore();
}

// ---------------------------------------------------------------------------
// Scenes — original procedural interiors (SVG-style canvas drawing, not photos)
// ---------------------------------------------------------------------------

type SceneDef = {
  id: string;
  label: string;
  wall: string;
  floor: string;
  mood: string;
  /** Draw furniture + props. Wall and floor are already painted. */
  draw: (ctx: CanvasRenderingContext2D, W: number, H: number, floorY: number) => void;
};

function rect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.fillRect(x, y, w, h);
}

function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
  ctx.fill();
}

function ellipse(ctx: CanvasRenderingContext2D, x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
  ctx.fill();
}

function plant(ctx: CanvasRenderingContext2D, x: number, baseY: number, s: number) {
  // Pot + leaves, drawn from simple shapes.
  ctx.fillStyle = "#a9805a";
  ctx.beginPath();
  ctx.moveTo(x - 0.03 * s, baseY - 0.09 * s);
  ctx.lineTo(x + 0.03 * s, baseY - 0.09 * s);
  ctx.lineTo(x + 0.022 * s, baseY);
  ctx.lineTo(x - 0.022 * s, baseY);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = "#4a6b3f";
  ctx.lineWidth = Math.max(2, 0.008 * s);
  ctx.lineCap = "round";
  for (const [dx, dy, len] of [
    [-0.035, -0.16, 0.1],
    [-0.012, -0.19, 0.12],
    [0.015, -0.18, 0.11],
    [0.04, -0.14, 0.09],
  ] as const) {
    ctx.beginPath();
    ctx.moveTo(x, baseY - 0.09 * s);
    ctx.quadraticCurveTo(x + dx * s, baseY - 0.09 * s - len * s * 0.6, x + dx * s, baseY - 0.09 * s - len * s);
    ctx.stroke();
  }
  ctx.fillStyle = "#5d7f4e";
  for (const [dx, dy] of [
    [-0.035, -0.16],
    [-0.012, -0.19],
    [0.015, -0.18],
    [0.04, -0.14],
  ] as const) {
    ellipse(ctx, x + dx * s, baseY + dy * s, 0.012 * s, 0.02 * s, "#5d7f4e");
  }
}

function sofa(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  const dark = shade(color, -28);
  const light = shade(color, 18);
  rrect(ctx, x, y, w, h, Math.min(14, h * 0.18), color); // body
  rrect(ctx, x + w * 0.04, y - h * 0.42, w * 0.42, h * 0.5, 8, light); // back cushions
  rrect(ctx, x + w * 0.54, y - h * 0.42, w * 0.42, h * 0.5, 8, light);
  rrect(ctx, x + w * 0.06, y + h * 0.08, w * 0.4, h * 0.5, 6, dark); // seat cushions
  rrect(ctx, x + w * 0.54, y + h * 0.08, w * 0.4, h * 0.5, 6, dark);
  rect(ctx, x + w * 0.02, y + h, w * 0.05, h * 0.16, "#3a2f26"); // legs
  rect(ctx, x + w * 0.93, y + h, w * 0.05, h * 0.16, "#3a2f26");
}

function pendantLamp(ctx: CanvasRenderingContext2D, x: number, topY: number, len: number, color: string) {
  ctx.strokeStyle = "#6b655c";
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(x, topY);
  ctx.lineTo(x, topY + len);
  ctx.stroke();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x - 16, topY + len);
  ctx.lineTo(x + 16, topY + len);
  ctx.lineTo(x + 10, topY + len + 18);
  ctx.lineTo(x - 10, topY + len + 18);
  ctx.closePath();
  ctx.fill();
  ellipse(ctx, x, topY + len + 20, 12, 4, "rgba(255, 214, 130, 0.85)");
}

const SCENES: SceneDef[] = [
  {
    id: "living-room",
    label: "Living room",
    wall: "#e8e2d6",
    floor: "#b08d63",
    mood: "Warm daylight, oak floor",
    draw(ctx, W, H, floorY) {
      // Rug
      ellipse(ctx, W * 0.5, H * 0.9, W * 0.34, H * 0.045, "#c9b8a3");
      ellipse(ctx, W * 0.5, H * 0.9, W * 0.28, H * 0.032, "#b3a186");
      sofa(ctx, W * 0.06, floorY - H * 0.085, W * 0.3, H * 0.085, "#8a7a68");
      // Coffee table
      rrect(ctx, W * 0.42, floorY - H * 0.035, W * 0.16, H * 0.012, 4, "#6f5138");
      rect(ctx, W * 0.435, floorY - H * 0.025, W * 0.008, H * 0.025, "#4a3524");
      rect(ctx, W * 0.565, floorY - H * 0.025, W * 0.008, H * 0.025, "#4a3524");
      // Floor lamp, right
      rect(ctx, W * 0.9, floorY - H * 0.22, W * 0.006, H * 0.22, "#4a4440");
      ellipse(ctx, W * 0.9, floorY - H * 0.235, W * 0.035, H * 0.02, "#e8d9a8");
      ellipse(ctx, W * 0.9, floorY - H * 0.235, W * 0.02, H * 0.012, "#f6e7bd");
      plant(ctx, W * 0.82, floorY, H * 0.55);
      // Framed print on the side wall, small
      rect(ctx, W * 0.72, floorY - H * 0.3, W * 0.07, H * 0.16, "#3d3a35");
      rect(ctx, W * 0.725, floorY - H * 0.29, W * 0.06, H * 0.14, "#c66545");
    },
  },
  {
    id: "bedroom",
    label: "Bedroom",
    wall: "#ddd5c6",
    floor: "#a98a68",
    mood: "Soft morning light",
    draw(ctx, W, H, floorY) {
      // Bed, left
      rrect(ctx, W * 0.05, floorY - H * 0.16, W * 0.06, H * 0.16, 6, "#5c4a3a"); // headboard
      rrect(ctx, W * 0.05, floorY - H * 0.09, W * 0.34, H * 0.09, 6, "#f4efe4"); // mattress
      rrect(ctx, W * 0.05, floorY - H * 0.03, W * 0.34, H * 0.03, 4, "#b7a284"); // throw
      rrect(ctx, W * 0.07, floorY - H * 0.13, W * 0.09, H * 0.05, 5, "#ffffff"); // pillows
      rrect(ctx, W * 0.17, floorY - H * 0.13, W * 0.09, H * 0.05, 5, "#efe7d6");
      // Nightstand + lamp, right of bed
      rrect(ctx, W * 0.44, floorY - H * 0.07, W * 0.08, H * 0.07, 4, "#7a5c40");
      rect(ctx, W * 0.475, floorY - H * 0.11, W * 0.006, H * 0.04, "#3d3a35");
      ellipse(ctx, W * 0.478, floorY - H * 0.115, W * 0.02, H * 0.014, "#f2dfa8");
      plant(ctx, W * 0.9, floorY, H * 0.5);
      ellipse(ctx, W * 0.55, H * 0.92, W * 0.2, H * 0.03, "#cbbda6");
    },
  },
  {
    id: "office",
    label: "Office",
    wall: "#e3e6e2",
    floor: "#9a938a",
    mood: "Cool daylight, concrete floor",
    draw(ctx, W, H, floorY) {
      // Desk
      rrect(ctx, W * 0.58, floorY - H * 0.1, W * 0.3, H * 0.014, 3, "#5c4632");
      rect(ctx, W * 0.59, floorY - H * 0.09, W * 0.012, H * 0.09, "#4a3826");
      rect(ctx, W * 0.855, floorY - H * 0.09, W * 0.012, H * 0.09, "#4a3826");
      // Monitor
      rect(ctx, W * 0.68, floorY - H * 0.19, W * 0.09, H * 0.06, "#2b2b2b");
      rect(ctx, W * 0.685, floorY - H * 0.185, W * 0.08, H * 0.05, "#7fa3a8");
      rect(ctx, W * 0.72, floorY - H * 0.13, W * 0.008, H * 0.03, "#2b2b2b");
      // Chair
      rrect(ctx, W * 0.68, floorY - H * 0.085, W * 0.07, H * 0.05, 6, "#3d4a52");
      rect(ctx, W * 0.715, floorY - H * 0.035, W * 0.006, H * 0.035, "#2b2b2b");
      // Shelf, left
      rect(ctx, W * 0.06, floorY - H * 0.34, W * 0.16, H * 0.008, "#6f5138");
      rect(ctx, W * 0.06, floorY - H * 0.24, W * 0.16, H * 0.008, "#6f5138");
      for (let i = 0; i < 5; i++) {
        rect(ctx, W * (0.07 + i * 0.03), floorY - H * (0.375 + (i % 2) * 0.005), W * 0.016, H * 0.04, ["#a67c37", "#5d7f4e", "#7a5c40", "#c66545", "#4a6b7a"][i]);
      }
      for (let i = 0; i < 4; i++) {
        rect(ctx, W * (0.075 + i * 0.035), floorY - H * 0.275, W * 0.02, H * 0.04, ["#8a7a68", "#b3a186", "#6b655c", "#a9805a"][i]);
      }
      plant(ctx, W * 0.3, floorY, H * 0.45);
    },
  },
  {
    id: "hotel",
    label: "Hotel",
    wall: "#ded8cb",
    floor: "#8f7a5e",
    mood: "Evening warmth, carpet",
    draw(ctx, W, H, floorY) {
      // Carpet
      ellipse(ctx, W * 0.5, H * 0.93, W * 0.36, H * 0.04, "#7d6b52");
      // Bed, centre-left
      rrect(ctx, W * 0.1, floorY - H * 0.17, W * 0.05, H * 0.17, 6, "#4a3a2c");
      rrect(ctx, W * 0.1, floorY - H * 0.1, W * 0.32, H * 0.1, 6, "#f7f2e8");
      rrect(ctx, W * 0.12, floorY - H * 0.135, W * 0.09, H * 0.045, 5, "#ffffff");
      rrect(ctx, W * 0.22, floorY - H * 0.135, W * 0.09, H * 0.045, 5, "#efe7d6");
      rrect(ctx, W * 0.1, floorY - H * 0.04, W * 0.32, H * 0.04, 4, "#a67c37");
      // Bench at foot of bed
      rrect(ctx, W * 0.12, floorY - H * 0.055, W * 0.28, H * 0.03, 5, "#5c4632");
      // Pendant lamps
      pendantLamp(ctx, W * 0.16, 0, H * 0.1, "#a67c37");
      pendantLamp(ctx, W * 0.3, 0, H * 0.1, "#a67c37");
      // Side table + vase, right
      ellipse(ctx, W * 0.78, floorY - H * 0.06, W * 0.05, H * 0.008, "#3d3a35");
      rect(ctx, W * 0.777, floorY - H * 0.06, W * 0.006, H * 0.06, "#3d3a35");
      rrect(ctx, W * 0.765, floorY - H * 0.1, W * 0.03, H * 0.035, 4, "#7fa3a8");
      plant(ctx, W * 0.92, floorY, H * 0.5);
    },
  },
  {
    id: "museum",
    label: "Museum",
    wall: "#eceae4",
    floor: "#b5ada0",
    mood: "Bright, quiet, stone floor",
    draw(ctx, W, H, floorY) {
      // Tall window, right
      rect(ctx, W * 0.82, H * 0.04, W * 0.13, H * 0.4, "#cfe0e8");
      rect(ctx, W * 0.885, H * 0.04, W * 0.004, H * 0.4, "#8a8580");
      rect(ctx, W * 0.82, H * 0.23, W * 0.13, H * 0.004, "#8a8580");
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.beginPath();
      ctx.moveTo(W * 0.82, floorY);
      ctx.lineTo(W * 0.95, floorY);
      ctx.lineTo(W * 0.99, H * 0.98);
      ctx.lineTo(W * 0.86, H * 0.98);
      ctx.closePath();
      ctx.fill();
      // Bench, centre
      rrect(ctx, W * 0.4, floorY - H * 0.05, W * 0.2, H * 0.02, 4, "#6f6a60");
      rect(ctx, W * 0.415, floorY - H * 0.03, W * 0.01, H * 0.03, "#4a463f");
      rect(ctx, W * 0.575, floorY - H * 0.03, W * 0.01, H * 0.03, "#4a463f");
      // Pedestal with small sculpture, left
      rect(ctx, W * 0.08, floorY - H * 0.14, W * 0.07, H * 0.14, "#f4f2ec");
      ellipse(ctx, W * 0.115, floorY - H * 0.17, W * 0.02, H * 0.03, "#8a7a68");
      // Wall label
      rect(ctx, W * 0.62, floorY - H * 0.26, W * 0.05, H * 0.07, "#ffffff");
      rect(ctx, W * 0.63, floorY - H * 0.245, W * 0.03, H * 0.004, "#9a938a");
      rect(ctx, W * 0.63, floorY - H * 0.23, W * 0.03, H * 0.004, "#9a938a");
      rect(ctx, W * 0.63, floorY - H * 0.215, W * 0.02, H * 0.004, "#9a938a");
    },
  },
  {
    id: "gallery",
    label: "Contemporary gallery",
    wall: "#f4f2ee",
    floor: "#a9a49b",
    mood: "White cube, track light",
    draw(ctx, W, H, floorY) {
      // Track light beam from ceiling
      ctx.fillStyle = "rgba(255, 246, 220, 0.5)";
      ctx.beginPath();
      ctx.moveTo(W * 0.5, 0);
      ctx.lineTo(W * 0.54, 0);
      ctx.lineTo(W * 0.66, floorY);
      ctx.lineTo(W * 0.42, floorY);
      ctx.closePath();
      ctx.fill();
      rect(ctx, W * 0.48, 0, W * 0.08, H * 0.012, "#2b2b2b");
      rrect(ctx, W * 0.505, H * 0.012, W * 0.03, H * 0.03, 3, "#2b2b2b");
      // Low bench
      rrect(ctx, W * 0.68, floorY - H * 0.045, W * 0.18, H * 0.018, 4, "#e8e2d6");
      rect(ctx, W * 0.695, floorY - H * 0.028, W * 0.008, H * 0.028, "#8a8580");
      rect(ctx, W * 0.83, floorY - H * 0.028, W * 0.008, H * 0.028, "#8a8580");
      // Small plinth, left
      rect(ctx, W * 0.08, floorY - H * 0.16, W * 0.08, H * 0.16, "#ffffff");
      ellipse(ctx, W * 0.12, floorY - H * 0.19, W * 0.025, H * 0.028, "#c66545");
      // Floor shadow line
      ctx.fillStyle = "rgba(0,0,0,0.08)";
      ctx.fillRect(0, floorY + H * 0.02, W, H * 0.01);
    },
  },
  {
    id: "restaurant",
    label: "Restaurant",
    wall: "#d9cfc0",
    floor: "#6e4f36",
    mood: "Warm evening, dark wood",
    draw(ctx, W, H, floorY) {
      // Banquette, left
      rrect(ctx, W * 0.04, floorY - H * 0.12, W * 0.26, H * 0.12, 8, "#7a3f34");
      rrect(ctx, W * 0.04, floorY - H * 0.2, W * 0.26, H * 0.09, 8, "#8a4a3e");
      // Table
      ellipse(ctx, W * 0.44, floorY - H * 0.09, W * 0.13, H * 0.014, "#f4efe4");
      rect(ctx, W * 0.437, floorY - H * 0.09, W * 0.006, H * 0.09, "#3d3a35");
      ellipse(ctx, W * 0.44, floorY, W * 0.06, H * 0.008, "#3d3a35");
      // Wine glasses on table
      ellipse(ctx, W * 0.4, floorY - H * 0.115, W * 0.008, H * 0.012, "#e8f0f2");
      ellipse(ctx, W * 0.47, floorY - H * 0.115, W * 0.008, H * 0.012, "#e8f0f2");
      // Pendant lamps over table
      pendantLamp(ctx, W * 0.4, 0, H * 0.14, "#2b2b2b");
      pendantLamp(ctx, W * 0.48, 0, H * 0.14, "#2b2b2b");
      // Chairs, right
      rrect(ctx, W * 0.62, floorY - H * 0.11, W * 0.05, H * 0.11, 5, "#3d3a35");
      rrect(ctx, W * 0.62, floorY - H * 0.11, W * 0.05, H * 0.02, 3, "#2b2b2b");
      rrect(ctx, W * 0.72, floorY - H * 0.11, W * 0.05, H * 0.11, 5, "#3d3a35");
      rrect(ctx, W * 0.72, floorY - H * 0.11, W * 0.05, H * 0.02, 3, "#2b2b2b");
      // Wall panelling
      rect(ctx, W * 0.85, H * 0.05, W * 0.11, H * 0.45, "#b7a284");
      rect(ctx, W * 0.86, H * 0.07, W * 0.09, H * 0.41, "#c9b8a3");
    },
  },
  {
    id: "commercial",
    label: "Commercial space",
    wall: "#e6e4df",
    floor: "#8f8a82",
    mood: "Bright lobby, polished floor",
    draw(ctx, W, H, floorY) {
      // Reception desk
      rrect(ctx, W * 0.58, floorY - H * 0.11, W * 0.3, H * 0.11, 4, "#f4f2ec");
      rect(ctx, W * 0.58, floorY - H * 0.11, W * 0.3, H * 0.01, "#a67c37");
      rect(ctx, W * 0.6, floorY - H * 0.17, W * 0.05, H * 0.06, "#2b2b2b");
      rect(ctx, W * 0.605, floorY - H * 0.165, W * 0.04, H * 0.05, "#7fa3a8");
      // Shelving, left
      rect(ctx, W * 0.06, H * 0.06, W * 0.16, H * 0.5, "#d9d4c9");
      for (let r = 0; r < 3; r++) {
        rect(ctx, W * 0.06, H * (0.2 + r * 0.15), W * 0.16, H * 0.006, "#b7b0a2");
        for (let i = 0; i < 3; i++) {
          rect(ctx, W * (0.075 + i * 0.05), H * (0.14 + r * 0.15), W * 0.03, H * 0.055, ["#a67c37", "#5d7f4e", "#c66545"][i]);
        }
      }
      // Sofa, centre-left
      sofa(ctx, W * 0.28, floorY - H * 0.08, W * 0.22, H * 0.08, "#6b7a72");
      plant(ctx, W * 0.93, floorY, H * 0.6);
      // Logo wall text
      ctx.fillStyle = "#a67c37";
      ctx.font = `600 ${Math.round(H * 0.045)}px Georgia, serif`;
      ctx.fillText("SANAA", W * 0.6, H * 0.1);
    },
  },
];

const WALL_MATERIALS: { id: WallMaterial; label: string }[] = [
  { id: "paint", label: "Paint" },
  { id: "plaster", label: "Plaster" },
  { id: "brick", label: "Brick" },
  { id: "wood", label: "Wood panel" },
  { id: "concrete", label: "Concrete" },
];

// ---------------------------------------------------------------------------
// Rendering engine — draws scene + artworks on any canvas at full resolution
// ---------------------------------------------------------------------------

const WALL_HEIGHT_CM = 300;
const WALL_WIDTH_CM = 600;

function drawWallMaterial(
  ctx: CanvasRenderingContext2D,
  W: number,
  floorY: number,
  wallColor: string,
  material: WallMaterial,
) {
  ctx.fillStyle = wallColor;
  ctx.fillRect(0, 0, W, floorY);
  const step = Math.max(3, W / 320);
  if (material === "plaster") {
    ctx.fillStyle = "rgba(0,0,0,0.03)";
    for (let x = 0; x < W; x += step * 3) {
      for (let y = 0; y < floorY; y += step * 3) {
        if ((x * 7 + y * 13) % 5 === 0) ctx.fillRect(x, y, step, step);
      }
    }
  } else if (material === "brick") {
    const bh = floorY / 14;
    const bw = W / 14;
    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = Math.max(1, W / 900);
    for (let r = 0; r < 14; r++) {
      const off = r % 2 === 0 ? 0 : bw / 2;
      for (let c = -1; c < 15; c++) {
        ctx.strokeRect(c * bw + off, r * bh, bw, bh);
      }
    }
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let r = 0; r < 14; r += 2) ctx.fillRect(0, r * bh, W, bh);
  } else if (material === "wood") {
    ctx.fillStyle = "rgba(0,0,0,0.07)";
    const pw = W / 10;
    for (let i = 0; i < 10; i++) ctx.fillRect(i * pw, 0, Math.max(1, W / 700), floorY);
    ctx.fillStyle = "rgba(255,255,255,0.05)";
    for (let i = 0; i < 10; i += 2) ctx.fillRect(i * pw, 0, pw, floorY);
  } else if (material === "concrete") {
    ctx.fillStyle = "rgba(0,0,0,0.05)";
    for (let x = 0; x < W; x += step * 5) {
      for (let y = 0; y < floorY; y += step * 5) {
        if ((x * 3 + y * 11) % 7 === 0) ctx.fillRect(x, y, step * 2, step);
      }
    }
  }
}

function drawFloor(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  floorY: number,
  floorColor: string,
) {
  ctx.fillStyle = floorColor;
  ctx.fillRect(0, floorY, W, H - floorY);
  // Perspective boards / tiles.
  ctx.strokeStyle = "rgba(0,0,0,0.10)";
  ctx.lineWidth = Math.max(1, W / 1200);
  const horizon = floorY;
  for (let i = 0; i <= 10; i++) {
    const x = (i / 10) * W;
    ctx.beginPath();
    ctx.moveTo(W / 2 + (x - W / 2) * 0.25, horizon);
    ctx.lineTo(x, H);
    ctx.stroke();
  }
  for (let r = 1; r <= 3; r++) {
    const y = horizon + (H - horizon) * (r / 3) * (r / 3);
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(W, y);
    ctx.stroke();
  }
  // Skirting board.
  ctx.fillStyle = "rgba(255,255,255,0.55)";
  ctx.fillRect(0, floorY - Math.max(3, H * 0.008), W, Math.max(3, H * 0.008));
  ctx.fillStyle = "rgba(0,0,0,0.18)";
  ctx.fillRect(0, floorY, W, Math.max(2, H * 0.004));
}

/** Frame border width in px, from the frame spec (width in metres) vs the artwork width in cm. */
function framePx(spec: (typeof FRAME_VARIANTS)[FrameVariant], artWcm: number, pxPerCm: number): number {
  if (spec.width <= 0) return 0;
  return Math.max(2, spec.width * 100 * pxPerCm * 0.9);
}

// ---------------------------------------------------------------------------
// Realistic frame rendering (Frame Studio, Nov 2026)
// ---------------------------------------------------------------------------
// The old render filled the frame bar with a flat solid colour. A real
// frame is not flat: it wears a moulding — wood grain, brushed metal,
// carved gold — and its profile (stepped, rounded, bevelled, scooped)
// catches light on its edges. The digitised frames already carry a real
// photo strip of the moulding (`spec.photo`, "/frames/<id>.png": the
// strip's outer edge is at the top of the image, its inner edge at the
// bottom — the same mapping as the 3D FramePhotoSkin), so the photo is
// the skin; frames without a photo get a procedural finish from
// `spec.texture`. Like the 3D gallery, beads and ornaments are NOT drawn
// on top of a photo frame — the photo already carries them.

/** Deterministic PRNG (mulberry32) so procedural grain never shimmers between redraws. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seedFromString(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

type FrameSpecLike = (typeof FRAME_VARIANTS)[FrameVariant];

/**
 * Clip one bar of a ring to its 45° mitred shape (local coords: outer edge
 * y = 0, inner edge y = w). Real frames are mitred, not butt-jointed: the
 * moulding, grain and photo are cut on the diagonal at each corner, so the
 * four bars meet on a clean diagonal seam instead of a hard step.
 */
function clipMitredBar(ctx: CanvasRenderingContext2D, len: number, w: number) {
  ctx.beginPath();
  if (len > 2 * w) {
    ctx.moveTo(0, 0);
    ctx.lineTo(len, 0);
    ctx.lineTo(len - w, w);
    ctx.lineTo(w, w);
    ctx.closePath();
  } else {
    ctx.rect(0, 0, len, w);
  }
  ctx.clip();
}

/**
 * Paint the four bars of a rectangular ring, one side at a time, in local
 * coordinates: x runs along the bar (0..len), y runs across it (0..w),
 * with the OUTER edge at y = 0 and the inner edge at y = w. The strip
 * photo's outer edge is at the top of the image, so it lands on y = 0 on
 * every side — exactly like the 3D FramePhotoSkin mapping (the mesh is
 * turned, the UVs travel with it).
 */
function paintRingSides(
  ctx: CanvasRenderingContext2D,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  w: number,
  fn: (ctx: CanvasRenderingContext2D, len: number, w: number, side: number) => void,
) {
  if (w <= 0) return;
  const horiz = x1 - x0;
  const vert = y1 - y0;
  // Top — outer edge up.
  ctx.save();
  ctx.translate(x0, y0);
  clipMitredBar(ctx, horiz, w);
  fn(ctx, horiz, w, 0);
  ctx.restore();
  // Bottom — turned 180°, outer edge down.
  ctx.save();
  ctx.translate(x1, y1);
  ctx.rotate(Math.PI);
  clipMitredBar(ctx, horiz, w);
  fn(ctx, horiz, w, 1);
  ctx.restore();
  // Left — turned -90°, outer edge left.
  ctx.save();
  ctx.translate(x0, y1);
  ctx.rotate(-Math.PI / 2);
  clipMitredBar(ctx, vert, w);
  fn(ctx, vert, w, 2);
  ctx.restore();
  // Right — turned +90°, outer edge right.
  ctx.save();
  ctx.translate(x1, y0);
  ctx.rotate(Math.PI / 2);
  clipMitredBar(ctx, vert, w);
  fn(ctx, vert, w, 3);
  ctx.restore();
}

/** Tile the real moulding photo along one bar (local coords). One tile covers `w` across the bar and `w * stripW/stripH` along it, so the carving is never stretched — the same rule as the 3D skin. */
function paintPhotoBar(ctx: CanvasRenderingContext2D, photo: HTMLImageElement, len: number, w: number) {
  const tileW = Math.max(4, w * (photo.naturalWidth / Math.max(1, photo.naturalHeight)));
  for (let x = 0; x < len; x += tileW) {
    const dw = Math.min(tileW, len - x);
    const sw = (dw / tileW) * photo.naturalWidth;
    ctx.drawImage(photo, 0, 0, sw, photo.naturalHeight, x, 0, dw, w);
  }
}

/** Wood grain: long wavy streaks along the bar, darker and lighter than the base. */
function paintWoodGrain(
  ctx: CanvasRenderingContext2D,
  base: string,
  len: number,
  w: number,
  rng: () => number,
  strength: number,
) {
  const streaks = Math.max(6, Math.round(w * (0.45 + strength) * 1.1));
  for (let i = 0; i < streaks; i++) {
    const y0 = rng() * w;
    const dark = rng() > 0.45;
    const amt = 45 + rng() * 45;
    ctx.strokeStyle = dark
      ? hexToRgba(shade(base, -amt), 0.1 + rng() * 0.16 * strength)
      : hexToRgba(shade(base, amt), 0.08 + rng() * 0.12 * strength);
    ctx.lineWidth = 0.6 + rng() * 1.4;
    const phase = rng() * Math.PI * 2;
    const amp = 0.4 + rng() * 1.6;
    const freq = 1 + rng() * 2;
    ctx.beginPath();
    ctx.moveTo(0, y0);
    const steps = 10;
    for (let s = 1; s <= steps; s++) {
      ctx.lineTo((s / steps) * len, y0 + Math.sin((s / steps) * Math.PI * freq + phase) * amp);
    }
    ctx.stroke();
  }
  // Knots on strong grain (walnut, mahogany).
  if (strength > 0.6) {
    const knots = 1 + Math.floor(rng() * 2);
    for (let k = 0; k < knots; k++) {
      const kx = rng() * len;
      const ky = w * (0.25 + rng() * 0.5);
      for (let r = 5; r > 0; r--) {
        ctx.strokeStyle = hexToRgba(shade(base, -70), 0.09);
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.ellipse(kx, ky, r * 2.2, r * 0.9, 0, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  }
}

/** Brushed metal: fine horizontal lines plus a soft anisotropic sheen band. */
function paintBrushedMetal(ctx: CanvasRenderingContext2D, len: number, w: number, rng: () => number) {
  const lines = Math.max(8, Math.round(w * 2.2));
  for (let i = 0; i < lines; i++) {
    const y = rng() * w;
    ctx.strokeStyle =
      rng() > 0.5 ? `rgba(255,255,255,${0.04 + rng() * 0.08})` : `rgba(0,0,0,${0.03 + rng() * 0.07})`;
    ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(len, y + (rng() - 0.5) * 1.5);
    ctx.stroke();
  }
  const g = ctx.createLinearGradient(0, 0, 0, w);
  g.addColorStop(0, "rgba(255,255,255,0.10)");
  g.addColorStop(0.35, "rgba(255,255,255,0.02)");
  g.addColorStop(0.62, "rgba(255,255,255,0.13)");
  g.addColorStop(1, "rgba(0,0,0,0.10)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, len, w);
}

/** Carved gold: a brushed gold base with repeated raised scroll bumps (dark recess + bright crescent). */
function paintGoldCarved(ctx: CanvasRenderingContext2D, len: number, w: number, rng: () => number) {
  paintBrushedMetal(ctx, len, w, rng);
  const step = Math.max(10, w * 1.5);
  for (let x = step / 2; x < len; x += step) {
    const cx = x;
    const cy = w / 2;
    const r = w * 0.3;
    const rg = ctx.createRadialGradient(cx, cy, r * 0.1, cx, cy, r);
    rg.addColorStop(0, "rgba(0,0,0,0.42)");
    rg.addColorStop(0.7, "rgba(0,0,0,0.18)");
    rg.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = rg;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,240,200,0.55)";
    ctx.lineWidth = Math.max(1, w * 0.06);
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.62, Math.PI * 0.9, Math.PI * 1.9);
    ctx.stroke();
    ctx.strokeStyle = "rgba(60,40,0,0.5)";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.62, Math.PI * -0.1, Math.PI * 0.9);
    ctx.stroke();
    ctx.fillStyle = "rgba(255,235,180,0.7)";
    ctx.beginPath();
    ctx.arc(cx, cy, r * 0.22, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** High-gloss lacquer: a bright band near the outer edge, dark at the inner edge. */
function paintGloss(ctx: CanvasRenderingContext2D, len: number, w: number) {
  const g = ctx.createLinearGradient(0, 0, 0, w);
  g.addColorStop(0, "rgba(255,255,255,0.34)");
  g.addColorStop(0.18, "rgba(255,255,255,0.10)");
  g.addColorStop(0.5, "rgba(0,0,0,0.06)");
  g.addColorStop(1, "rgba(0,0,0,0.28)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, len, w);
}

/** Relative luminance of a hex colour (0 = black, 1 = white). */
function luminance(hex: string): number {
  const n = hex.replace("#", "");
  const full = n.length === 3 ? n.split("").map((c) => c + c).join("") : n;
  const num = parseInt(full, 16);
  return (0.299 * ((num >> 16) & 0xff) + 0.587 * ((num >> 8) & 0xff) + 0.114 * (num & 0xff)) / 255;
}

/**
 * Matte finish: barely-there centre light, darker edges. The shading
 * scales with how dark the base is — a flat white frame is nearly
 * uniform (a strong gradient would turn it into a glossy tube), while a
 * black frame keeps its definition.
 */
function paintMatte(ctx: CanvasRenderingContext2D, base: string, len: number, w: number) {
  const k = 0.35 + 0.65 * (1 - luminance(base));
  const g = ctx.createLinearGradient(0, 0, 0, w);
  g.addColorStop(0, `rgba(0,0,0,${0.16 * k})`);
  g.addColorStop(0.5, `rgba(255,255,255,${0.05 * k})`);
  g.addColorStop(1, `rgba(0,0,0,${0.2 * k})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, len, w);
}

/** Procedural bar finish for frames without a photo, from `spec.texture`. */
function paintProceduralBar(
  ctx: CanvasRenderingContext2D,
  spec: FrameSpecLike,
  len: number,
  w: number,
  side: number,
) {
  const rng = mulberry32(seedFromString(`${spec.label}|${side}`));
  ctx.fillStyle = spec.color;
  ctx.fillRect(0, 0, len, w);
  switch (spec.texture) {
    case "wood":
    case "oak":
    case "walnut":
    case "mahogany":
      paintWoodGrain(ctx, spec.color, len, w, rng, spec.grain ?? 0.5);
      break;
    case "gold-brushed":
    case "silver-brushed":
    case "aluminium-brushed":
      paintBrushedMetal(ctx, len, w, rng);
      break;
    case "gold-carved":
      paintGoldCarved(ctx, len, w, rng);
      break;
    case "black-gloss":
    case "yellow-gloss":
      paintGloss(ctx, len, w);
      break;
    case "black-matte":
      paintMatte(ctx, spec.color, len, w);
      break;
    default:
      paintMatte(ctx, spec.color, len, w);
      break;
  }
}

/**
 * Relief of the moulding profile, as light and shadow across the bar
 * (local coords, outer edge y = 0). Works over a photo skin and over a
 * procedural finish alike.
 */
function paintProfile(ctx: CanvasRenderingContext2D, profile: FrameSpecLike["profile"], len: number, w: number) {
  const g = ctx.createLinearGradient(0, 0, 0, w);
  switch (profile ?? "flat") {
    case "stepped": {
      // Three steps down toward the artwork: a shadowed riser and a lit
      // tread at each boundary.
      const n = 3;
      for (let i = 1; i < n; i++) {
        const y = (i / n) * w;
        const t = Math.max(1, w * 0.045);
        ctx.fillStyle = "rgba(0,0,0,0.30)";
        ctx.fillRect(0, y, len, t);
        ctx.fillStyle = "rgba(255,255,255,0.30)";
        ctx.fillRect(0, y - t, len, t);
      }
      g.addColorStop(0, "rgba(255,255,255,0.06)");
      g.addColorStop(1, "rgba(0,0,0,0.10)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, len, w);
      break;
    }
    case "rounded": {
      // Convex: light crown in the middle, dark at both edges.
      g.addColorStop(0, "rgba(0,0,0,0.26)");
      g.addColorStop(0.45, "rgba(255,255,255,0.16)");
      g.addColorStop(0.75, "rgba(255,255,255,0.05)");
      g.addColorStop(1, "rgba(0,0,0,0.30)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, len, w);
      break;
    }
    case "bevelled": {
      // 45° chamfer, lit from the outside.
      g.addColorStop(0, "rgba(255,255,255,0.30)");
      g.addColorStop(0.55, "rgba(255,255,255,0.02)");
      g.addColorStop(1, "rgba(0,0,0,0.30)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, len, w);
      break;
    }
    case "scooped": {
      // Concave: a dark channel in the middle, lit edges.
      g.addColorStop(0, "rgba(255,255,255,0.22)");
      g.addColorStop(0.3, "rgba(0,0,0,0.04)");
      g.addColorStop(0.5, "rgba(0,0,0,0.38)");
      g.addColorStop(0.7, "rgba(0,0,0,0.04)");
      g.addColorStop(1, "rgba(255,255,255,0.22)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, len, w);
      break;
    }
    default: {
      // Flat: just edge definition.
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.fillRect(0, 0, len, Math.max(1, w * 0.05));
      ctx.fillStyle = "rgba(0,0,0,0.28)";
      ctx.fillRect(0, w - Math.max(1, w * 0.05), len, Math.max(1, w * 0.05));
      break;
    }
  }
}

/** Beaded inner edge: a row of small shaded beads (not for photo frames — the photo carries them). */
function paintBeads(ctx: CanvasRenderingContext2D, spec: FrameSpecLike, len: number, w: number) {
  const r = Math.max(1, w * 0.14);
  const spacing = Math.max(4, w * 0.46);
  const cy = w - w * 0.16;
  for (let x = spacing / 2; x < len; x += spacing) {
    const g = ctx.createRadialGradient(x - r * 0.35, cy - r * 0.35, r * 0.1, x, cy, r);
    g.addColorStop(0, "rgba(255,246,220,0.95)");
    g.addColorStop(0.55, spec.color);
    g.addColorStop(1, "rgba(0,0,0,0.55)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** One carved rosette: recess shadow, six petals, bright centre, highlight crescent. */
function paintRosette(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, base: string) {
  ctx.fillStyle = "rgba(0,0,0,0.30)";
  ctx.beginPath();
  ctx.arc(x + 1, y + 1, R, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = shade(base, 45);
  for (let p = 0; p < 6; p++) {
    const a = (p / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(x + Math.cos(a) * R * 0.55, y + Math.sin(a) * R * 0.55, R * 0.3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = shade(base, 80);
  ctx.beginPath();
  ctx.arc(x, y, R * 0.3, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "rgba(0,0,0,0.35)";
  ctx.beginPath();
  ctx.arc(x, y, R * 0.14, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = "rgba(255,240,200,0.5)";
  ctx.lineWidth = Math.max(1, R * 0.1);
  ctx.beginPath();
  ctx.arc(x, y, R * 0.85, Math.PI * 0.9, Math.PI * 1.8);
  ctx.stroke();
}

/** One carved scroll: a dark curl with a bright inner line. */
function paintScroll(ctx: CanvasRenderingContext2D, x: number, y: number, R: number, base: string) {
  ctx.strokeStyle = "rgba(0,0,0,0.35)";
  ctx.lineWidth = Math.max(1, R * 0.16);
  ctx.beginPath();
  ctx.arc(x, y, R * 0.7, Math.PI * 0.2, Math.PI * 1.9);
  ctx.stroke();
  ctx.strokeStyle = shade(base, 60);
  ctx.lineWidth = Math.max(1, R * 0.12);
  ctx.beginPath();
  ctx.arc(x, y, R * 0.7, Math.PI * 0.25, Math.PI * 1.85);
  ctx.stroke();
  ctx.fillStyle = shade(base, 80);
  ctx.beginPath();
  ctx.arc(x + R * 0.45, y - R * 0.35, R * 0.18, 0, Math.PI * 2);
  ctx.fill();
}

/** Repeated ornaments along the bar centre (not for photo frames — the photo carries them). */
function paintOrnaments(
  ctx: CanvasRenderingContext2D,
  spec: FrameSpecLike,
  len: number,
  w: number,
  pxPerCm: number,
) {
  const spacingPx = Math.max(12, (spec.ornamentSpacing ?? 0.16) * 100 * pxPerCm);
  const cy = w / 2;
  const R = Math.max(3, w * 0.3);
  let i = 0;
  for (let x = spacingPx / 2; x < len; x += spacingPx, i++) {
    if (spec.ornament === "carved" && i % 2 === 1) paintScroll(ctx, x, cy, R, spec.color);
    else paintRosette(ctx, x, cy, R, spec.color);
  }
}

/** One side of a passe-partout: base colour, material feel, and the frame's shadow at its outer edge. */
function paintMatSide(
  ctx: CanvasRenderingContext2D,
  matColor: string,
  matTexture: "velvet" | "paper" | "yellow" | undefined,
  len: number,
  w: number,
  side: number,
) {
  ctx.fillStyle = matColor;
  ctx.fillRect(0, 0, len, w);
  const rng = mulberry32(seedFromString(`mat|${matColor}|${side}`));
  if (matTexture === "velvet") {
    // Velvet: soft diagonal sheen and fine nap.
    const g = ctx.createLinearGradient(0, 0, len, w);
    g.addColorStop(0, "rgba(255,255,255,0.05)");
    g.addColorStop(0.5, "rgba(0,0,0,0.02)");
    g.addColorStop(1, "rgba(0,0,0,0.08)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, len, w);
    const n = Math.round((len * w) / 500);
    for (let i = 0; i < n; i++) {
      ctx.strokeStyle = rng() > 0.5 ? "rgba(255,255,255,0.04)" : "rgba(0,0,0,0.05)";
      ctx.lineWidth = 0.7;
      const x = rng() * len;
      const y = rng() * w;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + (rng() - 0.5) * 4, y + (rng() - 0.5) * 4);
      ctx.stroke();
    }
  } else if (matTexture === "yellow") {
    paintGloss(ctx, len, w);
  } else {
    // Paper: faint fibres and a slight vertical tone.
    const n = Math.round((len * w) / 260);
    for (let i = 0; i < n; i++) {
      ctx.fillStyle = rng() > 0.5 ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.05)";
      ctx.fillRect(rng() * len, rng() * w, 1.5, 1);
    }
    const g = ctx.createLinearGradient(0, 0, 0, w);
    g.addColorStop(0, "rgba(255,255,255,0.05)");
    g.addColorStop(1, "rgba(0,0,0,0.05)");
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, len, w);
  }
  // The frame's soft shadow on the mat, at the outer edge (y = 0).
  const sh = ctx.createLinearGradient(0, 0, 0, Math.max(2, w * 0.45));
  sh.addColorStop(0, "rgba(0,0,0,0.18)");
  sh.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = sh;
  ctx.fillRect(0, 0, len, Math.max(2, w * 0.45));
}

/** One side of a thin gold trim ring: metal base with a bright centre line and dark edges. */
function paintTrimSide(ctx: CanvasRenderingContext2D, trimColor: string, len: number, w: number) {
  ctx.fillStyle = trimColor;
  ctx.fillRect(0, 0, len, w);
  const g = ctx.createLinearGradient(0, 0, 0, w);
  g.addColorStop(0, "rgba(0,0,0,0.45)");
  g.addColorStop(0.5, "rgba(255,255,255,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0.45)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, len, w);
}

/**
 * Outer shadow: darkest at the given rect's edges, fading outward over
 * `depthPx` — the shadow a floated work casts on its tray.
 */
function drawOuterShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  depthPx: number,
  strength: number,
) {
  const d = Math.max(3, depthPx);
  let g = ctx.createLinearGradient(0, y - d, 0, y);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(x - d, y - d, w + 2 * d, d);
  g = ctx.createLinearGradient(0, y + h, 0, y + h + d);
  g.addColorStop(0, `rgba(0,0,0,${strength})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x - d, y + h, w + 2 * d, d);
  g = ctx.createLinearGradient(x - d, 0, x, 0);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(x - d, y, d, h);
  g = ctx.createLinearGradient(x + w, 0, x + w + d, 0);
  g.addColorStop(0, `rgba(0,0,0,${strength})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x + w, y, d, h);
}

/**
 * Inner shadow: darkest at the given rect's edges, fading inward over
 * `depthPx` — the tray walls shading the tray floor, or a mat opening
 * shading the artwork just inside it.
 */
function drawInnerShadow(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  depthPx: number,
  strength: number,
) {
  const d = Math.max(2, depthPx);
  let g = ctx.createLinearGradient(0, y, 0, y + d);
  g.addColorStop(0, `rgba(0,0,0,${strength})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, d);
  g = ctx.createLinearGradient(0, y + h - d, 0, y + h);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(x, y + h - d, w, d);
  g = ctx.createLinearGradient(x, 0, x + d, 0);
  g.addColorStop(0, `rgba(0,0,0,${strength})`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, d, h);
  g = ctx.createLinearGradient(x + w - d, 0, x + w, 0);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, `rgba(0,0,0,${strength})`);
  ctx.fillStyle = g;
  ctx.fillRect(x + w - d, y, d, h);
}

function drawFramedArtwork(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement | null,
  art: MockupArtwork,
  cx: number,
  cy: number,
  wPx: number,
  hPx: number,
  cfg: MockupConfig,
  framePhoto: HTMLImageElement | null,
) {
  const spec = FRAME_VARIANTS[cfg.frame];
  const pxPerCm = wPx / Math.max(1, cfg.widthCm);
  const fw = framePx(spec, cfg.widthCm, pxPerCm);
  const matW = cfg.matOn ? Math.max(3, Math.min(wPx, hPx) * 0.07) : spec.mat ? Math.max(3, spec.mat.width * 100 * pxPerCm * 0.9) : 0;
  const matColor = cfg.matOn ? cfg.matColor : spec.mat?.color ?? "#f2ead8";
  // Shadow boxes float the work inside the tray: the tray gap sits between
  // the artwork and the mat, so the artwork keeps its size and the frame
  // grows by the gap — like the 3D gallery (floatGap around the work).
  const floatGapPx = spec.floatGap > 0 ? spec.floatGap * 100 * pxPerCm : 0;
  const innerW = wPx + (floatGapPx + matW) * 2;
  const innerH = hPx + (floatGapPx + matW) * 2;
  const trim = spec.trim;

  ctx.save();
  ctx.translate(cx, cy);
  if (cfg.tilt !== 0) {
    const shear = Math.tan((cfg.tilt * Math.PI) / 180) * 0.35;
    ctx.transform(1, 0, shear, 1, 0, 0);
  }

  const totalW = innerW + fw * 2;
  const totalH = innerH + fw * 2;

  // Contact shadow (soft, below and behind the frame).
  if (cfg.shadow) {
    const a = 0.28 * (cfg.shadowStrength / 100);
    ctx.save();
    ctx.filter = `blur(${Math.max(2, wPx * 0.02)}px)`;
    ctx.fillStyle = `rgba(0,0,0,${a})`;
    ctx.fillRect(-totalW / 2 + wPx * 0.02, -totalH / 2 + hPx * 0.03, totalW, totalH);
    ctx.restore();
  }

  // Tray back panel (shadow boxes).
  if (spec.trayColor) {
    ctx.fillStyle = spec.trayColor;
    ctx.fillRect(-totalW / 2, -totalH / 2, totalW, totalH);
  }
  // Frame border: real moulding, not a flat colour. The photo strip is
  // the skin when the frame carries one; otherwise a procedural finish
  // from `spec.texture`. The profile relief, beads and ornaments are
  // painted on top — except on photo frames, where the photo already
  // carries the beads and carving (same rule as the 3D gallery).
  if (fw > 0) {
    const hasPhoto = !!framePhoto && !!spec.photo;
    ctx.save();
    if (spec.texture === "acrylic") ctx.globalAlpha = spec.opacity ?? 0.4;
    paintRingSides(ctx, -totalW / 2, -totalH / 2, totalW / 2, totalH / 2, fw, (c, len, w, side) => {
      if (hasPhoto && framePhoto) paintPhotoBar(c, framePhoto, len, w);
      else paintProceduralBar(c, spec, len, w, side);
      paintProfile(c, spec.profile, len, w);
      if (spec.bead && !spec.photo) paintBeads(c, spec, len, w);
      if (spec.ornament && spec.ornament !== "none" && !spec.photo) {
        paintOrnaments(c, spec, len, w, pxPerCm);
      }
    });
    ctx.restore();
  }
  // Passe-partout, as a ring (the tray gap stays tray-coloured, not mat).
  if (matW > 0) {
    const matTexture = cfg.matOn ? undefined : spec.mat?.texture;
    paintRingSides(ctx, -innerW / 2, -innerH / 2, innerW / 2, innerH / 2, matW, (c, len, w, side) => {
      paintMatSide(c, matColor, matTexture, len, w, side);
    });
  }
  // Thin gold trim ring between frame and mat.
  if (trim && (trim.at === "mat" || trim.at === "both")) {
    const tw = Math.max(1, trim.width * 100 * pxPerCm);
    paintRingSides(ctx, -innerW / 2, -innerH / 2, innerW / 2, innerH / 2, tw, (c, len, w) => {
      paintTrimSide(c, trim.color, len, w);
    });
  }
  // Thin gold trim ring around the artwork.
  if (trim && (trim.at === "artwork" || trim.at === "both")) {
    const tw = Math.max(1, trim.width * 100 * pxPerCm);
    paintRingSides(ctx, -wPx / 2 - tw, -hPx / 2 - tw, wPx / 2 + tw, hPx / 2 + tw, tw, (c, len, w) => {
      paintTrimSide(c, trim.color, len, w);
    });
  }
  // A recessed work sits deep in its tray: the tray walls shade the tray
  // floor near the frame (darkest at the frame's inner edge).
  if (spec.recess > 0 && (spec.trayColor || floatGapPx > 0)) {
    const d = Math.max(4, spec.recess * 100 * pxPerCm * 0.5);
    drawInnerShadow(ctx, -innerW / 2, -innerH / 2, innerW, innerH, d, 0.22);
  }

  // The artwork image itself (cover-fit, centred).
  ctx.save();
  ctx.beginPath();
  ctx.rect(-wPx / 2, -hPx / 2, wPx, hPx);
  ctx.clip();
  if (img) {
    const scale = Math.max(wPx / img.naturalWidth, hPx / img.naturalHeight);
    const dw = img.naturalWidth * scale;
    const dh = img.naturalHeight * scale;
    ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  } else {
    drawPlaceholderArt(ctx, -wPx / 2, -hPx / 2, wPx, hPx, art);
  }
  // The mat opening sits in front of the artwork: its cut edge shades the
  // artwork just inside the opening.
  if (matW > 0) {
    drawInnerShadow(ctx, -wPx / 2, -hPx / 2, wPx, hPx, Math.max(3, matW * 0.18), 0.16);
  }
  // Glass reflection.
  if (cfg.glass === "clear") {
    const g = ctx.createLinearGradient(-wPx / 2, -hPx / 2, wPx / 2, hPx / 2);
    g.addColorStop(0, "rgba(255,255,255,0.20)");
    g.addColorStop(0.35, "rgba(255,255,255,0.03)");
    g.addColorStop(0.6, "rgba(255,255,255,0.10)");
    g.addColorStop(1, "rgba(255,255,255,0.02)");
    ctx.fillStyle = g;
    ctx.fillRect(-wPx / 2, -hPx / 2, wPx, hPx);
  } else if (cfg.glass === "non-reflective") {
    ctx.fillStyle = "rgba(255,255,255,0.045)";
    ctx.fillRect(-wPx / 2, -hPx / 2, wPx, hPx);
  }
  ctx.restore();
  // A floated work hovers above its tray: soft shadow hugging the work.
  if (floatGapPx > 0) {
    const d = Math.max(5, spec.recess * 100 * pxPerCm * 0.6 + 4);
    drawOuterShadow(ctx, -wPx / 2, -hPx / 2, wPx, hPx, d, 0.32);
  }
  // The mat's cut bevel: a dark line at the opening, on the mat side.
  if (matW > 0) {
    const bw = Math.max(1, matW * 0.07);
    ctx.strokeStyle = "rgba(0,0,0,0.28)";
    ctx.lineWidth = bw;
    ctx.strokeRect(-wPx / 2 - floatGapPx - bw / 2, -hPx / 2 - floatGapPx - bw / 2, wPx + floatGapPx * 2 + bw, hPx + floatGapPx * 2 + bw);
  }
  ctx.restore();
}

/** Slot offsets (in cm, relative to the arrangement centre) for each arrangement. */
function arrangementSlots(cfg: MockupConfig): { dx: number; dy: number; w: number; h: number }[] {
  const s = cfg.spacing;
  const w = cfg.widthCm;
  const h = cfg.heightCm;
  switch (cfg.arrangement) {
    case "diptych":
      return [
        { dx: -(w + s) / 2, dy: 0, w, h },
        { dx: (w + s) / 2, dy: 0, w, h },
      ];
    case "triptych":
      return [
        { dx: -(w + s), dy: 0, w, h },
        { dx: 0, dy: 0, w, h },
        { dx: w + s, dy: 0, w, h },
      ];
    case "grid":
      return [
        { dx: -(w + s) / 2, dy: -(h + s) / 2, w, h },
        { dx: (w + s) / 2, dy: -(h + s) / 2, w, h },
        { dx: -(w + s) / 2, dy: (h + s) / 2, w, h },
        { dx: (w + s) / 2, dy: (h + s) / 2, w, h },
      ];
    case "salon": {
      const small = { w: w * 0.62, h: h * 0.62 };
      return [
        { dx: 0, dy: -h * 0.35, w, h },
        { dx: -(w * 0.62 + s), dy: h * 0.42, w: small.w, h: small.h },
        { dx: w * 0.62 + s, dy: h * 0.42, w: small.w, h: small.h },
        { dx: -(w * 0.62 + s), dy: -h * 0.35, w: small.w, h: small.h },
        { dx: w * 0.62 + s, dy: -h * 0.35, w: small.w, h: small.h },
      ];
    }
    default:
      return [{ dx: 0, dy: 0, w, h }];
  }
}

type LoadedArt = { art: MockupArtwork; img: HTMLImageElement | null };

/** Full render: scene + framed artworks, at the canvas's own resolution. */
function drawMockup(
  ctx: CanvasRenderingContext2D,
  W: number,
  H: number,
  cfg: MockupConfig,
  loaded: LoadedArt[],
  scene: SceneDef,
  framePhoto: HTMLImageElement | null,
) {
  const floorY = H * 0.62;
  const wallColor = cfg.wallColor || scene.wall;
  drawWallMaterial(ctx, W, floorY, wallColor, cfg.wallMaterial);
  drawFloor(ctx, W, H, floorY, scene.floor);
  scene.draw(ctx, W, H, floorY);

  const pxPerCmX = W / WALL_WIDTH_CM;
  const pxPerCmY = floorY / WALL_HEIGHT_CM;
  const centreX = (cfg.posX / 100) * W;
  const centreY = floorY - cfg.hangCm * pxPerCmY;

  const slots = arrangementSlots(cfg);
  slots.forEach((slot, i) => {
    const entry = loaded[i];
    if (!entry) return;
    const wPx = slot.w * pxPerCmX;
    const hPx = slot.h * pxPerCmY;
    drawFramedArtwork(ctx, entry.img, entry.art, centreX + slot.dx * pxPerCmX, centreY + slot.dy * pxPerCmY, wPx, hPx, {
      ...cfg,
      widthCm: slot.w,
    }, framePhoto);
  });

  // Lighting tint + brightness.
  const tint =
    cfg.lighting === "warm"
      ? "rgba(255, 190, 110, 0.10)"
      : cfg.lighting === "cool"
        ? "rgba(140, 180, 255, 0.10)"
        : "rgba(255,255,255,0.02)";
  ctx.fillStyle = tint;
  ctx.fillRect(0, 0, W, H);
  if (cfg.brightness !== 1) {
    ctx.fillStyle = cfg.brightness > 1 ? `rgba(255,255,255,${(cfg.brightness - 1) * 0.7})` : `rgba(0,0,0,${(1 - cfg.brightness) * 0.7})`;
    ctx.fillRect(0, 0, W, H);
  }
}

// ---------------------------------------------------------------------------
// Saved mockups
// ---------------------------------------------------------------------------

type SavedMockup = {
  id: string;
  title: string;
  data: Record<string, unknown>;
  updatedAt: string;
};

async function apiListSaved(): Promise<SavedMockup[]> {
  const res = await fetch("/api/saved-work?kind=mockup");
  if (!res.ok) throw new Error("Could not load your saved mockups.");
  const json = (await res.json()) as { saved: SavedMockup[] };
  return json.saved ?? [];
}

function configFromSaved(data: Record<string, unknown>): MockupConfig {
  return { ...DEFAULT_CONFIG, ...(data as Partial<MockupConfig>) };
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function MockupStudio({
  artworks,
  initialArtworkId,
}: {
  artworks: MockupArtwork[];
  // Deep-link context (Art in Context step 5): open with this artwork
  // already on the wall instead of the first work in the library.
  initialArtworkId?: string;
}) {
  const [cfg, setCfg] = useState<MockupConfig>(() => ({
    ...DEFAULT_CONFIG,
    artworkIds:
      initialArtworkId && artworks.some((a) => a.id === initialArtworkId)
        ? [initialArtworkId]
        : artworks.length > 0
          ? [artworks[0].id]
          : [],
  }));
  const [loaded, setLoaded] = useState<LoadedArt[]>([]);
  const [imgError, setImgError] = useState<string | null>(null);
  // The real moulding photo for the selected frame (`spec.photo`), loaded
  // through the same cache as the artwork images. Null while loading, on
  // failure, or for frames without a photo — the render then falls back
  // to the procedural finish, so the preview never breaks.
  const [framePhoto, setFramePhoto] = useState<HTMLImageElement | null>(null);
  const [rendering, setRendering] = useState(false);
  const [renderMsg, setRenderMsg] = useState<string | null>(null);
  const [exportError, setExportError] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedMockup[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [saveTitle, setSaveTitle] = useState("");
  const [saveMsg, setSaveMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  // Two-step inline confirm for deleting a saved mockup (same pattern as
  // the exhibitions list): first click arms, second confirms, auto-disarms.
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [loadedId, setLoadedId] = useState<string | null>(null);
  const previewRef = useRef<HTMLCanvasElement | null>(null);
  const imgCache = useRef(new Map<string, HTMLImageElement>());

  const scene = useMemo(() => SCENES.find((s) => s.id === cfg.scene) ?? SCENES[0], [cfg.scene]);
  const needed = ARRANGEMENT_COUNT[cfg.arrangement];
  const selectedArts = useMemo(
    () => cfg.artworkIds.map((id) => artworks.find((a) => a.id === id)).filter((a): a is MockupArtwork => !!a),
    [cfg.artworkIds, artworks],
  );

  const update = useCallback((patch: Partial<MockupConfig>) => {
    setCfg((c) => ({ ...c, ...patch }));
  }, []);

  const pickArtwork = useCallback(
    (slot: number, id: string) => {
      setCfg((c) => {
        const ids = [...c.artworkIds];
        ids[slot] = id;
        return { ...c, artworkIds: ids };
      });
    },
    [],
  );

  const setArrangement = useCallback((arr: Arrangement) => {
    setCfg((c) => {
      const count = ARRANGEMENT_COUNT[arr];
      const ids = [...c.artworkIds];
      while (ids.length < count) ids.push(ids[ids.length - 1] ?? "");
      return { ...c, arrangement: arr, artworkIds: ids.slice(0, count) };
    });
  }, []);

  // Load the images for the currently selected artworks (cached, CORS-safe).
  useEffect(() => {
    let cancelled = false;
    const arts = selectedArts;
    (async () => {
      setImgError(null);
      const out: LoadedArt[] = [];
      for (const art of arts) {
        if (!art.imageUrl) {
          out.push({ art, img: null });
          continue;
        }
        const cached = imgCache.current.get(art.imageUrl);
        if (cached) {
          out.push({ art, img: cached });
          continue;
        }
        try {
          const img = await loadImage(art.imageUrl);
          imgCache.current.set(art.imageUrl, img);
          out.push({ art, img });
        } catch {
          out.push({ art, img: null });
          if (!cancelled) setImgError(`Could not load the image for “${art.title}”. The mockup uses a colour stand-in instead — check the artwork image in the editor, or export again.`);
        }
      }
      if (!cancelled) setLoaded(out);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedArts]);

  // Load the real moulding photo for the selected frame (cached, CORS-safe).
  useEffect(() => {
    let cancelled = false;
    const photo = FRAME_VARIANTS[cfg.frame].photo;
    if (!photo) {
      setFramePhoto(null);
      return;
    }
    const cached = imgCache.current.get(photo);
    if (cached) {
      setFramePhoto(cached);
      return;
    }
    loadImage(photo)
      .then((img) => {
        imgCache.current.set(photo, img);
        if (!cancelled) setFramePhoto(img);
      })
      .catch(() => {
        if (!cancelled) setFramePhoto(null);
      });
    return () => {
      cancelled = true;
    };
  }, [cfg.frame]);

  // Preview redraw.
  useEffect(() => {
    const canvas = previewRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    drawMockup(ctx, canvas.width, canvas.height, cfg, loaded, scene, framePhoto);
  }, [cfg, loaded, scene, framePhoto]);

  // Saved mockups list.
  useEffect(() => {
    let cancelled = false;
    apiListSaved()
      .then((rows) => {
        if (!cancelled) setSaved(rows);
      })
      .catch(() => {
        if (!cancelled) setSaveMsg("Could not load your saved mockups.");
      })
      .finally(() => {
        if (!cancelled) setSavedLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const refreshSaved = useCallback(async () => {
    try {
      setSaved(await apiListSaved());
    } catch {
      setSaveMsg("Could not refresh your saved mockups.");
    }
  }, []);

  // --- Export ---------------------------------------------------------------
  const doExport = useCallback(async () => {
    setExportError(null);
    setRenderMsg(null);
    setRendering(true);
    // Let the progress state paint before the heavy draw starts.
    await new Promise((r) => setTimeout(r, 60));
    try {
      const res = RESOLUTIONS[cfg.resolution];
      setRenderMsg(`Rendering ${res.label}…`);
      const canvas = document.createElement("canvas");
      canvas.width = res.w;
      canvas.height = res.h;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("This browser could not create a drawing canvas.");
      // Re-load images fresh for the export canvas (same cache, same CORS).
      const exportLoaded: LoadedArt[] = [];
      for (const entry of loaded) {
        exportLoaded.push(entry);
      }
      drawMockup(ctx, res.w, res.h, cfg, exportLoaded, scene, framePhoto);
      const mime = cfg.format === "png" ? "image/png" : cfg.format === "jpeg" ? "image/jpeg" : "image/webp";
      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, mime, 0.92));
      if (!blob) throw new Error("The export came back empty — try PNG instead.");
      const first = selectedArts[0];
      const name = `sanaa-mockup-${(first?.title ?? "artwork").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}-${cfg.scene}-${cfg.resolution}.${cfg.format === "jpeg" ? "jpg" : cfg.format}`;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      setRenderMsg(`Exported ${res.label} as ${cfg.format.toUpperCase()} — ${name}`);
    } catch (err) {
      setExportError(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setRendering(false);
    }
  }, [cfg, loaded, scene, selectedArts, framePhoto]);

  // --- Save / load ----------------------------------------------------------
  const doSave = useCallback(async () => {
    const title = saveTitle.trim() || `${selectedArts[0]?.title ?? "Mockup"} — ${scene.label}`;
    setSaving(true);
    setSaveMsg(null);
    try {
      if (loadedId) {
        const res = await fetch("/api/saved-work", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: loadedId, title, data: cfg }),
        });
        if (!res.ok) throw new Error("Could not update this mockup.");
        setSaveMsg(`Updated “${title}”.`);
      } else {
        const res = await fetch("/api/saved-work", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "mockup", title, data: cfg, artworkId: cfg.artworkIds[0] }),
        });
        if (!res.ok) throw new Error("Could not save this mockup.");
        const json = (await res.json()) as { saved: SavedMockup };
        setLoadedId(json.saved.id);
        setSaveMsg(`Saved “${title}”.`);
      }
      setSaveTitle("");
      await refreshSaved();
    } catch (err) {
      setSaveMsg(err instanceof Error ? err.message : "Could not save this mockup.");
    } finally {
      setSaving(false);
    }
  }, [saveTitle, selectedArts, scene, loadedId, cfg, refreshSaved]);

  const doLoad = useCallback((row: SavedMockup) => {
    const next = configFromSaved(row.data);
    // Only keep artwork ids that still exist.
    next.artworkIds = next.artworkIds.filter((id) => artworks.some((a) => a.id === id));
    if (next.artworkIds.length === 0 && artworks.length > 0) next.artworkIds = [artworks[0].id];
    setCfg(next);
    setLoadedId(row.id);
    setSaveTitle(row.title);
    setSaveMsg(`Loaded “${row.title}”.`);
  }, [artworks]);

  const doRename = useCallback(async (id: string) => {
    const title = renameValue.trim();
    if (!title) return;
    try {
      const res = await fetch("/api/saved-work", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title }),
      });
      if (!res.ok) throw new Error("Could not rename this mockup.");
      setRenamingId(null);
      await refreshSaved();
    } catch {
      setSaveMsg("Could not rename this mockup.");
    }
  }, [renameValue, refreshSaved]);

  const doDelete = useCallback(async (id: string, title: string) => {
    try {
      const res = await fetch(`/api/saved-work?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Could not delete this mockup.");
      if (loadedId === id) setLoadedId(null);
      setConfirmDeleteId(null);
      await refreshSaved();
      setSaveMsg(`Deleted “${title}”.`);
    } catch {
      setSaveMsg("Could not delete this mockup.");
    }
  }, [loadedId, refreshSaved]);

  const firstArt = selectedArts[0];
  const dims = firstArt ? parseDimensions(firstArt.dimensions) : { w: 100, h: 80 };

  return (
    <div className="ms-wrap">
      <style>{`
        .ms-wrap { display: flex; flex-direction: column; gap: 20px; }
        .ms-layout { display: grid; grid-template-columns: minmax(0, 1fr) 340px; gap: 20px; align-items: start; }
        @media (max-width: 900px) { .ms-layout { grid-template-columns: 1fr; } }
        .ms-preview { background: #fff; border: 1px solid #e8e2d6; border-radius: 12px; padding: 12px; }
        .ms-preview canvas { width: 100%; height: auto; display: block; border-radius: 6px; background: #f4f2ee; }
        .ms-caption { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; margin-top: 10px; font-size: 13px; color: #6b655c; }
        .ms-panel { background: #fff; border: 1px solid #e8e2d6; border-radius: 12px; padding: 16px; display: flex; flex-direction: column; gap: 16px; }
        .ms-section h3 { font-family: "Fraunces", Georgia, serif; font-size: 15px; margin: 0 0 8px; color: #1a1a1a; }
        .ms-row { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .ms-field { display: flex; flex-direction: column; gap: 4px; font-size: 13px; color: #4a4440; }
        .ms-field input[type="number"], .ms-field input[type="text"], .ms-field select { border: 1px solid #d9d4c9; border-radius: 8px; padding: 8px 10px; font-size: 14px; background: #fdfdfc; color: #1a1a1a; width: 100%; }
        .ms-field input[type="range"] { width: 100%; accent-color: #ffffff; }
        .ms-field input[type="color"] { width: 100%; height: 36px; border: 1px solid #d9d4c9; border-radius: 8px; background: #fdfdfc; padding: 2px; }
        .ms-check { display: flex; align-items: center; gap: 8px; font-size: 13px; color: #4a4440; }
        .ms-check input { accent-color: #ffffff; width: 16px; height: 16px; }
        .ms-chips { display: flex; flex-wrap: wrap; gap: 6px; }
        .ms-chip { border: 1px solid #d9d4c9; background: #fdfdfc; color: #1a1a1a; border-radius: 999px; padding: 6px 12px; font-size: 13px; cursor: pointer; }
        .ms-chip[aria-pressed="true"] { background: #1a1a1a; color: #fdfdfc; border-color: #1a1a1a; }
        .ms-scene { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
        @media (max-width: 480px) { .ms-scene { grid-template-columns: repeat(2, 1fr); } }
        .ms-scene button { border: 1px solid #d9d4c9; border-radius: 8px; padding: 0; overflow: hidden; cursor: pointer; background: #fdfdfc; text-align: left; }
        .ms-scene button[aria-pressed="true"] { border-color: #ffffff; box-shadow: 0 0 0 2px #ffffff; }
        .ms-scene .swatch { height: 34px; }
        .ms-scene span { display: block; font-size: 11px; padding: 5px 6px; color: #1a1a1a; }
        .ms-artlist { display: flex; flex-direction: column; gap: 6px; }
        .ms-art { display: flex; gap: 10px; align-items: center; border: 1px solid #e8e2d6; border-radius: 8px; padding: 6px; cursor: pointer; background: #fdfdfc; text-align: left; width: 100%; }
        .ms-art[aria-pressed="true"] { border-color: #ffffff; box-shadow: 0 0 0 1px #ffffff; }
        .ms-thumb { width: 44px; height: 44px; border-radius: 4px; flex-shrink: 0; overflow: hidden; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 10px; }
        .ms-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .ms-art strong { display: block; font-size: 13px; color: #1a1a1a; }
        .ms-art small { color: #6b655c; font-size: 12px; }
        .ms-btn { border: 1px solid #1a1a1a; background: #1a1a1a; color: #fdfdfc; border-radius: 999px; padding: 10px 18px; font-size: 14px; cursor: pointer; }
        .ms-btn:disabled { opacity: 0.5; cursor: wait; }
        .ms-btn-ghost { background: #fdfdfc; color: #1a1a1a; }
        .ms-note { font-size: 13px; color: #6b655c; margin: 0; }
        .ms-error { font-size: 13px; color: #8a2f1d; background: #fdf0ec; border: 1px solid #e8b4a6; border-radius: 8px; padding: 10px 12px; margin: 0; }
        .ms-ok { font-size: 13px; color: #2f5d3a; background: #eef6ef; border: 1px solid #bcd8c0; border-radius: 8px; padding: 10px 12px; margin: 0; }
        .ms-saved { display: flex; flex-direction: column; gap: 8px; }
        .ms-saved-item { display: flex; align-items: center; gap: 8px; border: 1px solid #e8e2d6; border-radius: 8px; padding: 8px 10px; background: #fdfdfc; }
        .ms-saved-item strong { flex: 1; font-size: 13px; color: #1a1a1a; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .ms-saved-item button { border: 1px solid #d9d4c9; background: #fff; border-radius: 6px; padding: 4px 8px; font-size: 12px; cursor: pointer; color: #1a1a1a; }
        .ms-saved-item input { flex: 1; border: 1px solid #ffffff; border-radius: 6px; padding: 4px 8px; font-size: 13px; }
        .ms-export { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; }
      `}</style>

      <div className="ms-layout">
        <div className="ms-preview">
          <canvas ref={previewRef} width={960} height={540} aria-label="Mockup preview" />
          <div className="ms-caption">
            <span>
              {firstArt ? `${firstArt.title} · ${firstArt.year} · ${firstArt.medium}` : "No artwork selected"} — {scene.label} · {scene.mood}
            </span>
            <span>Preview 960 × 540 · export renders at full resolution</span>
          </div>
          {imgError && <p className="ms-error" style={{ marginTop: 10 }}>{imgError}</p>}
        </div>

        <div className="ms-panel">
          <div className="ms-section">
            <h3>Artworks</h3>
            <div className="ms-field" style={{ marginBottom: 8 }}>
              <label htmlFor="ms-arrangement">Arrangement</label>
              <select
                id="ms-arrangement"
                value={cfg.arrangement}
                onChange={(e) => setArrangement(e.target.value as Arrangement)}
              >
                {(Object.keys(ARRANGEMENT_LABELS) as Arrangement[]).map((a) => (
                  <option key={a} value={a}>
                    {ARRANGEMENT_LABELS[a]} {a === "single" ? "" : `(${ARRANGEMENT_COUNT[a]} works)`}
                  </option>
                ))}
              </select>
            </div>
            <div className="ms-artlist">
              {Array.from({ length: needed }, (_, slot) => (
                <div key={slot}>
                  {needed > 1 && <p className="ms-note" style={{ marginBottom: 4 }}>Position {slot + 1}</p>}
                  <div className="ms-artlist">
                    {artworks.map((art) => {
                      const active = cfg.artworkIds[slot] === art.id;
                      return (
                        <button
                          key={art.id}
                          type="button"
                          className="ms-art"
                          aria-pressed={active}
                          onClick={() => pickArtwork(slot, art.id)}
                        >
                          <span className="ms-thumb" style={{ backgroundColor: art.color }}>
                            {art.imageUrl ? <img src={art.imageUrl} alt="" loading="lazy" /> : <span style={{ backgroundColor: art.accent, width: "100%", height: "100%", display: "block" }} />}
                          </span>
                          <span>
                            <strong>{art.title}</strong>
                            <small>{art.year} · {art.dimensions} · {art.exhibitionTitle}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="ms-section">
            <h3>Scene</h3>
            <div className="ms-scene">
              {SCENES.map((s) => (
                <button key={s.id} type="button" aria-pressed={cfg.scene === s.id} onClick={() => update({ scene: s.id })}>
                  <span className="swatch" style={{ background: `linear-gradient(${s.wall} 62%, ${s.floor} 62%)` }} />
                  <span>{s.label}</span>
                </button>
              ))}
            </div>
            <div className="ms-row" style={{ marginTop: 10 }}>
              <label className="ms-field">
                Wall colour
                <input type="color" value={cfg.wallColor || scene.wall} onChange={(e) => update({ wallColor: e.target.value })} />
              </label>
              <label className="ms-field">
                Wall material
                <select value={cfg.wallMaterial} onChange={(e) => update({ wallMaterial: e.target.value as WallMaterial })}>
                  {WALL_MATERIALS.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
                </select>
              </label>
            </div>
            <p className="ms-note" style={{ marginTop: 6 }}>
              Wall colour defaults to the scene&apos;s own wall. Pick a colour to repaint it.
            </p>
          </div>

          <div className="ms-section">
            <h3>Placement</h3>
            <div className="ms-row">
              <label className="ms-field">
                Width (cm)
                <input type="number" min={10} max={400} value={cfg.widthCm} onChange={(e) => update({ widthCm: Math.max(10, Number(e.target.value) || 10) })} />
              </label>
              <label className="ms-field">
                Height (cm)
                <input type="number" min={10} max={400} value={cfg.heightCm} onChange={(e) => update({ heightCm: Math.max(10, Number(e.target.value) || 10) })} />
              </label>
            </div>
            <p className="ms-note" style={{ marginTop: 6 }}>
              {firstArt ? `“${firstArt.title}” is listed as ${firstArt.dimensions}.` : ""}{" "}
              <button
                type="button"
                className="ms-btn ms-btn-ghost"
                style={{ padding: "4px 10px", fontSize: 12 }}
                onClick={() => update({ widthCm: dims.w, heightCm: dims.h })}
              >
                Use listed size ({dims.w} × {dims.h} cm)
              </button>
            </p>
            <label className="ms-field" style={{ marginTop: 10 }}>
              Wall position — {cfg.posX}%
              <input type="range" min={15} max={85} value={cfg.posX} onChange={(e) => update({ posX: Number(e.target.value) })} />
            </label>
            <label className="ms-field">
              Hanging height (centre above floor) — {cfg.hangCm} cm
              <input type="range" min={110} max={220} value={cfg.hangCm} onChange={(e) => update({ hangCm: Number(e.target.value) })} />
            </label>
            <label className="ms-field">
              Perspective tilt — {cfg.tilt}°
              <input type="range" min={-12} max={12} value={cfg.tilt} onChange={(e) => update({ tilt: Number(e.target.value) })} />
            </label>
            {needed > 1 && (
              <label className="ms-field">
                Spacing between works — {cfg.spacing} cm
                <input type="range" min={2} max={60} value={cfg.spacing} onChange={(e) => update({ spacing: Number(e.target.value) })} />
              </label>
            )}
          </div>

          <div className="ms-section">
            <h3>Frame &amp; finish</h3>
            <label className="ms-field">
              Frame
              <select value={cfg.frame} onChange={(e) => update({ frame: e.target.value as FrameVariant })}>
                {(Object.keys(FRAME_VARIANTS) as FrameVariant[]).map((f) => (
                  <option key={f} value={f}>{FRAME_VARIANTS[f].label}</option>
                ))}
              </select>
            </label>
            <label className="ms-check" style={{ marginTop: 8 }}>
              <input type="checkbox" checked={cfg.matOn} onChange={(e) => update({ matOn: e.target.checked })} />
              Matboard
            </label>
            {cfg.matOn && (
              <label className="ms-field">
                Mat colour
                <input type="color" value={cfg.matColor} onChange={(e) => update({ matColor: e.target.value })} />
              </label>
            )}
            <label className="ms-field" style={{ marginTop: 8 }}>
              Glass
              <select value={cfg.glass} onChange={(e) => update({ glass: e.target.value as Glass })}>
                <option value="none">No glass</option>
                <option value="clear">Clear glass</option>
                <option value="non-reflective">Non-reflective glass</option>
              </select>
            </label>
          </div>

          <div className="ms-section">
            <h3>Light &amp; shadow</h3>
            <div className="ms-chips" role="group" aria-label="Lighting">
              {(["warm", "cool", "daylight"] as Lighting[]).map((l) => (
                <button key={l} type="button" className="ms-chip" aria-pressed={cfg.lighting === l} onClick={() => update({ lighting: l })}>
                  {l[0].toUpperCase() + l.slice(1)}
                </button>
              ))}
            </div>
            <label className="ms-field" style={{ marginTop: 10 }}>
              Scene brightness — {Math.round(cfg.brightness * 100)}%
              <input type="range" min={60} max={130} value={Math.round(cfg.brightness * 100)} onChange={(e) => update({ brightness: Number(e.target.value) / 100 })} />
            </label>
            <label className="ms-check">
              <input type="checkbox" checked={cfg.shadow} onChange={(e) => update({ shadow: e.target.checked })} />
              Contact shadow
            </label>
            {cfg.shadow && (
              <label className="ms-field">
                Shadow strength — {cfg.shadowStrength}%
                <input type="range" min={0} max={100} value={cfg.shadowStrength} onChange={(e) => update({ shadowStrength: Number(e.target.value) })} />
              </label>
            )}
          </div>

          <div className="ms-section">
            <h3>Export</h3>
            <div className="ms-row">
              <label className="ms-field">
                Resolution
                <select value={cfg.resolution} onChange={(e) => update({ resolution: e.target.value as MockupConfig["resolution"] })}>
                  {Object.entries(RESOLUTIONS).map(([k, v]) => (
                    <option key={k} value={k}>{v.label}</option>
                  ))}
                </select>
              </label>
              <label className="ms-field">
                Format
                <select value={cfg.format} onChange={(e) => update({ format: e.target.value as ExportFormat })}>
                  <option value="png">PNG</option>
                  <option value="jpeg">JPEG</option>
                  <option value="webp">WebP</option>
                </select>
              </label>
            </div>
            <p className="ms-note" style={{ margin: "8px 0" }}>
              The export is drawn fresh at the full target resolution — never an upscaled preview.
            </p>
            <div className="ms-export">
              <button type="button" className="ms-btn" onClick={doExport} disabled={rendering || selectedArts.length === 0}>
                {rendering ? "Rendering…" : `Export ${cfg.format.toUpperCase()} · ${RESOLUTIONS[cfg.resolution].label.split(" · ")[0]}`}
              </button>
            </div>
            {renderMsg && !rendering && <p className="ms-ok" style={{ marginTop: 10 }}>{renderMsg}</p>}
            {rendering && <p className="ms-note" style={{ marginTop: 10 }}>{renderMsg ?? "Rendering…"}</p>}
            {exportError && <p className="ms-error" style={{ marginTop: 10 }}>{exportError}</p>}
          </div>

          <div className="ms-section">
            <h3>Save this mockup</h3>
            <label className="ms-field">
              Title
              <input
                type="text"
                value={saveTitle}
                placeholder={firstArt ? `${firstArt.title} — ${scene.label}` : "My mockup"}
                onChange={(e) => setSaveTitle(e.target.value)}
              />
            </label>
            <div className="ms-export" style={{ marginTop: 8 }}>
              <button type="button" className="ms-btn ms-btn-ghost" onClick={doSave} disabled={saving || selectedArts.length === 0}>
                {saving ? "Saving…" : loadedId ? "Update saved mockup" : "Save mockup"}
              </button>
              {loadedId && (
                <button
                  type="button"
                  className="ms-btn ms-btn-ghost"
                  onClick={() => {
                    setLoadedId(null);
                    setSaveTitle("");
                    setSaveMsg("Editing a new copy — saving will create a new mockup.");
                  }}
                >
                  Save as new
                </button>
              )}
            </div>
            {saveMsg && <p className="ms-ok" style={{ marginTop: 10 }}>{saveMsg}</p>}
          </div>

          <div className="ms-section">
            <h3>Saved mockups</h3>
            {savedLoading ? (
              <p className="ms-note">Loading your saved mockups…</p>
            ) : saved.length === 0 ? (
              <p className="ms-note">Nothing saved yet. Save a mockup above and it will appear here.</p>
            ) : (
              <div className="ms-saved">
                {saved.map((row) => (
                  <div key={row.id} className="ms-saved-item">
                    {renamingId === row.id ? (
                      <>
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") void doRename(row.id);
                            if (e.key === "Escape") setRenamingId(null);
                          }}
                          autoFocus
                        />
                        <button type="button" onClick={() => void doRename(row.id)}>Save</button>
                        <button type="button" onClick={() => setRenamingId(null)}>Cancel</button>
                      </>
                    ) : (
                      <>
                        <strong>{row.title}</strong>
                        <button type="button" onClick={() => doLoad(row)}>Load</button>
                        <button
                          type="button"
                          onClick={() => {
                            setRenamingId(row.id);
                            setRenameValue(row.title);
                          }}
                        >
                          Rename
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (confirmDeleteId === row.id) {
                              setConfirmDeleteId(null);
                              void doDelete(row.id, row.title);
                            } else {
                              setConfirmDeleteId(row.id);
                              window.setTimeout(
                                () => setConfirmDeleteId((current) => (current === row.id ? null : current)),
                                10000,
                              );
                            }
                          }}
                        >
                          {confirmDeleteId === row.id ? "Click again to delete" : "Delete"}
                        </button>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
