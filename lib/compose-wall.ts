// Automatic wall composition ("Compose wall") — rectangle-packer
// (Guillotine bin packing) + curatorial rules, projected onto a 3D
// wall. Pure functions (no React): the editor builds ComposeItems
// from its selected artworks and applies the returned placements in a
// single snapshot, so the whole composition undoes in one step.
//
// How it works:
// 1. Order the artworks curatorially: largest in the centre, smaller
//    ones on either side, and never two artworks with the same dominant
//    hue family side by side (the dominant comes from the stored
//    ColorThief palette — the caller passes the hue family in).
// 2. Try a single row at eye level (centre 1.50 m, 12 cm between
//    works). This is the harmonious case from the research report: a
//    large work in the centre, small ones on either side.
// 3. If the row does not fit, fall back to rectangle-packer
//    (Guillotine, no 90° flips — a portrait never becomes a
//    landscape) to pack as many works as possible into the wall's 2D
//    area; the packed block is then centred on the wall and around eye
//    level. Works that still do not fit are reported, never forced.
// 4. Every placement stands 0.1 m off the wall face, oriented by the
//    wall normal — the same offset and orientation the drag-end snap
//    uses — so a composed work lands exactly as if hung by hand.
//
// The composition is only a suggestion: the curator drags anything
// that does not please them (the existing 3D drag still works).

import { GuillotineBinPack, Rect } from "rectangle-packer";
import type { HangWallFace, SunlightElement } from "@/lib/sunlight-elements";
import { SUNLIGHT_PANELS } from "@/lib/sunlight";
import { hueFamilyOf, type HueFamily } from "@/lib/palette";

// Curatorial constants (metres). The eye-level line is the museum
// standard; the gap is the minimum between two works; the edge margin
// keeps works off the wall's very ends and corners.
export const COMPOSE_EYE_LEVEL_M = 1.5;
export const COMPOSE_GAP_M = 0.12;
export const COMPOSE_EDGE_M = 0.15;

export type ComposeItem = {
  id: string;
  title: string;
  // Real size on the wall, in metres (dimensions field × scale).
  width: number;
  height: number;
  // Hue family of the stored palette's dominant colour (ColorThief),
  // or null when the artwork has no palette yet.
  dominantFamily: HueFamily | null;
};

export type ComposePlacement = {
  id: string;
  // Metres along the wall axis from the wall centre.
  along: number;
  // Centre height in metres.
  y: number;
  // Wall-normal rotation (atan2 of the face normal).
  rotation: number;
  // Room-local 3D position, 0.1 m off the wall face.
  position: [number, number, number];
};

export type ComposeResult = {
  placements: ComposePlacement[];
  // Artworks that could not be placed on this wall (too large for it,
  // or no room left even after 2D packing).
  unplaced: ComposeItem[];
  // "row" = one harmonious row at eye level; "packed" = the wall was
  // too short for one row, so the works were packed in several rows.
  layout: "row" | "packed";
  wallId: string;
  wallLabel: string;
  // One-line summary for the editor's inline message (never an alert).
  message: string;
};

// --- wall labels ----------------------------------------------------------

// Which way a wall face looks (the direction of its normal, i.e.
// where an artwork hung on it faces). The back wall of the room is at
// -z and the front at +z, so a normal with +z looks toward the front.
export function wallFaceDirection(nx: number, nz: number): "back" | "front" | "left" | "right" {
  if (Math.abs(nz) >= Math.abs(nx)) return nz >= 0 ? "front" : "back";
  return nx >= 0 ? "right" : "left";
}

