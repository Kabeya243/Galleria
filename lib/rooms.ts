import { z } from "zod";
import { ELEMENT_DEFAULTS, roomElementSchema, type ElementType, type RoomElement } from "@/lib/elements";

// Template categories for the galleries catalogue. Every preset belongs
// to exactly one category, shown as a filter chip on the galleries page.
export const roomCategories = [
  "Contemporary",
  "Luxury",
  "Architectural",
  "Cultural",
  "Immersive",
  "Residential & Commercial",
] as const;

export type RoomCategory = (typeof roomCategories)[number];

// The gallery collection, rebuilt from Kabeya's ten reference rooms and
// expanded to forty-one templates (forty in November 2026, plus the
// Skylight Gallery reference room). Each preset carries its
// own dimensions, finishes, light mood and seeded furniture, so picking
// a gallery in the editor already looks like the reference space.
// The original seventeen presets keep their layout ids, dimensions and
// defaults — saved exhibitions reference them.
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
  "black-panels": {
    label: "Black Panels",
    category: "Contemporary",
    description: "Dark panelled walls and focused spots for work that needs drama and shadow.",
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
    lightType: "spot-warm",
    partitions: [],
  },
  "raw-concrete": {
    label: "Raw Concrete",
    category: "Architectural",
    description: "Bare concrete walls and a stone floor for work with a raw, material edge.",
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
    lightType: "spot-warm",
    partitions: [],
  },
  "parquet-portraits": {
    label: "Portraits & Parquet",
    category: "Contemporary",
    description: "Warm parquet underfoot and soft plaster walls, made for portraits.",
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
    lightType: "spot-warm",
    partitions: [],
  },
  "curved-wall": {
    label: "Curved Wall",
    category: "Architectural",
    description: "One long curved wall that draws visitors along the hang.",
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
    lightType: "spot-warm",
    partitions: [],
  },
  "marble-sculpture": {
    label: "Marble & Sculpture",
    category: "Contemporary",
    description: "Marble floors and calm white walls, built around sculpture.",
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
    lightType: "spot-warm",
    partitions: [],
  },
  "quiet-minimal": {
    label: "Quiet Minimal",
    category: "Contemporary",
    description: "A small, quiet room for a few works and slow looking.",
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
    lightType: "spot-warm",
    partitions: [],
  },
  "pop-brick": {
    label: "Pop & Brick",
    category: "Contemporary",
    description: "Warm brick and timber for bold, colourful work.",
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
  "coffered-concrete": {
    label: "Coffered Concrete",
    category: "Architectural",
    description: "A concrete ceiling of deep coffers that gives the room its architecture.",
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
    lightType: "spot-warm",
    partitions: [],
  },
  "skylight-grid": {
    label: "Skylight Grid",
    category: "Architectural",
    description: "A tall hall under a grid of skylights, lit from above all day.",
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
    lightType: "spot-warm",
    partitions: [],
  },
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
  "timber-ceiling": {
    label: "Timber Ceiling",
    category: "Architectural",
    description: "Warm timber beams overhead and movable walls below.",
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
    lightType: "spot-warm",
    partitions: [],
  },
  "high-concrete": {
    label: "High Concrete",
    category: "Architectural",
    description: "A tall concrete room with a long bench and a glass vitrine.",
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
    lightType: "spot-warm",
    partitions: [],
  },
  "beam-white": {
    label: "White Beam Hall",
    category: "Architectural",
    description: "A bright white hall under exposed ceiling beams, with plinths in three heights.",
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
    lightType: "spot-warm",
    partitions: [],
  },
  // Photo 5 (photo_4-3.jpg): a large museum hall of tall freestanding
  // walls on metal feet, track spotlights, polished floor.
  "partition-hall": {
    label: "Partition Hall",
    category: "Contemporary",
    description: "A museum hall of tall freestanding walls on metal feet.",
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
    lightType: "spot-warm",
    partitions: [],
  },
  // Photo 7 (photo_6-2.jpg): a gallery storefront — bright, display
  // shelves, white plinths, a desk and chair.
  "storefront": {
    label: "Storefront Gallery",
    category: "Residential & Commercial",
    description: "A bright gallery storefront with display shelves, plinths and a desk.",
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
    lightType: "spot-warm",
    partitions: [],
  },
  // ---- November 2026 catalogue expansion: 23 new templates, 40 total ----
  // Contemporary
  "photo-white": {
    label: "Photography Gallery",
    category: "Contemporary",
    description: "Cool, even light on near-white walls and a dark floor, so photographs hold the eye.",
    width: 16,
    depth: 11,
    height: 4.6,
    wallColor: "#f7f5f0",
    sideWallColor: "#ece8de",
    floorColor: "#3f3d3a",
    wallTexture: "plaster",
    floorTexture: "stone",
    ceilingColor: "#f7f5f0",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "spot-cool",
    partitions: [],
  },
  "sculpture-court": {
    label: "Sculpture Court",
    category: "Contemporary",
    description: "A wide marble-floored court with plinths in three heights for standing work.",
    width: 24,
    depth: 18,
    height: 6.5,
    wallColor: "#f2efe8",
    sideWallColor: "#e6e1d4",
    floorColor: "#d8d5cf",
    wallTexture: "plaster",
    floorTexture: "marble",
    ceilingColor: "#f2efe8",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "spot-cool",
    partitions: [],
  },
  "brutalist-hall": {
    label: "Brutalist Hall",
    category: "Contemporary",
    description: "Monumental raw concrete, eight metres high, lit by a soft even ambient glow.",
    width: 28,
    depth: 18,
    height: 8,
    wallColor: "#8f887a",
    sideWallColor: "#847d6f",
    floorColor: "#6a675f",
    wallTexture: "concrete",
    floorTexture: "concrete",
    ceilingColor: "#8f887a",
    ceilingTexture: "concrete",
    spotlights: false,
    lightType: "ambient",
    partitions: [],
  },
  "museum-wing": {
    label: "Museum Wing",
    category: "Contemporary",
    description: "A museum-scale wing for a full survey hang, with freestanding walls and long benches.",
    width: 30,
    depth: 20,
    height: 7.5,
    wallColor: "#faf8f2",
    sideWallColor: "#f0ece1",
    floorColor: "#cfc9bd",
    wallTexture: "plaster",
    floorTexture: "concrete",
    ceilingColor: "#faf8f2",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "spot-cool",
    partitions: [],
  },
  // Luxury
  "private-salon": {
    label: "Private Salon",
    category: "Luxury",
    description: "An intimate private salon: warm ivory walls, dark wood floor, a bench and a vitrine.",
    width: 14,
    depth: 10,
    height: 4.2,
    wallColor: "#f3ead9",
    sideWallColor: "#e9dcc2",
    floorColor: "#5a4632",
    wallTexture: "plaster",
    floorTexture: "wood",
    ceilingColor: "#f3ead9",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "spot-warm",
    partitions: [],
  },
  "art-salon": {
    label: "High-End Art Salon",
    category: "Luxury",
    description: "Deep green walls and warm spots, the hushed setting of a high-end art salon.",
    width: 18,
    depth: 12,
    height: 5,
    wallColor: "#2e3b33",
    sideWallColor: "#26332c",
    floorColor: "#4a3826",
    wallTexture: "plaster",
    floorTexture: "wood",
    ceilingColor: "#efe9dc",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "spot-warm",
    partitions: [],
  },
  "collectors-home": {
    label: "Collector's Residence",
    category: "Luxury",
    description: "A collector's living room, where art hangs beside a desk, shelves and chairs.",
    width: 16,
    depth: 12,
    height: 4.5,
    wallColor: "#efe6d4",
    sideWallColor: "#e4d8bf",
    floorColor: "#c9a877",
    wallTexture: "plaster",
    floorTexture: "wood",
    ceilingColor: "#efe6d4",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "spot-warm",
    partitions: [],
  },
  // Architectural
  "underground": {
    label: "Underground Exhibition",
    category: "Architectural",
    description: "A low, dark underground room where warm track lights pick works out of the dark.",
    width: 18,
    depth: 14,
    height: 4.2,
    wallColor: "#26241f",
    sideWallColor: "#201e1a",
    floorColor: "#4a4743",
    wallTexture: "concrete",
    floorTexture: "stone",
    ceilingColor: "#26241f",
    ceilingTexture: "concrete",
    spotlights: true,
    lightType: "spot-warm",
    partitions: [],
  },
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
  "historic-hall": {
    label: "Historic Hall",
    category: "Architectural",
    description: "A historic hall with a timber ceiling and a dark wood floor, made for grand hangs.",
    width: 24,
    depth: 14,
    height: 7,
    wallColor: "#e9dfc8",
    sideWallColor: "#ddcfae",
    floorColor: "#5a4632",
    wallTexture: "plaster",
    floorTexture: "wood",
    ceilingColor: "#8a6a45",
    ceilingTexture: "wood",
    spotlights: true,
    lightType: "spot-warm",
    partitions: [],
  },
  "warehouse": {
    label: "Industrial Warehouse",
    category: "Architectural",
    description: "A nine-metre warehouse of brick and concrete for work at industrial scale.",
    width: 30,
    depth: 18,
    height: 9,
    wallColor: "#9a5f43",
    sideWallColor: "#8a5238",
    floorColor: "#8a8a86",
    wallTexture: "brick",
    floorTexture: "concrete",
    ceilingColor: "#6a675f",
    ceilingTexture: "concrete",
    spotlights: true,
    lightType: "spot-warm",
    partitions: [],
  },
  // Cultural
  "afrocentric": {
    label: "African Contemporary Gallery",
    category: "Cultural",
    description: "Warm ochre walls and dark wood for contemporary African work, with a wall text that states the idea.",
    width: 20,
    depth: 14,
    height: 5.5,
    wallColor: "#c07a45",
    sideWallColor: "#a96838",
    floorColor: "#5a4632",
    wallTexture: "plaster",
    floorTexture: "wood",
    ceilingColor: "#efe9dc",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "spot-warm",
    partitions: [],
  },
  "heritage-hall": {
    label: "Heritage Exhibition",
    category: "Cultural",
    description: "Deep red walls and vitrines for heritage objects and the stories they carry.",
    width: 22,
    depth: 14,
    height: 5.5,
    wallColor: "#7a3b2e",
    sideWallColor: "#6b3327",
    floorColor: "#c9a877",
    wallTexture: "plaster",
    floorTexture: "wood",
    ceilingColor: "#efe9dc",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "spot-warm",
    partitions: [],
  },
  "textile-craft": {
    label: "Textile & Craft Exhibition",
    category: "Cultural",
    description: "Warm and low-key, with long display shelves for textiles, craft and material work.",
    width: 18,
    depth: 12,
    height: 4.8,
    wallColor: "#efe8d8",
    sideWallColor: "#e6ddc9",
    floorColor: "#a89a7a",
    wallTexture: "plaster",
    floorTexture: "wood",
    ceilingColor: "#efe8d8",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "spot-warm",
    partitions: [],
  },
  "community-space": {
    label: "Community Art Space",
    category: "Cultural",
    description: "A bright, open community room with chairs, a table and space to gather around the work.",
    width: 16,
    depth: 12,
    height: 4.5,
    wallColor: "#f5f2eb",
    sideWallColor: "#e8e4da",
    floorColor: "#cfc9bd",
    wallTexture: "plaster",
    floorTexture: "concrete",
    ceilingColor: "#f5f2eb",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "spot-warm",
    partitions: [],
  },
  // Immersive
  "digital-room": {
    label: "Digital Art Room",
    category: "Immersive",
    description: "A near-black room for screens and light-based work, with one bench facing the wall.",
    width: 14,
    depth: 12,
    height: 4.5,
    wallColor: "#17171a",
    sideWallColor: "#131316",
    floorColor: "#26241f",
    wallTexture: "plaster",
    floorTexture: "stone",
    ceilingColor: "#17171a",
    ceilingTexture: "plaster",
    spotlights: false,
    lightType: "ambient",
    partitions: [],
  },
  "projection-hall": {
    label: "Projection Gallery",
    category: "Immersive",
    description: "A dark hall with rows of benches facing the back wall, built for projection and film.",
    width: 22,
    depth: 16,
    height: 6,
    wallColor: "#232326",
    sideWallColor: "#1d1d20",
    floorColor: "#4a4743",
    wallTexture: "plaster",
    floorTexture: "concrete",
    ceilingColor: "#232326",
    ceilingTexture: "plaster",
    spotlights: false,
    lightType: "ambient",
    partitions: [],
  },
  "experimental": {
    label: "Experimental Exhibition",
    category: "Immersive",
    description: "Pale walls against dark sides, with angled freestanding walls for work that breaks the grid.",
    width: 18,
    depth: 14,
    height: 5.5,
    wallColor: "#d8d2c4",
    sideWallColor: "#3a3a36",
    floorColor: "#8a8a86",
    wallTexture: "plaster",
    floorTexture: "concrete",
    ceilingColor: "#d8d2c4",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "spot-warm",
    partitions: [],
  },
  "infinite-room": {
    label: "Infinite Gallery",
    category: "Immersive",
    description: "A square white room with almost no edges, where one work can feel infinite.",
    width: 20,
    depth: 20,
    height: 5,
    wallColor: "#fbfaf6",
    sideWallColor: "#f5f3ec",
    floorColor: "#f2efe8",
    wallTexture: "plaster",
    floorTexture: "stone",
    ceilingColor: "#fbfaf6",
    ceilingTexture: "plaster",
    spotlights: false,
    lightType: "ambient",
    partitions: [],
  },
  // Residential & Commercial
  "living-room": {
    label: "Living Room",
    category: "Residential & Commercial",
    description: "A home living room at domestic scale, for seeing how work lives with people.",
    width: 12,
    depth: 10,
    height: 3.6,
    wallColor: "#efe8d8",
    sideWallColor: "#e6ddc9",
    floorColor: "#c9a877",
    wallTexture: "plaster",
    floorTexture: "wood",
    ceilingColor: "#efe8d8",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "spot-warm",
    partitions: [],
  },
  "office-gallery": {
    label: "Office Gallery",
    category: "Residential & Commercial",
    description: "A bright office floor with desks and a table, where art meets the working day.",
    width: 18,
    depth: 12,
    height: 3.8,
    wallColor: "#e6e4de",
    sideWallColor: "#d8d5cd",
    floorColor: "#8a8a86",
    wallTexture: "plaster",
    floorTexture: "concrete",
    ceilingColor: "#f5f2eb",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "spot-cool",
    partitions: [],
  },
  "hotel-lobby": {
    label: "Hotel Lobby",
    category: "Residential & Commercial",
    description: "A marble hotel lobby, grand and calm, with benches and a vitrine for arriving guests.",
    width: 24,
    depth: 16,
    height: 6,
    wallColor: "#e8e4da",
    sideWallColor: "#ddd8cc",
    floorColor: "#d8d5cf",
    wallTexture: "marble",
    floorTexture: "marble",
    ceilingColor: "#f5f2eb",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "spot-warm",
    partitions: [],
  },
  "art-fair-booth": {
    label: "Art Fair Booth",
    category: "Residential & Commercial",
    description: "A compact fair booth: one freestanding wall, one plinth, everything within reach.",
    width: 10,
    depth: 8,
    height: 3.5,
    wallColor: "#faf8f2",
    sideWallColor: "#f0ece1",
    floorColor: "#4a4743",
    wallTexture: "plaster",
    floorTexture: "stone",
    ceilingColor: "#faf8f2",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "spot-warm",
    partitions: [],
  },
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
} as const;

