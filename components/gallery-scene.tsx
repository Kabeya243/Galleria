"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, Suspense } from "react";
import { ACESFilmicToneMapping, AdditiveBlending, BackSide, BufferAttribute, BufferGeometry, CanvasTexture, CylinderGeometry, DoubleSide, Euler, ExtrudeGeometry, Group, InstancedMesh, MathUtils, Mesh, MeshBasicMaterial, Object3D, Path, Plane, PlaneGeometry, PMREMGenerator, Raycaster, RepeatWrapping, Scene, Shape, SphereGeometry, SRGBColorSpace, Texture, TextureLoader, Vector2, Vector3, VSMShadowMap, type DirectionalLight } from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { loadRenderQuality, RENDER_QUALITIES, RENDER_QUALITY_CONFIG, RENDER_QUALITY_LABELS, saveRenderQuality, type RenderQuality } from "@/lib/render-quality";
import type { Artwork } from "@/lib/demo-data";
import { resolveFrameSpec } from "@/lib/demo-data";
import type { FrameSpec } from "@/lib/demo-data";
import { frameTileTexture, matTexture } from "@/lib/frame-textures";
import { frameRingGeometry, perimeterPositions, profileBevel, profileLevels, rosetteGeometry, scrollGeometry, setInstancedMatrices, type FrameLevel } from "@/lib/frame-geometry";
import { ELEMENT_DEFAULTS, ELEMENT_PLANES, elementTypes, PLINTH_HEIGHTS, WALL_TEXT_FONTS, type ElementType, type RoomElement } from "@/lib/elements";
import { roomLayouts, roomPlanOffsets, type GalleryRoom, type PartitionWall, type RoomLayout, type WallId } from "@/lib/rooms";
import {
  SUNLIGHT_BLOCKS,
  SUNLIGHT_BOUNDS,
  SUNLIGHT_CAMERA_START,
  SUNLIGHT_CEILING_COLOR,
  SUNLIGHT_DEPTH,
  SUNLIGHT_FLOOR_CENTER_Z,
  SUNLIGHT_FLOOR_COLOR,
  SUNLIGHT_HEIGHT,
  SUNLIGHT_HOLES,
  SUNLIGHT_PANELS,
  SUNLIGHT_PEDESTALS,
  SUNLIGHT_WALL_COLOR,
  SUNLIGHT_WALK_SPEED,
  SUNLIGHT_WIDTH,
  sunlightHitWith,
  sunlightSunColor,
} from "@/lib/sunlight";
import {
  createSunlightTextCanvas,
  raycastHangWalls,
  SUNLIGHT_ELEMENT_BOUNDS,
  SUNLIGHT_SPOT,
  sunlightElementCollisionBlocks,
  sunlightHangWalls,
  type HangWallFace,
  type SunlightElement,
  type SunlightElementType,
  type SunlightTextFont,
} from "@/lib/sunlight-elements";
import { galleryDef, galleryHangWalls, isGalleryLayout, roomFloorCenterZ } from "@/lib/gallery-defs";
import { buildGalleryShell, disposeGroup, GalleryEnvironment, GalleryWalkControls } from "@/components/gallery-rooms";
import { FLOOR_SHINE_DEFAULT, partitionDimsOf, sunlightPartitionDimsOf } from "@/lib/editor-params";
import { CAMERA_HEIGHT_EASE, VIEW_PRESETS, type CameraViewPreset } from "@/lib/editor-params";
import { floorPatternTexture } from "@/lib/floor-patterns";

// --- Sunlight Gallery (Nov 2026) -----------------------------------------
// The renderer is Three.js in the browser: ACES tone mapping, a locally
// generated environment map (a procedural gradient scene + PMREM — no
// external HDR fetch), real VSM shadows from the Sunlight sun, and the
// procedural Sunlight textures. The white-gallery UI is untouched; only
// the 3D render quality changes.

// ACESFilmic tone mapping + VSM shadow maps, applied to the renderer's
// GL context. Lives inside the Canvas so it can react when the quality
// setting (and therefore the exposure) changes mid-session.
function ToneMappingRig({ exposure }: { exposure: number }) {
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMapping = ACESFilmicToneMapping;
    gl.toneMappingExposure = exposure;
    gl.shadowMap.type = VSMShadowMap;
  }, [gl, exposure]);
  return null;
}

// ---- Sunlight Gallery assets (ported from "Galerie lumière") --------
// Procedural canvas textures, created once per page load and cached.
// The source generates them with Math.random on every load; so do we.
const sunlightRandom = (a: number, b: number) => a + Math.random() * (b - a);

type SunlightTextures = {
  floor: CanvasTexture | null;
  sky: CanvasTexture | null;
  cloud: CanvasTexture | null;
  aoLin: CanvasTexture | null;
  aoRad: CanvasTexture | null;
  dark: CanvasTexture | null;
  env: CanvasTexture | null;
};

let sunlightTexturesCache: SunlightTextures | null = null;

function sunlightTex(
  w: number,
  h: number,
  fn: (g: CanvasRenderingContext2D, w: number, h: number) => void,
  rep?: [number, number],
): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const g = c.getContext("2d")!;
  fn(g, w, h);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = RepeatWrapping;
  t.wrapT = RepeatWrapping;
  if (rep) t.repeat.set(rep[0], rep[1]);
  return t;
}

