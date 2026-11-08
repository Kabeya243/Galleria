// Snap a dropped artwork onto a wall — shared by the editor's
// drag-end handler and the exhibition test harness, so the rule is
// tested exactly as shipped.
//
// A dropped work must ALWAYS land on a wall, never where it fell:
// 1. Prefer a wall the work already stands on, keeping the one it
//    faces (a wall-aware drag may have turned it onto a new wall).
// 2. Else the nearest hangable face (no tolerance cut-off —
//    closestHangWall always returns a face when one exists).
// 3. Else a face with the artwork's own facing, closest plane first.
// Then the work is placed 0.1 m off that face, clamped inside it
// (sunlightPlaceOnWall), and — the part the old snap missed —
// shifted along the wall when a solid volume stands in front of it:
// the Arche dividing wall joins the side walls, so a work dropped
// across the junction would otherwise be buried in it, saved with
// the exhibition, and open inside a wall. When no shift clears the
// work on that face, the next-closest face is tried instead.

import { galleryDef, galleryHangWalls, galleryWallsForPosition } from "@/lib/gallery-defs";
import { partitionDimsOf } from "@/lib/editor-params";
import type { RoomElement } from "@/lib/elements";
import type { GalleryRoom, RoomLayout } from "@/lib/rooms";
import { SUNLIGHT_BLOCKS } from "@/lib/sunlight";
import {
  closestHangWall,
  rotationMatches,
  sunlightElementCollisionBlocks,
  sunlightHangWalls,
  sunlightPlaceOnWall,
  sunlightWallsForPosition,
  type HangWallFace,
  type SunlightElement,
} from "@/lib/sunlight-elements";
import {
  artworkOverlapsBlocked,
  wallBlockedIntervals,
  type ComposeObstacle,
} from "@/lib/compose-wall";

export type SnapArtworkInput = {
  position: [number, number, number];
  rotation: number;
  width: number;
  height: number;
};

export type SnapContext = {
  layout: RoomLayout;
  // Generic rooms: the room's Asset Library elements (partitions
  // contribute both hangable faces and collision blocks).
  elements?: RoomElement[];
  // Sunlight rooms: the room's Sunlight elements.
  sunlightElements?: SunlightElement[];
};

// The solid volumes standing in a room, in the shape compose-wall
// understands: the room's own collision blocks plus the blocks of
// its partition elements. A partition's own block straddles its own
// faces (the wall itself) and forbids nothing there — but it does
// forbid works on the room wall behind it.
export function snapObstacles(context: SnapContext): ComposeObstacle[] {
  if (context.layout === "sunlight") {
    return [...SUNLIGHT_BLOCKS, ...sunlightElementCollisionBlocks(context.sunlightElements ?? [])];
  }
  return [
    ...(galleryDef(context.layout)?.blocks ?? []),
    ...(context.elements ?? [])
      .filter((element) => element.type === "partition" && !element.hidden)
      .map((element) => {
        const dims = partitionDimsOf(element);
        return {
          x: element.x,
          z: element.z,
          ry: element.rotation,
          hl: (dims.length * (element.scale ?? 1)) / 2,
          hw: dims.thickness / 2,
        };
      }),
  ];
}

function hangWalls(context: SnapContext): HangWallFace[] {
  return context.layout === "sunlight"
    ? sunlightHangWalls(context.sunlightElements ?? [])
    : galleryHangWalls(context.layout, context.elements);
}

