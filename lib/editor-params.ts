// Editor customisation constants — ported from Claude's work on the
// standalone HTML file (sanaa-parametres-actuels.html). Every value
// here is a single source of truth for the editor UI and the 3D scene:
// change one and both follow. Nothing in this file imports from the
// rest of the app, so any module can import it without a cycle.

import type { SunlightElementType } from "@/lib/sunlight-elements";
import type { ElementType } from "@/lib/elements";

// Eye height (metres): the first-person camera height, and the y of
// every gallery's cameraStart. Claude lowered it 1.65 → 1.6 in the
// HTML file; the defs carry the same value (see lib/sunlight.ts and
// lib/gallery-defs.ts).
export const EYE_HEIGHT = 1.6;

// --- Camera view presets (the HUD "View" buttons) ----------------------
// eye: back to eye level, level pitch, keep position and yaw.
// wide: a high wide shot from the front-right corner.
// high / plan: from above — the ceiling is hidden for these, so the
// room reads from the top (the editor passes hideCeiling to the scene).
export type CameraViewPreset = "eye" | "wide" | "high" | "plan";

export const VIEW_PRESETS: Record<
  CameraViewPreset,
  { label: string; y: number; pitch: number; x?: number; z?: number; yaw?: number; hideCeiling: boolean }
> = {
  eye: { label: "Eye", y: EYE_HEIGHT, pitch: 0, hideCeiling: false },
  wide: { label: "Wide", y: 4.2, pitch: -0.3, x: 9.5, z: 10.5, yaw: 0.785, hideCeiling: false },
  high: { label: "High", y: 11, pitch: -0.95, x: 0, z: 11, yaw: 0, hideCeiling: true },
  plan: { label: "Plan", y: 22, pitch: -1.55, x: 0, z: -1, yaw: 0, hideCeiling: true },
} as const;

// How fast the camera height eases toward a view preset's height
// (per second, as in the HTML file: y += (target − y) × min(1, dt × 5)).
export const CAMERA_HEIGHT_EASE = 5;

// Walk-velocity smoothing (8 Nov 2026): the first-person velocity eases
// toward its target with exponential damping instead of jumping to full
// speed the frame a key is pressed and stopping dead the frame it is
// released — that instant on/off was the jerkiness.
// WALK_ACCEL: how fast the velocity rises toward its target (per
// second) — ~95% of top speed in ~0.3 s, brisk but smooth.
// WALK_DECEL: how fast it falls back to zero (per second) — the camera
// glides ~0.5 m to a stop in ~0.4 s instead of halting dead.
// WALK_ARRIVE_DIST: click-to-move slows down inside this distance (m),
// so the camera eases into its target instead of stopping on it.
// WALK_STOP_EPS: below this speed (m/s) the velocity snaps to zero so
// the camera never creeps forever.
export const WALK_ACCEL = 10;
export const WALK_DECEL = 7;
export const WALK_ARRIVE_DIST = 1.5;
export const WALK_STOP_EPS = 0.02;

// --- Ceiling finishes ---------------------------------------------------
// One choice sets the ceiling colour AND roughness together, and syncs
// the ceiling colour picker (the HTML file's CF table).
export type CeilingFinishKey = "blanc" | "beton" | "bois" | "boisfonce" | "noir" | "pierre";

export const CEILING_FINISHES: Record<CeilingFinishKey, { label: string; color: string; roughness: number }> = {
  blanc: { label: "White", color: "#fafaf8", roughness: 0.95 },
  beton: { label: "Concrete", color: "#b9b6ae", roughness: 0.7 },
  bois: { label: "Light wood", color: "#c9a877", roughness: 0.5 },
  boisfonce: { label: "Dark wood", color: "#5a4632", roughness: 0.5 },
  noir: { label: "Black", color: "#2a2a2c", roughness: 0.6 },
  pierre: { label: "Stone", color: "#d9cfb8", roughness: 0.8 },
} as const;

