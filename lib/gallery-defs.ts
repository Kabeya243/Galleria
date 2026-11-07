// Gallery definitions — the twenty galleries added in November 2026
// from Kabeya's Three.js reference files (nine from six files, eleven
// from Galeries_3D.html), plus the shared navigation / hanging data
// each one needs.
//
// Every number here comes from its source file: walk bounds, camera
// start, collision blocks, hangable wall faces, background and fog.
// Do not "improve" any of it — the reference file IS the design.
// The 3D shells themselves live in components/gallery-rooms.tsx; this
// file only carries the data the scene, the editor and the minimap
// share: where the visitor can walk, what can be hung where, and how
// the plan is drawn.
//
// Coordinates are ROOM-LOCAL, exactly as in each source file. A
// room's world position is its plan offset (see roomPlanOffsets).
//
// The Sunlight Gallery is NOT defined here: it keeps its own data in
// lib/sunlight.ts / lib/sunlight-elements.ts, untouched.

import { roomLayouts, type RoomLayout } from "@/lib/rooms";
import { SUNLIGHT_CAMERA_START, SUNLIGHT_FLOOR_CENTER_Z } from "@/lib/sunlight";
import { partitionDimsOf } from "@/lib/editor-params";
import type { RoomElement } from "@/lib/elements";
import {
  raycastHangWalls,
  sunlightPlaceOnWall,
  type HangWallFace,
  type HangWallHit,
} from "@/lib/sunlight-elements";

// Collision block — a rotated rectangle, the same shape the Sunlight
// walk controls use (see sunlightHitWith): [centre x, centre z,
// rotation, half-length, half-width]. The visitor is a 0.4 m body
// around the camera, so the hit test adds 0.4 m.
export type GalleryBlock = { x: number; z: number; ry: number; hl: number; hw: number };

// A line on the floor plan (the minimap): a panel, a partition, a
// bench — anything the visitor should see as more than an empty room.
export type GalleryPlanLine = { x1: number; z1: number; x2: number; z2: number };

// Which distinctive feature the catalogue card's thumbnail draws.
export type ThumbnailKey =
  | "sunlight"
  | "serpentine"
  | "vitrine"
  | "loft"
  | "halle"
  | "arche"
  | "musee"
  | "claire-voie"
  | "parquet"
  | "verriere"
  | "pavillon"
  | "classique"
  | "atrium-blanc"
  | "patio"
  | "escalier"
  | "salles-vertes"
  | "couloir-sombre"
  | "couloir-dore"
  | "voutes"
  | "courbes"
  | "atrium-lattes";

