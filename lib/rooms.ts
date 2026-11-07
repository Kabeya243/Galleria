import { z } from "zod";
import { CEILING_FINISH_KEYS, FLOOR_PATTERN_KEYS } from "@/lib/editor-params";
import { ELEMENT_DEFAULTS, roomElementSchema, type ElementType, type RoomElement } from "@/lib/elements";
import { SUNLIGHT_CEILING_COLOR, SUNLIGHT_FLOOR_CENTER_Z, SUNLIGHT_FLOOR_COLOR, SUNLIGHT_HEIGHT, SUNLIGHT_WALL_COLOR } from "@/lib/sunlight";
import { sunlightElementSchema } from "@/lib/sunlight-elements";

// Template categories for the galleries catalogue. Every preset belongs
// to exactly one category, shown as a filter chip on the galleries page.
// All twenty-one templates are architectural.
export const roomCategories = [
  "Architectural",
] as const;

export type RoomCategory = (typeof roomCategories)[number];

// The gallery collection: the Sunlight Gallery (ported exactly from
// Kabeya's Three.js reference room "Galerie lumière") plus the nine
// galleries from his six reference files, added in November 2026, plus
// the eleven galleries from Galeries_3D.html, added the same month —
// each ported exactly as designed (dimensions, walls, floor, light,
// panels, furniture), with its own creative name. The old templates
// (White Cube, Grand Light Hall, Totem Studio, Glass Pavilion,
// Skylight Gallery, Stone Gallery and its halves) were removed in
// November 2026; their layout keys are migrated to Sunlight on load
// (see parseGalleryRooms), so exhibitions saved with one still open —
// with their artworks — instead of failing validation.
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
    descriptionFr: "Grande salle lumineuse de 22 × 26 m sous sept verrières — lumière du jour, sol béton et panneaux autoportants, d'après une salle de référence Three.js.",
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
    // Room-local z of the floor centre (the Sunlight floor spans
    // z −14…12, centre −1): navigation bounds, drag clamps and the
    // minimap all read it instead of assuming a room centred on 0.
    floorCenterZ: SUNLIGHT_FLOOR_CENTER_Z,
    // Which distinctive feature the catalogue card's thumbnail draws.
    thumbnail: "sunlight",
  },
  // La Serpentine — the outdoor serpentine art fair: four curved white
  // walls in an S, photographs on both faces, a stone plaza and a grey
  // carpet, mall facades around. 22 × 44 m of carpet, wall height 2.7 m.
  serpentine: {
    label: "The Serpentine",
    category: "Architectural",
    description: "An open-air art fair — four curved white serpentine walls under the sky, photographs on both faces, a stone plaza and a grey carpet.",
    descriptionFr: "Foire en plein air — quatre murs blancs serpentins sous le ciel, photos sur les deux faces, place en pierre et moquette grise.",
    width: 22,
    depth: 44,
    height: 2.7,
    wallColor: "#f8f8f6",
    sideWallColor: "#f8f8f6",
    floorColor: "#6f7176",
    wallTexture: "plaster",
    floorTexture: "stone",
    ceilingColor: "#bcd6ee",
    ceilingTexture: "plaster",
    spotlights: false,
    lightType: "sunlight",
    partitions: [],
    floorCenterZ: -2,
    thumbnail: "serpentine",
  },
  // La Vitrine — the EXHIBIT gallery: a brick facade with the "exhibit"
  // sign, a glass front with mullions, a 16 × 16 m white interior shell
  // with a concrete floor, pedestals, shelves and a desk.
  vitrine: {
    label: "The Vitrine",
    category: "Architectural",
    description: "A bright glass-front gallery — a brick facade with its “exhibit” sign, a glazed front, a concrete floor, pedestals and shelves.",
    descriptionFr: "Galerie à façade vitrée — façade brique avec son enseigne « exhibit », devanture vitrée, sol béton, socles et étagères.",
    width: 16,
    depth: 16,
    height: 4,
    wallColor: "#f5f4f0",
    sideWallColor: "#f5f4f0",
    floorColor: "#c4c0b8",
    wallTexture: "plaster",
    floorTexture: "concrete",
    ceilingColor: "#fafaf8",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "sunlight",
    partitions: [],
    floorCenterZ: -6,
    thumbnail: "vitrine",
  },
  // Le Loft Béton — the dark concrete loft: concrete floor and ceiling
  // with beams, white walls, rails and spotlights, bold colour on the
  // walls. 18 × 20 m, 4.3 m high.
  loft: {
    label: "The Concrete Loft",
    category: "Architectural",
    description: "A dark concrete loft — beams, rails and spotlights, bold colour on white walls, a partition and a bench.",
    descriptionFr: "Loft sombre en béton — poutres, rails et spots, couleurs franches sur murs blancs, cloison et banc.",
    width: 18,
    depth: 20,
    height: 4.3,
    wallColor: "#f4f2ee",
    sideWallColor: "#f4f2ee",
    floorColor: "#a8a399",
    wallTexture: "plaster",
    floorTexture: "concrete",
    ceilingColor: "#8f8a80",
    ceilingTexture: "concrete",
    spotlights: true,
    lightType: "sunlight",
    partitions: [],
    floorCenterZ: -2,
    thumbnail: "loft",
  },
  // La Halle Design — the big design hall: 25 × 34 m, 8.2 m high, grey
  // carpet, a glass curtain wall with blinds, zigzag folding screens
  // with works on both sides, platforms, lounge furniture, glass
  // cases, a hanging faceted mobile and kites.
  halle: {
    label: "The Design Hall",
    category: "Architectural",
    description: "A 25 × 34 m design hall — zigzag folding screens, platforms and lounge furniture, a hanging faceted mobile and kites.",
    descriptionFr: "Grande halle design 25 × 34 m — paravents pliants en zigzag, plateformes et mobilier lounge, mobile suspendu à facettes et cerfs-volants.",
    width: 25,
    depth: 34,
    height: 8.2,
    wallColor: "#efede8",
    sideWallColor: "#efede8",
    floorColor: "#7b7976",
    wallTexture: "plaster",
    floorTexture: "stone",
    ceilingColor: "#f3f1ed",
    ceilingTexture: "plaster",
    spotlights: false,
    lightType: "sunlight",
    partitions: [],
    floorCenterZ: 0,
    thumbnail: "halle",
  },
  // L'Arche — the stone gallery (SANAA's original Stone Gallery):
  // 20 × 24 m, 6.5 m high, stone/plaster walls, a dividing wall with a
  // round arch, a niche, rubble, timber beams and track lights.
  arche: {
    label: "The Arch",
    category: "Architectural",
    description: "A stone gallery — a round-arch dividing wall, a niche, rubble and timber beams. The original Stone Gallery.",
    descriptionFr: "Galerie en pierre — mur de séparation à arche ronde, niche, gravats et poutres en bois. La Galerie en Pierre d'origine.",
    width: 20,
    depth: 24,
    height: 6.5,
    wallColor: "#b8ab94",
    sideWallColor: "#b8ab94",
    floorColor: "#b5b0a5",
    wallTexture: "stone-plaster",
    floorTexture: "stone-concrete",
    ceilingColor: "#d8d2c4",
    ceilingTexture: "plaster",
    spotlights: false,
    lightType: "sunlight",
    partitions: [],
    floorCenterZ: -3,
    thumbnail: "arche",
  },
  // Le Musée Bleu — the museum room: a curved blue wall, a coffered
  // skylight, herringbone parquet 40 × 40 m, angled panels and wire
  // benches.
  musee: {
    label: "The Blue Museum",
    category: "Architectural",
    description: "A museum room — a curved blue wall, a coffered skylight, herringbone parquet and angled panels.",
    descriptionFr: "Salle de musée — mur bleu courbe, verrière en caissons, parquet chevrons et panneaux inclinés.",
    width: 40,
    depth: 40,
    height: 6.5,
    wallColor: "#cbc7c1",
    sideWallColor: "#cbc7c1",
    floorColor: "#b98a5e",
    wallTexture: "plaster",
    floorTexture: "parquet",
    ceilingColor: "#f6f4f0",
    ceilingTexture: "plaster",
    spotlights: false,
    lightType: "sunlight",
    partitions: [],
    floorCenterZ: 0,
    thumbnail: "musee",
  },
  // La Claire-Voie — the gallery with the dark floor, white benches, a
  // huge folk painting, a wall of text vinyl and a high clerestory
  // window. 11 × 23 m, 7.6 m high.
  "claire-voie": {
    label: "The Clerestory",
    category: "Architectural",
    description: "A dark-floored gallery — a huge folk painting, a wall of text vinyl, white benches and a high clerestory window.",
    descriptionFr: "Galerie au sol sombre — immense peinture folk, mur de vinyle texte, bancs blancs et haute fenêtre claire-voie.",
    width: 11,
    depth: 23,
    height: 7.6,
    wallColor: "#f1efea",
    sideWallColor: "#f1efea",
    floorColor: "#3e4044",
    wallTexture: "plaster",
    floorTexture: "stone",
    ceilingColor: "#f6f4f0",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "sunlight",
    partitions: [],
    floorCenterZ: -1.5,
    thumbnail: "claire-voie",
  },
  // Le Parquet — the herringbone-parquet room: 24 × 23 m, 7.2 m high,
  // V-shaped partitions with a wooden lintel, foreground wall
  // fragments, pedestals with sculptures, a standing mobile, a pale
  // green ottoman and a salon hang on the back wall.
  parquet: {
    label: "The Parquet",
    category: "Architectural",
    description: "A herringbone-parquet room — V-shaped partitions, pedestals with sculptures, a standing mobile and a salon hang.",
    descriptionFr: "Salle au parquet chevrons — cloisons en V, socles avec sculptures, mobile debout et accrochage salon.",
    width: 24,
    depth: 23,
    height: 7.2,
    wallColor: "#f3f1ec",
    sideWallColor: "#f3f1ec",
    floorColor: "#a9805a",
    wallTexture: "plaster",
    floorTexture: "parquet",
    ceilingColor: "#f6f4f0",
    ceilingTexture: "plaster",
    spotlights: false,
    lightType: "sunlight",
    partitions: [],
    floorCenterZ: 0.5,
    thumbnail: "parquet",
  },
  // La Verrière — the virtual gallery: 40 × 32 m, 7.5 m high, a wood
  // plank floor, a coffered ceiling with skylights, a stone/window band
  // at the back and five angled panels with paintings.
  verriere: {
    label: "The Glass Roof",
    category: "Architectural",
    description: "A 40 × 32 m hall under a coffered skylight ceiling — five angled panels with paintings, a bench and a label stand.",
    descriptionFr: "Grande halle 40 × 32 m sous plafond à caissons et verrières — cinq panneaux inclinés avec peintures, banc et pupitre d'étiquette.",
    width: 40,
    depth: 32,
    height: 7.5,
    wallColor: "#f6f5f2",
    sideWallColor: "#f6f5f2",
    floorColor: "#c9a877",
    wallTexture: "plaster",
    floorTexture: "wood",
    ceilingColor: "#a09590",
    ceilingTexture: "plaster",
    spotlights: false,
    lightType: "sunlight",
    partitions: [],
    floorCenterZ: -4,
    thumbnail: "verriere",
  },
  // Pavillon de lumière — the light pavilion: an 8 × 14 m wood pavilion
  // with glass-brick walls, two side rooms, a lawn and palm trees
  // outside. Floor centre z = −1.
  pavillon: {
    label: "Pavilion of Light",
    category: "Architectural",
    description: "A light pavilion — wood floor, glass-brick walls, two side rooms, palms and a lawn outside.",
    descriptionFr: "Pavillon lumineux — sol bois, murs en briques de verre, deux salles latérales, palmiers et pelouse dehors.",
    width: 8,
    depth: 14,
    height: 4.2,
    wallColor: "#f8f8f6",
    sideWallColor: "#f8f8f6",
    floorColor: "#d4b48a",
    wallTexture: "plaster",
    floorTexture: "wood",
    ceilingColor: "#e4e3de",
    ceilingTexture: "plaster",
    spotlights: false,
    lightType: "sunlight",
    partitions: [],
    floorCenterZ: -1,
    thumbnail: "pavillon",
  },
  // Galerie classique — the classical gallery: an 8 × 40 m hall under
  // a coffered vault, granite columns, skylights in the vault.
  classique: {
    label: "The Classical Gallery",
    category: "Architectural",
    description: "A classical gallery — an 8 × 40 m hall under a coffered vault, granite columns, skylights above.",
    descriptionFr: "Galerie classique — salle 8 × 40 m sous voûte à caissons, colonnes de granit, verrières dans la voûte.",
    width: 8,
    depth: 40,
    height: 10.2,
    wallColor: "#cfc8b8",
    sideWallColor: "#cfc8b8",
    floorColor: "#8a857c",
    wallTexture: "plaster",
    floorTexture: "stone",
    ceilingColor: "#e6e1d6",
    ceilingTexture: "plaster",
    spotlights: false,
    lightType: "sunlight",
    partitions: [],
    floorCenterZ: 0,
    thumbnail: "classique",
  },
  // Atrium blanc — the white atrium: a 26 × 27 m lacquered marble hall,
  // four columns, a black drum suspended from the ceiling.
  "atrium-blanc": {
    label: "The White Atrium",
    category: "Architectural",
    description: "A white atrium — lacquered marble floor, four columns, a black drum suspended overhead.",
    descriptionFr: "Atrium blanc — sol laqué marbre, quatre colonnes, tambour noir suspendu au plafond.",
    width: 26,
    depth: 27,
    height: 9,
    wallColor: "#f7f7f6",
    sideWallColor: "#f7f7f6",
    floorColor: "#f6f6f5",
    wallTexture: "plaster",
    floorTexture: "marble",
    ceilingColor: "#f7f7f6",
    ceilingTexture: "plaster",
    spotlights: false,
    lightType: "sunlight",
    partitions: [],
    floorCenterZ: -0.5,
    thumbnail: "atrium-blanc",
  },
  // Patio ovale — the oval patio: a 44 × 44 m marble plaza under a roof
  // pierced by an oval opening, trees, black gravel and a lawn.
  patio: {
    label: "The Oval Patio",
    category: "Architectural",
    description: "An oval patio — a marble plaza under a roof pierced by an oval opening, trees, black gravel and a lawn.",
    descriptionFr: "Patio ovale — place de marbre sous une toiture percée d'un ovale, arbres, gravier noir et pelouse.",
    width: 44,
    depth: 44,
    height: 4.5,
    wallColor: "#f0f0ee",
    sideWallColor: "#f0f0ee",
    floorColor: "#ffffff",
    wallTexture: "plaster",
    floorTexture: "marble",
    ceilingColor: "#dedee0",
    ceilingTexture: "plaster",
    spotlights: false,
    lightType: "sunlight",
    partitions: [],
    floorCenterZ: 0,
    thumbnail: "patio",
  },
  // Hall à escalier — the stair hall: a 16 × 20 m hall with a 14-step
  // staircase, a central column, a mezzanine and glass.
  escalier: {
    label: "The Stair Hall",
    category: "Architectural",
    description: "A stair hall — 16 × 20 m, a 14-step staircase, a central column, a mezzanine and glass.",
    descriptionFr: "Hall à escalier — 16 × 20 m, escalier de 14 marches, colonne centrale, mezzanine et verre.",
    width: 16,
    depth: 20,
    height: 9,
    wallColor: "#f6f6f4",
    sideWallColor: "#f6f6f4",
    floorColor: "#6d7078",
    wallTexture: "plaster",
    floorTexture: "concrete",
    ceilingColor: "#f6f6f4",
    ceilingTexture: "plaster",
    spotlights: false,
    lightType: "sunlight",
    partitions: [],
    floorCenterZ: 0,
    thumbnail: "escalier",
  },
  // Salles vertes — the green rooms: a 14 × 32 m hall, green walls, wood
  // floor, a vault, three panels, two benches and a skylight.
  "salles-vertes": {
    label: "The Green Rooms",
    category: "Architectural",
    description: "Green rooms — a 14 × 32 m hall, green walls, wood floor, a vault, three panels and a skylight.",
    descriptionFr: "Salles vertes — hall 14 × 32 m, murs verts, parquet bois, voûte, trois panneaux, deux bancs et verrière.",
    width: 14,
    depth: 32,
    height: 6.5,
    wallColor: "#3d6b5e",
    sideWallColor: "#3d6b5e",
    floorColor: "#d4b48a",
    wallTexture: "plaster",
    floorTexture: "wood",
    ceilingColor: "#e6e1d6",
    ceilingTexture: "plaster",
    spotlights: false,
    lightType: "sunlight",
    partitions: [],
    floorCenterZ: 0,
    thumbnail: "salles-vertes",
  },
  // Elegant Gallery (ex Couloir sombre) — the night gallery: a
  // 7 × 46 m hall, herringbone parquet, a vault, six panels, arches
  // and warm track spots. The internal key stays "couloir-sombre"
  // (URLs, thumbnails, plan); only the displayed name changed.
  "couloir-sombre": {
    label: "Elegant Gallery",
    category: "Architectural",
    description: "An elegant night gallery — a 7 × 46 m hall, herringbone parquet, a vault, six panels, arches and warm track spots. After dark, each painting glows under its own light.",
    descriptionFr: "Galerie élégante de nuit — hall 7 × 46 m, parquet chevrons, voûte, six panneaux, arches et spots chauds. La nuit, chaque tableau s'éclaire sous son propre projecteur.",
    width: 7,
    depth: 46,
    height: 5,
    wallColor: "#453e38",
    sideWallColor: "#453e38",
    floorColor: "#8a6a3a",
    wallTexture: "plaster",
    floorTexture: "parquet",
    ceilingColor: "#e6e1d6",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "spot-warm",
    partitions: [],
    floorCenterZ: 0,
    thumbnail: "couloir-sombre",
  },
  // Couloir doré — the golden corridor: a 7 × 46 m hall, herringbone
  // parquet, luminous arched windows, a red wall at the far end and
  // sun patches on the floor.
  "couloir-dore": {
    label: "The Golden Corridor",
    category: "Architectural",
    description: "A golden corridor — a 7 × 46 m hall, herringbone parquet, luminous arched windows and a red end wall.",
    descriptionFr: "Couloir doré — hall 7 × 46 m, parquet chevrons, fenêtres en arche lumineuses, mur rouge au fond et taches de soleil au sol.",
    width: 7,
    depth: 46,
    height: 5.6,
    wallColor: "#f3efe6",
    sideWallColor: "#f3efe6",
    floorColor: "#c9a877",
    wallTexture: "plaster",
    floorTexture: "parquet",
    ceilingColor: "#f6f2ea",
    ceilingTexture: "plaster",
    spotlights: true,
    lightType: "spot-warm",
    partitions: [],
    floorCenterZ: 0,
    thumbnail: "couloir-dore",
  },
  // Plafond à voûtes — the vaulted ceiling: a 10 × 30 m hall, wood
  // floor, a scale-pattern ceiling, two panels and two benches.
  voutes: {
    label: "The Vaulted Ceiling",
    category: "Architectural",
    description: "A vaulted ceiling — a 10 × 30 m hall, wood floor, a scale-pattern ceiling, two panels and two benches.",
    descriptionFr: "Plafond à voûtes — hall 10 × 30 m, parquet bois, plafond à écailles, deux panneaux et deux bancs.",
    width: 10,
    depth: 30,
    height: 7,
    wallColor: "#f8f8f6",
    sideWallColor: "#f8f8f6",
    floorColor: "#d4b48a",
    wallTexture: "plaster",
    floorTexture: "wood",
    ceilingColor: "#ffffff",
    ceilingTexture: "plaster",
    spotlights: false,
    lightType: "sunlight",
    partitions: [],
    floorCenterZ: 0,
    thumbnail: "voutes",
  },
  // Courbes blanches — the white curves: a circular gallery (R 12.5,
  // H 6.5), a curved white wall, a glazed section, a roof, palms and
  // a lawn outside.
  courbes: {
    label: "White Curves",
    category: "Architectural",
    description: "White curves — a circular gallery, a curved white wall, a glazed section, palms and a lawn outside.",
    descriptionFr: "Courbes blanches — galerie circulaire, mur courbe blanc, section vitrée, palmiers et pelouse dehors.",
    width: 25,
    depth: 25,
    height: 6.5,
    wallColor: "#f4f4f2",
    sideWallColor: "#f4f4f2",
    floorColor: "#24272b",
    wallTexture: "plaster",
    floorTexture: "stone",
    ceilingColor: "#f4f4f2",
    ceilingTexture: "plaster",
    spotlights: false,
    lightType: "sunlight",
    partitions: [],
    floorCenterZ: 0,
    thumbnail: "courbes",
  },
  // Atrium à lattes — the slatted atrium: 14 × 12 × 18 m, slatted walls,
  // wood floor, a large window onto the outside, mullions, a mezzanine
  // and staircases.
  "atrium-lattes": {
    label: "The Slatted Atrium",
    category: "Architectural",
    description: "A slatted atrium — 14 × 18 m, slatted walls, wood floor, a large window, a mezzanine and staircases.",
    descriptionFr: "Atrium à lattes — 14 × 18 m, murs à lattes, parquet bois, grande fenêtre sur l'extérieur, mezzanine et escaliers.",
    width: 14,
    depth: 18,
    height: 12,
    wallColor: "#f8f8f6",
    sideWallColor: "#f8f8f6",
    floorColor: "#d4b48a",
    wallTexture: "plaster",
    floorTexture: "wood",
    ceilingColor: "#f8f8f6",
    ceilingTexture: "plaster",
    spotlights: false,
    lightType: "sunlight",
    partitions: [],
    floorCenterZ: 0,
    thumbnail: "atrium-lattes",
  },
} as const;

