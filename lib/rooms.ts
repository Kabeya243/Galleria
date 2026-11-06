import { z } from "zod";
import { ELEMENT_DEFAULTS, roomElementSchema, type ElementType, type RoomElement } from "@/lib/elements";

// Template categories for the galleries catalogue. Every preset belongs
// to exactly one category, shown as a filter chip on the galleries page.
// Only the categories the five kept templates use are listed — the
// retired templates took Luxury, Immersive and Residential & Commercial
// with them in November 2026.
export const roomCategories = [
  "Contemporary",
  "Architectural",
  "Cultural",
] as const;

export type RoomCategory = (typeof roomCategories)[number];

// The gallery collection: five templates — the four room models offered
// when an exhibition is created (White Cube, Grand Light Hall, Totem
// Studio, Glass Pavilion) plus the Skylight Gallery reference room.
// Each preset carries its own dimensions, finishes, light mood and
// seeded furniture, so picking a gallery in the editor already looks
// like the reference space. The other templates were retired in
// November 2026; exhibitions saved with one fall back to the White
// Cube when they open (see parseGalleryRooms).
export const roomLayouts = {
  cube: {
    label: "White Cube",
    category: "Contemporary",
    description: "The classic white cube: a bright, neutral room that lets the work speak first.",
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
    lightType: "spot-warm",
    partitions: [{ x: 0, z: 0, length: 6, orientation: "horizontal" }],
  },
  "grand-hall": {
    label: "Grand Light Hall",
    category: "Contemporary",
    description: "A grand, light-filled hall for large works and generous hangs.",
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
    lightType: "spot-warm",
    partitions: [],
  },
  "totem-studio": {
    label: "Totem Studio",
    category: "Cultural",
    description: "A studio-like space of concrete and stone, made for totemic, standing work.",
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
    lightType: "spot-warm",
    partitions: [],
  },
  // Ceiling architectures from Kabeya's reference photos of real galleries
  // (November 2026): the ceiling itself is the architecture here.
  // The reference room (November 2026): a bright white gallery under a
  // white coffered ceiling with one central skylight, light parquet
  // underfoot — the room from the preview renders Kabeya validated.
  // The ceiling (white coffers + verrière + daylight) is built by
  // RoomFeatures in components/gallery-scene.tsx; the floor is the real
  // Poly Haven "Wood Floor" photo (CC0) via the "parquet" finish.
  "gallery-skylight": {
    label: "Skylight Gallery",
    category: "Architectural",
    description: "A bright white gallery under a white coffered ceiling and a central skylight, light parquet underfoot — the reference room.",
    width: 18,
    depth: 12,
    height: 5.2,
    wallColor: "#faf8f2",
    sideWallColor: "#f0ece1",
    floorColor: "#c9a877",
    wallTexture: "plaster",
    floorTexture: "parquet",
    ceilingColor: "#faf8f2",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "spot-warm",
    partitions: [],
  },
  // Stone Gallery — adapted from a Three.js reference room ("Galerie en
  // pierre"): a 20 × 24 m stone hall, 6.5 m high, with a round-arched
  // dividing wall, dark timber beams, a wall niche, rubble and a
  // concrete plinth. The arch wall is a real partition (shape "arch")
  // so the editor can move, resize or remove it like any other wall;
  // the beams, niche, rubble and plinth are built by RoomFeatures in
  // components/gallery-scene.tsx. The seven placeholder artworks on
  // the walls are seeded by seedStoneGalleryArtworks below when an
  // exhibition is created from this model.
  "stone-gallery": {
    label: "Stone Gallery",
    category: "Architectural",
    description: "A stone hall with a round-arched dividing wall, dark timber beams and warm track light — from a Three.js reference room.",
    width: 20,
    depth: 24,
    height: 6.5,
    wallColor: "#b8ab94",
    sideWallColor: "#ab9d84",
    floorColor: "#b5b0a5",
    wallTexture: "stone-plaster",
    floorTexture: "stone-concrete",
    ceilingColor: "#d8d2c4",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "stone-warm",
    partitions: [{ x: 0, z: -1, length: 20, orientation: "horizontal", shape: "arch" }],
  },
  // Glass Pavilion — the outdoor room model, kept from the November
  // 2026 catalogue expansion; the other expansion templates were retired.
  "glass-pavilion": {
    label: "Glass Pavilion",
    category: "Architectural",
    description: "A square glass pavilion flooded with daylight, open and almost without shadow.",
    width: 16,
    depth: 16,
    height: 5,
    wallColor: "#fbfaf6",
    sideWallColor: "#f2f0e8",
    floorColor: "#e8e6df",
    wallTexture: "plaster",
    floorTexture: "marble",
    ceilingColor: "#fbfaf6",
    ceilingTexture: "plaster",
    spotlights: false,
    lightType: "ambient",
    partitions: [],
  },
  // Cultural
  // Immersive
  // Residential & Commercial
} as const;

