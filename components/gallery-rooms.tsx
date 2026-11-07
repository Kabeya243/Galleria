// The twenty galleries added in November 2026 — their 3D shells,
// ported line by line from Kabeya's Three.js reference files (nine
// from six files, eleven from Galeries_3D.html). The Sunlight Gallery
// is NOT here: it keeps its own JSX shell in
// components/gallery-scene.tsx, untouched.
//
// Each builder returns a plain three.js Group in ROOM-LOCAL
// coordinates (exactly as in its source file), plus an optional
// per-frame tick (only La Halle's mobile rotates). GenericRoom in
// gallery-scene.tsx mounts the group with <primitive/> and renders
// the SANAA systems (artworks, Asset Library elements, grid,
// measure, curatorial text) around it. The shells bring their own
// lights, exactly as their sources do — there is no shared Sunlight
// rig here, so a dark loft stays dark and a stone gallery stays
// warm.
//
// Three.js is r178 here (the sources are r128): `outputEncoding` /
// `sRGBEncoding` are gone — canvas textures set `colorSpace =
// SRGBColorSpace` instead. Everything else (geometry, materials,
// lights) ports as-is.

"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  BackSide,
  BoxGeometry,
  BufferAttribute,
  BufferGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  CylinderGeometry,
  DirectionalLight,
  DodecahedronGeometry,
  DoubleSide,
  ExtrudeGeometry,
  Float32BufferAttribute,
  FrontSide,
  Group,
  HemisphereLight,
  IcosahedronGeometry,
  LatheGeometry,
  LineBasicMaterial,
  LineSegments,
  MathUtils,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Object3D,
  OctahedronGeometry,
  Path,
  PlaneGeometry,
  PMREMGenerator,
  PointLight,
  RepeatWrapping,
  RingGeometry,
  Scene,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SpotLight,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  type Material,
  type Side,
  type Texture,
} from "three";
import { roomLayouts, type GalleryRoom, type RoomLayout } from "@/lib/rooms";
import { galleryDef } from "@/lib/gallery-defs";
import { CAMERA_HEIGHT_EASE, VIEW_PRESETS, type CameraViewPreset } from "@/lib/editor-params";
import { PHOTO, photoTexture } from "@/lib/gallery-photos";
import { sunlightHitWith } from "@/lib/sunlight";

// ---- Shared helpers (the sources' tex / M / bx / pl) ------------------
const R = (a: number, b: number) => a + Math.random() * (b - a);

function gTex(
  w: number,
  h: number,
  fn: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  rep?: [number, number],
): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  fn(c.getContext("2d")!, w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  if (rep) t.repeat.set(rep[0], rep[1]);
  return t;
}

const gMat = (c: number, r = 0.9, m = 0) => new MeshStandardMaterial({ color: c, roughness: r, metalness: m });

function gBox(
  w: number,
  h: number,
  d: number,
  mat: Material,
  x: number,
  y: number,
  z: number,
  ry = 0,
  parent: Object3D,
  cast = true,
): Mesh {
  const mesh = new Mesh(new BoxGeometry(w, h, d), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.y = ry;
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function gPlane(
  w: number,
  h: number,
  mat: Material,
  x: number,
  y: number,
  z: number,
  rx = 0,
  ry = 0,
  parent: Object3D,
): Mesh {
  const mesh = new Mesh(new PlaneGeometry(w, h), mat);
  mesh.position.set(x, y, z);
  mesh.rotation.set(rx, ry, 0);
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function gCyl(
  rt: number,
  rb: number,
  h: number,
  mat: Material,
  x: number,
  y: number,
  z: number,
  parent: Object3D,
  segments = 12,
): Mesh {
  const mesh = new Mesh(new CylinderGeometry(rt, rb, h, segments), mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  parent.add(mesh);
  return mesh;
}

function jit(geo: BufferGeometry, amount: number): BufferGeometry {
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setXYZ(i, p.getX(i) + R(-amount, amount), p.getY(i) + R(-amount, amount), p.getZ(i) + R(-amount, amount));
  }
  geo.computeVertexNormals();
  return geo;
}

// ---- Procedural paintings (the sources' generators) --------------------
// Deux galeries: the abstract `paint` generator and its six palettes.
function deuxPaint(
  w: number,
  h: number,
  o: { base: string; cols: string[]; n: number; r: number; s: number; ink: string; k: number },
): CanvasTexture {
  return gTex(w, h, (g) => {
    g.fillStyle = o.base;
    g.fillRect(0, 0, w, h);
    g.lineCap = "round";
    g.lineJoin = "round";
    for (const c of o.cols)
      for (let i = 0; i < o.n; i++) {
        g.globalAlpha = R(0.2, 0.7);
        g.fillStyle = c;
        g.beginPath();
        g.ellipse(R(0, w), R(0, h), R(15, o.r), R(10, o.r * 0.8), R(0, 3), 0, 7);
        g.fill();
      }
    for (const c of o.cols)
      for (let i = 0; i < o.s; i++) {
        g.globalAlpha = R(0.35, 0.9);
        g.strokeStyle = c;
        g.lineWidth = R(4, 26);
        const x = R(0, w);
        const y = R(0, h);
        g.beginPath();
        g.moveTo(x, y);
        g.quadraticCurveTo(x + R(-140, 140), y + R(-140, 140), x + R(-180, 180), y + R(-180, 180));
        g.stroke();
      }
    g.globalAlpha = 0.9;
    g.strokeStyle = o.ink;
    for (let k = 0; k < o.k; k++) {
      const cx = R(0, w);
      const cy = R(0, h);
      g.lineWidth = R(2, 9);
      g.beginPath();
      g.moveTo(cx, cy);
      for (let i = 0; i < 7; i++) g.lineTo(cx + R(-90, 90), cy + R(-90, 90));
      g.stroke();
    }
    g.strokeStyle = "#fff";
    for (let i = 0; i < 160; i++) {
      g.globalAlpha = R(0.05, 0.22);
      g.lineWidth = R(1, 3);
      const x = R(0, w);
      const y = R(0, h);
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x + R(-60, 60), y + R(-60, 60));
      g.stroke();
    }
    g.globalAlpha = 1;
  });
}

const DEUX_ART = {
  yellow: () => deuxPaint(640, 560, { base: "#e6c765", cols: ["#f1dc92", "#c9a54a", "#9bb8d9", "#e8ddc4"], n: 30, r: 90, s: 18, ink: "#15110f", k: 4 }),
  tall: () => deuxPaint(420, 680, { base: "#2a3b88", cols: ["#d8321e", "#f2b231", "#2c6fb0", "#7a1f4a", "#f0e4c8"], n: 40, r: 80, s: 42, ink: "#1a0f12", k: 3 }),
  pink: () => deuxPaint(640, 520, { base: "#cfd6f0", cols: ["#e86aa0", "#2a58b8", "#f4d36a", "#162a6a", "#9ad0c8"], n: 30, r: 100, s: 28, ink: "#1c1a2a", k: 5 }),
  dark: () => deuxPaint(480, 600, { base: "#2a1638", cols: ["#5a2a6a", "#c8662a", "#e8d4b0", "#1a2a6a"], n: 35, r: 90, s: 22, ink: "#0c0810", k: 3 }),
  orange: () => deuxPaint(420, 520, { base: "#d85a28", cols: ["#2a3a7a", "#f0b030", "#7a1a2a", "#f4e6c4"], n: 25, r: 70, s: 26, ink: "#140c0c", k: 3 }),
  blk: () => deuxPaint(640, 520, { base: "#f0d060", cols: ["#f4a8c0", "#d8c890", "#f6efe0", "#a0b8e0"], n: 25, r: 80, s: 20, ink: "#0c0a0a", k: 12 }),
} as const;

type DeuxArtKind = keyof typeof DEUX_ART;

// Deux galeries: the mottled concrete generator.
function deuxConcrete(sz: number, base: string, dk: string, rep?: [number, number], seams = false): CanvasTexture {
  return gTex(
    sz,
    sz,
    (g) => {
      g.fillStyle = base;
      g.fillRect(0, 0, sz, sz);
      for (let i = 0; i < 1600; i++) {
        g.fillStyle = `rgba(${dk},${R(0.02, 0.08)})`;
        g.beginPath();
        g.arc(R(0, sz), R(0, sz), R(2, sz * 0.06), 0, 7);
        g.fill();
      }
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(${dk},${R(0.04, 0.11)})`;
        g.beginPath();
        g.ellipse(R(0, sz), R(0, sz), R(sz * 0.04, sz * 0.2), R(sz * 0.03, sz * 0.14), R(0, 3), 0, 7);
        g.fill();
      }
      for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(255,255,255,${R(0.02, 0.06)})`;
        g.fillRect(R(0, sz), R(0, sz), R(1, 3), R(1, 3));
      }
      g.strokeStyle = `rgba(${dk},.35)`;
      g.lineWidth = 1.3;
      for (let i = 0; i < 8; i++) {
        let x = R(0, sz);
        let y = R(0, sz);
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 12; k++) {
          x += R(-18, 18);
          y += R(8, 30);
          g.lineTo(x, y);
        }
        g.stroke();
      }
      if (seams) {
        g.strokeStyle = `rgba(${dk},.5)`;
        g.lineWidth = 2;
        g.strokeRect(0, 0, sz, sz);
        g.beginPath();
        g.moveTo(0, sz / 2);
        g.lineTo(sz, sz / 2);
        g.stroke();
      }
    },
    rep,
  );
}

// Trois galeries: the painting generator (sea, view, folk, face,
// fields, geo, tri, grid, and the dark fallback).
function troisPaint(kind: string, w = 256, h = 256): CanvasTexture {
  return gTex(w, h, (g) => {
    const pick = <T,>(a: T[]): T => a[(Math.random() * a.length) | 0];
    g.lineCap = "round";
    if (kind === "sea" || kind === "tiny") {
      const pa = pick([
        ["#cfe3f0", "#f6efe0"],
        ["#d8e6f2", "#fff8ea"],
        ["#b9d2e8", "#f1e7d4"],
        ["#e3d6c4", "#9fc0d8"],
      ]);
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, pa[0]);
      gr.addColorStop(1, pa[1]);
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) {
        g.strokeStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "120,150,180"},${R(0.1, 0.35)})`;
        g.lineWidth = R(3, 14);
        const y = R(0, h);
        g.beginPath();
        g.moveTo(R(0, w / 2), y);
        g.lineTo(R(w / 2, w), y + R(-10, 10));
        g.stroke();
      }
      if (kind === "tiny") {
        g.fillStyle = pick(["#2a6f9a", "#d9893a", "#7a9a5a"]);
        g.fillRect(0, h * 0.62, w, h * 0.38);
      }
    } else if (kind === "view") {
      const gr = g.createLinearGradient(0, 0, 0, h * 0.6);
      gr.addColorStop(0, "#c9dcec");
      gr.addColorStop(1, "#efe9d9");
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#8c8a5a";
      g.beginPath();
      g.moveTo(0, h * 0.62);
      g.quadraticCurveTo(w * 0.4, h * 0.5, w, h * 0.68);
      g.lineTo(w, h);
      g.lineTo(0, h);
      g.fill();
      g.fillStyle = "#6f9a9a";
      g.fillRect(0, h * 0.78, w, h * 0.22);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(255,255,255,${R(0.1, 0.3)})`;
        g.fillRect(R(0, w), R(h * 0.78, h), R(10, 40), 2);
      }
    } else if (kind === "folk") {
      g.fillStyle = "#f0b62a";
      g.fillRect(0, 0, w, h);
      const cols = ["#d8321e", "#2a58b0", "#1f8a5a", "#f4e6c0", "#7a2a6a", "#f08a2a", "#222"];
      const n = 9;
      const cw = w / n;
      for (let i = 0; i < n; i++) {
        for (let y = 0; y < h; y += cw * 0.9) {
          g.fillStyle = pick(cols);
          g.fillRect(i * cw, y, cw, cw * 0.9);
          g.strokeStyle = "#111";
          g.lineWidth = 3;
          g.strokeRect(i * cw, y, cw, cw * 0.9);
          g.fillStyle = pick(cols);
          g.beginPath();
          g.ellipse(i * cw + cw / 2, y + cw * 0.45, cw * 0.28, cw * 0.34, 0, 0, 7);
          g.fill();
          g.stroke();
          g.fillStyle = "#111";
          g.fillRect(i * cw + cw * 0.36, y + cw * 0.38, cw * 0.08, cw * 0.08);
          g.fillRect(i * cw + cw * 0.56, y + cw * 0.38, cw * 0.08, cw * 0.08);
        }
      }
    } else if (kind === "face") {
      g.fillStyle = pick(["#e8b020", "#d8421e", "#2a6ab0"]);
      g.fillRect(0, 0, w, h);
      g.fillStyle = "#e0a070";
      g.beginPath();
      g.ellipse(w / 2, h * 0.55, w * 0.3, h * 0.38, 0, 0, 7);
      g.fill();
      g.strokeStyle = "#111";
      g.lineWidth = 5;
      g.stroke();
      g.fillStyle = "#c8321e";
      g.fillRect(w * 0.15, h * 0.05, w * 0.7, h * 0.2);
      g.fillStyle = "#fff";
      g.fillRect(w * 0.35, h * 0.45, w * 0.1, h * 0.06);
      g.fillRect(w * 0.58, h * 0.45, w * 0.1, h * 0.06);
      g.fillStyle = "#8a2a1a";
      g.fillRect(w * 0.4, h * 0.75, w * 0.2, h * 0.05);
    } else if (kind === "fields") {
      const cs = ["#1e8a4a", "#f0c820", "#d8321e", "#2a6ab0", "#f4f0e0", "#e0782a"];
      for (let i = 0; i < 14; i++) {
        g.fillStyle = cs[i % 6];
        g.beginPath();
        const y = (i * h) / 9 - h * 0.2;
        g.moveTo(0, y + h * 0.3);
        g.lineTo(w, y);
        g.lineTo(w, y + h * 0.14);
        g.lineTo(0, y + h * 0.44);
        g.fill();
      }
    } else if (kind === "geo") {
      g.fillStyle = "#f0ece0";
      g.fillRect(0, 0, w, h);
      for (const [c, x, y, a, b] of [
        ["#c8321e", 0, 0, 0.5, 0.45],
        ["#2a4aa0", 0.6, 0.5, 0.4, 0.5],
        ["#f0c820", 0.1, 0.6, 0.4, 0.3],
      ] as const) {
        g.fillStyle = c;
        g.fillRect(x * w, y * h, a * w, b * h);
      }
      g.fillStyle = "#111";
      for (const x of [0.55, 0.3]) g.fillRect(x * w, 0, 6, h);
      g.fillRect(0, h * 0.5, w, 6);
    } else if (kind === "tri") {
      g.fillStyle = "#e8e4d8";
      g.fillRect(0, 0, w, h);
      for (const [c] of [["#c8321e"], ["#2a4aa0"], ["#f0c820"]] as const) {
        g.fillStyle = c;
        g.beginPath();
        g.moveTo(R(0, w), R(0, h));
        g.lineTo(R(0, w), R(0, h));
        g.lineTo(R(0, w), R(0, h));
        g.fill();
      }
      g.strokeStyle = "#111";
      g.lineWidth = 4;
      g.strokeRect(6, 6, w - 12, h - 12);
    } else if (kind === "grid") {
      g.fillStyle = "#e9e5d8";
      g.fillRect(0, 0, w, h);
      g.strokeStyle = "#222";
      g.lineWidth = 3;
      for (let i = 1; i < 6; i++) {
        g.beginPath();
        g.moveTo((i * w) / 6, 0);
        g.lineTo((i * w) / 6, h);
        g.moveTo(0, (i * h) / 6);
        g.lineTo(w, (i * h) / 6);
        g.stroke();
      }
    } else {
      const gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, pick(["#2a2a30", "#4a3a30", "#3a2a40"]));
      gr.addColorStop(1, pick(["#a08a6a", "#6a7a8a", "#c0a070"]));
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 30; i++) {
        g.fillStyle = `rgba(${R(0, 255) | 0},${R(0, 255) | 0},${R(0, 255) | 0},.18)`;
        g.beginPath();
        g.arc(R(0, w), R(0, h), R(10, 50), 0, 7);
        g.fill();
      }
    }
  });
}

// Trois galeries: the herringbone parquet generator.
function herring(hue: number, sat: number, lig: number, rep?: [number, number]): CanvasTexture {
  return gTex(
    512,
    512,
    (g) => {
      const L = 90.5;
      const w = 22.6;
      const P = 128;
      const RP = 32;
      g.fillStyle = `hsl(${hue},${sat}%,${lig - 30}%)`;
      g.fillRect(0, 0, 512, 512);
      for (let c = -1; c < 6; c++)
        for (let r = -2; r < 18; r++)
          for (const ang of [Math.PI / 4, Math.PI * 0.75]) {
            g.save();
            g.translate(c * P, r * RP);
            g.rotate(ang);
            g.fillStyle = `hsl(${hue + R(-4, 4)},${sat}%,${lig + R(-6, 6)}%)`;
            g.fillRect(0, -w / 2 + 0.8, L - 1, w - 1.6);
            g.strokeStyle = `rgba(0,0,0,${R(0.05, 0.14)})`;
            g.lineWidth = 0.8;
            for (let k = 0; k < 3; k++) {
              const y = R(-w / 2 + 3, w / 2 - 3);
              g.beginPath();
              g.moveTo(3, y);
              g.lineTo(L - 4, y + R(-1, 1));
              g.stroke();
            }
            g.restore();
          }
    },
    rep,
  );
}

// Trois galeries: the plaster generator and its wall material.
function plasterT(hex: string, rep?: [number, number]): CanvasTexture {
  return gTex(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = hex;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 40; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "90,80,70"},${R(0.015, 0.04)})`;
        g.beginPath();
        g.arc(R(0, w), R(0, h), R(15, 70), 0, 7);
        g.fill();
      }
      for (let i = 0; i < 2500; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "70,60,50"},${R(0.04, 0.1)})`;
        g.fillRect(R(0, w), R(0, h), 1.4, 1.4);
      }
    },
    rep,
  );
}

function troisWallMat(hex: string, w: number, h: number, side?: Side): MeshStandardMaterial {
  const t = plasterT(hex, [w / 3, h / 3]);
  return new MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 0.3, roughness: 0.92, side: side ?? FrontSide });
}

// Galerie en pierre: the painting generator (collage / vivid / red).
function pierreArt(kind: string): CanvasTexture {
  return gTex(400, 600, (g, w, h) => {
    const PAL = ["#c8341e", "#e8762c", "#f0b53a", "#2a4d7a", "#7a1f2b", "#1e6f6a", "#f2d9a0"];
    if (kind === "collage") {
      g.fillStyle = "#cdb78f";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 500; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? "80,60,40" : "240,225,190"},${R(0.04, 0.14)})`;
        g.beginPath();
        g.arc(R(0, w), R(0, h), R(5, 40), 0, 7);
        g.fill();
      }
      g.fillStyle = "#4a2f22";
      g.beginPath();
      g.ellipse(w * 0.55, h * 0.62, w * 0.18, h * 0.28, 0, 0, 7);
      g.fill();
      g.fillStyle = "#6d8cb0";
      g.fillRect(w * 0.04, h * 0.36, w * 0.2, h * 0.07);
      g.fillRect(w * 0.3, h * 0.34, w * 0.2, h * 0.09);
      g.fillRect(w * 0.72, h * 0.35, w * 0.2, h * 0.08);
      g.fillStyle = "#3a2a20";
      g.fillRect(w * 0.9, h * 0.1, w * 0.1, h * 0.8);
    } else {
      const base = kind === "red" ? ["#8b1c14", "#d8581e"] : ["#d9a23a", "#b4361f"];
      const gr = g.createLinearGradient(0, 0, w, h);
      gr.addColorStop(0, base[0]);
      gr.addColorStop(1, base[1]);
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 70; i++) {
        g.fillStyle = PAL[(Math.random() * PAL.length) | 0];
        g.globalAlpha = R(0.4, 0.9);
        g.beginPath();
        const x = R(0, w);
        const y = R(0, h);
        g.moveTo(x, y);
        g.lineTo(x + R(-110, 110), y + R(-110, 110));
        g.lineTo(x + R(-110, 110), y + R(-110, 110));
        g.closePath();
        g.fill();
      }
      g.globalAlpha = 1;
      g.strokeStyle = "rgba(30,15,10,.6)";
      g.lineWidth = 2;
      for (let i = 0; i < 14; i++) {
        g.beginPath();
        g.moveTo(R(0, w), R(0, h));
        g.lineTo(R(0, w), R(0, h));
        g.stroke();
      }
    }
  });
}

// Virtual Gallery: the painting generator (cloud / red / ochre /
// olive / dark).
function verriereArt(kind: string): CanvasTexture {
  return gTex(512, 512, (g, w, h) => {
    const P: Record<string, [string, string]> = {
      cloud: ["#8d9a76", "#b7b58a"],
      red: ["#3a0d0b", "#6a1410"],
      ochre: ["#7b5a2e", "#a07a3c"],
      olive: ["#6b6a35", "#8a8548"],
      dark: ["#1a1517", "#7a1a10"],
    };
    const pair = P[kind] ?? P.dark;
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, pair[0]);
    gr.addColorStop(1, pair[1]);
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(${R(0, 255) | 0},${R(0, 255) | 0},${R(0, 255) | 0},.025)`;
      g.beginPath();
      g.arc(R(0, w), R(0, h), R(8, 50), 0, 7);
      g.fill();
    }
    if (kind === "cloud") {
      for (let k = 0; k < 3; k++) {
        const cx = R(150, 380);
        const cy = R(250, 420);
        for (let i = 0; i < 60; i++) {
          g.fillStyle = "rgba(240,222,170,.09)";
          g.beginPath();
          g.arc(cx + R(-90, 90), cy + R(-30, 30), R(15, 45), 0, 7);
          g.fill();
        }
      }
      g.strokeStyle = "rgba(235,230,210,.7)";
      g.lineWidth = 2;
      for (let k = 0; k < 4; k++) {
        let x = R(60, 450);
        let y = R(100, 300);
        g.beginPath();
        g.moveTo(x, y);
        for (let i = 0; i < 8; i++) {
          x += R(-8, 8);
          y += R(15, 40);
          g.lineTo(x, y);
        }
        g.stroke();
      }
    }
    if (kind === "dark") {
      g.fillStyle = "#d8d4d0";
      g.fillRect(40, 20, 120, 140);
      g.fillStyle = "#c03a1c";
      g.fillRect(300, 420, 180, 92);
    }
  });
}