export type GalleryDef = {
  layout: RoomLayout;
  // Room-local z of the floor centre (see roomLayouts[].floorCenterZ).
  floorCenterZ: number;
  background: string;
  fog?: { color: string; near: number; far: number };
  // The source's first-person lighting: a hemisphere + IBL
  // environment (the source's PMREM gradient scene). Rooms whose
  // source has no environment scene leave this false.
  environment: boolean;
  cameraStart: { x: number; y: number; z: number; yaw: number; pitch: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
  // Walk speed (m/s): the source's loop uses 3, except La Verrière (3.2).
  walkSpeed: number;
  blocks: GalleryBlock[];
  hangWalls: HangWallFace[];
  planLines: GalleryPlanLine[];
  thumbnail: ThumbnailKey;
  // The room-level curatorial text plane (room.curatorialText) sits on
  // the back wall at this height and z (x = 0). Null when the room has
  // no back wall to carry one (La Serpentine is outdoors).
  curatorialText: { y: number; z: number } | null;
};

// --- Hang-wall helpers ---------------------------------------------------
// A hangable wall face is a vertical plane: a horizontal unit normal, a
// point on the plane, the wall's length axis, half its length, and its
// height range (see HangWallFace in lib/sunlight-elements.ts). Room
// walls offer only their interior face; freestanding walls (panels,
// partitions, screens) offer both faces.

function face(
  id: string,
  nx: number,
  nz: number,
  cx: number,
  cz: number,
  ax: number,
  az: number,
  halfLen: number,
  minY: number,
  maxY: number,
): HangWallFace {
  return { id, nx, nz, cx, cz, ax, az, halfLen, minY, maxY };
}

// Both faces of a freestanding wall of half-thickness `halfThick`,
// whose face normal is (nx, nz), centred at (cx, cz), running along
// (ax, az). Each face sits on the wall's true surface — 0.1 m off the
// centre plane would bury a frame in a thick panel — so an artwork
// placed on it (0.1 m off the face) clears the surface.
function thickFaces(
  id: string,
  nx: number,
  nz: number,
  cx: number,
  cz: number,
  ax: number,
  az: number,
  halfLen: number,
  minY: number,
  maxY: number,
  halfThick: number,
): HangWallFace[] {
  return [
    face(`${id}+`, nx, nz, cx + nx * halfThick, cz + nz * halfThick, ax, az, halfLen, minY, maxY),
    face(`${id}-`, -nx, -nz, cx - nx * halfThick, cz - nz * halfThick, ax, az, halfLen, minY, maxY),
  ];
}

// A straight wall segment (a folding screen, a V panel, a fragment):
// the segment from (ax, az) to (bx, bz), hangable on both faces,
// `minY`…`maxY` high, `halfThick` thick. The normal is the segment's
// perpendicular.
function segmentFaces(
  id: string,
  ax: number,
  az: number,
  bx: number,
  bz: number,
  minY: number,
  maxY: number,
  halfThick: number,
): HangWallFace[] {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  if (len < 0.01) return [];
  const ux = dx / len;
  const uz = dz / len;
  // Normal = the segment direction rotated +90° in (x, z).
  return thickFaces(id, -uz, ux, (ax + bx) / 2, (az + bz) / 2, ux, uz, len / 2, minY, maxY, halfThick);
}

// Faces along a curved wall, one flat face per arc segment. `pointAt`
// maps an angle to a point on the wall; `normalAt` gives the face
// normal there (unit, horizontal). The segment's length axis is the
// arc tangent at its centre.
function arcFaces(
  idPrefix: string,
  a0: number,
  a1: number,
  segments: number,
  pointAt: (theta: number) => [number, number],
  normalAt: (theta: number) => [number, number],
  tangentAt: (theta: number) => [number, number],
  segmentLength: number,
  minY: number,
  maxY: number,
): HangWallFace[] {
  const faces: HangWallFace[] = [];
  const dTheta = (a1 - a0) / segments;
  for (let i = 0; i < segments; i += 1) {
    const theta = a0 + (i + 0.5) * dTheta;
    const [cx, cz] = pointAt(theta);
    const [nx, nz] = normalAt(theta);
    const [ax, az] = tangentAt(theta);
    faces.push(face(`${idPrefix}${i}`, nx, nz, cx, cz, ax, az, segmentLength / 2, minY, maxY));
  }
  return faces;
}

// The serpentine walls (La Serpentine): a shape-space arc (cos θ,
// sin θ) rotated x = −π/2 maps to world (cos θ, −sin θ), exactly as
// the source's hangPhoto. Inner faces look at the arc centre, outer
// faces away from it.
const SERP_RAD = 4.2;
const SERP_T = 0.12;
const SERP_ZC = (k: number) => 11 - 8.4 * k;
const SERP_SG = (k: number) => (k % 2 === 0 ? -1 : 1);

function serpentineFaces(): HangWallFace[] {
  const faces: HangWallFace[] = [];
  for (let k = 0; k < 4; k += 1) {
    const s = SERP_SG(k);
    const zc = SERP_ZC(k);
    const a0 = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    const a1 = s > 0 ? Math.PI / 2 : Math.PI * 1.5;
    const segments = 6;
    const segLen = (SERP_RAD * Math.PI) / segments;
    // Inner face (radius RAD − T): the normal points at the centre.
    faces.push(
      ...arcFaces(
        `serp-${k}i`,
        a0,
        a1,
        segments,
        (t) => [(SERP_RAD - SERP_T) * Math.cos(t), zc - (SERP_RAD - SERP_T) * Math.sin(t)],
        (t) => [-Math.cos(t), Math.sin(t)],
        (t) => [-Math.sin(t), -Math.cos(t)],
        segLen,
        0,
        2.7,
      ),
    );
    // Outer face (radius RAD + T): the normal points away.
    faces.push(
      ...arcFaces(
        `serp-${k}o`,
        a0,
        a1,
        segments,
        (t) => [(SERP_RAD + SERP_T) * Math.cos(t), zc - (SERP_RAD + SERP_T) * Math.sin(t)],
        (t) => [Math.cos(t), -Math.sin(t)],
        (t) => [-Math.sin(t), -Math.cos(t)],
        segLen,
        0,
        2.7,
      ),
    );
  }
  return faces;
}

// The Musée Bleu's curved wall: a three.js cylinder, whose vertices
// are (r·sin θ, y, r·cos θ) — the arc θ ∈ [π−0.62, π+0.62] around the
// centre (0, 3), bulging toward −z. Only the concave face is visible
// (the source's BackSide), so only it hangs: its normal points at the
// centre.
function museeBlueFaces(): HangWallFace[] {
  const r = 11;
  const cx = 0;
  const cz = 3;
  const a0 = Math.PI - 0.62;
  const a1 = Math.PI + 0.62;
  const segments = 6;
  const segLen = (r * (a1 - a0)) / segments;
  return arcFaces(
    "blue",
    a0,
    a1,
    segments,
    (t) => [cx + r * Math.sin(t), cz + r * Math.cos(t)],
    (t) => [-Math.sin(t), -Math.cos(t)],
    (t) => [Math.cos(t), -Math.sin(t)],
    segLen,
    0,
    4.6,
  );
}

// Collision blocks along a serpentine wall: one rotated rectangle per
// arc segment, on the wall's centreline. The hit test adds the 0.4 m
// body margin, so hl/hw are the wall's own half-extents.
function serpentineBlocks(): GalleryBlock[] {
  const blocks: GalleryBlock[] = [];
  for (let k = 0; k < 4; k += 1) {
    const s = SERP_SG(k);
    const zc = SERP_ZC(k);
    const a0 = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    const a1 = s > 0 ? Math.PI / 2 : Math.PI * 1.5;
    const segments = 12;
    const dTheta = (a1 - a0) / segments;
    for (let i = 0; i < segments; i += 1) {
      const theta = a0 + (i + 0.5) * dTheta;
      const x = SERP_RAD * Math.cos(theta);
      const z = zc - SERP_RAD * Math.sin(theta);
      // The block's local +X is world (cos ry, −sin ry); the arc
      // tangent is (−sin θ, −cos θ), so ry = atan2(cos θ, −sin θ).
      blocks.push({ x, z, ry: Math.atan2(Math.cos(theta), -Math.sin(theta)), hl: 0.55, hw: 0.17 });
    }
  }
  // The four tables (the source's colliders): 0.6 × 1.5 m, two of them
  // rotated. Their radius in the source is max(w,d)/2 + 0.3.
  blocks.push(
    { x: -2.6, z: 2.6, ry: 0, hl: 1.05, hw: 0.6 },
    { x: 2.4, z: -5.8, ry: 0, hl: 1.05, hw: 0.6 },
    { x: -1.6, z: 11.5, ry: 0.4, hl: 0.75, hw: 0.6 },
    { x: 2.6, z: -14.7, ry: -0.3, hl: 0.75, hw: 0.6 },
  );
  return blocks;
}

// The folding-screen segments of La Halle Design (the source's
// screen() calls), as [ax, az, bx, bz] pairs — used both for collision
// blocks and for hangable faces.
const HALLE_SEGMENTS: [number, number, number, number][] = [
  [2, 13, 0.2, 11],
  [0.2, 11, 2, 9],
  [2, 9, 0.2, 7],
  [0.2, 7, 2, 5],
  [2, 5, 0.2, 3],
  [-10, 8, -7, 9.5],
  [-7, 9.5, -4, 8],
  [-4, 8, -1, 9],
  [-5, 5, -2.5, 4],
  [-2.5, 4, 0, 5],
  [0, 5, 2.8, 3.5],
  [2.8, 3.5, 5.5, 4.5],
  [5.5, 4.5, 8.5, 3],
  [8.5, 3, 11.5, 4],
  [-11, -1, -8, -2.2],
  [-8, -2.2, -5, -1],
  [-5, -1, -2, -2.2],
  [-9, -9, -6, -10],
  [-6, -10, -3, -8.5],
  [-3, -8.5, 0.5, -9.5],
  [3, -3, 5, -5],
  [5, -5, 3, -7],
  [3, -7, 5, -9],
  [5, -9, 8, -8],
  [-7, -4, -7.5, -6.5],
];

// A segment as a collision block: the block's local +X is world
// (cos ry, −sin ry), so ry = atan2(−dz, dx) for the segment direction.
function segmentBlock(ax: number, az: number, bx: number, bz: number, hw = 0.05): GalleryBlock {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz);
  return { x: (ax + bx) / 2, z: (az + bz) / 2, ry: Math.atan2(-dz, dx), hl: len / 2, hw };
}

// An axis-aligned source block [x0, x1, z0, z1] as a rotated rectangle.
function rectBlock(x0: number, x1: number, z0: number, z1: number): GalleryBlock {
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, ry: 0, hl: (x1 - x0) / 2, hw: (z1 - z0) / 2 };
}

// The plan lines of the serpentine walls: each arc as a polyline.
function serpentinePlanLines(): GalleryPlanLine[] {
  const lines: GalleryPlanLine[] = [];
  for (let k = 0; k < 4; k += 1) {
    const s = SERP_SG(k);
    const zc = SERP_ZC(k);
    const a0 = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    const a1 = s > 0 ? Math.PI / 2 : Math.PI * 1.5;
    const steps = 12;
    let prev: [number, number] | null = null;
    for (let i = 0; i <= steps; i += 1) {
      const theta = a0 + ((a1 - a0) * i) / steps;
      const point: [number, number] = [SERP_RAD * Math.cos(theta), zc - SERP_RAD * Math.sin(theta)];
      if (prev) lines.push({ x1: prev[0], z1: prev[1], x2: point[0], z2: point[1] });
      prev = point;
    }
  }
  return lines;
}

// The plan lines of the Musée Bleu's curved wall: the arc as a polyline.
function museePlanLines(): GalleryPlanLine[] {
  const lines: GalleryPlanLine[] = [];
  const a0 = Math.PI - 0.62;
  const a1 = Math.PI + 0.62;
  const steps = 12;
  let prev: [number, number] | null = null;
  for (let i = 0; i <= steps; i += 1) {
    const theta = a0 + ((a1 - a0) * i) / steps;
    const point: [number, number] = [11 * Math.sin(theta), 3 + 11 * Math.cos(theta)];
    if (prev) lines.push({ x1: prev[0], z1: prev[1], x2: point[0], z2: point[1] });
    prev = point;
  }
  lines.push({ x1: 7.6 - 3 * Math.cos(-0.45), z1: -4.6 + 3 * Math.sin(-0.45), x2: 7.6 + 3 * Math.cos(-0.45), z2: -4.6 - 3 * Math.sin(-0.45) });
  lines.push({ x1: -7.6 - 3 * Math.cos(0.45), z1: -4.6 + 3 * Math.sin(0.45), x2: -7.6 + 3 * Math.cos(0.45), z2: -4.6 - 3 * Math.sin(0.45) });
  return lines;
}