export type RoomLayout = keyof typeof roomLayouts;

// The room models offered when an exhibition is created (feature 7).
// Labels live in the i18n dictionary (`create.model*`); the layout
// label is the room's own. Sunlight Gallery stays first — it is the
// default model.
export const ROOM_MODELS = [
  { id: "sunlight", layout: "sunlight" },
  { id: "serpentine", layout: "serpentine" },
  { id: "vitrine", layout: "vitrine" },
  { id: "loft", layout: "loft" },
  { id: "halle", layout: "halle" },
  { id: "arche", layout: "arche" },
  { id: "musee", layout: "musee" },
  { id: "claire-voie", layout: "claire-voie" },
  { id: "parquet", layout: "parquet" },
  { id: "verriere", layout: "verriere" },
  { id: "pavillon", layout: "pavillon" },
  { id: "classique", layout: "classique" },
  { id: "atrium-blanc", layout: "atrium-blanc" },
  { id: "patio", layout: "patio" },
  { id: "escalier", layout: "escalier" },
  { id: "salles-vertes", layout: "salles-vertes" },
  { id: "couloir-sombre", layout: "couloir-sombre" },
  { id: "couloir-dore", layout: "couloir-dore" },
  { id: "voutes", layout: "voutes" },
  { id: "courbes", layout: "courbes" },
  { id: "atrium-lattes", layout: "atrium-lattes" },
] as const;