// A human-readable label for a hangable wall face, with its length, so
// the curator can tell the walls apart in the wall picker. The two
// faces of a freestanding wall (panel, cloison) differ by the direction
// they look, which is what distinguishes them here.
export function wallFaceLabel(face: HangWallFace, elements?: SunlightElement[]): string {
  const len = (face.halfLen * 2).toFixed(1).replace(/\.0$/, "");
  const dir = wallFaceDirection(face.nx, face.nz);
  const base = face.id;
  if (base === "back") return `Back wall · ${len} m`;
  if (base === "front") return `Front wall · ${len} m`;
  if (base === "left") return `Left wall · ${len} m`;
  if (base === "right") return `Right wall · ${len} m`;
  if (base === "back-left") return `Back wall (left part) · ${len} m`;
  if (base === "back-right") return `Back wall (right part) · ${len} m`;
  // Sunlight panels: "panel-x,z+" / "panel-x,z-" — find the panel's
  // 1-based index among the room's three panels.
  const panelMatch = base.match(/^panel-(-?[\d.]+),(-?[\d.]+)[+-]$/);
  if (panelMatch) {
    const x = Number(panelMatch[1]);
    const z = Number(panelMatch[2]);
    const index = SUNLIGHT_PANELS.findIndex((panel) => panel.x === x && panel.z === z);
    const name = index >= 0 ? `Panel ${index + 1}` : "Panel";
    return `${name} · faces ${dir} · ${len} m`;
  }
  // Sunlight added walls: "{elementId}+" / "{elementId}-" — name the
  // element (e.g. "Middle wall (partition) 1").
  if (elements) {
    const elementId = base.replace(/[+-]$/, "");
    const element = elements.find((item) => item.id === elementId);
    if (element) return `${element.name} · faces ${dir} · ${len} m`;
  }
  if (base.startsWith("panel-")) return `Panel · faces ${dir} · ${len} m`;
  return `${base.replace(/-/g, " ")} · faces ${dir} · ${len} m`;
}

// --- curatorial ordering ---------------------------------------------------

function sameDominant(a: ComposeItem, b: ComposeItem): boolean {
  return a.dominantFamily !== null && a.dominantFamily === b.dominantFamily;
}

function clashCount(order: ComposeItem[]): number {
  let count = 0;
  for (let i = 0; i < order.length - 1; i += 1) {
    if (sameDominant(order[i], order[i + 1])) count += 1;
  }
  return count;
}

// Order artworks for a row: largest in the centre, then alternately
// the next largest to the left and to the right, so the row reads as a
// mountain (big centre, small sides). Then repair identical-dominant
// neighbours by adjacent swaps — each swap moves a work only one
// place, so the size shape barely changes, and a swap is only kept
// when it reduces the number of clashes. The colour rule is hard
// ("never two identical dominants side by side"); the mountain is a
// preference, so a clash can push the largest work off-centre.
export function orderRow(items: ComposeItem[]): ComposeItem[] {
  const bySize = [...items].sort((a, b) => b.width - a.width || b.height - a.height);
  const ordered: ComposeItem[] = [];
  // Largest in the centre; the rest alternate left / right.
  for (let i = 0; i < bySize.length; i += 1) {
    if (i === 0) ordered.push(bySize[i]);
    else if (i % 2 === 1) ordered.unshift(bySize[i]);
    else ordered.push(bySize[i]);
  }
  // Hill-climb: repeatedly take the adjacent swap that most reduces
  // the clash count, until no clash is left or no swap helps.
  for (let iter = 0; iter < 20; iter += 1) {
    const before = clashCount(ordered);
    if (before === 0) break;
    let bestSwap = -1;
    let bestCount = before;
    for (let i = 0; i < ordered.length - 1; i += 1) {
      const tmp = ordered[i];
      ordered[i] = ordered[i + 1];
      ordered[i + 1] = tmp;
      const after = clashCount(ordered);
      if (after < bestCount) {
        bestCount = after;
        bestSwap = i;
      }
      ordered[i + 1] = ordered[i];
      ordered[i] = tmp;
    }
    if (bestSwap === -1) break;
    const tmp = ordered[bestSwap];
    ordered[bestSwap] = ordered[bestSwap + 1];
    ordered[bestSwap + 1] = tmp;
  }
  return ordered;
}

// --- obstacles (collision blocks) ----------------------------------------

// A solid volume standing in front of a wall, in the same rotated-
// rectangle shape as the walk-collision blocks (lib/gallery-defs.ts
// GalleryBlock / lib/sunlight.ts SunlightBlock): centre (x, z),
// rotation ry, half-length hl along the block's local +X, half-width
// hw across it. A composed artwork must never land inside one —
// e.g. the Arche's dividing wall, which joins the left and right
// walls at z ≈ −4.1 and buries any work hung across the junction.
export type ComposeObstacle = { x: number; z: number; ry: number; hl: number; hw: number };

// An artwork hangs 0.10 m off its wall face, its frame spanning
// roughly 0.05…0.15 m off the face: a block only buries it when the
// block reaches into that slab.
const ARTWORK_SLAB_NEAR_M = 0.05;
const ARTWORK_SLAB_FAR_M = 0.15;