function getSunlightTextures(): SunlightTextures {
  if (sunlightTexturesCache) return sunlightTexturesCache;
  if (typeof document === "undefined") {
    return { floor: null, sky: null, cloud: null, aoLin: null, aoRad: null, dark: null, env: null };
  }
  const R = sunlightRandom;
  // Concrete floor: warm grey with soft speckles, repeated 5 × 6.
  const floor = sunlightTex(
    512,
    512,
    (g, w, h) => {
      g.fillStyle = "#a9aaad";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "60,60,64"},${R(0.015, 0.05)})`;
        g.beginPath();
        g.arc(R(0, w), R(0, h), R(4, 60), 0, 7);
        g.fill();
      }
    },
    [5, 6],
  );
  // Sky gradient for the open skylight panels.
  const sky = sunlightTex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, h);
    gr.addColorStop(0, "#a9cbee");
    gr.addColorStop(1, "#e4eef8");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  // Animated clouds for the sky plane above the room.
  const cloud = sunlightTex(
    512,
    512,
    (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h);
      gr.addColorStop(0, "#5f9ede");
      gr.addColorStop(1, "#bcd8f3");
      g.fillStyle = gr;
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 110; i++) {
        const cx = R(0, w);
        const cy = R(0, h);
        const r = R(25, 95);
        const a = R(0.25, 0.6);
        for (const dx of [-w, 0, w])
          for (const dy of [-h, 0, h]) {
            const x = cx + dx;
            const y = cy + dy;
            const rg = g.createRadialGradient(x, y, 0, x, y, r);
            rg.addColorStop(0, `rgba(255,255,255,${a})`);
            rg.addColorStop(1, "rgba(255,255,255,0)");
            g.fillStyle = rg;
            g.beginPath();
            g.ellipse(x, y, r * 1.5, r * 0.8, 0, 0, 7);
            g.fill();
          }
      }
    },
    [3, 3],
  );
  // Contact-shadow gradient (linear, along a wall or panel base).
  const aoLin = sunlightTex(8, 64, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "rgba(0,0,0,.34)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  // Contact-shadow gradient (radial, under a pedestal).
  const aoRad = sunlightTex(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(64, 64, 10, 64, 64, 64);
    gr.addColorStop(0, "rgba(0,0,0,.5)");
    gr.addColorStop(1, "rgba(0,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  // Dark band on the right wall: a horizontal grey gradient.
  const dark = sunlightTex(64, 300, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, w, 0);
    gr.addColorStop(0, "#262626");
    gr.addColorStop(1, "#5a5a5a");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
  });
  // Environment for the IBL: a sphere with a vertical gradient and
  // three white rectangles (the source's environment scene).
  const env = sunlightTex(512, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, "#ffffff");
    gr.addColorStop(0.5, "#d6d9de");
    gr.addColorStop(1, "#6d6f74");
    g.fillStyle = gr;
    g.fillRect(0, 0, w, h);
    g.fillStyle = "#fff";
    for (const [x, y, a, b] of [
      [60, 20, 90, 22],
      [250, 28, 80, 20],
      [400, 18, 70, 24],
    ] as const) {
      g.fillRect(x, y, a, b);
    }
  });
  sunlightTexturesCache = { floor, sky, cloud, aoLin, aoRad, dark, env };
  return sunlightTexturesCache;
}

// Soft environment lighting (IBL) — the source's procedural environment
// scene, rendered once through a PMREM generator. No external HDR fetch.
function SunlightEnvironment() {
  const { gl, scene } = useThree();
  useEffect(() => {
    const textures = getSunlightTextures();
    if (!textures.env) return;
    const envScene = new Scene();
    const envMesh = new Mesh(
      new SphereGeometry(20, 32, 16),
      new MeshBasicMaterial({ side: BackSide, map: textures.env }),
    );
    envScene.add(envMesh);
    const pmrem = new PMREMGenerator(gl);
    const renderTarget = pmrem.fromScene(envScene, 0.04);
    scene.environment = renderTarget.texture;
    return () => {
      scene.environment = null;
      renderTarget.dispose();
      pmrem.dispose();
      envMesh.geometry.dispose();
      (envMesh.material as MeshBasicMaterial).dispose();
    };
  }, [gl, scene]);
  return null;
}

// The Sunlight sun: a warm directional light with real VSM shadows, plus
// the hemisphere fill. The slider (0-100, default 35) moves the sun along
// its arc; a slow cloud animation breathes its intensity. Exact values
// from the source (setSun + the loop).
function sunlightSunPosition(t: number): [number, number, number] {
  const a = -0.9 + 1.8 * t;
  return [Math.sin(a) * 16, 24 - Math.abs(a) * 5, Math.cos(a) * 10 - 6];
}
function sunlightSunBase(t: number): number {
  const a = -0.9 + 1.8 * t;
  return 2.8 - Math.abs(a) * 1.2;
}
// The source's quality selector: pixel ratio and sun shadow size.
const SUN_SHADOW_MAP_SIZE: Record<RenderQuality, number> = { high: 2048, medium: 1024, low: 512 };

function SunlightRig({ sunValue, quality, sunColor }: { sunValue: number; quality: RenderQuality; sunColor?: string }) {
  const sunRef = useRef<DirectionalLight>(null!);
  const sunBase = useRef(2.6);
  const clockRef = useRef(0);
  const sunTarget = useMemo(() => {
    const target = new Object3D();
    target.position.set(0, 0, -1);
    return target;
  }, []);
  useEffect(() => {
    sunBase.current = sunlightSunBase(sunValue / 100);
  }, [sunValue]);
  // The shadow map is allocated at its size: changing the size needs the
  // old map disposed first, or the new size never takes effect.
  useEffect(() => {
    const sun = sunRef.current;
    if (!sun) return;
    sun.shadow.mapSize.set(SUN_SHADOW_MAP_SIZE[quality], SUN_SHADOW_MAP_SIZE[quality]);
    if (sun.shadow.map) {
      sun.shadow.map.dispose();
      sun.shadow.map = null;
    }
    // The shadow-camera frustum props (shadow-camera-left={-22} …)
    // are plain assignments: three.js only applies them through
    // updateProjectionMatrix, otherwise the shadow stays clipped to
    // the default ±5 m box in the middle of the room.
    sun.shadow.camera.updateProjectionMatrix();
  }, [quality]);
  useFrame((_, delta) => {
    const sun = sunRef.current;
    if (!sun) return;
    clockRef.current += delta;
    const clk = clockRef.current;
    const textures = getSunlightTextures();
    if (textures.cloud) {
      textures.cloud.offset.x += delta * 0.004;
      textures.cloud.offset.y += delta * 0.0012;
    }
    const cc = 0.5 + 0.5 * Math.sin(clk * 0.4) * Math.sin(clk * 0.17 + 1);
    sun.intensity = sunBase.current * (0.45 + 0.55 * cc);
  });
  return (
    <>
      <hemisphereLight args={["#ffffff", "#aaa8a4", 0.25]} />
      <directionalLight
        ref={sunRef}
        position={sunlightSunPosition(sunValue / 100)}
        target={sunTarget}
        intensity={2.6}
        color={sunColor ?? "#fff0d8"}
        castShadow
        shadow-mapSize-width={SUN_SHADOW_MAP_SIZE[quality]}
        shadow-mapSize-height={SUN_SHADOW_MAP_SIZE[quality]}
        shadow-radius={6}
        shadow-blurSamples={16}
        shadow-bias={-0.0002}
        shadow-camera-left={-22}
        shadow-camera-right={22}
        shadow-camera-top={22}
        shadow-camera-bottom={-22}
        shadow-camera-near={1}
        shadow-camera-far={70}
      />
      <primitive object={sunTarget} />
    </>
  );
}

// Sun slider (HUD): the source's sun control — 0-100, default 35 —
// overlaid on the viewer like the render-quality toggle. Inline styles
// only; the global stylesheet is untouched. Top-left, below the public
// topbar / the editor's Add button, flush at the top elsewhere.
function SunSlider({
  value,
  onChange,
  canvasClassName,
}: {
  value: number;
  onChange: (value: number) => void;
  canvasClassName?: string;
}) {
  const top = canvasClassName?.includes("public-gallery-canvas")
    ? 79
    : canvasClassName?.includes("editor-canvas")
      ? 56
      : 12;
  return (
    <div
      className="sunlight-sun-slider"
      role="group"
      aria-label="Sunlight"
      title="Sun — move the sun along its arc"
      style={{
        position: "absolute",
        top,
        left: 12,
        zIndex: 1,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "6px 10px",
        borderRadius: 999,
        background: "rgba(255, 255, 255, 0.92)",
        boxShadow: "0 1px 6px rgba(0, 0, 0, 0.14)",
        fontSize: 11,
        lineHeight: 1,
        color: "#555550",
        userSelect: "none",
      }}
    >
      <span aria-hidden="true">☀</span>
      <span style={{ letterSpacing: "0.04em", textTransform: "uppercase", fontSize: 10 }}>Sun</span>
      <input
        type="range"
        min={0}
        max={100}
        value={value}
        aria-label="Sun position"
        onChange={(event) => onChange(Number(event.target.value))}
        style={{ width: 120, accentColor: "#BA7517" }}
      />
    </div>
  );
}


// Cheap contact shadow: a soft radial-gradient decal on the floor under
// a freestanding element (plinth, bench, partition, vitrine, ...). Real
// spot shadows do the heavy lifting; the decal only grounds the object
// where the spots do not reach. One shared canvas texture for all decals.
let contactDecalTexture: CanvasTexture | null = null;
function getContactDecalTexture(): CanvasTexture | null {
  if (typeof document === "undefined") return null;
  if (contactDecalTexture) return contactDecalTexture;
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext("2d");
  if (!context) return null;
  const gradient = context.createRadialGradient(64, 64, 4, 64, 64, 62);
  gradient.addColorStop(0, "rgba(0, 0, 0, 0.42)");
  gradient.addColorStop(0.55, "rgba(0, 0, 0, 0.18)");
  gradient.addColorStop(1, "rgba(0, 0, 0, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, 128, 128);
  contactDecalTexture = new CanvasTexture(canvas);
  return contactDecalTexture;
}

function ContactDecal({ width, depth }: { width: number; depth: number }) {
  const texture = useMemo(() => getContactDecalTexture(), []);
  if (!texture) return null;
  return (
    <mesh position={[0, 0.006, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null} renderOrder={1}>
      <planeGeometry args={[width, depth]} />
      <meshBasicMaterial map={texture} transparent depthWrite={false} />
    </mesh>
  );
}

// Render-quality switch (High / Medium / Low), overlaid on the viewer.
// Rendered by GalleryScene itself so it appears in the editor, the
// public exhibition and the galleries page without touching any of
// those components. Inline styles only — the global stylesheet and the
// white-gallery design are untouched.
//
// Placement (Phase 8): the pill must never cover another control. At
// top:12 it sat on top of the public exhibition's info button (the
// 67px topbar overlays the canvas) and on top of the editor's
// "Add artwork" button (top:14, right:14 in the same corner), so both
// were unclickable. The offset follows the canvas it is rendered in:
// below the public topbar, below the editor's Add button, flush at the
// top everywhere else (galleries viewer).
// z-index: 1 only — just above the 3D canvas, strictly below every
// dialog (topbar z-2, info card z-3, minimap z-4, list view z-5,
// entry z-6, share panel inside the topbar). At z-20 it floated over
// the share panel's close button and the top of the detail panel.
function RenderQualityToggle({ quality, onChange, canvasClassName }: { quality: RenderQuality; onChange: (quality: RenderQuality) => void; canvasClassName?: string }) {
  const top = canvasClassName?.includes("public-gallery-canvas")
    ? 79
    : canvasClassName?.includes("editor-canvas")
      ? 56
      : 12;
  return (
    <div
      className="render-quality-toggle"
      role="group"
      aria-label="Render quality"
      title="Render quality — High: shadows, reflections and environment lighting on. Medium: smaller shadow maps. Low: shadows and environment off."
      style={{
        position: "absolute",
        top,
        right: 12,
        zIndex: 1,
        display: "flex",
        alignItems: "center",
        gap: 2,
        padding: 3,
        borderRadius: 999,
        background: "rgba(255, 255, 255, 0.92)",
        boxShadow: "0 1px 6px rgba(0, 0, 0, 0.14)",
        fontSize: 11,
        lineHeight: 1,
        color: "#555550",
        userSelect: "none",
      }}
    >
      <span className="rq-label" style={{ padding: "0 6px 0 8px", letterSpacing: "0.04em", textTransform: "uppercase", fontSize: 10 }}>Quality</span>
      {RENDER_QUALITIES.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={quality === option}
          onClick={(event) => {
            event.stopPropagation();
            onChange(option);
          }}
          style={{
            border: "none",
            cursor: "pointer",
            borderRadius: 999,
            padding: "5px 9px",
            fontSize: 11,
            background: quality === option ? "#2b2b28" : "transparent",
            color: quality === option ? "#ffffff" : "#555550",
          }}
        >
          {RENDER_QUALITY_LABELS[option]}
        </button>
      ))}
    </div>
  );
}

// Artwork image texture, loaded imperatively (TextureLoader + state),
// never via useTexture: useTexture suspends on the load, and on failure
// it throws — and there is no error boundary around the artworks, so one
// bad image URL crashes the whole editor (the "Replace image" crash: the
// new R2 public URL has no CORS policy, so the texture load failed and
// useTexture threw). A failed load keeps the previous texture, or the
// placeholder print when there is none — it never throws.
function useArtworkTexture(imageUrl: string): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null);
  const currentRef = useRef<Texture | null>(null);
  useEffect(() => {
    let alive = true;
    const loader = new TextureLoader();
    const next = loader.load(
      imageUrl,
      (loaded) => {
        if (!alive) return;
        loaded.colorSpace = SRGBColorSpace;
        const previous = currentRef.current;
        currentRef.current = loaded;
        setTexture(loaded);
        previous?.dispose();
      },
      undefined,
      () => {
        // Load failed (e.g. a cross-origin image without CORS): keep the
        // previous texture (or the placeholder). Never throw.
        if (!alive) return;
        next.dispose();
      },
    );
    return () => {
      alive = false;
      // The new texture never finished loading: drop it. The displayed
      // texture (if any) is untouched.
      if (currentRef.current !== next) next.dispose();
    };
  }, [imageUrl]);
  useEffect(
    () => () => {
      currentRef.current?.dispose();
    },
    [],
  );
  return texture;
}

// Curatorial wall text (the reference room's "Texte curatorial"): a
// canvas texture drawn from the text and its typeface, like the room's
// own wall text below — a 2D canvas into a texture, never troika (see
// the note above CuratorialTextPlane). Rebuilt when the text or the
// typeface changes; the previous texture is disposed when replaced and
// on unmount; never throws.
function useSunlightTextTexture(text: string, font: SunlightTextFont): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null);
  const currentRef = useRef<Texture | null>(null);
  useEffect(() => {
    let next: CanvasTexture | null = null;
    try {
      const { canvas } = createSunlightTextCanvas(text, font);
      next = new CanvasTexture(canvas);
      next.colorSpace = SRGBColorSpace;
      next.anisotropy = 8;
    } catch {
      next = null;
    }
    const previous = currentRef.current;
    currentRef.current = next;
    setTexture(next);
    previous?.dispose();
    return () => {
      if (currentRef.current === next) {
        currentRef.current = null;
        next?.dispose();
      }
    };
  }, [text, font]);
  useEffect(
    () => () => {
      currentRef.current?.dispose();
      currentRef.current = null;
    },
    [],
  );
  return texture;
}

// The placeholder print shown when an artwork has no image yet, or its
// image is still loading / failed to load: a coloured plane with the
// artwork's accent disc and a beige strip, at the same depths as the
// textured print.
function PlaceholderPrint({ width, height, z, frameless, color, accent }: { width: number; height: number; z: number; frameless: boolean; color: string; accent: string }) {
  return (
    <>
      <mesh position={[0, 0, frameless ? z - 0.008 : z]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={color} />
      </mesh>
      <mesh position={[-0.24 * (width / 1.82), 0.34 * (height / 2.12), frameless ? z + 0.002 : z + 0.01]} rotation={[0, 0, -0.22]}>
        <circleGeometry args={[0.48 * Math.min(width / 1.82, height / 2.12), 48]} />
        <meshStandardMaterial color={accent} />
      </mesh>
      <mesh position={[0.28 * (width / 1.82), -0.34 * (height / 2.12), frameless ? z + 0.004 : z + 0.012]} rotation={[0, 0, 0.12]}>
        <planeGeometry args={[0.8 * (width / 1.82), 0.32 * (height / 2.12)]} />
        <meshStandardMaterial color="#d7c6a9" />
      </mesh>
    </>
  );
}

function LoadedArtwork({ imageUrl, width, height, z = 0.083, color, accent, frameless }: { imageUrl: string; width: number; height: number; z?: number; color: string; accent: string; frameless: boolean }) {
  const texture = useArtworkTexture(imageUrl);
  if (!texture) {
    // Still loading, or the image failed to load: show the placeholder
    // print, never a blank frame — and never throw.
    return <PlaceholderPrint width={width} height={height} z={z} frameless={frameless} color={color} accent={accent} />;
  }
  return (
    <mesh position={[0, 0, z]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

// A curatorial-text artwork: the text drawn on a 640 px canvas (the
// reference room's mkText) as a texture on a plane, 1.4 m wide, its
// height following the wrapped text (the artwork's stored dimensions
// carry that height, so `width`/`height` here already match the
// canvas). Before the texture exists (first frame) the panel shows
// its #f6f6f4 ground, never a blank frame.
function SunlightTextPrint({ text, font, width, height, z = 0.083 }: { text: string; font: SunlightTextFont; width: number; height: number; z?: number }) {
  const texture = useSunlightTextTexture(text, font);
  if (!texture) {
    return (
      <mesh position={[0, 0, z]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color="#f6f6f4" />
      </mesh>
    );
  }
  return (
    <mesh position={[0, 0, z]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial map={texture} />
    </mesh>
  );
}

// Real dimensions in centimetres, parsed from the artwork's dimensions
// field ("130 × 94 cm"). Null when the field is missing or unparsable.
export function parseArtworkDimensions(dimensions: string): { widthCm: number; heightCm: number } | null {
  const match = dimensions?.match(/(\d+(?:[.,]\d+)?)\s*[×x]\s*(\d+(?:[.,]\d+)?)\s*cm/i);
  if (!match) return null;
  const widthCm = Number(match[1].replace(",", "."));
  const heightCm = Number(match[2].replace(",", "."));
  if (!(widthCm > 0 && heightCm > 0)) return null;
  return { widthCm, heightCm };
}

// Real size in metres, parsed from the artwork's dimensions ("130 × 94 cm"),
// so each work hangs on the wall at its true scale instead of in one fixed
// frame. Falls back to the old fixed frame when the dimensions are missing
// or unparsable, so older artworks keep rendering.
function artworkSize(artwork: Artwork): { width: number; height: number } {
  const parsed = parseArtworkDimensions(artwork.dimensions ?? "");
  if (!parsed) return { width: 1.82, height: 2.12 };
  const width = parsed.widthCm / 100;
  const height = parsed.heightCm / 100;
  if (!(width > 0.1 && width < 10 && height > 0.1 && height < 10)) return { width: 1.82, height: 2.12 };
  return { width, height };
}

// Full size of the framed work on the wall, frame + mat + float gap
// included — the size the drag clamp and the selection outline use, so a
// wide museum frame or a shadow box never hangs half off the wall.
export function frameOuterSize(artwork: Artwork): { width: number; height: number } {
  const { width, height } = artworkSize(artwork);
  const spec = resolveFrameSpec(artwork.frame);
  if (artwork.frame === "none") return { width, height };
  const extra = (spec.width + Math.max(spec.floatGap, spec.mat?.width ?? 0)) * 2;
  return { width: width + extra, height: height + extra };
}

// The material of a frame's bars: real PBR. Gold and silver are bare
// metal — no colour map, so the room environment reflects in them
// instead of a flat drawn gold dulling the surface. Wood keeps its
// grain tile as colour + bump (the ring UVs are in metres, so the tile
// repeats every 0.4 m). The clone shares the cached canvas; disposing
// it on unmount only drops the GPU copy.
function useFrameMaterial(spec: FrameSpec) {
  const material = useMemo(() => {
    const isWood = spec.texture === "wood" || spec.texture === "oak" || spec.texture === "walnut" || spec.texture === "mahogany";
    const isMetal =
      spec.texture === "gold-brushed" ||
      spec.texture === "gold-carved" ||
      spec.texture === "silver-brushed" ||
      spec.texture === "aluminium-brushed" ||
      spec.metalness >= 0.8;
    const tile = isWood ? frameTileTexture(spec.texture, { grain: spec.grain }) : undefined;
    const map = tile?.clone();
    if (map) {
      map.repeat.set(2.5, 2.5);
      map.needsUpdate = true;
    }
    // Photo frames wear the real photo on the front face; the ring's
    // metal is only its thin edge and bevel, so cap it — bare-metal
    // glare on the edge would fight the photo's own gold.
    const ringMetalness = spec.photo ? Math.min(spec.metalness, 0.6) : isMetal ? Math.max(spec.metalness, 0.9) : spec.metalness;
    return {
      map,
      bumpMap: map,
      bumpScale: isWood ? 0.02 : 0,
      color: isWood ? "#ffffff" : spec.color,
      metalness: ringMetalness,
      roughness: spec.roughness,
      envMapIntensity: spec.metalness > 0.5 ? 1.4 : 0.6,
      opacity: spec.opacity,
    };
  }, [spec]);
  useEffect(() => () => {
    material.map?.dispose();
  }, [material]);
  return material;
}

function FrameBar({ size, position, material }: { size: [number, number, number]; position: [number, number, number]; material: { map?: CanvasTexture; color: string; metalness: number; roughness: number; opacity?: number } }) {
  return (
    <mesh position={position} castShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial map={material.map} color={material.color} metalness={material.metalness} roughness={material.roughness} envMapIntensity={material.metalness > 0.5 ? 1.2 : 0.6} transparent={material.opacity !== undefined && material.opacity < 1} opacity={material.opacity ?? 1} />
    </mesh>
  );
}

// The beaded inner edge of the gold frames: real gold spheres,
// instanced along the opening, half-embedded in the frame's inner
// front face — not drawn dots on a flat strip.
function BeadSpheres({ positions, z }: { positions: { x: number; y: number }[]; z: number }) {
  const ref = useRef<InstancedMesh>(null!);
  useLayoutEffect(() => {
    if (ref.current) setInstancedMatrices(ref.current, positions, z, 1);
  }, [positions, z]);
  if (positions.length === 0) return null;
  return (
    <instancedMesh ref={ref} args={[undefined, undefined, positions.length]} frustumCulled={false} castShadow>
      <sphereGeometry args={[0.008, 12, 10]} />
      <meshStandardMaterial color="#d4af37" metalness={0.9} roughness={0.3} envMapIntensity={1.2} />
    </instancedMesh>
  );
}

// The carved border of the ornate gold frames: rosettes — and, for the
// dense baroque carving, alternating rosettes and scrolls — instanced
// along the outer moulding band, standing proud of the front face.
function OrnamentSet({
  positions,
  z,
  scale,
  carved,
  color,
  metalness,
  roughness,
}: {
  positions: { x: number; y: number }[];
  z: number;
  scale: number;
  carved: boolean;
  color: string;
  metalness: number;
  roughness: number;
}) {
  const rosetteRef = useRef<InstancedMesh>(null!);
  const scrollRef = useRef<InstancedMesh>(null!);
  const rosetteGeo = useMemo(() => rosetteGeometry(), []);
  const scrollGeo = useMemo(() => scrollGeometry(), []);
  const rosettePositions = useMemo(() => (carved ? positions.filter((_, i) => i % 2 === 0) : positions), [carved, positions]);
  const scrollPositions = useMemo(() => (carved ? positions.filter((_, i) => i % 2 === 1) : []), [carved, positions]);
  useLayoutEffect(() => {
    if (rosetteRef.current) setInstancedMatrices(rosetteRef.current, rosettePositions, z, scale);
  }, [rosettePositions, z, scale]);
  useLayoutEffect(() => {
    if (scrollRef.current) setInstancedMatrices(scrollRef.current, scrollPositions, z, scale);
  }, [scrollPositions, z, scale]);
  if (positions.length === 0) return null;
  return (
    <group>
      <instancedMesh ref={rosetteRef} args={[rosetteGeo, undefined, Math.max(1, rosettePositions.length)]} frustumCulled={false} castShadow>
        <meshStandardMaterial color={color} metalness={Math.max(metalness, 0.9)} roughness={roughness} envMapIntensity={1.4} />
      </instancedMesh>
      {carved && scrollPositions.length > 0 && (
        <instancedMesh ref={scrollRef} args={[scrollGeo, undefined, scrollPositions.length]} frustumCulled={false} castShadow>
          <meshStandardMaterial color={color} metalness={Math.max(metalness, 0.9)} roughness={roughness} envMapIntensity={1.4} />
        </instancedMesh>
      )}
    </group>
  );
}

// The real photo of a digitised frame, worn as a skin on the front face
// of the 3D moulding rings. The photo is the skin, the extruded rings
// are the body: the skin is a set of thin planes laid on each level's
// front face, one per bar, so the frame keeps its real depth, profile
// steps and shadows. The strip PNG has the moulding's outer edge at the
// top of the image and its inner edge at the bottom; each plane maps
// the strip across its bar (U along the bar, repeated so the carving
// never stretches) and across its level's radial band (V). The instanced
// beads and rosettes are NOT rendered for photo frames — the photo
// already carries the real beads and carving, and doubling them would
// put a second, misaligned pattern on top.
function FramePhotoSkin({
  photo,
  levels,
  openingW,
  openingH,
  w,
  backZ,
  depth,
  metalness,
  roughness,
}: {
  photo: string;
  levels: FrameLevel[];
  openingW: number;
  openingH: number;
  w: number;
  backZ: number;
  depth: number;
  metalness: number;
  roughness: number;
}) {
  const texture = useTexture(photo);
  texture.colorSpace = SRGBColorSpace;
  // The strip's height/width ratio: one tile covers (band width) across
  // the bar and (band width * L/H) along it, so the carving is never
  // stretched no matter how long the bar is.
  const img = texture.image as unknown as { width?: number; height?: number } | undefined;
  const stripAspect = img && img.width && img.height ? img.height / img.width : 0.15;
  // The photo carries the real gold colour and carving: keep the metal
  // response moderate, or the room environment washes the photo out
  // into flat yellow (the bare-metal failure the photo replaces).
  const skinMetalness = Math.min(metalness, 0.45);
  // One texture clone per level per orientation: the horizontal bars
  // share a repeat (their length), the vertical bars another — the bars
  // are different lengths, so one repeat would stretch the carving.
  const levelSkins = useMemo(() => {
    return levels
      .map((level, li) => {
        const bandW = (level.outerFrac - level.innerFrac) * w;
        if (!(bandW > 0.001)) return null;
        const skinZ = backZ + level.depthFrac * depth + 0.0015;
        const outerW = openingW + 2 * level.outerFrac * w;
        const innerH = openingH + 2 * level.innerFrac * w;
        const yTop = openingH / 2 + ((level.innerFrac + level.outerFrac) / 2) * w;
        const xSide = openingW / 2 + ((level.innerFrac + level.outerFrac) / 2) * w;
        const uH = (outerW / bandW) * stripAspect;
        const uV = (innerH / bandW) * stripAspect;
        const vRepeat = level.outerFrac - level.innerFrac;
        const vOffset = level.innerFrac;
        const hTex = texture.clone();
        hTex.wrapS = RepeatWrapping;
        hTex.repeat.set(uH, vRepeat);
        hTex.offset.set(0, vOffset);
        hTex.needsUpdate = true;
        const vTex = texture.clone();
        vTex.wrapS = RepeatWrapping;
        // Vertical bars: NO texture rotation. The mesh itself is turned
        // +/-90 deg, and the UVs travel with it, so the strip's long axis
        // (U, the grain) already runs along the moulding's length — exactly
        // as on the horizontal bars. Rotating the texture as well would
        // put the grain across the bar (verified against Three.js
        // Matrix3.setUvTransform: rotation +PI/2 makes the grain
        // horizontal on a vertical stile). Keep the same repeat/offset
        // layout as the horizontal bars: U repeats along the bar, V
        // selects the band slice.
        vTex.repeat.set(uV, vRepeat);
        vTex.offset.set(0, vOffset);
        vTex.needsUpdate = true;
        return { key: li, skinZ, outerW, innerH, bandW, yTop, xSide, hTex, vTex };
      })
      .filter((x): x is NonNullable<typeof x> => x !== null);
  }, [texture, levels, openingW, openingH, w, backZ, depth, stripAspect]);
  useEffect(
    () => () => {
      levelSkins.forEach(({ hTex, vTex }) => {
        hTex.dispose();
        vTex.dispose();
      });
    },
    [levelSkins],
  );
  return (
    <group>
      {levelSkins.map(({ key, skinZ, outerW, innerH, bandW, yTop, xSide, hTex, vTex }) => (
        <group key={key}>
          {/* Top bar — outer edge up. */}
          <mesh position={[0, yTop, skinZ]}>
            <planeGeometry args={[outerW, bandW]} />
            <meshStandardMaterial map={hTex} color="#ffffff" metalness={skinMetalness} roughness={roughness} envMapIntensity={0.6} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
          </mesh>
          {/* Bottom bar — turned 180 deg so the outer edge is down. */}
          <mesh position={[0, -yTop, skinZ]} rotation={[0, 0, Math.PI]}>
            <planeGeometry args={[outerW, bandW]} />
            <meshStandardMaterial map={hTex} color="#ffffff" metalness={skinMetalness} roughness={roughness} envMapIntensity={0.6} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
          </mesh>
          {/* Left bar — turned +90 deg so the outer edge is left. */}
          <mesh position={[-xSide, 0, skinZ]} rotation={[0, 0, Math.PI / 2]}>
            <planeGeometry args={[innerH, bandW]} />
            <meshStandardMaterial map={vTex} color="#ffffff" metalness={skinMetalness} roughness={roughness} envMapIntensity={0.6} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
          </mesh>
          {/* Right bar — turned -90 deg so the outer edge is right. */}
          <mesh position={[xSide, 0, skinZ]} rotation={[0, 0, -Math.PI / 2]}>
            <planeGeometry args={[innerH, bandW]} />
            <meshStandardMaterial map={vTex} color="#ffffff" metalness={skinMetalness} roughness={roughness} envMapIntensity={0.6} polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// The frame around an artwork, built from its digitized spec: extruded
// moulding rings with a real stepped profile (no corner joints, the
// steps catch light), a back panel (the tray a floated work hangs
// against), an optional mat the work sits on, thin gold trim rings,
// real bead spheres on the inner edge where the photo has them, and
// real carved rosettes / scrolls on the ornate gold frames.
// Local z: the frame back sits at -0.06, the front face at -0.06 + depth.
function FrameAssembly({ width, height, spec, selected }: { width: number; height: number; spec: FrameSpec; selected: boolean }) {
  const w = spec.width;
  const d = spec.depth;
  const border = Math.max(spec.floatGap, spec.mat?.width ?? 0);
  const openingW = width + 2 * border;
  const openingH = height + 2 * border;
  const outerW = openingW + 2 * w;
  const outerH = openingH + 2 * w;
  const backZ = -0.06;
  const frontZ = backZ + d;
  const artZ = frontZ - spec.recess;
  const material = useFrameMaterial(spec);
  const matMap = useMemo(() => (spec.mat ? matTexture(spec.mat.texture, spec.mat.color) : undefined), [spec.mat]);
  const trim = spec.trim;
  const trimZ = artZ - 0.005;
  // Moulding levels: each level is one extruded ring; together they tile
  // the bar and step down toward the artwork.
  const levels = useMemo(() => profileLevels(spec.profile), [spec.profile]);
  const bevel = useMemo(() => profileBevel(spec.profile, w, d), [spec.profile, w, d]);
  const rings = useMemo(
    () =>
      levels.map((level) =>
        frameRingGeometry(
          openingW + 2 * level.outerFrac * w,
          openingH + 2 * level.outerFrac * w,
          openingW + 2 * level.innerFrac * w,
          openingH + 2 * level.innerFrac * w,
          level.depthFrac * d,
          bevel.size,
          bevel.thickness,
          bevel.segments,
        ),
      ),
    [levels, openingW, openingH, w, d, bevel],
  );
  useEffect(() => () => {
    rings.forEach((g) => g.dispose());
  }, [rings]);
  // Front face of the innermost level — where the beads sit.
  const innerFrontZ = backZ + levels[levels.length - 1].depthFrac * d;
  const beadPositions = useMemo(
    () => (spec.bead ? perimeterPositions(openingW + 0.018, openingH + 0.018, 0.02) : []),
    [spec.bead, openingW, openingH],
  );
  // Carved border: rosettes (and scrolls, for the dense baroque carving)
  // along the outer moulding band's centreline.
  const ornament = spec.ornament ?? "none";
  const outerLevel = levels[0];
  const bandCenter = ((outerLevel.innerFrac + outerLevel.outerFrac) / 2) * w;
  const bandWidth = (outerLevel.outerFrac - outerLevel.innerFrac) * w;
  const ornamentLoop = useMemo(
    () => (ornament === "none" ? [] : perimeterPositions(openingW + 2 * bandCenter, openingH + 2 * bandCenter, spec.ornamentSpacing ?? 0.16)),
    [ornament, openingW, openingH, bandCenter, spec.ornamentSpacing],
  );
  const ornamentScale = Math.min(1.2, Math.max(0.45, (bandWidth * 0.7) / 0.075));
  return (
    <group>
      {/* Back panel: the tray interior a floated work hangs against. */}
      <mesh position={[0, 0, backZ + 0.02]}>
        <boxGeometry args={[outerW, outerH, 0.04]} />
        <meshStandardMaterial color={selected ? "#aa7958" : spec.trayColor ?? spec.color} metalness={0} roughness={0.9} />
      </mesh>
      {/* Profiled moulding rings. */}
      {rings.map((geo, i) => (
        <mesh key={i} geometry={geo} position={[0, 0, backZ]} castShadow>
          <meshStandardMaterial
            map={material.map}
            bumpMap={material.bumpMap}
            bumpScale={material.bumpScale}
            color={material.color}
            metalness={material.metalness}
            roughness={material.roughness}
            envMapIntensity={material.envMapIntensity}
            transparent={material.opacity !== undefined && material.opacity < 1}
            opacity={material.opacity ?? 1}
          />
        </mesh>
      ))}
      {/* Photo skin: the real frame photo on the front face (the rings
          underneath keep the real depth, profile steps and shadows). */}
      {spec.photo && (
        <FramePhotoSkin
          photo={spec.photo}
          levels={levels}
          openingW={openingW}
          openingH={openingH}
          w={w}
          backZ={backZ}
          depth={d}
          metalness={spec.metalness}
          roughness={spec.roughness}
        />
      )}
      {spec.profile === "rounded" && (
        <group>
          <mesh position={[0, openingH / 2 + w * 0.05, frontZ - w * 0.05]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[w * 0.22, w * 0.22, openingW, 16]} />
            <meshStandardMaterial color={spec.color} metalness={material.metalness} roughness={material.roughness} envMapIntensity={material.envMapIntensity} />
          </mesh>
          <mesh position={[0, -openingH / 2 - w * 0.05, frontZ - w * 0.05]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[w * 0.22, w * 0.22, openingW, 16]} />
            <meshStandardMaterial color={spec.color} metalness={material.metalness} roughness={material.roughness} envMapIntensity={material.envMapIntensity} />
          </mesh>
          <mesh position={[-openingW / 2 - w * 0.05, 0, frontZ - w * 0.05]}>
            <cylinderGeometry args={[w * 0.22, w * 0.22, openingH, 16]} />
            <meshStandardMaterial color={spec.color} metalness={material.metalness} roughness={material.roughness} envMapIntensity={material.envMapIntensity} />
          </mesh>
          <mesh position={[openingW / 2 + w * 0.05, 0, frontZ - w * 0.05]}>
            <cylinderGeometry args={[w * 0.22, w * 0.22, openingH, 16]} />
            <meshStandardMaterial color={spec.color} metalness={material.metalness} roughness={material.roughness} envMapIntensity={material.envMapIntensity} />
          </mesh>
        </group>
      )}
      {/* Glass over the artwork: a faint sheen, strongest for clear
          glass, barely there for non-reflective, in between for museum. */}
      {spec.glass && spec.glass !== "none" && (
        <mesh position={[0, 0, artZ + 0.012]}>
          <planeGeometry args={[openingW, openingH]} />
          <meshBasicMaterial color="#ffffff" transparent opacity={spec.glass === "clear" ? 0.07 : spec.glass === "non-reflective" ? 0.03 : 0.05} depthWrite={false} />
        </mesh>
      )}
      {/* Mat between frame and artwork. */}
      {spec.mat && (
        <mesh position={[0, 0, artZ - 0.01]}>
          <planeGeometry args={[openingW, openingH]} />
          <meshStandardMaterial map={matMap} color={matMap ? "#ffffff" : spec.mat.color} metalness={0} roughness={0.95} />
        </mesh>
      )}
      {/* Thin gold trim: around the artwork, between frame and mat, or both. */}
      {trim && (trim.at === "artwork" || trim.at === "both") && (
        <group>
          <FrameBar size={[width + 2 * trim.width, trim.width, 0.02]} position={[0, height / 2 + trim.width / 2, trimZ]} material={{ map: undefined, color: trim.color, metalness: 0.9, roughness: 0.3 }} />
          <FrameBar size={[width + 2 * trim.width, trim.width, 0.02]} position={[0, -height / 2 - trim.width / 2, trimZ]} material={{ map: undefined, color: trim.color, metalness: 0.9, roughness: 0.3 }} />
          <FrameBar size={[trim.width, height, 0.02]} position={[-width / 2 - trim.width / 2, 0, trimZ]} material={{ map: undefined, color: trim.color, metalness: 0.9, roughness: 0.3 }} />
          <FrameBar size={[trim.width, height, 0.02]} position={[width / 2 + trim.width / 2, 0, trimZ]} material={{ map: undefined, color: trim.color, metalness: 0.9, roughness: 0.3 }} />
        </group>
      )}
      {trim && (trim.at === "mat" || trim.at === "both") && (
        <group>
          <FrameBar size={[openingW, trim.width, 0.02]} position={[0, openingH / 2 + trim.width / 2, trimZ]} material={{ map: undefined, color: trim.color, metalness: 0.9, roughness: 0.3 }} />
          <FrameBar size={[openingW, trim.width, 0.02]} position={[0, -openingH / 2 - trim.width / 2, trimZ]} material={{ map: undefined, color: trim.color, metalness: 0.9, roughness: 0.3 }} />
          <FrameBar size={[trim.width, openingH, 0.02]} position={[-openingW / 2 - trim.width / 2, 0, trimZ]} material={{ map: undefined, color: trim.color, metalness: 0.9, roughness: 0.3 }} />
          <FrameBar size={[trim.width, openingH, 0.02]} position={[openingW / 2 + trim.width / 2, 0, trimZ]} material={{ map: undefined, color: trim.color, metalness: 0.9, roughness: 0.3 }} />
        </group>
      )}
      {/* Beaded inner edge: real gold spheres on the inner front face.
          Not for photo frames — the photo already carries the beads. */}
      {spec.bead && !spec.photo && <BeadSpheres positions={beadPositions} z={innerFrontZ + 0.003} />}
      {/* Carved border: real rosettes (and scrolls) on the outer band.
          Not for photo frames — the photo already carries the carving. */}
      {ornament !== "none" && !spec.photo && (
        <OrnamentSet positions={ornamentLoop} z={frontZ - 0.003} scale={ornamentScale} carved={ornament === "carved"} color={spec.color} metalness={spec.metalness} roughness={spec.roughness} />
      )}
    </group>
  );
}

function ArtworkFrame({
  artwork,
  selected,
  onSelect,
  dragged,
  editable,
  onDragStart,
  onHoverChange,
}: {
  artwork: Artwork;
  selected: boolean;
  // Second argument: Shift/Ctrl/Cmd was held — the editor adds the
  // artwork to the multi-selection instead of replacing it.
  onSelect?: (id: string, additive?: boolean) => void;
  dragged?: React.RefObject<boolean>;
  // Editor only: drag the artwork along its wall with the hand cursor,
  // and resize it from the lime handle at its bottom-right corner.
  editable?: boolean;
  onDragStart?: (id: string, mode: "move" | "resize", event: ThreeEvent<PointerEvent>) => void;
  onHoverChange?: (hover: { id: string; cursor: string } | null) => void;
}) {
  const [x, y, z] = artwork.position;
  const { width, height } = artworkSize(artwork);
  // Unified mode (the reference file): artworks stay interactive while
  // walking — there is no separate walk mode that turns them off.
  const interactive = editable;
  // Curatorial text (the reference room's "Texte curatorial"): the
  // artwork renders as a canvas text panel instead of an image. The
  // typeface is one of the four keys (d/s/g/m); anything else falls
  // back to Bold display.
  const textFont: SunlightTextFont =
    artwork.textFont === "s" || artwork.textFont === "g" || artwork.textFont === "m" ? artwork.textFont : "d";
  // The frame finish chosen in the inspector (wood, metal, gold, black,
  // white, or none) or a custom Frame Studio configuration encoded in
  // the frame value. "None" hangs the print frameless on the wall.
  const frameValue = artwork.frame ?? "wood";
  const frame = resolveFrameSpec(frameValue);
  // Depth of the print on the wall (textured or placeholder).
  const printZ = frameValue === "none" ? 0.02 : -0.06 + frame.depth - frame.recess + 0.005;
  // Full framed size on the wall, for the selection outline and the
  // resize handle (wide frames and mats stick out past the artwork).
  const frameOuter = frameOuterSize(artwork);
  return (
    <group
      position={[x, y, z]}
      rotation={[0, artwork.rotation, 0]}
      scale={artwork.scale}
      onClick={(event) => {
        if (dragged?.current) return;
        // In the editor a single click walks to the point: the click
        // passes through to the floor (no stopPropagation, no
        // selection) — selection is by double-click. In the public
        // viewer a click still opens the detail sheet (onSelect sets
        // `selected` there). It never walks up to the artwork — walking
        // to a piece is via the mini-plan stand point, as in the
        // reference file.
        if (interactive) return;
        event.stopPropagation();
        onSelect?.(artwork.id, event.shiftKey || event.ctrlKey || event.metaKey);
      }}
      onDoubleClick={(event) => {
        // Editor selection is by double-click (or double-tap): a
        // double-click within 350 ms and 28 px selects the artwork
        // (additive with Shift/Ctrl/Cmd). The public viewer keeps its
        // single-click sheet.
        if (!interactive) return;
        event.stopPropagation();
        if (dragged?.current) return;
        onSelect?.(artwork.id, event.shiftKey || event.ctrlKey || event.metaKey);
      }}
      onPointerOver={(event) => {
        if (!interactive) return;
        event.stopPropagation();
        onHoverChange?.({ id: artwork.id, cursor: selected ? "grab" : "default" });
      }}
      onPointerOut={() => {
        if (!interactive) return;
        onHoverChange?.(null);
      }}
      onPointerDown={(event) => {
        // A drag starts only from an already-selected piece (the
        // editor's double-click selection): pressing an unselected
        // piece does nothing, so a click on it walks to the point
        // instead of moving it. Holding Shift/Ctrl/Cmd adds the piece
        // to the selection first, then drags the whole selection
        // together. If the artwork is already selected the selection
        // is kept so a multi-selection drags together.
        if (!interactive) return;
        event.stopPropagation();
        if (!selected) {
          if (!(event.shiftKey || event.ctrlKey || event.metaKey)) return;
          onSelect?.(artwork.id, true);
        }
        onDragStart?.(artwork.id, "move", event);
      }}
    >
      {frameValue !== "none" && <FrameAssembly width={width} height={height} spec={frame} selected={selected} />}
      {/* Frameless prints sit almost flat on the wall; framed works sit at
          the frame's front face, recessed inside a shadow box. A text
          artwork renders its canvas text panel; an image artwork its
          image; anything else the placeholder print. */}
      {artwork.text ? (
        <SunlightTextPrint text={artwork.text} font={textFont} width={width} height={height} z={printZ} />
      ) : artwork.imageUrl ? (
        <LoadedArtwork imageUrl={artwork.imageUrl} width={width} height={height} z={printZ} color={artwork.color} accent={artwork.accent} frameless={frameValue === "none"} />
      ) : (
        <PlaceholderPrint width={width} height={height} z={printZ} frameless={frameValue === "none"} color={artwork.color} accent={artwork.accent} />
      )}
      {selected && (
        <mesh position={[0, 0, -0.1]}>
          <boxGeometry args={[frameOuter.width + 0.15, frameOuter.height + 0.15, 0.02]} />
          <meshBasicMaterial color="#bc8056" wireframe />
        </mesh>
      )}
      {interactive && selected && (
        <mesh
          position={[frameOuter.width / 2 + 0.18, -frameOuter.height / 2 - 0.18, -0.06 + frame.depth + 0.02]}
          onPointerDown={(event) => {
            event.stopPropagation();
            onDragStart?.(artwork.id, "resize", event);
          }}
          onPointerOver={(event) => {
            event.stopPropagation();
            onHoverChange?.({ id: artwork.id, cursor: "nwse-resize" });
          }}
          onPointerOut={() => {
            onHoverChange?.({ id: artwork.id, cursor: "grab" });
          }}
        >
          <boxGeometry args={[0.26, 0.26, 0.26]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
        </mesh>
      )}
    </group>
  );
}

// Sheer curtain panel: a translucent plane with gentle folds, made by
// displacing a segmented plane along a sine wave.
function SheerPanel({ width, color }: { width: number; color: string }) {
  const geometry = useMemo(() => {
    const geo = new PlaneGeometry(width, 2.7, 24, 1);
    const pos = geo.attributes.position as BufferAttribute;
    for (let i = 0; i < pos.count; i += 1) {
      pos.setZ(i, Math.sin(pos.getX(i) * 4.5) * 0.07);
    }
    geo.computeVertexNormals();
    return geo;
  }, [width]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return (
    <mesh geometry={geometry} position={[0, 1.4, 0]}>
      <meshStandardMaterial color={color} transparent opacity={0.32} side={DoubleSide} roughness={0.9} depthWrite={false} />
    </mesh>
  );
}

// --- Wall text without troika -------------------------------------------
// Wall text used to render with drei's <Text> (troika-three-text), passing
// a font FAMILY name ("DM Sans", "Fraunces") as the `font` prop. Troika
// treats that string as a font FILE URL, and drei suspends rendering on
// preloadFont until that font loads — the fetch of "DM Sans" can never
// resolve, so the <Suspense> around the whole room unmounted the scene:
// the viewport went uniformly cream (the canvas background colour) and no
// control recovered it, while the red title never rendered at all. Wall
// text now draws on a 2D canvas into a texture: the site's real webfonts
// (already loaded for the page) draw directly, so there is no font
// download, no suspend, and nothing that can blank the scene. The room's
// curatorial text used the same troika component (its default font came
// from a CDN, the same latent failure), so it draws the same way.

// Pixel density of the wall-text canvas (pixels per metre of wall).
const WALL_TEXT_PX_PER_M = 300;

function wrapCanvasText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (line && ctx.measureText(test).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = test;
    }
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

function wallTextFontFace(font: keyof typeof WALL_TEXT_FONTS, weight: number, px: number): string {
  const spec = WALL_TEXT_FONTS[font];
  const fallback = font === "serif" ? "Georgia, serif" : font === "mono" ? "monospace" : "sans-serif";
  return `${weight} ${px}px "${spec.family}", ${fallback}`;
}

// Draw a wall-text element onto a canvas and return the texture plus the
// height the text really takes (metres), so the plane fits the text
// instead of the text being squeezed into an estimated box.
function createWallTextTexture(element: RoomElement, widthM: number): { texture: CanvasTexture; heightM: number } | null {
  if (typeof document === "undefined") return null;
  const px = WALL_TEXT_PX_PER_M;
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(2, Math.round(widthM * px));
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  const fontKey = element.font ?? "display";
  const fontSpec = WALL_TEXT_FONTS[fontKey];
  const align = element.align ?? "left";
  const layout = element.layout ?? "stacked";
  const titlePx = Math.max(8, element.fontSize * px);
  const bodyPx = Math.max(6, (element.bodySize ?? 0.11) * px);
  const titleLineH = element.fontSize * 1.08 * px;
  const bodyLineH = (element.bodySize ?? 0.11) * 1.5 * px;
  const gapPx = element.body ? 0.18 * px : 0;
  const padX = 0.15 * px;
  // Measure first (at a generous height), then size the canvas to what
  // the text really takes — no clipping, no stretched empty space.
  canvas.height = 8;
  const titleLines = (element.title || "Wall text").split("\n").map((l) => l.trim()).filter(Boolean);
  const titleRows = titleLines.length ? titleLines : ["Wall text"];
  const setTitleFont = () => {
    ctx.font = wallTextFontFace(fontKey, fontSpec.weight, titlePx);
    try { ctx.letterSpacing = `${fontSpec.letterSpacing * titlePx}px`; } catch { /* older canvas: no letter-spacing */ }
  };
  const setBodyFont = () => {
    ctx.font = wallTextFontFace(fontKey, 400, bodyPx);
    try { ctx.letterSpacing = "0px"; } catch { /* older canvas */ }
  };
  const anchorX = align === "center" ? canvas.width / 2 : align === "right" ? canvas.width - padX : padX;
  let bodyRows: string[] = [];
  let titleWrapped: string[] = [];
  let contentH: number;
  if (layout === "side") {
    setTitleFont();
    titleWrapped = titleRows.flatMap((line) => wrapCanvasText(ctx, line, widthM * 0.55 * px - padX));
    setBodyFont();
    bodyRows = element.body ? wrapCanvasText(ctx, element.body, widthM * 0.36 * px) : [];
    contentH = Math.max(titleWrapped.length * titleLineH, bodyRows.length * bodyLineH);
  } else if (layout === "block") {
    setTitleFont();
    titleWrapped = wrapCanvasText(ctx, titleRows.join(" "), widthM * px - padX * 2);
    setBodyFont();
    bodyRows = element.body ? wrapCanvasText(ctx, element.body, widthM * px - padX * 2) : [];
    contentH = titleWrapped.length * titleLineH + gapPx + bodyRows.length * bodyLineH;
  } else {
    setTitleFont();
    titleWrapped = titleRows;
    setBodyFont();
    bodyRows = element.body ? wrapCanvasText(ctx, element.body, widthM * px - padX * 2) : [];
    contentH = titleWrapped.length * titleLineH + gapPx + bodyRows.length * bodyLineH;
  }
  canvas.height = Math.max(2, Math.round(contentH));
  // Resizing a canvas resets its context state, so set everything again.
  ctx.textAlign = align;
  ctx.textBaseline = "top";
  const drawTitle = (lines: string[], x: number, yTop: number) => {
    setTitleFont();
    ctx.fillStyle = element.textColor;
    ctx.textAlign = layout === "side" ? "left" : align;
    lines.forEach((line, i) => ctx.fillText(line, x, yTop + i * titleLineH));
  };
  const drawBody = (lines: string[], x: number, yTop: number) => {
    setBodyFont();
    ctx.fillStyle = element.bodyColor;
    ctx.textAlign = layout === "side" ? "left" : align;
    lines.forEach((line, i) => ctx.fillText(line, x, yTop + i * bodyLineH));
  };
  if (layout === "side") {
    drawTitle(titleWrapped, padX, 0);
    if (bodyRows.length) drawBody(bodyRows, widthM * 0.64 * px, 0);
  } else if (layout === "block") {
    drawTitle(titleWrapped, anchorX, 0);
    if (bodyRows.length) drawBody(bodyRows, anchorX, titleWrapped.length * titleLineH + gapPx);
  } else {
    drawTitle(titleWrapped, anchorX, 0);
    if (bodyRows.length) drawBody(bodyRows, anchorX, titleWrapped.length * titleLineH + gapPx);
  }
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.anisotropy = 4;
  return { texture, heightM: canvas.height / px };
}

// A wall-text element as a flat transparent plane: the letters sit
// straight on the wall, like the reference photo. The texture is redrawn
// whenever the text or its typography changes, and once the webfonts
// finish loading (the first paint may use a fallback face).
function WallTextPlane({ element, widthM }: { element: RoomElement; widthM: number }) {
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts) {
      void fonts.load(`700 100px "DM Sans"`).catch(() => {});
      void fonts.load(`600 100px "Fraunces"`).catch(() => {});
      fonts.ready.then(() => { if (alive) setFontsReady(true); }).catch(() => {});
    }
    return () => { alive = false; };
  }, []);
  const drawn = useMemo(
    () => createWallTextTexture(element, widthM),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [element.title, element.body, element.font, element.align, element.layout, element.fontSize, element.bodySize, element.textColor, element.bodyColor, widthM, fontsReady],
  );
  useEffect(() => () => { drawn?.texture.dispose(); }, [drawn]);
  if (!drawn) return null;
  return (
    <mesh position={[0, 0, 0.02]}>
      <planeGeometry args={[widthM, drawn.heightM]} />
      <meshBasicMaterial map={drawn.texture} transparent toneMapped={false} side={DoubleSide} />
    </mesh>
  );
}

// The room's curatorial text, drawn the same canvas way (it used the same
// troika component). Centred, on a backing board in the room's wall colour.
function CuratorialTextPlane({ text, maxWidthM, wallColor }: { text: string; maxWidthM: number; wallColor: string }) {
  const [fontsReady, setFontsReady] = useState(false);
  useEffect(() => {
    let alive = true;
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    fonts?.ready.then(() => { if (alive) setFontsReady(true); }).catch(() => {});
    return () => { alive = false; };
  }, []);
  const drawn = useMemo(() => {
    if (typeof document === "undefined") return null;
    const px = WALL_TEXT_PX_PER_M;
    const fontPx = 0.15 * px;
    const lineH = 0.15 * 1.5 * px;
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(2, Math.round(maxWidthM * px));
    canvas.height = 8;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.font = `400 ${fontPx}px "DM Sans", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    const lines = wrapCanvasText(ctx, text, maxWidthM * px - 0.3 * px);
    canvas.height = Math.max(2, Math.round(lines.length * lineH));
    ctx.font = `400 ${fontPx}px "DM Sans", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = "#252722";
    lines.forEach((line, i) => ctx.fillText(line, canvas.width / 2, i * lineH));
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return { texture, heightM: canvas.height / px };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, maxWidthM, fontsReady]);
  useEffect(() => () => { drawn?.texture.dispose(); }, [drawn]);
  if (!drawn) return null;
  return (
    <group>
      <mesh position={[0, 0, -0.015]}>
        <planeGeometry args={[maxWidthM + 0.6, drawn.heightM + 0.3]} />
        <meshBasicMaterial color={wallColor} />
      </mesh>
      <mesh position={[0, 0, 0.01]}>
        <planeGeometry args={[maxWidthM, drawn.heightM]} />
        <meshBasicMaterial map={drawn.texture} transparent toneMapped={false} />
      </mesh>
    </group>
  );
}

// --- 3D builder: grid overlay + measurement guides --------------------
// A 0.5 m grid on the floor (editor only, toggled from the toolbar).
// When it is on, dragged artworks and elements snap to 0.25 m steps —
// the snapping itself happens in the editor's scene-update handlers.
function FloorGrid({ width, depth }: { width: number; depth: number }) {
  const positions = useMemo(() => {
    const pts: number[] = [];
    const step = 0.5;
    const nx = Math.round(width / step);
    const nz = Math.round(depth / step);
    for (let i = 0; i <= nx; i += 1) {
      const x = -width / 2 + i * step;
      pts.push(x, 0.02, -depth / 2, x, 0.02, depth / 2);
    }
    for (let j = 0; j <= nz; j += 1) {
      const z = -depth / 2 + j * step;
      pts.push(-width / 2, 0.02, z, width / 2, 0.02, z);
    }
    return new Float32Array(pts);
  }, [width, depth]);
  return (
    <lineSegments>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <lineBasicMaterial color="#ffffff" transparent opacity={0.45} />
    </lineSegments>
  );
}

// A small canvas-texture label (same approach as the wall text: no
// troika, so a label can never suspend the scene). White pill, gold
// border, dark text — the site's own colours.
function MeasureLabel({
  text,
  position,
  rotation,
}: {
  text: string;
  position: [number, number, number];
  rotation?: [number, number, number];
}) {
  const drawn = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    const measure = canvas.getContext("2d");
    if (!measure) return null;
    const fontPx = 44;
    measure.font = `600 ${fontPx}px "DM Sans", sans-serif`;
    const widthPx = Math.ceil(measure.measureText(text).width) + 30;
    canvas.width = widthPx;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.font = `600 ${fontPx}px "DM Sans", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#fdfdfc";
    ctx.fillRect(0, 0, widthPx, 64);
    ctx.strokeStyle = "#000000";
    ctx.lineWidth = 3;
    ctx.strokeRect(1.5, 1.5, widthPx - 3, 61);
    ctx.fillStyle = "#252722";
    ctx.fillText(text, widthPx / 2, 34);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    texture.anisotropy = 4;
    return { texture, widthM: widthPx / 300, heightM: 64 / 300 };
  }, [text]);
  useEffect(() => () => { drawn?.texture.dispose(); }, [drawn]);
  if (!drawn) return null;
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={[drawn.widthM, drawn.heightM]} />
      <meshBasicMaterial map={drawn.texture} transparent toneMapped={false} side={DoubleSide} />
    </mesh>
  );
}