export type RoomLayout = keyof typeof roomLayouts;

// The four named room models offered when an exhibition is created
// (feature 7). Each model is one of the 41 layouts, chosen for the
// mood it gives the first room — the visitor can still switch layouts
// and add rooms in the editor afterwards. Labels live in the i18n
// dictionary (`create.model*`); the layout label is the room's own.
export const ROOM_MODELS = [
  { id: "minimalist", layout: "cube" },
  { id: "classic", layout: "grand-hall" },
  { id: "studio", layout: "totem-studio" },
  { id: "outdoor", layout: "glass-pavilion" },
  { id: "stone", layout: "stone-gallery" },
] as const;

export type RoomModelId = (typeof ROOM_MODELS)[number]["id"];

export function roomModelLayout(modelId: string): RoomLayout {
  const model = ROOM_MODELS.find((candidate) => candidate.id === modelId);
  return (model?.layout ?? "cube") as RoomLayout;
}

const layoutKeys = Object.keys(roomLayouts) as [RoomLayout, ...RoomLayout[]];

export const wallTextures = {
  plaster: "Plaster",
  concrete: "Concrete",
  brick: "Brick",
  marble: "Marble",
  // Stone plaster: the beige stone wall of the Stone Gallery — speckles,
  // stains and hairline cracks over a warm plaster base (see
  // createSurfaceTexture in components/gallery-scene.tsx).
  "stone-plaster": "Stone plaster",
} as const;

export const floorTextures = {
  stone: "Stone",
  concrete: "Concrete",
  wood: "Wood",
  marble: "Marble",
  // Stone concrete: the mottled concrete floor of the Stone Gallery —
  // large soft blotches, no formwork joints, matte (see
  // createSurfaceTexture in components/gallery-scene.tsx).
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
  // Stone concrete: the Stone Gallery's mottled concrete floor.
  "stone-concrete": { label: "Stone concrete", texture: "stone-concrete", color: "#b5b0a5" },
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
  // Stone Gallery: the warm hemisphere + point-light glow of the
  // Three.js reference room ("Galerie en pierre") — no bright
  // per-artwork pools, no hard sun.
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
  length: z.number().min(1).max(16),
  orientation: z.enum(["horizontal", "vertical"]),
  // Painted colour for this one wall; falls back to the room's side walls.
  color: z.string().regex(/^#[\da-f]{6}$/i).optional(),
  // Wall shape: a plain rectangle ("rect") or a full wall pierced by a
  // round arch ("arch", the Stone Gallery dividing wall). Absent means
  // "rect". The arch opening is 4 m wide with its springing at 3.4 m
  // (see the arch partition renderer in components/gallery-scene.tsx).
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
// changes the room instead of only resizing the same grey box. Switching
// also swaps the seeded furniture: the previous template's pieces leave
// and the new template's pieces arrive as real elements the user can
// move, rotate or delete, while pieces the user added by hand stay put.
export function applyLayoutPreset(room: GalleryRoom, layout: RoomLayout): GalleryRoom {
  if (room.layout === layout) return room;
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
    lightType: preset.lightType,
    floorType: inferFloorType(preset.floorTexture, preset.floorColor),
    partitionWalls: preset.partitions.map((wall) => ({ ...wall, id: crypto.randomUUID() })),
    elements: [...room.elements.filter((element) => !element.seededFrom), ...seedElements(layout)],
  };
}

// Each photo room starts with its own furniture, as movable elements the
// user can move, rotate or delete — so every room is unique like its
// reference photo, while the Elements palette stays the same everywhere.
// Seeding happens for new rooms (createGalleryRoom) and when the layout
// is switched (applyLayoutPreset swaps the seeded set); rooms saved
// before seeding existed keep exactly what they have.
export function seedElements(layout: RoomLayout): RoomElement[] {
  const { width, depth, height } = roomLayouts[layout];
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
      // Marked with the template it came from, so a later layout switch
      // can swap these pieces out without touching the user's own.
      seededFrom: layout,
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
    case "gallery-skylight": // Reference room: one flush white door on
      // the back wall (right side, clear of the hang). The side walls
      // already carry real window openings, so no window element is
      // seeded; the light comes from the skylight and the artwork spots.
      return [
        make("door", 7.5, 0, -depth / 2 + 0.15, 0),
      ];
    case "glass-pavilion": // One tall plinth, sheer curtains both sides.
      return [
        make("plinth", 0, 0, 0, 0, { variant: "tall" }),
        make("curtain", -width / 2 + 0.3, 0, 0, Math.PI / 2),
        make("curtain", width / 2 - 0.3, 0, 0, -Math.PI / 2),
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
      lightType: roomLayouts[layout].lightType,
      wallPaint: {},
      elements: [],
    },
    layout,
  );
  return { ...room, elements: seedElements(layout) };
}