// The along-wall intervals a face's obstacles forbid, in the face's
// own along coordinate. A block whose volume straddles the face plane
// IS the wall (or a panel on it) — its collision band is the wall's
// own, and a work hung 0.10 m off the face sits visibly in front of
// it — so it forbids nothing. Only a block standing entirely in
// front of the face (its whole volume on the room side of the plane,
// reaching into the artwork slab) forbids the along-range it covers.
// Corners are projected, so a rotated block forbids its whole
// projected span: conservative, never a work inside a solid volume.
export function wallBlockedIntervals(face: HangWallFace, obstacles: ComposeObstacle[]): [number, number][] {
  const intervals: [number, number][] = [];
  for (const block of obstacles) {
    const corners: [number, number][] = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const lx = sx * block.hl;
        const lz = sz * block.hw;
        const c = Math.cos(block.ry);
        const s = Math.sin(block.ry);
        corners.push([block.x + lx * c + lz * s, block.z - lx * s + lz * c]);
      }
    }
    const dists = corners.map(([x, z]) => (x - face.cx) * face.nx + (z - face.cz) * face.nz);
    if (Math.min(...dists) < 0 && Math.max(...dists) > 0) continue; // straddles the face: the wall itself
    if (Math.max(...dists) < ARTWORK_SLAB_NEAR_M || Math.min(...dists) > ARTWORK_SLAB_FAR_M) continue;
    const alongs = corners.map(([x, z]) => (x - face.cx) * face.ax + (z - face.cz) * face.az);
    intervals.push([Math.min(...alongs), Math.max(...alongs)]);
  }
  return intervals;
}

// Does an artwork centred at `along`, `width` wide, overlap any
// forbidden interval on its wall?
export function artworkOverlapsBlocked(along: number, width: number, intervals: [number, number][]): boolean {
  const lo = along - width / 2;
  const hi = along + width / 2;
  return intervals.some(([a, b]) => lo < b && hi > a);
}

// Centre height for an artwork on a wall: eye level when it fits, else
// clamped inside the wall's height range (a tall work on a short wall
// sits as high as it can). When the work is taller than the wall the
// interval is empty and the wall's midpoint is returned — the caller
// filters such works out first, so this is only a safety net.
function eyeLevelY(height: number, face: HangWallFace): number {
  const lo = face.minY + height / 2 + 0.02;
  const hi = face.maxY - height / 2 - 0.02;
  if (lo > hi) return (face.minY + face.maxY) / 2;
  return Math.min(Math.max(COMPOSE_EYE_LEVEL_M, lo), hi);
}

function makePlacement(item: ComposeItem, along: number, y: number, face: HangWallFace): ComposePlacement {
  return {
    id: item.id,
    along,
    y,
    rotation: Math.atan2(face.nx, face.nz),
    position: [
      face.cx + face.ax * along + face.nx * 0.1,
      y,
      face.cz + face.az * along + face.nz * 0.1,
    ],
  };
}

function plural(count: number, singular: string): string {
  return count === 1 ? singular : `${singular}s`;
}

// --- the composition -------------------------------------------------------

