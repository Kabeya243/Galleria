"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, Suspense } from "react";
import { ACESFilmicToneMapping, AdditiveBlending, BufferAttribute, CanvasTexture, DoubleSide, InstancedMesh, MathUtils, Object3D, Path, PCFSoftShadowMap, Plane, PlaneGeometry, PMREMGenerator, Raycaster, RepeatWrapping, Shape, SRGBColorSpace, Texture, TextureLoader, Vector2, Vector3 } from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { loadRenderQuality, RENDER_QUALITIES, RENDER_QUALITY_CONFIG, RENDER_QUALITY_LABELS, saveRenderQuality, surfacePBR, type RenderQuality } from "@/lib/render-quality";
import type { Artwork } from "@/lib/demo-data";
import { resolveFrameSpec } from "@/lib/demo-data";
import type { FrameSpec } from "@/lib/demo-data";
import { frameTileTexture, matTexture } from "@/lib/frame-textures";
import { frameRingGeometry, perimeterPositions, profileBevel, profileLevels, rosetteGeometry, scrollGeometry, setInstancedMatrices, type FrameLevel } from "@/lib/frame-geometry";
import { ELEMENT_DEFAULTS, ELEMENT_PLANES, elementTypes, PLINTH_HEIGHTS, WALL_TEXT_FONTS, type ElementType, type RoomElement } from "@/lib/elements";
import { isStoneLayout, roomLayouts, roomPlanOffsets, type GalleryRoom, type PartitionWall, type RoomLayout, type WallId } from "@/lib/rooms";

// Light moods per room: the spot colour and intensity, and the room's
// ambient and directional light, all follow the room's light type.
const LIGHT_PRESETS = {
  "spot-warm": { ambient: 1.4, directional: 1.8, directionalColor: "#fff2df", spotColor: "#fff0d6", spotIntensity: 22, pointColor: "#f4d8b8", pointIntensity: 0.55 },
  "spot-cool": { ambient: 1.5, directional: 1.9, directionalColor: "#e8f0ff", spotColor: "#dfe8ff", spotIntensity: 22, pointColor: "#d8e2f4", pointIntensity: 0.55 },
  ambient: { ambient: 2.6, directional: 1.0, directionalColor: "#ffffff", spotColor: "#ffffff", spotIntensity: 0, pointColor: "#ffffff", pointIntensity: 0.3 },
  // Stone Gallery: the reference room's warm glow — a soft hemisphere
  // plus warm point lights carry the ambient, a gentle warm
  // directional grounds the shadows, and the per-artwork spots stay
  // low (no bright pools). The hemisphere and the five point lights
  // are added in GalleryScene when this preset is active.
  "stone-warm": { ambient: 0.6, directional: 0.8, directionalColor: "#ffe2b8", spotColor: "#ffe2b8", spotIntensity: 10, pointColor: "#ffe2b8", pointIntensity: 0.55 },
} as const;

