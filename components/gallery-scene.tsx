"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ThreeEvent } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import { useEffect, useMemo, useRef, useState, Suspense } from "react";
import { BufferAttribute, CanvasTexture, DoubleSide, MathUtils, Object3D, Plane, PlaneGeometry, Raycaster, RepeatWrapping, SRGBColorSpace, Texture, Vector2, Vector3 } from "three";
import type { Artwork } from "@/lib/demo-data";
import { resolveFrameSpec, shadeHex } from "@/lib/demo-data";
import type { FrameSpec, FrameTextureKind } from "@/lib/demo-data";
import { beadStripTexture, frameTileTexture, matTexture } from "@/lib/frame-textures";
import { ELEMENT_DEFAULTS, ELEMENT_PLANES, elementTypes, PLINTH_HEIGHTS, WALL_TEXT_FONTS, type ElementType, type RoomElement } from "@/lib/elements";
import { roomLayouts, type GalleryRoom, type WallId } from "@/lib/rooms";

// Light moods per room: the spot colour and intensity, and the room's
// ambient and directional light, all follow the room's light type.
const LIGHT_PRESETS = {
  "spot-warm": { ambient: 1.4, directional: 1.8, directionalColor: "#fff2df", spotColor: "#fff0d6", spotIntensity: 22, pointColor: "#f4d8b8", pointIntensity: 0.55 },
  "spot-cool": { ambient: 1.5, directional: 1.9, directionalColor: "#e8f0ff", spotColor: "#dfe8ff", spotIntensity: 22, pointColor: "#d8e2f4", pointIntensity: 0.55 },
  ambient: { ambient: 2.6, directional: 1.0, directionalColor: "#ffffff", spotColor: "#ffffff", spotIntensity: 0, pointColor: "#ffffff", pointIntensity: 0.3 },
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
  } else if (style === "wood") {
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

function GallerySpotlight({ x, y, z, targetZ, targetPoint, color = "#fff0d6", intensity = 22, lightOn = true }: { x: number; y: number; z: number; targetZ: number; targetPoint?: [number, number, number]; color?: string; intensity?: number; lightOn?: boolean }) {
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
        />
      )}
      <mesh position={[x, y + 0.02, z]}>
        <cylinderGeometry args={[0.2, 0.24, 0.09, 16]} />
        <meshStandardMaterial color="#f4ead5" emissive="#f4ead5" emissiveIntensity={lightOn ? 0.65 : 0.25} />
      </mesh>
    </>
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

// One material tile, cloned per bar so each bar can repeat it along its
// own length. The clone shares the cached canvas; disposing it on
// unmount only drops the GPU copy.
function useTiledFrameMaterial(spec: FrameSpec, repeatX: number, repeatY: number) {
  const material = useMemo(() => {
    const tile = frameTileTexture(spec.texture, { grain: spec.grain });
    const map = tile?.clone();
    if (map) {
      map.repeat.set(Math.max(1, repeatX), Math.max(1, repeatY));
      map.needsUpdate = true;
    }
    return { map, color: tile ? "#ffffff" : spec.color, metalness: spec.metalness, roughness: spec.roughness, opacity: spec.opacity };
  }, [spec, repeatX, repeatY]);
  useEffect(() => () => {
    material.map?.dispose();
  }, [material]);
  return material;
}

function FrameBar({ size, position, material }: { size: [number, number, number]; position: [number, number, number]; material: { map?: CanvasTexture; color: string; metalness: number; roughness: number; opacity?: number } }) {
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial map={material.map} color={material.color} metalness={material.metalness} roughness={material.roughness} transparent={material.opacity !== undefined && material.opacity < 1} opacity={material.opacity ?? 1} />
    </mesh>
  );
}