// Art fair: the photograph generator (five palettes, in order).
const SERP_PAL: [string, string, string, string][] = [
  ["#7fb4e6", "#f4d9a0", "#3d6b8a", "#1d3a52"],
  ["#f2a45c", "#ffe0a8", "#7a4a3a", "#2c1d1d"],
  ["#9cc8b8", "#eef3e6", "#4f7a68", "#233d34"],
  ["#b9a4d8", "#f6d6e0", "#6a5a8a", "#2b2440"],
  ["#6fa0c8", "#d8ecf8", "#e0b070", "#35506a"],
];

function serpPhoto(i: number): CanvasTexture {
  return gTex(256, 190, (g, w, h) => {
    const p = SERP_PAL[i % SERP_PAL.length];
    g.fillStyle = "#fafaf8";
    g.fillRect(0, 0, w, h);
    const x0 = 12;
    const y0 = 12;
    const pw = w - 24;
    const ph = h - 24;
    const gr = g.createLinearGradient(0, y0, 0, y0 + ph);
    gr.addColorStop(0, p[0]);
    gr.addColorStop(1, p[1]);
    g.fillStyle = gr;
    g.fillRect(x0, y0, pw, ph);
    g.fillStyle = "rgba(255,255,255,.7)";
    g.beginPath();
    g.arc(x0 + R(40, pw - 40), y0 + R(20, 60), R(10, 22), 0, 7);
    g.fill();
    for (const c of [p[2], p[3]]) {
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(x0, y0 + ph);
      let y = y0 + ph * R(0.45, 0.7);
      g.lineTo(x0, y);
      for (let x = x0; x <= x0 + pw; x += 18) {
        y = y0 + ph * R(0.4, 0.75);
        g.lineTo(x, y);
      }
      g.lineTo(x0 + pw, y0 + ph);
      g.fill();
    }
  });
}

// Exposition design: the folding-screen sheet generator.
function halleSheet(): CanvasTexture {
  return gTex(256, 380, (g, w, h) => {
    g.fillStyle = "#fbfaf6";
    g.fillRect(0, 0, w, h);
    let y = 14;
    while (y < h - 60) {
      const rh = R(60, 110);
      const cols = Math.random() < 0.5 ? 1 : 2;
      for (let c = 0; c < cols; c++) {
        const cw = (w - 24 - (cols - 1) * 8) / cols;
        const x = 12 + c * (cw + 8);
        const gr = g.createLinearGradient(x, y, x + cw, y + rh);
        gr.addColorStop(0, `hsl(${Math.random() < 0.2 ? R(0, 40) : 0},${Math.random() < 0.2 ? 50 : 0}%,${R(15, 45)}%)`);
        gr.addColorStop(1, `hsl(0,0%,${R(45, 85)}%)`);
        g.fillStyle = gr;
        g.fillRect(x, y, cw, rh);
      }
      y += rh + 8;
    }
    g.fillStyle = "#777";
    for (let k = 0; k < 4; k++) g.fillRect(14, y + k * 9, R(80, 220), 3);
  });
}