// The seven placeholder artworks of the Stone Gallery demo, pre-placed
// when an exhibition is created from the stone model — as NORMAL
// artworks (real Artwork rows), so the editor can select each one,
// change its title, replace its image, move/resize it or delete it.
// Positions and sizes are the demo's (Three.js source, z shifted +3 m
// to centre the room on the origin). The works sit 0.1 m off the wall
// face they hang on: the dividing-wall works sit 0.1 m off the arch
// wall's face, and the back/side works sit 0.1 m off the inner face of
// SANAA's 0.25 m wall boxes (0.225 m off the room boundary), so the
// wood frame (0.12 m deep) clears the stone and the work stands off
// the wall like the reference instead of sitting flush in it. The
// images are procedural placeholders generated from the source's own
// art (public/artworks/stone-gallery/*.jpg); the editor allows those
// bundled paths to be saved (see isAllowedImageUrl).
// The placeholder description says plainly that the work is a
// placeholder to replace.
export function seedStoneGalleryArtworks(roomId: string) {
  const placeholder = "Placeholder artwork from the Stone Gallery template — replace it with your own work.";
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
      title: "Stone Collage",
      dimensions: "220 × 260 cm",
      color: "#cdb78f",
      accent: "#4a2f22",
      positionX: -9.775,
      positionY: 2.3,
      positionZ: 0.5,
      rotation: Math.PI / 2,
      imageUrl: "/artworks/stone-gallery/collage.jpg",
    },
    {
      ...base,
      title: "Vivid Field I",
      dimensions: "140 × 260 cm",
      color: "#d9a23a",
      accent: "#b4361f",
      positionX: -6,
      positionY: 2.4,
      positionZ: -0.55,
      rotation: 0,
      imageUrl: "/artworks/stone-gallery/vivid.jpg",
    },
    {
      ...base,
      title: "Red Field I",
      dimensions: "220 × 170 cm",
      color: "#8b1c14",
      accent: "#d8581e",
      positionX: 6,
      positionY: 2.3,
      positionZ: -0.55,
      rotation: 0,
      imageUrl: "/artworks/stone-gallery/red.jpg",
    },
    {
      ...base,
      title: "Vivid Field II",
      dimensions: "140 × 260 cm",
      color: "#d9a23a",
      accent: "#b4361f",
      positionX: -3.4,
      positionY: 2.4,
      positionZ: -11.775,
      rotation: 0,
      imageUrl: "/artworks/stone-gallery/vivid.jpg",
    },
    {
      ...base,
      title: "Red Field II",
      dimensions: "90 × 150 cm",
      color: "#8b1c14",
      accent: "#d8581e",
      positionX: 0,
      positionY: 2.6,
      positionZ: -11.775,
      rotation: 0,
      imageUrl: "/artworks/stone-gallery/red.jpg",
    },
    {
      ...base,
      title: "Red Field III",
      dimensions: "200 × 150 cm",
      color: "#8b1c14",
      accent: "#d8581e",
      positionX: 5,
      positionY: 1.9,
      positionZ: -11.775,
      rotation: 0,
      imageUrl: "/artworks/stone-gallery/red.jpg",
    },
    {
      ...base,
      title: "Vivid Field III",
      dimensions: "160 × 240 cm",
      color: "#d9a23a",
      accent: "#b4361f",
      positionX: 9.775,
      positionY: 2.3,
      positionZ: -5,
      rotation: -Math.PI / 2,
      imageUrl: "/artworks/stone-gallery/vivid.jpg",
    },
  ];
}

// Galleries retired in November 2026, kept as a migration so exhibitions
// saved with the old shapes still open instead of failing validation.
const legacyLayouts: Record<string, RoomLayout> = {
  "white-cube": "cube",
  "long-gallery": "grand-hall",
  "intimate-room": "cube",
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
        // removed from the catalogue) falls back to the White Cube
        // instead of failing validation, so the exhibition still opens.
        if (typeof next.layout === "string" && !(next.layout in roomLayouts)) {
          next.layout = "cube";
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
