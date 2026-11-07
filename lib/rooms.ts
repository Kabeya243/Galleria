import { z } from "zod";
import { ELEMENT_DEFAULTS, roomElementSchema, type ElementType, type RoomElement } from "@/lib/elements";
import { SUNLIGHT_CEILING_COLOR, SUNLIGHT_FLOOR_COLOR, SUNLIGHT_HEIGHT, SUNLIGHT_WALL_COLOR } from "@/lib/sunlight";

// Template categories for the galleries catalogue. Every preset belongs
// to exactly one category, shown as a filter chip on the galleries page.
// Sunlight Gallery is the only template, and it is architectural.
export const roomCategories = [
  "Architectural",
] as const;

export type RoomCategory = (typeof roomCategories)[number];

// The gallery collection: ONE template — the Sunlight Gallery, ported
// exactly from Kabeya's Three.js reference room ("Galerie lumière").
// It is the only model offered when an exhibition is created and the
// only one in the /galleries catalogue. The old templates (White Cube,
// Grand Light Hall, Totem Studio, Glass Pavilion, Skylight Gallery,
// Stone Gallery and its halves) were removed in November 2026; their
// layout keys are migrated to Sunlight on load (see parseGalleryRooms),
// so exhibitions saved with one still open — with their artworks —
// instead of failing validation.
export const roomLayouts = {
  // Sunlight Gallery — a bright 22 × 26 m hall, 5 m high, under seven
  // skylights (four white diffusers, three open sky panels), a
  // procedural concrete floor, three freestanding panels, two pedestals
  // with sculptures and a double door. The room itself is built by the
  // Sunlight shell in components/gallery-scene.tsx, exactly as in the
  // reference file; this preset only carries its dimensions and the
  // colours the catalogue preview and the editor read.
  sunlight: {
    label: "Sunlight Gallery",
    category: "Architectural",
    description: "A bright 22 × 26 m hall under seven skylights — daylight, a concrete floor and freestanding panels, from a Three.js reference room.",
    width: 22,
    depth: 26,
    height: SUNLIGHT_HEIGHT,
    wallColor: SUNLIGHT_WALL_COLOR,
    sideWallColor: SUNLIGHT_WALL_COLOR,
    floorColor: SUNLIGHT_FLOOR_COLOR,
    wallTexture: "plaster",
    floorTexture: "concrete",
    ceilingColor: SUNLIGHT_CEILING_COLOR,
    ceilingTexture: "plaster",
    spotlights: false,
    lightType: "sunlight",
    partitions: [],
  },
} as const;

export type RoomLayout = keyof typeof roomLayouts;

// The one room model offered when an exhibition is created (feature 7).
// Labels live in the i18n dictionary (`create.model*`); the layout
// label is the room's own.
export const ROOM_MODELS = [
  { id: "sunlight", layout: "sunlight" },
] as const;

export type RoomModelId = (typeof ROOM_MODELS)[number]["id"];

export function roomModelLayout(modelId: string): RoomLayout {
  const model = ROOM_MODELS.find((candidate) => candidate.id === modelId);
  return (model?.layout ?? "sunlight") as RoomLayout;
}

// No layout is hidden: Sunlight Gallery is the only template, and it is
// always offered. (Kept as a set so the catalogue filter and the editor's
// layout picker keep working unchanged.)
export const HIDDEN_LAYOUT_KEYS: ReadonlySet<RoomLayout> = new Set([]);

// Where each room sits in the shared 3D space, as world offsets from the
// origin. Rooms line up side by side along X (each touching the next);
// every room is centred on z = 0 in plan terms — the Sunlight room's
// own −1 m floor shift lives inside its local geometry (see
// lib/sunlight.ts), not in the plan offset. The X of a room follows the
// rooms before it, like any other room.
export function roomPlanOffsets(rooms: { layout: RoomLayout }[]): { x: number[]; z: number[] } {
  const xs: number[] = [];
  const zs: number[] = [];
  let currentX = 0;
  for (let i = 0; i < rooms.length; i += 1) {
    const layout = rooms[i].layout;
    const width = roomLayouts[layout].width;
    if (i > 0) {
      const previousLayout = rooms[i - 1].layout;
      const previousWidth = roomLayouts[previousLayout].width;
      currentX += (previousWidth + width) / 2;
    }
    xs.push(currentX);
    zs.push(0);
  }
  return { x: xs, z: zs };
}