// A circle arc as plan lines (three.js cylinder convention: a point
// at angle θ is (r·sin θ, r·cos θ)).
function arcLines(r: number, a0: number, a1: number, steps: number): GalleryPlanLine[] {
  const lines: GalleryPlanLine[] = [];
  let prev: [number, number] | null = null;
  for (let i = 0; i <= steps; i += 1) {
    const theta = a0 + ((a1 - a0) * i) / steps;
    const point: [number, number] = [r * Math.sin(theta), r * Math.cos(theta)];
    if (prev) lines.push({ x1: prev[0], z1: prev[1], x2: point[0], z2: point[1] });
    prev = point;
  }
  return lines;
}

// An ellipse as plan lines (the Patio ovale's roof opening).
function ellipseLines(rx: number, rz: number, steps: number): GalleryPlanLine[] {
  const lines: GalleryPlanLine[] = [];
  let prev: [number, number] | null = null;
  for (let i = 0; i <= steps; i += 1) {
    const theta = (2 * Math.PI * i) / steps;
    const point: [number, number] = [rx * Math.cos(theta), rz * Math.sin(theta)];
    if (prev) lines.push({ x1: prev[0], z1: prev[1], x2: point[0], z2: point[1] });
    prev = point;
  }
  return lines;
}

// The parametric hall of Galeries_3D.html (s6–s9: Salles vertes,
// Couloir sombre, Couloir doré, Plafond à voûtes) — one definition
// built from the source's hall(o) options. Panel positions, benches,
// arches and windows follow the source exactly:
// panels at z = L/2 − 5 − i·(L−10)/pn on both side walls, benches at
// z = L/2 − 9 − i·8, arches/windows at the panel z minus half a step.
type HallDefOptions = {
  layout: RoomLayout;
  floorCenterZ: number;
  background: string;
  thumbnail: ThumbnailKey;
  W: number;
  L: number;
  H: number;
  pn: number;
  fw: number;
  fh: number;
  bn: number;
  ar?: boolean;
  win?: boolean;
  // s8 (Couloir doré): the back wall is split around the luminous arch
  // (|x| < 1.2), so no artwork ever covers the window.
  splitBackAroundArch?: boolean;
};

function hallDef(o: HallDefOptions): GalleryDef {
  const hw = o.W / 2;
  const st = (o.L - 10) / o.pn;
  const zs = Array.from({ length: o.pn }, (_, i) => o.L / 2 - 5 - i * st);
  const hangWalls: HangWallFace[] = [
    face("left", 1, 0, -hw, 0, 0, 1, o.L / 2, 0, o.H),
    face("right", -1, 0, hw, 0, 0, 1, o.L / 2, 0, o.H),
    face("front", 0, -1, 0, o.L / 2, 1, 0, hw, 0, o.H),
  ];
  if (o.splitBackAroundArch) {
    hangWalls.push(
      face("back-left", 0, 1, -2.35, -o.L / 2, 1, 0, 1.15, 0, o.H),
      face("back-right", 0, 1, 2.35, -o.L / 2, 1, 0, 1.15, 0, o.H),
    );
  } else {
    hangWalls.push(face("back", 0, 1, 0, -o.L / 2, 1, 0, hw, 0, o.H));
  }
  const planLines: GalleryPlanLine[] = [
    { x1: -hw, z1: -o.L / 2, x2: hw, z2: -o.L / 2 },
    { x1: -hw, z1: -o.L / 2, x2: -hw, z2: o.L / 2 },
    { x1: hw, z1: -o.L / 2, x2: hw, z2: o.L / 2 },
    { x1: -hw, z1: o.L / 2, x2: hw, z2: o.L / 2 },
  ];
  const blocks: GalleryBlock[] = [];
  for (const s of [-1, 1] as const) {
    for (const z of zs) {
      // A panel's hangable faces: both sides of its thin frame, the
      // frame's own height (centred at y 2.2) with a little slack.
      hangWalls.push(
        ...thickFaces(
          `panel-${s > 0 ? "r" : "l"}-${z}`,
          -s,
          0,
          s * (hw - 0.05),
          z,
          0,
          1,
          o.fw / 2,
          2.2 - o.fh / 2 - 0.3,
          2.2 + o.fh / 2 + 0.3,
          0.04,
        ),
      );
      planLines.push({
        x1: s * (hw - 0.05),
        z1: z - o.fw / 2,
        x2: s * (hw - 0.05),
        z2: z + o.fw / 2,
      });
      // Arches (s7) sit on both side walls; luminous windows (s8) only
      // on the right one (the source's `win && s > 0`).
      if (o.ar || (o.win && s > 0)) {
        const az = z - st / 2;
        planLines.push({
          x1: s * (hw - 0.04),
          z1: az - 0.8,
          x2: s * (hw - 0.04),
          z2: az + 0.8,
        });
      }
    }
  }
  for (let i = 0; i < o.bn; i += 1) {
    const z = o.L / 2 - 9 - i * 8;
    blocks.push({ x: 0, z, ry: 0, hl: 0.9, hw: 0.9 });
    planLines.push({ x1: -1, z1: z, x2: 1, z2: z });
  }
  return {
    layout: o.layout,
    floorCenterZ: o.floorCenterZ,
    background: o.background,
    environment: true,
    cameraStart: { x: 0, y: 1.6, z: o.L / 2 - 2, yaw: 0, pitch: -0.03 },
    bounds: { minX: -hw + 0.3, maxX: hw - 0.3, minZ: -o.L / 2 + 0.3, maxZ: o.L / 2 - 0.3 },
    walkSpeed: 3.2,
    blocks,
    hangWalls,
    planLines,
    thumbnail: o.thumbnail,
    curatorialText: { y: o.H - 0.65, z: -o.L / 2 + 0.14 },
  };
}