// ---- 1. La Serpentine (Art_fair_serpentin) ------------------------------
// Four curved white walls in an S on a stone plaza, photographs on
// both faces, spot arms on the inner top edge, tables and stools,
// mall facades around. Walk + aerial in the source; SANAA keeps the
// walk (the orbit view is the aerial).
function buildSerpentine(group: Group): void {
  const WH = 2.7;
  const RAD = 4.2;
  const T = 0.12;
  const ZC = (k: number) => 11 - 8.4 * k;
  const SG = (k: number) => (k % 2 === 0 ? -1 : 1);
  const add = (o: Object3D) => {
    group.add(o);
    return o;
  };

  const hemiLight = new HemisphereLight(0xffffff, 0xbdb5a8, 0.3);
  add(hemiLight);
  const sun = new DirectionalLight(0xfff3e0, 1.9);
  sun.position.set(-22, 40, 28);
  sun.target.position.set(0, 0, -2);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 5;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0003;
  Object.assign(sun.shadow.camera, { left: -32, right: 32, top: 32, bottom: -32, near: 5, far: 110 });
  add(sun);
  add(sun.target);

  // Ground: stone plaza + grey carpet.
  const stone = gTex(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = "#ddd0ba";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 500; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,250,240" : "120,100,80"},${R(0.03, 0.08)})`;
        g.fillRect(R(0, w), R(0, h), R(2, 14), R(2, 14));
      }
      g.strokeStyle = "rgba(120,105,85,.55)";
      g.lineWidth = 2;
      g.strokeRect(0, 0, w, h);
      g.beginPath();
      g.moveTo(w / 2, 0);
      g.lineTo(w / 2, h);
      g.moveTo(0, h / 2);
      g.lineTo(w, h / 2);
      g.stroke();
    },
    [50, 50],
  );
  const plaza = new Mesh(new PlaneGeometry(120, 120), new MeshStandardMaterial({ map: stone, roughness: 0.55, envMapIntensity: 0.7 }));
  plaza.rotation.x = -Math.PI / 2;
  plaza.position.z = -10;
  plaza.receiveShadow = true;
  add(plaza);
  const carp = gTex(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = "#6f7176";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "0,0,0"},${R(0.03, 0.09)})`;
        g.fillRect(R(0, w), R(0, h), R(1, 3), R(1, 3));
      }
    },
    [12, 24],
  );
  const cp = new Mesh(new PlaneGeometry(22, 44), new MeshStandardMaterial({ map: carp, roughness: 1 }));
  cp.rotation.x = -Math.PI / 2;
  cp.position.set(0, 0.012, -2);
  cp.receiveShadow = true;
  add(cp);

  // Serpentine white walls.
  const wallM = gMat(0xf8f8f6, 0.85);
  for (let k = 0; k < 4; k++) {
    const s = SG(k);
    const a0 = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    const a1 = s > 0 ? Math.PI / 2 : Math.PI * 1.5;
    const sh = new Shape();
    sh.absarc(0, 0, RAD + T, a0, a1, false);
    sh.absarc(0, 0, RAD - T, a1, a0, true);
    const m = new Mesh(new ExtrudeGeometry(sh, { depth: WH, bevelEnabled: false, curveSegments: 64 }), wallM);
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 0, ZC(k));
    m.castShadow = m.receiveShadow = true;
    add(m);
  }

  // Photographs on the walls (inner + outer faces).
  const phT = [0, 1, 2, 3, 4].map(serpPhoto);
  let pi = 0;
  const hangPhoto = (k: number, phi: number, y: number, w: number, h: number, inner: boolean) => {
    const s = SG(k);
    const al = s > 0 ? phi - Math.PI / 2 : -(phi + Math.PI / 2);
    const r = inner ? RAD - T - 0.008 : RAD + T + 0.008;
    const nx = Math.cos(al);
    const nz = -Math.sin(al);
    const dir = inner ? -1 : 1;
    const m = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: phT[pi++ % 5], roughness: 0.6 }));
    m.position.set(r * nx, y, ZC(k) + r * nz);
    m.rotation.y = Math.atan2(nx * dir, nz * dir);
    add(m);
  };
  for (let k = 0; k < 4; k++)
    for (let j = 0; j < 6; j++) {
      const phi = 0.4 + j * 0.45;
      hangPhoto(k, phi, 1.45, 0.9, 0.68, true);
      if (j % 2 === 0) hangPhoto(k, phi + 0.06, 0.75, 0.6, 0.45, true);
      if ((j + k) % 2 === 0) hangPhoto(k, phi, 1.5, 0.85, 0.64, false);
    }

  // Spot arms on the inner top edge.
  const blkM = gMat(0x1a1a1a, 0.4, 0.5);
  for (let k = 0; k < 4; k++)
    for (let j = 0; j < 5; j++) {
      const phi = 0.6 + j * 0.55;
      const s = SG(k);
      const al = s > 0 ? phi - Math.PI / 2 : -(phi + Math.PI / 2);
      const r = RAD - 0.35;
      const h = new Mesh(new CylinderGeometry(0.04, 0.06, 0.16, 8), blkM);
      h.position.set(r * Math.cos(al), WH - 0.1, ZC(k) - r * Math.sin(al));
      add(h);
    }

  // Tables, plinths, stools.
  const table = (x: number, z: number, ry: number, w: number, d: number, h = 0.8) =>
    gBox(w, h, d, gMat(0xfafaf8, 0.7), x, h / 2, z, ry, group);
  table(-2.6, ZC(1), 0, 0.6, 1.5);
  table(2.4, ZC(2), 0, 0.6, 1.5);
  table(-1.6, ZC(0) + 0.5, 0.4, 0.9, 0.6, 1.05);
  table(2.6, ZC(3) - 0.5, -0.3, 0.9, 0.6, 1.05);
  gBox(0.4, 0.45, 0.4, gMat(0x151515, 0.6), 3, 0.225, ZC(1) + 1.3, 0, group);
  gBox(0.4, 0.45, 0.4, gMat(0x151515, 0.6), -3, 0.225, ZC(2) - 1.2, 0, group);

  // Surrounding mall facades (no signage).
  const facadeTex = () =>
    gTex(512, 512, (g, w, h) => {
      g.fillStyle = "#d4d2cd";
      g.fillRect(0, 0, w, h);
      const gr = g.createLinearGradient(0, 300, 0, 500);
      gr.addColorStop(0, "#ffeccd");
      gr.addColorStop(1, "#c9965a");
      for (const x of [20, 276]) {
        g.fillStyle = gr;
        g.fillRect(x, 300, 216, 200);
        g.fillStyle = "#222";
        g.fillRect(x + 106, 300, 4, 200);
        g.fillRect(x, 300, 216, 5);
      }
      for (let r = 0; r < 3; r++) {
        g.fillStyle = "#1f2b38";
        g.fillRect(14, 24 + r * 92, w - 28, 64);
        g.fillStyle = "rgba(180,210,240,.25)";
        g.fillRect(14, 24 + r * 92, w - 28, 16);
        g.fillStyle = "#bdbbb6";
        for (let x = 14; x < w; x += 90) g.fillRect(x, 24 + r * 92, 5, 64);
      }
      g.fillStyle = "#f2f0ea";
      g.fillRect(0, 0, 10, h);
      g.fillRect(w - 10, 0, 10, h);
    });
  const fac = (w: number, h: number, x: number, y: number, z: number, ry: number, rep: number) => {
    const t = facadeTex();
    t.repeat.set(rep, 1);
    const m = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: t, roughness: 0.6, metalness: 0.1 }));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    add(m);
  };
  fac(90, 22, -32, 11, -12, Math.PI / 2, 11);
  fac(90, 22, 32, 11, -12, -Math.PI / 2, 11);
  fac(70, 22, 0, 11, -52, 0, 9);
  gBox(2, 22, 90, gMat(0xc9c6c0, 0.8), -33, 11, -12, 0, group);
  gBox(2, 22, 90, gMat(0xc9c6c0, 0.8), 33, 11, -12, 0, group);
  gBox(70, 22, 2, gMat(0xc9c6c0, 0.8), 0, 11, -53, 0, group);
}

// ---- 2 & 3. La Vitrine + Le Loft Béton (Deux_galeries) ------------------
// Shared helpers of the file: bx / pl / concrete / paint / hang /
// jitter / lathe / spot / head. The two worlds are built separately
// and returned as two builders.
function deuxHang(
  parent: Group,
  x: number,
  y: number,
  z: number,
  ry: number,
  w: number,
  h: number,
  kind: DeuxArtKind,
  frame?: number,
) {
  const g = new Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  const fm = gMat(frame ?? 0xf4f2ee, 0.6);
  const d = frame ? 0.07 : 0.05;
  const b = new Mesh(new BoxGeometry(w + (frame ? 0.12 : 0), h + (frame ? 0.12 : 0), d), fm);
  b.castShadow = true;
  g.add(b);
  const p = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: DEUX_ART[kind](), roughness: 0.75 }));
  p.position.z = d / 2 + 0.002;
  g.add(p);
  parent.add(g);
}

function deuxHead(parent: Group, x: number, y: number, z: number) {
  const h = new Mesh(new CylinderGeometry(0.06, 0.08, 0.2, 10), gMat(0x111111, 0.4, 0.5));
  h.position.set(x, y, z);
  h.rotation.z = R(-0.4, 0.4);
  parent.add(h);
}

function deuxSpot(
  parent: Group,
  x: number,
  y: number,
  z: number,
  tx: number,
  ty: number,
  tz: number,
  i = 1.3,
  sh = false,
) {
  const l = new SpotLight(0xfff0dc, i, 22, 0.7, 0.55, 1);
  l.position.set(x, y, z);
  l.target.position.set(tx, ty, tz);
  parent.add(l);
  parent.add(l.target);
  if (sh) {
    l.castShadow = true;
    l.shadow.mapSize.set(1024, 1024);
    l.shadow.bias = -0.0004;
  }
  return l;
}

function buildVitrine(group: Group): void {
  group.add(new HemisphereLight(0xffffff, 0xb8b2a8, 0.85));
  const pl = (w: number, h: number, mat: Material, x: number, y: number, z: number, rx = 0, ry = 0) =>
    gPlane(w, h, mat, x, y, z, rx, ry, group);
  const bx = (w: number, h: number, d: number, mat: Material, x: number, y: number, z: number, sh = true) =>
    gBox(w, h, d, mat, x, y, z, 0, group, sh);
  // Floor.
  pl(
    40,
    26,
    new MeshStandardMaterial({ map: deuxConcrete(512, "#c4c0b8", "90,86,78", [8, 5]), roughness: 0.4, metalness: 0.05 }),
    0,
    0,
    -6,
    -Math.PI / 2,
  );
  // Sidewalk + brick facade.
  const walk = gTex(
    256,
    256,
    (g) => {
      g.fillStyle = "#b9b7b3";
      g.fillRect(0, 0, 256, 256);
      g.strokeStyle = "#9d9b97";
      g.lineWidth = 3;
      g.strokeRect(0, 0, 256, 256);
      for (let i = 0; i < 300; i++) {
        g.fillStyle = `rgba(0,0,0,${R(0.02, 0.06)})`;
        g.fillRect(R(0, 256), R(0, 256), R(2, 8), R(2, 8));
      }
    },
    [14, 3],
  );
  pl(60, 14, new MeshBasicMaterial({ map: walk, color: 0xeeeeee }), 0, 0, 7, -Math.PI / 2);
  const brick = gTex(
    256,
    256,
    (g) => {
      g.fillStyle = "#dcdad6";
      g.fillRect(0, 0, 256, 256);
      g.strokeStyle = "#bdbab4";
      g.lineWidth = 2;
      for (let r = 0; r < 8; r++) {
        g.beginPath();
        g.moveTo(0, r * 32);
        g.lineTo(256, r * 32);
        g.stroke();
        for (let c = 0; c < 4; c++) {
          const x = c * 64 + (r % 2) * 32;
          g.beginPath();
          g.moveTo(x, r * 32);
          g.lineTo(x, r * 32 + 32);
          g.stroke();
        }
      }
    },
    [8, 1.2],
  );
  const bm = new MeshBasicMaterial({ map: brick, color: 0xf2f0ec });
  const wallBox = (w: number, h: number, x: number, y: number) => {
    const m = new Mesh(new BoxGeometry(w, h, 0.5), bm);
    m.position.set(x, y, 0);
    group.add(m);
  };
  wallBox(30, 5, -23, 2.5);
  wallBox(30, 5, 23, 2.5);
  wallBox(16, 1.8, 0, 4.1);
  // Sign.
  const sg = gTex(512, 128, (g, w, h) => {
    g.font = "bold 96px Helvetica,Arial,sans-serif";
    g.textBaseline = "middle";
    g.fillStyle = "#2e333b";
    g.fillText("exhibit", 10, 68);
    void w;
    void h;
  });
  const halo = gTex(256, 128, (g, w, h) => {
    const r = g.createRadialGradient(128, 64, 5, 128, 64, 125);
    r.addColorStop(0, "rgba(255,255,255,.95)");
    r.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, w, h);
  });
  const haloMesh = new Mesh(new PlaneGeometry(5.2, 1.9), new MeshBasicMaterial({ map: halo, transparent: true }));
  haloMesh.position.set(-4, 4, 0.27);
  group.add(haloMesh);
  const sgm = new Mesh(new PlaneGeometry(3.4, 0.85), new MeshBasicMaterial({ map: sg, transparent: true }));
  sgm.position.set(-4, 4, 0.3);
  group.add(sgm);
  // Glass front with mullions (the door gap is x 3.2…4.6).
  const gm = new MeshPhysicalMaterial({ color: 0xcfe0ea, transparent: true, opacity: 0.14, roughness: 0.05, metalness: 0, side: DoubleSide });
  const xs = [-8, -4.8, -1.6, 1.6, 3.2, 4.6, 6.2, 8];
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    if (a === 3.2 && b === 4.6) continue;
    pl(b - a, 3.2, gm, (a + b) / 2, 1.6, 0);
  }
  for (const x of xs) bx(0.06, 3.2, 0.1, gMat(0x8a8d92, 0.4, 0.7), x, 1.6, 0, false);
  bx(16, 0.12, 0.14, gMat(0x8a8d92, 0.4, 0.7), 0, 3.2, 0, false);
  // Interior shell.
  const wm = gMat(0xf5f4f0, 0.95);
  pl(16, 4, wm, -8, 2, -6, 0, Math.PI / 2);
  pl(16, 4, wm, 8, 2, -6, 0, -Math.PI / 2);
  pl(16, 4, wm, 0, 2, -12);
  pl(16, 16, gMat(0xfafaf8, 1), 0, 4, -4, Math.PI / 2);
  for (let i = -3; i <= 3; i++) bx(0.25, 0.45, 13, gMat(0xfafaf8, 1), i * 2.2, 3.78, -6, false);
  for (const x of [-3.5, 3.5]) {
    bx(0.08, 0.08, 13, gMat(0xdddddd, 0.5, 0.4), x, 3.5, -6, false);
    for (let z = -1.5; z > -12; z -= 2.4) deuxHead(group, x, 3.38, z);
  }
  // Art.
  deuxHang(group, -5, 1.9, -11.95, 0, 3.2, 2.5, "pink");
  deuxHang(group, -0.2, 1.95, -11.95, 0, 2.1, 2.8, "dark");
  // Pedestals + objects.
  const wp = gMat(0xf7f7f5, 0.9);
  bx(1.2, 1.15, 1.2, wp, -1.3, 0.575, -4.4);
  bx(1, 0.95, 1, wp, 1.3, 0.475, -5.2);
  bx(0.55, 1.4, 0.1, gMat(0x1b2a55, 0.5), -1.3, 1.15 + 0.75, -4.4);
  bx(0.4, 0.06, 0.3, gMat(0x111111, 0.4, 0.6), -1.3, 1.18, -4.4);
  const st = new Mesh(jit(new CylinderGeometry(0.22, 0.28, 0.5, 10, 3), 0.04), gMat(0x8a7d6a, 1));
  st.position.set(1.3, 1.2, -5.2);
  st.castShadow = true;
  group.add(st);
  // Shelves + objects.
  for (const y of [0.75, 1.55]) bx(3, 0.06, 0.6, wp, -5.4, y, -3.2);
  const lathe = (pts: [number, number][], mat: Material, x: number, y: number, z: number, s = 1) => {
    const m = new Mesh(new LatheGeometry(pts.map((p) => new Vector2(p[0] * s, p[1] * s)), 24), mat);
    (m.material as Material).side = DoubleSide;
    m.position.set(x, y, z);
    m.castShadow = true;
    group.add(m);
    return m;
  };
  lathe(
    [
      [0, 0],
      [0.05, 0],
      [0.1, 0.18],
      [0.09, 0.34],
      [0.04, 0.44],
      [0.05, 0.5],
    ],
    gMat(0xe8e0d0, 0.5),
    -5,
    1.58,
    -3.2,
    1.3,
  );
  lathe(
    [
      [0, 0],
      [0.15, 0.02],
      [0.3, 0.18],
      [0.34, 0.26],
      [0.3, 0.24],
    ],
    gMat(0xb7aa95, 0.8),
    -6.1,
    1.58,
    -3.2,
    1,
  );
  const co = new Mesh(jit(new IcosahedronGeometry(0.3, 2), 0.025), gMat(0x7f93a8, 0.9));
  co.position.set(-5.5, 1.08, -3.2);
  co.scale.y = 0.85;
  co.castShadow = true;
  group.add(co);
  // Desk + partition.
  bx(3.2, 0.06, 0.9, gMat(0x2f4e9a, 0.5), 3.6, 0.75, -8);
  for (const [x, z] of [
    [2.1, -8.35],
    [5.1, -8.35],
    [2.1, -7.65],
    [5.1, -7.65],
  ] as const)
    bx(0.05, 0.75, 0.05, wp, x, 0.375, z);
  bx(0.6, 0.4, 0.04, gMat(0xdadada, 0.3, 0.6), 3.6, 1.05, -8.2);
  bx(0.1, 0.3, 0.1, gMat(0xdadada, 0.3, 0.6), 3.6, 0.9, -8.25);
  bx(0.5, 0.05, 0.5, gMat(0xc9a36a, 0.7), 2.8, 0.45, -7.2);
  bx(0.5, 0.45, 0.05, gMat(0xc9a36a, 0.7), 2.8, 0.7, -7.45);
  bx(3.4, 3, 0.2, wp, 4.2, 1.5, -10.4);
  const tx = gTex(512, 128, (g) => {
    g.font = "300 64px Helvetica,Arial,sans-serif";
    g.fillStyle = "#656b73";
    g.fillText("e x h i b i t", 20, 80);
  });
  pl(3, 0.75, new MeshBasicMaterial({ map: tx, transparent: true }), 3.9, 2.4, -10.28);
  const red = new Mesh(jit(new SphereGeometry(0.28, 12, 10), 0.05), gMat(0xc8281e, 0.4));
  red.position.set(5.2, 1.9, -10.2);
  red.scale.set(1, 0.8, 0.4);
  group.add(red);
  deuxSpot(group, -5, 3.9, -5, -5, 2, -11.9, 1.8, true);
  deuxSpot(group, -0.3, 3.9, -5, -0.2, 2, -11.9, 1.6, true);
  deuxSpot(group, -1.3, 3.9, -1.5, -1.3, 1, -4.4, 1.3, true);
  deuxSpot(group, 3.8, 3.9, -5, 3.8, 1.2, -9, 1.1);
}

function buildLoft(group: Group): void {
  group.add(new HemisphereLight(0xfff4e6, 0x6e675c, 0.7));
  const pl = (w: number, h: number, mat: Material, x: number, y: number, z: number, rx = 0, ry = 0) =>
    gPlane(w, h, mat, x, y, z, rx, ry, group);
  const bx = (w: number, h: number, d: number, mat: Material, x: number, y: number, z: number, sh = true) =>
    gBox(w, h, d, mat, x, y, z, 0, group, sh);
  pl(
    18,
    20,
    new MeshStandardMaterial({ map: deuxConcrete(1024, "#a8a399", "70,64,56", [2, 2]), roughness: 0.9 }),
    0,
    0,
    -2,
    -Math.PI / 2,
  );
  const wm = gMat(0xf4f2ee, 0.95);
  pl(20, 4.3, wm, -9, 2.15, -2, 0, Math.PI / 2);
  pl(20, 4.3, wm, 9, 2.15, -2, 0, -Math.PI / 2);
  pl(18, 4.3, wm, 0, 2.15, -12);
  pl(18, 4.3, wm, 0, 2.15, 8, 0, Math.PI);
  const cm = new MeshStandardMaterial({ map: deuxConcrete(512, "#8f8a80", "60,52,44", [3, 3], true), roughness: 1 });
  pl(18, 20, cm, 0, 4.3, -2, Math.PI / 2);
  for (let i = -2; i <= 2; i++) bx(0.7, 0.6, 20, cm, i * 4.4, 4.0, -2, false);
  const rail = gMat(0x9a9a98, 0.4, 0.7);
  bx(18, 0.06, 0.06, rail, 0, 3.55, 1.5, false);
  bx(18, 0.06, 0.06, rail, 0, 3.55, -6.5, false);
  bx(0.04, 0.04, 18, rail, -4.4, 3.62, -2, false);
  for (let x = -8; x <= 8; x += 2.2) {
    deuxHead(group, x, 3.45, 1.5);
    deuxHead(group, x, 3.45, -6.5);
  }
  // Art.
  deuxHang(group, -8.93, 1.95, -1, Math.PI / 2, 3.3, 2.7, "yellow", 0x0e0e0e);
  deuxHang(group, -1.5, 1.95, -3.88, 0, 2.1, 3.3, "tall", 0x0e0e0e);
  deuxHang(group, -1.5, 1.9, -4.12, Math.PI, 1.8, 2.3, "orange", 0x0e0e0e);
  deuxHang(group, 8.93, 1.9, -6, -Math.PI / 2, 3.1, 2.5, "blk", 0x0e0e0e);
  deuxHang(group, -4.5, 1.9, -11.93, 0, 2, 2.5, "orange", 0x0e0e0e);
  // Partition + bench.
  bx(3.6, 3.9, 0.2, wm, -1.5, 1.95, -4);
  bx(3, 0.5, 0.9, gMat(0xf6f6f4, 0.8), 3.6, 0.25, -3);
  // Window (back wall, right).
  bx(1.5, 2, 0.12, gMat(0xffffff, 0.6), 6, 2.1, -11.9);
  pl(1.3, 1.8, new MeshBasicMaterial({ color: 0xcfe4f5 }), 6, 2.1, -11.82);
  for (const dx of [-0.22, 0.22]) bx(0.04, 1.8, 0.05, gMat(0xffffff), 6 + dx, 2.1, -11.8, false);
  bx(1.3, 0.04, 0.05, gMat(0xffffff), 6, 2.1, -11.8, false);
  deuxSpot(group, -6, 3.5, 1.5, -8.9, 1.9, -1, 2.2, true);
  deuxSpot(group, -1.5, 3.5, 1.5, -1.5, 1.9, -3.9, 2.2, true);
  deuxSpot(group, 6, 3.5, -6.5, 8.9, 1.9, -6, 2.0, true);
  deuxSpot(group, -1.5, 3.5, -6.5, -4.5, 1.9, -11.9, 1.6);
  deuxSpot(group, 3.6, 3.5, -1, 3.6, 0.3, -3, 1);
}

// ---- 4. La Halle Design (Exposition_design) ------------------------------
// A 25 × 34 m design hall, 8.2 m high: grey carpet, a glass curtain
// wall with blinds, zigzag folding screens with works on both sides,
// platforms, lounge furniture, glass cases, a hanging faceted mobile
// and kites. Returns a tick that slowly rotates the mobile.
function buildHalle(group: Group): { tick?: (dt: number) => void } {
  const H = 8.2;
  const add = (o: Object3D) => {
    group.add(o);
    return o;
  };
  group.add(new HemisphereLight(0xffffff, 0xb5b0a8, 0.3));
  const sun = new DirectionalLight(0xfff4e2, 2.2);
  sun.position.set(38, 30, 10);
  sun.target.position.set(0, 0, 0);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.radius = 5;
  sun.shadow.blurSamples = 16;
  sun.shadow.bias = -0.0003;
  Object.assign(sun.shadow.camera, { left: -30, right: 30, top: 30, bottom: -30, near: 5, far: 100 });
  add(sun);
  add(sun.target);

  // Shell: carpet floor, plaster walls, tiled ceiling + shadow catcher.
  const carp = gTex(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = "#7b7976";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 60; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "0,0,0"},${R(0.02, 0.05)})`;
        g.beginPath();
        g.arc(R(0, w), R(0, h), R(30, 120), 0, 7);
        g.fill();
      }
      g.lineWidth = 1;
      for (let i = 0; i < 9000; i++) {
        const x = R(0, w);
        const y = R(0, h);
        const a = R(0, 6.28);
        const l = R(2, 5);
        g.strokeStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "20,20,20"},${R(0.05, 0.16)})`;
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l);
        g.stroke();
      }
    },
    [20, 26],
  );
  const floor = new Mesh(new PlaneGeometry(25, 34), new MeshStandardMaterial({ map: carp, bumpMap: carp, bumpScale: 1.5, roughness: 1 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.x = -0.5;
  floor.receiveShadow = true;
  add(floor);
  const wallBase = gTex(512, 512, (g, w, h) => {
    g.fillStyle = "#efede8";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 120; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,250,240" : "150,140,125"},${R(0.02, 0.05)})`;
      g.beginPath();
      g.arc(R(0, w), R(0, h), R(20, 100), 0, 7);
      g.fill();
    }
    for (let i = 0; i < 7000; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "80,70,60"},${R(0.04, 0.12)})`;
      g.beginPath();
      g.arc(R(0, w), R(0, h), R(0.6, 1.8), 0, 7);
      g.fill();
    }
  });
  const paintMat = (w: number, h: number) => {
    const t = wallBase.clone();
    t.needsUpdate = true;
    t.repeat.set(w / 2.5, h / 2.5);
    return new MeshStandardMaterial({ map: t, bumpMap: t, bumpScale: 0.35, roughness: 0.93 });
  };
  const wl = (w: number, h: number, x: number, y: number, z: number, ry: number) => {
    const m = new Mesh(new PlaneGeometry(w, h), paintMat(w, h));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    m.receiveShadow = true;
    add(m);
  };
  wl(34, H, -13, H / 2, 0, Math.PI / 2);
  wl(25, H, -0.5, H / 2, -17, 0);
  wl(25, H, -0.5, H / 2, 17, Math.PI);
  const sk = gMat(0x3a3836, 0.6);
  gBox(0.05, 0.14, 34, sk, -12.97, 0.07, 0, 0, group);
  gBox(25, 0.14, 0.05, sk, -0.5, 0.07, -16.97, 0, group);
  gBox(25, 0.14, 0.05, sk, -0.5, 0.07, 16.97, 0, group);
  gBox(0.05, 0.14, 34, sk, 11.9, 0.07, 0, 0, group);
  const ceT = gTex(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = "#f3f1ed";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1500; i++) {
        g.fillStyle = `rgba(0,0,0,${R(0.02, 0.06)})`;
        g.fillRect(R(0, w), R(0, h), R(1, 2), R(1, 2));
      }
      g.strokeStyle = "rgba(60,58,54,.55)";
      g.lineWidth = 3;
      g.strokeRect(0, 0, w, h);
      g.strokeStyle = "rgba(60,58,54,.2)";
      g.lineWidth = 1;
      g.strokeRect(6, 6, w - 12, h - 12);
    },
    [25 / 1.2, 34 / 1.2],
  );
  const ceil = new Mesh(new PlaneGeometry(25, 34), new MeshStandardMaterial({ map: ceT, bumpMap: ceT, bumpScale: 0.5, roughness: 1 }));
  for (const rx of [-8, -1, 6]) {
    gBox(0.06, 0.06, 32, gMat(0x222222, 0.4, 0.6), rx, H - 0.2, 0, 0, group);
    for (let rz = -14; rz <= 14; rz += 3.5) {
      const hd = gCyl(0.07, 0.09, 0.2, gMat(0x111111, 0.4, 0.5), rx, H - 0.4, rz, group);
      hd.rotation.z = R(-0.4, 0.4);
    }
  }
  ceil.rotation.x = Math.PI / 2;
  ceil.position.set(-0.5, H, 0);
  add(ceil);
  const cs = new Mesh(
    new PlaneGeometry(25, 34),
    new MeshBasicMaterial({ colorWrite: false, depthWrite: false, side: DoubleSide }),
  );
  cs.rotation.x = Math.PI / 2;
  cs.position.set(-0.5, H + 0.02, 0);
  cs.castShadow = true;
  add(cs);
  // Glass curtain wall + blinds + mullions.
  for (let z = -17; z <= 17.1; z += 2.4) gBox(0.14, H, 0.22, gMat(0xf1f1ef, 0.5, 0.2), 12, H / 2, z, 0, group);
  gBox(0.2, 0.3, 34, gMat(0xdedcd8, 0.5, 0.3), 12, H - 0.15, 0, 0, group);
  const bl = gTex(
    128,
    16,
    (g, w, h) => {
      for (let x = 0; x < w; x += 8) {
        g.fillStyle = "rgba(255,255,255,.8)";
        g.fillRect(x, 0, 5, h);
        g.fillStyle = "rgba(255,255,255,.1)";
        g.fillRect(x + 5, 0, 3, h);
      }
    },
    [44, 1],
  );
  const blind = new Mesh(new PlaneGeometry(34, H), new MeshBasicMaterial({ map: bl, transparent: true, depthWrite: false }));
  blind.position.set(11.85, H / 2, 0);
  blind.rotation.y = -Math.PI / 2;
  add(blind);
  // Outside lawn + trees.
  const lawn = new Mesh(new PlaneGeometry(120, 160), new MeshStandardMaterial({ color: 0x7fa84a, roughness: 1 }));
  lawn.rotation.x = -Math.PI / 2;
  lawn.position.set(72, -0.03, 0);
  add(lawn);
  for (let i = 0; i < 22; i++) {
    const tg = new Group();
    tg.position.set(R(30, 60), 0, R(-40, 40));
    gCyl(0.2, 0.3, 3, gMat(0x5a4430), 0, 1.5, 0, tg);
    const c = new Mesh(new SphereGeometry(R(2, 3.2), 10, 8), gMat([0x8aa23a, 0xc4a030, 0x5f8a3a, 0xb8742a][i % 4], 1));
    c.position.y = 4.2;
    c.castShadow = false;
    tg.add(c);
    add(tg);
  }

  // Folding screens (the source's screen()).
  const metal = gMat(0xb8bbbf, 0.35, 0.8);
  const aoLin = gTex(8, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "rgba(0,0,0,.4)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  const SH = 2.4;
  const sheets = [0, 1, 2, 3, 4, 5].map(halleSheet);
  let si = 0;
  const screen = (pts: [number, number][]) => {
    for (let i = 0; i < pts.length - 1; i++) {
      const [a, b] = [pts[i], pts[i + 1]];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      const g = new Group();
      g.position.set((a[0] + b[0]) / 2, 0, (a[1] + b[1]) / 2);
      g.rotation.y = -Math.atan2(dz, dx);
      add(g);
      gBox(len + 0.05, SH, 0.07, paintMat(len, SH), 0, SH / 2, 0, 0, g);
      gBox(len + 0.05, 0.05, 0.1, metal, 0, SH + 0.01, 0, 0, g);
      gBox(len + 0.05, 0.04, 0.1, metal, 0, 0.03, 0, 0, g);
      gCyl(0.025, 0.025, SH + 0.04, metal, -len / 2, SH / 2, 0, g);
      for (const sd of [1, -1]) {
        const ao = new Mesh(new PlaneGeometry(len, 0.9), new MeshBasicMaterial({ map: aoLin, transparent: true, depthWrite: false }));
        ao.rotation.x = -Math.PI / 2;
        ao.position.set(0, 0.016, sd * 0.5);
        if (sd < 0) ao.rotation.z = Math.PI;
        g.add(ao);
      }
      const n = Math.max(1, Math.floor(len / 1.15));
      for (const side of [1, -1])
        for (let j = 0; j < n; j++) {
          if (Math.random() < 0.2) continue;
          const w = Math.min(0.95, len / n - 0.12);
          const h = w * 1.42;
          const p = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: sheets[si++ % 6], roughness: 0.8 }));
          p.position.set(-len / 2 + (j + 0.5) * (len / n), 1.25, side * 0.038);
          if (side < 0) p.rotation.y = Math.PI;
          g.add(p);
        }
    }
  };
  screen([
    [2, 13],
    [0.2, 11],
    [2, 9],
    [0.2, 7],
    [2, 5],
    [0.2, 3],
  ]);
  screen([
    [-10, 8],
    [-7, 9.5],
    [-4, 8],
    [-1, 9],
  ]);
  screen([
    [-5, 5],
    [-2.5, 4],
    [0, 5],
    [2.8, 3.5],
    [5.5, 4.5],
    [8.5, 3],
    [11.5, 4],
  ]);
  screen([
    [-11, -1],
    [-8, -2.2],
    [-5, -1],
    [-2, -2.2],
  ]);
  screen([
    [-9, -9],
    [-6, -10],
    [-3, -8.5],
    [0.5, -9.5],
  ]);
  screen([
    [3, -3],
    [5, -5],
    [3, -7],
    [5, -9],
    [8, -8],
  ]);
  screen([
    [-7, -4],
    [-7.5, -6.5],
  ]);

  // Furniture.
  const fabT = gTex(128, 128, (g, w, h) => {
    g.fillStyle = "#d8d8d8";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "0,0,0"},${R(0.05, 0.18)})`;
      g.fillRect(R(0, w), R(0, h), 1, 1 + Math.random() * 2);
    }
  });
  const woodT = gTex(512, 256, (g, w, h) => {
    g.fillStyle = "#d4b48a";
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 2) {
      g.strokeStyle = `rgba(${Math.random() < 0.5 ? "90,55,25" : "255,230,190"},${R(0.05, 0.22)})`;
      g.lineWidth = R(0.5, 2);
      g.beginPath();
      g.moveTo(0, y);
      for (let x = 0; x <= w; x += 64) g.lineTo(x, y + R(-1.5, 1.5));
      g.stroke();
    }
    g.strokeStyle = "rgba(60,35,15,.5)";
    for (let x = 0; x < w; x += 128) {
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, h);
      g.stroke();
    }
  });
  const aoRad = gTex(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(64, 64, 20, 64, 64, 64);
    r.addColorStop(0, "rgba(0,0,0,.45)");
    r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, w, h);
  });
  const platform = (x: number, z: number, w: number, d: number, c: number, ry = 0) => {
    const wood = [0x8a6a3a, 0xc9a56a, 0xa07a44].includes(c);
    const t = (wood ? woodT : fabT).clone();
    t.needsUpdate = true;
    t.repeat.set(wood ? w / 1.5 : w * 3, wood ? d / 1.5 : d * 3);
    gBox(
      w,
      0.14,
      d,
      new MeshStandardMaterial({ color: c, map: t, bumpMap: t, bumpScale: wood ? 0.4 : 1.2, roughness: wood ? 0.55 : 1 }),
      x,
      0.07,
      z,
      ry,
      group,
    );
    const ao = new Mesh(new PlaneGeometry(w + 1.6, d + 1.6), new MeshBasicMaterial({ map: aoRad, transparent: true, depthWrite: false }));
    ao.rotation.x = -Math.PI / 2;
    ao.rotation.z = ry;
    ao.position.set(x, 0.015, z);
    add(ao);
  };
  const shell = (x: number, y: number, z: number, ry: number, c: number) => {
    const g = new Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    add(g);
    const s = new Mesh(
      new SphereGeometry(0.3, 16, 10, 0, Math.PI * 2, 0, Math.PI * 0.55),
      new MeshStandardMaterial({ color: c, roughness: 0.35, side: DoubleSide }),
    );
    s.scale.set(1, 0.9, 1);
    s.rotation.x = -0.5;
    s.position.y = 0.52;
    s.castShadow = true;
    g.add(s);
    for (const [lx, lz] of [
      [-0.2, -0.18],
      [0.2, -0.18],
      [-0.2, 0.2],
      [0.2, 0.2],
    ] as const)
      gCyl(0.012, 0.012, 0.42, gMat(0x333333, 0.4, 0.6), lx, 0.21, lz, g);
  };
  const lounge = (x: number, z: number, ry: number) => {
    const g = new Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    add(g);
    const b = gMat(0x151515, 0.5);
    gBox(0.75, 0.3, 0.7, b, 0, 0.38, 0, 0, g);
    const bk = gBox(0.75, 0.6, 0.18, b, 0, 0.72, 0.3, 0, g);
    bk.rotation.x = 0.3;
    gBox(0.12, 0.22, 0.6, b, -0.4, 0.55, 0, 0, g);
    gBox(0.12, 0.22, 0.6, b, 0.4, 0.55, 0, 0, g);
    gBox(0.3, 0.28, 0.3, gMat(0x888888, 0.3, 0.8), 0, 0.14, 0, 0, g);
  };
  const office = (x: number, z: number, ry: number) => {
    const g = new Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    add(g);
    const b = gMat(0x1a1a1a, 0.5);
    gBox(0.5, 0.1, 0.5, b, 0, 0.5, 0, 0, g);
    const bk = gBox(0.5, 0.4, 0.08, b, 0, 0.78, 0.24, 0, g);
    bk.rotation.x = 0.15;
    gCyl(0.03, 0.03, 0.45, gMat(0x999999, 0.3, 0.8), 0, 0.25, 0, g);
    gBox(0.7, 0.03, 0.06, gMat(0x999999, 0.3, 0.8), 0, 0.03, 0, 0, g);
    gBox(0.06, 0.03, 0.7, gMat(0x999999, 0.3, 0.8), 0, 0.03, 0, 0, g);
  };
  // Front platforms.
  platform(4, 9.5, 2.4, 8, 0xb81f26, -0.45); // red
  gBox(0.8, 0.4, 4.2, gMat(0xb7b6b4, 0.9), 4, 0.34, 9.5, -0.45, group);
  gBox(0.5, 0.1, 0.5, gMat(0xf4f4f2, 0.5), 2.6, 0.54, 7.7, -0.45, group);
  platform(8, 9, 5.5, 5.2, 0x7b7a3a, 0); // olive
  for (const [x, z, r] of [
    [6.6, 7.2, 0.6],
    [9, 7, -0.5],
    [9.3, 9.6, -1.9],
    [6.3, 10.6, 2.4],
  ] as const)
    office(x, z, r);
  const ov = new Mesh(new CylinderGeometry(1, 1, 0.06, 32), gMat(0x1e1a18, 0.4));
  ov.scale.set(2.2, 1, 0.9);
  ov.position.set(8, 0.55, 9);
  ov.rotation.y = 0.8;
  ov.castShadow = true;
  add(ov);
  gCyl(0.06, 0.06, 0.45, gMat(0x222222), 8, 0.3, 9, group);
  lounge(9.8, 11.2, 3.6);
  lounge(7, 11.8, 3.3);
  const pl = new Mesh(new SphereGeometry(0.45, 10, 8), gMat(0x2f6a2a, 1));
  pl.position.set(6.5, 0.9, 8.4);
  pl.castShadow = true;
  add(pl);
  gCyl(0.2, 0.17, 0.3, gMat(0x7a4a2a), 6.5, 0.3, 8.4, group);
  platform(-1.5, 12, 3.4, 5, 0x8a6a3a, 0); // wood, shell chairs
  shell(-2.3, 0.14, 10.6, 0.5, 0xefe8d4);
  shell(-1, 0.14, 12.2, -0.2, 0xf6f1e2);
  shell(-2, 0.14, 13.6, 0.7, 0x8a8a4a);
  // Yellow cabinet area.
  platform(-4, 6.6, 4.6, 4, 0xc9a56a, 0);
  gBox(1.5, 1.1, 0.5, gMat(0xe1b12e, 0.6), -4.6, 0.7, 5.4, 0, group);
  gBox(0.04, 1.1, 0.5, gMat(0xf5f0e0), -4.6, 0.7, 5.4, 0, group);
  shell(-3.2, 0.14, 6.9, -0.8, 0xc4202a);
  gBox(0.7, 0.4, 0.5, gMat(0xa8261e, 0.6), -3.8, 0.34, 8, 0, group);
  // Glass cases.
  for (const [x, z] of [
    [-10, 2],
    [2, -1],
  ] as const) {
    gBox(1.5, 0.9, 1.2, gMat(0x151515, 0.7), x, 0.45, z, 0, group);
    const gl = new Mesh(
      new BoxGeometry(1.5, 0.8, 1.2),
      new MeshPhysicalMaterial({ color: 0xdfeef5, transparent: true, opacity: 0.18, roughness: 0.05 }),
    );
    gl.position.set(x, 1.3, z);
    add(gl);
    gBox(0.3, 0.3, 0.3, gMat(0xc9852a, 0.5), x, 1.05, z, 0, group);
    gBox(0.25, 0.4, 0.2, gMat(0x3a6a9a, 0.5), x + 0.4, 1.15, z + 0.1, 0, group);
  }
  // Mid-left wooden lounge group.
  platform(-9, 5, 3.6, 3.2, 0xa07a44, 0);
  shell(-9.4, 0.14, 4.6, 0.6, 0xd2b040);
  shell(-8.2, 0.14, 5.6, -0.5, 0xc2681e);
  gCyl(0.3, 0.3, 0.5, gMat(0xb9783a), -8.6, 0.4, 4.9, group);

  // Hanging faceted mobile + kites.
  const og = new OctahedronGeometry(1.3, 0).toNonIndexed();
  const col: number[] = [];
  const pal: [number, number, number][] = [
    [0.85, 0.66, 0.2],
    [0.88, 0.48, 0.16],
    [0.78, 0.8, 0.82],
    [0.75, 0.2, 0.16],
    [0.95, 0.92, 0.85],
  ];
  for (let i = 0; i < og.attributes.position.count / 3; i++) {
    const c = pal[(Math.random() * pal.length) | 0];
    for (let k = 0; k < 3; k++) col.push(...c);
  }
  og.setAttribute("color", new Float32BufferAttribute(col, 3));
  const mob = new Group();
  mob.position.set(7, 5.4, -4);
  add(mob);
  for (const [sx, sy, sz, ry] of [
    [2.2, 0.9, 1.3, 0.2],
    [1.5, 1.6, 1.3, 1.1],
    [1.8, 0.9, 2.0, 2.2],
  ] as const) {
    const m = new Mesh(og, new MeshStandardMaterial({ vertexColors: true, flatShading: true, metalness: 0.35, roughness: 0.4 }));
    m.scale.set(sx, sy, sz);
    m.rotation.y = ry;
    m.castShadow = true;
    mob.add(m);
  }
  for (const [x, z] of [
    [-1, -1],
    [1, -1],
    [-1, 1],
    [1, 1],
  ] as const)
    gCyl(0.01, 0.01, 2.8, gMat(0x555555), 7 + x * 1.5, 6.8, -4 + z * 1.2, group);
  const kite = (x: number, y: number, z: number, c: number, r: number) => {
    const s = new Shape();
    s.moveTo(0, 0.9);
    s.lineTo(0.5, 0);
    s.lineTo(0, -0.9);
    s.lineTo(-0.5, 0);
    const m = new Mesh(new ShapeGeometry(s), new MeshStandardMaterial({ color: c, side: DoubleSide, roughness: 0.6 }));
    m.position.set(x, y, z);
    m.rotation.y = r;
    m.castShadow = true;
    add(m);
    gCyl(0.01, 0.01, H - y - 0.9, gMat(0x333333), x, (H + y + 0.9) / 2, z, group);
  };
  kite(-10, 6.2, -5, 0xc22a2a, 0.5);
  kite(-9, 6.6, -8, 0xe8c020, 1.2);
  kite(-4, 6.8, -12, 0x2f8a8a, 0.3);
  const disc = new Mesh(new CircleGeometry(0.5, 24), new MeshStandardMaterial({ color: 0xf2c418, side: DoubleSide }));
  disc.position.set(-7, 6.8, -14);
  add(disc);

  return {
    tick: (dt: number) => {
      mob.rotation.y += dt * 0.12;
    },
  };
}