type MeasureWall = "back" | "front" | "left" | "right";

// Which wall an artwork hangs on, from its position (same 0.28 m inset
// and 0.45 m tolerance as the editor's wallsForArtwork).
function measureWallKey(artwork: Artwork, width: number, depth: number, zCenter = 0): MeasureWall | null {
  const [x, , z] = artwork.position;
  const inset = 0.28;
  const distances: [MeasureWall, number][] = [
    ["back", Math.abs(z - (zCenter - depth / 2 + inset))],
    ["front", Math.abs(z - (zCenter + depth / 2 - inset))],
    ["left", Math.abs(x - (-width / 2 + inset))],
    ["right", Math.abs(x - (width / 2 - inset))],
  ];
  distances.sort((a, b) => a[1] - b[1]);
  return distances[0][1] <= 0.45 ? distances[0][0] : null;
}

// Dimension lines + labels between neighbouring artworks on the same
// wall, and a vertical centre-height line for the selected artwork.
// Every distance is computed from the real positions — nothing here is
// hardcoded.
function MeasurementGuides({
  artworks,
  selectedId,
  width,
  depth,
  // Centre of the room along Z (0 for the old centred rooms, -1 for
  // Sunlight, whose floor is centred at z = -1): the walls sit at
  // zCenter ± depth / 2.
  zCenter = 0,
}: {
  artworks: Artwork[];
  selectedId?: string;
  width: number;
  depth: number;
  zCenter?: number;
}) {
  const guides = useMemo(() => {
    const byWall = new Map<MeasureWall, Artwork[]>();
    for (const artwork of artworks) {
      const wall = measureWallKey(artwork, width, depth, zCenter);
      if (!wall) continue;
      const list = byWall.get(wall) ?? [];
      list.push(artwork);
      byWall.set(wall, list);
    }
    const lines: number[] = [];
    const labels: { text: string; position: [number, number, number]; rotation: [number, number, number] }[] = [];
    const wallOffset = 0.45; // in front of the wall, clear of the frames
    for (const [wall, list] of byWall) {
      const along = wall === "back" || wall === "front"
        ? (artwork: Artwork) => artwork.position[0]
        : (artwork: Artwork) => artwork.position[2];
      const sorted = [...list].sort((a, b) => along(a) - along(b));
      const rotation: [number, number, number] = wall === "front" ? [0, Math.PI, 0] : wall === "left" ? [0, Math.PI / 2, 0] : wall === "right" ? [0, -Math.PI / 2, 0] : [0, 0, 0];
      for (let i = 0; i + 1 < sorted.length; i += 1) {
        const a = sorted[i];
        const b = sorted[i + 1];
        const aAlong = along(a);
        const bAlong = along(b);
        const centreCm = Math.round(Math.abs(bAlong - aAlong) * 100);
        const y = (a.position[1] + b.position[1]) / 2;
        // The dimension line runs between the two centres, 0.45 m out
        // from the wall; short ticks mark each end.
        const at = (v: number): [number, number, number] => {
          if (wall === "back") return [v, y, zCenter - depth / 2 + 0.28 + wallOffset];
          if (wall === "front") return [v, y, zCenter + depth / 2 - 0.28 - wallOffset];
          if (wall === "left") return [-width / 2 + 0.28 + wallOffset, y, v];
          return [width / 2 - 0.28 - wallOffset, y, v];
        };
        const p1 = at(aAlong);
        const p2 = at(bAlong);
        const mid = at((aAlong + bAlong) / 2);
        lines.push(p1[0], p1[1], p1[2], p2[0], p2[1], p2[2]);
        const tick = 0.09;
        if (wall === "back" || wall === "front") {
          lines.push(p1[0], p1[1] - tick, p1[2], p1[0], p1[1] + tick, p1[2]);
          lines.push(p2[0], p2[1] - tick, p2[2], p2[0], p2[1] + tick, p2[2]);
        } else {
          lines.push(p1[0], p1[1] - tick, p1[2], p1[0], p1[1] + tick, p1[2]);
          lines.push(p2[0], p2[1] - tick, p2[2], p2[0], p2[1] + tick, p2[2]);
        }
        labels.push({ text: `${centreCm} cm`, position: [mid[0], mid[1] + 0.22, mid[2]], rotation });
      }
    }
    // Centre height of the selected artwork: a vertical line from the
    // floor to its centre, 0.45 m out from its wall, labelled in cm.
    const selectedArtwork = artworks.find((artwork) => artwork.id === selectedId);
    if (selectedArtwork) {
      const wall = measureWallKey(selectedArtwork, width, depth, zCenter);
      if (wall) {
        const [x, y, z] = selectedArtwork.position;
        const rotation: [number, number, number] = wall === "front" ? [0, Math.PI, 0] : wall === "left" ? [0, Math.PI / 2, 0] : wall === "right" ? [0, -Math.PI / 2, 0] : [0, 0, 0];
        const base: [number, number, number] =
          wall === "back" ? [x, 0, zCenter - depth / 2 + 0.28 + wallOffset]
          : wall === "front" ? [x, 0, zCenter + depth / 2 - 0.28 - wallOffset]
          : wall === "left" ? [-width / 2 + 0.28 + wallOffset, 0, z]
          : [width / 2 - 0.28 - wallOffset, 0, z];
        lines.push(base[0], 0, base[2], base[0], y, base[2]);
        labels.push({ text: `${Math.round(y * 100)} cm`, position: [base[0], y / 2, base[2]], rotation });
      }
    }
    return { lines: new Float32Array(lines), labels };
  }, [artworks, selectedId, width, depth, zCenter]);
  if (guides.lines.length === 0 && guides.labels.length === 0) return null;
  return (
    <group>
      {guides.lines.length > 0 && (
        <lineSegments>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" args={[guides.lines, 3]} />
          </bufferGeometry>
          <lineBasicMaterial color="#ffffff" transparent opacity={0.9} />
        </lineSegments>
      )}
      {guides.labels.map((label, index) => (
        <MeasureLabel key={`${label.text}-${index}`} text={label.text} position={label.position} rotation={label.rotation} />
      ))}
    </group>
  );
}

// One placeable 3D element from the Elements palette, rendered in the room
// like an artwork: clickable to select, draggable along its plane (floor,
// wall or ceiling), resizable from the lime handle when selected.
// --- Teal sofa (GLB) ------------------------------------------------------
// The only GLB-based element: Kabeya's Blender-modelled teal velvet loveseat
// (public/models/sofa-teal.glb, 1.5 x 0.85 m, origin at floor centre).
// Loaded imperatively with GLTFLoader — deliberately NOT drei's useGLTF,
// which suspends: ElementMesh sits outside every <Suspense> boundary, and a
// suspending child would unmount the whole room (the troika failure of
// Nov 6). While the file loads nothing renders; it is a same-origin 344 KB
// file, so the wait is a frame or two. The promise is shared, so any number
// of sofas in a room costs one download; each instance clones the scene
// (geometries and baked materials stay shared) so R3F never has one object
// under two parents. The GLB's front faces -Z; like the chair, the sofa
// must face +Z into the room, so the clone is turned halfway round.
const SOFA_MODEL_URL = "/models/sofa-teal.glb";
let sofaModelPromise: Promise<{ scene: Object3D }> | null = null;
function loadSofaModel(): Promise<{ scene: Object3D }> {
  if (!sofaModelPromise) {
    sofaModelPromise = new Promise((resolve, reject) => {
      new GLTFLoader().load(
        SOFA_MODEL_URL,
        (gltf) => resolve(gltf),
        undefined,
        (error) => reject(error instanceof Error ? error : new Error("Could not load the sofa model.")),
      );
    });
    // A failed load must not poison every later sofa: allow a retry.
    sofaModelPromise.catch(() => {
      sofaModelPromise = null;
    });
  }
  return sofaModelPromise;
}

