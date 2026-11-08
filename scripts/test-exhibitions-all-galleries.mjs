// Exhibition tests — EVERY gallery (Chantier 5, night mission SANAA).
//
// Run: node scripts/test-exhibitions-all-galleries.mjs [--report public/test-reports/exhibitions-<stamp>.json]
//
// What it does, per gallery (Sunlight + the 20 layouts in
// lib/gallery-defs.ts — 21 in total, enumerated from the code, none
// skipped):
//   (a) definition integrity: bounds, camera start, walk speed, light
//       type, blocks and hangable wall faces;
//   (b) opening an exhibition: a room of that layout round-trips
//       through parseGalleryRooms (the Exhibition.rooms JSON path) and
//       opens empty — no template artworks are seeded any more
//       (Chantier 6: fictitious/placeholder works removed);
//   (c) hanging: the real Compose wall logic (lib/compose-wall.ts) on
//       the room's back wall (or longest wall) with 3 real-size works
//       (The Nose Ring 1.30×0.94, The Boy with Gold Jewelry 1.20×0.89,
//       The Family Photograph 1.30×0.94) and with 7 works (a solo-expo
//       wall) — every placement is checked against the wall plane
//       (0.1 m stand-off), the wall extent, the wall height, eye level
//       1.50 m, the 12 cm gaps, largest-in-the-centre, no overlaps and
//       the room bounds; plus a single-work raycast +
//       galleryPlaceOnWall from the camera start;
//   (d) navigation: camera start inside the bounds and out of every
//       collision block, a walkable step exists, plan lines inside the
//       room, teleport offsets distinct between two rooms.
//
// Code-level only: this script executes the repo's own TypeScript
// (imported via Node 24 type-stripping from staged copies with the
// "@/lib/" alias rewritten to relative paths — the staging dir is
// created under scripts/ and removed at the end). It does NOT render
// WebGL: visual checks (real shadows, skylight light, the 3D shells
// matching these numbers) still need a live browser session.
//
// Exit 0 when every check passes, 1 otherwise. Prints one line per
// check and a per-room table at the end.

import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const STAGING = join(ROOT, "scripts", ".exh-staging");
const STAGED = ["gallery-defs", "sunlight", "sunlight-elements", "compose-wall", "rooms", "editor-params", "elements", "palette", "snap-to-wall", "place-in-view"];