const layoutKeys = Object.keys(roomLayouts) as [RoomLayout, ...RoomLayout[]];

export const wallTextures = {
  plaster: "Plaster",
  concrete: "Concrete",
  brick: "Brick",
  marble: "Marble",
  // Stone plaster: the beige stone wall of the retired Stone Gallery —
  // kept so rooms saved with it still validate.
  "stone-plaster": "Stone plaster",
} as const;

export const floorTextures = {
  stone: "Stone",
  concrete: "Concrete",
  wood: "Wood",
  marble: "Marble",
  // Stone concrete: the mottled concrete floor of the retired Stone
  // Gallery — kept so rooms saved with it still validate.
  "stone-concrete": "Stone concrete",
  // Real light parquet: the Poly Haven "Wood Floor" photo (CC0) in
  // public/textures/wood-floor.jpg, loaded by the 3D scene. The
  // procedural "wood" tile stays the fallback until the photo loads.
  parquet: "Parquet · real wood",
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
  // Light parquet, real wood: the Poly Haven photo texture, so any room
  // can take the reference-room floor from the floor picker.
  "light-parquet": { label: "Light parquet · real wood", texture: "parquet", color: "#c9a877" },
  "dark-wood": { label: "Dark wood", texture: "wood", color: "#5a4632" },
  "polished-concrete": { label: "Polished concrete", texture: "concrete", color: "#cfc9bd" },
  // Stone concrete: the retired Stone Gallery's mottled concrete floor.
  "stone-concrete": { label: "Stone concrete", texture: "stone-concrete", color: "#b5b0a5" },
  white: { label: "White", texture: "stone", color: "#f2efe8" },
  marble: { label: "Marble", texture: "marble", color: "#d8d5cf" },
  charcoal: { label: "Charcoal", texture: "stone", color: "#4a4743" },
} as const;

export type FloorType = keyof typeof floorTypes;

const floorTypeKeys = Object.keys(floorTypes) as [FloorType, ...FloorType[]];

// Light moods per room. Sunlight is the only one a room can take now —
// the Sunlight Gallery's sun, skylights and IBL are fixed by the
// reference room and do not follow a mood. The retired moods stay in
// the enum so rooms saved with one still validate; parseGalleryRooms
// coerces them to "sunlight" on load.
export const lightTypes = {
  sunlight: { label: "Sunlight" },
  "spot-warm": { label: "Spot · Warm" },
  "spot-cool": { label: "Spot · Cool" },
  ambient: { label: "Soft ambient" },
  "stone-warm": { label: "Stone · Warm" },
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
  if (floorTexture === "parquet") return "light-parquet";
  if (floorTexture === "wood") return luminance > 0.45 ? "light-wood" : "dark-wood";
  if (floorTexture === "marble") return "marble";
  if (floorTexture === "concrete") return "polished-concrete";
  if (floorTexture === "stone-concrete") return "stone-concrete";
  if (luminance > 0.85) return "white";
  if (luminance > 0.6) return "polished-concrete";
  return "charcoal";
}