// ---- 5. L'Arche (Galerie_en_pierre) --------------------------------------
// The original Stone Gallery: 20 × 24 m, 6.5 m high, stone/plaster
// walls, a dividing wall with a round arch, a niche, rubble, timber
// beams and track lights.
function buildArche(group: Group): void {
  const H = 6.5;
  group.add(new HemisphereLight(0xfff0dc, 0x6a5d4c, 0.75));
  for (const [x, z] of [
    [-4, 2],
    [4, 2],
    [-3, -9],
    [4, -9],
    [0, -4.5],
  ] as const) {
    const l = new PointLight(0xffe2b8, 0.55, 12);
    l.position.set(x, 5, z);
    group.add(l);
  }

  // Stone / plaster wall.
  const wallBase = gTex(512, 512, (g, w, h) => {
    g.fillStyle = "#b8ab94";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const d = Math.random() < 0.5;
      g.fillStyle = d ? `rgba(90,78,62,${R(0.03, 0.12)})` : `rgba(235,225,205,${R(0.04, 0.15)})`;
      g.beginPath();
      g.arc(R(0, w), R(0, h), R(4, 55), 0, 7);
      g.fill();
    }
    for (let i = 0; i < 14; i++) {
      g.fillStyle = `rgba(120,108,92,${R(0.25, 0.45)})`;
      g.fillRect(R(0, w - 80), R(0, h - 50), R(40, 110), R(25, 60));
    }
    g.strokeStyle = "rgba(60,50,40,.45)";
    g.lineWidth = 1.2;
    for (let i = 0; i < 10; i++) {
      let x = R(0, w);
      let y = R(0, h);
      g.beginPath();
      g.moveTo(x, y);
      for (let k = 0; k < 10; k++) {
        x += R(-14, 14);
        y += R(6, 22);
        g.lineTo(x, y);
      }
      g.stroke();
    }
  });
  const wallTex = (u: number, v: number) => {
    const t = wallBase.clone();
    t.needsUpdate = true;
    t.repeat.set(u, v);
    return t;
  };
  const wallMat = (u: number, v: number) => new MeshStandardMaterial({ map: wallTex(u, v), roughness: 1 });

  // Concrete floor.
  const ft = gTex(512, 512, (g, w, h) => {
    g.fillStyle = "#b5b0a5";
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? "70,65,58" : "235,230,220"},${R(0.03, 0.1)})`;
      g.beginPath();
      g.arc(R(0, w), R(0, h), R(6, 70), 0, 7);
      g.fill();
    }
  });
  ft.repeat.set(5, 5);
  const floor = new Mesh(new PlaneGeometry(20, 24), new MeshStandardMaterial({ map: ft, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.z = -3;
  group.add(floor);

  // Walls.
  const plane = (w: number, h: number, x: number, y: number, z: number, ry: number, u: number, v: number) => {
    const m = new Mesh(new PlaneGeometry(w, h), wallMat(u, v));
    m.position.set(x, y, z);
    m.rotation.y = ry;
    group.add(m);
  };
  plane(24, H, -10, H / 2, -3, Math.PI / 2, 6, 1.6);
  plane(24, H, 10, H / 2, -3, -Math.PI / 2, 6, 1.6);
  plane(20, H, 0, H / 2, -15, 0, 5, 1.6);
  plane(20, H, 0, H / 2, 9, Math.PI, 5, 1.6);
  // Dividing wall with round arch.
  const sh = new Shape();
  sh.moveTo(-10, 0);
  sh.lineTo(10, 0);
  sh.lineTo(10, H);
  sh.lineTo(-10, H);
  sh.lineTo(-10, 0);
  const ho = new Path();
  ho.moveTo(-2, 0);
  ho.lineTo(-2, 3.4);
  ho.absarc(0, 3.4, 2, Math.PI, 0, true);
  ho.lineTo(2, 0);
  ho.lineTo(-2, 0);
  sh.holes.push(ho);
  const dw = new Mesh(new ExtrudeGeometry(sh, { depth: 0.7, bevelEnabled: false }), wallMat(0.25, 0.25));
  dw.position.z = -4.35;
  group.add(dw);
  // Niche on back wall.
  const niche = new Shape();
  niche.moveTo(-1.6, 0);
  niche.lineTo(-1.6, 3);
  niche.absarc(0, 3, 1.6, Math.PI, 0, true);
  niche.lineTo(1.6, 0);
  const nm = new Mesh(new ShapeGeometry(niche), new MeshStandardMaterial({ color: 0x7d7164, roughness: 1 }));
  nm.position.set(5, 0, -14.95);
  group.add(nm);
  // Rubble at the foot of the left wall.
  const rub = new MeshStandardMaterial({ color: 0x9a8f7c, roughness: 1 });
  for (let i = 0; i < 14; i++) {
    const b = new Mesh(new BoxGeometry(R(0.4, 0.9), R(0.3, 0.6), R(0.4, 0.9)), rub);
    b.position.set(-9.4 + R(-0.2, 0.5), 0.2 + R(0, 0.25), -3 + R(-2, 2));
    b.rotation.set(R(0, 0.4), R(0, 3), R(0, 0.4));
    group.add(b);
    void i;
  }

  // Ceiling + beams.
  const cl = new Mesh(new PlaneGeometry(20, 24), new MeshStandardMaterial({ color: 0xd8d2c4, side: DoubleSide }));
  cl.rotation.x = Math.PI / 2;
  cl.position.set(0, H, -3);
  group.add(cl);
  const beam = new MeshStandardMaterial({ color: 0x4a3528, roughness: 0.8 });
  for (let i = -3; i <= 3; i++) {
    const b = new Mesh(new BoxGeometry(0.35, 0.4, 24), beam);
    b.position.set(i * 3, H - 0.2, -3);
    group.add(b);
  }
  // Track lights.
  const glow = new MeshBasicMaterial({ color: 0xffffff });
  const wire = new MeshBasicMaterial({ color: 0x222222 });
  for (const [x, z] of [
    [-4, 3],
    [0, 3],
    [4, 3],
    [-5, -8],
    [0, -8],
    [5, -8],
    [-4, -1],
    [4, -1],
  ] as const) {
    const w = new Mesh(new CylinderGeometry(0.01, 0.01, 1.2, 4), wire);
    w.position.set(x, H - 0.6, z);
    group.add(w);
    const l = new Mesh(new BoxGeometry(1.3, 0.07, 0.14), glow);
    l.position.set(x, H - 1.2, z);
    group.add(l);
  }

  // Paintings.
  const frameM = new MeshStandardMaterial({ color: 0x3b2a1c, roughness: 0.7 });
  const hang = (x: number, y: number, z: number, ry: number, w: number, h: number, kind: string) => {
    const g = new Group();
    g.position.set(x, y, z);
    g.rotation.y = ry;
    g.add(new Mesh(new BoxGeometry(w + 0.1, h + 0.1, 0.06), frameM));
    const p = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: pierreArt(kind), roughness: 0.9 }));
    p.position.z = 0.04;
    g.add(p);
    group.add(g);
  };
  hang(-9.9, 2.3, -2.5, Math.PI / 2, 2.2, 2.6, "collage"); // left wall
  hang(-6, 2.4, -3.6, 0, 1.4, 2.6, "vivid"); // dividing wall
  hang(6, 2.3, -3.6, 0, 2.2, 1.7, "red");
  hang(-3.4, 2.4, -14.9, 0, 1.4, 2.6, "vivid"); // back wall
  hang(0, 2.6, -14.9, 0, 0.9, 1.5, "red");
  hang(5, 1.9, -14.85, 0, 2, 1.5, "red");
  hang(9.9, 2.3, -8, -Math.PI / 2, 1.6, 2.4, "vivid");

  // Concrete plinth with small frames.
  const pl = new Mesh(new BoxGeometry(2.6, 0.5, 1.5), new MeshStandardMaterial({ color: 0x8d8a82, roughness: 1 }));
  pl.position.set(6.2, 0.25, 1);
  group.add(pl);
  for (let i = 0; i < 4; i++) {
    const f = new Mesh(
      new BoxGeometry(0.4, 0.5, 0.03),
      new MeshStandardMaterial({ color: 0xe8e8e8, metalness: 0.4, roughness: 0.4 }),
    );
    f.position.set(5.4 + i * 0.5, 0.78, 0.9);
    f.rotation.x = -0.25;
    group.add(f);
  }
}

// ---- 6, 7, 8. Trois galeries (Musée / Galerie / Salle parquet) ---------
// Shared helpers of the file: sunL / wall / art / head.
function troisSunL(
  parent: Group,
  x: number,
  y: number,
  z: number,
  tx: number,
  tz: number,
  i: number,
  ext: number,
) {
  const d = new DirectionalLight(0xfff1dc, i);
  d.position.set(x, y, z);
  d.target.position.set(tx, 0, tz);
  d.castShadow = true;
  d.shadow.mapSize.set(2048, 2048);
  d.shadow.radius = 6;
  d.shadow.blurSamples = 16;
  d.shadow.bias = -0.0003;
  Object.assign(d.shadow.camera, { left: -ext, right: ext, top: ext, bottom: -ext, near: 2, far: 80 });
  parent.add(d);
  parent.add(d.target);
}

function troisArt(
  parent: Group,
  x: number,
  y: number,
  z: number,
  ry: number,
  w: number,
  h: number,
  t: Texture,
  fc?: number | null,
  fw = 0.07,
  par?: Group,
) {
  const g = new Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  const fr = fc !== undefined && fc !== null;
  const b = new Mesh(
    new BoxGeometry(w + (fr ? fw * 2 : 0), h + (fr ? fw * 2 : 0), fr ? 0.07 : 0.05),
    gMat(fr ? (fc as number) : 0xeeeeee, 0.5),
  );
  b.castShadow = true;
  g.add(b);
  const p = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: t, roughness: 0.7 }));
  p.position.z = fr ? 0.037 : 0.027;
  g.add(p);
  (par ?? parent).add(g);
}

function troisHead(parent: Group, x: number, y: number, z: number) {
  const h = new Mesh(new CylinderGeometry(0.05, 0.07, 0.18, 8), gMat(0x111111, 0.4, 0.5));
  h.position.set(x, y, z);
  h.rotation.z = R(-0.4, 0.4);
  parent.add(h);
}

function buildMusee(group: Group): void {
  group.add(new HemisphereLight(0xfff6ea, 0xb0a590, 0.35));
  troisSunL(group, 3, 22, 8, 0, -4, 1.5, 18);
  const pln = (w: number, h: number, mat: Material, x: number, y: number, z: number, rx = 0, ry = 0) =>
    gPlane(w, h, mat, x, y, z, rx, ry, group);
  const wall = (w: number, h: number, hex: string, x: number, y: number, z: number, ry: number) =>
    pln(w, h, troisWallMat(hex, w, h), x, y, z, 0, ry);
  const ft = herring(38, 38, 74, [40 / 3.4, 40 / 3.4]);
  pln(40, 40, new MeshStandardMaterial({ map: ft, roughness: 0.42, envMapIntensity: 0.8 }), 0, 0, 0, -Math.PI / 2);
  // Coffered skylight.
  const cg = new Group();
  cg.rotation.y = 0.5;
  cg.position.y = 6.5;
  group.add(cg);
  const lum = new Mesh(new PlaneGeometry(80, 80), new MeshBasicMaterial({ color: 0xfff7ea }));
  lum.rotation.x = Math.PI / 2;
  cg.add(lum);
  const bm = gMat(0x7a6755, 0.7);
  for (let i = -28; i <= 28; i++) {
    const a = new Mesh(new BoxGeometry(0.16, 0.35, 80), bm);
    a.position.set(i * 1.5, 0.17, 0);
    cg.add(a);
    const b = new Mesh(new BoxGeometry(80, 0.35, 0.16), bm);
    b.position.set(0, 0.17, i * 1.5);
    cg.add(b);
  }
  for (const [x, z] of [
    [-7, 2],
    [7, 2],
    [0, -3],
    [0, 6],
  ] as const) {
    const l = new PointLight(0xfff0dc, 0.8, 26, 1.5);
    l.position.set(x, 5.6, z);
    group.add(l);
  }
  wall(40, 6.5, "#cbc7c1", -14, 3.25, 0, Math.PI / 2);
  wall(40, 6.5, "#cbc7c1", 14, 3.25, 0, -Math.PI / 2);
  wall(28, 6.5, "#cbc7c1", 0, 3.25, 12, Math.PI);
  wall(28, 6.5, "#9a948c", 0, 3.25, -12, 0);
  // Curved blue wall.
  const cw = new Mesh(
    new CylinderGeometry(11, 11, 4.6, 72, 1, true, Math.PI - 0.62, 1.24),
    new MeshStandardMaterial({ map: plasterT("#7f9db8", [4, 1.5]), roughness: 0.95, side: BackSide }),
  );
  cw.position.set(0, 2.3, 3);
  cw.receiveShadow = true;
  group.add(cw);
  const up = new Mesh(
    new CylinderGeometry(11.05, 11.05, 1.9, 72, 1, true, Math.PI - 0.62, 1.24),
    new MeshStandardMaterial({ color: 0x5a5755, roughness: 0.95, side: BackSide }),
  );
  up.position.set(0, 5.55, 3);
  group.add(up);
  const pb = new Mesh(
    new CylinderGeometry(10.65, 10.65, 0.3, 72, 1, true, Math.PI - 0.62, 1.24),
    new MeshStandardMaterial({ color: 0x48525c, roughness: 0.7, side: BackSide }),
  );
  pb.position.set(0, 0.15, 3);
  group.add(pb);
  troisArt(group, 0, 2.3, -7.93, 0, 3.2, 2.1, troisPaint("view", 384, 256), 0x0f0f0f, 0.09);
  // Angled panels.
  for (const s of [-1, 1]) {
    const g = new Group();
    g.position.set(s * 7.6, 0, -4.6);
    g.rotation.y = -s * 0.45;
    group.add(g);
    gBox(6, 4.9, 0.55, troisWallMat("#b7acb0", 6, 4.9), 0, 2.45, 0, 0, g);
    gBox(6.1, 0.1, 0.6, gMat(0x6b6264, 0.8), 0, 4.92, 0, 0, g);
    troisArt(group, s * 1.1, 2.5, 0.29, 0, 2.1, 2.5, troisPaint("sea", 256, 300), 0x0f0f0f, 0.08, g);
    troisArt(group, -s * 1.7, 2.7, 0.29, 0, 0.75, 0.65, troisPaint("sea"), 0xa8844a, 0.05, g);
    troisArt(group, -s * 1.7, 1.6, 0.29, 0, 0.45, 0.55, troisPaint("tiny"), 0x1a1a1a, 0.04, g);
  }
  // Side-wall small pictures.
  const pick2 = () => [0x2a2420, 0xa8844a, 0x1a1a1a][(Math.random() * 3) | 0];
  for (const s of [-1, 1])
    for (let i = 0; i < 7; i++) {
      const z = -9 + i * 2.6;
      troisArt(group, s * 13.95, 2.1 + R(-0.2, 0.3), z, (-s * Math.PI) / 2, R(0.6, 1.1), R(0.5, 0.8), troisPaint("tiny"), pick2(), 0.05);
    }
  // Wire benches.
  const wire = (x: number, z: number, w: number, d: number, h: number) => {
    const g = new Group();
    g.position.set(x, 0, z);
    group.add(g);
    const r = gMat(0x2d2d2d, 0.4, 0.7);
    for (const [a, b] of [
      [-w / 2, -d / 2],
      [w / 2, -d / 2],
      [-w / 2, d / 2],
      [w / 2, d / 2],
    ] as const)
      gCyl(0.013, 0.013, h, r, a, h / 2, b, g);
    for (const s of [-1, 1]) {
      gBox(w, 0.025, 0.025, r, 0, h, (s * d) / 2, 0, g);
      gBox(0.025, 0.025, d, r, (s * w) / 2, h, 0, 0, g);
      gBox(w, 0.02, 0.02, r, 0, 0.14, (s * d) / 2, 0, g);
    }
  };
  wire(0, -5.4, 2.6, 0.6, 0.42);
  wire(5.2, -1.2, 2.2, 0.6, 0.42);
}

function buildGalerie(group: Group): void {
  group.add(new HemisphereLight(0xffffff, 0x77746f, 0.4));
  const pln = (w: number, h: number, mat: Material, x: number, y: number, z: number, rx = 0, ry = 0) =>
    gPlane(w, h, mat, x, y, z, rx, ry, group);
  const wall = (w: number, h: number, hex: string, x: number, y: number, z: number, ry: number) =>
    pln(w, h, troisWallMat(hex, w, h), x, y, z, 0, ry);
  const ft = gTex(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = "#3e4044";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1600; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "0,0,0"},${R(0.02, 0.07)})`;
        g.beginPath();
        g.arc(R(0, w), R(0, h), R(1, 20), 0, 7);
        g.fill();
      }
    },
    [4, 7],
  );
  pln(11, 23, new MeshStandardMaterial({ map: ft, roughness: 0.25, metalness: 0.1, envMapIntensity: 1 }), -0.5, 0, -1.5, -Math.PI / 2);
  const HH = 7.6;
  wall(23, HH, "#f1efea", -6, HH / 2, -1.5, Math.PI / 2);
  wall(23, HH, "#f1efea", 5, HH / 2, -1.5, -Math.PI / 2);
  wall(11, HH, "#f1efea", -0.5, HH / 2, -13, 0);
  wall(11, HH, "#f1efea", -0.5, HH / 2, 10, Math.PI);
  pln(11, 23, gMat(0xf6f4f0, 1), -0.5, HH, -1.5, Math.PI / 2);
  // Skirting shadow gap + white ledges.
  const dk = gMat(0x1b1b1c, 0.6);
  for (const [w, d, x, z] of [
    [0.04, 23, -5.97, -1.5],
    [0.04, 23, 4.97, -1.5],
    [11, 0.04, -0.5, -12.97],
  ] as const)
    gBox(w, 0.14, d, dk, x, 0.07, z, 0, group, false);
  gBox(0.8, 0.45, 19, gMat(0xf4f3ef, 0.7), 4.55, 0.225, -3.5, 0, group);
  gBox(0.8, 0.45, 14, gMat(0xf4f3ef, 0.7), -5.55, 0.225, -6, 0, group);
  gBox(1.4, 0.45, 1.8, gMat(0xf4f3ef, 0.7), -5.2, 0.225, 2.2, 0, group);
  // Huge folk painting + others.
  troisArt(group, 4.97, 3.6, -5, -Math.PI / 2, 9, 3.6, troisPaint("folk", 640, 256));
  troisArt(group, 4.97, 3.3, -11.2, -Math.PI / 2, 1.4, 1.1, troisPaint("face"));
  troisArt(group, -5.97, 2.7, -1.5, Math.PI / 2, 1.5, 2, troisPaint("face"));
  troisArt(group, -5.97, 2.9, -4.6, Math.PI / 2, 1.1, 1.5, troisPaint("face"));
  troisArt(group, -5.97, 2.5, -6.2, Math.PI / 2, 0.9, 1.3, troisPaint("dark"));
  troisArt(group, -5.97, 4.9, -3, Math.PI / 2, 1.9, 2.6, troisPaint("dark"));
  troisArt(group, 1.4, 3.2, -12.97, 0, 2.2, 3.0, troisPaint("fields", 256, 340));
  for (const [x, y, w, h, k] of [
    [-2.6, 3.6, 0.7, 0.8, "face"],
    [-1.6, 3.6, 0.7, 0.8, "folk"],
    [-2.6, 2.5, 0.7, 0.9, "face"],
    [-1.6, 2.5, 0.7, 0.9, "dark"],
  ] as const)
    troisArt(group, x, y, -12.97, 0, w, h, troisPaint(k), 0x2a1a10, 0.05);
  troisArt(group, -3.2, 6.2, -12.97, 0, 1.5, 2, troisPaint("dark"));
  // Text vinyl on foreground left wall.
  const tt = gTex(1024, 1000, (g, w, h) => {
    g.fillStyle = "#1b1b1d";
    g.font = "bold 70px Helvetica,Arial,sans-serif";
    g.fillText("TITRE DE L'EXPOSITION :", 30, 90);
    g.font = "bold 58px Helvetica,Arial,sans-serif";
    g.fillText("Rêves et possibilités…", 30, 160);
    g.font = "italic 25px Georgia,serif";
    const L =
      "Réunissant plus de quarante ans de création, cette exposition présente des œuvres où la mémoire, la couleur et l'imaginaire se rencontrent. ";
    for (let i = 0; i < 20; i++) {
      g.fillStyle = "#2a2a2c";
      g.fillText(L.slice((i % 3) * 10, (i % 3) * 10 + 52), 30, 230 + i * 32);
    }
    g.fillStyle = "#1e3a8a";
    g.fillRect(780, 760, 200, 200);
    g.fillStyle = "#fff";
    for (let i = 0; i < 8; i++) g.fillRect(795, 780 + i * 20, 170, 6);
    void w;
    void h;
  });
  const tm = new Mesh(new PlaneGeometry(5.6, 5.5), new MeshBasicMaterial({ map: tt, transparent: true }));
  tm.position.set(-5.97, 3.6, 4.7);
  tm.rotation.y = Math.PI / 2;
  group.add(tm);
  // High clerestory window + mullions.
  const gm = new MeshBasicMaterial({ color: 0xe6eef6 });
  const wg = new Mesh(new PlaneGeometry(6.6, 2.4), gm);
  wg.position.set(1.4, 6.6, -12.96);
  group.add(wg);
  const bk = gMat(0x141414, 0.5);
  for (let i = 0; i <= 4; i++) gBox(0.1, 2.5, 0.1, bk, -1.9 + i * 1.65, 6.6, -12.93, 0, group, false);
  for (const y of [5.35, 6.6, 7.85]) gBox(6.7, 0.1, 0.1, bk, 1.4, y, -12.93, 0, group, false);
  // Track rail + spots.
  gBox(0.08, 0.08, 22, gMat(0x222222, 0.4, 0.6), -3.2, 7.2, -1.5, 0, group, false);
  for (let z = 8; z > -12; z -= 1.7) troisHead(group, -3.2, 7.05, z);
  for (const [z, tx, tz, ty] of [
    [3, 4.9, -4, 3.4],
    [-3, -5.9, -2, 2.6],
    [-8, 1.4, -12.9, 3],
  ] as const) {
    const l = new SpotLight(0xfff0dc, 2.2, 22, 0.6, 0.6, 1);
    l.position.set(-3.2, 7, z);
    l.target.position.set(tx, ty, tz);
    l.castShadow = true;
    l.shadow.mapSize.set(1024, 1024);
    l.shadow.bias = -0.0004;
    group.add(l);
    group.add(l.target);
  }
  // Wooden slat bench.
  const bg = new Group();
  bg.position.set(1.2, 0, -7.5);
  group.add(bg);
  const wd = gMat(0xb98a58, 0.6);
  for (let i = 0; i < 7; i++) gBox(1.8, 0.04, 0.1, wd, 0, 0.46, -0.33 + i * 0.11, 0, bg);
  for (const x of [-0.8, 0.8])
    for (const z of [-0.3, 0.3]) gCyl(0.02, 0.02, 0.46, gMat(0x1a1a1a, 0.5, 0.5), x, 0.23, z, bg);
}

