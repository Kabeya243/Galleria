import { z } from "zod";
import { ELEMENT_DEFAULTS, roomElementSchema, type ElementType, type RoomElement } from "@/lib/elements";

// The gallery collection, rebuilt from Kabeya's ten reference rooms.
// Each preset carries its own dimensions and default finishes, so picking
// a gallery in the editor already looks like the reference space.
export const roomLayouts = {
  cube: {
    label: "White Cube",
    width: 18,
    depth: 12,
    height: 5.3,
    wallColor: "#f5f2eb",
    sideWallColor: "#e8e4da",
    floorColor: "#4a4743",
    wallTexture: "plaster",
    floorTexture: "stone",
    ceilingColor: "#f5f2eb",
    ceilingTexture: "plaster",
    spotlights: true,
    partitions: [{ x: 0, z: 0, length: 6, orientation: "horizontal" }],
  },
  "grand-hall": {
    label: "Grand Light Hall",
    width: 26,
    depth: 16,
    height: 6,
    wallColor: "#faf8f2",
    sideWallColor: "#f0ece1",
    floorColor: "#e9e6dd",
    wallTexture: "plaster",
    floorTexture: "stone",
    ceilingColor: "#faf8f2",
    ceilingTexture: "plaster",
    spotlights: true,
    partitions: [],
  },
  "black-panels": {
    label: "Black Panels",
    width: 20,
    depth: 14,
    height: 5,
    wallColor: "#141412",
    sideWallColor: "#1a1a18",
    floorColor: "#6a675f",
    wallTexture: "plaster",
    floorTexture: "concrete",
    ceilingColor: "#141412",
    ceilingTexture: "plaster",
    spotlights: true,
    partitions: [],
  },
  "raw-concrete": {
    label: "Raw Concrete",
    width: 22,
    depth: 12,
    height: 5.2,
    wallColor: "#a9a193",
    sideWallColor: "#9d9688",
    floorColor: "#cfc9bd",
    wallTexture: "concrete",
    floorTexture: "stone",
    ceilingColor: "#a9a193",
    ceilingTexture: "concrete",
    spotlights: true,
    partitions: [],
  },
  "parquet-portraits": {
    label: "Portraits & Parquet",
    width: 16,
    depth: 12,
    height: 4.8,
    wallColor: "#efe8d8",
    sideWallColor: "#e6ddc9",
    floorColor: "#c9a877",
    wallTexture: "plaster",
    floorTexture: "wood",
    ceilingColor: "#efe8d8",
    ceilingTexture: "plaster",
    spotlights: true,
    partitions: [],
  },
  "curved-wall": {
    label: "Curved Wall",
    width: 30,
    depth: 12,
    height: 5.5,
    wallColor: "#f6f4ef",
    sideWallColor: "#ece9e0",
    floorColor: "#8a8a86",
    wallTexture: "plaster",
    floorTexture: "concrete",
    ceilingColor: "#f6f4ef",
    ceilingTexture: "plaster",
    spotlights: true,
    partitions: [],
  },
  "marble-sculpture": {
    label: "Marble & Sculpture",
    width: 20,
    depth: 14,
    height: 5,
    wallColor: "#f4f1ea",
    sideWallColor: "#e7e3d8",
    floorColor: "#d8d5cf",
    wallTexture: "plaster",
    floorTexture: "marble",
    ceilingColor: "#f4f1ea",
    ceilingTexture: "plaster",
    spotlights: true,
    partitions: [],
  },
  "quiet-minimal": {
    label: "Quiet Minimal",
    width: 14,
    depth: 10,
    height: 4.5,
    wallColor: "#f2efe6",
    sideWallColor: "#e6e1d3",
    floorColor: "#ddd6c8",
    wallTexture: "plaster",
    floorTexture: "stone",
    ceilingColor: "#f2efe6",
    ceilingTexture: "plaster",
    spotlights: true,
    partitions: [],
  },
  "pop-brick": {
    label: "Pop & Brick",
    width: 18,
    depth: 12,
    height: 5,
    wallColor: "#b0724f",
    sideWallColor: "#9a5f43",
    floorColor: "#d9c39a",
    wallTexture: "brick",
    floorTexture: "wood",
    ceilingColor: "#efe9dc",
    ceilingTexture: "plaster",
    spotlights: true,
    partitions: [],
  },
  "totem-studio": {
    label: "Totem Studio",
    width: 22,
    depth: 16,
    height: 5.5,
    wallColor: "#b0aa9e",
    sideWallColor: "#a29c90",
    floorColor: "#4a4743",
    wallTexture: "concrete",
    floorTexture: "stone",
    ceilingColor: "#b0aa9e",
    ceilingTexture: "concrete",
    spotlights: true,
    partitions: [],
  },
  // Ceiling architectures from Kabeya's reference photos of real galleries
  // (November 2026): the ceiling itself is the architecture here.
  "coffered-concrete": {
    label: "Coffered Concrete",
    width: 22,
    depth: 14,
    height: 5.5,
    wallColor: "#e8e4da",
    sideWallColor: "#ddd8cc",
    floorColor: "#a89a7a",
    wallTexture: "plaster",
    floorTexture: "wood",
    ceilingColor: "#b0aa9e",
    ceilingTexture: "concrete",
    spotlights: true,
    partitions: [],
  },
  "skylight-grid": {
    label: "Skylight Grid",
    width: 26,
    depth: 16,
    height: 7,
    wallColor: "#f5f2eb",
    sideWallColor: "#ece9e0",
    floorColor: "#d9c39a",
    wallTexture: "plaster",
    floorTexture: "wood",
    ceilingColor: "#e8e4da",
    ceilingTexture: "plaster",
    spotlights: true,
    partitions: [],
  },
  "timber-ceiling": {
    label: "Timber Ceiling",
    width: 20,
    depth: 12,
    height: 5.5,
    wallColor: "#f5f2eb",
    sideWallColor: "#ece9e0",
    floorColor: "#6b5b45",
    wallTexture: "plaster",
    floorTexture: "wood",
    ceilingColor: "#8a6a45",
    ceilingTexture: "wood",
    spotlights: true,
    partitions: [],
  },
  "high-concrete": {
    label: "High Concrete",
    width: 20,
    depth: 12,
    height: 7,
    wallColor: "#b0aa9e",
    sideWallColor: "#a29c90",
    floorColor: "#cfc9bd",
    wallTexture: "concrete",
    floorTexture: "stone",
    ceilingColor: "#b0aa9e",
    ceilingTexture: "concrete",
    spotlights: true,
    partitions: [],
  },
  "beam-white": {
    label: "White Beam Hall",
    width: 24,
    depth: 14,
    height: 6,
    wallColor: "#faf8f2",
    sideWallColor: "#f0ece1",
    floorColor: "#cfc9bd",
    wallTexture: "plaster",
    floorTexture: "stone",
    ceilingColor: "#faf8f2",
    ceilingTexture: "plaster",
    spotlights: true,
    partitions: [],
  },
  // Photo 5 (photo_4-3.jpg): a large museum hall of tall freestanding
  // walls on metal feet, track spotlights, polished floor.
  "partition-hall": {
    label: "Partition Hall",
    width: 26,
    depth: 16,
    height: 6,
    wallColor: "#ece9e0",
    sideWallColor: "#e2ded6",
    floorColor: "#cfc9bd",
    wallTexture: "plaster",
    floorTexture: "stone",
    ceilingColor: "#f5f2eb",
    ceilingTexture: "plaster",
    spotlights: true,
    partitions: [],
  },
  // Photo 7 (photo_6-2.jpg): a gallery storefront — bright, display
  // shelves, white plinths, a desk and chair.
  "storefront": {
    label: "Storefront Gallery",
    width: 18,
    depth: 12,
    height: 5,
    wallColor: "#faf8f2",
    sideWallColor: "#f0ece1",
    floorColor: "#d8d5cf",
    wallTexture: "plaster",
    floorTexture: "marble",
    ceilingColor: "#faf8f2",
    ceilingTexture: "plaster",
    spotlights: true,
    partitions: [],
  },
} as const;

