import { z } from "zod";

export const roomLayouts = {
  "white-cube": { label: "White cube", width: 18, depth: 12, height: 5.3 },
  "long-gallery": { label: "Long gallery", width: 22, depth: 16, height: 5.5 },
  "intimate-room": { label: "Intimate room", width: 14, depth: 10, height: 4.5 },
} as const;

export type RoomLayout = keyof typeof roomLayouts;

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
  layout: z.enum(["white-cube", "long-gallery", "intimate-room"]),
  wallColor: z.string().regex(/^#[\da-f]{6}$/i),
  sideWallColor: z.string().regex(/^#[\da-f]{6}$/i),
  floorColor: z.string().regex(/^#[\da-f]{6}$/i),
  wallTexture: z.enum(["plaster", "concrete", "brick"]).default("plaster"),
  floorTexture: z.enum(["stone", "concrete", "wood"]).default("stone"),
  spotlights: z.boolean().default(true),
  partitionWalls: z.array(partitionWallSchema).max(8).default([]),
  curatorialText: z.string().max(300).default(""),
});

export type GalleryRoom = z.infer<typeof galleryRoomSchema>;

export function createGalleryRoom(index = 0): GalleryRoom {
  return {
    id: crypto.randomUUID(),
    name: `Room ${index + 1}`,
    layout: "white-cube",
    wallColor: "#f5f2eb",
    sideWallColor: "#e2ded6",
    floorColor: "#c5beb2",
    wallTexture: "plaster",
    floorTexture: "stone",
    spotlights: true,
    partitionWalls: [],
    curatorialText: "",
  };
}

export function parseGalleryRooms(value: string): GalleryRoom[] {
  const parsed = z.array(galleryRoomSchema).max(12).parse(JSON.parse(value));
  return parsed.length ? parsed : [createGalleryRoom()];
}