export type RoomModelId = (typeof ROOM_MODELS)[number]["id"];

export function roomModelLayout(modelId: string): RoomLayout {
  const model = ROOM_MODELS.find((candidate) => candidate.id === modelId);
  return (model?.layout ?? "sunlight") as RoomLayout;
}

// No layout is hidden: all twenty-one templates are offered. (Kept as a set
// so the catalogue filter and the editor's layout picker keep working
// unchanged.)
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
// French labels for the finish names shown in the catalogue's
// finishes line (and anywhere a texture name is displayed).
export const wallTexturesFr = {
  plaster: "Plâtre",
  concrete: "Béton",
  brick: "Brique",
  marble: "Marbre",
  "stone-plaster": "Enduit pierre",
} as const;

export const floorTexturesFr = {
  stone: "Pierre",
  concrete: "Béton",
  wood: "Bois",
  marble: "Marbre",
  "stone-concrete": "Béton pierre",
  parquet: "Parquet · vrai bois",
} as const;

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
  // Ceiling finish (Claude's CF table): one choice sets the ceiling
  // colour AND roughness together, and syncs the ceiling colour
  // picker. The roughness is stored alongside so the 3D slab reads it.
  ceilingFinish: z.enum(CEILING_FINISH_KEYS).default("blanc"),
  ceilingRoughness: z.number().min(0).max(1).default(0.95),
  // Hide the ceiling (the "Masquer le plafond" checkbox, and the
  // High / Plan camera views, which hide it to look in from above).
  ceilingHidden: z.boolean().default(false),
  // Floor pattern (Claude's fpat): procedurally generated parquet,
  // herringbone or checkerboard instead of the room's own floor.
  // "original" keeps the room's floor. A non-original pattern resets
  // the floor colour to white, so the pattern reads true.
  floorPattern: z.enum(FLOOR_PATTERN_KEYS).default("original"),
  // Floor shine (0–95, default 70): floor roughness = 1 − shine / 100.
  floorShine: z.number().min(0).max(95).default(70),
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
  // Sunlight 3D elements — the reference room's own addable pieces
  // (cloison, suspendu, colonne, socles, vitrine, banc, fauteuils,
  // spotlights). Separate from the Asset Library `elements` above:
  // both systems coexist. Saved with the room, restored on load.
  sunlightElements: z.array(sunlightElementSchema).max(24).default([]),
  // The room's template artworks have been seeded as real artworks
  // (lib/template-artworks.ts): the shell then hides its baked
  // paintings so they never show twice. False for rooms created
  // before seeding existed — the editor seeds them once on load.
  templateArtSeeded: z.boolean().default(false),
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
    ceilingFinish: "blanc",
    ceilingRoughness: 0.95,
    ceilingHidden: false,
    floorPattern: "original",
    floorShine: 70,
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
      ceilingFinish: "blanc",
      ceilingRoughness: 0.95,
      ceilingHidden: false,
      floorPattern: "original",
      floorShine: 70,
      spotlights: roomLayouts[layout].spotlights,
      partitionWalls: [],
      curatorialText: "",
      floorType: inferFloorType(roomLayouts[layout].floorTexture, roomLayouts[layout].floorColor),
      lightType: roomLayouts[layout].lightType,
      wallPaint: {},
      elements: [],
      sunlightElements: [],
      templateArtSeeded: false,
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
        if (!Array.isArray(next.sunlightElements)) next.sunlightElements = [];
        return next;
      })
    : raw;
  const parsed = z.array(galleryRoomSchema).max(12).parse(migrated);
  return parsed.length ? parsed : [createGalleryRoom()];
}