const GALLERY_DEFS: Record<string, GalleryDef> = {
  serpentine: {
    layout: "serpentine",
    floorCenterZ: -2,
    background: "#bcd6ee",
    fog: { color: "#cfe0f0", near: 70, far: 170 },
    environment: true,
    cameraStart: { x: 7, y: 1.6, z: 21, yaw: 0.35, pitch: -0.03 },
    bounds: { minX: -24, maxX: 24, minZ: -36, maxZ: 32 },
    walkSpeed: 3,
    blocks: serpentineBlocks(),
    hangWalls: serpentineFaces(),
    planLines: serpentinePlanLines(),
    thumbnail: "serpentine",
    curatorialText: null,
  },
  vitrine: {
    layout: "vitrine",
    floorCenterZ: -6,
    background: "#dde4ec",
    environment: false,
    cameraStart: { x: 0.5, y: 1.6, z: 8, yaw: 0, pitch: -0.03 },
    bounds: { minX: -14, maxX: 14, minZ: -11.5, maxZ: 12 },
    walkSpeed: 3,
    blocks: [
      rectBlock(8.6, 40, -13, 0),
      rectBlock(-40, -8.6, -13, 0),
      rectBlock(-20, 3.15, -0.3, 0.3),
      rectBlock(4.65, 20, -0.3, 0.3),
      rectBlock(-8.6, -7.7, -13, 0),
      rectBlock(7.7, 8.6, -13, 0),
      rectBlock(-1.95, -0.65, -5, -3.8),
      rectBlock(0.75, 1.85, -5.8, -4.6),
      rectBlock(-7, -3.8, -3.6, -2.8),
      rectBlock(2, 5.2, -8.5, -7.5),
      rectBlock(2.4, 6, -10.6, -10),
    ],
    hangWalls: [
      face("left", 1, 0, -8, -6, 0, 1, 8, 0, 4),
      face("right", -1, 0, 8, -6, 0, 1, 8, 0, 4),
      face("back", 0, 1, 0, -12, 1, 0, 8, 0, 4),
      ...thickFaces("partition", 0, 1, 4.2, -10.4, 1, 0, 1.7, 0, 3, 0.1),
    ],
    planLines: [
      { x1: -8, z1: -12, x2: 8, z2: -12 },
      { x1: -8, z1: -12, x2: -8, z2: 0 },
      { x1: 8, z1: -12, x2: 8, z2: 0 },
      { x1: 2.5, z1: -10.4, x2: 5.9, z2: -10.4 },
    ],
    thumbnail: "vitrine",
    curatorialText: { y: 3.35, z: -11.86 },
  },
  loft: {
    layout: "loft",
    floorCenterZ: -2,
    background: "#2a2724",
    environment: false,
    cameraStart: { x: 2, y: 1.6, z: 6.5, yaw: 0.15, pitch: -0.03 },
    bounds: { minX: -8.5, maxX: 8.5, minZ: -11.4, maxZ: 7.4 },
    walkSpeed: 3,
    blocks: [rectBlock(-3.4, 0.4, -4.2, -3.8), rectBlock(2.05, 5.15, -3.5, -2.5)],
    hangWalls: [
      face("left", 1, 0, -9, -2, 0, 1, 10, 0, 4.3),
      face("right", -1, 0, 9, -2, 0, 1, 10, 0, 4.3),
      face("back", 0, 1, 0, -12, 1, 0, 9, 0, 4.3),
      face("front", 0, -1, 0, 8, 1, 0, 9, 0, 4.3),
      ...thickFaces("partition", 0, 1, -1.5, -4, 1, 0, 1.8, 0, 3.9, 0.1),
    ],
    planLines: [
      { x1: -9, z1: -12, x2: 9, z2: -12 },
      { x1: -9, z1: -12, x2: -9, z2: 8 },
      { x1: 9, z1: -12, x2: 9, z2: 8 },
      { x1: -3.3, z1: -4, x2: 0.3, z2: -4 },
    ],
    thumbnail: "loft",
    curatorialText: { y: 3.65, z: -11.86 },
  },
  halle: {
    layout: "halle",
    floorCenterZ: 0,
    background: "#c9d3dc",
    environment: true,
    cameraStart: { x: -5, y: 1.6, z: 15, yaw: -0.1, pitch: -0.03 },
    bounds: { minX: -12, maxX: 11.4, minZ: -16, maxZ: 16 },
    walkSpeed: 3,
    blocks: HALLE_SEGMENTS.map(([ax, az, bx, bz]) => segmentBlock(ax, az, bx, bz)),
    hangWalls: [
      face("left", 1, 0, -13, 0, 0, 1, 17, 0, 8.2),
      face("back", 0, 1, -0.5, -17, 1, 0, 12.5, 0, 8.2),
      face("front", 0, -1, -0.5, 17, 1, 0, 12.5, 0, 8.2),
      ...HALLE_SEGMENTS.flatMap(([ax, az, bx, bz], i) => segmentFaces(`screen-${i}`, ax, az, bx, bz, 0, 2.4, 0.035)),
    ],
    planLines: HALLE_SEGMENTS.map(([ax, az, bx, bz]) => ({ x1: ax, z1: az, x2: bx, z2: bz })),
    thumbnail: "halle",
    curatorialText: { y: 7.55, z: -16.86 },
  },
  arche: {
    layout: "arche",
    floorCenterZ: -3,
    background: "#3a342d",
    fog: { color: "#3a342d", near: 14, far: 34 },
    environment: false,
    cameraStart: { x: -1, y: 1.6, z: 5.5, yaw: 0, pitch: -0.04 },
    bounds: { minX: -9.2, maxX: 9.2, minZ: -14.2, maxZ: 8.2 },
    walkSpeed: 3,
    // The dividing wall (the source's arch check): the wall band is
    // z −4.9…−3.3 and the passage is |x| < 1.5.
    blocks: [
      { x: -5.75, z: -4.1, ry: 0, hl: 4.25, hw: 0.4 },
      { x: 5.75, z: -4.1, ry: 0, hl: 4.25, hw: 0.4 },
    ],
    hangWalls: [
      face("left", 1, 0, -10, -3, 0, 1, 12, 0, 6.5),
      face("right", -1, 0, 10, -3, 0, 1, 12, 0, 6.5),
      face("back", 0, 1, 0, -15, 1, 0, 10, 0, 6.5),
      face("front", 0, -1, 0, 9, 1, 0, 10, 0, 6.5),
      // The dividing wall, split around the round arch (|x| < 2): the
      // two solid stretches, both faces, front (z −3.65) and back
      // (z −4.35). No artwork can land in the arch opening.
      ...thickFaces("dividing-left", 0, 1, -6, -4, 1, 0, 4, 0, 6.5, 0.35),
      ...thickFaces("dividing-right", 0, 1, 6, -4, 1, 0, 4, 0, 6.5, 0.35),
    ],
    planLines: [
      { x1: -10, z1: -4.35, x2: -2, z2: -4.35 },
      { x1: 2, z1: -4.35, x2: 10, z2: -4.35 },
    ],
    thumbnail: "arche",
    curatorialText: { y: 5.85, z: -14.86 },
  },
  musee: {
    layout: "musee",
    floorCenterZ: 0,
    background: "#8c8680",
    environment: true,
    cameraStart: { x: 0, y: 1.6, z: 9.5, yaw: 0, pitch: -0.03 },
    bounds: { minX: -13, maxX: 13, minZ: -7, maxZ: 11 },
    walkSpeed: 3,
    blocks: [
      { x: 7.6, z: -4.6, ry: -0.45, hl: 3, hw: 0.3 },
      { x: -7.6, z: -4.6, ry: 0.45, hl: 3, hw: 0.3 },
    ],
    hangWalls: [
      face("left", 1, 0, -14, 0, 0, 1, 20, 0, 6.5),
      face("right", -1, 0, 14, 0, 0, 1, 20, 0, 6.5),
      face("back", 0, 1, 0, -12, 1, 0, 14, 0, 6.5),
      face("front", 0, -1, 0, 12, 1, 0, 14, 0, 6.5),
      ...museeBlueFaces(),
      ...thickFaces("panel-right", Math.sin(-0.45), Math.cos(-0.45), 7.6, -4.6, Math.cos(-0.45), -Math.sin(-0.45), 3, 0, 4.9, 0.275),
      ...thickFaces("panel-left", Math.sin(0.45), Math.cos(0.45), -7.6, -4.6, Math.cos(0.45), -Math.sin(0.45), 3, 0, 4.9, 0.275),
    ],
    planLines: museePlanLines(),
    thumbnail: "musee",
    curatorialText: { y: 5.85, z: -11.86 },
  },
  "claire-voie": {
    layout: "claire-voie",
    floorCenterZ: -1.5,
    background: "#6a6866",
    environment: true,
    cameraStart: { x: -4.2, y: 1.6, z: 8.2, yaw: -0.35, pitch: -0.03 },
    bounds: { minX: -5.4, maxX: 4.4, minZ: -12.4, maxZ: 9.5 },
    walkSpeed: 3,
    blocks: [{ x: 1.2, z: -7.5, ry: 0, hl: 1, hw: 0.5 }],
    hangWalls: [
      face("left", 1, 0, -6, -1.5, 0, 1, 11.5, 0, 7.6),
      face("right", -1, 0, 5, -1.5, 0, 1, 11.5, 0, 7.6),
      face("back", 0, 1, -0.5, -13, 1, 0, 5.5, 0, 7.6),
      face("front", 0, -1, -0.5, 10, 1, 0, 5.5, 0, 7.6),
    ],
    planLines: [{ x1: 0.3, z1: -7.5, x2: 2.1, z2: -7.5 }],
    thumbnail: "claire-voie",
    curatorialText: { y: 6.95, z: -12.86 },
  },
  parquet: {
    layout: "parquet",
    floorCenterZ: 0.5,
    background: "#8a8277",
    environment: true,
    cameraStart: { x: 0, y: 1.6, z: 9, yaw: 0, pitch: -0.03 },
    bounds: { minX: -11, maxX: 11, minZ: -9.4, maxZ: 11 },
    walkSpeed: 3,
    blocks: [
      { x: 1.9, z: -5.6, ry: -0.75, hl: 1.6, hw: 0.2 },
      { x: -1.9, z: -5.6, ry: 0.75, hl: 1.6, hw: 0.2 },
      { x: -9.6, z: 1, ry: 0, hl: 0.4, hw: 3.1 },
      { x: 9, z: -1, ry: 0, hl: 0.4, hw: 3.6 },
      { x: -6.6, z: -6.6, ry: 0, hl: 0.4, hw: 0.4 },
      { x: -0.3, z: -2.4, ry: 0, hl: 0.3, hw: 0.3 },
      { x: 5.6, z: -8.2, ry: 0, hl: 0.35, hw: 0.35 },
      { x: 7.2, z: 3.2, ry: 0, hl: 0.35, hw: 0.35 },
      { x: 0, z: 3.8, ry: 0, hl: 1.4, hw: 0.85 },
    ],
    hangWalls: [
      face("back", 0, 1, 0, -10, 1, 0, 11.5, 0, 7.2),
      face("left", 1, 0, -12, 0.5, 0, 1, 11.5, 0, 7.2),
      face("right", -1, 0, 12, 0.5, 0, 1, 11.5, 0, 7.2),
      face("front", 0, -1, 0, 12, 1, 0, 12, 0, 7.2),
      ...thickFaces("v-right", Math.sin(-0.75), Math.cos(-0.75), 1.9, -5.6, Math.cos(-0.75), -Math.sin(-0.75), 1.6, 0, 3.8, 0.09),
      ...thickFaces("v-left", Math.sin(0.75), Math.cos(0.75), -1.9, -5.6, Math.cos(0.75), -Math.sin(0.75), 1.6, 0, 3.8, 0.09),
      ...thickFaces("fragment-left", 1, 0, -9.6, 1, 0, 1, 3, 0, 4.6, 0.15),
      ...thickFaces("fragment-right", -1, 0, 9, -1, 0, 1, 3.5, 0, 4.6, 0.15),
    ],
    planLines: [
      { x1: 0.3, z1: -6.7, x2: 3.5, z2: -4.5 },
      { x1: -3.5, z1: -4.5, x2: -0.3, z2: -6.7 },
      { x1: -9.6, z1: -2, x2: -9.6, z2: 4 },
      { x1: 9, z1: -4.6, x2: 9, z2: 2.6 },
    ],
    thumbnail: "parquet",
    curatorialText: { y: 6.55, z: -9.86 },
  },
  verriere: {
    layout: "verriere",
    floorCenterZ: -4,
    background: "#d8d4cf",
    fog: { color: "#d8d4cf", near: 18, far: 40 },
    environment: false,
    cameraStart: { x: -2.2, y: 1.6, z: 5.5, yaw: -0.2, pitch: -0.05 },
    bounds: { minX: -18, maxX: 18, minZ: -16, maxZ: 10 },
    walkSpeed: 3.2,
    // FIX (the source has no collision at all, so the visitor walks
    // straight through the five solid panels): one block per panel.
    // The architecture is unchanged — this is navigation data only.
    blocks: [
      { x: 3.2, z: -1.5, ry: -1.25, hl: 3, hw: 0.15 },
      { x: -3, z: -7, ry: -0.15, hl: 3, hw: 0.15 },
      { x: 5, z: -9, ry: 0.35, hl: 3, hw: 0.15 },
      { x: -9, z: -4, ry: 0.6, hl: 3, hw: 0.15 },
      { x: 0, z: -13, ry: 0, hl: 5, hw: 0.15 },
    ],
    hangWalls: [
      ...thickFaces("panel-a", Math.sin(-1.25), Math.cos(-1.25), 3.2, -1.5, Math.cos(-1.25), -Math.sin(-1.25), 3, 0.5, 5.5, 0.075),
      ...thickFaces("panel-b", Math.sin(-0.15), Math.cos(-0.15), -3, -7, Math.cos(-0.15), -Math.sin(-0.15), 3, 0.5, 5.5, 0.075),
      ...thickFaces("panel-c", Math.sin(0.35), Math.cos(0.35), 5, -9, Math.cos(0.35), -Math.sin(0.35), 3, 0.5, 5.5, 0.075),
      ...thickFaces("panel-d", Math.sin(0.6), Math.cos(0.6), -9, -4, Math.cos(0.6), -Math.sin(0.6), 3, 0.5, 5.5, 0.075),
      ...thickFaces("panel-e", 0, 1, 0, -13, 1, 0, 5, 0.5, 5.5, 0.075),
      face("back", 0, 1, 0, -18, 1, 0, 20, 0, 7.5),
    ],
    planLines: [
      { x1: 0.2, z1: -3.4, x2: 6.2, z2: 0.4 },
      { x1: -6, z1: -7.4, x2: 0, z2: -6.6 },
      { x1: 2.2, z1: -10.9, x2: 7.8, z2: -7.1 },
      { x1: -11.5, z1: -5.7, x2: -6.5, z2: -2.3 },
      { x1: -5, z1: -13, x2: 5, z2: -13 },
    ],
    thumbnail: "verriere",
    curatorialText: { y: 6.85, z: -17.86 },
  },
  pavillon: {
    layout: "pavillon",
    floorCenterZ: -1,
    background: "#9cc3e6",
    environment: true,
    cameraStart: { x: 0, y: 1.6, z: 5, yaw: 0, pitch: -0.03 },
    // The union of the source's walkable rects (main hall, two side
    // rooms, two door passages), with blocks carving the walls and the
    // dead zones beside the side rooms out of the bounding rectangle.
    bounds: { minX: -7.6, maxX: 7.6, minZ: -7.2, maxZ: 5.7 },
    walkSpeed: 3.2,
    blocks: [
      // The glass-brick side walls (x = ±4.2), split around the door
      // openings (z −1.9…−0.1).
      { x: -4.2, z: 2.95, ry: 0, hl: 0.2, hw: 3.05 },
      { x: -4.2, z: -4.95, ry: 0, hl: 0.2, hw: 3.05 },
      { x: 4.2, z: 2.95, ry: 0, hl: 0.2, hw: 3.05 },
      { x: 4.2, z: -4.95, ry: 0, hl: 0.2, hw: 3.05 },
      // Dead zones beside the side rooms (outside z −2.9…0.9).
      rectBlock(4.4, 7.6, 0.9, 5.7),
      rectBlock(4.4, 7.6, -7.2, -2.9),
      rectBlock(-7.6, -4.4, 0.9, 5.7),
      rectBlock(-7.6, -4.4, -7.2, -2.9),
      // The sculpture group (the source's colliders).
      { x: -0.6, z: -6.1, ry: 0, hl: 0.7, hw: 0.7 },
      { x: 1.1, z: -6.5, ry: 0, hl: 0.6, hw: 0.6 },
    ],
    hangWalls: [
      // The main hall's side walls, split around the door openings.
      face("left-a", 1, 0, -4, -4.95, 0, 1, 3.05, 0, 4.2),
      face("left-b", 1, 0, -4, 2.95, 0, 1, 3.05, 0, 4.2),
      face("right-a", -1, 0, 4, -4.95, 0, 1, 3.05, 0, 4.2),
      face("right-b", -1, 0, 4, 2.95, 0, 1, 3.05, 0, 4.2),
      // The side rooms: back wall (the demo frames hang there) and
      // the two side walls.
      face("room-left", 1, 0, -8, -1, 0, 1, 2.1, 0, 4.2),
      face("room-right", -1, 0, 8, -1, 0, 1, 2.1, 0, 4.2),
      face("room-left-a", 0, 1, -6.2, -3.1, 1, 0, 1.8, 0, 4.2),
      face("room-left-b", 0, -1, -6.2, 1.1, 1, 0, 1.8, 0, 4.2),
      face("room-right-a", 0, 1, 6.2, -3.1, 1, 0, 1.8, 0, 4.2),
      face("room-right-b", 0, -1, 6.2, 1.1, 1, 0, 1.8, 0, 4.2),
    ],
    planLines: [
      { x1: -4, z1: -8, x2: 4, z2: -8 },
      { x1: -4, z1: -8, x2: -4, z2: 6 },
      { x1: 4, z1: -8, x2: 4, z2: 6 },
      { x1: -4, z1: 6, x2: 4, z2: 6 },
      { x1: -8, z1: -3.1, x2: -4.4, z2: -3.1 },
      { x1: -8, z1: 1.1, x2: -4.4, z2: 1.1 },
      { x1: -8, z1: -3.1, x2: -8, z2: 1.1 },
      { x1: 4.4, z1: -3.1, x2: 8, z2: -3.1 },
      { x1: 4.4, z1: 1.1, x2: 8, z2: 1.1 },
      { x1: 8, z1: -3.1, x2: 8, z2: 1.1 },
      { x1: -1.1, z1: -6.1, x2: -0.1, z2: -6.1 },
      { x1: 0.6, z1: -6.5, x2: 1.6, z2: -6.5 },
    ],
    thumbnail: "pavillon",
    // An open pavilion: no back wall to carry the room text.
    curatorialText: null,
  },
  classique: {
    layout: "classique",
    floorCenterZ: 0,
    background: "#2a2724",
    environment: true,
    cameraStart: { x: 0, y: 1.6, z: 18, yaw: 0, pitch: -0.03 },
    bounds: { minX: -3.7, maxX: 3.7, minZ: -19, maxZ: 19 },
    walkSpeed: 3.2,
    blocks: [
      // The twelve granite columns (the source's colliders) and the
      // sculpture at (−2.2, 8.5).
      ...[12, 7, 2, -3, -8, -13].flatMap((z) => [
        { x: -3, z, ry: 0, hl: 0.5, hw: 0.5 },
        { x: 3, z, ry: 0, hl: 0.5, hw: 0.5 },
      ]),
      { x: -2.2, z: 8.5, ry: 0, hl: 0.4, hw: 0.4 },
    ],
    hangWalls: [
      face("left", 1, 0, -4, 0, 0, 1, 20, 0, 6.2),
      face("right", -1, 0, 4, 0, 0, 1, 20, 0, 6.2),
      face("back", 0, 1, 0, -19.9, 1, 0, 4, 0, 6.2),
    ],
    planLines: [
      { x1: -4, z1: -20, x2: 4, z2: -20 },
      { x1: -4, z1: -20, x2: -4, z2: 20 },
      { x1: 4, z1: -20, x2: 4, z2: 20 },
      { x1: -4, z1: 20, x2: 4, z2: 20 },
      ...[12, 7, 2, -3, -8, -13].flatMap((z) => [
        { x1: -3.4, z1: z, x2: -2.6, z2: z },
        { x1: 2.6, z1: z, x2: 3.4, z2: z },
      ]),
      { x1: -2.6, z1: 8.5, x2: -1.8, z2: 8.5 },
    ],
    thumbnail: "classique",
    curatorialText: { y: 5.55, z: -19.86 },
  },
  "atrium-blanc": {
    layout: "atrium-blanc",
    floorCenterZ: -0.5,
    background: "#dfe3e8",
    environment: true,
    cameraStart: { x: 0, y: 1.6, z: 11, yaw: 0, pitch: -0.03 },
    bounds: { minX: -12.4, maxX: 12.4, minZ: -13.4, maxZ: 12.4 },
    walkSpeed: 3.2,
    blocks: [
      // The four columns and the furniture (the source's colliders).
      { x: -5, z: -2, ry: 0, hl: 0.85, hw: 0.85 },
      { x: 6, z: -1, ry: 0, hl: 0.85, hw: 0.85 },
      { x: -9, z: -9, ry: 0, hl: 0.85, hw: 0.85 },
      { x: 8, z: -10, ry: 0, hl: 0.85, hw: 0.85 },
      { x: -9.5, z: -6.5, ry: 0, hl: 1.3, hw: 1.3 },
      { x: -3, z: -5, ry: 0, hl: 0.4, hw: 0.4 },
      { x: 0, z: -11.5, ry: 0, hl: 2.2, hw: 2.2 },
      { x: 9, z: -4, ry: 0, hl: 1.3, hw: 1.3 },
    ],
    hangWalls: [
      face("left", 1, 0, -13, -0.5, 0, 1, 13.5, 0, 9),
      face("right", -1, 0, 13, -0.5, 0, 1, 13.5, 0, 9),
      face("back", 0, 1, 0, -14, 1, 0, 13, 0, 9),
      face("front", 0, -1, 0, 13, 1, 0, 13, 0, 9),
    ],
    planLines: [
      { x1: -13, z1: -14, x2: 13, z2: -14 },
      { x1: -13, z1: -14, x2: -13, z2: 13 },
      { x1: 13, z1: -14, x2: 13, z2: 13 },
      { x1: -13, z1: 13, x2: 13, z2: 13 },
      { x1: -5.7, z1: -2, x2: -4.3, z2: -2 },
      { x1: 5.3, z1: -1, x2: 6.7, z2: -1 },
      { x1: -9.7, z1: -9, x2: -8.3, z2: -9 },
      { x1: 7.3, z1: -10, x2: 8.7, z2: -10 },
      // The suspended black drum, seen from above (6.2 × 4.2 at (0, −7)).
      ...ellipseLines(6.2, 4.2, 8).map((line) => ({
        x1: line.x1,
        z1: line.z1 - 7,
        x2: line.x2,
        z2: line.z2 - 7,
      })),
    ],
    thumbnail: "atrium-blanc",
    curatorialText: { y: 8.35, z: -13.86 },
  },
  patio: {
    layout: "patio",
    floorCenterZ: 0,
    background: "#7fb3e6",
    environment: true,
    cameraStart: { x: -6, y: 1.6, z: 7, yaw: -0.64, pitch: 0.12 },
    bounds: { minX: -18, maxX: 18, minZ: -18, maxZ: 18 },
    walkSpeed: 3.2,
    blocks: [
      // The seven trees (the source's colliders).
      ...[[-4.5, -2], [-2, -3.6], [0.5, -2.6], [3, -3.4], [5.5, -0.6], [-3.6, 1.2], [1.5, 0.2]].map(([x, z]) => ({
        x,
        z,
        ry: 0,
        hl: 0.5,
        hw: 0.5,
      })),
    ],
    hangWalls: [
      // The circular wall (r = 21, BackSide): twelve flat faces, their
      // normals pointing at the patio centre. The visitor walks within
      // ±18 m, so the wall is three metres away at closest.
      ...arcFaces(
        "wall",
        0,
        2 * Math.PI,
        12,
        (t) => [21 * Math.sin(t), 21 * Math.cos(t)],
        (t) => [-Math.sin(t), -Math.cos(t)],
        (t) => [Math.cos(t), -Math.sin(t)],
        (2 * Math.PI * 21) / 12,
        0,
        4.5,
      ),
    ],
    planLines: [
      // The circular wall, the oval roof opening (9 × 6) and the
      // black gravel disc (8.2 × 5.4).
      ...arcLines(21, 0, 2 * Math.PI, 16),
      ...ellipseLines(9, 6, 12),
      ...ellipseLines(8.2, 5.4, 12),
    ],
    thumbnail: "patio",
    curatorialText: { y: 3.85, z: -20.86 },
  },
  escalier: {
    layout: "escalier",
    floorCenterZ: 0,
    background: "#dde2e8",
    environment: true,
    cameraStart: { x: 0, y: 1.6, z: 8, yaw: 0, pitch: -0.03 },
    bounds: { minX: -7.7, maxX: 7.7, minZ: -9.7, maxZ: 9.7 },
    walkSpeed: 3.2,
    blocks: [
      // The central column and the staircase (the source's colliders).
      { x: 0, z: -1, ry: 0, hl: 0.5, hw: 0.5 },
      { x: -5.5, z: 2, ry: 0, hl: 0.9, hw: 0.9 },
      { x: -5.5, z: -1, ry: 0, hl: 0.9, hw: 0.9 },
      { x: -5.5, z: -4, ry: 0, hl: 0.9, hw: 0.9 },
    ],
    hangWalls: [
      face("left", 1, 0, -8, 0, 0, 1, 10, 0, 9),
      face("right", -1, 0, 8, 0, 0, 1, 10, 0, 9),
      face("back", 0, 1, 0, -10, 1, 0, 8, 0, 9),
      face("front", 0, -1, 0, 10, 1, 0, 8, 0, 9),
    ],
    planLines: [
      { x1: -8, z1: -10, x2: 8, z2: -10 },
      { x1: -8, z1: -10, x2: -8, z2: 10 },
      { x1: 8, z1: -10, x2: 8, z2: 10 },
      { x1: -8, z1: 10, x2: 8, z2: 10 },
      { x1: -5.5, z1: 2, x2: -5.5, z2: -4.5 },
      { x1: -0.5, z1: -1, x2: 0.5, z2: -1 },
      { x1: -1.5, z1: -10, x2: 6.5, z2: -10 },
      { x1: -1.5, z1: -5, x2: 6.5, z2: -5 },
      { x1: -1.5, z1: -10, x2: -1.5, z2: -5 },
      { x1: 6.5, z1: -10, x2: 6.5, z2: -5 },
    ],
    thumbnail: "escalier",
    curatorialText: { y: 8.35, z: -9.86 },
  },
  "salles-vertes": hallDef({
    layout: "salles-vertes",
    floorCenterZ: 0,
    background: "#3a3834",
    thumbnail: "salles-vertes",
    W: 14,
    L: 32,
    H: 6.5,
    pn: 3,
    fw: 2,
    fh: 2.6,
    bn: 2,
  }),
  "couloir-sombre": hallDef({
    layout: "couloir-sombre",
    floorCenterZ: 0,
    background: "#151413",
    thumbnail: "couloir-sombre",
    W: 7,
    L: 46,
    H: 5,
    pn: 6,
    fw: 0.9,
    fh: 1.2,
    bn: 0,
    ar: true,
  }),
  "couloir-dore": hallDef({
    layout: "couloir-dore",
    floorCenterZ: 0,
    background: "#f3efe6",
    thumbnail: "couloir-dore",
    W: 7,
    L: 46,
    H: 5.6,
    pn: 4,
    fw: 1.7,
    fh: 2.4,
    bn: 0,
    win: true,
    splitBackAroundArch: true,
  }),
  voutes: hallDef({
    layout: "voutes",
    floorCenterZ: 0,
    background: "#e8e8e6",
    thumbnail: "voutes",
    W: 10,
    L: 30,
    H: 7,
    pn: 2,
    fw: 1.7,
    fh: 1.5,
    bn: 2,
  }),
  courbes: {
    layout: "courbes",
    floorCenterZ: 0,
    background: "#a9d4ea",
    environment: true,
    cameraStart: { x: 4, y: 1.6, z: 6, yaw: 0.6, pitch: -0.03 },
    // The source's two walkable rects (a cross) inside the ±11 m
    // square, with the four corners blocked out.
    bounds: { minX: -11, maxX: 11, minZ: -11, maxZ: 11 },
    walkSpeed: 3.2,
    blocks: [
      rectBlock(8, 11, 8, 11),
      rectBlock(-11, -8, 8, 11),
      rectBlock(8, 11, -11, -8),
      rectBlock(-11, -8, -11, -8),
      // The column and the bench (the source's colliders).
      { x: -3, z: -6, ry: 0, hl: 0.6, hw: 0.6 },
      { x: 4, z: -5, ry: 0, hl: 1.2, hw: 1.2 },
    ],
    hangWalls: [
      // The curved white wall (r = 12.5, BackSide, the arc
      // θ ∈ [3π/2 + 0.55, 3π/2 + 0.55 + 2π − 1.1]): eight flat faces,
      // normals pointing at the gallery centre. The glazed section is
      // glass, not hangable.
      ...arcFaces(
        "curve",
        (3 * Math.PI) / 2 + 0.55,
        (3 * Math.PI) / 2 + 0.55 + 2 * Math.PI - 1.1,
        8,
        (t) => [12.5 * Math.sin(t), 12.5 * Math.cos(t)],
        (t) => [-Math.sin(t), -Math.cos(t)],
        (t) => [Math.cos(t), -Math.sin(t)],
        (12.5 * (2 * Math.PI - 1.1)) / 8,
        0,
        6.5,
      ),
    ],
    planLines: [
      ...arcLines(12.5, (3 * Math.PI) / 2 + 0.55, (3 * Math.PI) / 2 + 0.55 + 2 * Math.PI - 1.1, 16),
      ...arcLines(12.5, (3 * Math.PI) / 2 - 0.55, (3 * Math.PI) / 2 + 0.55, 4),
      { x1: -3.6, z1: -6, x2: -2.4, z2: -6 },
      { x1: 2.9, z1: -5, x2: 5.1, z2: -5 },
    ],
    thumbnail: "courbes",
    curatorialText: { y: 5.85, z: -12.36 },
  },
  "atrium-lattes": {
    layout: "atrium-lattes",
    floorCenterZ: 0,
    background: "#dfe6ec",
    environment: true,
    cameraStart: { x: 0, y: 1.6, z: 7.5, yaw: 0, pitch: -0.03 },
    bounds: { minX: -6.7, maxX: 6.7, minZ: -8.7, maxZ: 8.7 },
    walkSpeed: 3.2,
    blocks: [
      // The mezzanine zone and the two staircases (the source's
      // colliders).
      { x: 0, z: -6, ry: 0, hl: 1.2, hw: 1.2 },
      { x: 5.8, z: 2, ry: 0, hl: 0.9, hw: 0.9 },
      { x: 5.8, z: -1, ry: 0, hl: 0.9, hw: 0.9 },
      { x: 5.8, z: -4, ry: 0, hl: 0.9, hw: 0.9 },
      { x: -5.8, z: 2, ry: 0, hl: 0.9, hw: 0.9 },
      { x: -5.8, z: -1, ry: 0, hl: 0.9, hw: 0.9 },
      { x: -5.8, z: -4, ry: 0, hl: 0.9, hw: 0.9 },
    ],
    hangWalls: [
      face("left", 1, 0, -7, 0, 0, 1, 9, 0, 12),
      face("right", -1, 0, 7, 0, 0, 1, 9, 0, 12),
      face("front", 0, -1, 0, 9, 1, 0, 7, 0, 12),
      // The back wall is split around the large window (x −4.25…4.25,
      // y 2.75…10.25), so no artwork ever covers the outside view.
      face("back-left", 0, 1, -5.625, -9, 1, 0, 1.375, 0, 12),
      face("back-right", 0, 1, 5.625, -9, 1, 0, 1.375, 0, 12),
      face("back-below", 0, 1, 0, -9, 1, 0, 4.25, 0, 2.75),
      face("back-above", 0, 1, 0, -9, 1, 0, 4.25, 10.25, 12),
    ],
    planLines: [
      { x1: -7, z1: -9, x2: 7, z2: -9 },
      { x1: -7, z1: -9, x2: -7, z2: 9 },
      { x1: 7, z1: -9, x2: 7, z2: 9 },
      { x1: -7, z1: 9, x2: 7, z2: 9 },
      { x1: -4.25, z1: -9, x2: 4.25, z2: -9 },
      { x1: -3.25, z1: -8.65, x2: 3.25, z2: -8.65 },
      { x1: -3.25, z1: -5.15, x2: 3.25, z2: -5.15 },
      { x1: -3.25, z1: -8.65, x2: -3.25, z2: -5.15 },
      { x1: 3.25, z1: -8.65, x2: 3.25, z2: -5.15 },
      { x1: 5.8, z1: 3, x2: 5.8, z2: -4.7 },
      { x1: -5.8, z1: 3, x2: -5.8, z2: -4.7 },
    ],
    thumbnail: "atrium-lattes",
    // High on the back wall, above the window.
    curatorialText: { y: 11.35, z: -8.86 },
  },
};