export const floorTextures = {
  stone: "Stone",
  concrete: "Concrete",
  wood: "Wood",
  marble: "Marble",
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
  if (floorTexture === "parquet") return "light-parquet";
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
  floorTexture: z.enum(["stone", "concrete", "wood", "marble", "parquet"]).default("stone"),
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
    case "gallery-skylight": // Reference room: one flush white door on
      // the back wall (right side, clear of the hang). The side walls
      // already carry real window openings, so no window element is
      // seeded; the light comes from the skylight and the artwork spots.
      return [
        make("door", 7.5, 0, -depth / 2 + 0.15, 0),
      ];
    case "storefront": // Photo 7: display shelves, plinths, desk & chair.
      return [
        make("shelf", 0, 1.7, -depth / 2 + 0.2, 0, { length: 4 }),
        make("plinth", -3, 0, 1),
        make("plinth", 3, 0, 1, 0, { variant: "tall" }),
        make("desk", 5.5, 0, 2.5, -Math.PI / 2),
      ];
    // ---- November 2026 catalogue expansion ----
    case "photo-white": // Cool light, track rails, two plinths.
      return [
        make("track-light", -3, height - 0.4, 0),
        make("track-light", 3, height - 0.4, 0),
        make("plinth", -4, 0, 0, 0, { variant: "low" }),
        make("plinth", 4, 0, 0, 0, { variant: "tall" }),
      ];
    case "sculpture-court": // Plinths in three heights, one vitrine.
      return [
        make("plinth", -6, 0, 0, 0, { variant: "low" }),
        make("plinth", 0, 0, -1),
        make("plinth", 6, 0, 0, 0, { variant: "tall" }),
        make("vitrine", 9, 0, -4),
      ];
    case "brutalist-hall": // Three freestanding walls, one long bench.
      return [
        make("partition", -8, 0, 0, Math.PI / 2, { length: 6 }),
        make("partition", 0, 0, -1, Math.PI / 2, { length: 6 }),
        make("partition", 8, 0, 0, Math.PI / 2, { length: 6 }),
        make("bench", 0, 0, 4),
      ];
    case "museum-wing": // Freestanding walls, one bench.
      return [
        make("partition", -8, 0, 0, Math.PI / 2, { length: 6 }),
        make("partition", 8, 0, 0, Math.PI / 2, { length: 6 }),
        make("bench", 0, 0, 3),
      ];
    case "private-salon": // Bench and vitrine, salon scale.
      return [
        make("bench", 0, 0, 1),
        make("vitrine", 4, 0, -3),
      ];
    case "art-salon": // Two chairs around a table.
      return [
        make("chair", -2, 0, 1),
        make("chair", 2, 0, 1),
        make("table", 0, 0, 2.5),
      ];
    case "collectors-home": // Desk, shelf, chair — art at home.
      return [
        make("shelf", 0, 1.7, -depth / 2 + 0.2, 0, { length: 4 }),
        make("chair", -3, 0, 1),
        make("desk", 5, 0, 2.5, -Math.PI / 2),
      ];
    case "underground": // Track lights in the dark, one bench.
      return [
        make("track-light", -4, height - 0.4, 0),
        make("track-light", 4, height - 0.4, 0),
        make("bench", 0, 0, 2),
      ];
    case "glass-pavilion": // One tall plinth, sheer curtains both sides.
      return [
        make("plinth", 0, 0, 0, 0, { variant: "tall" }),
        make("curtain", -width / 2 + 0.3, 0, 0, Math.PI / 2),
        make("curtain", width / 2 - 0.3, 0, 0, -Math.PI / 2),
      ];
    case "historic-hall": // Two benches, one freestanding wall.
      return [
        make("bench", -4, 0, 2),
        make("bench", 4, 0, 2),
        make("partition", 0, 0, -2, Math.PI / 2, { length: 5 }),
      ];
    case "warehouse": // Three freestanding walls, one bench.
      return [
        make("partition", -8, 0, 0, Math.PI / 2, { length: 6 }),
        make("partition", 0, 0, -1, Math.PI / 2, { length: 6 }),
        make("partition", 8, 0, 0, Math.PI / 2, { length: 6 }),
        make("bench", 0, 0, 5),
      ];
    case "afrocentric": // Bench, wall text, one plinth.
      return [
        make("bench", 0, 0, 1),
        make("wall-text", 0, 2.2, -depth / 2 + 0.16, 0, {
          title: "Already Enough As We Are",
          body: "Black pride, African memory and identity.",
        }),
        make("plinth", 5, 0, -2),
      ];
    case "heritage-hall": // Two vitrines, one bench.
      return [
        make("vitrine", -4, 0, -3),
        make("vitrine", 4, 0, -3),
        make("bench", 0, 0, 2),
      ];
    case "textile-craft": // Long shelf, two plinths.
      return [
        make("shelf", 0, 1.7, -depth / 2 + 0.2, 0, { length: 4 }),
        make("plinth", -4, 0, 1, 0, { variant: "low" }),
        make("plinth", 4, 0, 1, 0, { variant: "tall" }),
      ];
    case "community-space": // Chairs, table, bench — room to gather.
      return [
        make("chair", -2, 0, 1),
        make("chair", 2, 0, 1),
        make("table", 0, 0, 2),
        make("bench", 0, 0, -2),
      ];
    case "digital-room": // One bench, one track rail.
      return [
        make("bench", 0, 0, 2),
        make("track-light", 0, height - 0.4, 0),
      ];
    case "projection-hall": // Two benches facing the back wall.
      return [
        make("bench", -3, 0, 3),
        make("bench", 3, 0, 3),
      ];
    case "experimental": // Two angled walls, one plinth.
      return [
        make("partition", -4, 0, 0, Math.PI / 4, { length: 5 }),
        make("partition", 4, 0, 0, -Math.PI / 4, { length: 5 }),
        make("plinth", 0, 0, 2),
      ];
    case "infinite-room": // One tall plinth, nothing else.
      return [
        make("plinth", 0, 0, 0, 0, { variant: "tall" }),
      ];
    case "living-room": // Chairs, table, shelf — domestic scale.
      return [
        make("chair", -2, 0, 1),
        make("chair", 2, 0, 1),
        make("table", 0, 0, 2),
        make("shelf", 0, 1.7, -depth / 2 + 0.2, 0, { length: 3 }),
      ];
    case "office-gallery": // Two desks, a chair, a table.
      return [
        make("desk", -4, 0, 0),
        make("desk", 4, 0, 0, Math.PI),
        make("chair", 0, 0, 1),
        make("table", 0, 0, 2.5),
      ];
    case "hotel-lobby": // Two benches, one vitrine.
      return [
        make("bench", -5, 0, 2),
        make("bench", 5, 0, 2),
        make("vitrine", 0, 0, -4),
      ];
    case "art-fair-booth": // One wall, one plinth, one track rail.
      return [
        make("partition", 0, 0, -1, Math.PI / 2, { length: 4 }),
        make("plinth", 2.5, 0, 1),
        make("track-light", 0, height - 0.4, 0),
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