function buildParquet(group: Group): void {
  group.add(new HemisphereLight(0xfff4e4, 0xb9895a, 0.4));
  troisSunL(group, -9, 16, 9, 0, -2, 2.1, 18);
  const pln = (w: number, h: number, mat: Material, x: number, y: number, z: number, rx = 0, ry = 0) =>
    gPlane(w, h, mat, x, y, z, rx, ry, group);
  const wall = (w: number, h: number, hex: string, x: number, y: number, z: number, ry: number) =>
    pln(w, h, troisWallMat(hex, w, h), x, y, z, 0, ry);
  pln(
    24,
    23,
    new MeshStandardMaterial({ map: herring(28, 64, 52, [24 / 5.1, 23 / 5.1]), roughness: 0.45, envMapIntensity: 0.7 }),
    0,
    0,
    0.5,
    -Math.PI / 2,
  );
  const HH = 7.2;
  wall(23, HH, "#f3f1ec", 0, HH / 2, -10, 0);
  wall(23, HH, "#f1efea", -12, HH / 2, 0.5, Math.PI / 2);
  wall(23, HH, "#f1efea", 12, HH / 2, 0.5, -Math.PI / 2);
  wall(24, HH, "#f1efea", 0, HH / 2, 12, Math.PI);
  pln(24, 23, gMat(0xf6f4f0, 1), 0, HH, 0.5, Math.PI / 2);
  gBox(24, 0.2, 0.06, gMat(0xb78450, 0.6), 0, 0.1, -9.97, 0, group, false);
  // Salon hanging on back wall.
  for (const [x, y, w, h, k] of [
    [-10.2, 1.8, 0.9, 0.8, "tri"],
    [-8.7, 2.1, 0.9, 0.9, "geo"],
    [-7, 2.4, 1.5, 1.3, "grid"],
    [-5.2, 2.0, 0.8, 0.9, "dark"],
    [-3.9, 2.3, 0.9, 0.9, "tri"],
    [-2.2, 3.6, 1.6, 1.5, "geo"],
    [-10.8, 2.8, 0.6, 0.7, "dark"],
    [3.4, 2.2, 0.5, 0.7, "dark"],
    [4.3, 2.2, 0.5, 0.8, "dark"],
    [5.7, 2.3, 1.1, 0.75, "view"],
    [9.2, 2.4, 1.5, 1.4, "dark"],
    [7.6, 1.9, 0.5, 0.6, "tiny"],
    [-1.4, 2.0, 0.7, 0.7, "grid"],
  ] as const)
    troisArt(group, x, y, -9.96, 0, w, h, troisPaint(k), R(0, 1) < 0.5 ? 0x1a1a1a : null, 0.04);
  // V panels with wooden lintel and passage behind.
  for (const s of [-1, 1]) {
    const g = new Group();
    g.position.set(s * 1.9, 0, -5.6);
    g.rotation.y = -s * 0.75;
    group.add(g);
    gBox(3.2, 3.8, 0.18, troisWallMat("#f4f2ee", 3.2, 3.8), 0, 1.9, 0, 0, g);
    troisArt(group, -s * 0.55, 2, 0.1, 0, 1.0, 1.3, troisPaint("dark"), 0x1a1a1a, 0.04, g);
    troisArt(group, s * 0.6, 1.6, 0.1, 0, 0.5, 0.7, troisPaint("tri"), 0x3a2a1a, 0.03, g);
  }
  gBox(2.2, 0.3, 0.3, gMat(0xc89a62, 0.6), 0, 3.9, -6.7, 0, group);
  pln(1.6, 3, troisWallMat("#d8d2c4", 1.6, 3), 0, 1.5, -9.6, 0, 0);
  pln(2.4, 3.2, gMat(0x8a9a8a, 0.5), 0, 0.01, -8.3, -Math.PI / 2);
  // Foreground wall fragments.
  gBox(0.3, 4.6, 6, troisWallMat("#f4f2ee", 6, 4.6), -9.6, 2.3, 1, 0, group);
  troisArt(group, -9.43, 2.3, 0, Math.PI / 2, 0.9, 1.1, troisPaint("tri"), 0x9a7a4a, 0.06);
  troisArt(group, -9.43, 1.3, 2.2, Math.PI / 2, 0.8, 0.9, troisPaint("dark"), 0x9a7a4a, 0.06);
  gBox(0.3, 4.6, 7, troisWallMat("#f4f2ee", 7, 4.6), 9, 2.3, -1, 0, group);
  troisArt(group, 8.83, 2.2, -0.5, -Math.PI / 2, 0.8, 1.2, troisPaint("dark"), 0x9a7a4a, 0.05);
  troisArt(group, 8.83, 1.3, 1.4, -Math.PI / 2, 1.2, 1.3, troisPaint("dark"), 0x1a1a1a, 0.05);
  // Pedestals + sculptures.
  const wp = gMat(0xf8f7f4, 0.8);
  const ao = gTex(128, 128, (g, w, h) => {
    const r = g.createRadialGradient(64, 64, 16, 64, 64, 64);
    r.addColorStop(0, "rgba(0,0,0,.4)");
    r.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = r;
    g.fillRect(0, 0, w, h);
  });
  const ped = (x: number, z: number, w: number, h: number) => {
    gBox(w, h, w, wp, x, h / 2, z, 0, group);
    const a = new Mesh(new PlaneGeometry(w * 3, w * 3), new MeshBasicMaterial({ map: ao, transparent: true, depthWrite: false }));
    a.rotation.x = -Math.PI / 2;
    a.position.set(x, 0.012, z);
    group.add(a);
    return h;
  };
  let h = ped(-6.6, -6.6, 0.8, 1.3);
  let m = new Mesh(jit(new DodecahedronGeometry(0.3, 0), 0.05), gMat(0x8f9096, 0.4, 0.3));
  m.position.set(-6.6, h + 0.3, -6.6);
  m.castShadow = true;
  group.add(m);
  h = ped(-0.3, -2.4, 0.6, 1.15);
  m = new Mesh(jit(new CylinderGeometry(0.14, 0.2, 0.4, 10, 3), 0.03), gMat(0x5f6a58, 0.6, 0.2));
  m.position.set(-0.3, h + 0.2, -2.4);
  m.castShadow = true;
  group.add(m);
  h = ped(5.6, -8.2, 0.7, 0.8);
  m = new Mesh(jit(new IcosahedronGeometry(0.28, 1), 0.06), gMat(0x111111, 0.35, 0.4));
  m.position.set(5.6, h + 0.28, -8.2);
  m.castShadow = true;
  group.add(m);
  h = ped(7.2, 3.2, 0.7, 0.95);
  m = new Mesh(new SphereGeometry(0.1, 10, 8), gMat(0xd8aa40, 0.3, 0.9));
  m.position.set(7.2, h + 0.1, 3.2);
  group.add(m);
  // Standing mobile.
  const mb = new Group();
  mb.position.set(7.4, 0, -7);
  group.add(mb);
  const bk = gMat(0x141414, 0.5);
  gCyl(0.012, 0.02, 2.6, bk, 0, 1.3, 0, mb);
  for (const [y, a, l] of [
    [2.6, 0.4, 1.4],
    [2.2, -0.7, 1.0],
    [1.7, 1.2, 0.8],
  ] as const) {
    gBox(l, 0.012, 0.012, bk, Math.cos(a) * (l / 2), y, Math.sin(a) * (l / 2), -a, mb);
    const lf = new Mesh(new CircleGeometry(0.12, 16), new MeshStandardMaterial({ color: 0x141414, side: DoubleSide }));
    lf.scale.set(1, 1.6, 1);
    lf.position.set(Math.cos(a) * l, y - 0.18, Math.sin(a) * l);
    lf.castShadow = true;
    mb.add(lf);
  }
  // Pale green ottoman + black side table.
  gBox(2.8, 0.12, 1.7, wp, 0, 0.06, 3.8, 0, group);
  gBox(2.65, 0.36, 1.55, gMat(0xcfe0cb, 0.95), 0, 0.3, 3.8, 0, group);
  const sg = new Group();
  sg.position.set(-2.5, 0, 3.6);
  group.add(sg);
  gBox(0.5, 0.04, 0.5, gMat(0x151515, 0.4), 0, 0.55, 0, 0, sg);
  for (const a of [-0.2, 0.2])
    for (const b of [-0.2, 0.2]) gCyl(0.012, 0.012, 0.55, gMat(0x151515), a, 0.275, b, sg);
}

// ---- 9. La Verrière (Virtual_Gallery_1) ----------------------------------
// 40 × 32 m, 7.5 m high: parquet floor, coffered ceiling with glass
// skylights, five leaning panels (A–E) with paintings, bench and label.
function buildVerriere(group: Group): void {
  const H = 7.5;
  group.add(new HemisphereLight(0xffffff, 0xb8b0a6, 0.85));
  const cl = new Mesh(new PlaneGeometry(100, 100), new MeshBasicMaterial({ color: 0xf2f0eb }));
  cl.rotation.x = Math.PI / 2;
  cl.position.set(0, H, 0);
  cl.castShadow = true;
  group.add(cl);

  // Parquet floor.
  const ft = gTex(512, 512, (g, w, h) => {
    g.fillStyle = "#c59c63";
    g.fillRect(0, 0, w, h);
    for (let y = 0; y < 4; y++)
      for (let x = 0; x < 4; x++) {
        g.fillStyle = `hsl(${R(30, 40)},${R(42, 54)}%,${R(44, 57)}%)`;
        g.fillRect(x * 128 + 1, y * 128 + 1, 126, 126);
        g.strokeStyle = "rgba(0,0,0,.18)";
        g.strokeRect(x * 128, y * 128, 128, 128);
      }
  });
  ft.repeat.set(10, 8);
  const floor = new Mesh(new PlaneGeometry(40, 32), new MeshStandardMaterial({ map: ft, roughness: 0.6 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0, 0);
  floor.receiveShadow = true;
  group.add(floor);
  // Stone band + windows at the back.
  const stone = new Mesh(new PlaneGeometry(40, 3), new MeshStandardMaterial({ color: 0x8f8880, roughness: 1 }));
  stone.position.set(0, 1.5, -15.9);
  group.add(stone);
  const win = new Mesh(new PlaneGeometry(40, 4.5), new MeshStandardMaterial({ color: 0xdfe8f0, roughness: 0.2 }));
  win.position.set(0, 5.25, -15.9);
  group.add(win);
  const mull = new MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.8 });
  for (let x = -19; x <= 19; x += 4) {
    const m = new Mesh(new BoxGeometry(0.12, 4.5, 0.12), mull);
    m.position.set(x, 5.25, -15.8);
    group.add(m);
  }
  for (const [x, y, z] of [
    [-18, 3.8, -14],
    [0, 5.4, -14],
    [18, 3.8, -14],
  ] as const)
    gBox(0.6, 0.08, 0.5, new MeshStandardMaterial({ color: 0x777777, roughness: 0.4, metalness: 0.5 }), x, y, z, 0, group);

  // Walls.
  const wm = new MeshStandardMaterial({ color: 0xf5f3ee, roughness: 0.95 });
  for (const [w, d, x, z] of [
    [40, H, 0, 16],
    [32, H, -20, 0],
    [32, H, 20, 0],
  ] as const) {
    const m = new Mesh(new PlaneGeometry(w, d), wm);
    m.position.set(x, H / 2, z);
    m.rotation.y = z > 0 ? Math.PI : x < 0 ? Math.PI / 2 : -Math.PI / 2;
    group.add(m);
  }
  // Coffered ceiling + skylights (checkerboard).
  const beam = new MeshStandardMaterial({ color: 0x7c6e5d, roughness: 0.9 });
  for (let i = 0; i <= 10; i++) {
    gBox(0.6, 0.4, 32, beam, -20 + i * 4, H - 0.2, 0, 0, group);
    gBox(40, 0.4, 0.6, beam, 0, H - 0.2, -16 + i * 4, 0, group);
  }
  const glass = new MeshPhysicalMaterial({ color: 0xdfeef5, transparent: true, opacity: 0.5, roughness: 0.1 });
  for (let x = -18; x <= 18; x += 8)
    for (let z = -14; z <= 14; z += 8) {
      if ((Math.floor((x + 20) / 8) + Math.floor((z + 16) / 8)) % 2 === 0) continue;
      const s = new Mesh(new PlaneGeometry(3.6, 3.6), glass);
      s.rotation.x = Math.PI / 2;
      s.position.set(x, H - 0.05, z);
      group.add(s);
    }
  // Spotlights.
  const sp = new SpotLight(0xffe7bd, 1.8, 30, 0.7, 0.5, 1);
  sp.position.set(0, H - 0.3, 6);
  sp.target.position.set(0, 0, -5);
  sp.castShadow = true;
  group.add(sp);
  group.add(sp.target);
  const heads = new MeshStandardMaterial({ color: 0x111111, roughness: 0.4, metalness: 0.5 });
  for (let i = -2; i <= 2; i++) {
    const h = new Mesh(new CylinderGeometry(0.12, 0.18, 0.4, 8), heads);
    h.position.set(i * 6, H - 0.5, 12);
    h.rotation.x = 0.5;
    group.add(h);
  }

  // Five leaning panels A–E.
  const panels = [
    { name: "A", x: -12, z: -2, ry: -0.5 },
    { name: "B", x: -6, z: -2, ry: 0.3 },
    { name: "C", x: 0, z: -2, ry: -0.4 },
    { name: "D", x: 6, z: -2, ry: 0.4 },
    { name: "E", x: 12, z: -2, ry: -0.3 },
  ];
  const kinds = ["cloud", "ochre", "olive", "dark", "red"] as const;
  const frames = [0x2e4a62, 0xd2a64a, 0x7a7d4f, 0x1a1a1a, 0xb34a34] as const;
  panels.forEach(({ x, z, ry }, i) => {
    const g = new Group();
    g.position.set(x, 0, z);
    g.rotation.y = ry;
    g.rotation.x = -0.09;
    group.add(g);
    const p = new Mesh(new BoxGeometry(2.8, 2.8, 0.18), new MeshStandardMaterial({ color: 0xf5f3ee, roughness: 0.9 }));
    p.position.set(0, 1.4, 0);
    p.castShadow = true;
    p.receiveShadow = true;
    g.add(p);
    const fr = new Mesh(new BoxGeometry(1.4, 1.4, 0.06), new MeshStandardMaterial({ color: frames[i], roughness: 0.6 }));
    fr.position.set(0, 1.6, 0.12);
    g.add(fr);
    const a = new Mesh(new PlaneGeometry(1.2, 1.2), new MeshStandardMaterial({ map: verriereArt(kinds[i]), roughness: 0.85 }));
    a.position.set(0, 1.6, 0.16);
    g.add(a);
    const sh = new Mesh(new BoxGeometry(2.9, 0.1, 0.5), new MeshStandardMaterial({ color: 0x8f8880, roughness: 1 }));
    sh.position.set(0, 0.05, 0.3);
    g.add(sh);
    for (const s of [-1, 1]) {
      const c = new Mesh(new CylinderGeometry(0.02, 0.02, 2.2, 6), new MeshStandardMaterial({ color: 0x666666, metalness: 0.6, roughness: 0.5 }));
      c.position.set(s * 1.2, 5.8, -0.4);
      c.rotation.x = 0.4;
      group.add(c);
    }
  });
  // Bench + label lectern.
  const bench = new Mesh(new BoxGeometry(1.8, 0.5, 0.6), new MeshStandardMaterial({ color: 0x3b3a39, roughness: 0.8 }));
  bench.position.set(0, 0.25, 3.5);
  bench.castShadow = true;
  group.add(bench);
  const leg = new Mesh(new BoxGeometry(0.12, 0.4, 0.5), new MeshStandardMaterial({ color: 0x222222, metalness: 0.5, roughness: 0.4 }));
  leg.position.set(0, 0.65, 2.8);
  leg.rotation.x = 0.4;
  group.add(leg);
  const top = new Mesh(new BoxGeometry(0.5, 0.04, 0.35), new MeshStandardMaterial({ color: 0x1e1e1e, roughness: 0.6 }));
  top.position.set(0, 0.88, 2.65);
  top.rotation.x = -0.5;
  group.add(top);
}

// ---------------------------------------------------------------------------
// Galeries_3D.html — the eleven galleries (s1–s11)
// ---------------------------------------------------------------------------
//
// Shared helpers (the source's tex / M / bx / pl / frame / hemi / pt /
// sun / palm / tree / hall), ported exactly. Two deliberate changes,
// both required by Kabeya for these eleven galleries:
// - TREES use real photographs: palm trunks (a photo of a ringed palm
//   trunk), palm fronds (a photo of a frond), tree bark and foliage
//   (photos), instead of flat procedural colours.
// - EXTERIOR WINDOWS use real photographs: the sky (a photo of blue
//   sky and clouds), the garden view (a photo of palms and greenery),
//   the lawn (a photo of grass) and the glass bricks (a photo of a
//   glass-block wall), instead of gradients or emissive colours.
// The photos live in public/textures (see ATTRIBUTION.md there) and
// load through lib/gallery-photos.ts. Everything else — dimensions,
// walls, floors, ceilings, furniture, demo paintings — is ported
// exactly as in the source.

// The source's abstract `paint` generator (256 × 320, 30 ellipses).
function g11Paint(bg: string, cols: string[]): CanvasTexture {
  return gTex(256, 320, (g, w, h) => {
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 30; i++) {
      g.globalAlpha = R(0.3, 0.85);
      g.fillStyle = cols[(Math.random() * cols.length) | 0];
      g.beginPath();
      g.ellipse(R(20, w - 20), R(20, h - 20), R(8, 50), R(8, 60), R(0, 3), 0, 7);
      g.fill();
    }
  });
}