export const partitionWallSchema = z.object({
  id: z.string().min(1).max(64),
  x: z.number().min(-20).max(20),
  z: z.number().min(-20).max(20),
  length: z.number().min(1).max(24),
  orientation: z.enum(["horizontal", "vertical"]),
  // Painted colour for this one wall; falls back to the room's side walls.
  color: z.string().regex(/^#[\da-f]{6}$/i).optional(),
  shape: z.enum(["rect", "arch"]).optional(),
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
  wallTexture: z.enum(["plaster", "concrete", "brick", "marble", "stone-plaster"]).default("plaster"),
  floorTexture: z.enum(["stone", "concrete", "wood", "marble", "parquet", "stone-concrete"]).default("stone"),
  ceilingTexture: z.enum(["plaster", "concrete", "brick", "marble", "wood"]).default("plaster"),
  spotlights: z.boolean().default(true),
  partitionWalls: z.array(partitionWallSchema).max(8).default([]),
  curatorialText: z.string().max(300).default(""),
  // One choice re-floors the room (colour + texture together).
  floorType: z.enum(floorTypeKeys).default("charcoal"),
  // Light mood for the room. Sunlight is the only live value; the
  // retired moods stay in the enum so old rooms still validate.
  lightType: z.enum(lightTypeKeys).default("sunlight"),
  // Per-wall paint overrides (absent = the room's wall colours).
  wallPaint: wallPaintSchema.default({}),
  // Placeable 3D elements (furniture, partition walls, vitrines, ...).
  elements: z.array(roomElementSchema).max(24).default([]),
});

export type GalleryRoom = z.infer<typeof galleryRoomSchema>;

// Apply a whole preset when the gallery layout changes in the editor: the
// preset carries dimensions AND finishes, so switching galleries visibly
// changes the room instead of only resizing the same grey box. Switching
// also swaps the seeded furniture: the previous template's pieces leave
// and the new template's pieces arrive as real elements the user can
// move, rotate or delete, while pieces the user added by hand stay put.
// With a single template this is a no-op for Sunlight rooms, and a
// migration to Sunlight for a room saved with a retired layout.
export function applyLayoutPreset(room: GalleryRoom, layout: RoomLayout): GalleryRoom {
  // The preset is read before the same-layout guard: with a single
  // template the guard would otherwise narrow `layout` to never.
  const preset = roomLayouts[layout];
  if (room.layout === layout) return room;
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
    lightType: preset.lightType,
    floorType: inferFloorType(preset.floorTexture, preset.floorColor),
    // Sunlight has no partition walls.
    partitionWalls: [],
    elements: [...room.elements.filter((element) => !element.seededFrom), ...seedElements(layout)],
  };
}

// Each photo room starts with its own furniture, as movable elements the
// user can move, rotate or delete — so every room is unique like its
// reference photo, while the Elements palette stays the same everywhere.
// Seeding happens for new rooms (createGalleryRoom) and when the layout
// is switched (applyLayoutPreset swaps the seeded set); rooms saved
// before seeding existed keep exactly what they have.
// The Sunlight Gallery seeds nothing: its panels, pedestals, sculptures
// and double door are fixed parts of the reference room (built by the
// Sunlight shell in components/gallery-scene.tsx), not movable elements.
export function seedElements(layout: RoomLayout): RoomElement[] {
  void layout;
  return [];
}

export function createGalleryRoom(index = 0, layout: RoomLayout = "sunlight"): GalleryRoom {
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
      lightType: roomLayouts[layout].lightType,
      wallPaint: {},
      elements: [],
    },
    layout,
  );
  // applyLayoutPreset returns a room unchanged when it already has the
  // target layout, so a NEW room created straight into a layout never
  // received that layout's preset partitions. A new room has no user
  // customisations to preserve, so seed the preset's partitions here,
  // like the seeded elements below. Sunlight has no partitions.
  return {
    ...room,
    partitionWalls: [],
    elements: seedElements(layout),
  };
}

