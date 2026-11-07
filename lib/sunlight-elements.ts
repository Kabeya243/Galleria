// Sunlight 3D elements — the placeable objects from Kabeya's second
// Three.js reference room ("Galerie lumière", the version WITH
// additions). These are NOT the Asset Library accessories
// (lib/elements.ts): the two systems coexist. The Asset Library is the
// editor's furniture palette; these are the reference room's own
// addable pieces (partition walls, columns, plinths, vitrines, benches,
// armchairs, spotlights) plus its curatorial wall text.
//
// Every number here comes from that file (the OB table and mkObj):
// dimensions, colours and geometries are exact. Do not "improve" any
// of it. Elements are stored per room (rooms[].sunlightElements) so
// they travel with the exhibition save — no database migration — and
// are restored on load. The spotlight's SpotLight is rebuilt from the
// element on render, so it lights again after a reload.
//
// Coordinates are ROOM-LOCAL (the Sunlight room is centred on x = 0,
// floor z = −14 … +12, centre z = −1), exactly like the room itself.

import { z } from "zod";
import type { SunlightBlock } from "@/lib/sunlight";
import { SUNLIGHT_PANELS } from "@/lib/sunlight";
import { sunlightPartitionDimsOf } from "@/lib/editor-params";

// The fourteen addable pieces, in the file's select order.
export const SUNLIGHT_ELEMENT_TYPES = [
  "cloison",
  "suspendu",
  "colonne",
  "socle60",
  "socle90",
  "socle120",
  "vitrine",
  "banc",
  "club",
  "bergere",
  "scandi",
  "coque",
  "tub",
  "spot",
] as const;

export type SunlightElementType = (typeof SUNLIGHT_ELEMENT_TYPES)[number];

// A spotlight is a real light, so the room caps them (the file's
// "8 spotlights maximum").
export const SUNLIGHT_MAX_SPOTS = 8;

export const sunlightElementSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(SUNLIGHT_ELEMENT_TYPES),
  name: z.string().trim().min(1).max(60),
  // Floor position (room-local). Every element stands on the floor
  // (y = 0); the suspended wall hangs its panel from the ceiling
  // inside its own group, like the source.
  x: z.number().min(-20).max(20),
  z: z.number().min(-20).max(20),
  rotation: z.number().finite().min(-Math.PI * 8).max(Math.PI * 8).default(0),
  color: z.string().regex(/^#[\da-f]{6}$/i).default("#f2f2f0"),
  // Partition dimensions (Claude's pL / pH / pT sliders, cloison and
  // suspendu only): panel length, height and thickness in metres.
  // Absent on older saves, resolved by sunlightPartitionDimsOf in
  // lib/editor-params.ts.
  length: z.number().min(0.5).max(14).optional(),
  height: z.number().min(1).max(5).optional(),
  thickness: z.number().min(0.05).max(0.6).optional(),
});

export type SunlightElement = z.infer<typeof sunlightElementSchema>;

// Defaults from the file's OB table: [colour, collision half-length,
// collision half-width]. A half-extent of 0 means no collision block
// (the spotlight stands on nothing — it hangs from the ceiling — so
// it never blocks the walk).
export const SUNLIGHT_ELEMENT_DEFAULTS: Record<
  SunlightElementType,
  { label: string; color: string; hl: number; hw: number }
> = {
  cloison: { label: "Middle wall (partition)", color: "#f2f2f0", hl: 1.5, hw: 0.1 },
  suspendu: { label: "Hanging wall", color: "#f2f2f0", hl: 1.5, hw: 0.1 },
  colonne: { label: "Column", color: "#f2f2f0", hl: 0.25, hw: 0.25 },
  socle60: { label: "Pedestal 60 cm", color: "#f2f2f0", hl: 0.25, hw: 0.25 },
  socle90: { label: "Pedestal 90 cm", color: "#f2f2f0", hl: 0.25, hw: 0.25 },
  socle120: { label: "Pedestal 120 cm", color: "#f2f2f0", hl: 0.25, hw: 0.25 },
  vitrine: { label: "Display case", color: "#f2f2f0", hl: 0.3, hw: 0.3 },
  banc: { label: "Bench", color: "#b98a5a", hl: 1.1, hw: 0.25 },
  club: { label: "Club armchair", color: "#8b4a2b", hl: 0.45, hw: 0.45 },
  bergere: { label: "Bergère armchair", color: "#2f5d62", hl: 0.45, hw: 0.45 },
  scandi: { label: "Scandinavian armchair", color: "#d9c9b0", hl: 0.4, hw: 0.4 },
  coque: { label: "Shell armchair", color: "#e0572a", hl: 0.45, hw: 0.45 },
  tub: { label: "Barrel armchair", color: "#5a5a5e", hl: 0.45, hw: 0.45 },
  // The spotlight fixture is two small cylinders at the ceiling; it
  // has no collision block (hl = hw = 0) and never blocks the walk.
  spot: { label: "Spotlight", color: "#1a1a1a", hl: 0, hw: 0 },
};