function SofaModel() {
  const [scene, setScene] = useState<Object3D | null>(null);
  useEffect(() => {
    let alive = true;
    loadSofaModel()
      .then((gltf) => {
        if (!alive) return;
        const clone = gltf.scene.clone(true);
        clone.traverse((child) => {
          const mesh = child as Object3D & { isMesh?: boolean; castShadow?: boolean; receiveShadow?: boolean };
          if (mesh.isMesh) {
            mesh.castShadow = true;
            mesh.receiveShadow = true;
          }
        });
        setScene(clone);
      })
      .catch(() => {
        // Load failed (e.g. the file is missing from the deploy): the
        // element stays invisible rather than breaking the room.
      });
    return () => {
      alive = false;
    };
  }, []);
  if (!scene) return null;
  return (
    <group rotation={[0, Math.PI, 0]}>
      <primitive object={scene} />
    </group>
  );
}

function ElementMesh({
  element,
  room,
  selected,
  onSelect,
  dragged,
  editable,
  onDragStart,
  onHoverChange,
  quality,
}: {
  element: RoomElement;
  room: GalleryRoom;
  selected: boolean;
  // Second argument: Shift/Ctrl/Cmd was held — the editor adds the
  // element to the multi-selection instead of replacing it.
  onSelect?: (id: string, additive?: boolean) => void;
  dragged?: React.RefObject<boolean>;
  editable?: boolean;
  onDragStart?: (id: string, mode: "move" | "resize", event: ThreeEvent<PointerEvent>) => void;
  onHoverChange?: (hover: { id: string; cursor: string } | null) => void;
  quality?: RenderQuality;
}) {
  const { height } = roomLayouts[room.layout];
  // Unified mode (the reference file): elements stay interactive while
  // walking — there is no separate walk mode that turns them off.
  const interactive = editable;
  const plane = ELEMENT_PLANES[element.type];
  const qualityCfg = RENDER_QUALITY_CONFIG[quality ?? "high"];
  // Wall-text geometry: title lines + body, laid out per the element's
  // layout choice. The panel is the text itself (no backing board — the
  // letters sit straight on the wall, like the reference photo).
  const wt = element.type === "wall-text" ? (() => {
    const W = Math.max(1, element.length);
    const rawLines = (element.title || "Wall text").split("\n").map((l) => l.trim()).filter(Boolean);
    const titleLines = rawLines.length ? rawLines : ["Wall text"];
    const font = WALL_TEXT_FONTS[element.font ?? "display"];
    const align = element.align ?? "left";
    const layout = element.layout ?? "stacked";
    const titleSize = element.fontSize;
    const bodySize = element.bodySize ?? 0.11;
    const lineH = titleSize * 1.08;
    const titleH = titleLines.length * lineH;
    // Estimate how many lines the body wraps to (troika wraps at maxWidth).
    const bodyMaxW = layout === "side" ? W * 0.36 : W - 0.3;
    const charsPerLine = Math.max(8, Math.floor(bodyMaxW / Math.max(0.02, bodySize * 0.52)));
    const bodyLines = element.body ? Math.max(1, Math.ceil(element.body.length / charsPerLine)) : 0;
    const bodyH = bodyLines * bodySize * 1.5;
    const gap = element.body ? 0.18 : 0;
    const contentH = layout === "side" ? Math.max(titleH, bodyH) : titleH + gap + bodyH;
    const anchorX = (align === "center" ? "center" : align === "right" ? "right" : "left") as "left" | "center" | "right";
    const xPos = align === "center" ? 0 : align === "right" ? W / 2 - 0.15 : -W / 2 + 0.15;
    return { W, titleLines, font, align, layout, titleSize, bodySize, lineH, titleH, bodyH, gap, contentH, top: contentH / 2, anchorX, xPos };
  })() : null;
  // A partition reads its own dimensions (length / height / thickness,
  // from the inspector sliders); its outline and panel follow them.
  const partitionDims = element.type === "partition" ? partitionDimsOf(element) : null;
  // Selection outline and resize-handle placement, per type.
  const outline: { size: [number, number, number]; y: number; handle: [number, number, number] } =
    element.type === "partition"
      ? { size: [partitionDims!.length + 0.3, partitionDims!.height - 0.2, 0.8], y: (partitionDims!.height - 0.25) / 2, handle: [partitionDims!.length / 2 + 0.18, 0.7, 0.12] }
      : element.type === "track-light"
        ? { size: [element.length + 0.3, 0.6, 0.8], y: 0, handle: [element.length / 2 + 0.18, 0, 0.12] }
        : element.type === "wall-text"
          ? { size: [(wt?.W ?? 4) + 0.3, (wt?.contentH ?? 1.4) + 0.3, 0.15], y: 0, handle: [(wt?.W ?? 4) / 2 + 0.18, (wt?.contentH ?? 1.4) / 2, 0.12] }
          : element.type === "shelf"
            ? { size: [element.length + 0.2, 1.3, 0.5], y: 0, handle: [element.length / 2 + 0.18, 0.4, 0.12] }
            : element.type === "curtain"
              ? { size: [element.length + 0.2, 2.9, 0.3], y: 1.4, handle: [element.length / 2 + 0.18, 1.4, 0.12] }
              : element.type === "column"
                ? { size: [1.1, height, 1.1], y: height / 2, handle: [0.55, height / 2, 0.2] }
                : element.type === "platform"
                  ? { size: [element.length + 0.3, 0.6, 2.3], y: 0.15, handle: [element.length / 2 + 0.18, 0.3, 0.2] }
                  : element.type === "stairs"
                    ? { size: [element.length + 0.3, 1.3, 1.5], y: 0.5, handle: [element.length / 2 + 0.18, 0.6, 0.2] }
                    : element.type === "arch"
                      ? { size: [element.length + 0.3, 2.9, 0.5], y: 1.3, handle: [element.length / 2 + 0.18, 1.3, 0.2] }
                      : element.type === "sofa"
                        ? { size: [1.8, 1.25, 1.15], y: 0.47, handle: [0.9, 0.5, 0.2] }
                        : { size: [1.7, 1.7, 1.3], y: 0.7, handle: [0.85, 0.65, 0.2] };
  // Track-light spot targets (three heads, aimed down and into the room).
  const trackTargets = useMemo(() => [new Object3D(), new Object3D(), new Object3D()], []);
  useEffect(() => {
    if (element.type !== "track-light") return;
    const spread = element.length / 3;
    trackTargets.forEach((target, index) => {
      target.position.set((index - 1) * spread, -2.6, 1.4);
    });
    return () => { trackTargets.forEach((target) => target.removeFromParent()); };
  }, [element.length, element.type, trackTargets]);
  const plinthHeight = PLINTH_HEIGHTS[element.variant] ?? 0.9;

  return (
    <group
      position={[element.x, element.y, element.z]}
      rotation={[0, element.rotation, 0]}
      scale={element.scale}
      onClick={(event) => {
        if (dragged?.current) return;
        // In the editor a single click walks to the point: the click
        // passes through to the floor (no stopPropagation, no
        // selection) — selection is by double-click. In the public
        // view a click still selects where it applies.
        if (interactive) return;
        event.stopPropagation();
        onSelect?.(element.id, event.shiftKey || event.ctrlKey || event.metaKey);
      }}
      onDoubleClick={(event) => {
        // Editor selection is by double-click (or double-tap).
        if (!interactive) return;
        event.stopPropagation();
        if (dragged?.current) return;
        onSelect?.(element.id, event.shiftKey || event.ctrlKey || event.metaKey);
      }}
      onPointerOver={(event) => {
        if (!interactive) return;
        event.stopPropagation();
        onHoverChange?.({ id: element.id, cursor: selected ? "grab" : "default" });
      }}
      onPointerOut={() => {
        if (!interactive) return;
        onHoverChange?.(null);
      }}
      onPointerDown={(event) => {
        // A drag starts only from an already-selected piece (the
        // editor's double-click selection): pressing an unselected
        // piece does nothing, so a click on it walks to the point
        // instead of moving it. Holding Shift/Ctrl/Cmd adds the piece
        // to the selection first, then drags the whole selection
        // together.
        if (!interactive) return;
        event.stopPropagation();
        if (!selected) {
          if (!(event.shiftKey || event.ctrlKey || event.metaKey)) return;
          onSelect?.(element.id, true);
        }
        onDragStart?.(element.id, "move", event);
      }}
    >
      {/* Contact decal: grounds freestanding furniture on the floor
          where the ceiling spots do not reach. Wall/ceiling pieces
          (plane !== "floor") stand on nothing, so they get none. */}
      {qualityCfg.contactDecals && plane === "floor" && (
        <ContactDecal width={Math.max(1.2, outline.size[0] * 0.9)} depth={Math.max(1.0, outline.size[2] * 0.9)} />
      )}
      {element.type === "partition" && (
        <group>
          {/* Small feet, then a base plinth, then the wall panel — the
              freestanding movable wall from the reference photos. The
              panel follows the partition's own length, height and
              thickness (inspector sliders), not the room's height. */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * (partitionDims!.length / 2 - 0.3), 0.07, 0]} castShadow>
              <boxGeometry args={[0.1, 0.14, 0.45]} />
              <meshStandardMaterial color="#6b675f" roughness={0.7} />
            </mesh>
          ))}
          <mesh position={[0, 0.17, 0]} castShadow>
            <boxGeometry args={[partitionDims!.length + 0.2, 0.1, 0.6]} />
            <meshStandardMaterial color={element.color} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.22 + (partitionDims!.height - 0.35) / 2, 0]} receiveShadow castShadow>
            <boxGeometry args={[partitionDims!.length, partitionDims!.height - 0.35, partitionDims!.thickness]} />
            <meshStandardMaterial color={element.color} roughness={0.85} />
          </mesh>
        </group>
      )}
      {element.type === "chair" && (
        <group>
          <mesh position={[0, 0.45, 0]} castShadow>
            <boxGeometry args={[0.45, 0.06, 0.45]} />
            <meshStandardMaterial color={element.color} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.75, -0.2]} castShadow>
            <boxGeometry args={[0.45, 0.55, 0.05]} />
            <meshStandardMaterial color={element.color} roughness={0.8} />
          </mesh>
          {[[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].map(([lx, lz]) => (
            <mesh key={`${lx}-${lz}`} position={[lx, 0.225, lz]}>
              <boxGeometry args={[0.05, 0.45, 0.05]} />
              <meshStandardMaterial color="#3a3a36" roughness={0.7} />
            </mesh>
          ))}
        </group>
      )}
      {element.type === "bench" && (
        <mesh position={[0, 0.225, 0]} castShadow receiveShadow>
          <boxGeometry args={[2.4, 0.45, 0.7]} />
          <meshStandardMaterial color={element.color} roughness={0.85} />
        </mesh>
      )}
      {element.type === "table" && (
        <group>
          <mesh position={[0, 0.74, 0]} castShadow>
            <boxGeometry args={[1.6, 0.06, 0.9]} />
            <meshStandardMaterial color={element.color} roughness={0.8} />
          </mesh>
          {[[-0.72, -0.37], [0.72, -0.37], [-0.72, 0.37], [0.72, 0.37]].map(([lx, lz]) => (
            <mesh key={`${lx}-${lz}`} position={[lx, 0.37, lz]}>
              <boxGeometry args={[0.07, 0.74, 0.07]} />
              <meshStandardMaterial color="#3a3a36" roughness={0.7} />
            </mesh>
          ))}
        </group>
      )}
      {element.type === "door" && (
        // Flush white door: slim frame, a panel set flush with a thin
        // shadow gap around it, and a slim lever handle — the reference
        // room's door, not a wood door with a ball knob.
        <group>
          {[-0.85, 0.85].map((x) => (
            <mesh key={x} position={[x, 1.25, 0]} castShadow>
              <boxGeometry args={[0.1, 2.5, 0.14]} />
              <meshStandardMaterial color={element.color} roughness={0.8} />
            </mesh>
          ))}
          <mesh position={[0, 2.5, 0]} castShadow>
            <boxGeometry args={[1.8, 0.12, 0.14]} />
            <meshStandardMaterial color={element.color} roughness={0.8} />
          </mesh>
          {/* Shadow gap: a dark reveal behind the panel, so the flush
              panel reads as a separate leaf with a crisp edge. */}
          <mesh position={[0, 1.2, -0.01]}>
            <boxGeometry args={[1.66, 2.46, 0.02]} />
            <meshStandardMaterial color="#2b2b28" roughness={0.9} />
          </mesh>
          <mesh position={[0, 1.2, 0.01]} castShadow>
            <boxGeometry args={[1.6, 2.4, 0.06]} />
            <meshStandardMaterial color={element.color} roughness={0.75} />
          </mesh>
          {/* Slim lever handle: a small rose and a horizontal lever in
              warm polished bronze, at hand height on the right of the
              panel — clearly bronze (warm, metallic, light), never
              near-black. */}
          <mesh position={[0.62, 1.05, 0.055]} rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.028, 0.028, 0.02, 16]} />
            <meshStandardMaterial color="#b08d57" metalness={0.9} roughness={0.28} envMapIntensity={1.2} />
          </mesh>
          <mesh position={[0.55, 1.05, 0.075]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.013, 0.013, 0.14, 12]} />
            <meshStandardMaterial color="#b08d57" metalness={0.9} roughness={0.28} envMapIntensity={1.2} />
          </mesh>
        </group>
      )}
      {element.type === "window" && (
        // White-framed window with muntins and a bright sky behind the
        // glass, so daylight reads through it. The sky plane sits just
        // behind the glass (in front of the wall), so it never leaks
        // into another room.
        <group>
          <mesh position={[0, 0.67, 0]}>
            <boxGeometry args={[1.8, 0.07, 0.1]} />
            <meshStandardMaterial color={element.color} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.67, 0]}>
            <boxGeometry args={[1.8, 0.07, 0.1]} />
            <meshStandardMaterial color={element.color} roughness={0.8} />
          </mesh>
          {[-0.87, 0.87].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <boxGeometry args={[0.07, 1.4, 0.1]} />
              <meshStandardMaterial color={element.color} roughness={0.8} />
            </mesh>
          ))}
          {/* Sky behind the glass: a bright emissive plane, the daylight. */}
          <mesh position={[0, 0, -0.04]}>
            <planeGeometry args={[1.6, 1.2]} />
            <meshStandardMaterial color="#e8f2ff" emissive="#dceaff" emissiveIntensity={1.1} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <planeGeometry args={[1.6, 1.2]} />
            <meshPhysicalMaterial color="#cfe8ef" transparent opacity={0.18} roughness={0.08} side={DoubleSide} />
          </mesh>
          {/* Muntins: one vertical, one horizontal divider across the glass. */}
          <mesh position={[0, 0, 0.01]}>
            <boxGeometry args={[0.05, 1.2, 0.04]} />
            <meshStandardMaterial color={element.color} roughness={0.8} />
          </mesh>
          <mesh position={[0, 0, 0.01]}>
            <boxGeometry args={[1.6, 0.05, 0.04]} />
            <meshStandardMaterial color={element.color} roughness={0.8} />
          </mesh>
          <mesh position={[0, -0.73, 0.04]}>
            <boxGeometry args={[1.9, 0.06, 0.18]} />
            <meshStandardMaterial color={element.color} roughness={0.8} />
          </mesh>
        </group>
      )}
      {element.type === "wall-text" && wt && (
        <group>
          {/* Invisible hit plane sized to the text block: the glyphs alone
              are too thin to click. */}
          <mesh position={[0, 0, -0.01]}>
            <planeGeometry args={[wt.W + 0.2, wt.contentH + 0.3]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {/* Canvas-texture plane (see WallTextPlane): no troika, so adding
              wall text can no longer suspend — and blank — the scene. */}
          <WallTextPlane element={element} widthM={wt.W} />
        </group>
      )}
      {element.type === "plinth" && (
        <mesh position={[0, plinthHeight / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.6, plinthHeight, 0.6]} />
          <meshStandardMaterial color={element.color} roughness={0.85} />
        </mesh>
      )}
      {element.type === "vitrine" && (
        <group>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.7, 0.9, 0.7]} />
            <meshStandardMaterial color={element.color} roughness={0.85} />
          </mesh>
          <mesh position={[0, 1.2, 0]}>
            <boxGeometry args={[0.65, 0.6, 0.65]} />
            <meshPhysicalMaterial color="#cfe3e8" transparent opacity={0.18} roughness={0.08} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 1.51, 0]}>
            <boxGeometry args={[0.68, 0.03, 0.68]} />
            <meshStandardMaterial color="#555550" roughness={0.6} metalness={0.3} />
          </mesh>
          {[-0.31, 0.31].map((x) => [-0.31, 0.31].map((z) => (
            <mesh key={`${x}-${z}`} position={[x, 1.2, z]}>
              <boxGeometry args={[0.03, 0.6, 0.03]} />
              <meshStandardMaterial color="#888880" metalness={0.5} roughness={0.4} />
            </mesh>
          )))}
        </group>
      )}
      {element.type === "track-light" && (
        <group>
          {/* Invisible hit box: the rail alone is too thin to grab. */}
          <mesh position={[0, -0.1, 0]}>
            <boxGeometry args={[element.length, 0.5, 0.6]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[element.length, 0.08, 0.12]} />
            <meshStandardMaterial color="#2b2b28" roughness={0.6} metalness={0.3} />
          </mesh>
          {[-1, 0, 1].map((index) => {
            const hx = (index * element.length) / 3;
            return (
              <group key={index} position={[hx, -0.14, 0.05]} rotation={[0.6, 0, 0]}>
                <mesh>
                  <cylinderGeometry args={[0.07, 0.09, 0.16, 12]} />
                  <meshStandardMaterial color="#3a3a36" roughness={0.5} metalness={0.4} />
                </mesh>
                {/* Lit lens: a warm glowing disc at the head's mouth, so
                    the fixture reads as switched on, not just a dark can. */}
                <mesh position={[0, -0.085, 0]} rotation={[Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.055, 16]} />
                  <meshStandardMaterial color="#fff0d6" emissive="#fff0d6" emissiveIntensity={1.5} side={DoubleSide} />
                </mesh>
              </group>
            );
          })}
          {[-1, 0, 1].map((index) => {
            const hx = (index * element.length) / 3;
            return (
              <group key={`light-${index}`}>
                <primitive object={trackTargets[index + 1]} />
                <spotLight
                  position={[hx, -0.16, 0.05]}
                  target={trackTargets[index + 1]}
                  angle={0.5}
                  penumbra={0.7}
                  intensity={18}
                  distance={12}
                  color={element.color}
                  castShadow={qualityCfg.trackLightShadows}
                  shadow-mapSize-width={512}
                  shadow-mapSize-height={512}
                  shadow-bias={-0.0002}
                  shadow-normalBias={0.02}
                  shadow-camera-near={0.5}
                  shadow-camera-far={12}
                />
              </group>
            );
          })}
        </group>
      )}
      {element.type === "shelf" && (
        <group>
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[element.length, 1.1, 0.4]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
          {[-element.length / 2, element.length / 2].map((x) => (
            <mesh key={x} position={[x, 0, 0]}>
              <boxGeometry args={[0.05, 1.1, 0.3]} />
              <meshStandardMaterial color="#555550" roughness={0.6} metalness={0.3} />
            </mesh>
          ))}
          {[0.35, -0.35].map((y) => (
            <mesh key={y} position={[0, y, 0.06]}>
              <boxGeometry args={[element.length, 0.03, 0.32]} />
              <meshPhysicalMaterial color="#cfe3e8" transparent opacity={0.25} roughness={0.1} side={DoubleSide} />
            </mesh>
          ))}
        </group>
      )}
      {element.type === "desk" && (
        <group>
          <mesh position={[0, 0.74, 0]} castShadow>
            <boxGeometry args={[1.4, 0.05, 0.7]} />
            <meshStandardMaterial color={element.color} roughness={0.8} />
          </mesh>
          {[-0.65, 0.65].map((x) => (
            <mesh key={x} position={[x, 0.37, 0]}>
              <boxGeometry args={[0.05, 0.74, 0.65]} />
              <meshStandardMaterial color="#3a3a36" roughness={0.7} />
            </mesh>
          ))}
          <group position={[0, 0, 0.75]} rotation={[0, Math.PI, 0]}>
            <mesh position={[0, 0.45, 0]}>
              <boxGeometry args={[0.42, 0.05, 0.42]} />
              <meshStandardMaterial color={element.color} roughness={0.8} />
            </mesh>
            <mesh position={[0, 0.72, -0.19]}>
              <boxGeometry args={[0.42, 0.5, 0.05]} />
              <meshStandardMaterial color={element.color} roughness={0.8} />
            </mesh>
            {[[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]].map(([lx, lz]) => (
              <mesh key={`${lx}-${lz}`} position={[lx, 0.225, lz]}>
                <boxGeometry args={[0.04, 0.45, 0.04]} />
                <meshStandardMaterial color="#3a3a36" roughness={0.7} />
              </mesh>
            ))}
          </group>
        </group>
      )}
      {element.type === "curtain" && (
        <group>
          <mesh position={[0, 2.78, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.03, 0.03, element.length, 10]} />
            <meshStandardMaterial color="#555550" metalness={0.5} roughness={0.4} />
          </mesh>
          {[-element.length / 2, element.length / 2].map((x) => (
            <mesh key={x} position={[x, 2.78, 0]}>
              <sphereGeometry args={[0.05, 10, 8]} />
              <meshStandardMaterial color="#555550" metalness={0.5} roughness={0.4} />
            </mesh>
          ))}
          <SheerPanel width={element.length} color={element.color} />
        </group>
      )}
      {element.type === "column" && (
        <group>
          {/* Floor-to-ceiling column: square base, tapered shaft, capital. */}
          <mesh position={[0, 0.06, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.7, 0.12, 0.7]} />
            <meshStandardMaterial color={element.color} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.12 + (height - 0.3) / 2, 0]} castShadow>
            <cylinderGeometry args={[0.26, 0.3, height - 0.3, 24]} />
            <meshStandardMaterial color={element.color} roughness={0.85} />
          </mesh>
          <mesh position={[0, height - 0.09, 0]} castShadow>
            <boxGeometry args={[0.7, 0.18, 0.7]} />
            <meshStandardMaterial color={element.color} roughness={0.85} />
          </mesh>
        </group>
      )}
      {element.type === "platform" && (
        <group>
          {/* Low stage: a 25 cm platform, `length` wide, 2 m deep. */}
          <mesh position={[0, 0.125, 0]} castShadow receiveShadow>
            <boxGeometry args={[element.length, 0.25, 2]} />
            <meshStandardMaterial color={element.color} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.26, 0]}>
            <boxGeometry args={[element.length + 0.06, 0.02, 2.06]} />
            <meshStandardMaterial color="#d8d2c4" roughness={0.85} />
          </mesh>
        </group>
      )}
      {element.type === "stairs" && (
        <group>
          {/* Four steps, 25 cm each: 1 m high, 1.2 m deep, `length` wide,
              rising toward the back of the room. */}
          {[0, 1, 2, 3].map((step) => {
            const stepHeight = 0.25 * (step + 1);
            return (
              <mesh key={step} position={[0, stepHeight / 2, 0.45 - step * 0.3]} castShadow receiveShadow>
                <boxGeometry args={[element.length, stepHeight, 0.3]} />
                <meshStandardMaterial color={element.color} roughness={0.85} />
              </mesh>
            );
          })}
        </group>
      )}
      {element.type === "arch" && (
        <group>
          {/* Doorway arch: two posts and a semicircular top spanning them. */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * (element.length / 2 - 0.15), 1.15, 0]} castShadow>
              <boxGeometry args={[0.3, 2.3, 0.3]} />
              <meshStandardMaterial color={element.color} roughness={0.85} />
            </mesh>
          ))}
          <mesh position={[0, 2.3, 0]} castShadow>
            <torusGeometry args={[element.length / 2 - 0.15, 0.15, 12, 32, Math.PI]} />
            <meshStandardMaterial color={element.color} roughness={0.85} />
          </mesh>
        </group>
      )}
      {element.type === "sofa" && <SofaModel />}
      {selected && (
        <mesh position={[0, outline.y, 0]}>
          <boxGeometry args={outline.size} />
          <meshBasicMaterial color="#bc8056" wireframe />
        </mesh>
      )}
      {interactive && selected && (
        <mesh
          position={outline.handle}
          onPointerDown={(event) => {
            event.stopPropagation();
            onDragStart?.(element.id, "resize", event);
          }}
          onPointerOver={(event) => {
            event.stopPropagation();
            onHoverChange?.({ id: element.id, cursor: "nwse-resize" });
          }}
          onPointerOut={() => {
            onHoverChange?.({ id: element.id, cursor: "grab" });
          }}
        >
          <boxGeometry args={[0.26, 0.26, 0.26]} />
          <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={0.4} />
        </mesh>
      )}
    </group>
  );
}