// The four placeholder artworks of the Sunlight Gallery demo, pre-placed
// when an exhibition is created from the sunlight model — as NORMAL
// artworks (real Artwork rows), so the editor can select each one,
// change its title, replace its image, move/resize it or delete it.
// They hang on the three freestanding panels, at the reference room's
// own positions: P1 (-3,-4, rot .8) takes two works, P2 (-7.5,-9,
// rot .4) one, P3 (5,-8.5, rot -.65) one. Positions are room-local
// (x, y, z) with rotation = the panel's yaw; each work sits 0.1 m off
// its panel face (local z = 0.25) so the wood frame clears the panel,
// like the Stone Gallery's 0.1 m stand-off. The images are the bundled
// procedural placeholders (public/artworks/stone-gallery/*.jpg); the
// editor allows those bundled paths to be saved (see isAllowedImageUrl).
// The placeholder description says plainly that the work is a
// placeholder to replace.
export function seedSunlightArtworks(roomId: string) {
  const placeholder = "Placeholder artwork from the Sunlight Gallery template — replace it with your own work.";
  const base = {
    artist: "",
    year: "",
    medium: "Mixed media",
    description: placeholder,
    scale: 1,
    frame: "wood",
    roomId,
  };
  return [
    {
      ...base,
      title: "Sunlight Collage",
      dimensions: "240 × 240 cm",
      color: "#cdb78f",
      accent: "#4a2f22",
      positionX: -2.612,
      positionY: 2,
      positionZ: -4.041,
      rotation: 0.8,
      imageUrl: "/artworks/stone-gallery/collage.jpg",
    },
    {
      ...base,
      title: "Sunlight Field I",
      dimensions: "150 × 190 cm",
      color: "#d9a23a",
      accent: "#b4361f",
      positionX: -4.632,
      positionY: 1.9,
      positionZ: -1.961,
      rotation: 0.8,
      imageUrl: "/artworks/stone-gallery/vivid.jpg",
    },
    {
      ...base,
      title: "Sunlight Field II",
      dimensions: "160 × 200 cm",
      color: "#d9a23a",
      accent: "#b4361f",
      positionX: -7.403,
      positionY: 1.9,
      positionZ: -8.77,
      rotation: 0.4,
      imageUrl: "/artworks/stone-gallery/red.jpg",
    },
    {
      ...base,
      title: "Sunlight Field III",
      dimensions: "220 × 220 cm",
      color: "#8b1c14",
      accent: "#d8581e",
      positionX: 4.849,
      positionY: 1.9,
      positionZ: -8.301,
      rotation: -0.65,
      imageUrl: "/artworks/stone-gallery/collage.jpg",
    },
  ];
}

// Layouts retired in November 2026, kept as a migration so exhibitions
// saved with the old shapes still open instead of failing validation.
// Every retired layout becomes Sunlight Gallery — the room keeps its
// artworks (their positions are room-local and land in the Sunlight
// room), its name and its finishes are reset to the Sunlight preset.
const legacyLayouts: Record<string, RoomLayout> = {
  "white-cube": "sunlight",
  "long-gallery": "sunlight",
  "intimate-room": "sunlight",
  cube: "sunlight",
  "grand-hall": "sunlight",
  "totem-studio": "sunlight",
  "gallery-skylight": "sunlight",
  "glass-pavilion": "sunlight",
  "stone-gallery": "sunlight",
  "stone-gallery-front": "sunlight",
  "stone-gallery-back": "sunlight",
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
        // A room saved with a layout that no longer exists (template
        // removed from the catalogue) becomes Sunlight Gallery instead
        // of failing validation, so the exhibition still opens.
        if (typeof next.layout === "string" && !(next.layout in roomLayouts)) {
          next.layout = "sunlight";
        }
        // The Sunlight Gallery's sun, skylights and IBL are fixed by
        // the reference room: a retired light mood never applies.
        if (typeof next.lightType === "string" && next.lightType !== "sunlight") {
          next.lightType = "sunlight";
        }
        // Rooms saved before floor types / light types / elements existed:
        // fill them in from what the room already looks like.
        if (typeof next.floorType !== "string") {
          next.floorType = inferFloorType(
            typeof next.floorTexture === "string" ? next.floorTexture : "stone",
            typeof next.floorColor === "string" ? next.floorColor : "#f5f2eb",
          );
        }
        if (typeof next.lightType !== "string") next.lightType = "sunlight";
        if (!next.wallPaint || typeof next.wallPaint !== "object") next.wallPaint = {};
        if (!Array.isArray(next.elements)) next.elements = [];
        return next;
      })
    : raw;
  const parsed = z.array(galleryRoomSchema).max(12).parse(migrated);
  return parsed.length ? parsed : [createGalleryRoom()];
}