// Drag bounds for a Sunlight element on the floor (the file's moveO):
// a little inside the room bounds so the piece never leaves the room.
export const SUNLIGHT_ELEMENT_BOUNDS = { minX: -10.3, maxX: 10.3, minZ: -13.3, maxZ: 11.3 };

// Collision blocks of a room's Sunlight elements, for the walk
// controls: the same rotated-rectangle shape as the room's own
// blocks, following each element's position and rotation. Elements
// without a block (the spotlight) contribute nothing. A cloison or
// suspendu uses its own dimensions (length / thickness), so a resized
// partition blocks exactly where it stands.
export function sunlightElementCollisionBlocks(elements: SunlightElement[]): SunlightBlock[] {
  const blocks: SunlightBlock[] = [];
  for (const element of elements) {
    const defaults = SUNLIGHT_ELEMENT_DEFAULTS[element.type];
    if (!defaults || defaults.hl <= 0 || defaults.hw <= 0) continue;
    if (element.type === "cloison" || element.type === "suspendu") {
      const dims = sunlightPartitionDimsOf(element);
      blocks.push({ x: element.x, z: element.z, ry: element.rotation, hl: dims.length / 2, hw: dims.thickness / 2 });
    } else {
      blocks.push({ x: element.x, z: element.z, ry: element.rotation, hl: defaults.hl, hw: defaults.hw });
    }
  }
  return blocks;
}

export function createSunlightElement(
  type: SunlightElementType,
  x: number,
  z: number,
  number: number,
): SunlightElement {
  const defaults = SUNLIGHT_ELEMENT_DEFAULTS[type];
  return {
    id: crypto.randomUUID(),
    type,
    name: `${defaults.label} ${number + 1}`.slice(0, 60),
    x: Math.round(x * 100) / 100,
    z: Math.round(z * 100) / 100,
    rotation: 0,
    color: defaults.color,
  };
}

// --- Curatorial wall text -------------------------------------------------
// The reference room's text panel: a 640 px canvas, word-wrapped, on a
// #f6f6f4 ground with #2a2623 text, drawn as an artwork (mkArt) with
// userData.txt = { s: text, f: font }. Four typefaces, in the file's
// select order.

export const SUNLIGHT_TEXT_FONTS = {
  d: { label: "Bold display", font: "bold 40px Georgia" },
  s: { label: "Clean sans", font: "34px Helvetica,Arial,sans-serif" },
  g: { label: "Serif", font: "34px Georgia" },
  m: { label: "Typewriter", font: "32px Courier New,monospace" },
} as const;

export type SunlightTextFont = keyof typeof SUNLIGHT_TEXT_FONTS;

export const SUNLIGHT_TEXT_FONT_KEYS = ["d", "s", "g", "m"] as const;

export const SUNLIGHT_TEXT_WIDTH_PX = 640;
export const SUNLIGHT_TEXT_LINE_HEIGHT_PX = 48;
// The text panel is 1.4 m wide (the file's mkText), like the artwork
// it becomes; its height follows the wrapped text.
export const SUNLIGHT_TEXT_WIDTH_M = 1.4;

// The reference room's spotlight: a real SpotLight, warm like the sun.
export const SUNLIGHT_SPOT = {
  color: 0xfff0d8,
  intensity: 3,
  distance: 18,
  angle: 0.5,
  penumbra: 0.6,
  decay: 1.5,
  // Fixture (local): the light sits at the ceiling, its target 3 m
  // out at 1.6 m high, so the beam falls forward and down.
  lightY: 4.7,
  target: { x: 0, y: 1.6, z: 3 },
} as const;