export type RoomLayout = keyof typeof roomLayouts;

const layoutKeys = Object.keys(roomLayouts) as [RoomLayout, ...RoomLayout[]];

export const wallTextures = {
  plaster: "Plaster",
  concrete: "Concrete",
  brick: "Brick",
  marble: "Marble",
} as const;

export const floorTextures = {
  stone: "Stone",
  concrete: "Concrete",
  wood: "Wood",
  marble: "Marble",
} as const;

// Ceiling finishes reuse the wall finishes, plus wood for the timber
// ceiling rooms (the wood grain texture already exists for floors).
export const ceilingTextures = {
  ...wallTextures,
  wood: "Wood",
} as const;

// Floor finishes: one choice sets the floor colour AND texture together,
// so picking "Light wood" visibly re-floors the room.
export const floorTypes = {
  "light-wood": { label: "Light wood · parquet", texture: "wood", color: "#c9a877" },
  "dark-wood": { label: "Dark wood", texture: "wood", color: "#5a4632" },
  "polished-concrete": { label: "Polished concrete", texture: "concrete", color: "#cfc9bd" },
  white: { label: "White", texture: "stone", color: "#f2efe8" },
  marble: { label: "Marble", texture: "marble", color: "#d8d5cf" },
  charcoal: { label: "Charcoal", texture: "stone", color: "#4a4743" },
} as const;