// The definition of a non-Sunlight layout, or null for Sunlight (which
// keeps its own data in lib/sunlight.ts).
export function galleryDef(layout: RoomLayout): GalleryDef | null {
  return (GALLERY_DEFS as Record<string, GalleryDef | undefined>)[layout] ?? null;
}

export function isGalleryLayout(layout: RoomLayout): boolean {
  return layout !== "sunlight" && layout in GALLERY_DEFS;
}

// Room-local z of the floor centre: the Sunlight floor is centred at
// z = −1, every other gallery reads its preset.
export function roomFloorCenterZ(layout: RoomLayout): number {
  if (layout === "sunlight") return SUNLIGHT_FLOOR_CENTER_Z;
  return roomLayouts[layout]?.floorCenterZ ?? 0;
}

// First-person entrance of a room (world coordinates come from adding
// the room's plan offset, like sunlightEntrance).
export function galleryCameraStart(layout: RoomLayout): { x: number; y: number; z: number; yaw: number; pitch: number } {
  if (layout === "sunlight") return SUNLIGHT_CAMERA_START;
  return galleryDef(layout)?.cameraStart ?? { x: 0, y: 1.6, z: 8, yaw: 0, pitch: -0.03 };
}

// All hangable wall faces of a gallery: its fixed geometry, plus the
// faces of any partition elements in the room (Claude's "cloisons are
// walls" rule — a partition is a hangable wall, with its own length
// and height). Partition faces carry the element's id, so a dropped
// artwork can snap to them like any other wall.
export function galleryHangWalls(layout: RoomLayout, elements?: RoomElement[]): HangWallFace[] {
  const faces = [...(galleryDef(layout)?.hangWalls ?? [])];
  for (const element of elements ?? []) {
    if (element.type !== "partition") continue;
    const dims = partitionDimsOf(element);
    const nx = Math.sin(element.rotation);
    const nz = Math.cos(element.rotation);
    const ax = Math.cos(element.rotation);
    const az = -Math.sin(element.rotation);
    // The panel's visual length includes its scale (the resize handle
    // scales the whole group), so the faces follow a resized panel.
    const halfLen = (dims.length * (element.scale ?? 1)) / 2;
    faces.push(
      { id: `${element.id}+`, nx, nz, cx: element.x, cz: element.z, ax, az, halfLen, minY: 0, maxY: dims.height },
      { id: `${element.id}-`, nx: -nx, nz: -nz, cx: element.x, cz: element.z, ax, az, halfLen, minY: 0, maxY: dims.height },
    );
  }
  return faces;
}