const checks = [];
function check(room, id, name, fn) {
  try {
    const detail = fn();
    checks.push({ room, id, name, status: "pass", detail: String(detail ?? "") });
    console.log(`PASS  [${room}] ${name} — ${detail ?? ""}`);
  } catch (err) {
    checks.push({ room, id, name, status: "fail", detail: err instanceof Error ? err.message : String(err) });
    console.log(`FAIL  [${room}] ${name} — ${err instanceof Error ? err.message : err}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
const approx = (a, b, eps = 1e-6) => Math.abs(a - b) <= eps;

// --- stage the lib sources (alias "@/lib/" -> "./") and import them ---
mkdirSync(STAGING, { recursive: true });
try {
  for (const name of STAGED) {
    const src = readFileSync(join(ROOT, "lib", `${name}.ts`), "utf8");
    // "@/lib/x" -> "./x", and extensionless relative imports ("./x")
    // -> "./x.ts" (Node ESM needs the extension; type-stripping then
    // handles the .ts file).
    const staged = src
      .replaceAll("@/lib/", "./")
      .replace(/from "\.\/([a-z0-9-]+)"/g, 'from "./$1.ts"');
    writeFileSync(join(STAGING, `${name}.ts`), staged);
  }
  const defs = await import(pathToFileURL(join(STAGING, "gallery-defs.ts")).href);
  const sun = await import(pathToFileURL(join(STAGING, "sunlight.ts")).href);
  const sunEl = await import(pathToFileURL(join(STAGING, "sunlight-elements.ts")).href);
  const compose = await import(pathToFileURL(join(STAGING, "compose-wall.ts")).href);
  const snap = await import(pathToFileURL(join(STAGING, "snap-to-wall.ts")).href);
  const elementsLib = await import(pathToFileURL(join(STAGING, "elements.ts")).href);
  const rooms = await import(pathToFileURL(join(STAGING, "rooms.ts")).href);
  const placeInView = await import(pathToFileURL(join(STAGING, "place-in-view.ts")).href);

  const { galleryDef, galleryHangWalls, galleryWallHit, galleryWallsForPosition, galleryPlaceOnWall, galleryCameraStart } = defs;
  const { SUNLIGHT_BOUNDS, SUNLIGHT_WALK_SPEED, SUNLIGHT_CAMERA_START, SUNLIGHT_BLOCKS, sunlightHitWith } = sun;
  const { sunlightHangWalls, sunlightWallHit, sunlightWallsForPosition, rotationMatches } = sunEl;
  const { composeWall, COMPOSE_EYE_LEVEL_M, COMPOSE_GAP_M } = compose;
  const { roomLayouts, createGalleryRoom, parseGalleryRooms, roomPlanOffsets } = rooms;

  const LAYOUTS = Object.keys(roomLayouts);
  const LIGHT_TYPES = new Set(["sunlight", "spot-warm", "spot-cool", "ambient", "stone-warm"]);

  // Rotated-rectangle hit test (same formula as sunlightHitWith, but
  // over a gallery-defs block list, which uses the same shape).
  function blockHit(blocks, x, z, margin = 0.4) {
    for (const b of blocks) {
      const dx = x - b.x;
      const dz = z - b.z;
      const c = Math.cos(b.ry);
      const s = Math.sin(b.ry);
      const lx = dx * c - dz * s;
      const lz = dx * s + dz * c;
      if (Math.abs(lx) < b.hl + margin && Math.abs(lz) < b.hw + margin) return b;
    }
    return null;
  }
  function rawBlockHit(blocks, x, z) {
    return blockHit(blocks, x, z, 0);
  }
  // Room data for a layout: Sunlight keeps its own data, the rest
  // comes from galleryDef.
  function roomData(layout) {
    if (layout === "sunlight") {
      return {
        bounds: SUNLIGHT_BOUNDS,
        walkSpeed: SUNLIGHT_WALK_SPEED,
        cameraStart: SUNLIGHT_CAMERA_START,
        blocks: SUNLIGHT_BLOCKS,
        hangWalls: sunlightHangWalls([]),
        environment: true,
        floorCenterZ: -1,
      };
    }
    const def = galleryDef(layout);
    return {
      bounds: def.bounds,
      walkSpeed: def.walkSpeed,
      cameraStart: def.cameraStart,
      blocks: def.blocks,
      hangWalls: galleryHangWalls(layout),
      environment: def.environment,
      floorCenterZ: def.floorCenterZ,
      def,
    };
  }
  function wallsForPosition(layout, pos) {
    return layout === "sunlight"
      ? sunlightWallsForPosition(pos, [])
      : galleryWallsForPosition(pos, layout);
  }
  function wallHit(layout, origin, dir) {
    return layout === "sunlight"
      ? sunlightWallHit(origin, dir, [])
      : galleryWallHit(origin, dir, layout);
  }
  // The wall Compose targets: the back wall when it exists, else the
  // longest face tall enough for a 1.5 m hang.
  function composeTarget(layout) {
    const { hangWalls } = roomData(layout);
    const back = hangWalls.find((f) => f.id === "back");
    if (back) return back;
    const tall = hangWalls.filter((f) => f.maxY - f.minY >= 2);
    return [...tall].sort((a, b) => b.halfLen - a.halfLen)[0] ?? hangWalls[0];
  }
  function longestWall(layout) {
    const { hangWalls } = roomData(layout);
    const tall = hangWalls.filter((f) => f.maxY - f.minY >= 2);
    return [...tall].sort((a, b) => b.halfLen - a.halfLen)[0] ?? hangWalls[0];
  }
  // Physical envelope of a room: the walk bounds PLUS every hangable
  // wall face's segment (a wall plane sits OUTSIDE the walk bounds —
  // e.g. Sunlight's back wall is at z = −14 while the camera is
  // clamped to z ≥ −13.4 — so an artwork correctly hung 0.1 m off a
  // perimeter wall is outside the walk bounds by design; the envelope
  // is what "in the room" means for a hung work).
  function physicalEnvelope(layout) {
    const { bounds, hangWalls } = roomData(layout);
    let minX = bounds.minX;
    let maxX = bounds.maxX;
    let minZ = bounds.minZ;
    let maxZ = bounds.maxZ;
    for (const f of hangWalls) {
      minX = Math.min(minX, f.cx);
      maxX = Math.max(maxX, f.cx);
      minZ = Math.min(minZ, f.cz);
      maxZ = Math.max(maxZ, f.cz);
      for (const s of [-1, 1]) {
        minX = Math.min(minX, f.cx + f.ax * s * f.halfLen);
        maxX = Math.max(maxX, f.cx + f.ax * s * f.halfLen);
        minZ = Math.min(minZ, f.cz + f.az * s * f.halfLen);
        maxZ = Math.max(maxZ, f.cz + f.az * s * f.halfLen);
      }
    }
    const m = 0.3;
    return { minX: minX - m, maxX: maxX + m, minZ: minZ - m, maxZ: maxZ + m };
  }
  // Does a collision block straddle a wall face's plane? Wall
  // collision volumes do (e.g. Vitrine's left-wall band x −8.6…−7.7
  // straddles the wall plane x = −8): an artwork hung 0.1 m off that
  // wall sits inside the band and is perfectly visible — the band is
  // the wall's own collision, not furniture. Only a block entirely in
  // FRONT of the wall can bury a hung work.
  function blockStraddlesFace(block, face) {
    const corners = [];
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const lx = sx * block.hl;
        const lz = sz * block.hw;
        const c = Math.cos(block.ry);
        const s = Math.sin(block.ry);
        const wx = block.x + lx * c + lz * s;
        const wz = block.z - lx * s + lz * c;
        corners.push((wx - face.cx) * face.nx + (wz - face.cz) * face.nz);
      }
    }
    const lo = Math.min(...corners);
    const hi = Math.max(...corners);
    return lo < 0 && hi > 0;
  }
  // Geometry invariants shared by every compose placement.
  function assertPlacementOnWall(p, item, face, envelope, blocks, faceIsPerimeter) {
    const dist = (p.position[0] - face.cx) * face.nx + (p.position[2] - face.cz) * face.nz;
    assert(approx(dist, 0.1, 0.002), `${item.id}: ${dist.toFixed(3)} m off the ${face.id} wall plane (expected 0.100)`);
    assert(Math.abs(p.along) + item.width / 2 <= face.halfLen + 0.002, `${item.id}: along ${p.along.toFixed(2)} + half-width ${(item.width / 2).toFixed(2)} exceeds ${face.id} half-length ${face.halfLen}`);
    assert(p.y - item.height / 2 >= face.minY - 0.002 && p.y + item.height / 2 <= face.maxY + 0.002, `${item.id}: y ${p.y.toFixed(2)} ± ${(item.height / 2).toFixed(2)} outside ${face.id} height ${face.minY}…${face.maxY}`);
    assert(p.position[0] >= envelope.minX && p.position[0] <= envelope.maxX && p.position[2] >= envelope.minZ && p.position[2] <= envelope.maxZ, `${item.id}: position (${p.position[0].toFixed(2)}, ${p.position[2].toFixed(2)}) outside the room's physical envelope`);
    if (faceIsPerimeter) {
      // A work buried in a block that stands entirely in front of its
      // wall (furniture, pilaster); wall-straddling collision bands
      // are the wall itself and do not count.
      const burying = blocks.find((b) => rawBlockHit([b], p.position[0], p.position[2]) && !blockStraddlesFace(b, face));
      assert(!burying, `${item.id}: hangs inside a collision block at (${p.position[0].toFixed(2)}, ${p.position[2].toFixed(2)}) — block ${JSON.stringify(burying)} stands in front of the ${face.id} wall`);
    }
    assert(approx(p.rotation, Math.atan2(face.nx, face.nz), 0.001), `${item.id}: rotation ${p.rotation.toFixed(3)} != wall normal ${Math.atan2(face.nx, face.nz).toFixed(3)}`);
  }
  function assertNoOverlaps(placements, items) {
    const byId = new Map(items.map((i) => [i.id, i]));
    const sorted = [...placements].sort((a, b) => a.along - b.along);
    for (let i = 0; i < sorted.length; i += 1) {
      for (let j = i + 1; j < sorted.length; j += 1) {
        const a = sorted[i];
        const b = sorted[j];
        const wa = byId.get(a.id);
        const wb = byId.get(b.id);
        const alongOverlap = Math.abs(a.along - b.along) < (wa.width + wb.width) / 2 - 0.001;
        const yOverlap = Math.abs(a.y - b.y) < (wa.height + wb.height) / 2 - 0.001;
        assert(!(alongOverlap && yOverlap), `${a.id} overlaps ${b.id}`);
      }
    }
  }

  const THREE_WORKS = [
    { id: "nose-ring", title: "The Nose Ring", width: 1.3, height: 0.94, dominantFamily: null },
    { id: "boy-gold", title: "The Boy with Gold Jewelry", width: 1.2, height: 0.89, dominantFamily: null },
    { id: "family-photo", title: "The Family Photograph", width: 1.3, height: 0.94, dominantFamily: null },
  ];
  const SEVEN_WORKS = [
    ...THREE_WORKS,
    { id: "w4", title: "Work 4", width: 0.9, height: 1.2, dominantFamily: null },
    { id: "w5", title: "Work 5", width: 1.1, height: 0.8, dominantFamily: null },
    { id: "w6", title: "Work 6", width: 0.7, height: 1.1, dominantFamily: null },
    { id: "w7", title: "Work 7", width: 1.0, height: 0.75, dominantFamily: null },
  ];

  // ---------- Global: the full set ----------
  check("—", "all-layouts", `All 21 gallery layouts enumerated (Sunlight + 20 defs)`, () => {
    assert(LAYOUTS.length === 21, `expected 21 layouts, found ${LAYOUTS.length}: ${LAYOUTS.join(", ")}`);
    for (const layout of LAYOUTS) {
      assert(layout === "sunlight" || galleryDef(layout), `${layout} has no galleryDef`);
    }
    return LAYOUTS.join(", ");
  });
  check("—", "schema", "Prisma Exhibition has rooms JSON + artworks with roomId; pages exist", () => {
    const schema = readFileSync(join(ROOT, "prisma", "schema.prisma"), "utf8");
    for (const s of ["model Exhibition {", "rooms       String", "artworks    Artwork[]", "roomId       String"]) {
      assert(schema.includes(s), `schema missing ${s}`);
    }
    for (const f of ["app/galleries/page.tsx", "app/exhibition/[slug]/page.tsx", "components/public-exhibition.tsx"]) {
      assert(existsSync(join(ROOT, f)), `missing ${f}`);
    }
    const pub = readFileSync(join(ROOT, "components/public-exhibition.tsx"), "utf8");
    assert(pub.includes("GalleryScene"), "public exhibition does not render GalleryScene");
    assert(pub.includes("parseGalleryRooms") || readFileSync(join(ROOT, "app/exhibition/[slug]/page.tsx"), "utf8").includes("parseGalleryRooms"), "exhibition page does not parse rooms");
    return "Exhibition.rooms + Artwork.roomId + /galleries + /exhibition/[slug] + GalleryScene";
  });

  // ---------- Global: switching a room's layout re-hangs its works ----------
  // A layout switch used to move every artwork to z = −depth / 2 +
  // 0.28 — the preset depth is not the back wall — stacking them on a
  // bogus line (in front of / behind / outside the new room). The
  // editor now composes them onto the new layout's back wall instead;
  // this check replays that re-hang for every target layout with the
  // real Compose logic, so no switch ever lands a work in mid-air or
  // inside a wall.
  check("—", "layout-switch-rehang", "Layout switch: 3 real works re-hung on every other layout's back/longest wall", () => {
    for (const target of LAYOUTS) {
      const face = composeTarget(target);
      const envelope = physicalEnvelope(target);
      const { blocks } = roomData(target);
      const res = composeWall(THREE_WORKS, face, blocks);
      if (target === "serpentine") {
        assert(res.placements.length >= 1, `switch to serpentine placed nothing — ${res.message}`);
        continue;
      }
      assert(res.unplaced.length === 0, `switch to ${target}: unplaced ${res.unplaced.map((u) => u.id).join(", ")} — ${res.message}`);
      const perimeter = ["back", "front", "left", "right", "back-left", "back-right", "back-below", "back-above"].includes(face.id);
      for (const p of res.placements) {
        const item = THREE_WORKS.find((i) => i.id === p.id);
        assertPlacementOnWall(p, item, face, envelope, blocks, perimeter);
      }
      assertNoOverlaps(res.placements, THREE_WORKS);
    }
    return "3 works re-hung cleanly on all 21 layouts";
  });

  // A user-added partition wall blocks the walk in every room type:
  // the generic walk controls used only the room's own blocks, so a
  // visitor walked straight through a partition added by the owner
  // (Sunlight's walk controls already included its elements' blocks).
  check("—", "partition-collision", "Walk collision: a user-added partition wall blocks the visitor", () => {
    const partition = { id: "p1", type: "partition", name: "Partition 1", x: 0, y: 0, z: 0, rotation: 0, scale: 1, color: "#f5f2eb", length: 4, variant: "standard" };
    const blocks = elementsLib.roomElementCollisionBlocks([partition]);
    assert(blocks.length === 1, `expected 1 collision block for the partition, got ${blocks.length}`);
    assert(approx(blocks[0].hl, 2, 0.001) && approx(blocks[0].hw, 0.075, 0.001), `partition block half-extents ${blocks[0].hl}×${blocks[0].hw} (expected 2×0.075)`);
    // The wall runs along x at z = 0: its centre blocks, 2.5 m along
    // it does not, and a point 1 m in front of it does not.
    assert(sunlightHitWith(blocks, 0, 0), "partition centre does not block the walk");
    assert(!sunlightHitWith(blocks, 2.5, 0), "walk blocked 2.5 m past the partition's end");
    assert(!sunlightHitWith(blocks, 0, 1), "walk blocked 1 m in front of the partition");
    // A hidden partition blocks nothing (it is not rendered).
    assert(elementsLib.roomElementCollisionBlocks([{ ...partition, hidden: true }]).length === 0, "hidden partition still blocks the walk");
    return "partition 4 m × 0.15 m blocks the walk at its centre only";
  });

  // ---------- Per room ----------
  for (const layout of LAYOUTS) {
    const data = roomData(layout);
    const { bounds, walkSpeed, cameraStart, blocks, hangWalls } = data;
    const preset = roomLayouts[layout];

    check(layout, "def-integrity", "Definition integrity (bounds, camera, speed, light, blocks, walls)", () => {
      assert(bounds.minX < bounds.maxX && bounds.minZ < bounds.maxZ, `bounds degenerate: ${JSON.stringify(bounds)}`);
      assert(bounds.maxX - bounds.minX >= 5 && bounds.maxZ - bounds.minZ >= 5, `room suspiciously small: ${JSON.stringify(bounds)}`);
      assert(cameraStart.x >= bounds.minX && cameraStart.x <= bounds.maxX && cameraStart.z >= bounds.minZ && cameraStart.z <= bounds.maxZ, `camera start (${cameraStart.x}, ${cameraStart.z}) outside bounds`);
      assert(approx(cameraStart.y, 1.6, 0.001), `camera y ${cameraStart.y} != eye height 1.6`);
      assert(walkSpeed === 4 || walkSpeed === 4.2, `walkSpeed ${walkSpeed} (expected 4 or 4.2)`);
      assert(LIGHT_TYPES.has(preset.lightType), `unknown lightType ${preset.lightType}`);
      assert(typeof data.environment === "boolean", "environment flag missing");
      assert(/^#[0-9a-f]{6}$/i.test(preset.wallColor), `wallColor ${preset.wallColor} not a hex colour`);
      assert(hangWalls.length >= 1, "no hangable wall faces");
      const ids = new Set();
      for (const f of hangWalls) {
        assert(!ids.has(f.id), `duplicate wall face id ${f.id}`);
        ids.add(f.id);
        assert(approx(Math.hypot(f.nx, f.nz), 1, 0.001), `face ${f.id}: normal (${f.nx}, ${f.nz}) not unit`);
        assert(approx(Math.hypot(f.ax, f.az), 1, 0.001), `face ${f.id}: axis (${f.ax}, ${f.az}) not unit`);
        assert(f.halfLen > 0, `face ${f.id}: halfLen ${f.halfLen} <= 0`);
        assert(f.minY < f.maxY && f.minY >= 0 && f.maxY <= 13, `face ${f.id}: height range ${f.minY}…${f.maxY}`);
      }
      for (const b of blocks) {
        assert(Number.isFinite(b.x) && Number.isFinite(b.z) && Number.isFinite(b.hl) && Number.isFinite(b.hw) && b.hl > 0 && b.hw > 0, `bad block ${JSON.stringify(b)}`);
      }
      if (data.def?.curatorialText) {
        assert(data.def.curatorialText.y > 0 && data.def.curatorialText.y < 13, `curatorial text y ${data.def.curatorialText.y} out of range`);
      }
      return `${hangWalls.length} wall faces, ${blocks.length} blocks, ${((bounds.maxX - bounds.minX) * (bounds.maxZ - bounds.minZ)).toFixed(0)} m² walkable, speed ${walkSpeed} m/s, light ${preset.lightType}`;
    });

    check(layout, "exhibition-open", "Exhibition opens: room round-trips via parseGalleryRooms, no template artworks seeded", () => {
      const room = createGalleryRoom(0, layout);
      const parsed = parseGalleryRooms(JSON.stringify([room]));
      assert(parsed.length === 1 && parsed[0].layout === layout, `parseGalleryRooms lost the layout (got ${parsed[0]?.layout})`);
      assert(!("templateArtSeeded" in parsed[0]), "room still carries the templateArtSeeded flag");
      assert(!existsSync(join(ROOT, "lib", "template-artworks.ts")), "lib/template-artworks.ts still exists");
      assert(!readFileSync(join(ROOT, "lib", "rooms.ts"), "utf8").includes("seedSunlightArtworks"), "seedSunlightArtworks still exists in lib/rooms.ts");
      return "room opens empty — no seeded template artworks (removed Chantier 6)";
    });

    check(layout, "compose-3", "Compose wall, 3 real works on the back/longest wall (1.50 m, 12 cm, largest centre)", () => {
      const face = composeTarget(layout);
      const envelope = physicalEnvelope(layout);
      const res = composeWall(THREE_WORKS, face, blocks);
      // La Serpentine has no single face longer than 2.2 m (its walls
      // are 2.2 m arc segments), so a 3-large-work row cannot fit one
      // face: Compose must degrade gracefully — place what fits, report
      // the rest, never force a work off the wall. That is the design
      // (composeWall reports unplaced); the curator composes across
      // several arc segments or with smaller works.
      if (layout === "serpentine") {
        assert(res.placements.length >= 1, `nothing placed on ${face.id} — ${res.message}`);
        assert(res.unplaced.length > 0 && res.message.includes("longer wall"), `expected a graceful "try a longer wall" report, got: ${res.message}`);
        const perimeter = false;
        for (const p of res.placements) {
          const item = THREE_WORKS.find((i) => i.id === p.id);
          assertPlacementOnWall(p, item, face, envelope, blocks, perimeter);
        }
        assertNoOverlaps(res.placements, THREE_WORKS);
        return `LIMIT (by design): no serpentine face fits 3 large works (max face 2.2 m) — ${res.message}`;
      }
      assert(res.unplaced.length === 0, `unplaced: ${res.unplaced.map((u) => u.id).join(", ")} — ${res.message}`);
      assert(res.placements.length === 3, `expected 3 placements, got ${res.placements.length}`);
      assert(res.layout === "row", `expected a single eye-level row, got "${res.layout}"`);
      const perimeter = ["back", "front", "left", "right", "back-left", "back-right", "back-below", "back-above"].includes(face.id);
      for (const p of res.placements) {
        const item = THREE_WORKS.find((i) => i.id === p.id);
        assertPlacementOnWall(p, item, face, envelope, blocks, perimeter);
        assert(approx(p.y, COMPOSE_EYE_LEVEL_M, 0.01), `${item.id}: centre y ${p.y.toFixed(2)} != eye level ${COMPOSE_EYE_LEVEL_M}`);
      }
      const sorted = [...res.placements].sort((a, b) => a.along - b.along);
      for (let i = 0; i < sorted.length - 1; i += 1) {
        const a = sorted[i];
        const b = sorted[i + 1];
        const wa = THREE_WORKS.find((x) => x.id === a.id);
        const wb = THREE_WORKS.find((x) => x.id === b.id);
        const gap = (b.along - wb.width / 2) - (a.along + wa.width / 2);
        assert(approx(gap, COMPOSE_GAP_M, 0.002), `gap between ${a.id} and ${b.id} is ${gap.toFixed(3)} m (expected 0.12)`);
      }
      const middle = sorted[1];
      assert(middle.id === "nose-ring" || middle.id === "family-photo", `largest work not in the centre (centre is ${middle.id})`);
      assertNoOverlaps(res.placements, THREE_WORKS);
      return `${res.message} — wall ${face.id} (${(face.halfLen * 2).toFixed(1)} m)`;
    });

    check(layout, "compose-7", "Compose wall, 7 works (solo-expo wall) on the longest wall", () => {
      const face = longestWall(layout);
      const envelope = physicalEnvelope(layout);
      const res = composeWall(SEVEN_WORKS, face, blocks);
      assert(res.placements.length > 0, `nothing placed on ${face.id} — ${res.message}`);
      const perimeter = ["back", "front", "left", "right", "back-left", "back-right", "back-below", "back-above"].includes(face.id);
      for (const p of res.placements) {
        const item = SEVEN_WORKS.find((i) => i.id === p.id);
        assertPlacementOnWall(p, item, face, envelope, blocks, perimeter);
      }
      assertNoOverlaps(res.placements, SEVEN_WORKS);
      // Every OTHER long perimeter wall too: a dividing wall or
      // furniture joining one side wall (Arche's dividing wall joins
      // BOTH side walls) must not bury a work on any of them — the
      // longest wall alone would miss the mirror side.
      const others = roomData(layout).hangWalls.filter(
        (f) => f.id !== face.id && ["back", "front", "left", "right", "back-left", "back-right", "back-below", "back-above"].includes(f.id) && f.halfLen >= 4,
      );
      for (const other of others) {
        const otherRes = composeWall(SEVEN_WORKS, other, blocks);
        for (const p of otherRes.placements) {
          const item = SEVEN_WORKS.find((i) => i.id === p.id);
          assertPlacementOnWall(p, item, other, envelope, blocks, true);
        }
        assertNoOverlaps(otherRes.placements, SEVEN_WORKS);
      }
      return `${res.placements.length}/7 placed (${res.layout}) on ${face.id} (${(face.halfLen * 2).toFixed(1)} m)${res.unplaced.length ? ` — unplaced: ${res.unplaced.map((u) => u.id).join(", ")}` : ""}${others.length ? `; +${others.length} other long wall(s) clear` : ""}`;
    });

    check(layout, "drag-snap", "Drag-end snap: a work dropped mid-room, past a wall's end or high up always lands on a wall", () => {
      const face = longestWall(layout);
      const drops = [
        { x: (bounds.minX + bounds.maxX) / 2, y: 1.5, z: (bounds.minZ + bounds.maxZ) / 2, label: "room centre" },
        { x: face.cx + face.ax * (face.halfLen + 2), y: 1.5, z: face.cz + face.az * (face.halfLen + 2), label: "past the wall's end" },
        { x: face.cx, y: face.maxY + 1.5, z: face.cz, label: "above the wall" },
      ];
      if (layout === "arche") drops.push({ x: -9.9, y: 1.5, z: -4.22, label: "dividing-wall junction" });
      const room = rooms.createGalleryRoom(0, layout);
      const faces = roomData(layout).hangWalls;
      for (const drop of drops) {
        // The editor's real snap (lib/snap-to-wall.ts): a wall under
        // the drop point first, else the closest face, then a face
        // with the work's own facing — always a wall, never floating,
        // and shifted along the wall clear of any solid volume.
        const placed = snap.snapArtworkToWall(
          { position: [drop.x, drop.y, drop.z], rotation: 0, width: 1.3, height: 0.94 },
          room,
        );
        assert(placed, `drop at ${drop.label}: snap returned nothing — the work would stay floating`);
        const snapFace = faces.find((f) => approx(placed.rotation, Math.atan2(f.nx, f.nz), 0.001)
          && Math.abs((placed.position[0] - f.cx) * f.nx + (placed.position[2] - f.cz) * f.nz - 0.1) < 0.002
          && Math.abs((placed.position[0] - f.cx) * f.ax + (placed.position[2] - f.cz) * f.az) + 0.65 <= f.halfLen + 0.002);
        assert(snapFace, `drop at ${drop.label}: snapped position (${placed.position.map((v) => v.toFixed(2)).join(", ")}) is not 0.1 m off any wall`);
        const along = (placed.position[0] - snapFace.cx) * snapFace.ax + (placed.position[2] - snapFace.cz) * snapFace.az;
        assert(Math.abs(along) + 0.65 <= snapFace.halfLen + 0.002, `drop at ${drop.label}: snapped along ${along.toFixed(2)} outside ${snapFace.id}`);
        assert(placed.position[1] >= snapFace.minY && placed.position[1] <= snapFace.maxY, `drop at ${drop.label}: snapped y ${placed.position[1].toFixed(2)} outside ${snapFace.id} height ${snapFace.minY}…${snapFace.maxY}`);
        if (["back", "front", "left", "right", "back-left", "back-right", "back-below", "back-above"].includes(snapFace.id)) {
          const burying = blocks.find((b) => rawBlockHit([b], placed.position[0], placed.position[2]) && !blockStraddlesFace(b, snapFace));
          assert(!burying, `drop at ${drop.label}: snapped work buried in a block in front of the ${snapFace.id} wall`);
        }
      }
      return `${drops.length} awkward drops all snapped onto a wall`;
    });

    check(layout, "place-on-wall", "Single work: raycast from camera start + galleryPlaceOnWall", () => {
      const face = composeTarget(layout);
      const target = { x: face.cx, y: 1.5, z: face.cz };
      const dir = { x: target.x - cameraStart.x, y: target.y - cameraStart.y, z: target.z - cameraStart.z };
      const len = Math.hypot(dir.x, dir.y, dir.z);
      const hit = wallHit(layout, cameraStart, { x: dir.x / len, y: dir.y / len, z: dir.z / len });
      assert(hit, `raycast from camera start (${cameraStart.x}, ${cameraStart.z}) toward ${face.id} hit no wall`);
      const placed = layout === "sunlight"
        ? sunEl.sunlightPlaceOnWall(hit, 0.94, 1.3)
        : galleryPlaceOnWall(hit, 0.94, 1.3);
      const dist = (placed.position[0] - hit.face.cx) * hit.face.nx + (placed.position[2] - hit.face.cz) * hit.face.nz;
      assert(approx(dist, 0.1, 0.002), `placed ${dist.toFixed(3)} m off the ${hit.face.id} wall (expected 0.100)`);
      assert(placed.position[1] >= hit.face.minY + 0.47 && placed.position[1] <= hit.face.maxY - 0.47, `placed y ${placed.position[1].toFixed(2)} outside ${hit.face.id} height`);
      const envelope = physicalEnvelope(layout);
      assert(placed.position[0] >= envelope.minX && placed.position[0] <= envelope.maxX && placed.position[2] >= envelope.minZ && placed.position[2] <= envelope.maxZ, `placed position outside the room's physical envelope`);
      // And not buried in a solid volume standing in front of the hit
      // wall (a dividing wall, furniture): wall-straddling collision
      // bands are the wall itself and do not count.
      if (["back", "front", "left", "right", "back-left", "back-right", "back-below", "back-above"].includes(hit.face.id)) {
        const burying = blocks.find((b) => rawBlockHit([b], placed.position[0], placed.position[2]) && !blockStraddlesFace(b, hit.face));
        assert(!burying, `placed work hangs inside a collision block at (${placed.position[0].toFixed(2)}, ${placed.position[2].toFixed(2)}) — block ${JSON.stringify(burying)} stands in front of the ${hit.face.id} wall`);
      }
      return `hit ${hit.face.id}, placed at (${placed.position.map((v) => v.toFixed(2)).join(", ")})`;
    });

    check(layout, "place-in-view", "Add artwork: the new work lands in front of the visitor's eyes, never behind or off-frame", () => {
      const faces = roomData(layout).hangWalls;
      const onWall = (placed, label) => {
        // The face the work hangs on: same facing (rotation), 0.1 m
        // stand-off, and the work inside its length. Rotation alone
        // does not identify it — coplanar wall segments (back-left /
        // back-below) and panel rows share one rotation and one
        // stand-off, so the extent check picks the real face.
        const face = faces.find((f) => approx(placed.rotation, Math.atan2(f.nx, f.nz), 0.001)
          && Math.abs((placed.position[0] - f.cx) * f.nx + (placed.position[2] - f.cz) * f.nz - 0.1) < 0.002
          && Math.abs((placed.position[0] - f.cx) * f.ax + (placed.position[2] - f.cz) * f.az) + 0.4 <= f.halfLen + 0.002);
        assert(face, `${label}: placed at (${placed.position.map((v) => v.toFixed(2)).join(", ")}) is not 0.1 m off any wall, inside its length`);
        const along = (placed.position[0] - face.cx) * face.ax + (placed.position[2] - face.cz) * face.az;
        assert(Math.abs(along) + 0.4 <= face.halfLen + 0.002, `${label}: along ${along.toFixed(2)} hangs off the ${face.id} wall`);
        assert(placed.position[1] >= face.minY + 0.5 && placed.position[1] <= face.maxY - 0.5, `${label}: y ${placed.position[1].toFixed(2)} outside ${face.id} height`);
        return face;
      };
      // (a) From the camera start, every spread offset (−2…+2 m, the
      // editor's consecutive-add spread): in view, no turn needed —
      // unless no wall is in view at all (an open pavilion: the
      // entrance looks down an open axis), in which case one gentle
      // turn must centre the work. This is the old bug — at a near
      // wall ±2 m is 45–63° off axis.
      for (const off of [-2, -1, 0, 1, 2]) {
        const placed = placeInView.placeArtworkInView(cameraStart, faces, 0.8, 1.0, off);
        if (placed.fallback) {
          // No wall in view at all (an open pavilion): the fallback
          // face may already sit in the cone (no turn needed), or
          // one gentle turn must centre it.
          if (placed.needsTurn) {
            assert(placed.yawToFace !== null, `camera start, offset ${off}: no wall in view, but no turn was requested although the work is off-frame`);
            const afterTurn = placeInView.placeArtworkInView({ ...cameraStart, yaw: placed.yawToFace }, faces, 0.8, 1.0, off);
            assert(afterTurn.inView, `camera start, offset ${off}: after turning toward the work it is still ${afterTurn.horizAngleDeg.toFixed(1)}° off axis`);
            onWall(afterTurn, `camera start, offset ${off}, after turn`);
          } else {
            assert(placed.inView, `camera start, offset ${off}: fallback work at ${placed.horizAngleDeg.toFixed(1)}° off axis is out of view`);
            onWall(placed, `camera start, offset ${off}`);
          }
          continue;
        }
        assert(placed.inView, `camera start, offset ${off}: work at ${placed.horizAngleDeg.toFixed(1)}° off axis (face ${placed.faceId}, ${placed.distance.toFixed(1)} m) is out of view`);
        assert(!placed.needsTurn, `camera start, offset ${off}: a turn was requested although the work is on the faced wall`);
        onWall(placed, `camera start, offset ${off}`);
      }
      // (b) Close to a wall (1.5 m): the spread is clamped into the
      // view cone instead of pushing the work off-screen.
      const nearFace = composeTarget(layout);
      const nearCamera = {
        x: nearFace.cx + nearFace.nx * 1.5,
        y: 1.6,
        z: nearFace.cz + nearFace.nz * 1.5,
        yaw: Math.atan2(nearFace.nx, nearFace.nz),
        pitch: 0,
      };
      for (const off of [-2, 2]) {
        const placed = placeInView.placeArtworkInView(nearCamera, faces, 0.8, 1.0, off);
        assert(placed.inView, `1.5 m from the ${nearFace.id} wall, offset ${off}: work at ${placed.horizAngleDeg.toFixed(1)}° off axis is out of view`);
        assert(!placed.needsTurn, `1.5 m from the ${nearFace.id} wall, offset ${off}: a turn was requested although the clamp should hold`);
        onWall(placed, `near wall, offset ${off}`);
      }
      // (c) No wall in view — the camera stands 1.5 m in front of a
      // wall, facing away from it, so the wall is behind the camera:
      // no blind back-wall drop — the turn target aims exactly at
      // the work, and after the turn the work is centred in view.
      const backFace = faces.find((f) => f.id === "back") ?? nearFace;
      const awayCamera = {
        x: backFace.cx + backFace.nx * 1.5,
        y: 1.6,
        z: backFace.cz + backFace.nz * 1.5,
        yaw: Math.atan2(-backFace.nx, -backFace.nz),
        pitch: 0,
      };
      const turned = placeInView.placeArtworkInView(awayCamera, [backFace], 0.8, 1.0, 0);
      assert(turned.fallback, "facing away from the only wall: the fallback did not trigger");
      assert(turned.needsTurn && turned.yawToFace !== null, "facing away from the only wall: no turn was requested although the work is behind the camera");
      const fx = -Math.sin(turned.yawToFace);
      const fz = -Math.cos(turned.yawToFace);
      const dx = turned.position[0] - awayCamera.x;
      const dz = turned.position[2] - awayCamera.z;
      const aim = (fx * dx + fz * dz) / Math.hypot(dx, dz);
      assert(aim > 0.999, `turn target aims ${aim.toFixed(4)} at the work (expected ~1.0)`);
      const afterTurn = placeInView.placeArtworkInView({ ...awayCamera, yaw: turned.yawToFace }, [backFace], 0.8, 1.0, 0);
      assert(afterTurn.inView, `after turning toward the work it is still ${afterTurn.horizAngleDeg.toFixed(1)}° off axis`);
      onWall(afterTurn, "after turn");
      return `camera start ×5 offsets in view, near-wall ±2 m clamped in view, behind-camera turn aims ${aim.toFixed(4)}`;
    });

    check(layout, "navigation", "Navigation: camera start walkable, a step exists, plan lines in room, teleport offsets", () => {
      const startBlock = layout === "sunlight"
        ? sunlightHitWith(SUNLIGHT_BLOCKS, cameraStart.x, cameraStart.z)
        : blockHit(blocks, cameraStart.x, cameraStart.z);
      assert(!startBlock, `camera start (${cameraStart.x}, ${cameraStart.z}) sits inside a collision block`);
      const step = 0.5;
      let walkable = false;
      for (let k = 0; k < 8; k += 1) {
        const a = (k * Math.PI) / 4;
        const nx = cameraStart.x + Math.cos(a) * step;
        const nz = cameraStart.z + Math.sin(a) * step;
        const inBounds = nx >= bounds.minX && nx <= bounds.maxX && nz >= bounds.minZ && nz <= bounds.maxZ;
        const hit = layout === "sunlight" ? sunlightHitWith(SUNLIGHT_BLOCKS, nx, nz) : blockHit(blocks, nx, nz);
        if (inBounds && !hit) { walkable = true; break; }
      }
      assert(walkable, "no walkable 0.5 m step from the camera start in any of 8 directions");
      const start = galleryCameraStart(layout);
      assert(approx(start.x, cameraStart.x, 0.001) && approx(start.z, cameraStart.z, 0.001), "galleryCameraStart disagrees with the definition");
      const offsets = roomPlanOffsets([{ layout: "sunlight" }, { layout }]);
      assert(offsets.x.length === 2 && offsets.z.length === 2, "roomPlanOffsets did not return 2 rooms");
      if (layout !== "sunlight") {
        assert(offsets.x[0] !== offsets.x[1] || offsets.z[0] !== offsets.z[1], "teleport: Sunlight and this room share the same plan offset");
      }
      if (data.def?.planLines) {
        // Plan lines draw the shell itself (Courbes' glass arc reaches
        // r = 12.5, beyond every hangable face), so the tolerance here
        // is the walk bounds + 5 m — it catches gross errors (a line
        // at x = 100), not shell geometry.
        for (const line of data.def.planLines) {
          for (const [x, z] of [[line.x1, line.z1], [line.x2, line.z2]]) {
            assert(x >= bounds.minX - 5 && x <= bounds.maxX + 5 && z >= bounds.minZ - 5 && z <= bounds.maxZ + 5, `plan line endpoint (${x}, ${z}) far outside the room`);
          }
        }
      }
      return `camera start (${cameraStart.x}, ${cameraStart.z}) walkable, plan offset (${offsets.x[1]}, ${offsets.z[1]})`;
    });
  }
} finally {
  rmSync(STAGING, { recursive: true, force: true });
}

// ---------- Report ----------
const passed = checks.filter((c) => c.status === "pass").length;
const failed = checks.filter((c) => c.status === "fail").length;
const byRoom = {};
for (const c of checks) {
  byRoom[c.room] ??= { passed: 0, failed: 0, checks: [] };
  byRoom[c.room][c.status === "pass" ? "passed" : "failed"] += 1;
  byRoom[c.room].checks.push({ id: c.id, name: c.name, status: c.status, detail: c.detail });
}
let commit = "unknown";
try {
  const { execFileSync } = await import("node:child_process");
  commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
} catch { /* not a git checkout */ }
const report = {
  generatedAt: new Date().toISOString(),
  commit,
  mission: "chantier-5-exhibition-tests-all-galleries",
  summary: { total: checks.length, passed, failed },
  rooms: byRoom,
  checks,
};
const reportArg = process.argv.find((a) => a.startsWith("--report="));
if (reportArg) {
  const out = join(ROOT, reportArg.slice("--report=".length));
  writeFileSync(out, JSON.stringify(report, null, 2));
  // Timestamped copy next to it (repo convention: latest.json is
  // regenerated every run, the stamped file is the record).
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const stamped = out.replace(/\.json$/, `-${stamp}.json`);
  if (stamped !== out) writeFileSync(stamped, JSON.stringify(report, null, 2));
  console.log(`\nReport → ${out}`);
}
console.log(`\n${passed}/${checks.length} passed, ${failed} failed`);
for (const [room, r] of Object.entries(byRoom)) {
  if (room === "—") continue;
  console.log(`  ${r.failed === 0 ? "PASS" : "FAIL"} ${room}: ${r.passed} pass, ${r.failed} fail`);
}
process.exit(failed > 0 ? 1 : 0);