export type FloorType = keyof typeof floorTypes;

const floorTypeKeys = Object.keys(floorTypes) as [FloorType, ...FloorType[]];

// Light moods per room: warm or cool spots, or a soft even ambient light
// with no spotlights.
export const lightTypes = {
  "spot-warm": { label: "Spot · Warm" },
  "spot-cool": { label: "Spot · Cool" },
  ambient: { label: "Soft ambient" },
} as const;

export type LightType = keyof typeof lightTypes;

const lightTypeKeys = Object.keys(lightTypes) as [LightType, ...LightType[]];

// Relative luminance of a hex colour (0-1): used to guess the closest
// floor finish for rooms saved before floor types existed.
function hexLuminance(hex: string): number {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex);
  if (!match) return 0.5;
  const [r, g, b] = match.slice(1).map((part) => parseInt(part, 16) / 255);
  return 0.299 * r + 0.587 * g + 0.114 * b;
}

// Best-matching floor finish for a saved floor texture + colour, so rooms
// created before floor types keep showing the same floor in the picker.
export function inferFloorType(floorTexture: string, floorColor: string): FloorType {
  const luminance = hexLuminance(floorColor);
  if (floorTexture === "wood") return luminance > 0.45 ? "light-wood" : "dark-wood";
  if (floorTexture === "marble") return "marble";
  if (floorTexture === "concrete") return "polished-concrete";
  if (luminance > 0.85) return "white";
  if (luminance > 0.6) return "polished-concrete";
  return "charcoal";
}