// --- Sunlight 3D elements ---------------------------------------------
// The reference room's own addable pieces (cloison, suspendu, colonne,
// socles, vitrine, banc, fauteuils, spotlights), ported exactly from
// the file's OB table and mkObj: dimensions, colours and geometries
// are the file's. Separate from the Asset Library (ElementMesh above):
// the two systems coexist. The element's `color` is the main material
// (m, DoubleSide, roughness 0.7); the dark legs, wood legs and vitrine
// glass keep the file's fixed colours. The spotlight is a real
// SpotLight whose target is an Object3D inside the group, so the beam
// follows the group when it is dragged, rotated or reloaded.
const SUNLIGHT_ELEMENT_OUTLINE: Record<SunlightElementType, { size: [number, number, number]; y: number }> = {
  cloison: { size: [3.3, 3.3, 0.45], y: 1.5 },
  suspendu: { size: [3.3, 4.2, 0.4], y: 3.05 },
  colonne: { size: [0.8, 5.3, 0.8], y: 2.5 },
  socle60: { size: [0.8, 0.9, 0.8], y: 0.3 },
  socle90: { size: [0.8, 1.2, 0.8], y: 0.45 },
  socle120: { size: [0.8, 1.5, 0.8], y: 0.6 },
  vitrine: { size: [0.9, 1.9, 0.9], y: 0.8 },
  banc: { size: [2.5, 0.8, 0.8], y: 0.25 },
  club: { size: [1.2, 1.3, 1.15], y: 0.5 },
  bergere: { size: [1.1, 1.75, 1.1], y: 0.7 },
  scandi: { size: [1.0, 1.35, 1.0], y: 0.5 },
  coque: { size: [1.3, 0.95, 1.3], y: 0.33 },
  tub: { size: [1.15, 1.3, 1.15], y: 0.5 },
  spot: { size: [0.5, 0.7, 0.5], y: 4.8 },
};

function SunlightElementMesh({
  element,
  selected,
  onSelect,
  dragged,
  editable,
  onDragStart,
  onHoverChange,
}: {
  element: SunlightElement;
  selected: boolean;
  onSelect?: (id: string, additive?: boolean) => void;
  dragged?: React.RefObject<boolean>;
  editable?: boolean;
  onDragStart?: (id: string, mode: "move", event: ThreeEvent<PointerEvent>) => void;
  onHoverChange?: (hover: { id: string; cursor: string } | null) => void;
}) {
  // Unified mode (the reference file): elements stay interactive while
  // walking — there is no separate walk mode that turns them off.
  const interactive = editable;
  // A cloison or suspendu reads its own dimensions (length / height /
  // thickness, from the inspector sliders); its outline follows them.
  const partitionDims =
    element.type === "cloison" || element.type === "suspendu" ? sunlightPartitionDimsOf(element) : null;
  const outline: { size: [number, number, number]; y: number } = partitionDims
    ? element.type === "cloison"
      ? { size: [partitionDims.length + 0.3, partitionDims.height + 0.3, partitionDims.thickness + 0.3], y: partitionDims.height / 2 }
      : { size: [partitionDims.length + 0.3, SUNLIGHT_HEIGHT - partitionDims.y0 + 0.3, partitionDims.thickness + 0.3], y: (SUNLIGHT_HEIGHT + partitionDims.y0) / 2 }
    : SUNLIGHT_ELEMENT_OUTLINE[element.type];
  // The spotlight's target, inside the group so the beam follows it.
  const spotTarget = useMemo(() => new Object3D(), []);
  useEffect(() => () => {
    spotTarget.removeFromParent();
  }, [spotTarget]);
  const isSpot = element.type === "spot";
  return (
    <group
      position={[element.x, 0, element.z]}
      rotation={[0, element.rotation, 0]}
      onClick={(event) => {
        if (dragged?.current) return;
        // In the editor a single click walks to the point: the click
        // passes through to the floor (no stopPropagation, no
        // selection) — selection is by double-click. In the public
        // view a click still selects where it applies.
        if (interactive) return;
        event.stopPropagation();
        onSelect?.(element.id, event.shiftKey || event.ctrlKey || event.metaKey);
      }}
      onDoubleClick={(event) => {
        // Editor selection is by double-click (or double-tap).
        if (!interactive) return;
        event.stopPropagation();
        if (dragged?.current) return;
        onSelect?.(element.id, event.shiftKey || event.ctrlKey || event.metaKey);
      }}
      onPointerOver={(event) => {
        if (!interactive) return;
        event.stopPropagation();
        onHoverChange?.({ id: element.id, cursor: selected ? "grab" : "default" });
      }}
      onPointerOut={() => {
        if (!interactive) return;
        onHoverChange?.(null);
      }}
      onPointerDown={(event) => {
        // A drag starts only from an already-selected piece (the
        // editor's double-click selection): pressing an unselected
        // piece does nothing, so a click on it walks to the point
        // instead of moving it. Holding Shift/Ctrl/Cmd adds the piece
        // to the selection first, then drags the whole selection
        // together.
        if (!interactive) return;
        event.stopPropagation();
        if (!selected) {
          if (!(event.shiftKey || event.ctrlKey || event.metaKey)) return;
          onSelect?.(element.id, true);
        }
        onDragStart?.(element.id, "move", event);
      }}
    >
      {element.type === "cloison" && (
        <mesh position={[0, partitionDims!.height / 2, 0]} castShadow receiveShadow>
          <boxGeometry args={[partitionDims!.length, partitionDims!.height, partitionDims!.thickness]} />
          <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
        </mesh>
      )}
      {element.type === "suspendu" && (
        <>
          <mesh position={[0, partitionDims!.y0 + partitionDims!.height / 2, 0]} castShadow receiveShadow>
            <boxGeometry args={[partitionDims!.length, partitionDims!.height, partitionDims!.thickness]} />
            <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
          </mesh>
          {[-partitionDims!.length / 2 + 0.3, partitionDims!.length / 2 - 0.3].map((rodX) => (
            <mesh key={rodX} position={[rodX, (SUNLIGHT_HEIGHT + partitionDims!.y0 + partitionDims!.height) / 2, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.02, SUNLIGHT_HEIGHT - partitionDims!.y0 - partitionDims!.height, 0.02]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
            </mesh>
          ))}
        </>
      )}
      {element.type === "colonne" && (
        <mesh position={[0, 2.5, 0]} castShadow receiveShadow>
          <cylinderGeometry args={[0.25, 0.25, 5, 24]} />
          <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
        </mesh>
      )}
      {element.type === "socle60" && (
        <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.6, 0.5]} />
          <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
        </mesh>
      )}
      {element.type === "socle90" && (
        <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 0.9, 0.5]} />
          <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
        </mesh>
      )}
      {element.type === "socle120" && (
        <mesh position={[0, 0.6, 0]} castShadow receiveShadow>
          <boxGeometry args={[0.5, 1.2, 0.5]} />
          <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
        </mesh>
      )}
      {element.type === "vitrine" && (
        <>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.6, 0.9, 0.6]} />
            <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 1.25, 0]} receiveShadow>
            <boxGeometry args={[0.6, 0.7, 0.6]} />
            <meshStandardMaterial color="#cfe6ea" transparent opacity={0.25} roughness={0.05} />
          </mesh>
        </>
      )}
      {element.type === "banc" && (
        <>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.2, 0.12, 0.5]} />
            <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
          </mesh>
          {[-0.9, 0.9].map((legX) => (
            <mesh key={legX} position={[legX, 0.22, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.1, 0.45, 0.4]} />
              <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
            </mesh>
          ))}
        </>
      )}
      {element.type === "club" && (
        <>
          <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.9, 0.35, 0.85]} />
            <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 0.7, -0.33]} castShadow receiveShadow>
            <boxGeometry args={[0.9, 0.55, 0.2]} />
            <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
          </mesh>
          {[-0.43, 0.43].map((armX) => (
            <mesh key={armX} position={[armX, 0.5, 0]} castShadow receiveShadow>
              <boxGeometry args={[0.18, 0.45, 0.85]} />
              <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
            </mesh>
          ))}
        </>
      )}
      {element.type === "bergere" && (
        <>
          <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.8, 0.3, 0.8]} />
            <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 0.9, -0.33]} castShadow receiveShadow>
            <boxGeometry args={[0.8, 1.1, 0.15]} />
            <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
          </mesh>
          {[-0.4, 0.4].map((armX) => (
            <mesh key={armX} position={[armX, 0.8, -0.12]} castShadow receiveShadow>
              <boxGeometry args={[0.15, 0.6, 0.5]} />
              <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
            </mesh>
          ))}
        </>
      )}
      {element.type === "scandi" && (
        <>
          <mesh position={[0, 0.45, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.7, 0.12, 0.7]} />
            <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 0.8, -0.3]} castShadow receiveShadow>
            <boxGeometry args={[0.7, 0.5, 0.1]} />
            <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
          </mesh>
          {[-0.3, 0.3].map((legX) =>
            [-0.3, 0.3].map((legZ) => (
              <mesh key={`${legX},${legZ}`} position={[legX, 0.2, legZ]} castShadow receiveShadow>
                <boxGeometry args={[0.06, 0.4, 0.06]} />
                <meshStandardMaterial color="#c9a06a" roughness={0.6} />
              </mesh>
            )),
          )}
        </>
      )}
      {element.type === "coque" && (
        <>
          <mesh position={[0, 0.65, 0]} castShadow receiveShadow>
            <sphereGeometry args={[0.5, 24, 16, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2]} />
            <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 0.15, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.04, 0.04, 0.3, 12]} />
            <meshStandardMaterial color="#1a1a1a" roughness={0.5} />
          </mesh>
        </>
      )}
      {element.type === "tub" && (
        <>
          <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.4, 0.4, 0.35, 24]} />
            <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 0.72, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.42, 0.42, 0.55, 24, 1, true, Math.PI / 2, Math.PI]} />
            <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
          </mesh>
        </>
      )}
      {isSpot && (
        <>
          <mesh position={[0, 4.9, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.05, 0.06, 0.18, 12]} />
            <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
          </mesh>
          <mesh position={[0, 4.72, 0]} castShadow receiveShadow>
            <cylinderGeometry args={[0.09, 0.06, 0.22, 12]} />
            <meshStandardMaterial color={element.color} roughness={0.7} side={DoubleSide} />
          </mesh>
          {/* Real SpotLight, warm like the sun, its target inside the
              group so the beam moves with the fixture when it is
              dragged, rotated or reloaded. No shadow: the source's
              spotlight casts none. */}
          <primitive object={spotTarget} position={[SUNLIGHT_SPOT.target.x, SUNLIGHT_SPOT.target.y, SUNLIGHT_SPOT.target.z]} />
          <spotLight
            position={[0, SUNLIGHT_SPOT.lightY, 0]}
            target={spotTarget}
            color={SUNLIGHT_SPOT.color}
            intensity={SUNLIGHT_SPOT.intensity}
            distance={SUNLIGHT_SPOT.distance}
            angle={SUNLIGHT_SPOT.angle}
            penumbra={SUNLIGHT_SPOT.penumbra}
            decay={SUNLIGHT_SPOT.decay}
          />
        </>
      )}
      {/* Selection outline: the file's golden BoxHelper colour (#BA7517),
          as a wireframe box like the Asset Library's selection. */}
      {selected && (
        <mesh position={[0, outline.y, 0]}>
          <boxGeometry args={outline.size} />
          <meshBasicMaterial color="#BA7517" wireframe />
        </mesh>
      )}
    </group>
  );
}

type ElementDragState = {
  id: string;
  mode: "move" | "resize";
  plane: Plane;
  grabOffset: Vector3;
  center: Vector3;
  startScale: number;
  startDist: number;
  clamp: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
};

// Mirror of DragHandler for elements: pointer moves become a point on the
// element's plane (floor, wall or ceiling) and are applied as a new
// position, or as a new scale from the resize handle.
function ElementDragHandler({
  dragRef,
  onElementUpdate,
  onDragEnd,
}: {
  dragRef: React.RefObject<ElementDragState | null>;
  onElementUpdate?: (id: string, patch: { x?: number; y?: number; z?: number; scale?: number }) => void;
  onDragEnd: () => void;
}) {
  const { camera, gl } = useThree();
  const updateRef = useRef(onElementUpdate);
  updateRef.current = onElementUpdate;
  const endRef = useRef(onDragEnd);
  endRef.current = onDragEnd;
  useEffect(() => {
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const hit = new Vector3();
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      const update = updateRef.current;
      if (!drag || !update) return;
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (!raycaster.ray.intersectPlane(drag.plane, hit)) return;
      if (drag.mode === "move") {
        const next = hit.clone().sub(drag.grabOffset);
        const c = drag.clamp;
        update(drag.id, {
          x: Math.min(c.maxX, Math.max(c.minX, next.x)),
          y: Math.min(c.maxY, Math.max(c.minY, next.y)),
          z: Math.min(c.maxZ, Math.max(c.minZ, next.z)),
        });
      } else {
        const dist = Math.max(0.05, hit.distanceTo(drag.center));
        const scale = Math.min(3, Math.max(0.25, drag.startScale * (dist / drag.startDist)));
        update(drag.id, { scale: Math.round(scale * 100) / 100 });
      }
    };
    const onUp = () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      endRef.current();
    };
    gl.domElement.addEventListener("pointermove", onMove);
    gl.domElement.addEventListener("pointerup", onUp);
    gl.domElement.addEventListener("pointercancel", onUp);
    return () => {
      gl.domElement.removeEventListener("pointermove", onMove);
      gl.domElement.removeEventListener("pointerup", onUp);
      gl.domElement.removeEventListener("pointercancel", onUp);
    };
  }, [camera, gl, dragRef]);
  return null;
}
// Contact shadow + LED strip along a wall or panel base (the source's
// aoWall). A soft gradient plane on the floor plus a thin white LED
// strip at the base, in the local frame of the wall or panel group.
function SunlightAoWall({
  len,
  z,
  dir,
  aoLin,
}: {
  len: number;
  z: number;
  dir: 1 | -1;
  aoLin: CanvasTexture | null;
}) {
  return (
    <group>
      <mesh position={[0, 0.004, z + dir * 0.55]} rotation={[-Math.PI / 2, 0, dir < 0 ? Math.PI : 0]}>
        <planeGeometry args={[len, 1.1]} />
        <meshBasicMaterial
          map={aoLin ?? undefined}
          transparent
          depthWrite={false}
          polygonOffset
          polygonOffsetFactor={-2}
        />
      </mesh>
      <mesh position={[0, 0.04, z + dir * 0.02]}>
        <boxGeometry args={[len - 0.2, 0.02, 0.03]} />
        <meshBasicMaterial color="#ffffff" />
      </mesh>
    </group>
  );
}