// The source's procedural textures (wood floors, tiles, coffers,
// speckled stone, marble, herringbone, scales, slats). Only the trees
// and exterior windows switch to photographs; the rest stays exactly
// as the source drew it.
function g11Wood(a: number, b: number): CanvasTexture {
  return gTex(
    512,
    512,
    (g, w, h) => {
      for (let i = 0; i < 8; i++) {
        g.fillStyle = `hsl(34,${R(40, 52)}%,${R(60, 70)}%)`;
        g.fillRect(i * 64, 0, 62, h);
        for (let j = 0; j < 50; j++) {
          g.strokeStyle = `rgba(110,70,30,${R(0.04, 0.12)})`;
          g.beginPath();
          const x = i * 64 + R(2, 60);
          g.moveTo(x, 0);
          g.lineTo(x + R(-3, 3), h);
          g.stroke();
        }
      }
    },
    [a, b],
  );
}

function g11Tiles(a: number, b: number): CanvasTexture {
  return gTex(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = "#e4e3de";
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < 16; y++)
        for (let x = 0; x < 16; x++) {
          g.fillStyle = `hsl(40,6%,${R(92, 98)}%)`;
          g.fillRect(x * 16 + 1, y * 16 + 1, 14, 14);
        }
    },
    [a, b],
  );
}

function g11Coffer(a: number, b: number): CanvasTexture {
  return gTex(
    128,
    128,
    (g) => {
      g.fillStyle = "#e6e1d6";
      g.fillRect(0, 0, 128, 128);
      g.fillStyle = "#b8b1a2";
      g.fillRect(14, 14, 100, 100);
      g.fillStyle = "#d8d2c5";
      g.fillRect(20, 20, 88, 88);
      g.strokeStyle = "#fff";
      g.strokeRect(14, 14, 100, 100);
    },
    [a, b],
  );
}

function g11Speck(base: string, dots: string[], a: number, b: number): CanvasTexture {
  return gTex(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = base;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 1800; i++) {
        g.fillStyle = dots[(Math.random() * dots.length) | 0];
        g.globalAlpha = R(0.2, 0.7);
        g.fillRect(R(0, w), R(0, h), R(1, 3), R(1, 3));
      }
    },
    [a, b],
  );
}

function g11Marble(a: number, b: number): CanvasTexture {
  return gTex(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = "#f6f6f5";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 14; i++) {
        g.strokeStyle = `rgba(150,150,155,${R(0.05, 0.14)})`;
        g.lineWidth = R(0.5, 2);
        g.beginPath();
        g.moveTo(R(0, w), 0);
        g.bezierCurveTo(R(0, w), h * 0.3, R(0, w), h * 0.6, R(0, w), h);
        g.stroke();
      }
    },
    [a, b],
  );
}

function g11Herr(l: number, a: number, b: number): CanvasTexture {
  return gTex(
    256,
    256,
    (g, w, h) => {
      g.fillStyle = `hsl(30,50%,${l - 10}%)`;
      g.fillRect(0, 0, w, h);
      for (let y = 0; y < 9; y++)
        for (let x = 0; x < 9; x++) {
          g.save();
          g.translate(x * 32, y * 32);
          g.rotate(((x + y) % 2 ? 1 : -1) * Math.PI / 4);
          g.fillStyle = `hsl(30,${R(45, 60)}%,${l + R(-6, 6)}%)`;
          g.fillRect(-14, -4, 28, 8);
          g.restore();
        }
    },
    [a, b],
  );
}

function g11Scal(a: number, b: number): CanvasTexture {
  return gTex(
    128,
    128,
    (g) => {
      g.fillStyle = "#d6d1c5";
      g.fillRect(0, 0, 128, 128);
      for (const x of [32, 96]) {
        const q = g.createRadialGradient(x, 128, 2, x, 128, 52);
        q.addColorStop(0, "#fff");
        q.addColorStop(1, "#ece8de");
        g.fillStyle = q;
        g.beginPath();
        g.moveTo(x - 28, 128);
        g.arc(x, 100, 28, Math.PI, 0);
        g.lineTo(x + 28, 128);
        g.fill();
      }
    },
    [a, b],
  );
}

function g11Slat(a: number, b: number): CanvasTexture {
  return gTex(
    128,
    128,
    (g) => {
      g.fillStyle = "#f7f7f6";
      g.fillRect(0, 0, 128, 128);
      for (let x = 0; x < 128; x += 10) {
        g.fillStyle = "rgba(120,120,125,.35)";
        g.fillRect(x, 0, 1.5, 128);
      }
    },
    [a, b],
  );
}

// The source's `frame` (a framed painting), `hemi` / `pt` / `sun`
// (lights), and the round-arch shape.
function g11Frame(parent: Group, w: number, h: number, t: Texture, x: number, y: number, z: number, ry: number, fc: number): void {
  const g = new Group();
  g.position.set(x, y, z);
  g.rotation.y = ry;
  parent.add(g);
  const b = new Mesh(new BoxGeometry(w + 0.2, h + 0.2, 0.08), gMat(fc, 0.4, 0.5));
  g.add(b);
  const p = new Mesh(new PlaneGeometry(w, h), new MeshStandardMaterial({ map: t, roughness: 0.7 }));
  p.position.z = 0.045;
  g.add(p);
}

function g11Hemi(parent: Group, a: number, b: number, i: number): void {
  parent.add(new HemisphereLight(a, b, i));
}

function g11Pt(parent: Group, c: number, i: number, x: number, y: number, z: number, d = 15): void {
  const l = new PointLight(c, i, d, 1.5);
  l.position.set(x, y, z);
  parent.add(l);
}

function g11Sun(parent: Group, x: number, y: number, z: number, i: number, e = 24): void {
  const l = new DirectionalLight(0xfff0d8, i);
  l.position.set(x, y, z);
  l.castShadow = true;
  l.shadow.mapSize.set(2048, 2048);
  Object.assign(l.shadow.camera, { left: -e, right: e, top: e, bottom: -e, near: 1, far: 90 });
  l.shadow.bias = -0.0003;
  parent.add(l);
}

function g11Glass(): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: 0xcfe9ee, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.22, side: DoubleSide });
}

function g11Emit(c = 0xffffff, i = 1.6): MeshStandardMaterial {
  return new MeshStandardMaterial({ color: c, roughness: 1, metalness: 0, emissive: c, emissiveIntensity: i });
}

function g11ArchGeo(): ShapeGeometry {
  const s = new Shape();
  s.moveTo(-0.8, 0);
  s.lineTo(-0.8, 2.4);
  s.absarc(0, 2.4, 0.8, Math.PI, 0, true);
  s.lineTo(0.8, 0);
  const geo = new ShapeGeometry(s);
  // ShapeGeometry UVs are the raw XY coordinates — remap them so a
  // photo texture covers the arch exactly once (x −0.8…0.8,
  // y 0…3.2). Without this the photo would tile 1.6 × 3.2 times
  // across the arch. Flat-colour uses are unaffected.
  const uv = geo.attributes.uv as BufferAttribute;
  const pos = geo.attributes.position as BufferAttribute;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, (pos.getX(i) + 0.8) / 1.6, pos.getY(i) / 3.2);
  }
  uv.needsUpdate = true;
  return geo;
}

// A real sky photograph wrapped around the scene (outdoor rooms).
function g11Sky(parent: Group, radius = 60, height = 30): void {
  const sky = new Mesh(
    new CylinderGeometry(radius, radius, height, 48, 1, true),
    new MeshBasicMaterial({ map: photoTexture(PHOTO.sky), side: BackSide }),
  );
  sky.position.y = height / 2;
  parent.add(sky);
}

// A palm: the trunk wears the ringed-trunk photograph, the fronds
// the frond photograph (the source's flat green is replaced, the
// geometry — a cylinder and eleven thin boxes — is unchanged). The
// frond photo's midrib runs along the box's long axis.
function g11Palm(parent: Group, x: number, z: number, h: number): void {
  const trunk = new Mesh(
    new CylinderGeometry(0.12, 0.2, h, 10),
    new MeshStandardMaterial({ map: photoTexture(PHOTO.palmTrunk, { repeat: [2, 1] }), roughness: 0.9 }),
  );
  trunk.position.set(x, h / 2, z);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  parent.add(trunk);
  const frondTex = photoTexture(PHOTO.palmFrond);
  frondTex.center.set(0.5, 0.5);
  frondTex.rotation = Math.PI / 2;
  const frondMat = new MeshStandardMaterial({ map: frondTex, roughness: 0.7, side: DoubleSide });
  const g = new Group();
  g.position.set(x, h, z);
  parent.add(g);
  for (let i = 0; i < 11; i++) {
    const f = new Group();
    f.rotation.y = i * 0.571;
    const m = new Mesh(new BoxGeometry(0.55, 0.02, 2.8), frondMat);
    m.position.set(0, -0.3, 1.3);
    m.rotation.x = 0.42;
    f.add(m);
    g.add(f);
  }
}

// A tree: the trunk wears the bark photograph, the canopy blobs the
// foliage photograph (the source's flat HSL greens are replaced, the
// geometry — a cylinder, nine icosahedra, three branch cylinders —
// is unchanged).
function g11Tree(parent: Group, x: number, z: number, h: number): void {
  const trunk = new Mesh(
    new CylinderGeometry(0.18, 0.26, h, 10),
    new MeshStandardMaterial({ map: photoTexture(PHOTO.treeBark, { repeat: [2, 1] }), roughness: 0.95 }),
  );
  trunk.position.set(x, h / 2, z);
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  parent.add(trunk);
  const leafMat = new MeshStandardMaterial({ map: photoTexture(PHOTO.foliage), roughness: 0.85 });
  for (let i = 0; i < 9; i++) {
    const o = new Mesh(new IcosahedronGeometry(R(1.2, 2.1), 1), leafMat);
    o.position.set(x + R(-2, 2), h * R(0.55, 1.05), z + R(-2, 2));
    o.castShadow = true;
    parent.add(o);
  }
  for (let i = 0; i < 3; i++) {
    const a = i * 2.09;
    const b = new Mesh(new CylinderGeometry(0.03, 0.03, 2.6, 6), gMat(0x333333, 0.5, 0.6));
    b.position.set(x + Math.sin(a) * 0.8, 1.1, z + Math.cos(a) * 0.8);
    b.rotation.set(-Math.cos(a) * 0.3, 0, Math.sin(a) * 0.3);
    parent.add(b);
  }
}

function buildPavillon(group: Group): void {
  const wd = new MeshStandardMaterial({ map: g11Wood(4, 8), roughness: 0.45 });
  // The glass-brick walls and ceiling: the real glass-block
  // photograph, still glowing from within as in the source.
  const tl = new MeshStandardMaterial({ map: photoTexture(PHOTO.glassBrick, { repeat: [5, 3] }), roughness: 0.9, emissive: 0xffffff, emissiveIntensity: 0.15 });
  const tc = new MeshStandardMaterial({ map: photoTexture(PHOTO.glassBrick, { repeat: [6, 11] }), roughness: 0.9, emissive: 0xffffff, emissiveIntensity: 0.35 });
  const oak = gMat(0xd9b27a, 0.6);
  gPlane(8, 14, wd, 0, 0, -1, -Math.PI / 2, 0, group);
  gPlane(8, 14, tc, 0, 4.2, -1, Math.PI / 2, 0, group);
  // The lawn behind the pavilion — a real grass photograph.
  gPlane(90, 90, new MeshStandardMaterial({ map: photoTexture(PHOTO.grass, { repeat: [18, 18] }), roughness: 1 }), 0, -0.05, -55, -Math.PI / 2, 0, group);
  g11Sky(group);
  const pa = [g11Paint("#2a4fa0", ["#f2c230", "#e0572a", "#111"]), g11Paint("#cfd8c9", ["#4a7a4a", "#8aa6b8", "#c9c2a8"])];
  for (const s of [-1, 1] as const) {
    const i = s > 0 ? 1 : 0;
    gBox(0.4, 4.2, 6.1, tl, s * 4.2, 2.1, 2.95, 0, group, false);
    gBox(0.4, 4.2, 6.1, tl, s * 4.2, 2.1, -4.95, 0, group, false);
    gBox(0.4, 1.6, 1.8, tl, s * 4.2, 3.4, -1, 0, group, false);
    gBox(0.5, 2.6, 0.12, oak, s * 4.1, 1.3, -1.96, 0, group, false);
    gBox(0.5, 2.6, 0.12, oak, s * 4.1, 1.3, -0.04, 0, group, false);
    gBox(0.5, 0.12, 2.0, oak, s * 4.1, 2.66, -1, 0, group, false);
    const rm = new Mesh(new BoxGeometry(3.6, 4.2, 4.2), new MeshStandardMaterial({ color: 0xf4f2ee, roughness: 0.9, side: BackSide }));
    rm.position.set(s * 6.2, 2.1, -1);
    group.add(rm);
    gPlane(3.6, 4.2, wd, s * 6.2, 0.01, -1, -Math.PI / 2, 0, group);
    g11Frame(group, 1.1, 1.5, pa[i], s * 7.95, 1.7, -1, (-s * Math.PI) / 2, 0x8a6a3a);
    g11Pt(group, 0xfff6ea, 0.5, s * 6.2, 3.6, -1, 8);
    gBox(0.04, 0.04, 14, g11Emit(0xffffff, 2), s * 3.95, 4.1, -1, 0, group, false);
  }
  for (const x of [-2.2, 0.7]) gBox(0.12, 4.2, 0.12, gMat(0x222222, 0.5, 0.6), x, 2.1, -8, 0, group, false);
  const wh = gMat(0xf5f5f3, 0.5);
  const br = gMat(0x5b3a24, 0.4, 0.6);
  const tc2 = gMat(0xd98a5e, 0.55);
  gBox(3.6, 0.14, 2.4, wh, 0, 0.07, -6.2, 0, group);
  gBox(0.8, 1.15, 0.8, wh, -0.6, 0.715, -6.1, 0, group);
  gBox(0.6, 1, 0.6, wh, 1.1, 0.64, -6.5, 0, group);
  const sp1 = new Mesh(new SphereGeometry(0.3, 24, 16), tc2);
  sp1.position.set(-0.6, 1.45, -6.1);
  sp1.scale.set(1, 1.1, 0.9);
  sp1.castShadow = true;
  group.add(sp1);
  const sp2 = new Mesh(new SphereGeometry(0.14, 24, 16), tc2);
  sp2.position.set(-0.55, 1.9, -6.1);
  group.add(sp2);
  gCyl(0.07, 0.1, 0.6, br, 1.1, 1.44, -6.5, group);
  const sp3 = new Mesh(new SphereGeometry(0.08, 24, 16), br);
  sp3.position.set(1.1, 1.84, -6.5);
  group.add(sp3);
  for (const [x, z, h] of [
    [-2.8, -12, 8],
    [-1.2, -14, 9.5],
    [0.6, -13, 8.5],
    [2.4, -12.5, 9],
    [-4.2, -15.5, 10],
    [4, -15, 9.5],
  ] as const)
    g11Palm(group, x, z, h);
  g11Hemi(group, 0xffffff, 0xb9b2a5, 0.8);
  g11Sun(group, 6, 10, 8, 1.2);
  g11Pt(group, 0xfff6ea, 0.6, 0, 3.6, 2);
  g11Pt(group, 0xfff6ea, 0.6, 0, 3.6, -4);
}

function buildClassique(group: Group): void {
  const L = 40;
  const H = 6.2;
  const Rv = 4;
  const gr = new MeshStandardMaterial({
    color: 0x8a857c,
    roughness: 0.35,
    metalness: 0.1,
    map: g11Speck("#6b6862", ["#8d8a84", "#4c4a46", "#a09d96"], 8, 40),
  });
  const wl = gMat(0xcfc8b8, 0.9);
  const dk = gMat(0x5d554a, 0.8);
  const st = gMat(0xe3ddd0, 0.8);
  const gran = new MeshStandardMaterial({
    color: 0x9a9a9c,
    roughness: 0.35,
    metalness: 0.1,
    map: g11Speck("#8e8e92", ["#c7c7ca", "#6a6a6e", "#a8a8ab"], 2, 6),
  });
  gPlane(8, L, gr, 0, 0, 0, -Math.PI / 2, 0, group);
  for (const s of [-1, 1] as const) {
    gBox(0.4, H, L, wl, s * 4.2, H / 2, 0, 0, group, false);
    gBox(0.12, 1, L, dk, s * 3.95, 0.5, 0, 0, group, false);
  }
  const v = new Mesh(
    new CylinderGeometry(Rv, Rv, L, 48, 1, true, Math.PI / 2, Math.PI),
    new MeshStandardMaterial({ map: g11Coffer(8, 18), roughness: 0.9, side: BackSide }),
  );
  v.rotation.x = Math.PI / 2;
  v.position.y = H;
  group.add(v);
  for (const z of [14.5, 4.5, -5.5, -15.5]) {
    const a = new Mesh(new TorusGeometry(Rv - 0.05, 0.3, 8, 40, Math.PI), st);
    a.position.set(0, H, z);
    group.add(a);
  }
  for (const s of [-1, 1] as const)
    for (const z of [12, 7, 2, -3, -8, -13]) {
      gCyl(0.42, 0.46, H - 0.5, gran, s * 3, H / 2 - 0.1, z, group);
      gBox(1.1, 0.35, 1.1, st, s * 3, H - 0.25, z, 0, group);
      gBox(0.95, 0.3, 0.95, st, s * 3, 0.15, z, 0, group);
    }
  for (const s of [-1, 1] as const)
    for (const z of [9.5, 3, -3.5, -10])
      g11Frame(group, 1.7, 2.5, g11Paint("#2a1c14", ["#8a3a1c", "#c9863a", "#3a4a5a", "#d8c9a8"]), s * 3.92, 3, z, (-s * Math.PI) / 2, 0xb08a3a);
  const lt = g11Emit(0xffffff, 1.6);
  for (const z of [-1, -10]) gPlane(2.6, 3.4, lt, 0, H + Rv - 0.08, z, Math.PI / 2, 0, group);
  const o = new Mesh(new CircleGeometry(1.6, 32), lt);
  o.rotation.x = Math.PI / 2;
  o.position.set(0, H + Rv - 0.08, 14);
  group.add(o);
  gPlane(8, 10.2, new MeshStandardMaterial({ color: 0xfff3de, roughness: 1, emissive: 0xfff3de, emissiveIntensity: 0.7 }), 0, 5.1, -19.9, 0, 0, group);
  gBox(0.5, 1.1, 0.5, st, -2.2, 0.55, 8.5, 0, group);
  const sculp = new Mesh(new SphereGeometry(0.2, 24, 16), gMat(0x8d8a84, 0.5));
  sculp.position.set(-2.2, 1.35, 8.5);
  sculp.scale.set(1, 1.2, 0.8);
  sculp.castShadow = true;
  group.add(sculp);
  g11Hemi(group, 0xfff0dd, 0x6a6258, 0.55);
  for (const z of [14, -1, -10]) g11Pt(group, 0xfff0d8, 1.3, 0, 9, z, 24);
}