// Raycast a ray against every hangable wall face (the reference rooms'
// wallHit): the nearest face whose plane the ray meets inside the
// wall's extent. Returns null when the ray meets no wall — the caller
// falls back to the back wall.
export function galleryWallHit(
  origin: { x: number; y: number; z: number },
  direction: { x: number; y: number; z: number },
  layout: RoomLayout,
  elements?: RoomElement[],
): HangWallHit | null {
  return raycastHangWalls(origin, direction, galleryHangWalls(layout, elements));
}

// Which hangable walls a position sits on (the reference rooms'
// wallsForPosition): every face whose plane the position is within
// 0.45 m of and whose extent contains it. Interior walls come first,
// so a position near both an interior wall and a room wall hangs on
// the interior one. Each face carries the rotation an artwork on it
// must have (atan2 of its normal).
export function galleryWallsForPosition(
  position: { x: number; y: number; z: number },
  layout: RoomLayout,
  elements?: RoomElement[],
): { key: string; rotation: number }[] {
  const interior: { key: string; rotation: number }[] = [];
  const roomWalls: { key: string; rotation: number }[] = [];
  for (const face of galleryHangWalls(layout, elements)) {
    const dist = (position.x - face.cx) * face.nx + (position.z - face.cz) * face.nz;
    if (dist < -0.05 || dist > 0.45) continue;
    const along = (position.x - face.cx) * face.ax + (position.z - face.cz) * face.az;
    if (Math.abs(along) > face.halfLen + 0.3) continue;
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

// Place an artwork (or a text panel) on a wall hit (the reference
// rooms' putOnWall, shared with Sunlight): 0.1 m off the face,
// oriented by the wall normal, clamped inside the wall's extent.
export function galleryPlaceOnWall(
  hit: HangWallHit,
  artworkHeight: number,
  artworkWidth: number,
  alongOffset = 0,
): { position: [number, number, number]; rotation: number } {
  return sunlightPlaceOnWall(hit, artworkHeight, artworkWidth, alongOffset);
}
