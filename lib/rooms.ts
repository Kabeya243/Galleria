import { z } from "zod";

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
    sideWallColor: "#e2ded6",
    floorColor: "#3f3d3a",
    wallTexture: "plaster",
    floorTexture: "stone",
    ceilingColor: "#f5f2eb",
    ceilingTexture: "plaster",
    spotlights: true,
    partitions: [],
  },
  "grand-hall": {
    label: "Grand Light Hall",
    width: 26,
    depth: 16,
    height: 6,
    wallColor: "#f7f4ec",
    sideWallColor: "#ece8dd",
    floorColor: "#e8e4da",
    wallTexture: "plaster",
    floorTexture: "stone",
    ceilingColor: "#f7f4ec",
    ceilingTexture: "plaster",
    spotlights: true,
    partitions: [],
  },
  "black-panels": {
    label: "Black Panels",
    width: 20,
    depth: 14,
    height: 5,
    wallColor: "#151513",
    sideWallColor: "#1c1c1a",
    floorColor: "#5c564e",
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
    wallColor: "#b5aea2",
    sideWallColor: "#a9a294",
    floorColor: "#4a4743",
    wallTexture: "concrete",
    floorTexture: "concrete",
    ceilingColor: "#b5aea2",
    ceilingTexture: "concrete",
    spotlights: true,
    partitions: [],
  },
  "parquet-portraits": {
    label: "Portraits & Parquet",
    width: 16,
    depth: 12,
    height: 4.8,
    wallColor: "#f2ede2",
    sideWallColor: "#e6e0d2",
    floorColor: "#c9a877",
    wallTexture: "plaster",
    floorTexture: "wood",
    ceilingColor: "#f2ede2",
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
    floorTexture: "stone",
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
    wallColor: "#f0ece1",
    sideWallColor: "#e3ded0",
    floorColor: "#d9d2c4",
    wallTexture: "plaster",
    floorTexture: "stone",
    ceilingColor: "#f0ece1",
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
    floorColor: "#c8a06a",
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
    wallColor: "#bdb7ab",
    sideWallColor: "#b0aa9e",
    floorColor: "#cfc9bd",
    wallTexture: "concrete",
    floorTexture: "stone",
    ceilingColor: "#bdb7ab",
    ceilingTexture: "concrete",
    spotlights: true,
    partitions: [
      { x: -5, z: 0, length: 5, orientation: "vertical" },
      { x: 0, z: 0, length: 5, orientation: "vertical" },
      { x: 5, z: 0, length: 5, orientation: "vertical" },
    ],
  },
} as const;

export type RoomLayout = keyof typeof roomLayouts;

const layoutKeys = Object.keys(roomLayouts) as [RoomLayout, ...RoomLayout[]];

export const wallTextures = {
  plaster: "Plaster",
  concrete: "Concrete",
  brick: "Brick",
} as const;

export const floorTextures = {
  stone: "Stone",
  concrete: "Concrete",
  wood: "Wood",
} as const;

// Ceiling finishes reuse the wall finishes.
export const ceilingTextures = wallTextures;

export const partitionWallSchema = z.object({
  id: z.string().min(1).max(64),
  x: z.number().min(-20).max(20),
  z: z.number().min(-20).max(20),
  length: z.number().min(1).max(16),
  orientation: z.enum(["horizontal", "vertical"]),
});

export type PartitionWall = z.infer<typeof partitionWallSchema>;

export const galleryRoomSchema = z.object({
  id: z.string().min(1).max(64),
  name: z.string().trim().min(1).max(60),
  layout: z.enum(layoutKeys),
  wallColor: z.string().regex(/^#[\da-f]{6}$/i),
  sideWallColor: z.string().regex(/^#[\da-f]{6}$/i),
  floorColor: z.string().regex(/^#[\da-f]{6}$/i),
  ceilingColor: z.string().regex(/^#[\da-f]{6}$/i).default("#f5f2eb"),
  wallTexture: z.enum(["plaster", "concrete", "brick"]).default("plaster"),
  floorTexture: z.enum(["stone", "concrete", "wood"]).default("stone"),
  ceilingTexture: z.enum(["plaster", "concrete", "brick"]).default("plaster"),
  spotlights: z.boolean().default(true),
  partitionWalls: z.array(partitionWallSchema).max(8).default([]),
  curatorialText: z.string().max(300).default(""),
});

export type GalleryRoom = z.infer<typeof galleryRoomSchema>;

export function createGalleryRoom(index = 0, layout: RoomLayout = "cube"): GalleryRoom {
  const preset = roomLayouts[layout];
  return {
    id: crypto.randomUUID(),
    name: `Room ${index + 1}`,
    layout,
    wallColor: preset.wallColor,
    sideWallColor: preset.sideWallColor,
    floorColor: preset.floorColor,
    ceilingColor: preset.ceilingColor,
    wallTexture: preset.wallTexture,
    floorTexture: preset.floorTexture,
    ceilingTexture: preset.ceilingTexture,
    spotlights: preset.spotlights,
    partitionWalls: preset.partitions.map((wall) => ({ ...wall, id: crypto.randomUUID() })),
    curatorialText: "",
  };
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
    ? raw.map((room) =>
        room && typeof room === "object" && typeof (room as { layout?: unknown }).layout === "string" &&
        (room as { layout: string }).layout in legacyLayouts
          ? { ...room, layout: legacyLayouts[(room as { layout: string }).layout] }
          : room,
      )
    : raw;
  const parsed = z.array(galleryRoomSchema).max(12).parse(migrated);
  return parsed.length ? parsed : [createGalleryRoom()];
}