// The edge profile of a frame bar, drawn as a strip along the bar's
// inner front edge: a step down toward the artwork, a 45° chamfer, a
// rounded bead, or a dark scooped channel. `horizontal` runs the strip
// along X (top/bottom bars); vertical bars run it along Y. `sign` picks
// which side of the opening the bar sits on.
function ProfileStrip({ horizontal, sign, openingW, openingH, spec, material }: {
  horizontal: boolean;
  sign: 1 | -1;
  openingW: number;
  openingH: number;
  spec: FrameSpec;
  material: { map?: CanvasTexture; color: string; metalness: number; roughness: number; opacity?: number };
}) {
  const profile = spec.profile ?? "flat";
  if (profile === "flat") return null;
  const w = spec.width;
  const d = spec.depth;
  const barZ = -0.06 + d / 2;
  const frontZ = -0.06 + d;
  const length = horizontal ? openingW : openingH;
  if (profile === "stepped") {
    // A step down: a shallower bar on the inner half of the frame.
    const size: [number, number, number] = horizontal ? [length, w * 0.45, d * 0.55] : [w * 0.45, length, d * 0.55];
    const position: [number, number, number] = horizontal
      ? [0, sign * (openingH / 2 + w * 0.22), barZ - d * 0.12]
      : [sign * (openingW / 2 + w * 0.22), 0, barZ - d * 0.12];
    return <FrameBar size={size} position={position} material={material} />;
  }
  if (profile === "bevelled") {
    // A 45° chamfer plane between the front face and the inner edge.
    const size: [number, number, number] = horizontal ? [length, w * 0.55, 0.025] : [w * 0.55, length, 0.025];
    const position: [number, number, number] = horizontal
      ? [0, sign * (openingH / 2 + w * 0.1), frontZ - w * 0.1]
      : [sign * (openingW / 2 + w * 0.1), 0, frontZ - w * 0.1];
    const rotation: [number, number, number] = horizontal ? [Math.PI / 4, 0, 0] : [0, Math.PI / 4, 0];
    return (
      <mesh position={position} rotation={rotation}>
        <boxGeometry args={size} />
        <meshStandardMaterial color={spec.color} metalness={spec.metalness} roughness={spec.roughness} />
      </mesh>
    );
  }
  if (profile === "rounded") {
    // A half-round bead along the inner front edge.
    const position: [number, number, number] = horizontal
      ? [0, sign * (openingH / 2 + w * 0.05), frontZ - w * 0.05]
      : [sign * (openingW / 2 + w * 0.05), 0, frontZ - w * 0.05];
    const rotation: [number, number, number] = horizontal ? [0, 0, Math.PI / 2] : [0, 0, 0];
    return (
      <mesh position={position} rotation={rotation}>
        <cylinderGeometry args={[w * 0.22, w * 0.22, length, 16]} />
        <meshStandardMaterial color={spec.color} metalness={spec.metalness} roughness={spec.roughness} />
      </mesh>
    );
  }
  // Scooped: a dark recessed channel along the inner edge.
  const size: [number, number, number] = horizontal ? [length, w * 0.5, 0.02] : [w * 0.5, length, 0.02];
  const position: [number, number, number] = horizontal
    ? [0, sign * (openingH / 2 + w * 0.25), frontZ - 0.015]
    : [sign * (openingW / 2 + w * 0.25), 0, frontZ - 0.015];
  return (
    <mesh position={position}>
      <boxGeometry args={size} />
      <meshStandardMaterial color={shadeHex(spec.color, 0.55)} metalness={0} roughness={0.9} />
    </mesh>
  );
}

// The beaded inner edge of the gold frames: a row of gold dots on a
// transparent strip, repeated along the frame's inner edge.
function BeadStrip({ length, position, rotation }: { length: number; position: [number, number, number]; rotation?: [number, number, number] }) {
  const map = useMemo(() => {
    const base = beadStripTexture();
    const clone = base?.clone();
    if (clone) {
      clone.repeat.set(Math.max(1, Math.round(length / 0.25)), 1);
      clone.needsUpdate = true;
    }
    return clone;
  }, [length]);
  useEffect(() => () => {
    map?.dispose();
  }, [map]);
  if (!map) return null;
  return (
    <mesh position={position} rotation={rotation ?? [0, 0, 0]}>
      <planeGeometry args={[length, 0.03]} />
      <meshBasicMaterial map={map} transparent toneMapped={false} />
    </mesh>
  );
}