function buildAtriumBlanc(group: Group): void {
  const rm = new Mesh(new BoxGeometry(26, 18, 27), new MeshStandardMaterial({ color: 0xf7f7f6, roughness: 0.85, side: BackSide }));
  rm.position.set(0, 0, -0.5);
  rm.receiveShadow = true;
  group.add(rm);
  gPlane(
    26,
    27,
    new MeshStandardMaterial({ map: g11Marble(4, 4), roughness: 0.06, metalness: 0.02, transparent: true, opacity: 0.75, envMapIntensity: 1.2 }),
    0,
    0.01,
    -0.5,
    -Math.PI / 2,
    0,
    group,
  );
  const wh = gMat(0xfafafa, 0.5);
  const blk = gMat(0x151515, 0.4, 0.3);
  const br = gMat(0x3a2c22, 0.4, 0.6);
  const gr = gMat(0x2f7a3e, 0.35, 0.1);
  const dg = new MeshStandardMaterial({ color: 0x0a0d12, roughness: 0.12, metalness: 0.9, side: DoubleSide, transparent: true, opacity: 0.92 });
  const drum = new Mesh(new CylinderGeometry(1, 1, 2.6, 48, 1, true), dg);
  drum.position.set(0, 7.7, -7);
  drum.scale.set(6.2, 1, 4.2);
  group.add(drum);
  const dd = new Mesh(new CircleGeometry(1, 48), new MeshStandardMaterial({ color: 0x05070a, roughness: 0.2, metalness: 0.8 }));
  dd.rotation.x = Math.PI / 2;
  dd.position.set(0, 6.4, -7);
  dd.scale.set(6.2, 4.2, 1);
  group.add(dd);
  const pts: number[] = [];
  for (let i = 0; i < 160; i++) {
    const a = R(0, 6.283);
    const r = Math.sqrt(Math.random());
    const x = Math.cos(a) * r * 5.8;
    const z = -7 + Math.sin(a) * r * 3.9;
    pts.push(x, 6.4, z, x, R(4.2, 6.3), z);
  }
  group.add(
    new LineSegments(
      new BufferGeometry().setAttribute("position", new Float32BufferAttribute(pts, 3)),
      new LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 }),
    ),
  );
  const dl = g11Emit(0xffffff, 2);
  for (let x = -10.8; x <= 11; x += 3.6)
    for (let z = -12; z <= 12; z += 4) gPlane(0.35, 0.35, dl, x, 8.95, z, Math.PI / 2, 0, group);
  // The reflection: the source mirrors the furniture below the
  // semi-transparent marble floor (its refl() helper) — the clone is
  // the same group with scale.y = −1.
  const reflGroup = new Group();
  group.add(reflGroup);
  const sph = (r: number, mat: Material, x: number, y: number, z: number, sx = 1, sy = 1, sz = 1) => {
    const o = new Mesh(new SphereGeometry(r, 24, 16), mat);
    o.position.set(x, y, z);
    o.scale.set(sx, sy, sz);
    o.castShadow = true;
    reflGroup.add(o);
  };
  for (const [cx, cz] of [
    [-5, -2],
    [6, -1],
    [-9, -9],
    [8, -10],
  ] as const) {
    const col = new Mesh(new CylinderGeometry(0.7, 0.7, 9, 32), wh);
    col.position.set(cx, 4.5, cz);
    reflGroup.add(col);
  }
  gBox(2.2, 0.8, 1, blk, -9.5, 0.4, -6.5, 0, reflGroup);
  sph(0.62, gr, -10, 1.3, -6.5, 1.5, 0.85, 0.7);
  sph(0.5, gr, -9.1, 1.25, -6.5, 1.4, 0.8, 0.65);
  gBox(0.5, 0.12, 0.4, blk, -3, 0.06, -5, 0, reflGroup);
  gCyl(0.12, 0.2, 1.5, br, -3, 0.87, -5, reflGroup);
  sph(0.11, br, -3, 1.75, -5);
  gBox(0.6, 1, 0.6, wh, -6.5, 0.5, -8.5, 0, reflGroup);
  sph(0.14, br, -6.5, 1.15, -8.5, 0.8, 1.2, 0.8);
  sph(2.4, wh, 0, 0.5, -11.5, 1.2, 0.28, 0.55);
  sph(1.6, wh, 0.6, 0.9, -11.5, 1, 0.3, 0.5);
  sph(1, wh, 1.2, 1.3, -11.5, 1, 0.3, 0.5);
  gBox(1, 0.05, 0.6, br, 4, 0.75, -8, 0, reflGroup);
  for (const [px, pz] of [
    [-0.45, -0.25],
    [0.45, -0.25],
    [-0.45, 0.25],
    [0.45, 0.25],
  ] as const)
    gBox(0.05, 0.75, 0.05, br, 4 + px, 0.37, -8 + pz, 0, reflGroup);
  gBox(0.4, 0.05, 0.4, br, 3, 0.45, -8, 0, reflGroup);
  sph(0.12, br, 3, 0.85, -8, 1, 1.4, 1);
  gBox(1.9, 0.14, 0.5, blk, 9, 2.7, -4, 0, reflGroup);
  gBox(0.14, 2.7, 0.5, blk, 8.1, 1.35, -4, 0, reflGroup);
  gBox(0.14, 2.7, 0.5, blk, 9.9, 1.35, -4, 0, reflGroup);
  gBox(2.2, 0.35, 0.9, blk, 9, 0.18, -4, 0, reflGroup);
  gCyl(0.04, 0.06, 0.7, br, 9.3, 0.7, -4, reflGroup, 8);
  const mirror = reflGroup.clone();
  mirror.scale.y = -1;
  group.add(mirror);
  g11Frame(group, 0.5, 0.7, g11Paint("#3a8a4a", ["#e8d36a", "#2a5a3a"]), -1.8, 2.2, -13.93, 0, 0x111111);
  g11Frame(group, 0.6, 0.75, g11Paint("#1c1c1c", ["#c8c8c8", "#666"]), -0.8, 2.2, -13.93, 0, 0x111111);
  g11Hemi(group, 0xffffff, 0xcfd3da, 1.1);
  g11Pt(group, 0xffffff, 0.6, 0, 7.5, -6, 30);
}

function buildPatio(group: Group): void {
  gPlane(120, 120, gMat(0xe4e4e4, 0.9), 0, -14, 0, -Math.PI / 2, 0, group);
  gPlane(
    44,
    44,
    new MeshStandardMaterial({ map: g11Marble(6, 6), roughness: 0.1, metalness: 0.02, transparent: true, opacity: 0.8 }),
    0,
    0.01,
    0,
    -Math.PI / 2,
    0,
    group,
  );
  const sh = new Shape();
  sh.moveTo(-22, -22);
  sh.lineTo(22, -22);
  sh.lineTo(22, 22);
  sh.lineTo(-22, 22);
  sh.closePath();
  const hole = new Path();
  hole.absellipse(0, 0, 9, 6, 0, Math.PI * 2, false);
  sh.holes.push(hole);
  const roof = new Mesh(new ExtrudeGeometry(sh, { depth: 0.8, bevelEnabled: false }), gMat(0xdedee0, 0.85));
  roof.rotation.x = -Math.PI / 2;
  roof.position.y = 4.5;
  roof.castShadow = true;
  roof.receiveShadow = true;
  group.add(roof);
  const w = new Mesh(
    new CylinderGeometry(21, 21, 4.5, 64, 1, true),
    new MeshStandardMaterial({ color: 0xf0f0ee, roughness: 0.9, side: BackSide }),
  );
  w.position.y = 2.25;
  group.add(w);
  const disc = (sx: number, sz: number, mat: Material, x: number, z: number, y: number) => {
    const o = new Mesh(new CircleGeometry(1, 48), mat);
    o.rotation.x = -Math.PI / 2;
    o.scale.set(sx, sz, 1);
    o.position.set(x, y, z);
    o.receiveShadow = true;
    group.add(o);
  };
  disc(8.2, 5.4, new MeshStandardMaterial({ map: g11Speck("#1c1c1e", ["#3a3a3d", "#555558", "#0c0c0d"], 3, 3), roughness: 0.95 }), 0, 0, 0.03);
  disc(2.6, 2.6, new MeshStandardMaterial({ map: g11Speck("#e6e6e3", ["#cfcfcb", "#f5f5f2"], 2, 2), roughness: 0.9 }), 0, -0.8, 0.04);
  disc(3.3, 1.9, new MeshStandardMaterial({ map: g11Speck("#4a8f36", ["#5aa844", "#3d7a2c", "#6bb552"], 3, 2), roughness: 0.95 }), 2.6, 2.3, 0.05);
  const T: [number, number, number][] = [
    [-4.5, -2, 12],
    [-2, -3.6, 13],
    [0.5, -2.6, 12.5],
    [3, -3.4, 11.5],
    [5.5, -0.6, 12],
    [-3.6, 1.2, 11],
    [1.5, 0.2, 11.5],
  ];
  // The trees grow through the oval roof opening and are mirrored in
  // the marble plaza (the source's refl()).
  const treeGroup = new Group();
  group.add(treeGroup);
  for (const t of T) g11Tree(treeGroup, t[0], t[1], t[2]);
  const mirror = treeGroup.clone();
  mirror.scale.y = -1;
  group.add(mirror);
  g11Sky(group);
  g11Hemi(group, 0xcfe6ff, 0xdadada, 0.9);
  g11Sun(group, 7, 20, 5, 2.3, 26);
}

// The parametric hall of Galeries_3D.html (s6–s9), ported exactly:
// floor, end walls, side walls, vault (or flat ceiling with skylight
// strips), panels, arches, luminous windows, track lights, benches,
// hemisphere + point lights.
type Hall11Options = {
  W?: number;
  L?: number;
  H?: number;
  wm: Material;
  fm: Material;
  v?: number;
  vaultTex?: CanvasTexture;
  vaultEmit?: number;
  flatCeil?: Material;
  pn?: number;
  fw?: number;
  fh?: number;
  fc?: number;
  pc?: string[];
  pb?: string;
  end?: Material;
  bn?: number;
  ar?: boolean;
  tr?: boolean;
  win?: boolean;
  sk?: boolean;
  hi?: number;
  pi?: number;
};

function hall11(parent: Group, o: Hall11Options): void {
  const W = o.W ?? 8;
  const L = o.L ?? 36;
  const H = o.H ?? 5.2;
  const wm = o.wm;
  const fm = o.fm;
  const v = o.v ?? 0;
  const pn = o.pn ?? 4;
  const fw = o.fw ?? 1.6;
  const fh = o.fh ?? 2.1;
  const fc = o.fc ?? 0xb08a3a;
  const pc = o.pc ?? ["#8a3a1c", "#c9863a", "#3a4a5a"];
  const pb = o.pb ?? "#2a1c14";
  const bn = o.bn ?? 0;
  const hw = W / 2;
  gPlane(W, L, fm, 0, 0, 0, -Math.PI / 2, 0, parent);
  gPlane(W, H, o.end ?? wm, 0, H / 2, -L / 2, 0, 0, parent);
  gPlane(W, H, wm, 0, H / 2, L / 2, 0, Math.PI, parent);
  for (const s of [-1, 1] as const) gBox(0.4, H, L, wm, s * (hw + 0.2), H / 2, 0, 0, parent, false);
  if (v) {
    const vault = new Mesh(
      new CylinderGeometry(v, v, L, 48, 1, true, Math.PI / 2, Math.PI),
      new MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, map: o.vaultTex ?? null, side: BackSide, emissive: 0xffffff, emissiveIntensity: o.vaultEmit ?? 0 }),
    );
    vault.rotation.x = Math.PI / 2;
    vault.position.y = H;
    parent.add(vault);
    if (hw > v) {
      for (const s of [-1, 1] as const) {
        gPlane(hw - v, L, new MeshStandardMaterial({ color: 0xf0ece4, roughness: 0.9 }), s * (v + (hw - v) / 2), H, 0, Math.PI / 2, 0, parent);
        if (o.sk)
          gPlane((hw - v) * 0.7, L * 0.8, g11Emit(0xffffff, 1.5), s * (v + (hw - v) / 2), H - 0.02, 0, Math.PI / 2, 0, parent);
      }
    }
  } else if (o.flatCeil) {
    gPlane(W, L, o.flatCeil, 0, H, 0, Math.PI / 2, 0, parent);
  }
  const st = (L - 10) / pn;
  const zs = Array.from({ length: pn }, (_, i) => L / 2 - 5 - i * st);
  for (const s of [-1, 1] as const) {
    for (const z of zs) g11Frame(parent, fw, fh, g11Paint(pb, pc), s * (hw - 0.05), 2.2, z, (-s * Math.PI) / 2, fc);
    if (o.ar)
      for (const z of zs) {
        const a = new Mesh(g11ArchGeo(), gMat(0x1b1815, 1));
        a.position.set(s * (hw - 0.04), 0, z - st / 2);
        a.rotation.y = (-s * Math.PI) / 2;
        parent.add(a);
      }
    // Luminous arched windows: a real sky photograph, not an emissive
    // gradient. Only on the right wall (the source's `win && s > 0`).
    if (o.win && s > 0)
      for (const z of zs) {
        const a = new Mesh(g11ArchGeo(), new MeshBasicMaterial({ map: photoTexture(PHOTO.sky) }));
        a.scale.set(1.2, 1.1, 1);
        a.position.set(s * (hw - 0.04), 0, z - st / 2);
        a.rotation.y = (-s * Math.PI) / 2;
        parent.add(a);
      }
  }
  if (o.tr)
    for (const s of [-1, 1] as const) {
      gBox(0.05, 0.05, L, gMat(0x111111, 0.8), s * hw * 0.45, H - 0.05, 0, 0, parent, false);
      for (let z = -L / 2 + 3; z < L / 2; z += 4) {
        const sp = new Mesh(new SphereGeometry(0.07, 12, 8), g11Emit(0xfff2d0, 3));
        sp.position.set(s * hw * 0.45, H - 0.2, z);
        parent.add(sp);
      }
    }
  for (let i = 0; i < bn; i++) {
    const z = L / 2 - 9 - i * 8;
    gBox(2, 0.12, 0.6, gMat(0x8a5a35, 0.5), 0, 0.45, z, 0, parent);
    gBox(0.1, 0.4, 0.5, gMat(0x333333, 1), -0.8, 0.2, z, 0, parent);
    gBox(0.1, 0.4, 0.5, gMat(0x333333, 1), 0.8, 0.2, z, 0, parent);
  }
  g11Hemi(parent, 0xfff0dd, 0x77706a, o.hi ?? 0.6);
  for (let z = L / 2 - 4; z > -L / 2; z -= 8) g11Pt(parent, 0xfff0d8, o.pi ?? 1, 0, H - 0.8, z, 22);
}

function buildEscalier(group: Group): void {
  const wh = new MeshStandardMaterial({ color: 0xf6f6f4, roughness: 0.9 });
  gPlane(16, 20, gMat(0x6d7078, 0.95), 0, 0, 0, -Math.PI / 2, 0, group);
  gPlane(16, 20, wh, 0, 9, 0, Math.PI / 2, 0, group);
  gPlane(16, 9, wh, 0, 4.5, -10, 0, 0, group);
  gPlane(16, 9, wh, 0, 4.5, 10, 0, Math.PI, group);
  for (const s of [-1, 1] as const) gBox(0.4, 9, 20, wh, s * 8.2, 4.5, 0, 0, group, false);
  g11Frame(group, 7, 2.8, g11Paint("#e8e2d0", ["#f2b02a", "#e0572a", "#f4f4f0", "#2f7a4a"]), 7.9, 3.2, -3, -Math.PI / 2, 0xf4f4f0);
  g11Frame(group, 1.6, 2.1, g11Paint("#caa27a", ["#8a3a1c", "#c9863a", "#5a3a2a"]), -7.9, 2.4, -1, Math.PI / 2, 0x6b4a2a);
  g11Frame(group, 1.1, 1.4, g11Paint("#c26a2a", ["#e8b04a", "#6a2a1a"]), -7.9, 2.2, -5, Math.PI / 2, 0x6b4a2a);
  gCyl(0.18, 0.18, 9, wh, 0, 4.5, -1, group, 24);
  gBox(8, 0.4, 5, wh, 2.5, 4.7, -7.5, 0, group);
  gPlane(8, 1.1, g11Glass(), 2.5, 5.5, -5, 0, 0, group);
  for (let i = 0; i < 14; i++) gBox(1.8, 0.2, 0.5, gMat(0x2a2c30, 0.6), -5.5, 0.2 + i * 0.35, 2 - i * 0.5, 0, group);
  gBox(0.04, 0.04, 20, g11Emit(0xffffff, 3), -7.9, 0.05, 0, 0, group, false);
  gBox(1, 0.08, 0.5, gMat(0x5a3a22, 0.6), -1, 0.5, 3, 0, group);
  const ball = new Mesh(new SphereGeometry(0.4, 24, 16), gMat(0x111111, 0.4, 0.5));
  ball.position.set(6, 0.3, -1.2);
  ball.scale.set(1, 0.7, 1);
  ball.castShadow = true;
  group.add(ball);
  g11Hemi(group, 0xffffff, 0xaaaaaa, 0.9);
  g11Pt(group, 0xffffff, 0.8, 0, 7, 0, 24);
  g11Pt(group, 0xffffff, 0.6, 0, 4, 6, 20);
  g11Pt(group, 0xffffff, 0.6, 5, 4, -5, 20);
}

function buildSallesVertes(group: Group): void {
  hall11(group, {
    W: 14,
    L: 32,
    H: 6.5,
    wm: new MeshStandardMaterial({ color: 0x3d6b5e, roughness: 0.85 }),
    fm: new MeshStandardMaterial({ map: g11Wood(5, 10), roughness: 0.4 }),
    v: 3,
    vaultTex: g11Coffer(6, 14),
    pn: 3,
    fw: 2,
    fh: 2.6,
    bn: 2,
    sk: true,
  });
}

function buildCouloirSombre(group: Group): void {
  hall11(group, {
    W: 7,
    L: 46,
    H: 5,
    wm: new MeshStandardMaterial({ color: 0x8d877d, roughness: 0.9 }),
    fm: new MeshStandardMaterial({ map: g11Herr(36, 6, 24), roughness: 0.22, metalness: 0.05 }),
    v: 3.5,
    vaultTex: g11Coffer(5, 14),
    pn: 6,
    fw: 0.9,
    fh: 1.2,
    fc: 0x6b4a24,
    pb: "#1b1410",
    end: new MeshStandardMaterial({ color: 0x24201c, roughness: 1 }),
    ar: true,
    tr: true,
    hi: 0.18,
    pi: 0.55,
  });
}

function buildCouloirDore(group: Group): void {
  hall11(group, {
    W: 7,
    L: 46,
    H: 5.6,
    wm: new MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.85 }),
    fm: new MeshStandardMaterial({ map: g11Herr(58, 6, 24), roughness: 0.3, metalness: 0.05 }),
    flatCeil: new MeshStandardMaterial({ color: 0xf6f2ea, roughness: 0.9 }),
    pn: 4,
    fw: 1.7,
    fh: 2.4,
    tr: true,
    win: true,
    end: new MeshStandardMaterial({ color: 0x9b2a24, roughness: 0.85 }),
    hi: 0.9,
    pi: 0.9,
  });
  // Sun patches on the floor (transparent, no depth write).
  const sn = new MeshStandardMaterial({ color: 0xfff0b0, roughness: 1, transparent: true, opacity: 0.28, depthWrite: false });
  for (const z of [12, 4, -4, -12]) gPlane(5, 0.9, sn, 0.6, 0.012, z, -Math.PI / 2, 0, group);
  // The great luminous arch on the red end wall: a real garden
  // photograph, not an emissive gradient.
  const a = new Mesh(g11ArchGeo(), new MeshBasicMaterial({ map: photoTexture(PHOTO.gardenView) }));
  a.scale.set(1.5, 1.3, 1);
  a.position.set(0, 0, -22.95);
  group.add(a);
}

function buildVoutes(group: Group): void {
  hall11(group, {
    W: 10,
    L: 30,
    H: 7,
    wm: new MeshStandardMaterial({ color: 0xf8f8f6, roughness: 0.9 }),
    fm: new MeshStandardMaterial({ map: g11Wood(5, 10), roughness: 0.35, metalness: 0.02 }),
    flatCeil: new MeshStandardMaterial({ map: g11Scal(5, 12), roughness: 0.9, emissive: 0xffffff, emissiveIntensity: 0.5 }),
    pn: 2,
    fw: 1.7,
    fh: 1.5,
    fc: 0xf4f4f0,
    pc: ["#e0572a", "#f2c230", "#2a4fa0", "#ffffff"],
    pb: "#f4f2ec",
    bn: 2,
    hi: 1,
    pi: 0.7,
  });
  for (const x of [-3.3, 3.3]) gBox(0.14, 0.01, 30, gMat(0x3a2a1a, 0.6), x, 0.01, 0, 0, group, false);
  const gold = new Mesh(new SphereGeometry(1.4, 24, 16), new MeshStandardMaterial({ color: 0xe8d9b4, roughness: 0.04, metalness: 1 }));
  gold.position.set(0, 2.6, -14.65);
  gold.scale.set(1, 1, 0.25);
  group.add(gold);
  g11Frame(group, 0.9, 1.1, g11Paint("#f4f0e6", ["#e0572a", "#2a4fa0"]), -3.2, 2.4, -14.93, 0, 0xf4f4f0);
  g11Frame(group, 1.6, 1.4, g11Paint("#f4f0e6", ["#f2c230", "#1a1a1a", "#e0572a"]), 3.4, 2.4, -14.93, 0, 0xf4f4f0);
}

function buildCourbes(group: Group): void {
  const wh = gMat(0xf4f4f2, 0.7);
  const ch = gMat(0x9aa0a8, 0.15, 1);
  const R0 = 12.5;
  // The lawn around the gallery — a real grass photograph.
  gPlane(120, 120, new MeshStandardMaterial({ map: photoTexture(PHOTO.grass, { repeat: [24, 24] }), roughness: 1 }), 0, -0.05, 0, -Math.PI / 2, 0, group);
  const fl = new Mesh(new CircleGeometry(13, 64), new MeshStandardMaterial({ color: 0x24272b, roughness: 0.08, metalness: 0.35 }));
  fl.rotation.x = -Math.PI / 2;
  fl.position.y = 0.01;
  group.add(fl);
  const w = new Mesh(
    new CylinderGeometry(R0, R0, 6.5, 64, 1, true, (3 * Math.PI) / 2 + 0.55, 2 * Math.PI - 1.1),
    new MeshStandardMaterial({ color: 0xf4f4f2, roughness: 0.7, side: BackSide }),
  );
  w.position.y = 3.25;
  group.add(w);
  // The glazed section: glass only — the real sky and lawn outside
  // show through it (the sky photograph cylinder and the grass).
  const g = new Mesh(
    new CylinderGeometry(R0, R0, 6.5, 16, 1, true, (3 * Math.PI) / 2 - 0.55, 1.1),
    g11Glass(),
  );
  g.position.y = 3.25;
  group.add(g);
  const ro = new Mesh(new CircleGeometry(R0 + 0.3, 64), wh);
  ro.rotation.x = Math.PI / 2;
  ro.position.y = 6.5;
  group.add(ro);
  const bk = new Mesh(new RingGeometry(5, 5.25, 64, 1, 0, Math.PI * 1.3), gMat(0x111111, 0.4));
  bk.rotation.x = Math.PI / 2;
  bk.position.y = 6.45;
  group.add(bk);
  gCyl(0.45, 0.45, 6.5, wh, -3, 3.25, -6, group);
  const tr = new Mesh(new TorusGeometry(1.1, 0.08, 8, 32), wh);
  tr.position.set(12.4, 2.6, -2);
  tr.rotation.y = -Math.PI / 2;
  group.add(tr);
  const dsk = new Mesh(new CircleGeometry(1.05, 32), new MeshStandardMaterial({ color: 0x55585c, roughness: 0.9 }));
  dsk.position.set(12.38, 2.6, -2);
  dsk.rotation.y = -Math.PI / 2;
  group.add(dsk);
  gCyl(0.1, 0.25, 1.6, ch, 11.8, 0.8, -2, group, 10);
  const orb = new Mesh(new SphereGeometry(0.3, 24, 16), ch);
  orb.position.set(11.8, 1.7, -2);
  group.add(orb);
  for (const k of [0.9, 1.2]) {
    const th = Math.PI * k;
    const a = new Mesh(g11ArchGeo(), gMat(0x2a2c30, 1));
    a.scale.set(1.4, 1.3, 1);
    a.position.set(Math.sin(th) * (R0 - 0.05), 0, Math.cos(th) * (R0 - 0.05));
    a.rotation.y = th + Math.PI;
    group.add(a);
  }
  gBox(2.2, 0.35, 0.6, new MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.5, metalness: 0.3 }), 4, 0.3, -5, 0, group);
  for (const [x, z, h] of [
    [-15, -4, 5],
    [-15, 3, 6],
    [-17, 0, 4.5],
    [-14.5, -8, 5],
  ] as const)
    g11Palm(group, x, z, h);
  g11Sky(group);
  g11Hemi(group, 0xffffff, 0xaaaaaa, 1.1);
  g11Sun(group, -8, 12, 6, 1.1, 20);
  g11Pt(group, 0xffffff, 0.5, 0, 5.5, 0, 30);
}

