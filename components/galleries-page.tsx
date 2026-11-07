"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Footprints, PenLine, Search, Star } from "lucide-react";
import GalleryScene from "@/components/gallery-scene";
import Sidebar from "@/components/sidebar";
import ThemeToggle from "@/components/theme-toggle";
import { ceilingTextures, createGalleryRoom, floorTextures, ROOM_MODELS, roomCategories, roomLayouts, wallTextures, type RoomCategory, type RoomLayout } from "@/lib/rooms";
import type { ThumbnailKey } from "@/lib/gallery-defs";

export type GalleryPresetCard = {
  key: RoomLayout;
  label: string;
  category: RoomCategory;
  description: string;
  width: number;
  depth: number;
  height: number;
  wallColor: string;
  sideWallColor: string;
  floorColor: string;
  ceilingColor: string;
  wallTexture: keyof typeof wallTextures;
  floorTexture: keyof typeof floorTextures;
  ceilingTexture: keyof typeof ceilingTextures;
  // Which distinctive feature the preview draws on top of the finish
  // bands — each card shows its own gallery at a glance.
  thumbnail: ThumbnailKey;
};

// The room card's finish line: dimensions plus the wall and floor
// finishes.
function finishesLine(room: GalleryPresetCard): string {
  const finishes = `${wallTextures[room.wallTexture]} walls · ${floorTextures[room.floorTexture]} floor`;
  return `${room.width} × ${room.depth} m · ${room.height} m high · ${finishes}`;
}

function shadeHex(hex: string, factor: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((value >> 16) & 255) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((value >> 8) & 255) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((value & 255) * factor)));
  return `rgb(${r}, ${g}, ${b})`;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D version of the 3D surface patterns, painted with the room's real
// colours: each card preview is derived from the preset itself, not a
// stock image.
function paintPattern(
  ctx: CanvasRenderingContext2D,
  texture: keyof typeof wallTextures | keyof typeof floorTextures,
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  const dark = shadeHex(color, 0.45);
  const rand = mulberry32(7);
  if (texture === "brick") {
    const rows = 8;
    const rh = h / rows;
    for (let row = 0; row < rows; row += 1) {
      const offset = row % 2 ? -w / 8 : 0;
      for (let cx = offset; cx < w; cx += w / 4) {
        ctx.fillStyle = shadeHex(color, 0.92 + ((row + Math.round(cx)) % 3) * 0.04);
        ctx.fillRect(x + cx + 1.5, y + row * rh + 1.5, w / 4 - 3, rh - 3);
      }
    }
    ctx.fillStyle = dark;
    for (let row = 0; row <= rows; row += 1) ctx.fillRect(x, y + row * rh - 1, w, 2);
    for (let row = 0; row < rows; row += 1) {
      const offset = row % 2 ? -w / 8 : 0;
      for (let cx = offset; cx <= w; cx += w / 4) ctx.fillRect(x + cx - 1, y + row * rh, 2, rh);
    }
  } else if (texture === "concrete") {
    ctx.fillStyle = dark;
    ctx.fillRect(x, y + h / 2 - 1, w, 2);
    ctx.fillRect(x + w / 2 - 1, y, 2, h);
    ctx.fillStyle = shadeHex(color, 0.3);
    for (const gx of [0.25, 0.75]) {
      for (const gy of [0.25, 0.75]) {
        ctx.beginPath();
        ctx.arc(x + w * gx, y + h * gy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (let i = 0; i < 120; i += 1) {
      ctx.fillStyle = `rgba(0, 0, 0, ${0.04 + rand() * 0.06})`;
      ctx.fillRect(x + rand() * w, y + rand() * h, 2, 2);
    }
  } else if (texture === "wood") {
    const planks = 6;
    const ph = h / planks;
    for (let p = 0; p < planks; p += 1) {
      ctx.fillStyle = shadeHex(color, 0.9 + (p % 3) * 0.06);
      ctx.fillRect(x, y + p * ph + 1, w, ph - 2);
    }
    ctx.fillStyle = dark;
    for (let p = 0; p <= planks; p += 1) ctx.fillRect(x, y + p * ph - 1, w, 2);
  } else if (texture === "marble") {
    ctx.strokeStyle = shadeHex(color, 0.62);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 5; i += 1) {
      const sx = x + rand() * w;
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.bezierCurveTo(sx + (rand() - 0.5) * 60, y + h * 0.33, sx + (rand() - 0.5) * 60, y + h * 0.66, sx + (rand() - 0.5) * 40, y + h);
      ctx.stroke();
    }
  } else if (texture === "stone") {
    ctx.fillStyle = dark;
    ctx.fillRect(x, y + h / 2 - 1, w, 2);
    ctx.fillRect(x + w / 2 - 1, y, 2, h);
    ctx.fillStyle = shadeHex(color, 0.96);
    ctx.fillRect(x + 2, y + 2, w / 2 - 4, h / 2 - 4);
    ctx.fillStyle = shadeHex(color, 1.02);
    ctx.fillRect(x + w / 2 + 2, y + h / 2 + 2, w / 2 - 4, h / 2 - 4);
  } else {
    for (let i = 0; i < 90; i += 1) {
      ctx.fillStyle = `rgba(0, 0, 0, ${0.03 + rand() * 0.05})`;
      ctx.fillRect(x + rand() * w, y + rand() * h, 2, 2);
    }
  }
  ctx.restore();
}

function RoomPreviewCanvas({ room }: { room: GalleryPresetCard }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    // Ceiling strip, wall, floor — the room's real finishes, stacked.
    paintPattern(ctx, room.ceilingTexture, room.ceilingColor, 0, 0, w, h * 0.12);
    paintPattern(ctx, room.wallTexture, room.wallColor, 0, h * 0.12, w, h * 0.58);
    paintPattern(ctx, room.floorTexture, room.floorColor, 0, h * 0.7, w, h * 0.3);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, h * 0.7 - 1, w, 2);
    // The gallery's own trait, drawn over the bands (Sunlight keeps
    // its plain finishes — no overlay).
    paintThumbnailOverlay(ctx, room.thumbnail, w, h);
  }, [room]);
  return <canvas ref={ref} width={640} height={240} className="gallery-card-preview" aria-label={`${room.label} finishes preview`} />;
}

