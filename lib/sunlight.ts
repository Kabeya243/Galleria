// Sunlight Gallery — the single gallery of SANAA, ported exactly from
// Kabeya's Three.js reference room ("Galerie lumière", r128).
//
// EVERY number here comes from that file: room 22 × 26 m, ceiling 5 m,
// the seven skylight openings, the three freestanding panels, the two
// pedestals and their sculptures, the double door, the dark band, the
// sun, the IBL environment and the first-person navigation (camera
// start, bounds, collision blocks, minimap mapping). Do not "improve"
// any of it — the reference room IS the design. The only authorised
// change is the image resolution (4k+, see compressImage in
// components/editor.tsx).
//
// Coordinates are ROOM-LOCAL: the room is centred on x = 0 and its
// floor spans z = −14 … +12 (centre z = −1), exactly as in the source.
// A room's world position is its plan offset (see roomPlanOffsets);
// navigation bounds and collision blocks are local to the room.

export const SUNLIGHT_WIDTH = 22;
export const SUNLIGHT_DEPTH = 26;
export const SUNLIGHT_HEIGHT = 5;
// The floor plane is centred on z = −1 in the source (22 × 26 m at
// z = −1), so the back wall sits at z = −14.15 and the front at +12.15.
export const SUNLIGHT_FLOOR_CENTER_Z = -1;

export const SUNLIGHT_WALL_COLOR = "#f6f6f4";
export const SUNLIGHT_FLOOR_COLOR = "#a9aaad";
export const SUNLIGHT_CEILING_COLOR = "#fafaf8";
export const SUNLIGHT_BACKGROUND = "#dfe6ee";

// Ceiling openings: [centre x, centre z, width, depth, kind] — "d" is a
// white diffusing panel (with a warm point light under it), "s" is a
// sky panel (hidden by default, so direct sun comes through).
export const SUNLIGHT_HOLES: [number, number, number, number, "d" | "s"][] = [
  [-6, 4, 4, 3.2, "d"],
  [-6, -1.5, 4, 3.2, "d"],
  [-0.5, 1.5, 3, 2.6, "d"],
  [5, 0, 6, 3.4, "s"],
  [6, -7, 5, 3, "s"],
  [0, -9, 4, 3, "s"],
  [-7, -9, 3, 3, "d"],
];

// Freestanding panels: [x, z, rotation (yaw), length]. 4.4 m high,
// 0.3 m thick. Artworks hang on them (see seedSunlightArtworks).
export const SUNLIGHT_PANELS: { x: number; z: number; ry: number; len: number }[] = [
  { x: -3, z: -4, ry: 0.8, len: 7.5 },
  { x: -7.5, z: -9, ry: 0.4, len: 6 },
  { x: 5, z: -8.5, ry: -0.65, len: 7 },
];

// Pedestals: [x, z, width, height]. Each carries a sculpture.
export const SUNLIGHT_PEDESTALS: { x: number; z: number; w: number; h: number }[] = [
  { x: -3, z: 3, w: 0.9, h: 1.15 },
  { x: -8, z: 0.5, w: 0.6, h: 0.9 },
];

// Collision blocks — the panels and the pedestals, as rotated
// rectangles: [x, z, rotation, half-length, half-width]. The visitor
// is a 0.4 m body around the camera, so the hit test adds 0.4 m.
export type SunlightBlock = { x: number; z: number; ry: number; hl: number; hw: number };
export const SUNLIGHT_BLOCKS: SunlightBlock[] = [
  ...SUNLIGHT_PANELS.map((panel) => ({ x: panel.x, z: panel.z, ry: panel.ry, hl: panel.len / 2, hw: 0.15 })),
  ...SUNLIGHT_PEDESTALS.map((pedestal) => ({ x: pedestal.x, z: pedestal.z, ry: 0, hl: pedestal.w / 2, hw: pedestal.w / 2 })),
];

// Sun colour by light type (the reference file's light ambiances):
// the room's light type drives the Sunlight sun colour, so the editor's
// LIGHT TYPE selector visibly changes the light. "sunlight" is the
// reference sun (#fff0d8); the other four are the file's ambiances
// (soft #fff6ea, warm #ffe2b8, cool #dfeaff, stone warm #ffd9a0).
export const SUN_COLOR_BY_LIGHT_TYPE: Record<string, string> = {
  sunlight: "#fff0d8",
  "spot-warm": "#ffe2b8",
  "spot-cool": "#dfeaff",
  ambient: "#fff6ea",
  "stone-warm": "#ffd9a0",
};

export function sunlightSunColor(lightType?: string | null): string {
  return SUN_COLOR_BY_LIGHT_TYPE[lightType ?? "sunlight"] ?? SUN_COLOR_BY_LIGHT_TYPE.sunlight;
}

// First-person navigation (from the source): the camera is bounded
// inside the room, and the collision test keeps it out of the blocks.
export const SUNLIGHT_BOUNDS = { minX: -10.4, maxX: 10.4, minZ: -13.4, maxZ: 11.4 };
export const SUNLIGHT_WALK_SPEED = 4; // m/s
export const SUNLIGHT_CAMERA_START = { x: 3.5, y: 1.6, z: 10.5, yaw: 0.3, pitch: -0.04 };

// The rotated-rectangle hit test from the source: true when the point
// is inside a block (with the 0.4 m body margin). sunlightHitWith
// tests a caller-supplied block list, so the walk controls can combine
// the room's fixed blocks with the blocks of the Sunlight elements the
// user added (cloison, colonne, socle, vitrine, banc, fauteuils…):
// the visitor cannot walk through an added wall or plinth, and a
// moved element's block follows it because the list is rebuilt from
// the room's current elements. The spotlight contributes no block.
export function sunlightHitWith(blocks: SunlightBlock[], x: number, z: number): boolean {
  for (const b of blocks) {
    const dx = x - b.x;
    const dz = z - b.z;
    const c = Math.cos(b.ry);
    const s = Math.sin(b.ry);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    if (Math.abs(lx) < b.hl + 0.4 && Math.abs(lz) < b.hw + 0.4) return true;
  }
  return false;
}

export function sunlightHit(x: number, z: number): boolean {
  return sunlightHitWith(SUNLIGHT_BLOCKS, x, z);
}

// Mini-plan mapping (from the source): room-local coordinates to a
// 240 × 280 canvas. The back wall (most negative z) is at the top.
export const SUNLIGHT_MAP_WIDTH = 240;
export const SUNLIGHT_MAP_HEIGHT = 280;
export function sunlightMapX(x: number): number {
  return ((x + 11) / 22) * SUNLIGHT_MAP_WIDTH;
}
export function sunlightMapZ(z: number): number {
  return ((z + 14) / 26) * SUNLIGHT_MAP_HEIGHT;
}
export function sunlightMapPoint(clientX: number, clientY: number, rect: { left: number; top: number; width: number; height: number }): { x: number; z: number } {
  return {
    x: Math.max(SUNLIGHT_BOUNDS.minX, Math.min(SUNLIGHT_BOUNDS.maxX, ((clientX - rect.left) / rect.width) * 22 - 11)),
    z: Math.max(SUNLIGHT_BOUNDS.minZ, Math.min(SUNLIGHT_BOUNDS.maxZ, ((clientY - rect.top) / rect.height) * 26 - 14)),
  };
}