function buildAtriumLattes(group: Group): void {
  const wh = new MeshStandardMaterial({ color: 0xf8f8f6, roughness: 0.8 });
  const rm = new Mesh(
    new BoxGeometry(14, 12, 18),
    new MeshStandardMaterial({ map: g11Slat(10, 6), roughness: 0.85, side: BackSide }),
  );
  rm.position.set(0, 6, 0);
  group.add(rm);
  gPlane(14, 18, new MeshStandardMaterial({ map: g11Wood(3, 5), roughness: 0.45 }), 0, 0.01, 0, -Math.PI / 2, 0, group);
  // The large window: a real garden photograph behind the mullions,
  // not a sky gradient.
  gPlane(8.5, 7.5, new MeshBasicMaterial({ map: photoTexture(PHOTO.gardenView) }), 0, 6.5, -8.95, 0, 0, group);
  for (let i = 0; i <= 6; i++) gBox(0.08, 7.5, 0.1, wh, -4.25 + (i * 8.5) / 6, 6.5, -8.9, 0, group, false);
  for (let j = 0; j <= 4; j++) gBox(8.5, 0.08, 0.1, wh, 0, 2.75 + j * 1.875, -8.9, 0, group, false);
  gBox(6.5, 0.45, 3.5, new MeshStandardMaterial({ color: 0xe6eaec, roughness: 0.4 }), 0, 4, -6.9, 0, group);
  gPlane(6.5, 1.1, g11Glass(), 0, 4.7, -5.2, 0, 0, group);
  for (const x of [-3, -1, 1, 3]) gBox(0.14, 4, 0.14, wh, x, 2, -5.5, 0, group, false);
  for (let i = 0; i < 12; i++) {
    gBox(1.3, 0.15, 0.5, gMat(0x55585c, 0.6), 5.8, 0.2 + i * 0.33, 3 - i * 0.7, 0, group);
    gBox(1.5, 0.18, 0.5, wh, -5.8, 0.2 + i * 0.33, 3 - i * 0.7, 0, group);
  }
  g11Hemi(group, 0xffffff, 0xcccccc, 1.1);
  g11Sun(group, 4, 12, 8, 1.2, 16);
  g11Pt(group, 0xffffff, 0.7, 0, 8, 0, 30);
}

// ---------------------------------------------------------------------------
// Dispatcher / disposal / environment / walk controls
// ---------------------------------------------------------------------------

export function buildGalleryShell(layout: RoomLayout): {
  group: Group;
  tick?: (dt: number) => void;
} {
  const group = new Group();
  group.name = `gallery-shell-${layout}`;
  // Sunlight keeps its own JSX shell in gallery-scene.tsx; this
  // dispatcher only builds the twenty generic rooms.
  if (layout === "sunlight") return { group };
  const builders: Record<Exclude<RoomLayout, "sunlight">, () => { tick?: (dt: number) => void } | void> = {
    serpentine: () => buildSerpentine(group),
    vitrine: () => buildVitrine(group),
    loft: () => buildLoft(group),
    halle: () => buildHalle(group),
    arche: () => buildArche(group),
    musee: () => buildMusee(group),
    "claire-voie": () => buildGalerie(group),
    parquet: () => buildParquet(group),
    verriere: () => buildVerriere(group),
    pavillon: () => buildPavillon(group),
    classique: () => buildClassique(group),
    "atrium-blanc": () => buildAtriumBlanc(group),
    patio: () => buildPatio(group),
    escalier: () => buildEscalier(group),
    "salles-vertes": () => buildSallesVertes(group),
    "couloir-sombre": () => buildCouloirSombre(group),
    "couloir-dore": () => buildCouloirDore(group),
    voutes: () => buildVoutes(group),
    courbes: () => buildCourbes(group),
    "atrium-lattes": () => buildAtriumLattes(group),
  };
  const result = builders[layout]();
  return { group, tick: result?.tick };
}

export function disposeGroup(group: Group): void {
  group.traverse((obj) => {
    const mesh = obj as Mesh;
    const geo = mesh.geometry as BufferGeometry | undefined;
    if (geo) geo.dispose();
    const mats = mesh.material as Material | Material[] | undefined;
    if (Array.isArray(mats)) mats.forEach(disposeMaterial);
    else if (mats) disposeMaterial(mats);
  });
}

function disposeMaterial(mat: Material): void {
  const m = mat as MeshStandardMaterial & { map?: Texture | null; bumpMap?: Texture | null };
  // Photo textures are shared (cached in lib/gallery-photos) and must
  // survive a room unmount — disposing one would blank every room
  // that uses it. Only per-build canvas textures are disposed here.
  if (m.map && !m.map.userData?.photoTexture) m.map.dispose();
  if (m.bumpMap) m.bumpMap.dispose();
  mat.dispose();
}

/**
 * Shared environment for the generic rooms: a gradient PMREM scene
 * (white → light blue-grey → warm grey), matching the sources'
 * `createEnvironment` helper.
 */
export function GalleryEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const envScene = new Scene();
    envScene.background = new Color(0xffffff);
    const g = new Group();
    envScene.add(g);
    const bottom = new Mesh(
      new CylinderGeometry(1, 1, 1, 32, 1, true),
      new MeshBasicMaterial({ color: 0x8a8884, side: DoubleSide }),
    );
    bottom.scale.set(20, 6, 20);
    bottom.position.y = -3;
    g.add(bottom);
    const mid = new Mesh(
      new CylinderGeometry(1, 1, 1, 32, 1, true),
      new MeshBasicMaterial({ color: 0xd5dde6, side: DoubleSide }),
    );
    mid.scale.set(20, 8, 20);
    mid.position.y = 0;
    g.add(mid);
    const top = new Mesh(
      new SphereGeometry(20, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2),
      new MeshBasicMaterial({ color: 0xffffff, side: DoubleSide }),
    );
    top.position.y = 3;
    g.add(top);
    const pmrem = new PMREMGenerator(gl);
    const tex = pmrem.fromScene(envScene, 0.04).texture;
    scene.environment = tex;
    return () => {
      scene.environment = null;
      tex.dispose();
      pmrem.dispose();
      bottom.geometry.dispose();
      mid.geometry.dispose();
      top.geometry.dispose();
    };
  }, [gl, scene]);
  return null;
}

/**
 * First-person walk controls for the generic rooms, mirroring
 * SunlightWalkControls exactly (same props, same keyboard / drag /
 * click-to-walk / reset behaviour) but driven by each room's
 * GalleryDef — its own bounds, collision blocks, walk speed and
 * entrance. Rooms whose layout is Sunlight keep their own controls;
 * GalleryScene renders one or the other for the active room.
 */
export function GalleryWalkControls(props: {
  rooms: GalleryRoom[];
  activeRoomId: string;
  offsets: number[];
  zOffsets?: number[];
  input: { current: Set<string> };
  destination: { current: Vector3 | null };
  lookYaw: { current: number | null };
  dragged: { current: boolean };
  // True while an artwork or element is being dragged (set by the
  // drag handlers): the pointer then moves the piece, not the look.
  // The drag flag is still updated so a drag never becomes a click.
  dragActive?: { current: boolean };
  enabled: boolean;
  onRoomChange?: (roomId: string) => void;
  resetSignal?: { current: number };
  // Camera view preset requested by the editor's View buttons (Eye /
  // Wide / High / Plan): the nonce changes on every click, so the
  // same view can be re-applied.
  viewRequest?: { nonce: number; view: CameraViewPreset } | null;
}) {
  const { rooms, activeRoomId, offsets, zOffsets, input, destination, lookYaw, dragged, dragActive, enabled, onRoomChange, resetSignal, viewRequest } = props;
  const { camera, gl } = useThree();
  const defOf = (index: number) => galleryDef(rooms[index]?.layout ?? "sunlight");
  const startIndex = Math.max(0, rooms.findIndex((room) => room.id === activeRoomId));
  const startDef = defOf(startIndex) ?? galleryDef("sunlight")!;
  const yawRef = useRef(startDef.cameraStart.yaw);
  const pitchRef = useRef(startDef.cameraStart.pitch);
  // Smoothed camera height (Claude's camY): a view preset sets the
  // target and every frame eases toward it, instead of jumping.
  const camYRef = useRef(startDef.cameraStart.y);
  const lastViewNonce = useRef<number | null>(null);
  const currentRoomIndex = useRef(startIndex);
  const handledRoomId = useRef(activeRoomId);
  const onRoomChangeRef = useRef(onRoomChange);
  onRoomChangeRef.current = onRoomChange;
  const initialized = useRef(false);
  const lastReset = useRef(resetSignal?.current ?? 0);
  const markerRef = useRef<Group>(null);
  // One shared unlit white material for the marker's ring + dot: fog
  // off so it never tints toward a room's fog colour, depth test off
  // so it always draws on top of the floor.
  const markerMaterial = useMemo(
    () => new MeshBasicMaterial({ color: "#ffffff", transparent: true, depthWrite: false, depthTest: false, fog: false }),
    [],
  );
  useEffect(() => () => markerMaterial.dispose(), [markerMaterial]);
  const zOffsetOf = (index: number) => zOffsets?.[index] ?? 0;

  // The entrance of a room: its def's camera start, shifted by the
  // room's world offset (rooms line up along X).
  const entrance = useCallback(
    (index: number) => {
      const def = defOf(index);
      return {
        x: offsets[index] + (def?.cameraStart.x ?? 0),
        y: def?.cameraStart.y ?? 1.6,
        z: zOffsetOf(index) + (def?.cameraStart.z ?? 0),
        yaw: def?.cameraStart.yaw ?? 0,
        pitch: def?.cameraStart.pitch ?? 0,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [offsets, zOffsets, rooms],
  );

  // First mount: place the camera at the start. A room change
  // (teleport from the mini-plan or the room list) re-places it at
  // the new room's entrance. Rooms are never entered by walking
  // through a wall.
  useEffect(() => {
    const def = defOf(currentRoomIndex.current);
    if (!initialized.current) {
      const start = entrance(startIndex);
      camera.position.set(start.x, start.y, start.z);
      camYRef.current = start.y;
      camera.rotation.order = "YXZ";
      yawRef.current = start.yaw;
      pitchRef.current = start.pitch;
      camera.rotation.set(pitchRef.current, yawRef.current, 0, "YXZ");
      currentRoomIndex.current = startIndex;
      handledRoomId.current = activeRoomId;
      initialized.current = true;
      return;
    }
    const requestedIndex = rooms.findIndex((room) => room.id === activeRoomId);
    if (requestedIndex < 0) return;
    if (handledRoomId.current === activeRoomId || currentRoomIndex.current === requestedIndex) {
      handledRoomId.current = activeRoomId;
      return;
    }
    const start = entrance(requestedIndex);
    camera.position.set(start.x, start.y, start.z);
    camYRef.current = start.y;
    yawRef.current = start.yaw;
    pitchRef.current = start.pitch;
    camera.rotation.set(pitchRef.current, yawRef.current, 0, "YXZ");
    destination.current = null;
    lookYaw.current = null;
    currentRoomIndex.current = requestedIndex;
    handledRoomId.current = activeRoomId;
    void def;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRoomId, camera, destination, lookYaw, offsets, rooms, zOffsets]);

  // Camera view preset (the editor's View buttons): apply the preset's
  // pitch and, when it carries one, position and yaw; the height is
  // eased toward in useFrame (camY). Eye keeps the current position
  // and yaw and only levels the pitch and lowers the eye back to
  // 1.6 m. The position is clamped to the room's walk bounds, so a
  // preset can never park the camera inside a wall. The height is
  // clamped to just under the room's ceiling — a generic shell is a
  // closed box whose ceiling cannot be hidden, so a High / Plan view
  // reads from just under it instead of from above the roof.
  useEffect(() => {
    if (!viewRequest || viewRequest.nonce === lastViewNonce.current) return;
    lastViewNonce.current = viewRequest.nonce;
    const preset = VIEW_PRESETS[viewRequest.view];
    const roomIndex = currentRoomIndex.current;
    const ox = offsets[roomIndex] ?? 0;
    const oz = zOffsetOf(roomIndex);
    const def = defOf(roomIndex);
    const bounds = def?.bounds ?? { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
    const roomHeight = roomLayouts[rooms[roomIndex]?.layout ?? "sunlight"].height;
    pitchRef.current = preset.pitch;
    if (preset.yaw !== undefined) yawRef.current = preset.yaw;
    if (preset.x !== undefined) {
      camera.position.x = ox + Math.max(bounds.minX, Math.min(bounds.maxX, preset.x));
    }
    if (preset.z !== undefined) {
      camera.position.z = oz + Math.max(bounds.minZ, Math.min(bounds.maxZ, preset.z));
    }
    camYRef.current = Math.min(preset.y, roomHeight - 0.4);
    destination.current = null;
    lookYaw.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [viewRequest, camera, destination, lookYaw, offsets, zOffsets]);

  // Keyboard (WASD / arrows) and drag-to-look on the canvas.
  useEffect(() => {
    if (!enabled) {
      input.current.clear();
      return;
    }
    gl.domElement.tabIndex = 0;
    gl.domElement.focus({ preventScroll: true });
    const keyDown = (event: KeyboardEvent) => {
      // Typing in a field (a name, a colour, a slider label…) must
      // not walk: the keys are ignored while the focus is inside a
      // form control or an editable element.
      const target = event.target as HTMLElement | null;
      if (target && (target.closest("input, textarea, select") || target.isContentEditable)) return;
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        event.preventDefault();
        input.current.add(event.code);
      }
    };
    const keyUp = (event: KeyboardEvent) => input.current.delete(event.code);
    const clearKeys = () => input.current.clear();
    window.addEventListener("keydown", keyDown);
    window.addEventListener("keyup", keyUp);
    window.addEventListener("blur", clearKeys);
    let pointerId: number | undefined;
    let lastX = 0;
    let lastY = 0;
    let downX = 0;
    let downY = 0;
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      pointerId = event.pointerId;
      lastX = event.clientX;
      lastY = event.clientY;
      downX = event.clientX;
      downY = event.clientY;
      dragged.current = false;
      gl.domElement.setPointerCapture(pointerId);
    };
    const onPointerMove = (event: PointerEvent) => {
      if (event.pointerId !== pointerId) return;
      if (Math.abs(event.clientX - downX) > 6 || Math.abs(event.clientY - downY) > 6) dragged.current = true;
      // While an artwork or element is being dragged the pointer moves
      // the piece, not the look (the drag handler owns the pointer).
      // lastX/lastY are still updated so the look does not jump when
      // the drag ends.
      if (!dragActive?.current) {
        yawRef.current -= (event.clientX - lastX) * 0.004;
        pitchRef.current = MathUtils.clamp(pitchRef.current - (event.clientY - lastY) * 0.004, -1.2, 1.2);
      }
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onPointerUp = () => {
      pointerId = undefined;
    };
    gl.domElement.addEventListener("pointerdown", onPointerDown);
    gl.domElement.addEventListener("pointermove", onPointerMove);
    gl.domElement.addEventListener("pointerup", onPointerUp);
    gl.domElement.addEventListener("pointercancel", onPointerUp);
    return () => {
      window.removeEventListener("keydown", keyDown);
      window.removeEventListener("keyup", keyUp);
      window.removeEventListener("blur", clearKeys);
      gl.domElement.removeEventListener("pointerdown", onPointerDown);
      gl.domElement.removeEventListener("pointermove", onPointerMove);
      gl.domElement.removeEventListener("pointerup", onPointerUp);
      gl.domElement.removeEventListener("pointercancel", onPointerUp);
    };
  }, [camera, dragged, enabled, gl, input]);

  useFrame((state, delta) => {
    const marker = markerRef.current;
    if (!enabled) {
      if (marker) marker.visible = false;
      return;
    }
    // Reset to the entrance (first room, start yaw).
    if (resetSignal && resetSignal.current !== lastReset.current) {
      lastReset.current = resetSignal.current;
      const start = entrance(0);
      camera.position.set(start.x, start.y, start.z);
      camYRef.current = start.y;
      yawRef.current = start.yaw;
      pitchRef.current = start.pitch;
      destination.current = null;
      lookYaw.current = null;
      if (currentRoomIndex.current !== 0) {
        currentRoomIndex.current = 0;
        handledRoomId.current = rooms[0].id;
        onRoomChangeRef.current?.(rooms[0].id);
      }
    }
    const keys = input.current;
    const fw = Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
    const st = Number(keys.has("KeyD")) - Number(keys.has("KeyA"));
    // Arrow keys turn the view (the source's navigation).
    if (keys.has("ArrowLeft")) yawRef.current += delta * 1.5;
    if (keys.has("ArrowRight")) yawRef.current -= delta * 1.5;
    const roomIndex = currentRoomIndex.current;
    const def = defOf(roomIndex);
    const ox = offsets[roomIndex];
    const oz = zOffsetOf(roomIndex);
    const localX = camera.position.x - ox;
    const localZ = camera.position.z - oz;
    // Collision: the room's own blocks (panels, plinths, screens…),
    // in room-local coordinates.
    const blocks = def?.blocks ?? [];
    const bounds = def?.bounds ?? { minX: -10, maxX: 10, minZ: -10, maxZ: 10 };
    const v = (def?.walkSpeed ?? 3) * delta;
    if (fw || st) {
      destination.current = null;
      lookYaw.current = null;
      const sy = Math.sin(yawRef.current);
      const cy = Math.cos(yawRef.current);
      const nx = Math.max(bounds.minX, Math.min(bounds.maxX, localX + (-sy * fw + cy * st) * v));
      const nz = Math.max(bounds.minZ, Math.min(bounds.maxZ, localZ + (-cy * fw - sy * st) * v));
      if (!sunlightHitWith(blocks, nx, localZ)) camera.position.x = ox + nx;
      if (!sunlightHitWith(blocks, camera.position.x - ox, nz)) camera.position.z = oz + nz;
    } else if (destination.current) {
      const dest = destination.current;
      const dx = dest.x - camera.position.x;
      const dz = dest.z - camera.position.z;
      const L = Math.hypot(dx, dz);
      if (L < 0.1) {
        destination.current = null;
        lookYaw.current = null;
      } else {
        const q = Math.min(v * 1.5, L);
        const mx = Math.max(bounds.minX, Math.min(bounds.maxX, localX + (dx / L) * q));
        const mz = Math.max(bounds.minZ, Math.min(bounds.maxZ, localZ + (dz / L) * q));
        // If the bounds clamp leaves no room to move at all, the
        // target is unreachable (a wall): stop walking instead of
        // pressing against it forever.
        if (mx === localX && mz === localZ) {
          destination.current = null;
          lookYaw.current = null;
        } else {
          let ok = 0;
          if (!sunlightHitWith(blocks, mx, localZ)) {
            camera.position.x = ox + mx;
            ok = 1;
          }
          if (!sunlightHitWith(blocks, camera.position.x - ox, mz)) {
            camera.position.z = oz + mz;
            ok = 1;
          }
          if (!ok) {
            destination.current = null;
            lookYaw.current = null;
          }
        }
        if (lookYaw.current !== null) {
          const step = Math.min(delta, 0.05) * 2.5;
          let diff = lookYaw.current - yawRef.current;
          diff = Math.atan2(Math.sin(diff), Math.cos(diff));
          yawRef.current += MathUtils.clamp(diff, -step, step);
        }
      }
    }
    camera.rotation.set(pitchRef.current, yawRef.current, 0, "YXZ");
    // Final guard: the camera can never leave the room, whatever moved
    // it (keys, destination, teleport). The movement code above already
    // clamps, but this last clamp is unconditional — a stale offset or
    // a future caller that sets the camera directly can no longer push
    // it through a wall into the grey void.
    camera.position.x = ox + Math.max(bounds.minX, Math.min(bounds.maxX, camera.position.x - ox));
    camera.position.z = oz + Math.max(bounds.minZ, Math.min(bounds.maxZ, camera.position.z - oz));
    // Camera-height easing toward the active view preset (camY): the
    // height glides instead of jumping. The y is never clamped to the
    // walk bounds — it was already clamped to the room's height when
    // the preset was applied.
    camera.position.y += (camYRef.current - camera.position.y) * Math.min(1, delta * CAMERA_HEIGHT_EASE);
    // Walk-target marker on the destination, pulsing like the source.
    // The marker is clamped to the room bounds (a target clicked on a
    // wall sits outside the walkable area, so the raw point would hide
    // it inside the wall): the visible marker is always the nearest
    // reachable point inside the room. It is a thick ring + centre
    // dot, 0.9 m across — a flat ring alone reads as a ~15 px sliver
    // at the grazing angles of a 1.6 m eye (that is why the 0.25–
    // 0.35 m ring of 9441c8a was never seen in live verification), so
    // the band is thick, the dot anchors it, and the pulse scales the
    // whole marker as well as its opacity. It sits at y 0.03, above
    // the invisible click plane (0.02) and the floor, so it never
    // z-fights.
    if (marker) {
      const dest = destination.current;
      marker.visible = dest !== null;
      if (dest) {
        const mx = ox + Math.max(bounds.minX, Math.min(bounds.maxX, dest.x - ox));
        const mz = oz + Math.max(bounds.minZ, Math.min(bounds.maxZ, dest.z - oz));
        marker.position.set(mx, 0.03, mz);
        const pulse = 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 6);
        marker.scale.setScalar(1 + 0.18 * pulse);
        markerMaterial.opacity = 0.85 + 0.15 * pulse;
      }
    }
  });

  return (
    <group ref={markerRef} visible={false} renderOrder={10}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={10} material={markerMaterial}>
        <ringGeometry args={[0.3, 0.45, 48]} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} renderOrder={10} material={markerMaterial}>
        <circleGeometry args={[0.1, 32]} />
      </mesh>
    </group>
  );
}