export const CEILING_FINISH_KEYS = ["blanc", "beton", "bois", "boisfonce", "noir", "pierre"] as const;

// --- Floor patterns -----------------------------------------------------
// Procedurally generated floor textures (the HTML file's fpat): the
// checkerboard is 8 × 8, the parquet is planked, the herringbone is a
// zigzag. "original" keeps the room's own floor. A non-original pattern
// resets the floor colour to white, so the pattern reads true.
export type FloorPatternKey = "original" | "parquet" | "chevrons" | "damier";

export const FLOOR_PATTERNS: Record<FloorPatternKey, { label: string }> = {
  original: { label: "Original" },
  parquet: { label: "Parquet" },
  chevrons: { label: "Herringbone" },
  damier: { label: "Checkerboard" },
} as const;

export const FLOOR_PATTERN_KEYS = ["original", "parquet", "chevrons", "damier"] as const;

// Floor shine (0–95, default 70): floor roughness = 1 − shine / 100.
// The default gives roughness 0.3 — the Sunlight floor's current value.
export const FLOOR_SHINE_DEFAULT = 70;
export const FLOOR_SHINE_MIN = 0;
export const FLOOR_SHINE_MAX = 95;

// --- Partition dimensions (cloison / suspendu) --------------------------
// Sliders in the element inspector when a partition is selected
// (the HTML file's pL / pH / pT). Length and height in metres,
// thickness in metres.
export const PARTITION_DIMS = {
  length: { min: 1, max: 14, step: 0.1, default: 3 },
  height: { min: 1.5, max: 4.8, step: 0.1, default: 3 },
  thickness: { min: 0.05, max: 0.6, step: 0.01, default: 0.15 },
} as const;

// Per-type partition defaults (the HTML file's L0 / H0 / T0 / Y0):
// a cloison stands on the floor (Y0 0), a suspendu hangs from the
// ceiling (Y0 1.1, panel 2.4 high). The generic Asset Library
// partition is a cloison.
export const PARTITION_TYPE_DEFAULTS: Record<
  "partition" | "cloison" | "suspendu",
  { length: number; height: number; thickness: number; y0: number }
> = {
  partition: { length: 3, height: 3, thickness: 0.15, y0: 0 },
  cloison: { length: 3, height: 3, thickness: 0.15, y0: 0 },
  suspendu: { length: 3, height: 2.4, thickness: 0.1, y0: 1.1 },
} as const;

// Which element types are partitions (hangable walls whose artworks
// follow them when they move, turn or resize).
export const PARTITION_ELEMENT_TYPES: ReadonlySet<string> = new Set(["partition", "cloison", "suspendu"]);

export function isPartitionElementType(type: string): boolean {
  return PARTITION_ELEMENT_TYPES.has(type);
}

// Resolve a generic Asset Library element's partition dimensions
// (length lives on the element already; height/thickness default per
// type when an older save has none).
export function partitionDimsOf(element: {
  type: ElementType;
  length?: number;
  height?: number;
  thickness?: number;
}): { length: number; height: number; thickness: number; y0: number } {
  const defaults = PARTITION_TYPE_DEFAULTS.partition;
  return {
    length: element.length ?? defaults.length,
    height: element.height ?? defaults.height,
    thickness: element.thickness ?? defaults.thickness,
    y0: defaults.y0,
  };
}

// Resolve a Sunlight element's partition dimensions (cloison/suspendu
// only; the other types are not partitions).
export function sunlightPartitionDimsOf(element: {
  type: SunlightElementType;
  length?: number;
  height?: number;
  thickness?: number;
}): { length: number; height: number; thickness: number; y0: number } {
  const defaults =
    element.type === "suspendu" ? PARTITION_TYPE_DEFAULTS.suspendu : PARTITION_TYPE_DEFAULTS.cloison;
  return {
    length: element.length ?? defaults.length,
    height: element.height ?? defaults.height,
    thickness: element.thickness ?? defaults.thickness,
    y0: defaults.y0,
  };
}