// Build the curatorial-text canvas (the file's mkText): 640 px wide,
// word-wrapped at W − 60, 48 px lines, 60 px of padding. Returns the
// canvas and its size; the caller turns it into a texture. Browser
// only (needs a 2D canvas context).
export function createSunlightTextCanvas(
  text: string,
  font: SunlightTextFont,
): { canvas: HTMLCanvasElement; width: number; height: number } {
  const W = SUNLIGHT_TEXT_WIDTH_PX;
  const lh = SUNLIGHT_TEXT_LINE_HEIGHT_PX;
  const F = SUNLIGHT_TEXT_FONTS[font].font;
  const canvas = document.createElement("canvas");
  canvas.width = W;
  const g = canvas.getContext("2d");
  if (!g) return { canvas, width: W, height: lh + 60 };
  g.font = F;
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(" ")) {
      const test = line ? `${line} ${word}` : word;
      if (g.measureText(test).width > W - 60 && line) {
        lines.push(line);
        line = word;
      } else {
        line = test;
      }
    }
    lines.push(line);
  }
  canvas.height = lines.length * lh + 60;
  g.fillStyle = "#f6f6f4";
  g.fillRect(0, 0, W, canvas.height);
  g.fillStyle = "#2a2623";
  g.font = F;
  lines.forEach((line, i) => g.fillText(line, 30, 50 + i * lh));
  return { canvas, width: W, height: canvas.height };
}

// Size of a curatorial-text artwork in metres (the file's mkText):
// 1.4 m wide, height following the wrapped text. Used when the text is
// created or modified, so the artwork's dimensions field matches the
// panel it renders.
export function sunlightTextArtworkSize(text: string, font: SunlightTextFont): { width: number; height: number } {
  const { width, height } = createSunlightTextCanvas(text, font);
  const w = SUNLIGHT_TEXT_WIDTH_M;
  return { width: w, height: (w * height) / width };
}

// --- Hangable walls -------------------------------------------------------
// Every wall that can carry an artwork or a curatorial text: the four
// room walls, the three freestanding panels, AND the walls the user
// added (cloison, suspendu). The added walls were not hangable before:
// they lived in the objects list, never in the wall raycast. They are
// now registered here, so an artwork or a text can be placed on ANY
// wall, including one just added — on either face of a freestanding
// wall (cloison, suspendu, panel), since both faces are tested.
//
// A wall face is a vertical plane: a horizontal unit normal, a point
// on the plane, the wall's length axis, half its length, and its
// height range. Room walls only offer their interior face (an artwork
// never hangs on the outside of the room); freestanding walls offer
// both faces.

export type HangWallFace = {
  id: string;
  // Unit horizontal normal of this face.
  nx: number;
  nz: number;
  // A point on the face (the wall centre).
  cx: number;
  cz: number;
  // Unit horizontal axis along the wall's length.
  ax: number;
  az: number;
  halfLen: number;
  minY: number;
  maxY: number;
};

// All hangable wall faces of a Sunlight room, from the room's fixed
// geometry (lib/sunlight.ts) plus its added Sunlight elements.
export function sunlightHangWalls(elements: SunlightElement[]): HangWallFace[] {
  const faces: HangWallFace[] = [];
  // Room walls (interior faces only). Back wall z = −14 (normal +z),
  // front wall z = +12 (normal −z), left x = −11 (normal +x), right
  // x = +11 (normal −x). The room spans x −11…11, z −14…12, y 0…5.
  faces.push(
    { id: "back", nx: 0, nz: 1, cx: 0, cz: -14, ax: 1, az: 0, halfLen: 11, minY: 0, maxY: 5 },
    { id: "front", nx: 0, nz: -1, cx: 0, cz: 12, ax: 1, az: 0, halfLen: 11, minY: 0, maxY: 5 },
    { id: "left", nx: 1, nz: 0, cx: -11, cz: -1, ax: 0, az: 1, halfLen: 13, minY: 0, maxY: 5 },
    { id: "right", nx: -1, nz: 0, cx: 11, cz: -1, ax: 0, az: 1, halfLen: 13, minY: 0, maxY: 5 },
  );
  // Freestanding panels (both faces). The panel group is rotated y =
  // ry, so its local +X maps to world (cos ry, −sin ry) and its local
  // +Z (the face normal) to (sin ry, cos ry).
  for (const panel of SUNLIGHT_PANELS) {
    const nx = Math.sin(panel.ry);
    const nz = Math.cos(panel.ry);
    const ax = Math.cos(panel.ry);
    const az = -Math.sin(panel.ry);
    faces.push(
      { id: `panel-${panel.x},${panel.z}+`, nx, nz, cx: panel.x, cz: panel.z, ax, az, halfLen: panel.len / 2, minY: 0, maxY: 4.4 },
      { id: `panel-${panel.x},${panel.z}-`, nx: -nx, nz: -nz, cx: panel.x, cz: panel.z, ax, az, halfLen: panel.len / 2, minY: 0, maxY: 4.4 },
    );
  }
  // Added walls (both faces). Cloison: a wall on the floor, height
  // from its dimensions (default 3 m). Suspendu: hangs from the
  // ceiling on two rods, its panel starting at y 1.1 (default 2.4 m
  // high, so it spans y 1.1…3.5). The faces follow the element's own
  // length and height, so a resized partition stays hangable over its
  // whole surface.
  for (const element of elements) {
    if (element.type !== "cloison" && element.type !== "suspendu") continue;
    const dims = sunlightPartitionDimsOf(element);
    const nx = Math.sin(element.rotation);
    const nz = Math.cos(element.rotation);
    const ax = Math.cos(element.rotation);
    const az = -Math.sin(element.rotation);
    const minY = dims.y0;
    const maxY = dims.y0 + dims.height;
    faces.push(
      { id: `${element.id}+`, nx, nz, cx: element.x, cz: element.z, ax, az, halfLen: dims.length / 2, minY, maxY },
      { id: `${element.id}-`, nx: -nx, nz: -nz, cx: element.x, cz: element.z, ax, az, halfLen: dims.length / 2, minY, maxY },
    );
  }
  return faces;
}