export function composeWall(items: ComposeItem[], face: HangWallFace, obstacles: ComposeObstacle[] = []): ComposeResult {
  const wallLabel = wallFaceLabel(face);
  const result = (placements: ComposePlacement[], unplaced: ComposeItem[], layout: "row" | "packed", message: string): ComposeResult => ({
    placements,
    unplaced,
    layout,
    wallId: face.id,
    wallLabel,
    message,
  });
  if (items.length === 0) {
    return result([], [], "row", "Select at least 2 artworks to compose a wall.");
  }
  const usableHalf = Math.max(0, face.halfLen - COMPOSE_EDGE_M);
  const usableLen = 2 * usableHalf;
  const wallHeight = face.maxY - face.minY;
  // Works that can never fit this wall, whatever the arrangement:
  // wider than the usable length, or taller than the wall itself.
  const fittable = items.filter(
    (item) => item.width > 0 && item.height > 0 && item.width <= usableLen && item.height <= wallHeight,
  );
  const tooBig = items.filter(
    (item) => !(item.width > 0 && item.height > 0 && item.width <= usableLen && item.height <= wallHeight),
  );
  if (fittable.length === 0) {
    return result(
      [],
      items,
      "row",
      `None of the selected artworks fit on the ${wallLabel}. Try a longer wall.`,
    );
  }

  // 1. One row at eye level (the harmonious case). The row is centred
  // on the wall; each centre sits at 1.50 m (clamped for tall works).
  // A solid volume in front of the wall (a dividing wall joining it,
  // furniture against it) forbids the along-range it covers: the row
  // is shifted along the wall to clear it — first the centred row,
  // then the row ending where a forbidden stretch starts, then the
  // row starting where one ends, nearest to centred first. When no
  // shift clears the whole row, the packed layout below places the
  // works around the obstacle instead.
  const blocked = wallBlockedIntervals(face, obstacles);
  const ordered = orderRow(fittable);
  const totalWidth = ordered.reduce((sum, item) => sum + item.width, 0) + Math.max(0, ordered.length - 1) * COMPOSE_GAP_M;
  if (totalWidth <= usableLen) {
    const centredStart = -totalWidth / 2;
    const starts = new Set<number>([centredStart]);
    for (const [a, b] of blocked) {
      starts.add(a - totalWidth);
      starts.add(b);
    }
    const candidates = [...starts]
      .map((start) => Math.min(Math.max(start, -usableHalf), usableHalf - totalWidth))
      .filter((start, index, list) => list.indexOf(start) === index)
      .sort((a, b) => Math.abs(a - centredStart) - Math.abs(b - centredStart));
    for (const start of candidates) {
      let cursor = start;
      const centres = ordered.map((item) => {
        const along = cursor + item.width / 2;
        cursor += item.width + COMPOSE_GAP_M;
        return { item, along };
      });
      if (centres.some(({ item, along }) => artworkOverlapsBlocked(along, item.width, blocked))) continue;
      const placements = centres.map(({ item, along }) => makePlacement(item, along, eyeLevelY(item.height, face), face));
      const placed = placements.length;
      const shifted = Math.abs(start - centredStart) > 0.001;
      const message =
        tooBig.length === 0
          ? `Composed ${placed} ${plural(placed, "artwork")} on the ${wallLabel}, one row at eye level (1.50 m), 12 cm apart${shifted ? ", shifted along the wall to clear a wall or furniture in front of it" : ""}.`
          : `Composed ${placed} ${plural(placed, "artwork")} on the ${wallLabel} in one row. ${tooBig.length} ${plural(tooBig.length, "artwork")} did not fit (too large for this wall). Try a longer wall.`;
      return result(placements, tooBig, "row", message);
    }
    // No shift clears the row: fall through to the packed layout,
    // which places the works around the obstacle.
  }

  // 2. The row does not fit: pack as many works as possible into the
  // wall's 2D area with rectangle-packer's Guillotine bin packer.
  // Rectangles carry the 12 cm margin on their right and bottom, so
  // neighbours end up 12 cm apart; flips are forbidden, so a portrait
  // never becomes a landscape. The bin is the usable wall area plus
  // one gap, so the outer works keep their margin to the wall edge.
  // Centimetres (integers) keep the packer exact.
  const binW = Math.max(1, Math.round((usableLen + COMPOSE_GAP_M) * 100));
  const binH = Math.max(1, Math.round((wallHeight + COMPOSE_GAP_M) * 100));
  const bin = new GuillotineBinPack(binW, binH, false);
  const rects = fittable.map((item) => ({
    item,
    rect: new Rect(
      0,
      0,
      Math.ceil((item.width + COMPOSE_GAP_M) * 100),
      Math.ceil((item.height + COMPOSE_GAP_M) * 100),
    ),
  }));
  bin.InsertSizes(
    rects.map((entry) => entry.rect),
    true,
    GuillotineBinPack.FreeRectChoiceHeuristic.RectBestAreaFit,
    GuillotineBinPack.GuillotineSplitHeuristic.SplitShorterLeftoverAxis,
  );
  const placedEntries = rects.filter((entry) => bin.usedRectangles.includes(entry.rect));
  const unpacked = rects
    .filter((entry) => !bin.usedRectangles.includes(entry.rect))
    .map((entry) => entry.item);
  const unplaced = [...tooBig, ...unpacked];
  if (placedEntries.length === 0) {
    return result(
      [],
      items,
      "packed",
      `None of the selected artworks fit on the ${wallLabel}. Try a longer wall.`,
    );
  }
  // Map the packed rectangles back onto the wall. The packer fills
  // from the top-left (y grows downward); the bin's top is half a gap
  // above the wall's top, its centre is the wall's centre.
  let remaining = placedEntries.map((entry) => {
    const wCm = entry.item.width * 100;
    const hCm = entry.item.height * 100;
    const along = (entry.rect.x + wCm / 2 - binW / 2) / 100;
    const y = face.maxY + COMPOSE_GAP_M / 2 - (entry.rect.y + hCm / 2) / 100;
    return { item: entry.item, along, y };
  });
  const blockedItems: ComposeItem[] = [];
  let placements: ComposePlacement[] = [];
  // Centre the packed block on the wall and around eye level, so it
  // reads as an intentional hang rather than a pile in a corner. A
  // work that lands inside a solid volume in front of the wall is
  // dropped (never buried) and the rest are re-centred; the re-centre
  // can push another work into the obstacle, so this repeats until
  // every kept work is clear.
  for (let attempt = 0; attempt < 3 && remaining.length > 0; attempt += 1) {
    const raw = remaining;
    const minAlong = Math.min(...raw.map((p) => p.along - p.item.width / 2));
    const maxAlong = Math.max(...raw.map((p) => p.along + p.item.width / 2));
    const shiftAlong = -(minAlong + maxAlong) / 2;
    const minY = Math.min(...raw.map((p) => p.y - p.item.height / 2));
    const maxY = Math.max(...raw.map((p) => p.y + p.item.height / 2));
    const blockHeight = maxY - minY;
    let shiftY = COMPOSE_EYE_LEVEL_M - (minY + maxY) / 2;
    if (blockHeight > wallHeight) {
      // Taller than the wall: centre on the wall instead of eye level.
      shiftY = (face.minY + face.maxY) / 2 - (minY + maxY) / 2;
    } else {
      if (maxY + shiftY > face.maxY) shiftY -= maxY + shiftY - face.maxY;
      if (minY + shiftY < face.minY) shiftY += face.minY - (minY + shiftY);
    }
    placements = raw.map((p) => {
      const along = Math.min(
        Math.max(p.along + shiftAlong, -face.halfLen + p.item.width / 2),
        face.halfLen - p.item.width / 2,
      );
      return makePlacement(p.item, along, p.y + shiftY, face);
    });
    const buried = placements.filter((p) => {
      const item = remaining.find((entry) => entry.item.id === p.id)?.item;
      return item ? artworkOverlapsBlocked(p.along, item.width, blocked) : false;
    });
    if (buried.length === 0) break;
    const buriedIds = new Set(buried.map((p) => p.id));
    blockedItems.push(...remaining.filter((p) => buriedIds.has(p.item.id)).map((p) => p.item));
    // Keep the clear works of this attempt as the fallback: if the
    // re-centre below buries another work, the loop drops that one
    // too, but a work already clear is never lost.
    placements = placements.filter((p) => !buriedIds.has(p.id));
    remaining = remaining.filter((p) => !buriedIds.has(p.item.id));
  }
  const finalUnplaced = [...tooBig, ...unpacked, ...blockedItems];
  // How many rows the packed hang has (distinct centre heights).
  const rows = new Set(placements.map((p) => Math.round(p.y * 20) / 20)).size;
  const placedCount = placements.length;
  const message =
    finalUnplaced.length === 0
      ? `Composed ${placedCount} ${plural(placedCount, "artwork")} on the ${wallLabel} in ${rows} ${plural(rows, "row")}, too many for a single row at eye level. Drag any work to adjust.`
      : blockedItems.length > 0
        ? `Placed ${placedCount} of ${items.length} ${plural(items.length, "artwork")} on the ${wallLabel}. ${blockedItems.length} ${plural(blockedItems.length, "artwork")} could not be placed: part of this wall is blocked where it meets another wall or furniture.`
        : `Placed ${placedCount} of ${items.length} ${plural(items.length, "artwork")} on the ${wallLabel}. ${finalUnplaced.length} did not fit. Try a longer wall.`;
  return result(placements, finalUnplaced, "packed", message);
}

// Re-exported for the editor's wall picker: the hue family of an
// artwork's stored palette dominant, or null when it has none.
export function dominantFamilyOf(palette: string[] | null | undefined): HueFamily | null {
  if (!palette || palette.length === 0) return null;
  return hueFamilyOf(palette[0]);
}