function createSurfaceTexture(style: string): CanvasTexture | undefined {
  if (typeof document === "undefined") return undefined;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const context = canvas.getContext("2d");
  if (!context) return undefined;

  // The map is multiplied by the material colour, so patterns are drawn in
  // near-white with dark lines: the colour tints the surface and the dark
  // joints, seams and veins stay dark, so each finish reads at a glance —
  // including from outside the room, where the same materials face out.
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;

  if (style === "brick") {
    context.fillStyle = "#f7f2e8";
    context.fillRect(0, 0, 256, 256);
    for (let row = 0; row < 8; row += 1) {
      const y = row * 32;
      const offset = row % 2 ? -32 : 0;
      for (let x = offset; x < 256; x += 64) {
        const shade = 236 + ((row * 7 + x) % 3) * 5;
        context.fillStyle = `rgb(${shade}, ${shade - 4}, ${shade - 12})`;
        context.fillRect(x + 2, y + 2, 60, 28);
      }
    }
    context.fillStyle = "#453831";
    for (let row = 0; row <= 8; row += 1) context.fillRect(0, row * 32 - 1, 256, 3);
    for (let row = 0; row < 8; row += 1) {
      const offset = row % 2 ? -32 : 0;
      for (let x = offset; x <= 256; x += 64) context.fillRect(x - 1, row * 32, 3, 32);
    }
    texture.repeat.set(6, 3);
  } else if (style === "wood" || style === "parquet") {
    // "parquet" shares the procedural wood tile as its fallback: the
    // real photo (useParquetTexture) replaces it once loaded, so the
    // floor never sits flat while the photo is in flight.
    context.fillStyle = "#f8f2e2";
    context.fillRect(0, 0, 256, 256);
    for (let plank = 0; plank < 8; plank += 1) {
      const y = plank * 32;
      const tone = 232 + (plank % 3) * 8;
      context.fillStyle = `rgb(${tone}, ${tone - 8}, ${tone - 26})`;
      context.fillRect(0, y + 2, 256, 28);
      context.strokeStyle = "rgba(122, 102, 70, 0.5)";
      context.lineWidth = 1;
      context.beginPath();
      context.moveTo(0, y + 12 + (plank % 3) * 4);
      context.bezierCurveTo(80, y + 8, 170, y + 18, 256, y + 12);
      context.stroke();
    }
    context.fillStyle = "#6f5b3f";
    for (let plank = 0; plank <= 8; plank += 1) context.fillRect(0, plank * 32 - 1, 256, 2);
    for (let plank = 0; plank < 8; plank += 1) {
      context.fillRect(plank % 2 ? 170 : 85, plank * 32, 2, 32);
    }
    texture.repeat.set(6, 4);
  } else if (style === "concrete") {
    context.fillStyle = "#f4f1ea";
    context.fillRect(0, 0, 256, 256);
    // Board-formed concrete: a 2 x 2 grid of formwork panels with joints.
    // No tie holes: the black dots read as dirt on the wall, so the panels
    // stay clean and the artworks hang on plain concrete.
    context.fillStyle = "#6b655a";
    context.fillRect(0, 127, 256, 3);
    context.fillRect(127, 0, 3, 256);
    let seed = 41;
    for (let i = 0; i < 950; i += 1) {
      seed = (seed * 16807) % 2147483647;
      const x = seed % 256;
      seed = (seed * 16807) % 2147483647;
      const y = seed % 256;
      const shade = 150 + (seed % 70);
      context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.22)`;
      context.fillRect(x, y, 2, 2);
    }
    texture.repeat.set(4, 2);
  } else if (style === "stone-concrete") {
    // Stone concrete (Stone Gallery floor): the reference room's
    // mottled concrete — large soft dark and light blotches over a
    // warm grey base, no formwork joints, no panel lines. Drawn in
    // the REFERENCE's own colours (base #b5b0a5, dark blotches
    // 70,65,58, light blotches 235,230,220), not near-white: the
    // material colour #b5b0a5 multiplies this map, so a near-white
    // base renders the floor as pale cream under SANAA's lights
    // (hemisphere + ambient + directional + five point lights is
    // about twice the reference's light), while the reference's own
    // colours multiplied by the floor colour land as the warm dark
    // brown-grey concrete of the original. Seeded. Values are the
    // reference's, halved for this 256 px tile (the reference uses a
    // 512 px tile): 700 blotches of radius 6–70.
    context.fillStyle = "#b5b0a5";
    context.fillRect(0, 0, 256, 256);
    let seed = 31;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    for (let i = 0; i < 700; i += 1) {
      const dark = rand() < 0.5;
      const alpha = 0.03 + rand() * 0.07;
      context.fillStyle = dark
        ? `rgba(70, 65, 58, ${alpha.toFixed(3)})`
        : `rgba(235, 230, 220, ${alpha.toFixed(3)})`;
      const r = 3 + rand() * 32;
      context.beginPath();
      context.arc(rand() * 256, rand() * 256, r, 0, Math.PI * 2);
      context.fill();
    }
    // One tile covers ~4 m, like the reference (5 across, 5 deep).
    texture.repeat.set(5, 5);
  } else if (style === "marble") {
    context.fillStyle = "#fbfaf6";
    context.fillRect(0, 0, 256, 256);
    let seed = 97;
    for (let i = 0; i < 9; i += 1) {
      seed = (seed * 16807) % 2147483647;
      const startX = seed % 256;
      seed = (seed * 16807) % 2147483647;
      const startY = seed % 256;
      seed = (seed * 16807) % 2147483647;
      const drift = (seed % 120) - 60;
      context.strokeStyle = i % 3 === 0 ? "rgba(125, 119, 107, 0.75)" : "rgba(164, 158, 146, 0.55)";
      context.lineWidth = i % 3 === 0 ? 1.6 : 1;
      context.beginPath();
      context.moveTo(startX, startY);
      context.bezierCurveTo(startX + drift, startY + 80, startX - drift, startY + 160, startX + drift / 2, 256);
      context.stroke();
    }
    texture.repeat.set(2, 2);
  } else if (style === "stone") {
    context.fillStyle = "#f3f0e8";
    context.fillRect(0, 0, 256, 256);
    for (let ty = 0; ty < 2; ty += 1) {
      for (let tx = 0; tx < 2; tx += 1) {
        const shade = 238 + ((tx + ty) % 2) * 6;
        context.fillStyle = `rgb(${shade}, ${shade - 3}, ${shade - 10})`;
        context.fillRect(tx * 128 + 2, ty * 128 + 2, 124, 124);
      }
    }
    context.fillStyle = "#b3ac9c";
    context.fillRect(0, 127, 256, 3);
    context.fillRect(127, 0, 3, 256);
    texture.repeat.set(4, 3);
  } else if (style === "stone-plaster") {
    // Stone plaster (Stone Gallery): the Three.js reference room's
    // wall, drawn the way the reference draws it — large soft
    // blotches (not fine dots), age stains and hairline cracks over a
    // warm plaster base. Drawn in near-white so the wall colour tints
    // it; the dark speckle, stains and cracks stay dark. Seeded, so
    // the wall looks the same on every render. Values are the
    // reference's, halved for this 256 px tile (the reference uses a
    // 512 px tile): 900 speckles of radius 4–55, 14 stains, 10 cracks.
    context.fillStyle = "#f2eee3";
    context.fillRect(0, 0, 256, 256);
    let seed = 7;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    // Speckles: large soft dark and light blotches, like the reference.
    for (let i = 0; i < 900; i += 1) {
      const dark = rand() < 0.5;
      const alpha = dark ? 0.03 + rand() * 0.09 : 0.04 + rand() * 0.11;
      context.fillStyle = dark
        ? `rgba(110, 100, 85, ${alpha.toFixed(3)})`
        : `rgba(255, 255, 255, ${alpha.toFixed(3)})`;
      const r = 2 + rand() * 26;
      context.beginPath();
      context.arc(rand() * 256, rand() * 256, r, 0, Math.PI * 2);
      context.fill();
    }
    // Age stains: soft rectangular patches.
    for (let i = 0; i < 14; i += 1) {
      const alpha = 0.25 + rand() * 0.2;
      context.fillStyle = `rgba(120, 108, 92, ${alpha.toFixed(3)})`;
      const w = 20 + rand() * 35;
      const h = 12 + rand() * 18;
      context.fillRect(rand() * (256 - w), rand() * (256 - h), w, h);
    }
    // Hairline cracks: jagged polylines wandering downwards.
    context.strokeStyle = "rgba(60, 50, 40, 0.45)";
    context.lineWidth = 1.2;
    for (let i = 0; i < 10; i += 1) {
      let x = rand() * 256;
      let y = rand() * 256;
      context.beginPath();
      context.moveTo(x, y);
      for (let k = 0; k < 10; k += 1) {
        x += (rand() - 0.5) * 14;
        y += 3 + rand() * 11;
        context.lineTo(x, y);
      }
      context.stroke();
    }
    // One tile covers ~4 m, like the reference (5 across a 20 m wall).
    texture.repeat.set(5, 1.6);
  } else {
    context.fillStyle = "#f6f3ec";
    context.fillRect(0, 0, 256, 256);
    let seed = 13;
    for (let i = 0; i < 420; i += 1) {
      seed = (seed * 16807) % 2147483647;
      const x = seed % 256;
      seed = (seed * 16807) % 2147483647;
      const y = seed % 256;
      const shade = 190 + (seed % 50);
      context.fillStyle = `rgba(${shade}, ${shade}, ${shade}, 0.14)`;
      context.fillRect(x, y, 1, 1);
    }
    texture.repeat.set(2, 2);
  }

  return texture;
}

// Real light parquet (Poly Haven "Wood Floor", CC0) for the "parquet"
// floor finish: loaded imperatively (TextureLoader + state), never via
// useTexture — GalleryRoom sits outside every <Suspense> boundary, so a
// suspending load would blank the scene (the wall-text troika failure).
// Until the photo loads, the caller falls back to the procedural wood
// tile, so the floor never sits flat. One photo tile covers ~2 m of
// floor (eight wide planks per tile), so the planks read at a real
// scale in any room size.
function useParquetTexture(width: number, depth: number): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null);
  useEffect(() => {
    let alive = true;
    const loader = new TextureLoader();
    const tex = loader.load(
      "/textures/wood-floor.jpg",
      (loaded) => {
        if (!alive) return;
        loaded.colorSpace = SRGBColorSpace;
        loaded.wrapS = RepeatWrapping;
        loaded.wrapT = RepeatWrapping;
        loaded.anisotropy = 8;
        loaded.repeat.set(Math.max(1, width / 2), Math.max(1, depth / 2));
        loaded.needsUpdate = true;
        setTexture(loaded);
      },
      undefined,
      () => {
        // Load failed: keep the procedural wood tile.
      },
    );
    return () => {
      alive = false;
      tex.dispose();
    };
  }, [width, depth]);
  return texture;
}

function GallerySpotlight({ x, y, z, targetZ, targetPoint, color = "#fff0d6", intensity = 22, lightOn = true, castShadow = false, shadowMapSize = 1024 }: { x: number; y: number; z: number; targetZ: number; targetPoint?: [number, number, number]; color?: string; intensity?: number; lightOn?: boolean; castShadow?: boolean; shadowMapSize?: number }) {
  const target = useMemo(() => new Object3D(), []);
  useEffect(() => {
    if (targetPoint) target.position.set(targetPoint[0], targetPoint[1], targetPoint[2]);
    else target.position.set(x, 2.2, targetZ);
    return () => { target.removeFromParent(); };
  }, [target, targetPoint, targetZ, x]);

  return (
    <>
      <primitive object={target} />
      {lightOn && (
        <spotLight
          position={[x, y, z]}
          target={target}
          angle={0.45}
          penumbra={0.75}
          intensity={intensity}
          distance={14}
          color={color}
          castShadow={castShadow}
          shadow-mapSize-width={shadowMapSize}
          shadow-mapSize-height={shadowMapSize}
          shadow-bias={-0.0002}
          shadow-normalBias={0.02}
          shadow-camera-near={0.5}
          shadow-camera-far={14}
        />
      )}
      <mesh position={[x, y + 0.02, z]}>
        <cylinderGeometry args={[0.2, 0.24, 0.09, 16]} />
        <meshStandardMaterial color="#f4ead5" emissive="#f4ead5" emissiveIntensity={lightOn ? 0.65 : 0.25} />
      </mesh>
    </>
  );
}

// --- Photorealism pass (Nov 2026) -----------------------------------------
// The renderer is Three.js in the browser: ACES tone mapping, a locally
// generated environment map (RoomEnvironment + PMREM — no external HDR
// fetch), real-time PCFSoft shadows from the artwork spotlights, PBR
// surfaces and cheap contact decals. The white-gallery UI is untouched;
// only the 3D render quality changes.

// ACESFilmic tone mapping + PCFSoft shadow maps, applied to the
// renderer's GL context. Lives inside the Canvas so it can react when
// the quality setting (and therefore the exposure) changes mid-session.
function ToneMappingRig({ exposure }: { exposure: number }) {
  const { gl } = useThree();
  useEffect(() => {
    gl.toneMapping = ACESFilmicToneMapping;
    gl.toneMappingExposure = exposure;
    gl.shadowMap.type = PCFSoftShadowMap;
  }, [gl, exposure]);
  return null;
}

// Environment lighting without any network fetch: three's RoomEnvironment
// rendered once through a PMREM generator. Gives polished floors and
// metal frames their reflections and lifts the ambient light, so the
// flat ambientLight can be turned down while the env is on.
function LocalEnvironment({ enabled, intensity }: { enabled: boolean; intensity: number }) {
  const { gl, scene } = useThree();
  useEffect(() => {
    if (!enabled) {
      scene.environment = null;
      scene.environmentIntensity = 1;
      return;
    }
    const pmrem = new PMREMGenerator(gl);
    const envScene = new RoomEnvironment();
    const renderTarget = pmrem.fromScene(envScene, 0.04);
    scene.environment = renderTarget.texture;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
      scene.environmentIntensity = 1;
      renderTarget.dispose();
      pmrem.dispose();
    };
  }, [gl, scene, enabled, intensity]);
  return null;
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

function LoadedArtwork({ imageUrl, width, height, z = 0.083 }: { imageUrl: string; width: number; height: number; z?: number }) {
  const texture = useTexture(imageUrl);
  texture.colorSpace = SRGBColorSpace;
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
  walkable,
  onWalkTo,
  offsetX,
  offsetZ,
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
  // In walk mode a click walks up to the artwork instead of just selecting
  // it: stand 2.2 m in front of it, facing it. The click still selects the
  // artwork, so its details stay visible in the inspector / info card.
  walkable?: boolean;
  onWalkTo?: (point: Vector3, yaw: number) => void;
  offsetX?: number;
  // World offset along Z of the room the artwork hangs in (0 except
  // for the Stone Gallery halves) — the walk-to destination is in
  // world coordinates, like the X above.
  offsetZ?: number;
  dragged?: React.RefObject<boolean>;
  // Editor only: drag the artwork along its wall with the hand cursor,
  // and resize it from the lime handle at its bottom-right corner.
  editable?: boolean;
  onDragStart?: (id: string, mode: "move" | "resize", event: ThreeEvent<PointerEvent>) => void;
  onHoverChange?: (hover: { id: string; cursor: string } | null) => void;
}) {
  const [x, y, z] = artwork.position;
  const { width, height } = artworkSize(artwork);
  const interactive = editable && !walkable;
  // The frame finish chosen in the inspector (wood, metal, gold, black,
  // white, or none) or a custom Frame Studio configuration encoded in
  // the frame value. "None" hangs the print frameless on the wall.
  const frameValue = artwork.frame ?? "wood";
  const frame = resolveFrameSpec(frameValue);
  // Full framed size on the wall, for the selection outline and the
  // resize handle (wide frames and mats stick out past the artwork).
  const frameOuter = frameOuterSize(artwork);
  return (
    <group
      position={[x, y, z]}
      rotation={[0, artwork.rotation, 0]}
      scale={artwork.scale}
      onClick={(event) => {
        event.stopPropagation();
        if (dragged?.current) return;
        // Walk mode keeps its single click (walk up to the artwork). In
        // the editor a single click selects nothing — selection is a
        // double-click, so a click never gets in the way of orbiting.
        if (walkable && onWalkTo) {
          const nx = Math.sin(artwork.rotation);
          const nz = Math.cos(artwork.rotation);
          onWalkTo(
            new Vector3((offsetX ?? 0) + x + nx * 2.2, 0, (offsetZ ?? 0) + z + nz * 2.2),
            Math.atan2(nx, nz),
          );
          onSelect?.(artwork.id);
        }
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (walkable || dragged?.current) return;
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
        // Only a selected artwork drags: double-click it first, then drag.
        if (!interactive || !selected) return;
        event.stopPropagation();
        onDragStart?.(artwork.id, "move", event);
      }}
    >
      {frameValue !== "none" && <FrameAssembly width={width} height={height} spec={frame} selected={selected} />}
      {/* Frameless prints sit almost flat on the wall; framed works sit at
          the frame's front face, recessed inside a shadow box. */}
      {artwork.imageUrl ? (
        <LoadedArtwork imageUrl={artwork.imageUrl} width={width} height={height} z={frameValue === "none" ? 0.02 : -0.06 + frame.depth - frame.recess + 0.005} />
      ) : (
        <>
          <mesh position={[0, 0, frameValue === "none" ? 0.012 : -0.06 + frame.depth - frame.recess + 0.005]}>
            <planeGeometry args={[width, height]} />
            <meshStandardMaterial color={artwork.color} />
          </mesh>
          <mesh position={[-0.24 * (width / 1.82), 0.34 * (height / 2.12), frameValue === "none" ? 0.022 : -0.06 + frame.depth - frame.recess + 0.015]} rotation={[0, 0, -0.22]}>
            <circleGeometry args={[0.48 * Math.min(width / 1.82, height / 2.12), 48]} />
            <meshStandardMaterial color={artwork.accent} />
          </mesh>
          <mesh position={[0.28 * (width / 1.82), -0.34 * (height / 2.12), frameValue === "none" ? 0.024 : -0.06 + frame.depth - frame.recess + 0.017]} rotation={[0, 0, 0.12]}>
            <planeGeometry args={[0.8 * (width / 1.82), 0.32 * (height / 2.12)]} />
            <meshStandardMaterial color="#d7c6a9" />
          </mesh>
        </>
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

function WallWithOpening({
  x,
  depth,
  height,
  color,
  texture,
  opening,
  wallId,
  highlight,
  onWallClick,
  dragged,
  pbr,
}: {
  x: number;
  depth: number;
  height: number;
  color: string;
  texture?: Texture;
  opening: "door" | "window" | "none" | "solid";
  // Editor only: clicking the wall selects it for painting. The wall
  // glows faintly gold while selected.
  wallId?: WallId;
  highlight?: boolean;
  onWallClick?: (wallId: WallId) => void;
  dragged?: React.RefObject<boolean>;
  // PBR finish for the wall surface (from the room's wall texture).
  pbr?: { roughness: number; envMapIntensity: number };
}) {
  const wallThickness = 0.22;
  const materialProps = {
    color,
    map: texture,
    roughness: pbr?.roughness ?? 0.88,
    envMapIntensity: pbr?.envMapIntensity ?? 0.12,
    emissive: highlight ? "#ffffff" : "#000000",
    emissiveIntensity: highlight ? 0.16 : 0,
  } as const;
  // A drag (orbit) must not count as a click on the wall, and a single
  // click does not select a wall at all — only a double-click does.
  const handleDoubleClick = (event: ThreeEvent<MouseEvent>) => {
    if (!onWallClick || !wallId || dragged?.current) return;
    event.stopPropagation();
    onWallClick(wallId);
  };
  if (opening === "solid") {
    return (
      <mesh position={[x, height / 2, 0]} receiveShadow onDoubleClick={handleDoubleClick}>
        <boxGeometry args={[wallThickness, height, depth]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
    );
  }
  if (opening === "none") return null;
  const doorWidth = 1.65;
  const doorHeight = 2.5;
  const windowWidth = 3.2;
  const windowBottom = 1.65;
  const windowTop = Math.min(3.55, height - 0.7);
  const openingWidth = opening === "door" ? doorWidth : windowWidth;
  const openingBottom = opening === "door" ? 0 : windowBottom;
  const openingTop = opening === "door" ? doorHeight : windowTop;
  const sideDepth = (depth - openingWidth) / 2;

  return (
    <group>
      <mesh position={[x, height / 2, -(openingWidth + sideDepth) / 2]} receiveShadow onDoubleClick={handleDoubleClick}>
        <boxGeometry args={[wallThickness, height, sideDepth]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
      <mesh position={[x, height / 2, (openingWidth + sideDepth) / 2]} receiveShadow onDoubleClick={handleDoubleClick}>
        <boxGeometry args={[wallThickness, height, sideDepth]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
      {openingTop < height && (
        <mesh position={[x, (openingTop + height) / 2, 0]} receiveShadow onDoubleClick={handleDoubleClick}>
          <boxGeometry args={[wallThickness, height - openingTop, openingWidth]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
      )}
      {openingBottom > 0 && (
        <mesh position={[x, openingBottom / 2, 0]} receiveShadow onDoubleClick={handleDoubleClick}>
          <boxGeometry args={[wallThickness, openingBottom, openingWidth]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
      )}
      {opening === "door" ? (
        <group>
          {[-doorWidth / 2, doorWidth / 2].map((z) => (
            <mesh key={z} position={[x, doorHeight / 2, z]}>
              <boxGeometry args={[wallThickness * 1.8, doorHeight, 0.1]} />
              <meshStandardMaterial color="#73543d" />
            </mesh>
          ))}
          <mesh position={[x, doorHeight, 0]}>
            <boxGeometry args={[wallThickness * 1.8, 0.12, doorWidth + 0.1]} />
            <meshStandardMaterial color="#73543d" />
          </mesh>
        </group>
      ) : (
        // A real gallery window: white frame and muntins around the
        // opening, a bright sky-bright glass, and a sill into the room.
        // The glass itself is emissive (the sky) — no separate sky plane,
        // so a shared wall between two rooms never shows one room's sky
        // floating inside the other.
        <group>
          {/* Glass: bright and sky-lit, the daylight cue. */}
          <mesh
            position={[x - Math.sign(x) * 0.02, (windowBottom + windowTop) / 2, 0]}
            rotation={[0, Math.PI / 2, 0]}
          >
            <planeGeometry args={[windowWidth, windowTop - windowBottom]} />
            <meshPhysicalMaterial color="#dceeff" transparent opacity={0.4} roughness={0.08} emissive="#bcd8ff" emissiveIntensity={0.7} side={DoubleSide} />
          </mesh>
          {/* White frame around the opening, proud of the wall face. */}
          {[-1, 1].map((side) => (
            <mesh key={`jamb-${side}`} position={[x - Math.sign(x) * 0.13, (windowBottom + windowTop) / 2, side * (windowWidth / 2 + 0.05)]}>
              <boxGeometry args={[0.08, windowTop - windowBottom + 0.1, 0.1]} />
              <meshStandardMaterial color="#f5f2eb" roughness={0.7} />
            </mesh>
          ))}
          {[-1, 1].map((side) => (
            <mesh key={`rail-${side}`} position={[x - Math.sign(x) * 0.13, (side > 0 ? windowTop : windowBottom) + side * 0.05, 0]}>
              <boxGeometry args={[0.08, 0.1, windowWidth + 0.2]} />
              <meshStandardMaterial color="#f5f2eb" roughness={0.7} />
            </mesh>
          ))}
          {/* Muntins: one vertical, one horizontal divider across the glass. */}
          <mesh position={[x - Math.sign(x) * 0.02, (windowBottom + windowTop) / 2, 0]}>
            <boxGeometry args={[0.04, windowTop - windowBottom, 0.05]} />
            <meshStandardMaterial color="#f5f2eb" roughness={0.7} />
          </mesh>
          <mesh position={[x - Math.sign(x) * 0.02, (windowBottom + windowTop) / 2, 0]}>
            <boxGeometry args={[0.04, 0.05, windowWidth]} />
            <meshStandardMaterial color="#f5f2eb" roughness={0.7} />
          </mesh>
          {/* Sill: a white ledge below the window, into the room. */}
          <mesh position={[x - Math.sign(x) * 0.22, windowBottom - 0.03, 0]}>
            <boxGeometry args={[0.3, 0.06, windowWidth + 0.3]} />
            <meshStandardMaterial color="#f5f2eb" roughness={0.7} />
          </mesh>
        </group>
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
function measureWallKey(artwork: Artwork, width: number, depth: number): MeasureWall | null {
  const [x, , z] = artwork.position;
  const inset = 0.28;
  const distances: [MeasureWall, number][] = [
    ["back", Math.abs(z - (-depth / 2 + inset))],
    ["front", Math.abs(z - (depth / 2 - inset))],
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
}: {
  artworks: Artwork[];
  selectedId?: string;
  width: number;
  depth: number;
}) {
  const guides = useMemo(() => {
    const byWall = new Map<MeasureWall, Artwork[]>();
    for (const artwork of artworks) {
      const wall = measureWallKey(artwork, width, depth);
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
          if (wall === "back") return [v, y, -depth / 2 + 0.28 + wallOffset];
          if (wall === "front") return [v, y, depth / 2 - 0.28 - wallOffset];
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
      const wall = measureWallKey(selectedArtwork, width, depth);
      if (wall) {
        const [x, y, z] = selectedArtwork.position;
        const rotation: [number, number, number] = wall === "front" ? [0, Math.PI, 0] : wall === "left" ? [0, Math.PI / 2, 0] : wall === "right" ? [0, -Math.PI / 2, 0] : [0, 0, 0];
        const base: [number, number, number] =
          wall === "back" ? [x, 0, -depth / 2 + 0.28 + wallOffset]
          : wall === "front" ? [x, 0, depth / 2 - 0.28 - wallOffset]
          : wall === "left" ? [-width / 2 + 0.28 + wallOffset, 0, z]
          : [width / 2 - 0.28 - wallOffset, 0, z];
        lines.push(base[0], 0, base[2], base[0], y, base[2]);
        labels.push({ text: `${Math.round(y * 100)} cm`, position: [base[0], y / 2, base[2]], rotation });
      }
    }
    return { lines: new Float32Array(lines), labels };
  }, [artworks, selectedId, width, depth]);
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
  walkable,
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
  walkable?: boolean;
  dragged?: React.RefObject<boolean>;
  editable?: boolean;
  onDragStart?: (id: string, mode: "move" | "resize", event: ThreeEvent<PointerEvent>) => void;
  onHoverChange?: (hover: { id: string; cursor: string } | null) => void;
  quality?: RenderQuality;
}) {
  const { height } = roomLayouts[room.layout];
  const interactive = editable && !walkable;
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
  // Selection outline and resize-handle placement, per type.
  const outline: { size: [number, number, number]; y: number; handle: [number, number, number] } =
    element.type === "partition"
      ? { size: [element.length + 0.3, height - 0.2, 0.8], y: (height - 0.25) / 2, handle: [element.length / 2 + 0.18, 0.7, 0.12] }
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
        event.stopPropagation();
        if (dragged?.current) return;
        // Outside the editor a single click still selects (public view).
        // In the editor only a double-click selects.
        if (!editable) onSelect?.(element.id);
      }}
      onDoubleClick={(event) => {
        event.stopPropagation();
        if (dragged?.current) return;
        if (!editable) return;
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
        // Only a selected element drags: double-click it first, then drag.
        if (!interactive || !selected) return;
        event.stopPropagation();
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
              freestanding movable wall from the reference photos. */}
          {[-1, 1].map((side) => (
            <mesh key={side} position={[side * (element.length / 2 - 0.3), 0.07, 0]} castShadow>
              <boxGeometry args={[0.1, 0.14, 0.45]} />
              <meshStandardMaterial color="#6b675f" roughness={0.7} />
            </mesh>
          ))}
          <mesh position={[0, 0.17, 0]} castShadow>
            <boxGeometry args={[element.length + 0.2, 0.1, 0.6]} />
            <meshStandardMaterial color={element.color} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.22 + (height - 0.35) / 2, 0]} receiveShadow castShadow>
            <boxGeometry args={[element.length, height - 0.35, 0.12]} />
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

// Built-in furniture of each reference room, derived from the layout only
// (nothing stored per exhibition). Suspended panels, plinths and rails live
// inside the room; the curved wall itself is built in GalleryRoom because
// it replaces the front wall.
function RoomFeatures({
  layout,
  width,
  depth,
  height,
  panelTexture,
  panelColor,
  panelPBR,
  contactDecals,
  shadows,
}: {
  layout: RoomLayout;
  width: number;
  depth: number;
  height: number;
  // Freestanding panels reuse the wall's surface map (at panel scale),
  // colour and PBR finish, so they read as the room's own architecture.
  panelTexture?: Texture | null;
  panelColor?: string;
  panelPBR?: { roughness: number; envMapIntensity: number };
  contactDecals?: boolean;
  // Render quality: whether the skylight's daylight casts real shadows.
  shadows?: boolean;
}) {
  // Target of the skylight's daylight spot: the floor centre, so the
  // light falls straight down through the verrière. Created here (top
  // of the component, before the layout branches) so the hooks run on
  // every render whatever the layout.
  const skyTarget = useMemo(() => new Object3D(), []);
  useEffect(() => {
    skyTarget.position.set(0, 0, 0);
    return () => {
      skyTarget.removeFromParent();
    };
  }, [skyTarget]);
  // Skylight glazing (gallery-skylight only): a soft sky gradient for
  // the verrière panel, so it reads as sky through glass — deeper blue
  // at one end, pale near the horizon — not a flat white panel.
  const skyTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 128;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const gradient = ctx.createLinearGradient(0, 0, 0, 64);
    gradient.addColorStop(0, "#7fb2e5");
    gradient.addColorStop(0.55, "#a9c8e8");
    gradient.addColorStop(1, "#dcebf7");
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 64);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);
  // Daylight pool (gallery-skylight only): a soft-edged bright
  // rectangle that lands on the parquet under the verrière, the size
  // of the skylight opening grown by the light's spread. A point
  // spotlight alone projects a circular cone, so this decal gives the
  // pool its rectangular read; the real spotlight underneath makes it
  // bright. Additive, so it reads as light on the wood, not paint.
  // The falloff is rectangular (distance to the inner rectangle's
  // edge), not radial, so the pool keeps the skylight's shape.
  const poolTexture = useMemo(() => {
    if (typeof document === "undefined") return null;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 192;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    const image = ctx.createImageData(256, 192);
    const innerX0 = 34;
    const innerX1 = 222;
    const innerY0 = 26;
    const innerY1 = 166;
    const feather = 26;
    for (let y = 0; y < 192; y += 1) {
      for (let x = 0; x < 256; x += 1) {
        const dx = x < innerX0 ? innerX0 - x : x > innerX1 ? x - innerX1 : 0;
        const dy = y < innerY0 ? innerY0 - y : y > innerY1 ? y - innerY1 : 0;
        const dist = Math.max(dx, dy);
        const t = Math.max(0, Math.min(1, 1 - dist / feather));
        const alpha = Math.round(0.85 * t * t * (3 - 2 * t) * 255);
        const i = (y * 256 + x) * 4;
        image.data[i] = 255;
        image.data[i + 1] = 244;
        image.data[i + 2] = 214;
        image.data[i + 3] = alpha;
      }
    }
    ctx.putImageData(image, 0, 0);
    const texture = new CanvasTexture(canvas);
    texture.colorSpace = SRGBColorSpace;
    return texture;
  }, []);
  // Recessed spots (gallery-skylight only): their positions, in coffer
  // centres, and one target each — straight down at the floor below the
  // fixture, so each warm pool lands under its own spot.
  const recessedSpots = useMemo(
    () => [
      { x: -5.4, z: -2.4 },
      { x: 4.2, z: -2.4 },
      { x: -5.4, z: 2.4 },
      { x: 4.2, z: 2.4 },
    ],
    [],
  );
  const recessedTargets = useMemo(() => {
    return recessedSpots.map(({ x, z }) => {
      const target = new Object3D();
      target.position.set(x, 0, z);
      return target;
    });
  }, [recessedSpots]);
  useEffect(() => {
    return () => {
      recessedTargets.forEach((target) => target.removeFromParent());
    };
  }, [recessedTargets]);
  // Arched niche (Stone Gallery only): a flat arched panel, darker
  // stone, on the back wall. Fixed shape — the same 3.2 m wide, 4.6 m
  // tall arch as the Three.js reference room.
  const stoneNicheShape = useMemo(() => {
    const niche = new Shape();
    niche.moveTo(-1.6, 0);
    niche.lineTo(-1.6, 3);
    niche.absarc(0, 3, 1.6, Math.PI, 0, true);
    niche.lineTo(1.6, 0);
    niche.lineTo(-1.6, 0);
    return niche;
  }, []);
  // Rubble (Stone Gallery only): fourteen small blocks at the foot of
  // the left wall. Seeded, so the pile looks the same on every render.
  const stoneRubble = useMemo(() => {
    let seed = 23;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    return Array.from({ length: 14 }, () => {
      const sx = 0.4 + rand() * 0.5;
      const sy = 0.3 + rand() * 0.3;
      const sz = 0.4 + rand() * 0.5;
      return {
        size: [sx, sy, sz] as [number, number, number],
        position: [
          -width / 2 + 0.4 + rand() * 0.7,
          sy / 2,
          -2 + rand() * 4,
        ] as [number, number, number],
        rotation: [rand() * 0.4, rand() * 3, rand() * 0.4] as [number, number, number],
      };
    });
  }, [width]);
  if (layout === "cube") {
    // Ceiling track rails running the depth of the room, with spot heads.
    return (
      <group>
        {[-4.5, 0, 4.5].map((x) => (
          <group key={x}>
            <mesh position={[x, height - 0.35, 0]}>
              <boxGeometry args={[0.07, 0.07, depth - 1]} />
              <meshStandardMaterial color="#2b2b28" roughness={0.6} metalness={0.3} />
            </mesh>
            {[-depth / 4, 0, depth / 4].map((z) => (
              <mesh key={z} position={[x, height - 0.45, z]}>
                <cylinderGeometry args={[0.09, 0.12, 0.18, 12]} />
                <meshStandardMaterial color="#3a3a36" roughness={0.5} metalness={0.4} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    );
  }
  if (layout === "grand-hall") {
    // Three white panels suspended from the ceiling by thin rods, plus two
    // plinths carrying dark abstract figures.
    return (
      <group>
        {[-7, 0, 7].map((x) => (
          <group key={x}>
            <mesh position={[x, 2.6, -1]}>
              <boxGeometry args={[3.2, 3.0, 0.12]} />
              <meshStandardMaterial color="#f8f6f0" roughness={0.85} />
            </mesh>
            {[-1.3, 1.3].map((dx) => (
              <mesh key={dx} position={[x + dx, (height + 4.1) / 2, -1]}>
                <cylinderGeometry args={[0.02, 0.02, height - 4.1, 6]} />
                <meshStandardMaterial color="#555550" roughness={0.5} metalness={0.5} />
              </mesh>
            ))}
          </group>
        ))}
        {[-4, 4].map((x) => (
          <group key={x} position={[x, 0, 2.5]}>
            <mesh position={[0, 0.55, 0]}>
              <boxGeometry args={[0.9, 1.1, 0.9]} />
              <meshStandardMaterial color="#f2efe8" roughness={0.85} />
            </mesh>
            <mesh position={[0, 1.55, 0]}>
              <capsuleGeometry args={[0.16, 0.7, 6, 12]} />
              <meshStandardMaterial color="#33332f" roughness={0.4} metalness={0.2} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  if (layout === "totem-studio") {
    // Works suspended from the ceiling by thin cables, plus two plinths.
    return (
      <group>
        {[
          { x: -5, z: -2 },
          { x: 0, z: 0.5 },
          { x: 5, z: -2 },
          { x: -2.5, z: 2.5 },
        ].map(({ x, z }, index) => (
          <group key={index} position={[x, 0, z]}>
            <mesh position={[0, 2.2, 0]}>
              <boxGeometry args={[1.3, 1.6, 0.08]} />
              <meshStandardMaterial color={["#8a9b88", "#bb8365", "#8796a9", "#a89a7a"][index]} roughness={0.9} />
            </mesh>
            <mesh position={[0, (height + 3.0) / 2, 0]}>
              <cylinderGeometry args={[0.015, 0.015, height - 3.0, 6]} />
              <meshStandardMaterial color="#555550" roughness={0.5} metalness={0.5} />
            </mesh>
          </group>
        ))}
        {[-6, 6].map((x) => (
          <mesh key={x} position={[x, 0.5, 3]}>
            <boxGeometry args={[0.9, 1.0, 0.9]} />
            <meshStandardMaterial color="#f2efe8" roughness={0.85} />
          </mesh>
        ))}
      </group>
    );
  }
  // --- Ceiling architectures from the reference photos (November 2026) ---
  if (isStoneLayout(layout)) {
    // The Stone Gallery (Three.js reference room "Galerie en pierre"):
    // dark timber beams across the ceiling, an arched niche on the back
    // wall, rubble at the foot of the left wall, a concrete plinth with
    // four small white frames, and eight track-light fixtures. Fixed
    // architecture — the room's colours, dimensions and light stay
    // editable in the inspector. The round-arched dividing wall itself
    // is a partition (shape "arch"), rendered by ArchPartitionWall.
    //
    // The single pre-split room ("stone-gallery") renders the whole
    // set, as before. When the gallery is split in two, each half
    // renders only the pieces that stood in it in the reference room:
    // the niche is on the back wall (back half), the rubble and the
    // plinth are in the front part (front half), the track lights are
    // split by their z, and the beams run the depth of whichever half
    // they are in. Positions are LOCAL to the half (front half centre
    // global z = +5.5, back half −6.5).
    const isFront = layout === "stone-gallery-front";
    const isBack = layout === "stone-gallery-back";
    const beamXs: number[] = [];
    for (let x = -width / 2 + 1; x <= width / 2 - 1 + 0.01; x += 3) {
      beamXs.push(Math.round(x * 100) / 100);
    }
    const nicheX = Math.min(5, width / 2 - 2);
    const plinthX = Math.min(6.2, width / 2 - 1.5);
    // The plinth stood at global z = 4: local z = −1.5 in the front
    // half (centre +5.5); in the single room it is local z = 4.
    const plinthZ = isFront ? -1.5 : Math.min(4, depth / 2 - 1);
    // Track lights by their global z: the fixtures at global z = 6 and
    // 2 belong to the front half (local +0.5 and −3.5), the ones at
    // global z = −5 to the back half (local +1.5); the single room
    // keeps all eight at their original local z.
    const trackLights: [number, number][] = (isFront
      ? [[-4, 0.5], [0, 0.5], [4, 0.5], [-4, -3.5], [4, -3.5]]
      : isBack
        ? [[-5, 1.5], [0, 1.5], [5, 1.5]]
        : [[-4, 6], [0, 6], [4, 6], [-5, -5], [0, -5], [5, -5], [-4, 2], [4, 2]]
    ).map(([x, z]) => [
      Math.max(-width / 2 + 1, Math.min(width / 2 - 1, x)),
      Math.max(-depth / 2 + 1, Math.min(depth / 2 - 1, z)),
    ]);
    // Rubble at the foot of the left wall. In the single room it sits
    // at global z −2…+2; in the front half the same global span is
    // local z −7.5…−3.5, clamped to the half (−6.5…−3.5, by the arch).
    // The back half has none.
    const rubble = isBack
      ? []
      : isFront
        ? stoneRubble.map((block) => ({
            ...block,
            position: [
              block.position[0],
              block.position[1],
              Math.max(-depth / 2, Math.min(-depth / 2 + 3, block.position[2] - 5.5)),
            ] as [number, number, number],
          }))
        : stoneRubble;
    return (
      <group>
        {/* Dark timber beams across the ceiling, every 3 m. */}
        {beamXs.map((x) => (
          <mesh key={`beam-${x}`} position={[x, height - 0.2, 0]} castShadow>
            <boxGeometry args={[0.35, 0.4, depth]} />
            <meshStandardMaterial color="#4a3528" roughness={0.8} />
          </mesh>
        ))}
        {/* Arched niche on the back wall (darker stone), behind the
            artwork that hangs over it. It sits 0.05 m off the wall's
            front face (the wall is a 0.25 m box, so its face is at
            -depth/2 + 0.125) — at -depth/2 + 0.05 it was buried inside
            the wall and invisible. It receives the artwork's shadow.
            The niche is on the back wall, so only the single room and
            the back half have one. */}
        {!isFront && (
        <mesh position={[nicheX, 0, -depth / 2 + 0.175]} receiveShadow>
          <shapeGeometry args={[stoneNicheShape]} />
          <meshStandardMaterial color="#7d7164" roughness={1} />
        </mesh>
        )}
        {/* Rubble at the foot of the left wall. */}
        {rubble.map((block, i) => (
          <mesh key={`rubble-${i}`} position={block.position} rotation={block.rotation} castShadow>
            <boxGeometry args={block.size} />
            <meshStandardMaterial color="#9a8f7c" roughness={1} />
          </mesh>
        ))}
        {/* Concrete plinth with four small white frames. The plinth
            stood in the front part, so only the single room and the
            front half have one. */}
        {!isBack && (
        <group position={[plinthX, 0, plinthZ]}>
          <mesh position={[0, 0.25, 0]} castShadow receiveShadow>
            <boxGeometry args={[2.6, 0.5, 1.5]} />
            <meshStandardMaterial color="#8d8a82" roughness={1} />
          </mesh>
          {[5.4, 5.9, 6.4, 6.9].map((fx) => (
            <mesh key={fx} position={[fx - 6.2, 0.78, -0.1]} rotation={[-0.25, 0, 0]} castShadow>
              <boxGeometry args={[0.4, 0.5, 0.03]} />
              <meshStandardMaterial color="#e8e8e8" metalness={0.4} roughness={0.4} />
            </mesh>
          ))}
        </group>
        )}
        {/* Track-light fixtures: a thin drop wire and a glowing bar. */}
        {trackLights.map(([x, z], i) => (
          <group key={`track-${i}`}>
            <mesh position={[x, height - 0.6, z]}>
              <cylinderGeometry args={[0.01, 0.01, 1.2, 4]} />
              <meshBasicMaterial color="#222222" />
            </mesh>
            <mesh position={[x, height - 1.2, z]}>
              <boxGeometry args={[1.3, 0.07, 0.14]} />
              <meshStandardMaterial color="#ffffff" emissive="#ffffff" emissiveIntensity={1} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  if (layout === "gallery-skylight") {
    // The reference room: a white coffered ceiling with one central
    // skylight (verrière). White beams on a 2.4 m grid form the
    // coffers; the beams stop at the skylight opening, which is framed
    // by a white curb and filled with a bright sky panel. A real
    // spotlight shines down through it, so daylight pools on the
    // parquet. The beams are real 3D relief, not a flat photo.
    const beamY = height - 0.38;
    const beamW = 0.18;
    const beamD = 0.28;
    const spacing = 2.4;
    const skyX0 = -1.8;
    const skyX1 = 1.8;
    const skyZ0 = -1.2;
    const skyZ1 = 1.2;
    const xs: number[] = [];
    for (let x = -width / 2 + spacing; x < width / 2; x += spacing) xs.push(x);
    const zs: number[] = [];
    for (let z = -depth / 2 + spacing; z < depth / 2; z += spacing) zs.push(z);
    // Split a beam run into the segments that stop at the skylight
    // opening, so no beam crosses the verrière.
    const splitRun = (from: number, to: number, lo: number, hi: number): [number, number][] => {
      if (hi <= from || lo >= to) return [[from, to]];
      const segs: [number, number][] = [];
      if (lo > from) segs.push([from, lo]);
      if (hi < to) segs.push([hi, to]);
      return segs.filter(([a, b]) => b - a > 0.05);
    };
    // X-beams (along X) at each grid z, split where they cross the skylight.
    const xBeams: { z: number; from: number; to: number }[] = [];
    zs.forEach((z) => {
      if (z > skyZ0 && z < skyZ1) {
        splitRun(-width / 2, width / 2, skyX0, skyX1).forEach(([from, to]) => xBeams.push({ z, from, to }));
      } else {
        xBeams.push({ z, from: -width / 2, to: width / 2 });
      }
    });
    // Z-beams (along Z) at each grid x, split where they cross the skylight.
    const zBeams: { x: number; from: number; to: number }[] = [];
    xs.forEach((x) => {
      if (x > skyX0 && x < skyX1) {
        splitRun(-depth / 2, depth / 2, skyZ0, skyZ1).forEach(([from, to]) => zBeams.push({ x, from, to }));
      } else {
        zBeams.push({ x, from: -depth / 2, to: depth / 2 });
      }
    });
    return (
      <group>
        {xBeams.map(({ z, from, to }, i) => (
          <mesh key={`xb-${i}`} position={[(from + to) / 2, beamY, z]}>
            <boxGeometry args={[to - from, beamD, beamW]} />
            <meshStandardMaterial color="#f5f2eb" roughness={0.85} />
          </mesh>
        ))}
        {zBeams.map(({ x, from, to }, i) => (
          <mesh key={`zb-${i}`} position={[x, beamY, (from + to) / 2]}>
            <boxGeometry args={[beamW, beamD, to - from]} />
            <meshStandardMaterial color="#f5f2eb" roughness={0.85} />
          </mesh>
        ))}
        {/* Curb: a white frame around the skylight opening, finishing
            the cut edge of the coffers (same white as the beams, so it
            reads as one frame; slightly deeper, so it lips below them). */}
        <mesh position={[0, beamY, skyZ0]}>
          <boxGeometry args={[skyX1 - skyX0 + 0.28, beamD + 0.04, 0.14]} />
          <meshStandardMaterial color="#f5f2eb" roughness={0.85} />
        </mesh>
        <mesh position={[0, beamY, skyZ1]}>
          <boxGeometry args={[skyX1 - skyX0 + 0.28, beamD + 0.04, 0.14]} />
          <meshStandardMaterial color="#f5f2eb" roughness={0.85} />
        </mesh>
        <mesh position={[skyX0, beamY, 0]}>
          <boxGeometry args={[0.14, beamD + 0.04, skyZ1 - skyZ0]} />
          <meshStandardMaterial color="#f5f2eb" roughness={0.85} />
        </mesh>
        <mesh position={[skyX1, beamY, 0]}>
          <boxGeometry args={[0.14, beamD + 0.04, skyZ1 - skyZ0]} />
          <meshStandardMaterial color="#f5f2eb" roughness={0.85} />
        </mesh>
        {/* Sky: a glazed verrière, not a flat white panel — a soft sky
            gradient (deeper blue to pale) behind white muntins, so it
            reads as a window with glass panes. The muntins sit just
            below the panel, dividing it into six panes. */}
        <mesh position={[0, height - 0.25, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <planeGeometry args={[skyX1 - skyX0, skyZ1 - skyZ0]} />
          <meshStandardMaterial
            map={skyTexture ?? undefined}
            color="#ffffff"
            emissive="#ffffff"
            emissiveMap={skyTexture ?? undefined}
            emissiveIntensity={1.1}
            side={DoubleSide}
          />
        </mesh>
        {[-0.6, 0.6].map((x) => (
          <mesh key={`mull-v-${x}`} position={[x, height - 0.27, 0]}>
            <boxGeometry args={[0.05, 0.03, skyZ1 - skyZ0]} />
            <meshStandardMaterial color="#f5f2eb" roughness={0.85} />
          </mesh>
        ))}
        <mesh position={[0, height - 0.27, 0]}>
          <boxGeometry args={[skyX1 - skyX0, 0.03, 0.05]} />
          <meshStandardMaterial color="#f5f2eb" roughness={0.85} />
        </mesh>
        {/* Daylight: a real spotlight falling straight down through the
            verrière, so a pool of daylight lands on the parquet. Narrower
            and much stronger than before (the old wide, soft cone washed
            out against the ambient and left no distinct pool), with a
            harder edge so the pool reads. */}
        <primitive object={skyTarget} />
        <spotLight
          position={[0, height - 0.3, 0]}
          target={skyTarget}
          angle={0.4}
          penumbra={0.45}
          intensity={180}
          distance={16}
          color="#e8f0ff"
          castShadow={shadows ?? true}
          shadow-mapSize-width={1024}
          shadow-mapSize-height={1024}
          shadow-bias={-0.0002}
          shadow-normalBias={0.02}
          shadow-camera-near={0.5}
          shadow-camera-far={16}
        />
        {/* Rectangular daylight pool on the parquet, under the verrière:
            the size of the skylight opening grown by the light's spread.
            A point spotlight projects a circular cone, so this soft
            decal gives the pool the skylight's rectangular shape; the
            brightened spotlight above makes it real light. */}
        {poolTexture && (
          <mesh position={[0, 0.012, 0]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
            <planeGeometry args={[4.4, 3.0]} />
            <meshBasicMaterial
              map={poolTexture}
              transparent
              opacity={0.55}
              blending={AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        )}
        {/* Recessed ceiling spots in the coffers: the room's "Ceiling
            spotlights · Spot Warm" setting now has visible luminaires —
            a dark housing ring and a warm glowing lens set into the
            coffer ceiling, each with its own warm spotlight, so the
            ceiling is never bare and warm pools land on the parquet.
            They sit in coffer centres (never on a beam, never crossing
            one), around the skylight. */}
        {recessedSpots.map(({ x, z }, i) => (
          <group key={`recessed-${x}-${z}`}>
            <primitive object={recessedTargets[i]} />
            <mesh position={[x, height - 0.26, z]}>
              <cylinderGeometry args={[0.1, 0.1, 0.04, 20]} />
              <meshStandardMaterial color="#2b2b28" roughness={0.6} metalness={0.3} />
            </mesh>
            <mesh position={[x, height - 0.29, z]}>
              <cylinderGeometry args={[0.065, 0.065, 0.02, 20]} />
              <meshStandardMaterial color="#ffd9a0" emissive="#ffcf8a" emissiveIntensity={1.6} />
            </mesh>
            <spotLight
              position={[x, height - 0.3, z]}
              target={recessedTargets[i]}
              angle={0.5}
              penumbra={0.6}
              intensity={28}
              distance={9}
              color="#ffd9a0"
            />
          </group>
        ))}
      </group>
    );
  }
  return null;
}

// The Stone Gallery arch opening: 4 m wide (radius 2 m) with its
// springing at 3.4 m. Scaled down if the room is too low to hold it —
// the same scale the arch wall renderer and the walk collision use, so
// the opening the visitor walks through matches the one they see.
function archScale(height: number): number {
  const fullApex = 3.4 + 2;
  return height - 0.3 < fullApex ? Math.max(0.3, (height - 0.3) / fullApex) : 1;
}

// A partition wall pierced by a round arch (the Stone Gallery dividing
// wall): a full-height stone wall with a real arched opening, not a
// solid panel. The opening is 4 m wide with its springing at 3.4 m
// (radius 2 m, apex 5.4 m), from the Three.js reference room; it scales
// down if the room is too low to hold it. The wall is 0.7 m thick, like
// the reference, and centred on the partition's (x, z) like the
// rectangular partitions, so the editor's position / length /
// orientation controls keep working on it.
function ArchPartitionWall({
  wall,
  height,
  wallTexture,
  wallColor,
  wallPBR,
  highlight,
  editable,
  onWallSelect,
  dragged,
}: {
  wall: PartitionWall;
  height: number;
  wallTexture?: Texture | null;
  wallColor: string;
  wallPBR: { roughness: number; envMapIntensity: number };
  highlight: boolean;
  editable?: boolean;
  onWallSelect?: (id: string) => void;
  dragged?: React.RefObject<boolean>;
}) {
  const shape = useMemo(() => {
    const half = wall.length / 2;
    const scale = archScale(height);
    const springing = 3.4 * scale;
    const radius = 2 * scale;
    const outline = new Shape();
    outline.moveTo(-half, 0);
    outline.lineTo(half, 0);
    outline.lineTo(half, height);
    outline.lineTo(-half, height);
    outline.lineTo(-half, 0);
    const hole = new Path();
    hole.moveTo(-radius, 0);
    hole.lineTo(-radius, springing);
    hole.absarc(0, springing, radius, Math.PI, 0, true);
    hole.lineTo(radius, 0);
    hole.lineTo(-radius, 0);
    outline.holes.push(hole);
    return outline;
  }, [wall.length, height]);
  // The extrude UVs are in metres (shape coordinates), not 0–1, so the
  // shared wall texture — repeated 5×1.6 for the box walls — would tile
  // far too densely here. Clone it with a 0.25 repeat, like the
  // reference (wallMat(0.25, 0.25)): one tile covers ~4 m.
  const archTexture = useMemo(() => {
    if (!wallTexture) return undefined;
    const tex = wallTexture.clone();
    tex.repeat.set(0.25, 0.25);
    tex.needsUpdate = true;
    return tex;
  }, [wallTexture]);
  useEffect(() => () => {
    archTexture?.dispose();
  }, [archTexture]);
  // The extrusion runs 0 → 0.7 m along local +z; offset the mesh so the
  // wall is centred on (x, z). For a vertical wall the mesh is rotated
  // 90°, which maps local +z onto world +x.
  const position: [number, number, number] =
    wall.orientation === "horizontal" ? [wall.x, 0, wall.z - 0.35] : [wall.x - 0.35, 0, wall.z];
  const rotation: [number, number, number] =
    wall.orientation === "horizontal" ? [0, 0, 0] : [0, Math.PI / 2, 0];
  return (
    <mesh
      position={position}
      rotation={rotation}
      receiveShadow
      castShadow
      onDoubleClick={(event) => {
        if (!editable || !onWallSelect || dragged?.current) return;
        event.stopPropagation();
        onWallSelect(wall.id);
      }}
    >
      <extrudeGeometry args={[shape, { depth: 0.7, bevelEnabled: false }]} />
      <meshStandardMaterial
        color={wallColor}
        map={archTexture}
        roughness={wallPBR.roughness}
        envMapIntensity={wallPBR.envMapIntensity}
        emissive={highlight ? "#ffffff" : "#000000"}
        emissiveIntensity={highlight ? 0.16 : 0}
      />
    </mesh>
  );
}

function GalleryRoom({
  room,
  offsetX,
  offsetZ,
  hideBackWall,
  hideFrontWall,
  artworks,
  selectedId,
  onSelect,
  walkable,
  onFloorClick,
  onWalkTo,
  dragged,
  leftOpening,
  rightOpening,
  entrance,
  editable,
  onDragStart,
  onHoverChange,
  selectedElementId,
  onSelectElement,
  onElementDragStart,
  onElementHover,
  selectedWallId,
  onWallSelect,
  showGrid,
  showMeasure,
  multiSelectedIds,
  quality,
}: {
  room: GalleryRoom;
  offsetX: number;
  // World offset along Z (0 for every room except the Stone Gallery
  // halves, which stack along Z — see roomPlanOffsets). Defaults to 0.
  offsetZ?: number;
  // The Stone Gallery halves share the arched dividing wall as their
  // common boundary: the front room hides its back wall (the arch is
  // the back boundary) and the back room hides its front wall (the
  // same arch, rendered once by the front room, is the front boundary).
  hideBackWall?: boolean;
  hideFrontWall?: boolean;
  artworks: Artwork[];
  selectedId?: string;
  onSelect?: (id: string, additive?: boolean) => void;
  walkable: boolean;
  onFloorClick?: (point: Vector3) => void;
  onWalkTo?: (point: Vector3, yaw: number) => void;
  dragged?: React.RefObject<boolean>;
  leftOpening: "door" | "window" | "none" | "solid";
  rightOpening: "door" | "window" | "solid";
  entrance: boolean;
  editable?: boolean;
  onDragStart?: (id: string, mode: "move" | "resize", event: ThreeEvent<PointerEvent>) => void;
  onHoverChange?: (hover: { id: string; cursor: string } | null) => void;
  // Elements (editor): selection, drag and wall painting.
  selectedElementId?: string;
  onSelectElement?: (id: string, additive?: boolean) => void;
  onElementDragStart?: (id: string, mode: "move" | "resize", event: ThreeEvent<PointerEvent>) => void;
  onElementHover?: (hover: { id: string; cursor: string } | null) => void;
  selectedWallId?: string | null;
  onWallSelect?: (wallId: WallId | string) => void;
  // 3D builder (editor): 0.5 m floor grid and measurement guides.
  showGrid?: boolean;
  showMeasure?: boolean;
  // 3D builder (editor): extra ids of a multi-selection, so every
  // selected item shows its outline and resize handle.
  multiSelectedIds?: string[];
  // Photorealism: render-quality tier driving shadows, env and decals.
  quality?: RenderQuality;
}) {
  const { width, depth, height } = roomLayouts[room.layout];
  const wallZ = -depth / 2;
  // Per-wall paint: a painted wall keeps its own colour, the rest use the
  // room's back / side wall colours.
  const paint = room.wallPaint ?? {};
  const backColor = paint.back ?? room.wallColor;
  const leftColor = paint.left ?? room.sideWallColor;
  const rightColor = paint.right ?? room.sideWallColor;
  const frontColor = paint.front ?? room.sideWallColor;
  const lights = LIGHT_PRESETS[room.lightType ?? "spot-warm"];
  // Photorealism: PBR finishes per surface (the procedural canvas
  // textures stay the colour maps) and the quality tier's shadow sizes.
  const qualityCfg = RENDER_QUALITY_CONFIG[quality ?? "high"];
  const floorPBR = surfacePBR(room.floorTexture, "floor");
  const wallPBR = surfacePBR(room.wallTexture, "wall");
  const ceilingPBR = surfacePBR(room.ceilingTexture, "ceiling");
  const wallHighlight = (wallId: string) => selectedWallId === wallId;
  const handleWallClick = (wallId: WallId | string) => {
    if (!editable || !onWallSelect || dragged?.current) return;
    onWallSelect(wallId);
  };
  const wallTexture = useMemo(() => createSurfaceTexture(room.wallTexture), [room.wallTexture]);
  const floorTexture = useMemo(() => createSurfaceTexture(room.floorTexture), [room.floorTexture]);
  const ceilingTexture = useMemo(() => createSurfaceTexture(room.ceilingTexture), [room.ceilingTexture]);
  // Real parquet photo for the "parquet" floor finish (the procedural
  // wood tile above is the fallback until the photo loads).
  const parquetTexture = useParquetTexture(width, depth);
  // The photo carries its own light-wood colours, so it renders
  // un-tinted (white); the procedural tile is multiplied by the floor
  // colour as before.
  const floorTopMap = room.floorTexture === "parquet" ? (parquetTexture ?? floorTexture) : floorTexture;
  const floorTopColor = room.floorTexture === "parquet" && parquetTexture ? "#ffffff" : room.floorColor;
  // Freestanding panels reuse the wall's surface map at panel scale: the
  // wall texture repeats 4x2 across a 22 m wall, so a shared instance
  // would pack the formwork joints far too densely on a 1.7 m panel.
  const panelTexture = useMemo(() => {
    if (!wallTexture) return undefined;
    const tex = wallTexture.clone();
    tex.repeat.set(1, 1);
    tex.needsUpdate = true;
    return tex;
  }, [wallTexture]);
  useEffect(() => () => {
    wallTexture?.dispose();
    floorTexture?.dispose();
    ceilingTexture?.dispose();
    panelTexture?.dispose();
  }, [ceilingTexture, floorTexture, panelTexture, wallTexture]);
  const artworkNodes = useMemo(
    () =>
      artworks.map((artwork) => (
        <ArtworkFrame
          key={artwork.id}
          artwork={artwork}
          selected={artwork.id === selectedId || (multiSelectedIds ?? []).includes(artwork.id)}
          onSelect={onSelect}
          walkable={walkable}
          onWalkTo={onWalkTo}
          offsetX={offsetX}
          offsetZ={offsetZ}
          dragged={dragged}
          editable={editable}
          onDragStart={onDragStart}
          onHoverChange={onHoverChange}
        />
      )),
    [artworks, dragged, editable, multiSelectedIds, offsetX, offsetZ, onDragStart, onHoverChange, onSelect, onWalkTo, selectedId, walkable],
  );

  return (
    <group position={[offsetX, 0, offsetZ ?? 0]}>
      <mesh position={[0, height - 0.12, 0]} receiveShadow>
        <boxGeometry args={[width, 0.24, depth]} />
        <meshStandardMaterial color={room.ceilingColor} map={ceilingTexture} roughness={ceilingPBR.roughness} envMapIntensity={ceilingPBR.envMapIntensity} />
      </mesh>
      <mesh
        position={[0, -0.09, 0]}
        receiveShadow
        onClick={(event) => {
          if (!walkable || dragged?.current) return;
          event.stopPropagation();
          onFloorClick?.(event.point);
        }}
      >
        <boxGeometry args={[width, 0.18, depth]} />
        <meshStandardMaterial attach="material-0" color={room.floorColor} roughness={floorPBR.roughness} envMapIntensity={floorPBR.envMapIntensity} />
        <meshStandardMaterial attach="material-1" color={room.floorColor} roughness={floorPBR.roughness} envMapIntensity={floorPBR.envMapIntensity} />
        <meshStandardMaterial attach="material-2" color={floorTopColor} map={floorTopMap} roughness={floorPBR.roughness} envMapIntensity={floorPBR.envMapIntensity} />
        <meshStandardMaterial attach="material-3" color={room.floorColor} roughness={floorPBR.roughness} envMapIntensity={floorPBR.envMapIntensity} />
        <meshStandardMaterial attach="material-4" color={room.floorColor} roughness={floorPBR.roughness} envMapIntensity={floorPBR.envMapIntensity} />
        <meshStandardMaterial attach="material-5" color={room.floorColor} roughness={floorPBR.roughness} envMapIntensity={floorPBR.envMapIntensity} />
      </mesh>
      {/* The back wall — hidden for the Stone Gallery front half, whose
          back boundary is the arched dividing wall (a partition), not a
          solid wall. */}
      {!hideBackWall && (
      <mesh
        position={[0, height / 2, wallZ]}
        receiveShadow
        onDoubleClick={(event) => {
          if (!editable || !onWallSelect || dragged?.current) return;
          event.stopPropagation();
          onWallSelect("back");
        }}
      >
        <boxGeometry args={[width, height, 0.25]} />
        <meshStandardMaterial color={backColor} map={wallTexture} roughness={wallPBR.roughness} envMapIntensity={wallPBR.envMapIntensity} emissive={wallHighlight("back") ? "#ffffff" : "#000000"} emissiveIntensity={wallHighlight("back") ? 0.16 : 0} />
      </mesh>
      )}
      <WallWithOpening
        x={-width / 2}
        depth={depth}
        height={height}
        color={leftColor}
        texture={wallTexture}
        opening={leftOpening}
        wallId="left"
        highlight={wallHighlight("left")}
        onWallClick={editable ? handleWallClick : undefined}
        dragged={dragged}
        pbr={wallPBR}
      />
      <WallWithOpening
        x={width / 2}
        depth={depth}
        height={height}
        color={rightColor}
        texture={wallTexture}
        opening={rightOpening}
        wallId="right"
        highlight={wallHighlight("right")}
        onWallClick={editable ? handleWallClick : undefined}
        dragged={dragged}
        pbr={wallPBR}
      />
      {/* The front wall — hidden for the Stone Gallery back half, whose
          front boundary is the arched dividing wall (rendered once by
          the front room), not a solid wall. */}
      {!hideFrontWall && (entrance ? (
        <group position={[0, 0, depth / 2]}>
          <mesh
            position={[-(width + 1.65) / 4, height / 2, 0]}
            receiveShadow
            onDoubleClick={(event) => {
              if (!editable || !onWallSelect || dragged?.current) return;
              event.stopPropagation();
              onWallSelect("front");
            }}
          >
            <boxGeometry args={[(width - 1.65) / 2, height, 0.22]} />
            <meshStandardMaterial color={frontColor} map={wallTexture} roughness={wallPBR.roughness} envMapIntensity={wallPBR.envMapIntensity} emissive={wallHighlight("front") ? "#ffffff" : "#000000"} emissiveIntensity={wallHighlight("front") ? 0.16 : 0} />
          </mesh>
          <mesh
            position={[(width + 1.65) / 4, height / 2, 0]}
            receiveShadow
            onDoubleClick={(event) => {
              if (!editable || !onWallSelect || dragged?.current) return;
              event.stopPropagation();
              onWallSelect("front");
            }}
          >
            <boxGeometry args={[(width - 1.65) / 2, height, 0.22]} />
            <meshStandardMaterial color={frontColor} map={wallTexture} roughness={wallPBR.roughness} envMapIntensity={wallPBR.envMapIntensity} emissive={wallHighlight("front") ? "#ffffff" : "#000000"} emissiveIntensity={wallHighlight("front") ? 0.16 : 0} />
          </mesh>
          <mesh position={[0, (height + 2.5) / 2, 0]} receiveShadow>
            <boxGeometry args={[1.65, height - 2.5, 0.22]} />
            <meshStandardMaterial color={frontColor} map={wallTexture} roughness={wallPBR.roughness} envMapIntensity={wallPBR.envMapIntensity} />
          </mesh>
        </group>
      ) : (
        <mesh
          position={[0, height / 2, depth / 2]}
          receiveShadow
          onDoubleClick={(event) => {
            if (!editable || !onWallSelect || dragged?.current) return;
            event.stopPropagation();
            onWallSelect("front");
          }}
        >
          <boxGeometry args={[width, height, 0.22]} />
          <meshStandardMaterial color={frontColor} map={wallTexture} roughness={wallPBR.roughness} envMapIntensity={wallPBR.envMapIntensity} emissive={wallHighlight("front") ? "#ffffff" : "#000000"} emissiveIntensity={wallHighlight("front") ? 0.16 : 0} />
        </mesh>
      ))}
      {room.partitionWalls.map((wall) =>
        wall.shape === "arch" ? (
          <ArchPartitionWall
            key={wall.id}
            wall={wall}
            height={height}
            wallTexture={wallTexture}
            wallColor={wall.color ?? room.sideWallColor}
            wallPBR={wallPBR}
            highlight={wallHighlight(wall.id)}
            editable={editable}
            onWallSelect={onWallSelect}
            dragged={dragged}
          />
        ) : (
          <mesh
            key={wall.id}
            position={[wall.x, (height - 0.25) / 2, wall.z]}
            receiveShadow
            castShadow
            onDoubleClick={(event) => {
              if (!editable || !onWallSelect || dragged?.current) return;
              event.stopPropagation();
              onWallSelect(wall.id);
            }}
          >
            <boxGeometry
              args={wall.orientation === "horizontal"
                ? [wall.length, height - 0.25, 0.18]
                : [0.18, height - 0.25, wall.length]}
            />
            <meshStandardMaterial color={wall.color ?? room.sideWallColor} map={wallTexture} roughness={wallPBR.roughness} envMapIntensity={wallPBR.envMapIntensity} emissive={wallHighlight(wall.id) ? "#ffffff" : "#000000"} emissiveIntensity={wallHighlight(wall.id) ? 0.16 : 0} />
          </mesh>
        ),
      )}
      {room.spotlights && (artworks.length > 0 ? (
        // One ceiling spotlight per artwork, aimed at the work itself —
        // from the ceiling, 1.5 m out from the wall, so every piece gets
        // its own pool of light (back wall and side walls alike). The
        // colour and strength follow the room's light type; soft ambient
        // keeps only the fixture, no beam.
        artworks.map((artwork) => {
          const [ax, ay, az] = artwork.position;
          const nx = Math.sin(artwork.rotation);
          const nz = Math.cos(artwork.rotation);
          return (
            <GallerySpotlight
              key={artwork.id}
              x={ax + nx * 1.5}
              y={height - 0.25}
              z={az + nz * 1.5}
              targetZ={az}
              targetPoint={[ax, ay, az]}
              color={lights.spotColor}
              intensity={lights.spotIntensity}
              lightOn={room.lightType !== "ambient"}
              castShadow={qualityCfg.shadows}
              shadowMapSize={qualityCfg.spotShadowMapSize}
            />
          );
        })
      ) : (
        Array.from({ length: Math.max(2, Math.floor(width / 5)) }, (_, index) => {
          const spots = Math.max(2, Math.floor(width / 5));
          const x = -width / 2 + ((index + 1) * width) / (spots + 1);
          return <GallerySpotlight key={index} x={x} y={height - 0.2} z={0} targetZ={wallZ + 1} color={lights.spotColor} intensity={lights.spotIntensity} lightOn={room.lightType !== "ambient"} castShadow={qualityCfg.shadows} shadowMapSize={qualityCfg.spotShadowMapSize} />;
        })
      ))}
      {room.curatorialText && (
        <group position={[0, height - 0.65, wallZ + 0.14]}>
          {/* Canvas texture, like wall text: the old troika <Text> here
              carried the same suspend-the-scene failure. */}
          <CuratorialTextPlane text={room.curatorialText} maxWidthM={Math.min(width - 2, 9)} wallColor={room.wallColor} />
        </group>
      )}
      <RoomFeatures layout={room.layout} width={width} depth={depth} height={height} panelTexture={panelTexture} panelColor={backColor} panelPBR={wallPBR} contactDecals={qualityCfg.contactDecals} shadows={qualityCfg.shadows} />
      {showGrid && <FloorGrid width={width} depth={depth} />}
      {showMeasure && <MeasurementGuides artworks={artworks} selectedId={selectedId} width={width} depth={depth} />}
      {artworkNodes}
      {(room.elements ?? []).map((element) => (
        <ElementMesh
          key={element.id}
          element={element}
          room={room}
          selected={element.id === selectedElementId || (multiSelectedIds ?? []).includes(element.id)}
          onSelect={onSelectElement}
          walkable={walkable}
          dragged={dragged}
          editable={editable}
          onDragStart={onElementDragStart}
          onHoverChange={onElementHover}
          quality={quality}
        />
      ))}
    </group>
  );
}

function WalkControls({
  rooms,
  activeRoomId,
  offsets,
  zOffsets,
  input,
  destination,
  lookYaw,
  dragged,
  enabled,
  onRoomChange,
  resetSignal,
}: {
  rooms: GalleryRoom[];
  activeRoomId: string;
  offsets: number[];
  // World offset along Z per room (0 for every room except the Stone
  // Gallery halves, which stack along Z — see roomPlanOffsets).
  // Defaults to all 0, so rooms centred on z = 0 behave as before.
  zOffsets?: number[];
  input: React.RefObject<Set<string>>;
  destination: React.RefObject<Vector3 | null>;
  // Yaw to face once the destination is reached (e.g. an artwork just
  // clicked): the camera turns toward it while walking.
  lookYaw: React.RefObject<number | null>;
  // Set while the pointer drags (look around): a drag must not also count
  // as a click-to-walk on the floor or an artwork.
  dragged: React.RefObject<boolean>;
  enabled: boolean;
  onRoomChange?: (id: string) => void;
  // Increment to send the visitor back to the entrance (room 1, start
  // position, facing the back wall).
  resetSignal?: React.RefObject<number>;
}) {
  const { camera, gl } = useThree();
  const currentRoomIndex = useRef(Math.max(0, rooms.findIndex((room) => room.id === activeRoomId)));
  const handledRoomId = useRef(activeRoomId);
  // The frame loop runs outside React renders, so it must never call a
  // possibly stale onRoomChange closure: the arch switch can fire
  // inside the scene while the header, panel and artworks stay on the
  // old room. This ref is refreshed on every render, and the frame
  // loop only ever calls through it.
  const onRoomChangeRef = useRef(onRoomChange);
  onRoomChangeRef.current = onRoomChange;
  const initialized = useRef(false);
  const velocity = useRef(new Vector3());
  const direction = useRef(new Vector3());
  const right = useRef(new Vector3());
  const stuckTime = useRef(0);
  const lastKey = useRef<string | null>(null);
  const lastReset = useRef(resetSignal?.current ?? 0);

  // World Z offset of a room (0 unless it is a Stone Gallery half).
  const zOffsetOf = (index: number) => zOffsets?.[index] ?? 0;

  useEffect(() => {
    if (!initialized.current) {
      const startIndex = Math.max(0, rooms.findIndex((room) => room.id === activeRoomId));
      const startRoom = rooms[startIndex];
      camera.position.set(offsets[startIndex], 1.65, zOffsetOf(startIndex) + roomLayouts[startRoom.layout].depth / 2 - 1.5);
      camera.rotation.set(0, 0, 0);
      currentRoomIndex.current = startIndex;
      handledRoomId.current = activeRoomId;
      initialized.current = true;
      return;
    }
    const requestedIndex = rooms.findIndex((room) => room.id === activeRoomId);
    if (requestedIndex < 0) return;
    // A room change the frame loop already made — walking through the
    // arch or a doorway — must never move the camera: the visitor is
    // already standing in the new room. The loop sets both the internal
    // index and the handled id before calling onRoomChange, so when the
    // parent's active room catches up the index already matches. Only
    // sync the handled id and leave the camera exactly where it is.
    // The camera is repositioned to the room entrance solely for a
    // parent-initiated switch (floor-plan / room-list click, reset),
    // where the frame loop has not moved the internal index.
    if (handledRoomId.current === activeRoomId || currentRoomIndex.current === requestedIndex) {
      handledRoomId.current = activeRoomId;
      return;
    }
    const room = rooms[requestedIndex];
    const { depth } = roomLayouts[room.layout];
    camera.position.set(
      offsets[requestedIndex],
      1.65,
      zOffsetOf(requestedIndex) + depth / 2 - 1.5,
    );
    camera.rotation.set(0, 0, 0);
    currentRoomIndex.current = requestedIndex;
    handledRoomId.current = activeRoomId;
  }, [activeRoomId, camera, offsets, rooms, zOffsets]);

  useEffect(() => {
    if (!enabled) {
      input.current.clear();
      return;
    }
    gl.domElement.tabIndex = 0;
    gl.domElement.focus({ preventScroll: true });
    const keyDown = (event: KeyboardEvent) => {
      if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
        event.preventDefault();
        input.current.add(event.code);
        lastKey.current = event.code;
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
      if (Math.abs(event.clientX - downX) > 6 || Math.abs(event.clientY - downY) > 6) {
        dragged.current = true;
      }
      camera.rotation.order = "YXZ";
      camera.rotation.y -= (event.clientX - lastX) * 0.004;
      camera.rotation.x = MathUtils.clamp(camera.rotation.x - (event.clientY - lastY) * 0.004, -1.35, 1.35);
      lastX = event.clientX;
      lastY = event.clientY;
    };
    const onPointerUp = () => { pointerId = undefined; };
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

  useFrame((_, delta) => {
    if (!enabled) return;
    // "Back to the entrance": put the visitor at the first room's start
    // position, facing the back wall, and clear any walk target.
    if (resetSignal && resetSignal.current !== lastReset.current) {
      lastReset.current = resetSignal.current;
      const targetRoom = rooms[0];
      const { depth } = roomLayouts[targetRoom.layout];
      camera.position.set(offsets[0], 1.65, zOffsetOf(0) + depth / 2 - 1.5);
      camera.rotation.set(0, 0, 0);
      destination.current = null;
      lookYaw.current = null;
      velocity.current.set(0, 0, 0);
      if (currentRoomIndex.current !== 0) {
        currentRoomIndex.current = 0;
        handledRoomId.current = targetRoom.id;
        onRoomChangeRef.current?.(targetRoom.id);
      }
      return;
    }
    // No continuous reconciliation here: the active room changes only
    // on the actual arch / doorway crossing (the threshold switch
    // below), which keeps the camera exactly where the visitor is
    // standing. Re-asserting the room from the camera's world Z every
    // frame re-fired onRoomChange and, through the parent, could reset
    // the camera to the room entrance instead of only switching the
    // active room — the snap-back at the arch. The threshold switch
    // already calls onRoomChange through the ref, so a missed switch
    // cannot strand the header on the old room.
    const keys = input.current;
    const forwardInput = Number(keys.has("KeyW") || keys.has("ArrowUp")) - Number(keys.has("KeyS") || keys.has("ArrowDown"));
    const sideInput = Number(keys.has("KeyD") || keys.has("ArrowRight")) - Number(keys.has("KeyA") || keys.has("ArrowLeft"));
    const destinationPoint = destination.current;
    if (!forwardInput && !sideInput && !destinationPoint) return;

    if (forwardInput || sideInput) {
      destination.current = null;
      lookYaw.current = null;
      direction.current.set(0, 0, -1).applyQuaternion(camera.quaternion);
      direction.current.y = 0;
      direction.current.normalize();
      right.current.crossVectors(direction.current, camera.up).normalize();
      velocity.current.set(0, 0, 0)
        .addScaledVector(direction.current, forwardInput)
        .addScaledVector(right.current, sideInput)
        .normalize();
    } else if (destinationPoint) {
      // A destination in the other Stone Gallery half is reached through
      // the arched opening, not in a straight line: walking straight at
      // an off-centre destination drives the visitor into the solid wall
      // beside the arch and they stop at the threshold. Route via the
      // centre of the arch (world x = the pair's X, world z = −1) first;
      // once the camera is close to the arch centre (or already through
      // it, in the destination's room) the real destination takes over.
      let targetPoint = destinationPoint;
      let routingViaArch = false;
      const destRoomIndex = (() => {
        for (let i = 0; i < rooms.length; i++) {
          const { width: w, depth: d } = roomLayouts[rooms[i].layout];
          if (Math.abs(destinationPoint.x - offsets[i]) <= w / 2 && Math.abs(destinationPoint.z - zOffsetOf(i)) <= d / 2) return i;
        }
        return -1;
      })();
      const hereIndex = currentRoomIndex.current;
      const isStonePairCrossing =
        destRoomIndex >= 0 && destRoomIndex !== hereIndex &&
        ((rooms[hereIndex].layout === "stone-gallery-front" && rooms[destRoomIndex].layout === "stone-gallery-back") ||
          (rooms[hereIndex].layout === "stone-gallery-back" && rooms[destRoomIndex].layout === "stone-gallery-front"));
      if (isStonePairCrossing) {
        const frontIndex = rooms[hereIndex].layout === "stone-gallery-front" ? hereIndex : destRoomIndex;
        const archX = offsets[frontIndex];
        const archZ = -1;
        const distToArch = Math.hypot(camera.position.x - archX, camera.position.z - archZ);
        if (distToArch > 0.6) {
          targetPoint = new Vector3(archX, 0, archZ);
          routingViaArch = true;
        }
      }
      direction.current.set(targetPoint.x - camera.position.x, 0, targetPoint.z - camera.position.z);
      if (direction.current.length() < 0.2) {
        // Arrived at the real destination — clear it. Arriving at the
        // arch waypoint never clears it: the waypoint is only a via
        // point, and the camera is already within 0.6 m of it when the
        // real destination takes over, so this branch is only reached
        // for the real destination.
        if (!routingViaArch) {
          destination.current = null;
          lookYaw.current = null;
        }
        return;
      }
      direction.current.normalize();
      velocity.current.copy(direction.current);
      // Turn to face the destination (e.g. the artwork just clicked) while
      // walking toward it — only once heading for the real destination,
      // not while routing through the arch.
      if (!routingViaArch && lookYaw.current !== null) {
        const step = Math.min(delta, 0.05) * 2.5;
        let diff = lookYaw.current - camera.rotation.y;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        camera.rotation.y += MathUtils.clamp(diff, -step, step);
      }
    }
    velocity.current.multiplyScalar(Math.min(delta, 0.05) * 4);
    const startX = camera.position.x;
    const startZ = camera.position.z;

    const roomIndex = currentRoomIndex.current;
    const room = rooms[roomIndex];
    const { width, depth } = roomLayouts[room.layout];
    let nextX = camera.position.x + velocity.current.x;
    let nextZ = camera.position.z + velocity.current.z;
    // Walls, partitions and room bounds are LOCAL to the room; the
    // camera moves in WORLD coordinates. Convert z (and x) to the
    // room's local frame before comparing — a Stone Gallery half sits
    // at a Z offset, so world z is not local z.
    const roomZ = zOffsetOf(roomIndex);
    const localX = camera.position.x - offsets[roomIndex];
    const targetX = nextX - offsets[roomIndex];
    const localZ = camera.position.z - roomZ;
    let targetZ = nextZ - roomZ;
    for (const wall of room.partitionWalls) {
      if (wall.orientation === "horizontal") {
        const crossesWall = Math.min(localZ, targetZ) <= wall.z + 0.2
          && Math.max(localZ, targetZ) >= wall.z - 0.2;
        let overlapsWall = Math.min(localX, targetX) <= wall.x + wall.length / 2 + 0.35
          && Math.max(localX, targetX) >= wall.x - wall.length / 2 - 0.35;
        if (wall.shape === "arch") {
          // The arch opening is a real passage: only the solid parts of
          // the wall (outside the opening) block the visitor. The solid
          // parts end exactly at the opening edges — the 0.35 body
          // margin must not shrink the opening itself, or the visitor
          // sees a 4 m opening they cannot walk through at its edges
          // (the camera stopped at the threshold). The margin stays on
          // the outer ends only, so the camera never clips the side walls.
          const openingHalf = 2 * archScale(roomLayouts[room.layout].height);
          const segMin = Math.min(localX, targetX);
          const segMax = Math.max(localX, targetX);
          const overlapsLeftSolid = segMin <= wall.x - openingHalf && segMax >= wall.x - wall.length / 2 - 0.35;
          const overlapsRightSolid = segMin <= wall.x + wall.length / 2 + 0.35 && segMax >= wall.x + openingHalf;
          overlapsWall = overlapsLeftSolid || overlapsRightSolid;
        }
        if (crossesWall && overlapsWall) {
          nextZ = camera.position.z;
          targetZ = localZ;
        }
      } else {
        const crossesWall = Math.min(localX, targetX) <= wall.x + 0.2
          && Math.max(localX, targetX) >= wall.x - 0.2;
        let overlapsWall = Math.min(localZ, targetZ) <= wall.z + wall.length / 2 + 0.35
          && Math.max(localZ, targetZ) >= wall.z - wall.length / 2 - 0.35;
        if (wall.shape === "arch") {
          // Same arch passage, turned 90°: the opening runs along z.
          // The solid parts end exactly at the opening edges (see above).
          const openingHalf = 2 * archScale(roomLayouts[room.layout].height);
          const segMin = Math.min(localZ, targetZ);
          const segMax = Math.max(localZ, targetZ);
          const overlapsLeftSolid = segMin <= wall.z - openingHalf && segMax >= wall.z - wall.length / 2 - 0.35;
          const overlapsRightSolid = segMin <= wall.z + wall.length / 2 + 0.35 && segMax >= wall.z + openingHalf;
          overlapsWall = overlapsLeftSolid || overlapsRightSolid;
        }
        if (crossesWall && overlapsWall) {
          nextX = camera.position.x;
        }
      }
    }
    // Movable partition walls (Elements) block the visitor the same way:
    // a wall running along X is horizontal, along Z is vertical, judged
    // from its rotation.
    for (const element of room.elements ?? []) {
      if (element.type !== "partition") continue;
      const effectiveLength = element.length * element.scale;
      const horizontal = Math.abs(Math.sin(element.rotation)) < 0.5;
      if (horizontal) {
        const crossesWall = Math.min(localZ, targetZ) <= element.z + 0.2
          && Math.max(localZ, targetZ) >= element.z - 0.2;
        const overlapsWall = Math.min(localX, targetX) <= element.x + effectiveLength / 2 + 0.35
          && Math.max(localX, targetX) >= element.x - effectiveLength / 2 - 0.35;
        if (crossesWall && overlapsWall) {
          nextZ = camera.position.z;
          targetZ = localZ;
        }
      } else {
        const crossesWall = Math.min(localX, targetX) <= element.x + 0.2
          && Math.max(localX, targetX) >= element.x - 0.2;
        const overlapsWall = Math.min(localZ, targetZ) <= element.z + effectiveLength / 2 + 0.35
          && Math.max(localZ, targetZ) >= element.z - effectiveLength / 2 - 0.35;
        if (crossesWall && overlapsWall) {
          nextX = camera.position.x;
        }
      }
    }
    // The Stone Gallery halves: the arch is the passage between them,
    // along Z. While the visitor is inside the arch opening, the bound
    // on the arch side relaxes to the wall itself (the arched tunnel),
    // so they can walk up to and through it; outside the opening the
    // normal margin applies and the solid wall blocks them.
    const isStoneFront = room.layout === "stone-gallery-front";
    const isStoneBack = room.layout === "stone-gallery-back";
    const archOpeningHalf = (isStoneFront || isStoneBack) ? 2 * archScale(roomLayouts[room.layout].height) : 0;
    const inArchOpening = (isStoneFront || isStoneBack) && Math.abs(localX) < archOpeningHalf && Math.abs(targetX) < archOpeningHalf;
    const leftEdge = offsets[roomIndex] - width / 2 + 0.45;
    const rightEdge = offsets[roomIndex] + width / 2 - 0.45;
    const frontEdge = isStoneBack && inArchOpening ? depth / 2 : depth / 2 - 0.45;
    const backEdge = isStoneFront && inArchOpening ? -depth / 2 : -depth / 2 + 0.55;

    // Crossing the arch (along Z) into the other half: the camera keeps
    // moving in world coordinates — only the active room changes, so
    // the new room's bounds take over on the next frame.
    if (inArchOpening) {
      if (isStoneFront && targetZ < -depth / 2 && rooms[roomIndex + 1]?.layout === "stone-gallery-back") {
        camera.position.z = nextZ;
        camera.position.x = nextX;
        currentRoomIndex.current = roomIndex + 1;
        handledRoomId.current = rooms[roomIndex + 1].id;
        onRoomChangeRef.current?.(rooms[roomIndex + 1].id);
        return;
      }
      if (isStoneBack && targetZ > depth / 2 && rooms[roomIndex - 1]?.layout === "stone-gallery-front") {
        camera.position.z = nextZ;
        camera.position.x = nextX;
        currentRoomIndex.current = roomIndex - 1;
        handledRoomId.current = rooms[roomIndex - 1].id;
        onRoomChangeRef.current?.(rooms[roomIndex - 1].id);
        return;
      }
    }

    if (targetZ <= frontEdge && targetZ >= backEdge) camera.position.z = nextZ;
    if (nextX >= leftEdge && nextX <= rightEdge) {
      camera.position.x = nextX;
      return;
    }

    const nextIndex = nextX < leftEdge ? roomIndex - 1 : roomIndex + 1;
    // A side doorway only joins rooms that sit side by side along X
    // (same Z offset). The Stone Gallery halves stack along Z, so there
    // is no side doorway between them — the arch is the passage, along Z.
    const xAdjacent = nextIndex >= 0 && nextIndex < rooms.length && zOffsetOf(nextIndex) === roomZ;
    if (Math.abs(localZ) < 0.9 && xAdjacent) {
      const { width: nextWidth } = roomLayouts[rooms[nextIndex].layout];
      camera.position.x = offsets[nextIndex] + (nextX < leftEdge ? 1 : -1) * (nextWidth / 2 - 3);
      camera.rotation.set(0, 0, 0);
      destination.current = null;
      lookYaw.current = null;
      currentRoomIndex.current = nextIndex;
      handledRoomId.current = rooms[nextIndex].id;
      onRoomChangeRef.current?.(rooms[nextIndex].id);
      return;
    }
    camera.position.x = MathUtils.clamp(nextX, leftEdge, rightEdge);

    // Give up on a destination the visitor cannot reach (blocked by a wall):
    // otherwise the camera would keep pushing against it forever.
    if (destination.current) {
      if (Math.abs(camera.position.x - startX) < 0.001 && Math.abs(camera.position.z - startZ) < 0.001) {
        stuckTime.current += delta;
        if (stuckTime.current > 1.5) {
          destination.current = null;
          lookYaw.current = null;
          stuckTime.current = 0;
        }
      } else {
        stuckTime.current = 0;
      }
    }
  });

  return null;
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
}: {
  roomKey: string;
  depth: number;
  enabled: boolean;
}) {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as unknown as {
    target: Vector3;
    update: () => void;
  } | null;
  useEffect(() => {
    if (!enabled) return;
    camera.position.set(0, 2.0, depth / 2 - 1.8);
    if (controls) {
      controls.target.set(0, 1.8, 0);
      controls.update();
    } else {
      camera.lookAt(0, 1.8, 0);
    }
  }, [camera, controls, depth, enabled, roomKey]);
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
};

// Editor drag: while an artwork drag is active, pointer moves on the canvas
// are turned into a point on the artwork's wall plane and applied as a new
// position (move) or a new scale (resize). The listeners live on the canvas
// element, so the drag keeps working even when the pointer leaves the frame.
function DragHandler({
  dragRef,
  onArtworkUpdate,
  onDragEnd,
}: {
  dragRef: React.RefObject<ArtworkDragState | null>;
  onArtworkUpdate?: (id: string, patch: { position?: [number, number, number]; scale?: number }) => void;
  onDragEnd: () => void;
}) {
  const { camera, gl } = useThree();
  const updateRef = useRef(onArtworkUpdate);
  updateRef.current = onArtworkUpdate;
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
      const rect = el.getBoundingClientRect();
      const ndc = new Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      const raycaster = new Raycaster();
      raycaster.setFromCamera(ndc, camera);
      const hit = new Vector3();
      const planeKind = ELEMENT_PLANES[type];
      let point: Vector3 | null = null;
      if (planeKind === "wall") {
        const wallOffset = ELEMENT_DEFAULTS[type].wallOffset;
        const wallPlane = new Plane(new Vector3(0, 0, 1), depth / 2 - wallOffset);
        if (raycaster.ray.intersectPlane(wallPlane, hit)) point = hit.clone();
      } else if (planeKind === "ceiling") {
        const y = Math.max(2.5, height - 0.4);
        if (raycaster.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), -y), hit)) point = hit.clone();
      }
      if (!point && raycaster.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), 0), hit)) point = hit.clone();
      if (!point) return;
      point.x = Math.min(width / 2 - 0.5, Math.max(-width / 2 + 0.5, point.x));
      point.z = Math.min(depth / 2 - 0.5, Math.max(-depth / 2 + 0.5, point.z));
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

// Teleport target for the exhibition minimap (public viewer): a point
// to walk to, in the target room's local coordinates, with the yaw to
// face once there. `nonce` changes on every teleport request so the
// same artwork can be re-targeted. The scene switches rooms first when
// needed, then walks — never a blind jump through a wall.
export type TeleportTarget = {
  roomId: string;
  x: number;
  z: number;
  yaw: number;
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
  selectedElementId,
  onSelectElement,
  onElementUpdate,
  selectedWallId,
  onWallSelect,
  onEditStart,
  onEditEnd,
  onElementDrop,
  showGrid,
  showMeasure,
  multiSelectedIds,
  teleportTarget,
  quality: controlledQuality,
  onQualityChange,
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
  onArtworkUpdate?: (id: string, patch: { position?: [number, number, number]; scale?: number }) => void;
  // Editor only: elements (furniture, partition walls, vitrines, ...).
  selectedElementId?: string;
  onSelectElement?: (id: string, additive?: boolean) => void;
  onElementUpdate?: (id: string, patch: { x?: number; y?: number; z?: number; scale?: number }) => void;
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
}) {
  const sceneRooms = rooms?.length ? rooms : [room];
  // Where each room sits in the shared 3D space (see roomPlanOffsets):
  // rooms line up along X, except a Stone Gallery front/back pair,
  // which shares one X and stacks along Z. `offsets` is the X offset
  // (kept, so every existing use keeps working); `zOffsets` is the Z
  // offset (0 for every room except the Stone halves).
  const planOffsets = useMemo(() => roomPlanOffsets(sceneRooms), [sceneRooms]);
  const offsets = planOffsets.x;
  const zOffsets = planOffsets.z;

  const artworkRooms = walkMode ? sceneRooms : [room];
  const artworkOffsets = walkMode ? offsets : [0];
  const artworkZOffsets = walkMode ? zOffsets : [0];
  const destination = useRef<Vector3 | null>(null);
  const lookYaw = useRef<number | null>(null);
  const dragged = useRef(false);
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
  // pointerup. While a drag is active the orbit controls stay off, so the
  // camera never rotates while an artwork is being moved.
  const dragRef = useRef<ArtworkDragState | null>(null);
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

  // Every selected id (primary + multi-selection): any of them may start
  // a drag, and the editor moves the rest of the selection with it.
  const selectedIdSet = useMemo(
    () => new Set([selectedId, selectedElementId, ...(multiSelectedIds ?? [])].filter((id): id is string => Boolean(id))),
    [selectedId, selectedElementId, multiSelectedIds],
  );

  const handleDragStart = (id: string, mode: "move" | "resize", event: ThreeEvent<PointerEvent>) => {
    if (!editable || walking) return;
    const artwork = artworks.find((item) => item.id === id);
    if (!artwork || !selectedIdSet.has(artwork.id)) return;
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
        minZ: -layout.depth / 2 + halfW,
        maxZ: layout.depth / 2 - halfW,
      },
    };
    setIsDragging(true);
    setDragCursor(mode === "resize" ? "nwse-resize" : "grabbing");
  };

  // Editor drag for elements: the drag plane follows the element type —
  // the floor plane for furniture and partition walls, the wall plane for
  // wall-mounted pieces, a horizontal plane at the element's height for
  // the ceiling track light. Dragging only happens in the editor's orbit
  // view, where the active room sits at offset 0, so element positions
  // are room coordinates directly.
  const elementDragRef = useRef<ElementDragState | null>(null);
  const [hoveredElement, setHoveredElement] = useState<{ id: string; cursor: string } | null>(null);

  const handleElementDragStart = (id: string, mode: "move" | "resize", event: ThreeEvent<PointerEvent>) => {
    if (!editable || walking) return;
    // Elements live in every room, not just the active one (walk mode
    // shows all rooms at once): find the room that holds this element.
    const ownerRoom = sceneRooms.find((sceneRoom) => (sceneRoom.elements ?? []).some((item) => item.id === id)) ?? room;
    const element = (ownerRoom.elements ?? []).find((item) => item.id === id);
    if (!element || !selectedIdSet.has(element.id)) return;
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
        minZ: -layout.depth / 2 + 0.5,
        maxZ: layout.depth / 2 - 0.5,
      },
    };
    setIsDragging(true);
    setDragCursor(mode === "resize" ? "nwse-resize" : "grabbing");
  };

  const artworkNodes = artworkRooms.map((sceneRoom, index) => {
    // The Stone Gallery halves share the arched dividing wall: the
    // front half hides its back wall and the back half hides its front
    // wall, so the arch (a partition in the front room) is the one
    // shared boundary, seen from both sides. A half only hides its
    // wall when its partner is in the exhibition (a lone half keeps
    // all its walls).
    const sceneIndex = sceneRooms.findIndex((candidate) => candidate.id === sceneRoom.id);
    const isStoneFront = sceneRoom.layout === "stone-gallery-front" && sceneRooms[sceneIndex + 1]?.layout === "stone-gallery-back";
    const isStoneBack = sceneRoom.layout === "stone-gallery-back" && sceneRooms[sceneIndex - 1]?.layout === "stone-gallery-front";
    // Side doorways only join rooms that sit side by side along X
    // (same Z offset). The Stone Gallery halves stack along Z, so
    // there is no side doorway between them — the arch is the passage.
    const leftAdjacent = walkMode && index > 0 && artworkZOffsets[index] === artworkZOffsets[index - 1];
    const rightAdjacent = walkMode && index < artworkRooms.length - 1 && artworkZOffsets[index] === artworkZOffsets[index + 1];
    return (
    <GalleryRoom
      key={sceneRoom.id}
      room={sceneRoom}
      offsetX={artworkOffsets[index]}
      offsetZ={artworkZOffsets[index]}
      hideBackWall={isStoneFront}
      hideFrontWall={isStoneBack}
      artworks={artworks.filter((artwork) => artwork.roomId === sceneRoom.id)}
      selectedId={selectedId}
      onSelect={onSelect}
      // In walk mode every room's floor and artworks are walk targets, not
      // just the active room's: a click on the far room's floor (through
      // the arch) must set a destination there instead of doing nothing,
      // and the camera walks to it through the arch (see the arch
      // waypoint in WalkControls).
      walkable={walkMode && walking === true}
      editable={editable}
      onDragStart={handleDragStart}
      onHoverChange={setHoveredArtwork}
      selectedElementId={selectedElementId}
      onSelectElement={onSelectElement}
      onElementDragStart={handleElementDragStart}
      onElementHover={setHoveredElement}
      selectedWallId={selectedWallId}
      onWallSelect={onWallSelect}
      showGrid={showGrid}
      showMeasure={showMeasure}
      multiSelectedIds={multiSelectedIds}
      onFloorClick={walkMode ? (point) => {
        destination.current = new Vector3(point.x, 0, point.z);
        lookYaw.current = null;
        onFloorClick?.(point);
      } : undefined}
      onWalkTo={walkMode ? (point, yaw) => {
        destination.current = point;
        lookYaw.current = yaw;
      } : undefined}
      dragged={dragged}
      quality={quality}
      // In walk mode the visitor stays inside: shared walls keep the single
      // door wall (no doubled wall, so no z-fighting), the outer ends are
      // solid and the front stays closed, so no void or box exterior is
      // ever visible through a window or an entrance hole.
      leftOpening={walkMode ? (leftAdjacent ? "none" : "solid") : "window"}
      rightOpening={walkMode ? (rightAdjacent ? "door" : "solid") : "window"}
      entrance={false}
    />
    );
  });
  const startRoom = sceneRooms[Math.max(0, sceneRooms.findIndex((sceneRoom) => sceneRoom.id === (activeRoomId ?? room.id)))];
  const startIndex = Math.max(0, sceneRooms.findIndex((sceneRoom) => sceneRoom.id === (activeRoomId ?? room.id)));
  const startOffset = offsets[startIndex];
  const startZOffset = zOffsets[startIndex];
  const startDepth = roomLayouts[startRoom.layout].depth;
  const interiorView = interior === true && !walkMode;
  const interiorLimits = useMemo(() => {
    const layout = roomLayouts[room.layout];
    return interiorOrbitLimits(layout.width, layout.depth, layout.height);
  }, [room.layout]);
  // The active room's light mood drives the scene's ambient and
  // directional light (the per-artwork spots follow it inside GalleryRoom).
  const sceneLights = LIGHT_PRESETS[room.lightType ?? "spot-warm"];
  // Directional shadow frustum: covers the whole multi-room span in
  // walk mode, centred on the rooms. High quality only — one more
  // 2048 px map is cheap, but the frustum is wide, so the shadows it
  // throws are soft by design.
  const dirTarget = useMemo(() => new Object3D(), []);
  const roomSpan = useMemo(() => {
    const minX = Math.min(...sceneRooms.map((sceneRoom, index) => offsets[index] - roomLayouts[sceneRoom.layout].width / 2));
    const maxX = Math.max(...sceneRooms.map((sceneRoom, index) => offsets[index] + roomLayouts[sceneRoom.layout].width / 2));
    return { centerX: (minX + maxX) / 2, halfSpan: (maxX - minX) / 2 };
  }, [sceneRooms, offsets]);
  useEffect(() => {
    dirTarget.position.set(roomSpan.centerX, 0, 0);
    return () => { dirTarget.removeFromParent(); };
  }, [dirTarget, roomSpan]);
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
      style={{ cursor: isDragging ? dragCursor ?? "grabbing" : hoveredArtwork?.cursor ?? hoveredElement?.cursor ?? undefined }}
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
      <Canvas camera={{ position: interiorView ? [0, 2.0, startDepth / 2 - 1.8] : walkMode ? [startOffset, 1.65, startZOffset + startDepth / 2 - 1.5] : [0, 3.2, 11], fov: interiorView ? 60 : walkMode ? 75 : 43 }} dpr={qualityCfg.dpr} shadows>
        {/* Stone Gallery: the reference room's dark warm backdrop and
            fog (0x3a342d, 14–34 m) — the moody depth the generic bright
            gallery loses. Other rooms keep the wall colour. */}
        <color attach="background" args={[isStoneLayout(room.layout) ? "#3a342d" : room.wallColor]} />
        {isStoneLayout(room.layout) && <fog attach="fog" args={["#3a342d", 14, 34]} />}
        {/* The environment map carries part of the ambient light while
            it is on, so the flat ambient is turned down to match — the
            room's light mood (warm/cool/ambient) still drives the result. */}
        <ambientLight intensity={qualityCfg.env ? sceneLights.ambient * 0.6 : sceneLights.ambient} />
        {/* Stone Gallery: the reference room's warm hemisphere
            (sky #fff0dc, ground #6a5d4c) — the main ambient, like the
            original's HemisphereLight. */}
        {room.lightType === "stone-warm" && <hemisphereLight args={["#fff0dc", "#6a5d4c", 0.75]} />}
        <directionalLight
          position={[roomSpan.centerX - 3, 8, 4]}
          target={dirTarget}
          intensity={sceneLights.directional}
          color={sceneLights.directionalColor}
          castShadow={qualityCfg.directionalShadows}
          shadow-mapSize-width={qualityCfg.directionalShadowMapSize}
          shadow-mapSize-height={qualityCfg.directionalShadowMapSize}
          shadow-bias={-0.0002}
          shadow-normalBias={0.03}
          shadow-camera-near={0.5}
          shadow-camera-far={60}
          shadow-camera-left={-roomSpan.halfSpan - 4}
          shadow-camera-right={roomSpan.halfSpan + 4}
          shadow-camera-top={12}
          shadow-camera-bottom={-12}
        />
        <primitive object={dirTarget} />
        <ToneMappingRig exposure={qualityCfg.exposure} />
        {/* The environment map is neutral white-room light: halve it
            for the Stone Gallery so it does not wash out the warm
            stone glow. */}
        <LocalEnvironment enabled={qualityCfg.env} intensity={isStoneLayout(room.layout) ? qualityCfg.envIntensity * 0.5 : qualityCfg.envIntensity} />
        {sceneRooms.map((sceneRoom, index) =>
          isStoneLayout(sceneRoom.layout) ? (
            // Stone Gallery: the reference room's five warm ceiling
            // point lights (positions from the source, z shifted +3 to
            // centre the room), split across the two halves by their
            // global z — the front half gets the two at global z = 5
            // (local −0.5), the back half the three at global z = −6
            // and −1.5 (local +0.5 and +5.0). They are the room's
            // ceiling lights; they do not cast shadows (five cube maps
            // would be far too expensive) — the directional and the
            // artwork spots carry the shadows.
            <group key={`stone-lights-${sceneRoom.id}`}>
              {(sceneRoom.layout === "stone-gallery-front"
                ? [[-4, -0.5], [4, -0.5]]
                : sceneRoom.layout === "stone-gallery-back"
                  ? [[-3, 0.5], [4, 0.5], [0, 5.0]]
                  : [[-4, 5], [4, 5], [-3, -6], [4, -6], [0, -1.5]]
              ).map(([x, z], i) => (
                <pointLight key={i} position={[offsets[index] + x, 5, zOffsets[index] + z]} intensity={10} distance={12} color="#ffe2b8" />
              ))}
            </group>
          ) : (
            <pointLight key={`light-${sceneRoom.id}`} position={[offsets[index], 4, zOffsets[index] - 2]} intensity={sceneLights.pointIntensity} color={sceneLights.pointColor} />
          ),
        )}
        {/* Artwork textures load through Suspense so a slow image suspends
            only the artworks — never the whole room or page. */}
        <Suspense fallback={null}>{artworkNodes}</Suspense>
        <DragHandler
          dragRef={dragRef}
          onArtworkUpdate={onArtworkUpdate}
          onDragEnd={() => {
            setIsDragging(false);
            setDragCursor(null);
            onEditEnd?.();
          }}
        />
        <ElementDragHandler
          dragRef={elementDragRef}
          onElementUpdate={onElementUpdate}
          onDragEnd={() => {
            setIsDragging(false);
            setDragCursor(null);
            onEditEnd?.();
          }}
        />
        <ElementDropHandler room={room} enabled={Boolean(editable) && !walking} onDrop={onElementDrop} />
        {interiorView && (
          <InteriorCameraRig roomKey={`${room.id}:${room.layout}`} depth={startDepth} enabled />
        )}
        {walkMode && input ? (
          <WalkControls rooms={sceneRooms} activeRoomId={activeRoomId ?? room.id} offsets={offsets} zOffsets={zOffsets} input={input} destination={destination} lookYaw={lookYaw} dragged={dragged} enabled={walking ?? false} onRoomChange={onRoomChange} resetSignal={resetSignal} />
        ) : (
          <OrbitControls
            makeDefault
            enabled={!isDragging && !(hoveredArtwork && hoveredArtwork.id === selectedId) && !(hoveredElement && hoveredElement.id === selectedElementId)}
            minDistance={interiorView ? 1.2 : 4}
            maxDistance={interiorView ? interiorLimits.maxDistance : Math.max(roomLayouts[room.layout].width, roomLayouts[room.layout].depth) + 6}
            minPolarAngle={interiorView ? interiorLimits.minPolarAngle : 0}
            maxPolarAngle={interiorView ? interiorLimits.maxPolarAngle : Math.PI / 2.03}
            target={interiorView ? [0, 1.8, 0] : [0, 2.1, -roomLayouts[room.layout].depth / 2]}
            enableDamping
          />
        )}
      </Canvas>
      <RenderQualityToggle quality={quality} onChange={handleQualityChange} canvasClassName={className} />
    </div>
  );
}