export type HangWallHit = {
  // The point on the wall face, in room-local coordinates.
  point: { x: number; y: number; z: number };
  // The face normal (unit, horizontal), pointing at the camera.
  normal: { x: number; z: number };
  face: HangWallFace;
};

// Raycast a ray against a list of hangable wall faces (the file's
// wallHit, shared by Sunlight and the generic rooms): the nearest face
// whose plane the ray meets inside the wall's extent. Only a face
// whose normal points back at the ray origin counts — a freestanding
// wall (cloison, suspendu, panel) carries both faces on the same
// plane, and without this the first-listed face would win even when
// the camera stands on the other side, hanging the work behind the
// wall where it cannot be seen. Returns null when the ray meets no
// wall (ceiling, floor, or out of the room) — the caller falls back
// to the back wall.
export function raycastHangWalls(
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  faces: HangWallFace[],
): HangWallHit | null {
  let best: HangWallHit | null = null;
  let bestT = Infinity;
  for (const face of faces) {
    // Ray-plane: t = ((C − O)·n) / (D·n). The plane is vertical, so
    // only the horizontal components matter.
    const denom = direction.x * face.nx + direction.z * face.nz;
    if (Math.abs(denom) < 1e-6) continue;
    const t = ((face.cx - origin.x) * face.nx + (face.cz - origin.z) * face.nz) / denom;
    if (!(t > 0) || t >= bestT) continue;
    const px = origin.x + direction.x * t;
    const py = origin.y + direction.y * t;
    const pz = origin.z + direction.z * t;
    // Inside the wall's extent? Along its length and its height.
    const along = (px - face.cx) * face.ax + (pz - face.cz) * face.az;
    if (Math.abs(along) > face.halfLen) continue;
    if (py < face.minY || py > face.maxY) continue;
    // The face must look back at the ray origin: a freestanding wall's
    // two faces share one plane, so the side facing the camera is the
    // one whose normal points at it.
    if ((origin.x - px) * face.nx + (origin.z - pz) * face.nz <= 0) continue;
    bestT = t;
    best = { point: { x: px, y: py, z: pz }, normal: { x: face.nx, z: face.nz }, face };
  }
  return best;
}

export function sunlightWallHit(
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  elements: SunlightElement[],
): HangWallHit | null {
  return raycastHangWalls(origin, direction, sunlightHangWalls(elements));
}

// The hangable face nearest to a position (by perpendicular distance
// to the face plane): for a dropped artwork that landed past its
// wall's end, so the drag-end snap can put it on the closest wall
// instead of leaving it floating mid-air. Only faces the position
// stands in front of (within 0.5 m past the wall's length and height)
// count.
export function nearestHangWall(
  position: { x: number; y: number; z: number },
  faces: HangWallFace[],
): { face: HangWallFace; rotation: number; distance: number } | null {
  let best: { face: HangWallFace; rotation: number; distance: number } | null = null;
  for (const face of faces) {
    const dist = (position.x - face.cx) * face.nx + (position.z - face.cz) * face.nz;
    if (dist < -0.05) continue;
    const along = (position.x - face.cx) * face.ax + (position.z - face.cz) * face.az;
    if (Math.abs(along) > face.halfLen + 0.5) continue;
    if (position.y < face.minY - 0.5 || position.y > face.maxY + 0.5) continue;
    if (best && dist >= best.distance) continue;
    best = { face, rotation: Math.atan2(face.nx, face.nz), distance: dist };
  }
  return best;
}