// The Sunlight Gallery room — the whole "Galerie lumière" scene, exact:
// 22 × 26 m, 5 m high, procedural concrete floor, off-white walls, the
// ceiling slab with its seven skylight openings (4 diffusers with a warm
// point light each, 3 open sky panels hidden by default), the cloud sky
// above, contact shadows and LED strips, three freestanding panels, two
// pedestals with sculptures, the double door on the left wall and the
// dark band on the right wall. Materials and finishes are fixed by the
// design; the editor's finish fields do not alter them. The artworks
// hang on the panels (and keep the SANAA frame system); the placeable
// 3D elements stay functional.
function SunlightRoom({
  room,
  offsetX,
  offsetZ,
  artworks,
  selectedId,
  onSelect,
  walkable,
  onFloorClick,
  dragged,
  editable,
  onDragStart,
  onHoverChange,
  selectedElementId,
  onSelectElement,
  onElementDragStart,
  onElementHover,
  selectedSunlightElementId,
  onSelectSunlightElement,
  onSunlightElementDragStart,
  onSunlightElementHover,
  showGrid,
  showMeasure,
  quality,
  hideCeiling,
}: {
  room: GalleryRoom;
  offsetX: number;
  offsetZ: number;
  artworks: Artwork[];
  selectedId?: string | null;
  onSelect?: (id: string, additive?: boolean) => void;
  walkable: boolean;
  onFloorClick?: (point: Vector3) => void;
  dragged?: React.RefObject<boolean>;
  editable?: boolean;
  onDragStart?: (id: string, mode: "move" | "resize", event: ThreeEvent<PointerEvent>) => void;
  onHoverChange?: (hover: { id: string; cursor: string } | null) => void;
  selectedElementId?: string | null;
  onSelectElement?: (id: string, additive?: boolean) => void;
  onElementDragStart?: (id: string, mode: "move" | "resize", event: ThreeEvent<PointerEvent>) => void;
  onElementHover?: (hover: { id: string; cursor: string } | null) => void;
  // Sunlight 3D elements (the reference room's own pieces): same
  // selection/drag/hover wiring as the Asset Library above.
  selectedSunlightElementId?: string | null;
  onSelectSunlightElement?: (id: string, additive?: boolean) => void;
  onSunlightElementDragStart?: (id: string, mode: "move", event: ThreeEvent<PointerEvent>) => void;
  onSunlightElementHover?: (hover: { id: string; cursor: string } | null) => void;
  showGrid?: boolean;
  showMeasure?: boolean;
  quality: RenderQuality;
  // Transient ceiling hide (the High / Plan camera views): the ceiling
  // assembly is hidden so the room reads from above. The persistent
  // room.ceilingHidden (the "Hide ceiling" checkbox) does the same.
  hideCeiling?: boolean;
}) {
  const textures = useMemo(() => getSunlightTextures(), []);
  // Floor pattern (Claude's fpat): a procedural parquet, herringbone
  // or checkerboard instead of the room's concrete, with the floor
  // shine (roughness = 1 − shine / 100) from the editor.
  const floorPattern = useMemo(
    () => floorPatternTexture(room.floorPattern ?? "original"),
    [room.floorPattern],
  );
  const floorShine = room.floorShine ?? FLOOR_SHINE_DEFAULT;
  const ceilingHidden = (room.ceilingHidden ?? false) || hideCeiling;
  // Ceiling slab: an extruded 28 × 30 rectangle with the seven skylight
  // openings cut out (the source's shape + ExtrudeGeometry).
  const slabGeometry = useMemo(() => {
    const shape = new Shape();
    shape.moveTo(-14, -16);
    shape.lineTo(14, -16);
    shape.lineTo(14, 14);
    shape.lineTo(-14, 14);
    shape.lineTo(-14, -16);
    for (const [cx, cz, w, d] of SUNLIGHT_HOLES) {
      const p = new Path();
      const y0 = -cz - d / 2;
      const y1 = -cz + d / 2;
      p.moveTo(cx - w / 2, y0);
      p.lineTo(cx + w / 2, y0);
      p.lineTo(cx + w / 2, y1);
      p.lineTo(cx - w / 2, y1);
      p.lineTo(cx - w / 2, y0);
      shape.holes.push(p);
    }
    return new ExtrudeGeometry(shape, { depth: 0.6, bevelEnabled: false });
  }, []);
  useEffect(() => () => slabGeometry.dispose(), [slabGeometry]);
  // Sculpture geometries, jittered like the source's handmade clay.
  const jit = (geo: BufferGeometry, amount: number) => {
    const p = geo.attributes.position as BufferAttribute;
    for (let i = 0; i < p.count; i++) {
      p.setXYZ(
        i,
        p.getX(i) + sunlightRandom(-amount, amount),
        p.getY(i) + sunlightRandom(-amount, amount),
        p.getZ(i) + sunlightRandom(-amount, amount),
      );
    }
    geo.computeVertexNormals();
    return geo;
  };
  const bodyGeometry = useMemo(() => jit(new CylinderGeometry(0.2, 0.28, 0.9, 12, 8), 0.015), []);
  const headGeometry = useMemo(() => jit(new SphereGeometry(0.2, 14, 10), 0.012), []);
  const bustGeometry = useMemo(() => new SphereGeometry(0.14, 14, 10), []);
  useEffect(
    () => () => {
      bodyGeometry.dispose();
      headGeometry.dispose();
      bustGeometry.dispose();
    },
    [bodyGeometry, headGeometry, bustGeometry],
  );

  // Clicking the floor or a wall starts the walk to that point (in walk
  // mode). Wall clicks are pushed 1.6 m out from the wall so the camera
  // does not stop against it.
  const handleWalkClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (!walkable || dragged?.current) return;
      event.stopPropagation();
      const face = event.face;
      const point = event.point.clone();
      if (face) {
        const n = face.normal.clone().transformDirection(event.object.matrixWorld);
        if (Math.abs(n.y) < 0.5) point.addScaledVector(n, 1.6);
      }
      point.x = Math.max(
        offsetX + SUNLIGHT_BOUNDS.minX,
        Math.min(offsetX + SUNLIGHT_BOUNDS.maxX, point.x),
      );
      point.z = Math.max(
        offsetZ + SUNLIGHT_BOUNDS.minZ,
        Math.min(offsetZ + SUNLIGHT_BOUNDS.maxZ, point.z),
      );
      onFloorClick?.(point);
    },
    [walkable, dragged, offsetX, offsetZ, onFloorClick],
  );

  return (
    <group position={[offsetX, 0, offsetZ]}>
      {/* Concrete floor (or the editor's floor pattern, with its shine) */}
      <mesh position={[0, 0, SUNLIGHT_FLOOR_CENTER_Z]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow onClick={handleWalkClick}>
        <planeGeometry args={[SUNLIGHT_WIDTH, SUNLIGHT_DEPTH]} />
        <meshStandardMaterial
          map={floorPattern ?? textures.floor ?? undefined}
          color={floorPattern || textures.floor ? "#ffffff" : SUNLIGHT_FLOOR_COLOR}
          roughness={1 - floorShine / 100}
          metalness={0.05}
          envMapIntensity={0.9}
        />
      </mesh>
      {/* Walls: back, front, left, right (inner faces at z -14/12, x -11/11) */}
      <mesh position={[0, 2.5, -14.15]} receiveShadow onClick={handleWalkClick}>
        <boxGeometry args={[22, 5, 0.3]} />
        <meshStandardMaterial color={SUNLIGHT_WALL_COLOR} roughness={0.92} />
      </mesh>
      <mesh position={[0, 2.5, 12.15]} receiveShadow onClick={handleWalkClick}>
        <boxGeometry args={[22, 5, 0.3]} />
        <meshStandardMaterial color={SUNLIGHT_WALL_COLOR} roughness={0.92} />
      </mesh>
      <mesh position={[-11.15, 2.5, -1]} receiveShadow onClick={handleWalkClick}>
        <boxGeometry args={[0.3, 5, 26]} />
        <meshStandardMaterial color={SUNLIGHT_WALL_COLOR} roughness={0.92} />
      </mesh>
      <mesh position={[11.15, 2.5, -1]} receiveShadow onClick={handleWalkClick}>
        <boxGeometry args={[0.3, 5, 26]} />
        <meshStandardMaterial color={SUNLIGHT_WALL_COLOR} roughness={0.92} />
      </mesh>
      {/* Ceiling slab with the seven skylight openings — colour and
          roughness from the editor's ceiling finish; hidden when the
          ceiling is hidden (checkbox or a top-down camera view). */}
      <mesh geometry={slabGeometry} position={[0, SUNLIGHT_HEIGHT, 0]} rotation={[-Math.PI / 2, 0, 0]} castShadow receiveShadow visible={!ceilingHidden}>
        <meshStandardMaterial color={room.ceilingColor ?? SUNLIGHT_CEILING_COLOR} roughness={room.ceilingRoughness ?? 0.95} />
      </mesh>
      {/* Cloud sky, 30 m above the ceiling */}
      <mesh position={[0, SUNLIGHT_HEIGHT + 30, -2]} rotation={[Math.PI / 2, 0, 0]}>
        <planeGeometry args={[240, 240]} />
        <meshBasicMaterial
          map={textures.cloud ?? undefined}
          color={textures.cloud ? "#ffffff" : "#bcd8f3"}
          side={DoubleSide}
        />
      </mesh>
      {/* Skylight panels: diffusers (white + warm point light) and open
          sky panels (hidden by default); black trims around each opening. */}
      {SUNLIGHT_HOLES.map(([cx, cz, w, d, kind]) => (
        <group key={`${cx},${cz}`} visible={!ceilingHidden}>
          <mesh
            position={[cx, SUNLIGHT_HEIGHT + (kind === "s" ? 0.3 : 0.05), cz]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow={kind === "d"}
            visible={kind !== "s"}
          >
            <planeGeometry args={[w, d]} />
            {kind === "s" ? (
              <meshBasicMaterial
                map={textures.sky ?? undefined}
                color={textures.sky ? "#ffffff" : "#a9cbee"}
                side={DoubleSide}
              />
            ) : (
              <meshBasicMaterial color="#ffffff" side={DoubleSide} />
            )}
          </mesh>
          {kind === "d" && (
            <pointLight position={[cx, SUNLIGHT_HEIGHT - 0.4, cz]} intensity={0.9} distance={14} decay={1.6} color="#fff6ea" />
          )}
          <mesh position={[cx, SUNLIGHT_HEIGHT - 0.01, cz + d / 2]}>
            <boxGeometry args={[w + 0.1, 0.03, 0.05]} />
            <meshStandardMaterial color="#111111" roughness={0.5} />
          </mesh>
          <mesh position={[cx, SUNLIGHT_HEIGHT - 0.01, cz - d / 2]}>
            <boxGeometry args={[w + 0.1, 0.03, 0.05]} />
            <meshStandardMaterial color="#111111" roughness={0.5} />
          </mesh>
          <mesh position={[cx + w / 2, SUNLIGHT_HEIGHT - 0.01, cz]}>
            <boxGeometry args={[0.05, 0.03, d + 0.1]} />
            <meshStandardMaterial color="#111111" roughness={0.5} />
          </mesh>
          <mesh position={[cx - w / 2, SUNLIGHT_HEIGHT - 0.01, cz]}>
            <boxGeometry args={[0.05, 0.03, d + 0.1]} />
            <meshStandardMaterial color="#111111" roughness={0.5} />
          </mesh>
        </group>
      ))}
      {/* Contact shadows + LED strips along the right, back and left
          walls (not the front wall). */}
      <group position={[11, 0, -1]} rotation={[0, -Math.PI / 2, 0]}>
        <SunlightAoWall len={26} z={0} dir={1} aoLin={textures.aoLin} />
      </group>
      <group position={[0, 0, -14]} rotation={[0, 0, 0]}>
        <SunlightAoWall len={22} z={0} dir={1} aoLin={textures.aoLin} />
      </group>
      <group position={[-11, 0, -1]} rotation={[0, Math.PI / 2, 0]}>
        <SunlightAoWall len={26} z={0} dir={1} aoLin={textures.aoLin} />
      </group>
      {/* Three freestanding panels, with contact shadows and LEDs on
          both sides. Artworks hang on them. */}
      {SUNLIGHT_PANELS.map((panel) => (
        <group key={`${panel.x},${panel.z}`} position={[panel.x, 0, panel.z]} rotation={[0, panel.ry, 0]}>
          <mesh position={[0, 2.2, 0]} castShadow receiveShadow onClick={handleWalkClick}>
            <boxGeometry args={[panel.len, 4.4, 0.3]} />
            <meshStandardMaterial color={SUNLIGHT_WALL_COLOR} roughness={0.92} />
          </mesh>
          <SunlightAoWall len={panel.len} z={0.15} dir={1} aoLin={textures.aoLin} />
          <SunlightAoWall len={panel.len} z={-0.15} dir={-1} aoLin={textures.aoLin} />
        </group>
      ))}
      {/* Two pedestals with their radial contact shadows */}
      {SUNLIGHT_PEDESTALS.map((pedestal) => (
        <group key={`${pedestal.x},${pedestal.z}`}>
          <mesh position={[pedestal.x, pedestal.h / 2, pedestal.z]} castShadow receiveShadow>
            <boxGeometry args={[pedestal.w, pedestal.h, pedestal.w]} />
            <meshStandardMaterial color="#f8f8f6" roughness={0.85} />
          </mesh>
          <mesh position={[pedestal.x, 0.005, pedestal.z]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[pedestal.w * 2.6, pedestal.w * 2.6]} />
            <meshBasicMaterial
              map={textures.aoRad ?? undefined}
              transparent
              depthWrite={false}
              polygonOffset
              polygonOffsetFactor={-2}
            />
          </mesh>
        </group>
      ))}
      {/* Sculptures: a terracotta figure (cylinder + sphere head) on the
          first pedestal, a dark bust on the second. */}
      <mesh position={[-3, 1.6, 3]} geometry={bodyGeometry} castShadow>
        <meshStandardMaterial color="#b4673c" roughness={0.75} />
      </mesh>
      <mesh position={[-3, 2.2, 3]} geometry={headGeometry} castShadow>
        <meshStandardMaterial color="#b4673c" roughness={0.75} />
      </mesh>
      <mesh position={[-8, 1.05, 0.5]} geometry={bustGeometry} castShadow>
        <meshStandardMaterial color="#2a2622" roughness={0.5} />
      </mesh>
      {/* Double door on the left wall (the exit into the mini-plan's
          room switch). The two leaves sit exactly where the source
          puts them (x -10.95, z -11 ± 0.55, y 1.2, 1 × 2.4 × 0.08,
          #a5a8ac), but the source's metalness 0.4 washed the grey
          toward white under this port's IBL and sun, and the door —
          tucked at the back-left behind panels P1/P2 — was missed in
          the live check. So the leaves are matte painted metal
          (metalness 0.05) so the grey reads, and the door gets the
          legibility a real double door has: a slim dark architrave
          around the opening and a round knob on each leaf, both in
          the room's existing dark tone (#2a2622, the bust's colour).
          The door itself stays at the source's place, size and
          colour; only its readability is fixed. */}
      {[-0.55, 0.55].map((dx) => (
        <mesh key={dx} position={[-10.95, 1.2, -11 + dx]} rotation={[0, Math.PI / 2, 0]} receiveShadow>
          <boxGeometry args={[1, 2.4, 0.08]} />
          <meshStandardMaterial color="#a5a8ac" roughness={0.55} metalness={0.05} />
        </mesh>
      ))}
      {/* Architrave around the door opening (two side trims + top trim),
          set just proud of the leaves' front face. */}
      <mesh position={[-10.9, 1.23, -12.08]} receiveShadow>
        <boxGeometry args={[0.04, 2.46, 0.07]} />
        <meshStandardMaterial color="#2a2622" roughness={0.6} />
      </mesh>
      <mesh position={[-10.9, 1.23, -9.92]} receiveShadow>
        <boxGeometry args={[0.04, 2.46, 0.07]} />
        <meshStandardMaterial color="#2a2622" roughness={0.6} />
      </mesh>
      <mesh position={[-10.9, 2.43, -11]} receiveShadow>
        <boxGeometry args={[0.04, 0.07, 2.23]} />
        <meshStandardMaterial color="#2a2622" roughness={0.6} />
      </mesh>
      {/* A round knob on each leaf, by the centre gap, at handle height. */}
      <mesh position={[-10.88, 1.05, -11.15]}>
        <sphereGeometry args={[0.03, 16, 12]} />
        <meshStandardMaterial color="#2a2622" roughness={0.4} metalness={0.3} />
      </mesh>
      <mesh position={[-10.88, 1.05, -10.85]}>
        <sphereGeometry args={[0.03, 16, 12]} />
        <meshStandardMaterial color="#2a2622" roughness={0.4} metalness={0.3} />
      </mesh>
      {/* Dark band on the right wall: a narrow decorative element. */}
      <group position={[10.84, 1.8, -3]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh castShadow>
          <boxGeometry args={[0.35, 2.4, 0.05]} />
          <meshStandardMaterial color="#eeeeee" roughness={0.8} />
        </mesh>
        <mesh position={[0, 0, 0.026]}>
          <planeGeometry args={[0.35, 2.4]} />
          <meshStandardMaterial
            map={textures.dark ?? undefined}
            color={textures.dark ? "#ffffff" : "#3a3a3a"}
            roughness={0.7}
          />
        </mesh>
      </group>
      {/* Artworks — the SANAA frame system, unchanged. A click selects
          the artwork (editor inspector, or public detail sheet); the
          walk up to a piece is via the mini-plan stand point. */}
      {artworks.map((artwork) => (
        <ArtworkFrame
          key={artwork.id}
          artwork={artwork}
          selected={selectedId === artwork.id}
          onSelect={onSelect}
          dragged={dragged}
          editable={editable}
          onDragStart={onDragStart}
          onHoverChange={onHoverChange}
        />
      ))}
      {/* Placeable 3D elements — the Asset Library, unchanged. */}
      {room.elements?.map((element) => (
        <ElementMesh
          key={element.id}
          element={element}
          room={room}
          onSelect={onSelectElement}
          selected={selectedElementId === element.id}
          editable={editable}
          onDragStart={onElementDragStart}
          onHoverChange={onElementHover}
          quality={quality}
        />
      ))}
      {/* Sunlight 3D elements — the reference room's own pieces
          (cloison, suspendu, colonne, socles, vitrine, banc, fauteuils,
          spotlights). Saved with the room, restored on load; the
          spotlight's SpotLight is rebuilt here, so it lights again. */}
      {room.sunlightElements?.map((element) => (
        <SunlightElementMesh
          key={element.id}
          element={element}
          onSelect={onSelectSunlightElement}
          selected={selectedSunlightElementId === element.id}
          editable={editable}
          onDragStart={onSunlightElementDragStart}
          onHoverChange={onSunlightElementHover}
        />
      ))}
      {/* Measurement guides and the editor grid, as before. The grid
          is centred on the room (floor centre z = -1); the guides get
          the room's z centre so wall distances stay exact. */}
      {showMeasure && (
        <MeasurementGuides artworks={artworks} selectedId={selectedId ?? undefined} width={SUNLIGHT_WIDTH} depth={SUNLIGHT_DEPTH} zCenter={SUNLIGHT_FLOOR_CENTER_Z} />
      )}
      {showGrid && (
        <group position={[0, 0, SUNLIGHT_FLOOR_CENTER_Z]}>
          <FloorGrid width={SUNLIGHT_WIDTH} depth={SUNLIGHT_DEPTH} />
        </group>
      )}
      {/* Curatorial text on the back wall, when set (0.14 m in front
          of the wall face, like the old rooms). */}
      {room.curatorialText && (
        <group position={[0, SUNLIGHT_HEIGHT - 0.65, -13.86]}>
          <CuratorialTextPlane text={room.curatorialText} maxWidthM={9} wallColor={SUNLIGHT_WALL_COLOR} />
        </group>
      )}
    </group>
  );
}
// GenericRoom — one of the nine galleries added in November 2026
// (La Serpentine, La Vitrine, Le Loft Béton, La Halle Design,
// L'Arche, Le Musée Bleu, La Claire-Voie, Le Parquet, La Verrière).
// The shell is the imperative three.js group built in
// components/gallery-rooms.tsx from Kabeya's reference file; the
// SANAA systems around it (artworks, Asset Library elements, grid,
// measure, curatorial text, walk clicks) are the same as Sunlight's.
// The shell brings its own lights — no Sunlight rig here, so a dark
// loft stays dark and a stone gallery stays warm. Sunlight 3D
// elements are not rendered here: they belong to the Sunlight room.
function GenericRoom({
  room,
  offsetX,
  offsetZ,
  artworks,
  selectedId,
  onSelect,
  walkable,
  onFloorClick,
  dragged,
  editable,
  onDragStart,
  onHoverChange,
  selectedElementId,
  onSelectElement,
  onElementDragStart,
  onElementHover,
  showGrid,
  showMeasure,
  quality,
}: {
  room: GalleryRoom;
  offsetX: number;
  offsetZ: number;
  artworks: Artwork[];
  selectedId?: string | null;
  onSelect?: (id: string, additive?: boolean) => void;
  walkable: boolean;
  onFloorClick?: (point: Vector3) => void;
  dragged?: React.RefObject<boolean>;
  editable?: boolean;
  onDragStart?: (id: string, mode: "move" | "resize", event: ThreeEvent<PointerEvent>) => void;
  onHoverChange?: (hover: { id: string; cursor: string } | null) => void;
  selectedElementId?: string | null;
  onSelectElement?: (id: string, additive?: boolean) => void;
  onElementDragStart?: (id: string, mode: "move" | "resize", event: ThreeEvent<PointerEvent>) => void;
  onElementHover?: (hover: { id: string; cursor: string } | null) => void;
  // Sunlight 3D elements: declared for call-site parity with
  // SunlightRoom (GalleryScene passes the same props to both), but
  // never rendered here — they belong to the Sunlight room.
  selectedSunlightElementId?: string | null;
  onSelectSunlightElement?: (id: string, additive?: boolean) => void;
  onSunlightElementDragStart?: (id: string, mode: "move", event: ThreeEvent<PointerEvent>) => void;
  onSunlightElementHover?: (hover: { id: string; cursor: string } | null) => void;
  showGrid?: boolean;
  showMeasure?: boolean;
  quality: RenderQuality;
  // Transient ceiling hide (the High / Plan camera views): declared
  // for call-site parity with SunlightRoom, but ignored here — a
  // generic shell is a closed box whose ceiling is part of its fixed
  // geometry, so the view height is clamped under it instead.
  hideCeiling?: boolean;
}) {
  const layout = roomLayouts[room.layout];
  const def = galleryDef(room.layout);
  const floorCenterZ = roomFloorCenterZ(room.layout);
  const shell = useMemo(() => buildGalleryShell(room.layout), [room.layout]);
  useEffect(() => () => disposeGroup(shell.group), [shell]);
  const qualityCfg = RENDER_QUALITY_CONFIG[quality ?? "high"];
  // Fallback shadow sun for shells lit by hemisphere + points only
  // (Vitrine, Loft, Musée, Parquet, Classique, Atrium blanc,
  // Escalier, the three day halls): without it nothing in those rooms
  // casts a shadow. High only — the quality ladder gates directional
  // shadows there, so Medium/Low keep today's flat light. It hangs
  // just under the ceiling, inside the room, so no roof or wall
  // blocks it; a shell with its own sun skips it (shell.hasShadowSun).
  const fallbackShadowExtent = Math.max(layout.width, layout.depth) / 2 + 3;
  const fallbackSunRef = useRef<DirectionalLight>(null!);
  const fallbackSunTarget = useMemo(() => new Object3D(), []);
  useEffect(() => {
    const sun = fallbackSunRef.current;
    if (!sun) return;
    // R3F's shadow-camera-* props are plain assignments: three.js
    // only applies the frustum through updateProjectionMatrix,
    // otherwise the shadow stays clipped to the default ±5 m box.
    sun.shadow.camera.updateProjectionMatrix();
  }, [fallbackShadowExtent]);
  // La Halle's hanging mobile rotates; every other shell is static.
  useFrame((_, dt) => {
    shell.tick?.(dt);
  });
  const bounds = def?.bounds ?? {
    minX: -layout.width / 2,
    maxX: layout.width / 2,
    minZ: floorCenterZ - layout.depth / 2,
    maxZ: floorCenterZ + layout.depth / 2,
  };

  // Clicking the floor starts the walk to that point (in walk mode),
  // clamped to the room's own bounds.
  const handleWalkClick = useCallback(
    (event: ThreeEvent<MouseEvent>) => {
      if (!walkable || dragged?.current) return;
      event.stopPropagation();
      const point = event.point.clone();
      point.x = Math.max(offsetX + bounds.minX, Math.min(offsetX + bounds.maxX, point.x));
      point.z = Math.max(offsetZ + bounds.minZ, Math.min(offsetZ + bounds.maxZ, point.z));
      onFloorClick?.(point);
    },
    [walkable, dragged, offsetX, offsetZ, bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ, onFloorClick],
  );

  return (
    <group position={[offsetX, 0, offsetZ]}>
      <primitive object={shell.group} />
      {/* Fallback shadow sun (see above): one modest directional with
          a real shadow map, for shells that bring no shadow light. */}
      {!shell.hasShadowSun && qualityCfg.directionalShadows && (
        <>
          <primitive object={fallbackSunTarget} position={[0, 0, floorCenterZ - layout.depth * 0.2]} />
          <directionalLight
            ref={fallbackSunRef}
            position={[layout.width * 0.25, layout.height - 0.6, floorCenterZ + layout.depth * 0.2]}
            target={fallbackSunTarget}
            intensity={0.7}
            color="#fff0d8"
            castShadow
            shadow-mapSize-width={qualityCfg.directionalShadowMapSize}
            shadow-mapSize-height={qualityCfg.directionalShadowMapSize}
            shadow-radius={4}
            shadow-bias={-0.0002}
            shadow-camera-left={-fallbackShadowExtent}
            shadow-camera-right={fallbackShadowExtent}
            shadow-camera-top={fallbackShadowExtent}
            shadow-camera-bottom={-fallbackShadowExtent}
            shadow-camera-near={0.5}
            shadow-camera-far={layout.height + layout.depth}
          />
        </>
      )}
      {/* Invisible walk-target floor: the shell's own meshes carry no
          click handlers, so this plane catches floor clicks in walk
          mode. Artwork and element clicks stop propagation first, so
          they still select / walk up to the piece. */}
      <mesh position={[0, 0.02, floorCenterZ]} rotation={[-Math.PI / 2, 0, 0]} onClick={handleWalkClick}>
        <planeGeometry args={[layout.width, layout.depth]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {/* Artworks — the SANAA frame system, unchanged. */}
      {artworks.map((artwork) => (
        <ArtworkFrame
          key={artwork.id}
          artwork={artwork}
          selected={selectedId === artwork.id}
          onSelect={onSelect}
          dragged={dragged}
          editable={editable}
          onDragStart={onDragStart}
          onHoverChange={onHoverChange}
        />
      ))}
      {/* Placeable 3D elements — the Asset Library, unchanged. */}
      {room.elements?.map((element) => (
        <ElementMesh
          key={element.id}
          element={element}
          room={room}
          onSelect={onSelectElement}
          selected={selectedElementId === element.id}
          editable={editable}
          onDragStart={onElementDragStart}
          onHoverChange={onElementHover}
          quality={quality}
        />
      ))}
      {/* Measurement guides and the editor grid, centred on the room's
          floor centre (not on z = 0). */}
      {showMeasure && (
        <MeasurementGuides artworks={artworks} selectedId={selectedId ?? undefined} width={layout.width} depth={layout.depth} zCenter={floorCenterZ} />
      )}
      {showGrid && (
        <group position={[0, 0, floorCenterZ]}>
          <FloorGrid width={layout.width} depth={layout.depth} />
        </group>
      )}
      {/* Curatorial text on the back wall, when set — at the height
          and z the room's def gives (0.14 m in front of the wall). */}
      {room.curatorialText && def?.curatorialText && (
        <group position={[0, def.curatorialText.y, def.curatorialText.z]}>
          <CuratorialTextPlane text={room.curatorialText} maxWidthM={9} wallColor={layout.wallColor} />
        </group>
      )}
    </group>
  );
}
// Start position of a Sunlight room (world coordinates): the source's
// camera start, offset by the room's world offset.
function sunlightEntrance(offsets: number[], zOffsets: number[] | undefined, index: number): { x: number; z: number } {
  return {
    x: offsets[index] + SUNLIGHT_CAMERA_START.x,
    z: (zOffsets?.[index] ?? 0) + SUNLIGHT_CAMERA_START.z,
  };
}

// First-person walk — the source's navigation, exact: drag to look
// (yaw/pitch), WASD/arrows or on-screen buttons to move (3 m/s), click
// the floor or a wall to walk to the target (marker ring), click an
// artwork to open its sheet. Camera start (3.5, 1.6, 10.5), yaw .3,
// pitch -.04. Collisions via the Sunlight blocks (panels + pedestals)
// with the rotated-rectangle hit test; the camera is bounded inside
// the room. Rooms are switched by teleport (mini-plan / room list),
// never by walking through a wall — the Sunlight walls are solid.
function SunlightWalkControls({
  rooms,
  activeRoomId,
  offsets,
  zOffsets,
  input,
  destination,
  lookYaw,
  dragged,
  dragActive,
  enabled,
  onRoomChange,
  resetSignal,
  viewRequest,
}: {
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
  const { camera, gl } = useThree();
  const yawRef = useRef(SUNLIGHT_CAMERA_START.yaw);
  const pitchRef = useRef(SUNLIGHT_CAMERA_START.pitch);
  // Smoothed camera height (Claude's camY): a view preset sets the
  // target and every frame eases toward it, instead of jumping.
  const camYRef = useRef(SUNLIGHT_CAMERA_START.y);
  const lastViewNonce = useRef<number | null>(null);
  const currentRoomIndex = useRef(Math.max(0, rooms.findIndex((room) => room.id === activeRoomId)));
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

  // First mount: place the camera at the start. A room change (teleport
  // from the mini-plan or the room list) re-places it at the new room's
  // start. Rooms are never entered by walking through a wall.
  useEffect(() => {
    if (!initialized.current) {
      const startIndex = Math.max(0, rooms.findIndex((room) => room.id === activeRoomId));
      const start = sunlightEntrance(offsets, zOffsets, startIndex);
      camera.position.set(start.x, SUNLIGHT_CAMERA_START.y, start.z);
      camYRef.current = SUNLIGHT_CAMERA_START.y;
      camera.rotation.order = "YXZ";
      yawRef.current = SUNLIGHT_CAMERA_START.yaw;
      pitchRef.current = SUNLIGHT_CAMERA_START.pitch;
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
    const start = sunlightEntrance(offsets, zOffsets, requestedIndex);
    camera.position.set(start.x, SUNLIGHT_CAMERA_START.y, start.z);
    camYRef.current = SUNLIGHT_CAMERA_START.y;
    yawRef.current = SUNLIGHT_CAMERA_START.yaw;
    pitchRef.current = SUNLIGHT_CAMERA_START.pitch;
    camera.rotation.set(pitchRef.current, yawRef.current, 0, "YXZ");
    destination.current = null;
    lookYaw.current = null;
    currentRoomIndex.current = requestedIndex;
    handledRoomId.current = activeRoomId;
  }, [activeRoomId, camera, destination, lookYaw, offsets, rooms, zOffsets]);

  // Camera view preset (the editor's View buttons): apply the preset's
  // pitch and, when it carries one, position and yaw; the height is
  // eased toward in useFrame (camY). Eye keeps the current position
  // and yaw and only levels the pitch and lowers the eye back to
  // 1.6 m. The position is clamped to the room's walk bounds, so a
  // preset can never park the camera inside a wall.
  useEffect(() => {
    if (!viewRequest || viewRequest.nonce === lastViewNonce.current) return;
    lastViewNonce.current = viewRequest.nonce;
    const preset = VIEW_PRESETS[viewRequest.view];
    const roomIndex = currentRoomIndex.current;
    const ox = offsets[roomIndex] ?? 0;
    const oz = zOffsetOf(roomIndex);
    pitchRef.current = preset.pitch;
    if (preset.yaw !== undefined) yawRef.current = preset.yaw;
    if (preset.x !== undefined) {
      camera.position.x = ox + Math.max(SUNLIGHT_BOUNDS.minX, Math.min(SUNLIGHT_BOUNDS.maxX, preset.x));
    }
    if (preset.z !== undefined) {
      camera.position.z = oz + Math.max(SUNLIGHT_BOUNDS.minZ, Math.min(SUNLIGHT_BOUNDS.maxZ, preset.z));
    }
    camYRef.current = preset.y;
    destination.current = null;
    lookYaw.current = null;
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
      const start = sunlightEntrance(offsets, zOffsets, 0);
      camera.position.set(start.x, SUNLIGHT_CAMERA_START.y, start.z);
      camYRef.current = SUNLIGHT_CAMERA_START.y;
      yawRef.current = SUNLIGHT_CAMERA_START.yaw;
      pitchRef.current = SUNLIGHT_CAMERA_START.pitch;
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
    const ox = offsets[roomIndex];
    const oz = zOffsetOf(roomIndex);
    const localX = camera.position.x - ox;
    const localZ = camera.position.z - oz;
    // Collision: the room's fixed blocks (panels + pedestals) plus the
    // blocks of the Sunlight elements in this room (cloison, colonne,
    // socle, vitrine, banc, fauteuils…), rebuilt every frame so a moved
    // element's block follows it. The spotlight contributes no block.
    const blocks = [...SUNLIGHT_BLOCKS, ...sunlightElementCollisionBlocks(rooms[roomIndex]?.sunlightElements ?? [])];
    const v = SUNLIGHT_WALK_SPEED * delta;
    if (fw || st) {
      destination.current = null;
      lookYaw.current = null;
      const sy = Math.sin(yawRef.current);
      const cy = Math.cos(yawRef.current);
      const nx = Math.max(SUNLIGHT_BOUNDS.minX, Math.min(SUNLIGHT_BOUNDS.maxX, localX + (-sy * fw + cy * st) * v));
      const nz = Math.max(SUNLIGHT_BOUNDS.minZ, Math.min(SUNLIGHT_BOUNDS.maxZ, localZ + (-cy * fw - sy * st) * v));
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
        const mx = Math.max(SUNLIGHT_BOUNDS.minX, Math.min(SUNLIGHT_BOUNDS.maxX, localX + (dx / L) * q));
        const mz = Math.max(SUNLIGHT_BOUNDS.minZ, Math.min(SUNLIGHT_BOUNDS.maxZ, localZ + (dz / L) * q));
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
    camera.position.x = ox + Math.max(SUNLIGHT_BOUNDS.minX, Math.min(SUNLIGHT_BOUNDS.maxX, camera.position.x - ox));
    camera.position.z = oz + Math.max(SUNLIGHT_BOUNDS.minZ, Math.min(SUNLIGHT_BOUNDS.maxZ, camera.position.z - oz));
    // Camera-height easing toward the active view preset (camY): the
    // height glides instead of jumping. The y is never clamped to the
    // walk bounds — a High / Plan view floats above the (hidden)
    // ceiling on purpose.
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
        const mx = ox + Math.max(SUNLIGHT_BOUNDS.minX, Math.min(SUNLIGHT_BOUNDS.maxX, dest.x - ox));
        const mz = oz + Math.max(SUNLIGHT_BOUNDS.minZ, Math.min(SUNLIGHT_BOUNDS.maxZ, dest.z - oz));
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


// Interior orbit limits: the camera stays inside the room. The orbit radius
// never reaches a wall, and the polar band keeps the camera between floor
// and ceiling, so the room always reads as an interior — never as a flat
// field of colour, and never as a closed box seen from outside.
function interiorOrbitLimits(width: number, depth: number, height: number) {
  const maxDistance = Math.min(width, depth) / 2 - 0.6;
  const eyeY = 1.8;
  const topCos = Math.min(0.99, (height - 0.4 - eyeY) / maxDistance);
  const bottomCos = Math.max(-0.99, (0.4 - eyeY) / maxDistance);
  return {
    maxDistance,
    minPolarAngle: Math.acos(topCos),
    maxPolarAngle: Math.acos(bottomCos),
  };
}

// When the active room changes, put the camera back inside the new room:
// at the entrance, eye height, looking at the room's centre. Without this
// the camera would stay wherever the previous room left it — possibly
// outside the new room's walls.
function InteriorCameraRig({
  roomKey,
  depth,
  enabled,
  zCenter = 0,
}: {
  roomKey: string;
  depth: number;
  enabled: boolean;
  // Room-local z of the floor centre (0 for centred rooms, −1 for
  // Sunlight, the def's floorCenterZ for the generic rooms).
  zCenter?: number;
}) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as {
    target: Vector3;
    update: () => void;
  } | null;
  useEffect(() => {
    if (!enabled) return;
    camera.position.set(0, 2.0, zCenter + depth / 2 - 1.8);
    if (controls) {
      controls.target.set(0, 1.8, zCenter);
      controls.update();
    } else {
      camera.lookAt(0, 1.8, zCenter);
    }
  }, [camera, controls, depth, enabled, roomKey, zCenter]);
  return null;
}

type ArtworkDragState = {
  id: string;
  mode: "move" | "resize";
  plane: Plane;
  grabOffset: Vector3;
  center: Vector3;
  startScale: number;
  startDist: number;
  clamp: { minX: number; maxX: number; minY: number; maxY: number; minZ: number; maxZ: number };
  // Framed half-size of the dragged artwork: the wall snap clamps the
  // work inside the wall's length and height, so it never hangs
  // half off a panel or past the ceiling.
  halfW: number;
  halfH: number;
};

// Editor drag: while an artwork drag is active, pointer moves on the canvas
// are turned into a point on the artwork's wall plane and applied as a new
// position (move) or a new scale (resize). The listeners live on the canvas
// element, so the drag keeps working even when the pointer leaves the frame.
//
// Wall-aware (move only): when the pointer is over a hangable wall, the
// artwork glides onto that wall — 0.1 m off, facing outward — and turns
// to the wall's normal, so a drag from a panel to a side wall lands
// facing the room instead of staying sideways at 46°. The grab offset
// is kept (projected onto the wall), so the work does not jump to centre
// under the pointer when it changes walls. Over empty space the drag
// falls back to its wall plane. Drags only run in the editor's orbit
// view, where the active room sits at offset 0, so the pointer ray and
// the room-local wall faces share one frame.
function DragHandler({
  dragRef,
  walls,
  onArtworkUpdate,
  onDragEnd,
}: {
  dragRef: React.RefObject<ArtworkDragState | null>;
  walls?: HangWallFace[];
  onArtworkUpdate?: (id: string, patch: { position?: [number, number, number]; scale?: number; rotation?: number }) => void;
  onDragEnd: (id: string) => void;
}) {
  const { camera, gl } = useThree();
  const updateRef = useRef(onArtworkUpdate);
  updateRef.current = onArtworkUpdate;
  const wallsRef = useRef(walls);
  wallsRef.current = walls;
  const endRef = useRef(onDragEnd);
  endRef.current = onDragEnd;
  useEffect(() => {
    const raycaster = new Raycaster();
    const ndc = new Vector2();
    const hit = new Vector3();
    const onMove = (event: PointerEvent) => {
      const drag = dragRef.current;
      const update = updateRef.current;
      if (!drag || !update) return;
      const rect = gl.domElement.getBoundingClientRect();
      ndc.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      if (drag.mode === "move") {
        const wallFaces = wallsRef.current;
        if (wallFaces && wallFaces.length > 0) {
          const wallHit = raycastHangWalls(
            { x: raycaster.ray.origin.x, y: raycaster.ray.origin.y, z: raycaster.ray.origin.z },
            { x: raycaster.ray.direction.x, y: raycaster.ray.direction.y, z: raycaster.ray.direction.z },
            wallFaces,
          );
          if (wallHit) {
            const face = wallHit.face;
            const nx = wallHit.normal.x;
            const nz = wallHit.normal.z;
            // Grab offset projected onto the wall plane, so the pointer
            // stays at the same spot on the artwork across the wall change.
            const alongN = drag.grabOffset.x * nx + drag.grabOffset.z * nz;
            const offX = drag.grabOffset.x - nx * alongN;
            const offY = drag.grabOffset.y;
            const offZ = drag.grabOffset.z - nz * alongN;
            // Centre on the wall: the hit point, shifted by the grab
            // offset, 0.1 m off the face — then clamped inside the wall.
            const cx = wallHit.point.x - offX + nx * 0.1;
            const cy = wallHit.point.y - offY;
            const cz = wallHit.point.z - offZ + nz * 0.1;
            const alongLo = -face.halfLen + drag.halfW;
            const alongHi = face.halfLen - drag.halfW;
            let along = (cx - face.cx) * face.ax + (cz - face.cz) * face.az;
            along = Math.min(Math.max(along, alongLo), Math.max(alongLo, alongHi));
            const yLo = face.minY + drag.halfH + 0.05;
            const yHi = face.maxY - drag.halfH - 0.05;
            const y = Math.min(Math.max(cy, yLo), Math.max(yLo, yHi));
            update(drag.id, {
              position: [
                face.cx + face.ax * along + nx * 0.1,
                y,
                face.cz + face.az * along + nz * 0.1,
              ],
              rotation: Math.atan2(nx, nz),
            });
            return;
          }
        }
      }
      if (!raycaster.ray.intersectPlane(drag.plane, hit)) return;
      if (drag.mode === "move") {
        const next = hit.clone().sub(drag.grabOffset);
        const c = drag.clamp;
        update(drag.id, {
          position: [
            Math.min(c.maxX, Math.max(c.minX, next.x)),
            Math.min(c.maxY, Math.max(c.minY, next.y)),
            Math.min(c.maxZ, Math.max(c.minZ, next.z)),
          ],
        });
      } else {
        const dist = Math.max(0.05, hit.distanceTo(drag.center));
        const scale = Math.min(3, Math.max(0.5, drag.startScale * (dist / drag.startDist)));
        update(drag.id, { scale: Math.round(scale * 100) / 100 });
      }
    };
    const onUp = () => {
      const drag = dragRef.current;
      if (!drag) return;
      dragRef.current = null;
      endRef.current(drag.id);
    };
    gl.domElement.addEventListener("pointermove", onMove);
    gl.domElement.addEventListener("pointerup", onUp);
    gl.domElement.addEventListener("pointercancel", onUp);
    return () => {
      gl.domElement.removeEventListener("pointermove", onMove);
      gl.domElement.removeEventListener("pointerup", onUp);
      gl.domElement.removeEventListener("pointercancel", onUp);
    };
  }, [camera, gl, dragRef]);
  return null;
}

// Drag and drop from the Elements palette: the palette item carries its
// type in the drag payload; dropping on the canvas raycasts the drop
// point onto the floor (or the back wall for wall pieces, a horizontal
// plane at rail height for the track light) and hands the room position
// to the editor, which adds the element there and selects it.
function ElementDropHandler({
  room,
  enabled,
  onDrop,
}: {
  room: GalleryRoom;
  enabled: boolean;
  onDrop?: (type: ElementType, point: { x: number; y: number; z: number }) => void;
}) {
  const { camera, gl } = useThree();
  const dropRef = useRef(onDrop);
  dropRef.current = onDrop;
  const roomRef = useRef(room);
  roomRef.current = room;
  useEffect(() => {
    if (!enabled) return;
    const el = gl.domElement;
    const onDragOver = (event: DragEvent) => {
      if (!event.dataTransfer || !Array.from(event.dataTransfer.types).includes("application/x-sanaa-element")) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = "copy";
    };
    const onDropEvent = (event: DragEvent) => {
      const type = event.dataTransfer?.getData("application/x-sanaa-element") as ElementType | "";
      if (!type || !(elementTypes as readonly string[]).includes(type)) return;
      event.preventDefault();
      const currentRoom = roomRef.current;
      const { width, depth, height } = roomLayouts[currentRoom.layout];
      // Room-local z of the floor centre (Sunlight −1, the generic
      // rooms their def's floorCenterZ): the wall plane and the drop
      // clamp are centred on the room, not on z = 0.
      const zCenter = roomFloorCenterZ(currentRoom.layout);
      const rect = el.getBoundingClientRect();
      const ndc = new Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      const raycaster = new Raycaster();
      raycaster.setFromCamera(ndc, camera);
      const hit = new Vector3();
      const planeKind = ELEMENT_PLANES[type];
      let point: Vector3 | null = null;
      if (planeKind === "wall") {
        const wallOffset = ELEMENT_DEFAULTS[type].wallOffset;
        const wallPlane = new Plane(new Vector3(0, 0, 1), -(zCenter - depth / 2 + wallOffset));
        if (raycaster.ray.intersectPlane(wallPlane, hit)) point = hit.clone();
      } else if (planeKind === "ceiling") {
        const y = Math.max(2.5, height - 0.4);
        if (raycaster.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -y), hit)) point = hit.clone();
      }
      if (!point && raycaster.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), 0), hit)) point = hit.clone();
      if (!point) return;
      point.x = Math.min(width / 2 - 0.5, Math.max(-width / 2 + 0.5, point.x));
      point.z = Math.min(zCenter + depth / 2 - 0.5, Math.max(zCenter - depth / 2 + 0.5, point.z));
      dropRef.current?.(type, { x: point.x, y: point.y, z: point.z });
    };
    el.addEventListener("dragover", onDragOver);
    el.addEventListener("drop", onDropEvent);
    return () => {
      el.removeEventListener("dragover", onDragOver);
      el.removeEventListener("drop", onDropEvent);
    };
  }, [camera, enabled, gl]);
  return null;
}

// Live camera state for the minimap (public viewer + editor): the
// camera's world position and yaw, updated every frame by a small
// reporter inside the Canvas. The minimap reads it through this ref
// and draws the camera dot and its direction line. `null` means the
// camera has not reported yet (SSR / before the first frame). The
// height (y) and pitch are also reported: the editor places a new
// artwork or curatorial text on the wall the camera is looking at,
// which needs the camera's look direction, not just its position.
export type CameraState = { x: number; y: number; z: number; yaw: number; pitch: number };
function CameraStateReporter({ cameraStateRef }: { cameraStateRef: { current: CameraState | null } }) {
  const { camera } = useThree();
  useFrame(() => {
    const euler = new Euler().setFromQuaternion(camera.quaternion, "YXZ");
    cameraStateRef.current = { x: camera.position.x, y: camera.position.y, z: camera.position.z, yaw: euler.y, pitch: euler.x };
  });
  return null;
}

// Teleport target for the exhibition minimap (public viewer): a point
// to walk to, in the target room's local coordinates, with the yaw to
// face once there — `null` means "walk there, keep the current
// direction" (a teleport to a point on the plan). `nonce` changes on
// every teleport request so the same artwork can be re-targeted. The
// scene switches rooms first when needed, then walks — never a blind
// jump through a wall.
export type TeleportTarget = {
  roomId: string;
  x: number;
  z: number;
  yaw: number | null;
  nonce: number;
};

/** Stand 2.2 m in front of an artwork and face it — the same geometry
    as clicking the artwork in walk mode. Returns room-local coords. */
export function artworkStandPoint(artwork: Artwork): { x: number; z: number; yaw: number } {
  const nx = Math.sin(artwork.rotation);
  const nz = Math.cos(artwork.rotation);
  return {
    x: artwork.position[0] + nx * 2.2,
    z: artwork.position[2] + nz * 2.2,
    yaw: Math.atan2(nx, nz),
  };
}

export default function GalleryScene({
  artworks,
  selectedId,
  onSelect,
  className,
  room,
  rooms,
  walkMode = false,
  activeRoomId,
  onRoomChange,
  input,
  onFloorClick,
  walking,
  interior = false,
  resetSignal,
  editable,
  onArtworkUpdate,
  onArtworkDragEnd,
  selectedElementId,
  onSelectElement,
  onElementUpdate,
  selectedSunlightElementId,
  onSelectSunlightElement,
  onSunlightElementUpdate,
  selectedWallId,
  onWallSelect,
  onEditStart,
  onEditEnd,
  onElementDrop,
  showGrid,
  showMeasure,
  multiSelectedIds,
  teleportTarget,
  cameraStateRef,
  quality: controlledQuality,
  onQualityChange,
  viewRequest,
  bare,
}: {
  artworks: Artwork[];
  selectedId?: string;
  onSelect?: (id: string, additive?: boolean) => void;
  className?: string;
  room: GalleryRoom;
  rooms?: GalleryRoom[];
  walkMode?: boolean;
  activeRoomId?: string;
  onRoomChange?: (id: string) => void;
  input?: React.RefObject<Set<string>>;
  onFloorClick?: (point: Vector3) => void;
  walking?: boolean;
  resetSignal?: React.RefObject<number>;
  // Minimap teleport (public viewer, walk mode): walk to this point.
  teleportTarget?: TeleportTarget | null;
  // Live camera state for the minimap: the reporter inside the Canvas
  // writes the camera's world position and yaw here every frame.
  cameraStateRef?: { current: CameraState | null };
  // Controlled render quality (public viewer entry screen): when the
  // parent passes a quality, it owns the choice; otherwise the scene
  // keeps its own state (editor, tools).
  quality?: RenderQuality;
  onQualityChange?: (quality: RenderQuality) => void;
  // Interior view: the camera starts inside the room and orbits from within,
  // so the visitor arrives directly in the gallery instead of looking at a
  // closed box from outside. The exterior (garden, doors, buildings) is a
  // later phase: the room boxes stay intact, only the viewpoint changes.
  interior?: boolean;
  // Editor only: drag artworks along their wall with the hand cursor and
  // resize them from the lime handle. Disabled while walking.
  editable?: boolean;
  onArtworkUpdate?: (id: string, patch: { position?: [number, number, number]; scale?: number; rotation?: number }) => void;
  // Editor only: an artwork drag just ended — the editor hangs the
  // artwork on the wall under the drop point (rotation + position),
  // so a dragged artwork lands as if just hung on its new wall.
  onArtworkDragEnd?: (id: string) => void;
  // Editor only: elements (furniture, partition walls, vitrines, ...).
  selectedElementId?: string;
  onSelectElement?: (id: string, additive?: boolean) => void;
  onElementUpdate?: (id: string, patch: { x?: number; y?: number; z?: number; scale?: number }) => void;
  // Editor only: Sunlight 3D elements (the reference room's own
  // pieces). Same wiring as the Asset Library above; the drag updates
  // only x/z (a Sunlight element always stands on the floor, y = 0).
  selectedSunlightElementId?: string;
  onSelectSunlightElement?: (id: string, additive?: boolean) => void;
  onSunlightElementUpdate?: (id: string, patch: { x?: number; y?: number; z?: number; scale?: number }) => void;
  // Editor only: wall painting — the wall clicked in the 3D view.
  selectedWallId?: string | null;
  onWallSelect?: (wallId: WallId | string) => void;
  // Editor only: a drag (or any discrete edit) is starting / ending, so
  // the editor can snapshot once per action for Ctrl+Z.
  onEditStart?: () => void;
  onEditEnd?: () => void;
  // Editor only: an element dropped from the palette onto the room.
  onElementDrop?: (type: ElementType, point: { x: number; y: number; z: number }) => void;
  // 3D builder (editor): 0.5 m floor grid, measurement guides, and the
  // extra ids of a multi-selection (any selected item may start a drag).
  showGrid?: boolean;
  showMeasure?: boolean;
  multiSelectedIds?: string[];
  // Editor only: a camera view preset requested by the View buttons
  // (Eye / Wide / High / Plan) — the nonce changes on every click.
  viewRequest?: { nonce: number; view: CameraViewPreset } | null;
  // Bare render (the gallery capture page): no quality toggle, no sun
  // slider — just the room, so a screenshot is a clean entrance view.
  bare?: boolean;
}) {
  const sceneRooms = rooms?.length ? rooms : [room];
  // Where each room sits in the shared 3D space (see roomPlanOffsets):
  // rooms line up along X. `offsets` is the X offset (kept, so every
  // existing use keeps working); `zOffsets` is the Z offset (0 for
  // every room — one Sunlight room per exhibition).
  const planOffsets = useMemo(() => roomPlanOffsets(sceneRooms), [sceneRooms]);
  const offsets = planOffsets.x;
  const zOffsets = planOffsets.z;

  const artworkRooms = walkMode ? sceneRooms : [room];
  const artworkOffsets = walkMode ? offsets : [0];
  const artworkZOffsets = walkMode ? zOffsets : [0];
  const destination = useRef<Vector3 | null>(null);
  const lookYaw = useRef<number | null>(null);
  const dragged = useRef(false);
  // True while an artwork or element is being dragged (set by the
  // drag handlers, cleared on pointerup): the walk controls skip the
  // look rotation while it is true, so the pointer moves the piece,
  // not the camera — the reference file's dragArt.
  const dragActiveRef = useRef(false);
  // Minimap teleport: a target in another room first switches rooms
  // (the camera re-enters at that room's entrance), then the pending
  // target is walked to once the room is active.
  const pendingTeleport = useRef<TeleportTarget | null>(null);
  // The nonce of the last teleport this effect actually handled. The
  // editor requests a teleport and enters walk mode in the same click
  // (setTeleportTarget + setWalking(true)); if this effect first runs
  // while walkMode is still false it must NOT swallow the request —
  // it re-runs once walk mode turns on and handles it then. Without
  // the guard, re-running on walkMode would replay the same teleport.
  const lastTeleportNonce = useRef<number | null>(null);
  const activeRoomIdRef = useRef(activeRoomId ?? room.id);
  activeRoomIdRef.current = activeRoomId ?? room.id;
  useEffect(() => {
    if (!teleportTarget || !walkMode) return;
    if (teleportTarget.nonce === lastTeleportNonce.current) return;
    lastTeleportNonce.current = teleportTarget.nonce;
    const targetRoomIndex = sceneRooms.findIndex((sceneRoom) => sceneRoom.id === teleportTarget.roomId);
    if (targetRoomIndex < 0) return;
    const worldX = offsets[targetRoomIndex] + teleportTarget.x;
    const worldZ = zOffsets[targetRoomIndex] + teleportTarget.z;
    if (teleportTarget.roomId === activeRoomIdRef.current) {
      destination.current = new Vector3(worldX, 0, worldZ);
      lookYaw.current = teleportTarget.yaw;
      pendingTeleport.current = null;
    } else {
      pendingTeleport.current = teleportTarget;
      onRoomChange?.(teleportTarget.roomId);
    }
    // Re-runs when walk mode turns on too, not only on the teleport
    // request (nonce): a teleport asked from the editor's floor plan
    // arrives together with entering walk mode, and the request must
    // be handled once walk mode is actually on. The nonce guard above
    // keeps a re-run from replaying the same teleport.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [teleportTarget?.nonce, walkMode]);
  useEffect(() => {
    const pending = pendingTeleport.current;
    if (!pending || pending.roomId !== (activeRoomId ?? room.id)) return;
    const targetRoomIndex = sceneRooms.findIndex((sceneRoom) => sceneRoom.id === pending.roomId);
    if (targetRoomIndex < 0) return;
    destination.current = new Vector3(offsets[targetRoomIndex] + pending.x, 0, zOffsets[targetRoomIndex] + pending.z);
    lookYaw.current = pending.yaw;
    pendingTeleport.current = null;
  }, [activeRoomId, offsets, room.id, sceneRooms, zOffsets]);
  // Editor drag state: set on pointerdown on an artwork (or its resize
  // handle), read by DragHandler on every pointer move, cleared on
  // pointerup. While a drag is active the walk controls skip the look
  // rotation (dragActiveRef), so the camera never turns while an
  // artwork is being moved.
  const dragRef = useRef<ArtworkDragState | null>(null);
  // Hangable wall faces of the active room (room walls, panels and any
  // cloison/suspendu added): the drag raycasts them, so a dragged
  // artwork glides onto whatever wall the pointer is over. Rebuilt
  // when the room's added walls change, so a just-added cloison is
  // hangable at once.
  const dragWalls = useMemo<HangWallFace[]>(
    () =>
      room.layout === "sunlight"
        ? sunlightHangWalls(room.sunlightElements ?? [])
        : galleryHangWalls(room.layout, room.elements),
    [room.layout, room.sunlightElements, room.elements],
  );
  const [isDragging, setIsDragging] = useState(false);
  const [dragCursor, setDragCursor] = useState<string | null>(null);
  const [hoveredArtwork, setHoveredArtwork] = useState<{ id: string; cursor: string } | null>(null);

  // Photorealism: render-quality tier (High / Medium / Low), persisted
  // per user in localStorage. Defaults to Medium on touch devices.
  // Initialised to High for SSR, then corrected on mount from storage
  // so the server render never mismatches the client. Toggling
  // mid-session only flips light/env flags — the Canvas itself is never
  // remounted, so walk mode, drags and selection keep working. When the
  // parent controls the quality (public entry screen), its value wins.
  const [internalQuality, setInternalQuality] = useState<RenderQuality>("high");
  const quality = controlledQuality ?? internalQuality;
  useEffect(() => {
    if (controlledQuality) return;
    setInternalQuality(loadRenderQuality());
  }, [controlledQuality]);
  const handleQualityChange = useCallback((next: RenderQuality) => {
    if (onQualityChange) {
      onQualityChange(next);
    } else {
      setInternalQuality(next);
    }
    saveRenderQuality(next);
  }, [onQualityChange]);
  const qualityCfg = RENDER_QUALITY_CONFIG[quality];

  // Sunlight: the sun slider (0-100, default 35) — the source's sun
  // control, moving the sun along its arc. Local state, like the
  // render-quality tier; the editor and the public viewer each keep
  // their own.
  const [sunValue, setSunValue] = useState(35);

  const handleDragStart = (id: string, mode: "move" | "resize", event: ThreeEvent<PointerEvent>) => {
    if (!editable) return;
    const artwork = artworks.find((item) => item.id === id);
    if (!artwork) return;
    // The pointerdown already selected this artwork (a press selects
    // and starts the drag in one gesture), so the selection check is
    // not repeated here — React state is async, the press is the
    // source of truth.
    dragActiveRef.current = true;
    // Grabbing a piece stops any walk in progress (a double-click
    // selection walks toward the piece first — the drag takes over).
    destination.current = null;
    lookYaw.current = null;
    onEditStart?.();
    const { width, height } = artworkSize(artwork);
    const layout = roomLayouts[room.layout];
    // The full framed size: a wide museum frame or a shadow box must
    // stay on the wall, not just the artwork itself.
    const outer = frameOuterSize(artwork);
    const halfW = (outer.width / 2) * artwork.scale;
    const halfH = (outer.height / 2) * artwork.scale;
    const normal = new Vector3(Math.sin(artwork.rotation), 0, Math.cos(artwork.rotation));
    const position = new Vector3(artwork.position[0], artwork.position[1], artwork.position[2]);
    const plane = new Plane().setFromNormalAndCoplanarPoint(normal, position);
    // Grab offset, projected onto the wall plane so the artwork never drifts
    // off its wall while it is dragged.
    const grabOffset = event.point.clone().sub(position);
    grabOffset.addScaledVector(normal, -grabOffset.dot(normal));
    const hitOnPlane = event.point.clone().addScaledVector(normal, -event.point.clone().sub(position).dot(normal));
    const startDist = Math.max(0.1, hitOnPlane.distanceTo(position));
    // The room is not centred on z = 0 (Sunlight −1, the generic
    // rooms their def's floorCenterZ): the drag clamp reads it.
    const zCenter = roomFloorCenterZ(room.layout);
    dragRef.current = {
      id,
      mode,
      plane,
      grabOffset,
      center: position,
      startScale: artwork.scale,
      startDist,
      clamp: {
        minX: -layout.width / 2 + halfW,
        maxX: layout.width / 2 - halfW,
        minY: halfH + 0.05,
        maxY: layout.height - halfH - 0.05,
        minZ: zCenter - layout.depth / 2 + halfW,
        maxZ: zCenter + layout.depth / 2 - halfW,
      },
      halfW,
      halfH,
    };
    setIsDragging(true);
    setDragCursor(mode === "resize" ? "nwse-resize" : "grabbing");
  };

  // Editor drag for elements: the drag plane follows the element type —
  // the floor plane for furniture and partition walls, the wall plane for
  // wall-mounted pieces, a horizontal plane at the element's height for
  // the ceiling track light. Positions are room coordinates (the active
  // room sits at offset 0 in the editor).
  const elementDragRef = useRef<ElementDragState | null>(null);
  const [hoveredElement, setHoveredElement] = useState<{ id: string; cursor: string } | null>(null);

  const handleElementDragStart = (id: string, mode: "move" | "resize", event: ThreeEvent<PointerEvent>) => {
    if (!editable) return;
    // Elements live in every room, not just the active one (walk mode
    // shows all rooms at once): find the room that holds this element.
    const ownerRoom = sceneRooms.find((sceneRoom) => (sceneRoom.elements ?? []).some((item) => item.id === id)) ?? room;
    const element = (ownerRoom.elements ?? []).find((item) => item.id === id);
    if (!element) return;
    // The pointerdown already selected this element, so the selection
    // check is not repeated here (React state is async).
    dragActiveRef.current = true;
    // Grabbing a piece stops any walk in progress (a double-click
    // selection walks toward the piece first — the drag takes over).
    destination.current = null;
    lookYaw.current = null;
    onEditStart?.();
    const layout = roomLayouts[ownerRoom.layout];
    const planeKind = ELEMENT_PLANES[element.type];
    const position = new Vector3(element.x, element.y, element.z);
    let plane: Plane;
    if (planeKind === "floor") {
      plane = new Plane(new Vector3(0, 1, 0), 0);
    } else if (planeKind === "ceiling") {
      plane = new Plane(new Vector3(0, 1, 0), -element.y);
    } else {
      const normal = new Vector3(Math.sin(element.rotation), 0, Math.cos(element.rotation));
      plane = new Plane().setFromNormalAndCoplanarPoint(normal, position);
    }
    const grabOffset = event.point.clone().sub(position);
    grabOffset.addScaledVector(plane.normal, -grabOffset.dot(plane.normal));
    const hitOnPlane = event.point.clone().addScaledVector(plane.normal, -event.point.clone().sub(position).dot(plane.normal));
    const startDist = Math.max(0.1, hitOnPlane.distanceTo(position));
    // Doors and curtains stay on the floor; windows, wall text and
    // shelves slide up and down their wall.
    const minY = planeKind === "wall" && (element.type === "window" || element.type === "wall-text" || element.type === "shelf") ? 1.0 : element.y;
    const maxY = planeKind === "wall" && (element.type === "window" || element.type === "wall-text" || element.type === "shelf") ? 3.2 : element.y;
    // The room is not centred on z = 0 (Sunlight −1, the generic
    // rooms their def's floorCenterZ).
    const zCenter = roomFloorCenterZ(ownerRoom.layout);
    elementDragRef.current = {
      id,
      mode,
      plane,
      grabOffset,
      center: position,
      startScale: element.scale,
      startDist,
      clamp: {
        minX: -layout.width / 2 + 0.5,
        maxX: layout.width / 2 - 0.5,
        minY,
        maxY,
        minZ: zCenter - layout.depth / 2 + 0.5,
        maxZ: zCenter + layout.depth / 2 - 0.5,
      },
    };
    setIsDragging(true);
    setDragCursor(mode === "resize" ? "nwse-resize" : "grabbing");
  };

  // Editor drag for Sunlight 3D elements: every one slides on the
  // floor plane (the file's moveO), y = 0, inside the file's bounds
  // (x ±10.3, z -13.3..11.3). The spotlight drags the same way — its
  // SpotLight and target are children of the group, so the beam moves
  // with it — and it has no collision block to update. Positions are
  // room coordinates (the active room sits at offset 0 in the editor).
  const sunlightDragRef = useRef<ElementDragState | null>(null);
  const [hoveredSunlightElement, setHoveredSunlightElement] = useState<{ id: string; cursor: string } | null>(null);

  const handleSunlightElementDragStart = (id: string, mode: "move", event: ThreeEvent<PointerEvent>) => {
    if (!editable) return;
    const ownerRoom = sceneRooms.find((sceneRoom) => (sceneRoom.sunlightElements ?? []).some((item) => item.id === id)) ?? room;
    const element = (ownerRoom.sunlightElements ?? []).find((item) => item.id === id);
    if (!element) return;
    // The pointerdown already selected this element, so the selection
    // check is not repeated here (React state is async).
    dragActiveRef.current = true;
    // Grabbing a piece stops any walk in progress (a double-click
    // selection walks toward the piece first — the drag takes over).
    destination.current = null;
    lookYaw.current = null;
    onEditStart?.();
    const position = new Vector3(element.x, 0, element.z);
    const plane = new Plane(new Vector3(0, 1, 0), 0);
    const grabOffset = event.point.clone().sub(position);
    grabOffset.addScaledVector(plane.normal, -grabOffset.dot(plane.normal));
    const hitOnPlane = event.point.clone().addScaledVector(plane.normal, -event.point.clone().sub(position).dot(plane.normal));
    const startDist = Math.max(0.1, hitOnPlane.distanceTo(position));
    sunlightDragRef.current = {
      id,
      mode,
      plane,
      grabOffset,
      center: position,
      startScale: 1,
      startDist,
      clamp: {
        minX: SUNLIGHT_ELEMENT_BOUNDS.minX,
        maxX: SUNLIGHT_ELEMENT_BOUNDS.maxX,
        minY: 0,
        maxY: 0,
        minZ: SUNLIGHT_ELEMENT_BOUNDS.minZ,
        maxZ: SUNLIGHT_ELEMENT_BOUNDS.maxZ,
      },
    };
    setIsDragging(true);
    setDragCursor("grabbing");
  };

  // Rooms are self-contained: one solid room per exhibition, no side
  // doorways, no arch, no shared walls. In walk mode every room's
  // floor and artworks are walk targets, not just the active room's;
  // rooms are switched by teleport (mini-plan / room list), never by
  // walking through a wall.
  // The active view preset (the editor's View buttons): High / Plan
  // hide the ceiling, so the room reads from above. Computed here,
  // before the room nodes that pass it down.
  const viewPreset = viewRequest ? VIEW_PRESETS[viewRequest.view] : null;
  const hideCeiling = viewPreset?.hideCeiling ?? false;
  const artworkNodes = artworkRooms.map((sceneRoom, index) => {
    const RoomComponent = isGalleryLayout(sceneRoom.layout) ? GenericRoom : SunlightRoom;
    return (
    <RoomComponent
      key={sceneRoom.id}
      room={sceneRoom}
      offsetX={artworkOffsets[index]}
      offsetZ={artworkZOffsets[index]}
      artworks={artworks.filter((artwork) => artwork.roomId === sceneRoom.id)}
      selectedId={selectedId}
      onSelect={onSelect}
      walkable={walkMode && walking === true}
      editable={editable}
      onDragStart={handleDragStart}
      onHoverChange={setHoveredArtwork}
      selectedElementId={selectedElementId}
      onSelectElement={onSelectElement}
      onElementDragStart={handleElementDragStart}
      onElementHover={setHoveredElement}
      selectedSunlightElementId={selectedSunlightElementId}
      onSelectSunlightElement={onSelectSunlightElement}
      onSunlightElementDragStart={handleSunlightElementDragStart}
      onSunlightElementHover={setHoveredSunlightElement}
      showGrid={showGrid}
      showMeasure={showMeasure}
      hideCeiling={hideCeiling}
      onFloorClick={walkMode ? (point) => {
        // Clamp the walk target to the active room's walkable bounds:
        // a click on a wall (or outside the room) is brought back
        // inside, so the camera and the marker ring stop at a
        // reachable point instead of a wall.
        const idx = Math.max(0, sceneRooms.findIndex((r) => r.id === (activeRoomId ?? room.id)));
        const def = galleryDef(sceneRooms[idx].layout);
        const b = def?.bounds ?? SUNLIGHT_BOUNDS;
        const ox = offsets[idx] ?? 0;
        const oz = zOffsets[idx] ?? 0;
        const cx = ox + Math.max(b.minX, Math.min(b.maxX, point.x - ox));
        const cz = oz + Math.max(b.minZ, Math.min(b.maxZ, point.z - oz));
        destination.current = new Vector3(cx, 0, cz);
        lookYaw.current = null;
        onFloorClick?.(point);
      } : undefined}
      dragged={dragged}
      quality={quality}
    />
    );
  });
  const startRoom = sceneRooms[Math.max(0, sceneRooms.findIndex((sceneRoom) => sceneRoom.id === (activeRoomId ?? room.id)))];
  const startIndex = Math.max(0, sceneRooms.findIndex((sceneRoom) => sceneRoom.id === (activeRoomId ?? room.id)));
  const startOffset = offsets[startIndex];
  const startZOffset = zOffsets[startIndex];
  const startDepth = roomLayouts[startRoom.layout].depth;
  // The active room's definition: Sunlight keeps its own lighting
  // (sun + hemisphere + IBL + sun slider); a generic room reads its
  // background, fog and environment flag from its def, and its shells
  // bring their own lights.
  const activeDef = galleryDef(startRoom.layout);
  const activeIsSunlight = startRoom.layout === "sunlight";
  const startCam = activeIsSunlight
    ? SUNLIGHT_CAMERA_START
    : { x: activeDef?.cameraStart.x ?? 0, y: activeDef?.cameraStart.y ?? 1.6, z: activeDef?.cameraStart.z ?? 8 };
  const interiorView = interior === true && !walkMode;
  const interiorLimits = useMemo(() => {
    const layout = roomLayouts[room.layout];
    return interiorOrbitLimits(layout.width, layout.depth, layout.height);
  }, [room.layout]);
  // The Sunlight lighting (sun + hemisphere + IBL) lives in
  // SunlightRig / SunlightEnvironment: there is no generic ambient or
  // directional light and no per-room light mood anymore.
  // Drag vs click: a pointer that moved more than a few pixels is an
  // orbit drag, not a click — walls and artworks must not select then.
  const dragStartPoint = useRef<{ x: number; y: number } | null>(null);

  // NOTE: this div's positioning comes ONLY from its className
  // (public-gallery-canvas / editor-canvas are position:absolute with
  // inset:0; galleries-viewer-canvas / gallery-canvas are relative
  // with 100% size). Never set position inline here: commit 9b74de7
  // added position:"relative" inline, which overrode the absolute
  // classes, so the public exhibition (and editor) canvas collapsed
  // to a short strip instead of filling the viewport. The quality
  // toggle is absolutely positioned inside this div, and absolute
  // counts as positioned, so it stays anchored in every context.
  return (
    <div
      className={`${className ?? "gallery-canvas"}${walkMode && walking ? " is-walking" : ""}`}
      style={{ cursor: isDragging ? dragCursor ?? "grabbing" : hoveredArtwork?.cursor ?? hoveredElement?.cursor ?? hoveredSunlightElement?.cursor ?? undefined }}
      onPointerDown={(event) => {
        dragStartPoint.current = { x: event.clientX, y: event.clientY };
        dragged.current = false;
      }}
      onPointerMove={(event) => {
        const start = dragStartPoint.current;
        if (start && (Math.abs(event.clientX - start.x) > 6 || Math.abs(event.clientY - start.y) > 6)) {
          dragged.current = true;
        }
      }}
      onPointerUp={() => { dragStartPoint.current = null; }}
    >
      <Canvas camera={{ position: interiorView ? [0, 2.0, (room.layout === "sunlight" ? 0 : roomFloorCenterZ(room.layout)) + startDepth / 2 - 1.8] : walkMode ? [startOffset + startCam.x, startCam.y, startZOffset + startCam.z] : [0, 3.2, 11], fov: interiorView ? 60 : walkMode ? 66 : 43 }} dpr={qualityCfg.dpr} shadows="variance">
        {/* Backdrop: Sunlight keeps the source's pale sky (#dfe6ee),
            no fog; a generic room reads its background (and fog, when
            its source has one) from its def. The sun, hemisphere and
            IBL live in SunlightRig / SunlightEnvironment for Sunlight
            only; a generic room with an environment scene gets the
            shared PMREM gradient instead, and its shell brings its own
            lights either way. */}
        <color attach="background" args={[activeDef?.background ?? "#dfe6ee"]} />
        {activeDef?.fog && <fog attach="fog" args={[activeDef.fog.color, activeDef.fog.near, activeDef.fog.far]} />}
        <ToneMappingRig exposure={qualityCfg.exposure} />
        {activeIsSunlight && <SunlightEnvironment />}
        {activeIsSunlight && <SunlightRig sunValue={sunValue} quality={quality} sunColor={sunlightSunColor(startRoom.lightType)} />}
        {!activeIsSunlight && activeDef?.environment && <GalleryEnvironment />}
        {cameraStateRef && <CameraStateReporter cameraStateRef={cameraStateRef} />}
        {/* Artwork textures load through Suspense so a slow image suspends
            only the artworks — never the whole room or page. */}
        <Suspense fallback={null}>{artworkNodes}</Suspense>
        <DragHandler
          dragRef={dragRef}
          walls={dragWalls}
          onArtworkUpdate={onArtworkUpdate}
          onDragEnd={(id) => {
            dragActiveRef.current = false;
            setIsDragging(false);
            setDragCursor(null);
            onArtworkDragEnd?.(id);
            onEditEnd?.();
          }}
        />
        <ElementDragHandler
          dragRef={elementDragRef}
          onElementUpdate={onElementUpdate}
          onDragEnd={() => {
            dragActiveRef.current = false;
            setIsDragging(false);
            setDragCursor(null);
            onEditEnd?.();
          }}
        />
        {/* Sunlight 3D elements drag on their own ref: the two handlers
            each act only while their own drag is active, so they never
            fight over the same pointer move. */}
        <ElementDragHandler
          dragRef={sunlightDragRef}
          onElementUpdate={onSunlightElementUpdate}
          onDragEnd={() => {
            dragActiveRef.current = false;
            setIsDragging(false);
            setDragCursor(null);
            onEditEnd?.();
          }}
        />
        <ElementDropHandler room={room} enabled={Boolean(editable)} onDrop={onElementDrop} />
        {interiorView && (
          <InteriorCameraRig roomKey={`${room.id}:${room.layout}`} depth={startDepth} enabled zCenter={room.layout === "sunlight" ? 0 : roomFloorCenterZ(room.layout)} />
        )}
        {walkMode && input ? (
          activeIsSunlight ? (
            <SunlightWalkControls rooms={sceneRooms} activeRoomId={activeRoomId ?? room.id} offsets={offsets} zOffsets={zOffsets} input={input} destination={destination} lookYaw={lookYaw} dragged={dragged} dragActive={dragActiveRef} enabled={walking ?? false} onRoomChange={onRoomChange} resetSignal={resetSignal} viewRequest={viewRequest} />
          ) : (
            <GalleryWalkControls rooms={sceneRooms} activeRoomId={activeRoomId ?? room.id} offsets={offsets} zOffsets={zOffsets} input={input} destination={destination} lookYaw={lookYaw} dragged={dragged} dragActive={dragActiveRef} enabled={walking ?? false} onRoomChange={onRoomChange} resetSignal={resetSignal} viewRequest={viewRequest} />
          )
        ) : (
          <OrbitControls
            makeDefault
            enabled={!isDragging && !(hoveredArtwork && hoveredArtwork.id === selectedId) && !(hoveredElement && hoveredElement.id === selectedElementId) && !(hoveredSunlightElement && hoveredSunlightElement.id === selectedSunlightElementId)}
            minDistance={interiorView ? 1.2 : 4}
            maxDistance={interiorView ? interiorLimits.maxDistance : Math.max(roomLayouts[room.layout].width, roomLayouts[room.layout].depth) + 6}
            minPolarAngle={interiorView ? interiorLimits.minPolarAngle : 0}
            maxPolarAngle={interiorView ? interiorLimits.maxPolarAngle : Math.PI / 2.03}
            target={interiorView ? [0, 1.8, room.layout === "sunlight" ? 0 : roomFloorCenterZ(room.layout)] : activeIsSunlight ? [0, 2.1, -roomLayouts[room.layout].depth / 2] : [0, 2.1, roomFloorCenterZ(room.layout)]}
            enableDamping
          />
        )}
      </Canvas>
      {!bare && (
        <>
          <RenderQualityToggle quality={quality} onChange={handleQualityChange} canvasClassName={className} />
          {activeIsSunlight && <SunSlider value={sunValue} onChange={setSunValue} canvasClassName={className} />}
        </>
      )}
    </div>
  );
}