// The distinctive feature of each gallery, drawn procedurally over
// the finish bands so every card reads at a glance: serpentine walls,
// the glazed front with its "exhibit" sign, dark loft beams, zigzag
// screens, the round arch, the curved blue wall under a coffered
// skylight, the huge folk painting, herringbone parquet, the coffered
// skylight ceiling with its five angled panels. Canvas 640 × 240:
// ceiling 0–12%, wall 12–70%, floor 70–100%.
function paintThumbnailOverlay(ctx: CanvasRenderingContext2D, thumbnail: ThumbnailKey, w: number, h: number) {
  const wallTop = h * 0.12;
  const wallH = h * 0.58;
  const wallBottom = h * 0.7;
  const floorTop = h * 0.7;
  if (thumbnail === "sunlight") return;
  if (thumbnail === "serpentine") {
    // Four curved white walls in an S, seen from above the plaza.
    ctx.fillStyle = "#bcd6ee";
    ctx.fillRect(0, 0, w, wallTop);
    ctx.lineCap = "round";
    for (let k = 0; k < 4; k++) {
      const x0 = 60 + k * 150;
      const path = () => {
        ctx.beginPath();
        ctx.moveTo(x0, wallBottom + 8);
        ctx.bezierCurveTo(x0 + 90, wallTop + 20, x0 - 90, wallTop + wallH * 0.55, x0, wallTop + wallH - 8);
      };
      ctx.strokeStyle = "#c9c9c2";
      ctx.lineWidth = 19;
      path();
      ctx.stroke();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 14;
      path();
      ctx.stroke();
    }
    ctx.fillStyle = "#6f7176";
    ctx.fillRect(0, floorTop, w, h - floorTop);
    return;
  }
  if (thumbnail === "vitrine") {
    // Glazed front: mullions over glass, brick band and "exhibit".
    ctx.fillStyle = "#8a5a44";
    ctx.fillRect(0, wallTop, w, 14);
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(w / 2 - 90, wallTop + 22, 180, 34);
    ctx.fillStyle = "#ffffff";
    ctx.font = "bold 22px Helvetica, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("exhibit", w / 2, wallTop + 46);
    ctx.strokeStyle = "#e8e8e6";
    ctx.lineWidth = 5;
    for (let x = 40; x < w; x += 90) {
      ctx.beginPath();
      ctx.moveTo(x, wallTop + 66);
      ctx.lineTo(x, wallBottom);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(190, 215, 235, 0.35)";
    ctx.fillRect(0, wallTop + 66, w, wallBottom - wallTop - 66);
    return;
  }
  if (thumbnail === "loft") {
    // Dark loft: heavy beams under a concrete ceiling, bold colour.
    ctx.fillStyle = "#2a2724";
    ctx.fillRect(0, 0, w, wallTop + 26);
    ctx.fillStyle = "#1a1715";
    for (let x = 20; x < w; x += 110) ctx.fillRect(x, wallTop, 26, 26);
    ctx.fillStyle = "#e8c020";
    ctx.fillRect(90, wallTop + 46, 120, 84);
    ctx.fillStyle = "#c22a2a";
    ctx.fillRect(280, wallTop + 66, 90, 64);
    ctx.fillStyle = "#2f6a8a";
    ctx.fillRect(440, wallTop + 56, 110, 74);
    return;
  }
  if (thumbnail === "halle") {
    // Zigzag folding screens with works, seen in elevation.
    ctx.strokeStyle = "#3a3836";
    ctx.lineWidth = 3;
    ctx.fillStyle = "#f4f2ee";
    ctx.beginPath();
    let x = 30;
    let y = wallBottom - 10;
    ctx.moveTo(x, y);
    const peaks: [number, number][] = [];
    for (let i = 0; i < 6; i++) {
      x += 95;
      y = i % 2 === 0 ? wallTop + 18 : wallBottom - 10;
      ctx.lineTo(x, y);
      peaks.push([x, y]);
    }
    ctx.lineTo(x, wallBottom - 10);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = "#c8341e";
    ctx.fillRect(150, wallTop + 60, 44, 56);
    ctx.fillStyle = "#2a4d7a";
    ctx.fillRect(330, wallTop + 46, 44, 56);
    ctx.fillStyle = "#e8c020";
    ctx.fillRect(480, wallTop + 66, 40, 50);
    return;
  }
  if (thumbnail === "arche") {
    // The round arch in the stone dividing wall.
    ctx.fillStyle = "#b8ab94";
    ctx.fillRect(0, wallTop, w, wallH);
    ctx.fillStyle = "#8f8672";
    ctx.beginPath();
    ctx.arc(w / 2, wallBottom - 6, 74, Math.PI, 0);
    ctx.lineTo(w / 2 + 74, wallBottom);
    ctx.lineTo(w / 2 - 74, wallBottom);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#efe9dc";
    ctx.beginPath();
    ctx.arc(w / 2, wallBottom - 6, 58, Math.PI, 0);
    ctx.lineTo(w / 2 + 58, wallBottom);
    ctx.lineTo(w / 2 - 58, wallBottom);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#4a3528";
    ctx.fillRect(40, wallTop + 16, w - 80, 8);
    return;
  }
  if (thumbnail === "musee") {
    // Curved blue wall under a coffered skylight.
    ctx.fillStyle = "#f3f1ed";
    ctx.fillRect(0, 0, w, wallTop);
    ctx.strokeStyle = "#7a6755";
    ctx.lineWidth = 2;
    for (let x = 0; x < w; x += 46) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, wallTop);
      ctx.stroke();
    }
    for (let y = 0; y < wallTop; y += 12) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }
    ctx.fillStyle = "#7f9db8";
    ctx.beginPath();
    ctx.moveTo(0, wallBottom);
    ctx.quadraticCurveTo(w / 2, wallTop - 30, w, wallBottom);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#f2ede4";
    ctx.fillRect(w / 2 - 60, wallTop + 66, 120, 62);
    ctx.fillStyle = "#2a4d7a";
    ctx.fillRect(w / 2 - 48, wallTop + 76, 96, 42);
    return;
  }
  if (thumbnail === "claire-voie") {
    // The huge folk painting on a dark floor.
    ctx.fillStyle = "#f1efea";
    ctx.fillRect(0, wallTop, w, wallH);
    ctx.fillStyle = "#e8a020";
    ctx.fillRect(60, wallTop + 24, w - 120, wallH - 48);
    ctx.fillStyle = "#c22a2a";
    ctx.beginPath();
    ctx.arc(170, wallTop + 78, 34, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#2f6a2a";
    ctx.fillRect(280, wallTop + 60, 120, 60);
    ctx.fillStyle = "#1a1a1a";
    ctx.font = "bold 15px Helvetica, Arial, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText("TITRE DE L'EXPOSITION", 60, wallTop + 118);
    ctx.fillStyle = "#3e4044";
    ctx.fillRect(0, floorTop, w, h - floorTop);
    return;
  }
  if (thumbnail === "parquet") {
    // Herringbone parquet across the floor band.
    ctx.fillStyle = "#c59c63";
    ctx.fillRect(0, floorTop, w, h - floorTop);
    ctx.strokeStyle = "rgba(90, 55, 25, 0.55)";
    ctx.lineWidth = 2;
    const s = 26;
    for (let row = 0; row < 3; row++) {
      const y = floorTop + row * s;
      for (let x = -s; x < w + s; x += s * 2) {
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + s, y + s);
        ctx.moveTo(x + s, y);
        ctx.lineTo(x + 2 * s, y + s);
        ctx.stroke();
      }
    }
    // V partitions + salon hang on the back wall.
    ctx.fillStyle = "#f4f2ee";
    ctx.beginPath();
    ctx.moveTo(180, wallBottom);
    ctx.lineTo(300, wallTop + 30);
    ctx.lineTo(420, wallBottom);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#b78450";
    ctx.lineWidth = 6;
    ctx.beginPath();
    ctx.moveTo(180, wallBottom);
    ctx.lineTo(300, wallTop + 30);
    ctx.lineTo(420, wallBottom);
    ctx.stroke();
    ctx.fillStyle = "#1a1a1a";
    ctx.fillRect(240, wallTop + 52, 40, 48);
    ctx.fillStyle = "#c8341e";
    ctx.fillRect(320, wallTop + 62, 34, 40);
    return;
  }
  if (thumbnail === "verriere") {
    // Coffered skylight ceiling and five angled panels.
    ctx.fillStyle = "#f3f1ed";
    ctx.fillRect(0, 0, w, wallTop);
    ctx.strokeStyle = "#7c6e5d";
    ctx.lineWidth = 3;
    for (let x = 0; x < w; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, wallTop);
      ctx.stroke();
    }
    ctx.fillStyle = "rgba(190, 215, 235, 0.6)";
    for (let x = 8; x < w; x += 128) ctx.fillRect(x, 4, 48, wallTop - 8);
    const colors = ["#2e4a62", "#d2a64a", "#7a7d4f", "#1a1a1a", "#b34a34"];
    for (let i = 0; i < 5; i++) {
      const x = 56 + i * 112;
      ctx.save();
      ctx.translate(x, wallTop + 74);
      ctx.rotate(i % 2 === 0 ? -0.08 : 0.08);
      ctx.fillStyle = "#f5f3ee";
      ctx.fillRect(-34, -52, 68, 104);
      ctx.fillStyle = colors[i];
      ctx.fillRect(-22, -34, 44, 44);
      ctx.restore();
    }
    return;
  }
  if (thumbnail === "pavillon") {
    // Glass-brick pavilion under a blue sky, palms and a lawn.
    ctx.fillStyle = "#9cc3e6";
    ctx.fillRect(0, 0, w, wallTop + 40);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(140, 40, 90, 22, 0, 0, Math.PI * 2);
    ctx.ellipse(430, 30, 110, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    // Glass-brick walls: a glowing grid.
    ctx.fillStyle = "#dfe9ee";
    ctx.fillRect(150, wallTop + 20, w - 300, wallH - 20);
    ctx.strokeStyle = "rgba(120, 140, 150, 0.7)";
    ctx.lineWidth = 2;
    for (let x = 150; x <= w - 150; x += 30) {
      ctx.beginPath();
      ctx.moveTo(x, wallTop + 20);
      ctx.lineTo(x, wallBottom);
      ctx.stroke();
    }
    for (let y = wallTop + 20; y <= wallBottom; y += 26) {
      ctx.beginPath();
      ctx.moveTo(150, y);
      ctx.lineTo(w - 150, y);
      ctx.stroke();
    }
    // Side rooms with a painting each.
    ctx.fillStyle = "#f4f2ee";
    ctx.fillRect(30, wallTop + 46, 100, wallH - 66);
    ctx.fillRect(w - 130, wallTop + 46, 100, wallH - 66);
    ctx.fillStyle = "#2a4fa0";
    ctx.fillRect(56, wallTop + 66, 48, 60);
    ctx.fillStyle = "#f2c230";
    ctx.fillRect(66, wallTop + 76, 28, 28);
    ctx.fillStyle = "#4a7a4a";
    ctx.fillRect(w - 104, wallTop + 66, 48, 60);
    // Palms.
    ctx.strokeStyle = "#3f7a2c";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    for (const [px, py] of [[60, wallTop + 30], [w - 60, wallTop + 30]] as const) {
      for (let a = -0.9; a <= 0.9; a += 0.45) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + Math.sin(a) * 46, py - 44, px + Math.sin(a) * 66, py - 58);
        ctx.stroke();
      }
    }
    ctx.fillStyle = "#4d6b3a";
    ctx.fillRect(0, floorTop, w, h - floorTop);
    return;
  }
  if (thumbnail === "classique") {
    // Coffered vault over granite columns, skylight glow.
    ctx.fillStyle = "#2a2724";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#cfc8b8";
    ctx.beginPath();
    ctx.moveTo(40, wallBottom);
    ctx.quadraticCurveTo(w / 2, wallTop - 46, w - 40, wallBottom);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = "#8a857c";
    ctx.lineWidth = 2;
    for (let x = 90; x < w - 60; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, wallTop + 10);
      ctx.lineTo(x, wallBottom - 6);
      ctx.stroke();
    }
    ctx.fillStyle = "#fff3de";
    ctx.beginPath();
    ctx.ellipse(w / 2, wallTop + 6, 70, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#e3ddd0";
    for (const x of [120, 300, 480]) ctx.fillRect(x - 9, wallTop + 56, 18, wallBottom - wallTop - 56);
    ctx.fillStyle = "#8a3a1c";
    ctx.fillRect(180, wallTop + 76, 54, 66);
    ctx.fillStyle = "#c9863a";
    ctx.fillRect(370, wallTop + 76, 54, 66);
    return;
  }
  if (thumbnail === "atrium-blanc") {
    // White atrium, black drum suspended, light rays.
    ctx.fillStyle = "#f7f7f6";
    ctx.fillRect(0, 0, w, wallBottom);
    ctx.fillStyle = "#e8e8e6";
    for (let x = 0; x < w; x += 44) ctx.fillRect(x, 0, 1, wallBottom);
    ctx.fillStyle = "#151515";
    ctx.beginPath();
    ctx.ellipse(w / 2, wallTop + 44, 150, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.8)";
    ctx.lineWidth = 1.5;
    for (let x = w / 2 - 120; x <= w / 2 + 120; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, wallTop + 66);
      ctx.lineTo(x + 8, wallBottom - 8);
      ctx.stroke();
    }
    ctx.fillStyle = "#f6f6f5";
    ctx.fillRect(0, floorTop, w, h - floorTop);
    ctx.fillStyle = "rgba(21, 21, 21, 0.35)";
    ctx.beginPath();
    ctx.ellipse(w / 2, floorTop + 14, 150, 10, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#fafafa";
    for (const x of [110, 490]) ctx.fillRect(x - 12, wallTop + 80, 24, wallBottom - wallTop - 80);
    return;
  }
  if (thumbnail === "patio") {
    // Oval roof opening, trees, black gravel disc.
    ctx.fillStyle = "#dedee0";
    ctx.fillRect(0, 0, w, wallTop + 30);
    ctx.fillStyle = "#7fb3e6";
    ctx.beginPath();
    ctx.ellipse(w / 2, wallTop + 14, 170, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f0f0ee";
    ctx.fillRect(0, wallTop + 30, w, wallH - 30);
    ctx.fillStyle = "#1c1c1e";
    ctx.beginPath();
    ctx.ellipse(w / 2, wallBottom - 16, 190, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4a8f36";
    ctx.beginPath();
    ctx.ellipse(w / 2 + 60, wallBottom - 20, 70, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#3f7a2c";
    for (const [tx, ty, tr] of [[170, wallTop + 74, 34], [300, wallTop + 58, 40], [430, wallTop + 78, 30]] as const) {
      ctx.beginPath();
      ctx.arc(tx, ty, tr, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#6b5a45";
      ctx.fillRect(tx - 3, ty, 6, wallBottom - ty - 24);
      ctx.fillStyle = "#3f7a2c";
    }
    return;
  }
  if (thumbnail === "escalier") {
    // Stair hall: steps climbing left, column, big painting right.
    ctx.fillStyle = "#f6f6f4";
    ctx.fillRect(0, 0, w, wallBottom);
    ctx.fillStyle = "#2a2c30";
    let sx = 60;
    let sy = wallBottom - 12;
    for (let i = 0; i < 7; i++) {
      ctx.fillRect(sx, sy - 16, 52, 16);
      sx += 52;
      sy -= 16;
    }
    ctx.fillStyle = "#f6f6f4";
    ctx.fillRect(430, wallTop + 10, 130, 24);
    ctx.fillStyle = "#e8e2d0";
    ctx.fillRect(400, wallTop + 46, 170, 90);
    ctx.fillStyle = "#f2b02a";
    ctx.fillRect(420, wallTop + 62, 50, 58);
    ctx.fillStyle = "#e0572a";
    ctx.fillRect(490, wallTop + 62, 50, 58);
    ctx.fillStyle = "#6d7078";
    ctx.fillRect(0, floorTop, w, h - floorTop);
    ctx.fillStyle = "#f6f6f4";
    ctx.fillRect(300, wallTop + 30, 20, wallBottom - wallTop - 30);
    return;
  }
  if (thumbnail === "salles-vertes") {
    // Green walls, vault, skylight strip, panels.
    ctx.fillStyle = "#3d6b5e";
    ctx.fillRect(0, 0, w, wallBottom);
    ctx.fillStyle = "#e6e1d6";
    ctx.beginPath();
    ctx.moveTo(0, wallTop + 26);
    ctx.quadraticCurveTo(w / 2, wallTop - 34, w, wallTop + 26);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(w / 2 - 90, wallTop + 2, 180, 8);
    ctx.fillStyle = "#d4b48a";
    ctx.fillRect(0, floorTop, w, h - floorTop);
    ctx.strokeStyle = "rgba(90, 55, 25, 0.5)";
    ctx.lineWidth = 2;
    for (let x = -20; x < w; x += 40) {
      ctx.beginPath();
      ctx.moveTo(x, floorTop);
      ctx.lineTo(x + 20, h);
      ctx.stroke();
    }
    for (const [px, col] of [[150, "#8a3a1c"], [300, "#c9863a"], [450, "#3a4a5a"]] as const) {
      ctx.fillStyle = "#f5f3ee";
      ctx.fillRect(px - 34, wallTop + 56, 68, 88);
      ctx.fillStyle = col;
      ctx.fillRect(px - 22, wallTop + 68, 44, 52);
    }
    return;
  }
  if (thumbnail === "couloir-sombre") {
    // Dark corridor in perspective, warm panels, arches, track lights.
    ctx.fillStyle = "#151413";
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = "#24201c";
    ctx.beginPath();
    ctx.moveTo(w / 2 - 60, wallTop + 10);
    ctx.lineTo(w / 2 + 60, wallTop + 10);
    ctx.lineTo(w - 40, wallBottom);
    ctx.lineTo(40, wallBottom);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#8d877d";
    ctx.beginPath();
    ctx.moveTo(w / 2 - 60, wallTop + 10);
    ctx.lineTo(w / 2 + 60, wallTop + 10);
    ctx.lineTo(w / 2 + 60, wallTop + 46);
    ctx.lineTo(w / 2 - 60, wallTop + 46);
    ctx.closePath();
    ctx.fill();
    for (const [px, pw, col] of [[90, 46, "#8a3a1c"], [220, 40, "#c9863a"], [350, 40, "#3a4a5a"], [470, 46, "#d8c9a8"]] as const) {
      ctx.fillStyle = col;
      ctx.fillRect(px, wallTop + 66, pw, 56);
    }
    ctx.fillStyle = "#fff2d0";
    for (let x = 60; x < w; x += 90) {
      ctx.beginPath();
      ctx.arc(x, wallTop + 40, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = "#1b1815";
    ctx.lineWidth = 5;
    for (const x of [150, 450]) {
      ctx.beginPath();
      ctx.arc(x, wallBottom - 10, 26, Math.PI, 0);
      ctx.stroke();
    }
    return;
  }
  if (thumbnail === "couloir-dore") {
    // Golden corridor: arched windows glowing, red end wall, sun patches.
    ctx.fillStyle = "#f3efe6";
    ctx.fillRect(0, 0, w, wallBottom);
    ctx.fillStyle = "#9b2a24";
    ctx.fillRect(w / 2 - 60, wallTop + 20, 120, wallH - 20);
    ctx.fillStyle = "#fff6e0";
    for (const x of [90, 210, 390, 510]) {
      ctx.beginPath();
      ctx.moveTo(x - 26, wallBottom - 8);
      ctx.lineTo(x - 26, wallTop + 66);
      ctx.arc(x, wallTop + 66, 26, Math.PI, 0);
      ctx.lineTo(x + 26, wallBottom - 8);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = "#e8dcc8";
    ctx.lineWidth = 3;
    for (const x of [90, 210, 390, 510]) {
      ctx.beginPath();
      ctx.moveTo(x - 26, wallBottom - 8);
      ctx.lineTo(x - 26, wallTop + 66);
      ctx.arc(x, wallTop + 66, 26, Math.PI, 0);
      ctx.lineTo(x + 26, wallBottom - 8);
      ctx.stroke();
    }
    ctx.fillStyle = "#c9a877";
    ctx.fillRect(0, floorTop, w, h - floorTop);
    ctx.fillStyle = "rgba(255, 240, 176, 0.55)";
    for (const [fx, fy] of [[120, floorTop + 10], [300, floorTop + 26], [450, floorTop + 8]] as const)
      ctx.fillRect(fx, fy, 110, 16);
    return;
  }
  if (thumbnail === "voutes") {
    // Scale-pattern ceiling, wood floor, two panels, gold sphere.
    ctx.fillStyle = "#f8f8f6";
    ctx.fillRect(0, 0, w, wallBottom);
    ctx.fillStyle = "#d6d1c5";
    ctx.fillRect(0, 0, w, wallTop + 8);
    ctx.fillStyle = "#ffffff";
    for (let x = 20; x < w; x += 64) {
      ctx.beginPath();
      ctx.arc(x, wallTop + 8, 28, Math.PI, 0);
      ctx.fill();
    }
    ctx.fillStyle = "#d4b48a";
    ctx.fillRect(0, floorTop, w, h - floorTop);
    for (const [px, col] of [[190, "#e0572a"], [410, "#f2c230"]] as const) {
      ctx.fillStyle = "#f4f4f0";
      ctx.fillRect(px - 36, wallTop + 54, 72, 84);
      ctx.fillStyle = col;
      ctx.fillRect(px - 24, wallTop + 66, 48, 50);
    }
    ctx.fillStyle = "#e8d9b4";
    ctx.beginPath();
    ctx.ellipse(w / 2, wallTop + 96, 26, 34, 0, 0, Math.PI * 2);
    ctx.fill();
    return;
  }
  if (thumbnail === "courbes") {
    // Circular gallery: the curved white wall, glazed section, palms.
    ctx.fillStyle = "#a9d4ea";
    ctx.fillRect(0, 0, w, wallTop + 30);
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.ellipse(150, 36, 90, 20, 0, 0, Math.PI * 2);
    ctx.ellipse(440, 26, 100, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#f4f4f2";
    ctx.beginPath();
    ctx.moveTo(0, wallBottom);
    ctx.quadraticCurveTo(w / 2, wallTop - 40, w, wallBottom);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "rgba(160, 200, 220, 0.85)";
    ctx.beginPath();
    ctx.moveTo(w - 190, wallBottom);
    ctx.quadraticCurveTo(w - 60, wallTop + 10, w, wallTop + 60);
    ctx.lineTo(w, wallBottom);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = "#24272b";
    ctx.beginPath();
    ctx.ellipse(w / 2, floorTop + 26, 240, 22, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = "#3f7a2c";
    ctx.lineWidth = 5;
    ctx.lineCap = "round";
    for (const [px, py] of [[70, wallTop + 44], [w - 70, wallTop + 44]] as const) {
      for (let a = -0.9; a <= 0.9; a += 0.45) {
        ctx.beginPath();
        ctx.moveTo(px, py);
        ctx.quadraticCurveTo(px + Math.sin(a) * 40, py - 36, px + Math.sin(a) * 56, py - 48);
        ctx.stroke();
      }
    }
    return;
  }
  if (thumbnail === "atrium-lattes") {
    // Slatted atrium: slat lines, a large garden window, mezzanine.
    ctx.fillStyle = "#f8f8f6";
    ctx.fillRect(0, 0, w, wallBottom);
    ctx.strokeStyle = "rgba(120, 120, 125, 0.4)";
    ctx.lineWidth = 1;
    for (let x = 0; x < w; x += 12) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, wallBottom);
      ctx.stroke();
    }
    // The garden window.
    ctx.fillStyle = "#7fb3e6";
    ctx.fillRect(w / 2 - 130, wallTop + 16, 260, wallH - 40);
    ctx.fillStyle = "#3f7a2c";
    ctx.beginPath();
    ctx.arc(w / 2 - 70, wallTop + 100, 44, 0, Math.PI * 2);
    ctx.arc(w / 2 + 60, wallTop + 110, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#4d6b3a";
    ctx.fillRect(w / 2 - 130, wallTop + 118, 260, wallH - 142);
    ctx.strokeStyle = "#f8f8f6";
    ctx.lineWidth = 4;
    for (let x = w / 2 - 130; x <= w / 2 + 130; x += 43) {
      ctx.beginPath();
      ctx.moveTo(x, wallTop + 16);
      ctx.lineTo(x, wallBottom - 24);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.moveTo(w / 2 - 130, wallTop + 76);
    ctx.lineTo(w / 2 + 130, wallTop + 76);
    ctx.stroke();
    // Mezzanine + staircases.
    ctx.fillStyle = "#e6eaec";
    ctx.fillRect(60, wallTop + 96, 130, 16);
    ctx.fillStyle = "#55585c";
    for (let i = 0; i < 5; i++) ctx.fillRect(60 + i * 14, wallBottom - 14 - i * 10, 40, 6);
    for (let i = 0; i < 5; i++) ctx.fillRect(w - 100 - i * 14, wallBottom - 14 - i * 10, 40, 6);
    ctx.fillStyle = "#d4b48a";
    ctx.fillRect(0, floorTop, w, h - floorTop);
    return;
  }
}

export default function GalleriesPage({
  rooms,
  user,
  ownExhibitionCount,
}: {
  rooms: GalleryPresetCard[];
  user: { id: string; name: string; email: string; isAdmin?: boolean } | null;
  ownExhibitionCount: number;
}) {
  const [selected, setSelected] = useState<RoomLayout>("sunlight");
  const [opening, setOpening] = useState<RoomLayout | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [walking, setWalking] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | "Favourites" | RoomCategory>("All");
  const [favourites, setFavourites] = useState<RoomLayout[]>([]);

  // Favourites live in this browser only (localStorage) — the same
  // pattern as the Contacts tool. They do not sync to the account.
  const FAVOURITES_KEY = "sanaa:favourite-galleries";
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FAVOURITES_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setFavourites(parsed.filter((key): key is RoomLayout => typeof key === "string" && key in roomLayouts));
      }
    } catch {
      // A corrupt stored list just means no favourites yet.
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(FAVOURITES_KEY, JSON.stringify(favourites));
    } catch {
      // Private browsing or a full store: favourites just won't persist.
    }
  }, [favourites]);

  function toggleFavourite(layout: RoomLayout) {
    setFavourites((current) =>
      current.includes(layout) ? current.filter((key) => key !== layout) : [...current, layout],
    );
  }

  const filteredRooms = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rooms.filter((room) => {
      if (category === "Favourites" && !favourites.includes(room.key)) return false;
      if (category !== "All" && category !== "Favourites" && room.category !== category) return false;
      if (needle && ![room.label, room.description, room.category].join(" ").toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rooms, query, category, favourites]);
  const movementKeys = useRef(new Set<string>());
  const viewerRef = useRef<HTMLDivElement>(null);
  const selectedRoom = rooms.find((room) => room.key === selected) ?? rooms[0];
  const viewerRoom = useMemo(() => createGalleryRoom(0, selected), [selected]);

  function viewIn3D(layout: RoomLayout) {
    setWalking(false);
    setSelected(layout);
    viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Existing flow, unchanged: create an exhibition, give its first room
  // this layout, then open the editor. Signed-out visitors go to /login.
  // The model is passed to the create call, so the API seeds exactly
  // what the Create flow seeds — for Sunlight, the one room with its
  // four artworks. No PUT follows: it would overwrite the seeded room
  // with a blank room and no artworks.
  async function openInEditor(layout: RoomLayout) {
    setOpening(layout);
    setOpenError(null);
    try {
      const model = ROOM_MODELS.find((candidate) => candidate.layout === layout)?.id;
      const createResponse = await fetch("/api/exhibitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The title is mandatory (feature 7): the room's own label names
        // the show.
        body: JSON.stringify({ title: roomLayouts[layout].label, model }),
      });
      if (createResponse.status === 401) {
        window.location.assign("/login");
        return;
      }
      const created = await createResponse.json();
      if (!createResponse.ok) throw new Error(created.error ?? "Could not create an exhibition.");
      window.location.assign(`/editor/${created.exhibition.id}`);
    } catch (error) {
      console.error("Could not open this room in the editor.", error);
      setOpenError(error instanceof Error ? error.message : "Could not open this room in the editor.");
      setOpening(null);
    }
  }

  // The models only — the same content in both shells: a live 3D preview
  // plus the room cards, with category filters, search and favourites.
  // Nothing else lives on this page.
  const galleriesContent = (
    <>
      <section className="galleries-intro">
        <p className="eyebrow">{rooms.length} ROOMS · ONE COLLECTION</p>
        <h1>Galleries<span className="title-period">.</span></h1>
        <p>{rooms.length} gallery rooms, each with its own light, walls and floor. Pick one to walk through, or open it in the editor and hang your work.</p>
      </section>

      {openError && (
        <div className="editor-error-banner" role="alert">
          <span>{openError}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setOpenError(null)}>
            ×
          </button>
        </div>
      )}

      <section className="galleries-viewer" ref={viewerRef}>
        <div className="galleries-viewer-head">
          <div>
            <span className="panel-kicker">LIVE 3D PREVIEW</span>
            <h2>{selectedRoom.label}</h2>
            <p>{finishesLine(selectedRoom)}</p>
          </div>
          <button className="galleries-open-button" onClick={() => void openInEditor(selected)} disabled={opening !== null}>
            <PenLine size={15} /> {opening === selected ? "Opening…" : "Open in editor"}
          </button>
          <button
            className="galleries-open-button"
            onClick={() => toggleFavourite(selected)}
            aria-label={favourites.includes(selected) ? `Remove ${selectedRoom.label} from favourites` : `Save ${selectedRoom.label} as a favourite`}
            aria-pressed={favourites.includes(selected)}
            style={{ background: "transparent", color: "var(--ink)", border: "1px solid var(--line)" }}
          >
            <Star size={15} fill={favourites.includes(selected) ? "currentColor" : "none"} /> {favourites.includes(selected) ? "Saved" : "Save"}
          </button>
          <button className="galleries-open-button" onClick={() => setWalking((value) => !value)} aria-label="Walk through this room">
            <Footprints size={15} /> {walking ? "Exit walk" : "Walk through"}
          </button>
        </div>
        <div className="galleries-viewer-stage">
          <GalleryScene artworks={[]} room={viewerRoom} rooms={[viewerRoom]} activeRoomId={viewerRoom.id} className="galleries-viewer-canvas" interior walkMode={walking} walking={walking} input={walking ? movementKeys : undefined} />
        </div>
        <p className="galleries-viewer-hint">{walking ? "Walk mode · Click the floor to walk · WASD to move · Drag to look" : "Inside the room · Drag to look around · Scroll to zoom"}</p>
      </section>

      <section aria-label="Find a gallery" style={{ maxWidth: 1350, margin: "28px auto 0", padding: "0 44px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--line)", borderRadius: 8, padding: "0 12px", minHeight: 40, flex: "1 1 240px", maxWidth: 340, background: "var(--surface-3)" }}>
            <Search size={15} style={{ color: "var(--muted)", flexShrink: 0 }} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search galleries…"
              aria-label="Search galleries by name or description"
              style={{ border: 0, outline: "none", background: "transparent", font: "inherit", fontSize: 13, width: "100%", color: "inherit" }}
            />
          </label>
          <div role="group" aria-label="Filter by category" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["All", "Favourites", ...roomCategories] as const).map((chip) => {
              const active = category === chip;
              const count = chip === "All" ? rooms.length : chip === "Favourites" ? favourites.length : rooms.filter((room) => room.category === chip).length;
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setCategory(chip)}
                  aria-pressed={active}
                  style={{
                    minHeight: 34,
                    padding: "0 13px",
                    borderRadius: 999,
                    border: "1px solid var(--line)",
                    background: active ? "var(--ink)" : "transparent",
                    color: active ? "var(--paper)" : "inherit",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {chip === "Favourites" ? `★ Favourites (${count})` : `${chip} (${count})`}
                </button>
              );
            })}
          </div>
        </div>
        <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 11 }}>
          {filteredRooms.length === rooms.length
            ? `Showing all ${rooms.length} rooms.`
            : `Showing ${filteredRooms.length} of ${rooms.length} rooms.`}{" "}
          Favourites are saved in this browser only — they do not sync to your account yet.
        </p>
      </section>

      <section className="galleries-grid">
        {filteredRooms.map((room) => (
          <article key={room.key} className={`gallery-card${room.key === selected ? " selected" : ""}`}>
            <button className="gallery-card-preview-button" onClick={() => viewIn3D(room.key)} aria-label={`Preview ${room.label} in 3D`}>
              <RoomPreviewCanvas room={room} />
            </button>
            <div className="gallery-card-body">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <p style={{ margin: "0 0 2px", color: "var(--accent)", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>{room.category}</p>
                  <h3>{room.label}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFavourite(room.key)}
                  aria-label={favourites.includes(room.key) ? `Remove ${room.label} from favourites` : `Save ${room.label} as a favourite`}
                  aria-pressed={favourites.includes(room.key)}
                  title={favourites.includes(room.key) ? "Remove from favourites" : "Save as favourite"}
                  style={{ background: "transparent", border: 0, padding: 2, cursor: "pointer", color: favourites.includes(room.key) ? "var(--accent)" : "var(--muted)", flexShrink: 0 }}
                >
                  <Star size={17} fill={favourites.includes(room.key) ? "currentColor" : "none"} />
                </button>
              </div>
              <p style={{ marginTop: 4, lineHeight: 1.5 }}>{room.description}</p>
              <p className="gallery-card-finishes" style={{ marginTop: 6 }}>{finishesLine(room)}</p>
              <div className="gallery-card-actions">
                <button onClick={() => viewIn3D(room.key)}><Eye size={14} /> View in 3D</button>
                <button className="gallery-card-open" onClick={() => void openInEditor(room.key)} disabled={opening !== null}>
                  <PenLine size={14} /> {opening === room.key ? "Opening…" : "Open in editor"}
                </button>
              </div>
            </div>
          </article>
        ))}
        {filteredRooms.length === 0 && (
          <div style={{ gridColumn: "1 / -1", border: "1px solid var(--line)", borderRadius: 12, padding: "32px 20px", textAlign: "center" }}>
            <p style={{ margin: 0, fontWeight: 600 }}>No galleries match that search.</p>
            <p style={{ margin: "6px 0 14px", color: "var(--muted)", fontSize: 12 }}>
              {category === "Favourites" ? "You have not saved any favourites yet — tap the star on a room to save it here." : "Try a different word, or clear the filters."}
            </p>
            <button
              type="button"
              onClick={() => { setQuery(""); setCategory("All"); }}
              style={{ minHeight: 36, padding: "0 16px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--ink)", color: "var(--paper)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>
    </>
  );

  if (!user) {
    return (
      <main className="galleries-page">
        <header className="galleries-header">
          <Link className="brand-lockup" href="/">
            <span className="brand-mark">s.</span>
            <span className="brand-name">SANAA</span>
          </Link>
          <nav className="galleries-nav">
            <Link href="/">Workspace</Link>
            <Link href="/login" className="galleries-signin">Sign in</Link>
          </nav>
        </header>

        {galleriesContent}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Sidebar user={user} active="galleries" exhibitionCount={ownExhibitionCount} />

      <section className="dashboard-main">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>Galleries</strong></div>
          <div className="topbar-actions">
            <ThemeToggle />
            {/* Phase 8: the Search / Notifications / Help buttons were
                dead — no handler, no backend — so they were removed.
                The working exhibition search is on the dashboard. */}
          </div>
        </header>

        <div className="dashboard-content">{galleriesContent}</div>
      </section>
    </main>
  );
}