// Two wall rotations are the same wall when they agree modulo a full
// turn (a wall at 0 and an artwork at 2π face the same way). Used when
// a drag already turned an artwork onto a new wall: the snap keeps the
// wall the artwork faces instead of yanking it back to the old one.
export function rotationMatches(a: number, b: number, tolerance = 0.12): boolean {
  const diff = Math.abs(a - b) % (Math.PI * 2);
  return Math.min(diff, Math.PI * 2 - diff) <= tolerance;
}

// Which hangable walls a position sits on: every face whose plane the
// position is within 0.45 m of (in front of, along the normal — an
// artwork hangs 0.1 m off its wall, and a drag may land it a little
// further out) and whose extent contains it. Interior walls (panels
// and added cloisons/suspendus) come first: they stand inside the
// room, so a position can be near both one of them and a room wall at
// once, and the interior wall is the one the artwork hangs on. Each
// face carries the rotation an artwork on it must have (atan2 of its
// normal), so a dragged artwork turns to face its new wall. Used by
// the editor's auto-rotate (artworks and curatorial texts alike).
export function sunlightWallsForPosition(
  position: { x: number; y: number; z: number },
  elements: SunlightElement[],
): { key: string; rotation: number }[] {
  const interior: { key: string; rotation: number }[] = [];
  const roomWalls: { key: string; rotation: number }[] = [];
  for (const face of sunlightHangWalls(elements)) {
    // Distance from the position to the face plane, along the normal.
    const dist = (position.x - face.cx) * face.nx + (position.z - face.cz) * face.nz;
    if (dist < -0.05 || dist > 0.45) continue;
    // Along the wall: inside its length (with a small margin).
    const along = (position.x - face.cx) * face.ax + (position.z - face.cz) * face.az;
    if (Math.abs(along) > face.halfLen + 0.3) continue;
    // Height: inside the wall's height range (with a small margin).
    if (position.y < face.minY - 0.3 || position.y > face.maxY + 0.3) continue;
    const wall = { key: face.id, rotation: Math.atan2(face.nx, face.nz) };
    if (face.id === "back" || face.id === "front" || face.id === "left" || face.id === "right") {
      roomWalls.push(wall);
    } else {
      interior.push(wall);
    }
  }
  return [...interior, ...roomWalls];
}

// Place an artwork (or a text panel) on a wall hit (the file's
// putOnWall): the artwork stands 0.1 m off the wall face (the Sunlight
// seed offset, so the frame clears the wall), oriented by the wall
// normal, its centre clamped inside the wall's height range and its
// length so the work stays fully on the wall. `alongOffset` shifts the
// placement along the wall (metres) — consecutive adds spread out
// instead of stacking on the same spot. Returns the artwork's position
// and rotation.
export function sunlightPlaceOnWall(
  hit: HangWallHit,
  artworkHeight: number,
  artworkWidth: number,
  alongOffset = 0,
): { position: [number, number, number]; rotation: number } {
  const halfH = artworkHeight / 2;
  const halfW = artworkWidth / 2;
  const minY = hit.face.minY + halfH + 0.05;
  const maxY = hit.face.maxY - halfH - 0.05;
  const y = Math.min(Math.max(hit.point.y, minY), Math.max(minY, maxY));
  const along = (hit.point.x - hit.face.cx) * hit.face.ax + (hit.point.z - hit.face.cz) * hit.face.az + alongOffset;
  const clampedAlong = Math.min(Math.max(along, -hit.face.halfLen + halfW), Math.max(-hit.face.halfLen + halfW, hit.face.halfLen - halfW));
  const cx = hit.face.cx + hit.face.ax * clampedAlong + hit.normal.x * 0.1;
  const cz = hit.face.cz + hit.face.az * clampedAlong + hit.normal.z * 0.1;
  return { position: [cx, y, cz], rotation: Math.atan2(hit.normal.x, hit.normal.z) };
}