// The nearest clear `along` on a face for a work of `width`, starting
// from `along`: the work itself when clear, else the work slid just
// past the nearest end of the forbidden stretch it overlaps, staying
// inside the face. Null when the face has no clear stretch wide
// enough for the work at all.
function clearAlong(
  along: number,
  width: number,
  face: HangWallFace,
  intervals: [number, number][],
): number | null {
  const lo = -face.halfLen + width / 2;
  const hi = face.halfLen - width / 2;
  if (lo > hi) return 0; // wider than the face: centred (see placeOnWall)
  const clamped = Math.min(Math.max(along, lo), hi);
  if (!artworkOverlapsBlocked(clamped, width, intervals)) return clamped;
  const candidates = intervals
    .flatMap(([a, b]) => [b + width / 2 + 0.02, a - width / 2 - 0.02])
    .filter((candidate) => candidate >= lo && candidate <= hi)
    .sort((a, b) => Math.abs(a - along) - Math.abs(b - along));
  for (const candidate of candidates) {
    if (!artworkOverlapsBlocked(candidate, width, intervals)) return candidate;
  }
  return null;
}

export function snapArtworkToWall(
  artwork: SnapArtworkInput,
  room: GalleryRoom,
  context?: SnapContext,
): { position: [number, number, number]; rotation: number } | null {
  const ctx: SnapContext = context ?? {
    layout: room.layout,
    elements: room.elements,
    sunlightElements: room.sunlightElements,
  };
  const faces = hangWalls(ctx);
  if (faces.length === 0) return null;
  const obstacles = snapObstacles(ctx);
  const position = { x: artwork.position[0], y: artwork.position[1], z: artwork.position[2] };

  // Candidate faces, best first. A face the work actually fits on
  // (wide and tall enough) always beats one it merely stands near:
  // a hall panel sits 5 cm in front of its side wall, so by raw
  // distance it wins over the 46 m wall behind it — and a 1.30 m work
  // centred on a 0.90 m panel overhangs into mid-air on both sides.
  // Order: the wall under the drop point when it fits, then every
  // fitting face by 3D distance, then the wall under the drop point
  // when it does not fit, then every other face by distance. Each
  // candidate is tried in turn until one takes the work clear of
  // every solid volume.
  const fits = (face: HangWallFace) =>
    artwork.width <= face.halfLen * 2 + 0.001 && artwork.height <= face.maxY - face.minY + 0.001;
  const walls =
    room.layout === "sunlight"
      ? sunlightWallsForPosition(position, ctx.sunlightElements ?? [])
      : galleryWallsForPosition(position, room.layout, ctx.elements);
  const wall = walls.find((item) => rotationMatches(item.rotation, artwork.rotation)) ?? walls[0];
  const wallFace = wall ? faces.find((item) => item.id === wall.key) : undefined;
  const byDistance = [...faces]
    .map((face) => ({ face, hit: closestHangWall(position, [face]) }))
    .sort((a, b) => (a.hit?.distance ?? Infinity) - (b.hit?.distance ?? Infinity))
    .map((entry) => entry.face);
  const ordered: HangWallFace[] = [];
  const pushFace = (face: HangWallFace | undefined) => {
    if (face && !ordered.some((item) => item.id === face.id)) ordered.push(face);
  };
  if (wallFace && fits(wallFace)) pushFace(wallFace);
  for (const face of byDistance) if (fits(face)) pushFace(face);
  if (wallFace) pushFace(wallFace);
  for (const face of byDistance) pushFace(face);
  for (const face of faces.filter((item) => rotationMatches(Math.atan2(item.nx, item.nz), artwork.rotation))) {
    pushFace(face);
  }

  for (const face of ordered) {
    const placed = sunlightPlaceOnWall(
      { point: position, normal: { x: face.nx, z: face.nz }, face },
      artwork.height,
      artwork.width,
    );
    const along = (placed.position[0] - face.cx) * face.ax + (placed.position[2] - face.cz) * face.az;
    const blocked = wallBlockedIntervals(face, obstacles);
    if (!artworkOverlapsBlocked(along, artwork.width, blocked)) return placed;
    const cleared = clearAlong(along, artwork.width, face, blocked);
    if (cleared === null) continue;
    return {
      position: [
        face.cx + face.ax * cleared + face.nx * 0.1,
        placed.position[1],
        face.cz + face.az * cleared + face.nz * 0.1,
      ],
      rotation: placed.rotation,
    };
  }
  return null;
}