// The frame around an artwork, built from its digitized spec: four
// profiled bars with the drawn material texture, a back panel (the tray
// a floated work hangs against), an optional mat the work sits on, thin
// gold trim rings and a beaded inner edge where the photo has one.
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
  const barZ = backZ + d / 2;
  const artZ = frontZ - spec.recess;
  const tile = 0.4; // metres per texture tile along a bar
  const topMaterial = useTiledFrameMaterial(spec, outerW / tile, w / tile);
  const sideMaterial = useTiledFrameMaterial(spec, w / tile, openingH / tile);
  const matMap = useMemo(() => (spec.mat ? matTexture(spec.mat.texture, spec.mat.color) : undefined), [spec.mat]);
  const trim = spec.trim;
  const trimZ = artZ - 0.005;
  return (
    <group>
      {/* Back panel: the tray interior a floated work hangs against. */}
      <mesh position={[0, 0, backZ + 0.02]}>
        <boxGeometry args={[outerW, outerH, 0.04]} />
        <meshStandardMaterial color={selected ? "#aa7958" : spec.trayColor ?? spec.color} metalness={0} roughness={0.9} />
      </mesh>
      {/* Four profiled bars. */}
      <FrameBar size={[outerW, w, d]} position={[0, openingH / 2 + w / 2, barZ]} material={topMaterial} />
      <FrameBar size={[outerW, w, d]} position={[0, -openingH / 2 - w / 2, barZ]} material={topMaterial} />
      <FrameBar size={[w, openingH, d]} position={[-openingW / 2 - w / 2, 0, barZ]} material={sideMaterial} />
      <FrameBar size={[w, openingH, d]} position={[openingW / 2 + w / 2, 0, barZ]} material={sideMaterial} />
      {/* Edge profile along each bar's inner front edge. */}
      {(spec.profile ?? "flat") !== "flat" && (
        <group>
          <ProfileStrip horizontal sign={1} openingW={openingW} openingH={openingH} spec={spec} material={topMaterial} />
          <ProfileStrip horizontal sign={-1} openingW={openingW} openingH={openingH} spec={spec} material={topMaterial} />
          <ProfileStrip horizontal={false} sign={-1} openingW={openingW} openingH={openingH} spec={spec} material={sideMaterial} />
          <ProfileStrip horizontal={false} sign={1} openingW={openingW} openingH={openingH} spec={spec} material={sideMaterial} />
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
      {/* Beaded inner edge, just inside the frame on its front face. */}
      {spec.bead && (
        <group>
          <BeadStrip length={openingW} position={[0, openingH / 2 + 0.02, frontZ + 0.002]} />
          <BeadStrip length={openingW} position={[0, -openingH / 2 - 0.02, frontZ + 0.002]} />
          <BeadStrip length={openingH} position={[-openingW / 2 - 0.02, 0, frontZ + 0.002]} rotation={[0, 0, Math.PI / 2]} />
          <BeadStrip length={openingH} position={[openingW / 2 + 0.02, 0, frontZ + 0.002]} rotation={[0, 0, Math.PI / 2]} />
        </group>
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
            new Vector3((offsetX ?? 0) + x + nx * 2.2, 0, z + nz * 2.2),
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
          <meshStandardMaterial color="#d7ff32" emissive="#d7ff32" emissiveIntensity={0.4} />
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
}) {
  const wallThickness = 0.22;
  const materialProps = {
    color,
    map: texture,
    roughness: 0.88,
    emissive: highlight ? "#a67c37" : "#000000",
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
        <mesh
          position={[x - Math.sign(x) * 0.02, (windowBottom + windowTop) / 2, 0]}
          rotation={[0, Math.PI / 2, 0]}
        >
          <planeGeometry args={[windowWidth, windowTop - windowBottom]} />
          <meshPhysicalMaterial color="#9bd1db" transparent opacity={0.28} roughness={0.12} side={DoubleSide} />
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
      <lineBasicMaterial color="#a67c37" transparent opacity={0.45} />
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
    ctx.strokeStyle = "#a67c37";
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
          <lineBasicMaterial color="#a67c37" transparent opacity={0.9} />
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
}) {
  const { height } = roomLayouts[room.layout];
  const interactive = editable && !walkable;
  const plane = ELEMENT_PLANES[element.type];
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
          <mesh position={[0, 1.2, 0.01]} castShadow>
            <boxGeometry args={[1.6, 2.4, 0.06]} />
            <meshStandardMaterial color={element.color} roughness={0.75} />
          </mesh>
          <mesh position={[0.6, 1.05, 0.08]}>
            <sphereGeometry args={[0.045, 12, 10]} />
            <meshStandardMaterial color="#3a3a36" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      )}
      {element.type === "window" && (
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
          <mesh position={[0, 0, 0]}>
            <planeGeometry args={[1.6, 1.2]} />
            <meshPhysicalMaterial color="#9bd1db" transparent opacity={0.28} roughness={0.12} side={DoubleSide} />
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
          <meshStandardMaterial color="#d7ff32" emissive="#d7ff32" emissiveIntensity={0.4} />
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
}: {
  layout: string;
  width: number;
  depth: number;
  height: number;
}) {
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
  if (layout === "black-panels") {
    // Tall black panels suspended by rods, each carrying a framed
    // black-and-white photograph.
    return (
      <group>
        {[-5.5, 0, 5.5].map((x) => (
          <group key={x}>
            <mesh position={[x, 2.7, -1.5]}>
              <boxGeometry args={[2.2, 3.4, 0.14]} />
              <meshStandardMaterial color="#101010" roughness={0.85} />
            </mesh>
            <mesh position={[x, 2.7, -1.42]}>
              <planeGeometry args={[1.7, 2.6]} />
              <meshStandardMaterial color="#d8d5cc" roughness={0.9} />
            </mesh>
            <mesh position={[x, 2.9, -1.41]}>
              <circleGeometry args={[0.5, 32]} />
              <meshStandardMaterial color="#1c1c1a" roughness={0.9} />
            </mesh>
            {[-0.8, 0.8].map((dx) => (
              <mesh key={dx} position={[x + dx, (height + 4.4) / 2, -1.5]}>
                <cylinderGeometry args={[0.02, 0.02, height - 4.4, 6]} />
                <meshStandardMaterial color="#444440" roughness={0.5} metalness={0.5} />
              </mesh>
            ))}
          </group>
        ))}
      </group>
    );
  }
  if (layout === "raw-concrete") {
    // Seven freestanding black-framed panels in a staggered (quincunx) row.
    const panels: [number, number][] = [[-6, -3], [0, -3], [6, -3], [-3, 0], [3, 0], [-6, 3], [6, 3]];
    return (
      <group>
        {panels.map(([x, z], index) => (
          <group key={index} position={[x, 0, z]}>
            <mesh position={[0, 1.35, 0]}>
              <boxGeometry args={[1.7, 2.5, 0.1]} />
              <meshStandardMaterial color="#171716" roughness={0.8} />
            </mesh>
            <mesh position={[0, 1.35, 0.06]}>
              <planeGeometry args={[1.5, 2.3]} />
              <meshStandardMaterial color="#e8e6e0" roughness={0.9} />
            </mesh>
            <mesh position={[0, 1.5, 0.07]}>
              <circleGeometry args={[0.45, 32]} />
              <meshStandardMaterial color="#232320" roughness={0.9} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  if (layout === "parquet-portraits") {
    // Ceiling track rails with spot heads, as in the reference room.
    return (
      <group>
        {[-3.5, 3.5].map((x) => (
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
  if (layout === "curved-wall") {
    // Seven hanging spots along the arc of the curved front wall.
    const curveRadius = 40;
    const halfAngle = Math.asin(Math.min(0.95, width / 2 / curveRadius));
    const centerZ = depth / 2 - curveRadius * Math.cos(halfAngle);
    const tones = ["#8a9b88", "#bb8365", "#8796a9", "#a89a7a", "#7d8a99", "#b0855b", "#94a08e"];
    return (
      <group>
        {Array.from({ length: 7 }, (_, index) => {
          const theta = -halfAngle * 0.75 + (index * (halfAngle * 1.5)) / 6;
          const r = curveRadius - 0.15;
          const x = r * Math.sin(theta);
          const z = centerZ + r * Math.cos(theta);
          return (
            <group key={index} position={[x, 2.3, z]} rotation={[0, theta + Math.PI, 0]}>
              <mesh>
                <boxGeometry args={[1.5, 1.9, 0.1]} />
                <meshStandardMaterial color="#c5b7a3" roughness={0.85} />
              </mesh>
              <mesh position={[0, 0, 0.06]}>
                <planeGeometry args={[1.3, 1.7]} />
                <meshStandardMaterial color={tones[index]} roughness={0.9} />
              </mesh>
            </group>
          );
        })}
      </group>
    );
  }
  if (layout === "marble-sculpture") {
    // Bronze figures on black and white plinths.
    return (
      <group>
        {[
          { x: -4, z: -1, plinth: "#171716" },
          { x: 0, z: 1.5, plinth: "#f2efe8" },
          { x: 4, z: -2, plinth: "#171716" },
        ].map(({ x, z, plinth }) => (
          <group key={`${x}-${z}`} position={[x, 0, z]}>
            <mesh position={[0, 0.6, 0]}>
              <boxGeometry args={[0.9, 1.2, 0.9]} />
              <meshStandardMaterial color={plinth} roughness={0.8} />
            </mesh>
            <mesh position={[0, 1.75, 0]}>
              <cylinderGeometry args={[0.12, 0.22, 1.1, 16]} />
              <meshStandardMaterial color="#6b5433" roughness={0.45} metalness={0.6} />
            </mesh>
            <mesh position={[0, 2.44, 0]}>
              <sphereGeometry args={[0.15, 20, 16]} />
              <meshStandardMaterial color="#6b5433" roughness={0.45} metalness={0.6} />
            </mesh>
          </group>
        ))}
      </group>
    );
  }
  if (layout === "quiet-minimal") {
    // A single wooden bench and ceiling track rails, nothing else.
    return (
      <group>
        <mesh position={[0, 0.45, 0]}>
          <boxGeometry args={[2.2, 0.12, 0.7]} />
          <meshStandardMaterial color="#8a6a45" roughness={0.8} />
        </mesh>
        {[-0.9, 0.9].map((x) => (
          <mesh key={x} position={[x, 0.21, 0]}>
            <boxGeometry args={[0.08, 0.42, 0.6]} />
            <meshStandardMaterial color="#6b4f33" roughness={0.8} />
          </mesh>
        ))}
        {[-3, 3].map((x) => (
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
  if (layout === "pop-brick") {
    // Three loud colour accents on the back wall.
    return (
      <group>
        {[
          { x: -4, color: "#ff4d2e" },
          { x: 0, color: "#f5c518" },
          { x: 4, color: "#2e6fb0" },
        ].map(({ x, color }) => (
          <mesh key={x} position={[x, 2.4, -depth / 2 + 0.16]}>
            <planeGeometry args={[2.2, 2.6]} />
            <meshStandardMaterial color={color} roughness={0.85} />
          </mesh>
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
  if (layout === "coffered-concrete") {
    // A grid of concrete coffers: beams hanging below the ceiling slab so
    // the ceiling reads as a recessed grid, as in the reference photo.
    const beamY = height - 0.4;
    const xs: number[] = [];
    for (let x = -width / 2 + 2; x < width / 2; x += 2.4) xs.push(x);
    const zs: number[] = [];
    for (let z = -depth / 2 + 2; z < depth / 2; z += 2.4) zs.push(z);
    return (
      <group>
        {zs.map((z) => (
          <mesh key={`x-${z}`} position={[0, beamY, z]}>
            <boxGeometry args={[width, 0.32, 0.2]} />
            <meshStandardMaterial color="#9d9688" roughness={0.9} />
          </mesh>
        ))}
        {xs.map((x) => (
          <mesh key={`z-${x}`} position={[x, beamY, 0]}>
            <boxGeometry args={[0.2, 0.32, depth]} />
            <meshStandardMaterial color="#9d9688" roughness={0.9} />
          </mesh>
        ))}
      </group>
    );
  }
  if (layout === "skylight-grid") {
    // A structural grid with glowing skylight panels set into it: the
    // ceiling reads as a lit grid, as in the reference photo.
    const beamY = height - 0.35;
    const xs: number[] = [];
    for (let x = -width / 2 + 3; x < width / 2; x += 3.2) xs.push(x);
    const zs: number[] = [];
    for (let z = -depth / 2 + 3; z < depth / 2; z += 3.2) zs.push(z);
    const panels: [number, number][] = [];
    xs.forEach((x, xi) => zs.forEach((z, zi) => {
      if ((xi + zi) % 2 === 0) panels.push([x, z]);
    }));
    return (
      <group>
        {zs.map((z) => (
          <mesh key={`x-${z}`} position={[0, beamY, z]}>
            <boxGeometry args={[width, 0.3, 0.22]} />
            <meshStandardMaterial color="#d8d5cf" roughness={0.7} metalness={0.2} />
          </mesh>
        ))}
        {xs.map((x) => (
          <mesh key={`z-${x}`} position={[x, beamY, 0]}>
            <boxGeometry args={[0.22, 0.3, depth]} />
            <meshStandardMaterial color="#d8d5cf" roughness={0.7} metalness={0.2} />
          </mesh>
        ))}
        {panels.map(([x, z]) => (
          <mesh key={`sky-${x}-${z}`} position={[x, height - 0.26, z]} rotation={[Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.6, 2.6]} />
            <meshStandardMaterial color="#eef4ff" emissive="#dfe9ff" emissiveIntensity={0.9} side={DoubleSide} />
          </mesh>
        ))}
      </group>
    );
  }
  if (layout === "timber-ceiling") {
    // Warm timber beams across a wooden ceiling.
    const xs: number[] = [];
    for (let x = -width / 2 + 1.5; x < width / 2; x += 2.2) xs.push(x);
    return (
      <group>
        {xs.map((x) => (
          <mesh key={x} position={[x, height - 0.32, 0]}>
            <boxGeometry args={[0.22, 0.32, depth - 0.4]} />
            <meshStandardMaterial color="#7a5c38" roughness={0.8} />
          </mesh>
        ))}
      </group>
    );
  }
  if (layout === "high-concrete") {
    // High concrete ceiling with exposed track rails and spot heads.
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
  if (layout === "beam-white") {
    // Bright white gallery with exposed ceiling beams (joists).
    const xs: number[] = [];
    for (let x = -width / 2 + 2; x < width / 2; x += 2.6) xs.push(x);
    return (
      <group>
        {xs.map((x) => (
          <mesh key={x} position={[x, height - 0.38, 0]}>
            <boxGeometry args={[0.26, 0.42, depth - 0.4]} />
            <meshStandardMaterial color="#f0ece1" roughness={0.85} />
          </mesh>
        ))}
      </group>
    );
  }
  if (layout === "partition-hall") {
    // A museum hall of freestanding walls: the ceiling is plain white
    // with exposed track rails and spot heads, as in the photo.
    return (
      <group>
        {[-6, 0, 6].map((x) => (
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
  if (layout === "storefront") {
    // A bright storefront gallery: plain white ceiling, two track rails.
    return (
      <group>
        {[-3.5, 3.5].map((x) => (
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
  return null;
}

function GalleryRoom({
  room,
  offsetX,
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
}: {
  room: GalleryRoom;
  offsetX: number;
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
  const wallHighlight = (wallId: string) => selectedWallId === wallId;
  const handleWallClick = (wallId: WallId | string) => {
    if (!editable || !onWallSelect || dragged?.current) return;
    onWallSelect(wallId);
  };
  // The curved room's front wall is a real arc, not a flat box face: it
  // bulges toward the viewer, so the curve reads from the outside orbit
  // view as well as from inside. Floor and ceiling extend to cover it.
  const isCurved = room.layout === "curved-wall";
  const curveRadius = 40;
  const curveHalfAngle = Math.asin(Math.min(0.95, width / 2 / curveRadius));
  const curveSagitta = curveRadius - curveRadius * Math.cos(curveHalfAngle);
  const curveCenterZ = depth / 2 - curveRadius * Math.cos(curveHalfAngle);
  const roomDepth = isCurved ? depth + curveSagitta : depth;
  const roomDepthCenter = isCurved ? curveSagitta / 2 : 0;
  const wallTexture = useMemo(() => createSurfaceTexture(room.wallTexture), [room.wallTexture]);
  const floorTexture = useMemo(() => createSurfaceTexture(room.floorTexture), [room.floorTexture]);
  const ceilingTexture = useMemo(() => createSurfaceTexture(room.ceilingTexture), [room.ceilingTexture]);
  useEffect(() => () => {
    wallTexture?.dispose();
    floorTexture?.dispose();
    ceilingTexture?.dispose();
  }, [ceilingTexture, floorTexture, wallTexture]);
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
          dragged={dragged}
          editable={editable}
          onDragStart={onDragStart}
          onHoverChange={onHoverChange}
        />
      )),
    [artworks, dragged, editable, multiSelectedIds, offsetX, onDragStart, onHoverChange, onSelect, onWalkTo, selectedId, walkable],
  );

  return (
    <group position={[offsetX, 0, 0]}>
      <mesh position={[0, height - 0.12, roomDepthCenter]} receiveShadow>
        <boxGeometry args={[width, 0.24, roomDepth]} />
        <meshStandardMaterial color={room.ceilingColor} map={ceilingTexture} roughness={0.9} />
      </mesh>
      <mesh
        position={[0, -0.09, roomDepthCenter]}
        receiveShadow
        onClick={(event) => {
          if (!walkable || dragged?.current) return;
          event.stopPropagation();
          onFloorClick?.(event.point);
        }}
      >
        <boxGeometry args={[width, 0.18, roomDepth]} />
        <meshStandardMaterial attach="material-0" color={room.floorColor} roughness={0.9} />
        <meshStandardMaterial attach="material-1" color={room.floorColor} roughness={0.9} />
        <meshStandardMaterial attach="material-2" color={room.floorColor} map={floorTexture} roughness={0.9} />
        <meshStandardMaterial attach="material-3" color={room.floorColor} roughness={0.9} />
        <meshStandardMaterial attach="material-4" color={room.floorColor} roughness={0.9} />
        <meshStandardMaterial attach="material-5" color={room.floorColor} roughness={0.9} />
      </mesh>
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
        <meshStandardMaterial color={backColor} map={wallTexture} roughness={0.88} emissive={wallHighlight("back") ? "#a67c37" : "#000000"} emissiveIntensity={wallHighlight("back") ? 0.16 : 0} />
      </mesh>
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
      />
      {isCurved ? (
        <mesh
          position={[0, height / 2, curveCenterZ]}
          receiveShadow
          onDoubleClick={(event) => {
            if (!editable || !onWallSelect || dragged?.current) return;
            event.stopPropagation();
            onWallSelect("front");
          }}
        >
          <cylinderGeometry args={[curveRadius, curveRadius, height, 64, 1, true, -curveHalfAngle, curveHalfAngle * 2]} />
          <meshStandardMaterial color={frontColor} map={wallTexture} roughness={0.88} side={DoubleSide} emissive={wallHighlight("front") ? "#a67c37" : "#000000"} emissiveIntensity={wallHighlight("front") ? 0.16 : 0} />
        </mesh>
      ) : entrance ? (
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
            <meshStandardMaterial color={frontColor} map={wallTexture} roughness={0.88} emissive={wallHighlight("front") ? "#a67c37" : "#000000"} emissiveIntensity={wallHighlight("front") ? 0.16 : 0} />
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
            <meshStandardMaterial color={frontColor} map={wallTexture} roughness={0.88} emissive={wallHighlight("front") ? "#a67c37" : "#000000"} emissiveIntensity={wallHighlight("front") ? 0.16 : 0} />
          </mesh>
          <mesh position={[0, (height + 2.5) / 2, 0]} receiveShadow>
            <boxGeometry args={[1.65, height - 2.5, 0.22]} />
            <meshStandardMaterial color={frontColor} map={wallTexture} roughness={0.88} />
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
          <meshStandardMaterial color={frontColor} map={wallTexture} roughness={0.88} emissive={wallHighlight("front") ? "#a67c37" : "#000000"} emissiveIntensity={wallHighlight("front") ? 0.16 : 0} />
        </mesh>
      )}
      {room.partitionWalls.map((wall) => (
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
          <meshStandardMaterial color={wall.color ?? room.sideWallColor} map={wallTexture} roughness={0.88} emissive={wallHighlight(wall.id) ? "#a67c37" : "#000000"} emissiveIntensity={wallHighlight(wall.id) ? 0.16 : 0} />
        </mesh>
      ))}
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
            />
          );
        })
      ) : (
        Array.from({ length: Math.max(2, Math.floor(width / 5)) }, (_, index) => {
          const spots = Math.max(2, Math.floor(width / 5));
          const x = -width / 2 + ((index + 1) * width) / (spots + 1);
          return <GallerySpotlight key={index} x={x} y={height - 0.2} z={0} targetZ={wallZ + 1} color={lights.spotColor} intensity={lights.spotIntensity} lightOn={room.lightType !== "ambient"} />;
        })
      ))}
      {room.curatorialText && (
        <group position={[0, height - 0.65, wallZ + 0.14]}>
          {/* Canvas texture, like wall text: the old troika <Text> here
              carried the same suspend-the-scene failure. */}
          <CuratorialTextPlane text={room.curatorialText} maxWidthM={Math.min(width - 2, 9)} wallColor={room.wallColor} />
        </group>
      )}
      <RoomFeatures layout={room.layout} width={width} depth={depth} height={height} />
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
        />
      ))}
    </group>
  );
}

function WalkControls({
  rooms,
  activeRoomId,
  offsets,
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
  const initialized = useRef(false);
  const velocity = useRef(new Vector3());
  const direction = useRef(new Vector3());
  const right = useRef(new Vector3());
  const stuckTime = useRef(0);
  const lastKey = useRef<string | null>(null);
  const lastReset = useRef(resetSignal?.current ?? 0);

  useEffect(() => {
    if (!initialized.current) {
      const startIndex = Math.max(0, rooms.findIndex((room) => room.id === activeRoomId));
      const startRoom = rooms[startIndex];
      camera.position.set(offsets[startIndex], 1.65, roomLayouts[startRoom.layout].depth / 2 - 1.5);
      camera.rotation.set(0, 0, 0);
      currentRoomIndex.current = startIndex;
      handledRoomId.current = activeRoomId;
      initialized.current = true;
      return;
    }
    const requestedIndex = rooms.findIndex((room) => room.id === activeRoomId);
    if (requestedIndex < 0 || handledRoomId.current === activeRoomId) return;
    const room = rooms[requestedIndex];
    const { depth } = roomLayouts[room.layout];
    camera.position.set(
      offsets[requestedIndex],
      1.65,
      depth / 2 - 1.5,
    );
    camera.rotation.set(0, 0, 0);
    currentRoomIndex.current = requestedIndex;
    handledRoomId.current = activeRoomId;
  }, [activeRoomId, camera, offsets, rooms]);

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
      camera.position.set(offsets[0], 1.65, depth / 2 - 1.5);
      camera.rotation.set(0, 0, 0);
      destination.current = null;
      lookYaw.current = null;
      velocity.current.set(0, 0, 0);
      if (currentRoomIndex.current !== 0) {
        currentRoomIndex.current = 0;
        handledRoomId.current = targetRoom.id;
        onRoomChange?.(targetRoom.id);
      }
      return;
    }
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
      direction.current.set(destinationPoint.x - camera.position.x, 0, destinationPoint.z - camera.position.z);
      if (direction.current.length() < 0.2) {
        destination.current = null;
        lookYaw.current = null;
        return;
      }
      direction.current.normalize();
      velocity.current.copy(direction.current);
      // Turn to face the destination (e.g. the artwork just clicked) while
      // walking toward it.
      if (lookYaw.current !== null) {
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
    const localX = camera.position.x - offsets[roomIndex];
    const targetX = nextX - offsets[roomIndex];
    for (const wall of room.partitionWalls) {
      if (wall.orientation === "horizontal") {
        const crossesWall = Math.min(camera.position.z, nextZ) <= wall.z + 0.2
          && Math.max(camera.position.z, nextZ) >= wall.z - 0.2;
        const overlapsWall = Math.min(localX, targetX) <= wall.x + wall.length / 2 + 0.35
          && Math.max(localX, targetX) >= wall.x - wall.length / 2 - 0.35;
        if (crossesWall && overlapsWall) {
          nextZ = camera.position.z;
        }
      } else {
        const crossesWall = Math.min(localX, targetX) <= wall.x + 0.2
          && Math.max(localX, targetX) >= wall.x - 0.2;
        const overlapsWall = Math.min(camera.position.z, nextZ) <= wall.z + wall.length / 2 + 0.35
          && Math.max(camera.position.z, nextZ) >= wall.z - wall.length / 2 - 0.35;
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
        const crossesWall = Math.min(camera.position.z, nextZ) <= element.z + 0.2
          && Math.max(camera.position.z, nextZ) >= element.z - 0.2;
        const overlapsWall = Math.min(localX, targetX) <= element.x + effectiveLength / 2 + 0.35
          && Math.max(localX, targetX) >= element.x - effectiveLength / 2 - 0.35;
        if (crossesWall && overlapsWall) {
          nextZ = camera.position.z;
        }
      } else {
        const crossesWall = Math.min(localX, targetX) <= element.x + 0.2
          && Math.max(localX, targetX) >= element.x - 0.2;
        const overlapsWall = Math.min(camera.position.z, nextZ) <= element.z + effectiveLength / 2 + 0.35
          && Math.max(camera.position.z, nextZ) >= element.z - effectiveLength / 2 - 0.35;
        if (crossesWall && overlapsWall) {
          nextX = camera.position.x;
        }
      }
    }
    const leftEdge = offsets[roomIndex] - width / 2 + 0.45;
    const rightEdge = offsets[roomIndex] + width / 2 - 0.45;
    const frontEdge = depth / 2 - 0.45;
    const backEdge = -depth / 2 + 0.55;

    if (nextZ <= frontEdge && nextZ >= backEdge) camera.position.z = nextZ;
    if (nextX >= leftEdge && nextX <= rightEdge) {
      camera.position.x = nextX;
      return;
    }

    const nextIndex = nextX < leftEdge ? roomIndex - 1 : roomIndex + 1;
    if (Math.abs(camera.position.z) < 0.9 && nextIndex >= 0 && nextIndex < rooms.length) {
      const { width: nextWidth } = roomLayouts[rooms[nextIndex].layout];
      camera.position.x = offsets[nextIndex] + (nextX < leftEdge ? 1 : -1) * (nextWidth / 2 - 3);
      camera.rotation.set(0, 0, 0);
      destination.current = null;
      lookYaw.current = null;
      currentRoomIndex.current = nextIndex;
      handledRoomId.current = rooms[nextIndex].id;
      onRoomChange?.(rooms[nextIndex].id);
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
  const offsets = useMemo(() => {
    let current = 0;
    return sceneRooms.map((sceneRoom, index) => {
      if (index > 0) {
        const previousWidth = roomLayouts[sceneRooms[index - 1].layout].width;
        const currentWidth = roomLayouts[sceneRoom.layout].width;
        current += (previousWidth + currentWidth) / 2;
      }
      return current;
    });
  }, [sceneRooms]);

  const artworkRooms = walkMode ? sceneRooms : [room];
  const artworkOffsets = walkMode ? offsets : [0];
  const destination = useRef<Vector3 | null>(null);
  const lookYaw = useRef<number | null>(null);
  const dragged = useRef(false);
  // Editor drag state: set on pointerdown on an artwork (or its resize
  // handle), read by DragHandler on every pointer move, cleared on
  // pointerup. While a drag is active the orbit controls stay off, so the
  // camera never rotates while an artwork is being moved.
  const dragRef = useRef<ArtworkDragState | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragCursor, setDragCursor] = useState<string | null>(null);
  const [hoveredArtwork, setHoveredArtwork] = useState<{ id: string; cursor: string } | null>(null);

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

  const artworkNodes = artworkRooms.map((sceneRoom, index) => (
    <GalleryRoom
      key={sceneRoom.id}
      room={sceneRoom}
      offsetX={artworkOffsets[index]}
      artworks={artworks.filter((artwork) => artwork.roomId === sceneRoom.id)}
      selectedId={selectedId}
      onSelect={onSelect}
      walkable={walkMode && walking === true && sceneRoom.id === (activeRoomId ?? room.id)}
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
      // In walk mode the visitor stays inside: shared walls keep the single
      // door wall (no doubled wall, so no z-fighting), the outer ends are
      // solid and the front stays closed, so no void or box exterior is
      // ever visible through a window or an entrance hole.
      leftOpening={walkMode ? (index > 0 ? "none" : "solid") : "window"}
      rightOpening={walkMode ? (index < sceneRooms.length - 1 ? "door" : "solid") : "window"}
      entrance={false}
    />
  ));
  const startRoom = sceneRooms[Math.max(0, sceneRooms.findIndex((sceneRoom) => sceneRoom.id === (activeRoomId ?? room.id)))];
  const startIndex = Math.max(0, sceneRooms.findIndex((sceneRoom) => sceneRoom.id === (activeRoomId ?? room.id)));
  const startOffset = offsets[startIndex];
  const startDepth = roomLayouts[startRoom.layout].depth;
  const interiorView = interior === true && !walkMode;
  const interiorLimits = useMemo(() => {
    const layout = roomLayouts[room.layout];
    return interiorOrbitLimits(layout.width, layout.depth, layout.height);
  }, [room.layout]);
  // The active room's light mood drives the scene's ambient and
  // directional light (the per-artwork spots follow it inside GalleryRoom).
  const sceneLights = LIGHT_PRESETS[room.lightType ?? "spot-warm"];
  // Drag vs click: a pointer that moved more than a few pixels is an
  // orbit drag, not a click — walls and artworks must not select then.
  const dragStartPoint = useRef<{ x: number; y: number } | null>(null);

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
      <Canvas camera={{ position: interiorView ? [0, 2.0, startDepth / 2 - 1.8] : walkMode ? [startOffset, 1.65, startDepth / 2 - 1.5] : [0, 3.2, 11], fov: interiorView ? 60 : walkMode ? 75 : 43 }} dpr={[1, 1.6]} shadows>
        <color attach="background" args={[room.wallColor]} />
        <ambientLight intensity={sceneLights.ambient} />
        <directionalLight position={[-3, 8, 4]} intensity={sceneLights.directional} color={sceneLights.directionalColor} />
        {sceneRooms.map((sceneRoom, index) => <pointLight key={`light-${sceneRoom.id}`} position={[offsets[index], 4, -2]} intensity={sceneLights.pointIntensity} color={sceneLights.pointColor} />)}
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
          <WalkControls rooms={sceneRooms} activeRoomId={activeRoomId ?? room.id} offsets={offsets} input={input} destination={destination} lookYaw={lookYaw} dragged={dragged} enabled={walking ?? false} onRoomChange={onRoomChange} resetSignal={resetSignal} />
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
    </div>
  );
}