export const partitionWallSchema = z.object({
  id: z.string().min(1).max(64),
  x: z.number().min(-20).max(20),
  z: z.number().min(-20).max(20),
  length: z.number().min(1).max(16),
  orientation: z.enum(["horizontal", "vertical"]),
  // Painted colour for this one wall; falls back to the room's side walls.
  color: z.string().regex(/^#[\da-f]{6}$/i).optional(),
});

export type PartitionWall = z.infer<typeof partitionWallSchema>;

// Per-wall paint overrides: painting one wall never touches the others.
// Absent means "use the room's back / side wall colour".
export const wallPaintSchema = z.object({
  back: z.string().regex(/^#[\da-f]{6}$/i).optional(),
  left: z.string().regex(/^#[\da-f]{6}$/i).optional(),
  right: z.string().regex(/^#[\da-f]{6}$/i).optional(),
  front: z.string().regex(/^#[\da-f]{6}$/i).optional(),
});

export type WallPaint = z.infer<typeof wallPaintSchema>;
export type WallId = "back" | "left" | "right" | "front";

export const galleryRoomSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(60),
  layout: z.enum(layoutKeys),
  wallColor: z.string().regex(/^#[\da-f]{6}$/i),
  sideWallColor: z.string().regex(/^#[\da-f]{6}$/i),
  floorColor: z.string().regex(/^#[\da-f]{6}$/i),
  ceilingColor: z.string().regex(/^#[\da-f]{6}$/i).default("#f5f2eb"),
  wallTexture: z.enum(["plaster", "concrete", "brick", "marble"]).default("plaster"),
  floorTexture: z.enum(["stone", "concrete", "wood", "marble"]).default("stone"),
  ceilingTexture: z.enum(["plaster", "concrete", "brick", "marble", "wood"]).default("plaster"),
  spotlights: z.boolean().default(true),
  partitionWalls: z.array(partitionWallSchema).max(8).default([]),
  curatorialText: z.string().max(300).default(""),
  // One choice re-floors the room (colour + texture together).
  floorType: z.enum(floorTypeKeys).default("charcoal"),
  // Light mood for the room (warm spots, cool spots, soft ambient).
  lightType: z.enum(lightTypeKeys).default("spot-warm"),
  // Per-wall paint overrides (absent = the room's wall colours).
  wallPaint: wallPaintSchema.default({}),
  // Placeable 3D elements (furniture, partition walls, vitrines, ...).
  elements: z.array(roomElementSchema).max(24).default([]),
});

export type GalleryRoom = z.infer<typeof galleryRoomSchema>;

// Apply a whole preset when the gallery layout changes in the editor: the
// preset carries dimensions AND finishes, so switching galleries visibly
// changes the room instead of only resizing the same grey box.
export function applyLayoutPreset(room: GalleryRoom, layout: RoomLayout): GalleryRoom {
  const preset = roomLayouts[layout];
  return {
    ...room,
    layout,
    wallColor: preset.wallColor,
    sideWallColor: preset.sideWallColor,
    floorColor: preset.floorColor,
    ceilingColor: preset.ceilingColor,
    wallTexture: preset.wallTexture,
    floorTexture: preset.floorTexture,
    ceilingTexture: preset.ceilingTexture,
    spotlights: preset.spotlights,
    floorType: inferFloorType(preset.floorTexture, preset.floorColor),
    partitionWalls: preset.partitions.map((wall) => ({ ...wall, id: crypto.randomUUID() })),
  };
}

// Each photo room starts with its own furniture, as movable elements the
// user can move, rotate or delete — so every room is unique like its
// reference photo, while the Elements palette stays the same everywhere.
// Older rooms and layout switches are untouched (only new rooms are seeded).
function seedElements(layout: RoomLayout): RoomElement[] {
  const { width, depth } = roomLayouts[layout];
  const counts = new Map<string, number>();
  const make = (
    type: ElementType,
    x: number, y: number, z: number,
    rotation = 0,
    extra: Partial<RoomElement> = {},
  ): RoomElement => {
    const n = (counts.get(type) ?? 0) + 1;
    counts.set(type, n);
    const defaults = ELEMENT_DEFAULTS[type];
    return {
      id: crypto.randomUUID(),
      type,
      name: `${defaults.label} ${n}`,
      x, y, z,
      rotation,
      scale: 1,
      color: defaults.color,
      length: defaults.length,
      variant: "standard",
      title: "",
      body: "",
      fontSize: 0.35,
      textColor: "#b3261e",
      font: "display",
      align: "left",
      layout: "stacked",
      bodySize: 0.11,
      bodyColor: "#3a3a36",
      ...extra,
    };
  };
  switch (layout) {
    case "high-concrete": // Photo 1: long bench, glass vitrine.
      return [
        make("bench", 0, 0, 1),
        make("vitrine", 6.5, 0, -3.5),
      ];
    case "timber-ceiling": // Photo 2: movable walls, sheer curtains.
      return [
        make("partition", -3, 0, 0, Math.PI / 2, { length: 5 }),
        make("partition", 3, 0, 0, Math.PI / 2, { length: 5 }),
        make("curtain", -width / 2 + 0.3, 0, 0, Math.PI / 2),
        make("curtain", width / 2 - 0.3, 0, 0, -Math.PI / 2),
      ];
    case "beam-white": // Photo 3: white plinths in three heights.
      return [
        make("plinth", -4, 0, 0, 0, { variant: "low" }),
        make("plinth", 0, 0, -1),
        make("plinth", 4, 0, 0, 0, { variant: "tall" }),
      ];
    case "coffered-concrete": // Photo 4: freestanding walls, one plinth.
      return [
        make("partition", -4, 0, 0, Math.PI / 2, { length: 5 }),
        make("partition", 4, 0, 0, Math.PI / 2, { length: 5 }),
        make("plinth", 0, 0, 2),
      ];
    case "partition-hall": // Photo 5: three tall freestanding walls.
      return [
        make("partition", -6, 0, 0, Math.PI / 2, { length: 6 }),
        make("partition", 0, 0, -1, Math.PI / 2, { length: 6 }),
        make("partition", 6, 0, 0, Math.PI / 2, { length: 6 }),
      ];
    case "skylight-grid": // Photo 6: two tall freestanding walls.
      return [
        make("partition", -5, 0, 0, Math.PI / 2, { length: 6 }),
        make("partition", 5, 0, 0, Math.PI / 2, { length: 6 }),
      ];
    case "storefront": // Photo 7: display shelves, plinths, desk & chair.
      return [
        make("shelf", 0, 1.7, -depth / 2 + 0.2, 0, { length: 4 }),
        make("plinth", -3, 0, 1),
        make("plinth", 3, 0, 1, 0, { variant: "tall" }),
        make("desk", 5.5, 0, 2.5, -Math.PI / 2),
      ];
    default:
      return [];
  }
}

export function createGalleryRoom(index = 0, layout: RoomLayout = "cube"): GalleryRoom {
  const room = applyLayoutPreset(
    {
      id: crypto.randomUUID(),
      name: `Room ${index + 1}`,
      layout,
      wallColor: roomLayouts[layout].wallColor,
      sideWallColor: roomLayouts[layout].sideWallColor,
      floorColor: roomLayouts[layout].floorColor,
      ceilingColor: roomLayouts[layout].ceilingColor,
      wallTexture: roomLayouts[layout].wallTexture,
      floorTexture: roomLayouts[layout].floorTexture,
      ceilingTexture: roomLayouts[layout].ceilingTexture,
      spotlights: roomLayouts[layout].spotlights,
      partitionWalls: [],
      curatorialText: "",
      floorType: inferFloorType(roomLayouts[layout].floorTexture, roomLayouts[layout].floorColor),
      lightType: "spot-warm",
      wallPaint: {},
      elements: [],
    },
    layout,
  );
  return { ...room, elements: seedElements(layout) };
}

// Galleries retired in November 2026, kept as a migration so exhibitions
// saved with the old shapes still open instead of failing validation.
const legacyLayouts: Record<string, RoomLayout> = {
  "white-cube": "cube",
  "long-gallery": "grand-hall",
  "intimate-room": "quiet-minimal",
};

export function parseGalleryRooms(value: string): GalleryRoom[] {
  const raw: unknown = JSON.parse(value);
  const migrated = Array.isArray(raw)
    ? raw.map((room) => {
        if (!room || typeof room !== "object") return room;
        const next = { ...(room as Record<string, unknown>) };
        if (typeof next.layout === "string" && next.layout in legacyLayouts) {
          next.layout = legacyLayouts[next.layout as string];
        }
        // Rooms saved before floor types / light types / elements existed:
        // fill them in from what the room already looks like.
        if (typeof next.floorType !== "string") {
          next.floorType = inferFloorType(
            typeof next.floorTexture === "string" ? next.floorTexture : "stone",
            typeof next.floorColor === "string" ? next.floorColor : "#f5f2eb",
          );
        }
        if (typeof next.lightType !== "string") next.lightType = "spot-warm";
        if (!next.wallPaint || typeof next.wallPaint !== "object") next.wallPaint = {};
        if (!Array.isArray(next.elements)) next.elements = [];
        return next;
      })
    : raw;
  const parsed = z.array(galleryRoomSchema).max(12).parse(migrated);
  return parsed.length ? parsed : [createGalleryRoom()];
}
