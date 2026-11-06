import { z } from "zod";

// Every placeable object in the Elements palette. The first seven are the
// core set; the rest come from Kabeya's reference photos of real galleries
// (movable partition walls on feet, long block bench, plinths, vitrine,
// ceiling track lights, display shelves, desk & chair, sheer curtains),
// plus the architectural pieces (column, low stage, stairs, doorway
// arch) added for the 3D builder.
export const elementTypes = [
  "partition",
  "chair",
  "bench",
  "table",
  "door",
  "window",
  "wall-text",
  "plinth",
  "vitrine",
  "track-light",
  "shelf",
  "desk",
  "curtain",
  "column",
  "platform",
  "stairs",
  "arch",
] as const;

export type ElementType = (typeof elementTypes)[number];

// Where an element lives and how it is dragged in the 3D view:
// - floor: stands on the floor, dragged on the horizontal floor plane.
// - wall: hangs on a wall, dragged along the wall plane.
// - ceiling: hangs from the ceiling, dragged on a horizontal plane at its height.
export const ELEMENT_PLANES: Record<ElementType, "floor" | "wall" | "ceiling"> = {
  partition: "floor",
  chair: "floor",
  bench: "floor",
  table: "floor",
  door: "wall",
  window: "wall",
  "wall-text": "wall",
  plinth: "floor",
  vitrine: "floor",
  "track-light": "ceiling",
  shelf: "wall",
  desk: "floor",
  curtain: "wall",
  column: "floor",
  platform: "floor",
  stairs: "floor",
  arch: "floor",
};

export const roomElementSchema = z.object({
  id: z.string().min(1).max(64),
  type: z.enum(elementTypes),
  name: z.string().trim().min(1).max(60),
  // Which room template seeded this element (e.g. "partition-hall").
  // Absent for elements the user added by hand, so a layout switch can
  // swap the seeded furniture without touching the user's own pieces.
  seededFrom: z.string().max(32).optional(),
  x: z.number().min(-20).max(20),
  y: z.number().min(0).max(10),
  z: z.number().min(-20).max(20),
  rotation: z.number().finite().min(-Math.PI * 8).max(Math.PI * 8).default(0),
  scale: z.number().finite().min(0.25).max(3).default(1),
  color: z.string().regex(/^#[\da-f]{6}$/i).default("#f5f2eb"),
  // Meaning depends on the type: partition panel length, shelf width,
  // track-light rail length (metres). Ignored by the other types.
  length: z.number().min(0.5).max(12).default(4),
  // Per-type option: plinth height ("low" | "standard" | "tall").
  variant: z.string().max(32).default("standard"),
  // Wall text content (only the "wall-text" type uses these).
  title: z.string().max(120).default(""),
  body: z.string().max(600).default(""),
  // Title size (metres, cap height roughly 0.7x this) and body size.
  fontSize: z.number().min(0.05).max(1).default(0.35),
  textColor: z.string().regex(/^#[\da-f]{6}$/i).default("#b3261e"),
  // Wall-text typography: typeface, alignment, layout, body size/colour.
  font: z.enum(["display", "sans", "serif", "mono"]).default("display"),
  align: z.enum(["left", "center", "right"]).default("left"),
  layout: z.enum(["stacked", "side", "block"]).default("stacked"),
  bodySize: z.number().min(0.02).max(0.5).default(0.11),
  bodyColor: z.string().regex(/^#[\da-f]{6}$/i).default("#3a3a36"),
  // Layers & grouping (3D builder): a hidden element is not rendered in
  // the 3D view, a locked element cannot be dragged, and elements sharing
  // a groupId move together. These fields live on the element, so they
  // travel with the rooms JSON through the exhibition save — no schema
  // change needed. They are optional (absent = visible / unlocked) so
  // rooms saved before them, and the template seeder in lib/rooms.ts,
  // keep validating unchanged. Artworks carry the same three fields in
  // the editor (see components/editor.tsx); the artwork table has no
  // columns for them, so theirs persist through the version-history
  // snapshot instead.
  hidden: z.boolean().optional(),
  locked: z.boolean().optional(),
  groupId: z.string().max(64).optional(),
});

export type RoomElement = z.infer<typeof roomElementSchema>;

// Plinth heights (metres) by variant — the white display cubes in the
// reference photos come in several heights.
export const PLINTH_HEIGHTS: Record<string, number> = {
  low: 0.6,
  standard: 0.9,
  tall: 1.2,
};

export const PLINTH_VARIANTS = [
  { value: "low", label: "Low · 60 cm" },
  { value: "standard", label: "Standard · 90 cm" },
  { value: "tall", label: "Tall · 120 cm" },
] as const;

// Wall-text typefaces. The families are the ones the site already loads
// (DM Sans / Fraunces via next/font) plus a system monospace; troika
// resolves them by family name through document.fonts. "Display" is the
// heavy grotesque of the "PEOPLE MAKE THIS PLACE" reference photo.
export const WALL_TEXT_FONTS = {
  display: { label: "Display · bold", family: "DM Sans", weight: 700, letterSpacing: -0.02 },
  sans: { label: "Clean sans", family: "DM Sans", weight: 400, letterSpacing: 0 },
  serif: { label: "Serif", family: "Fraunces", weight: 600, letterSpacing: 0 },
  mono: { label: "Typewriter", family: "Courier New", weight: 700, letterSpacing: 0 },
} as const;
export type WallTextFont = keyof typeof WALL_TEXT_FONTS;

export const WALL_TEXT_ALIGNS = {
  left: "Left",
  center: "Centre",
  right: "Right",
} as const;
export type WallTextAlign = keyof typeof WALL_TEXT_ALIGNS;

export const WALL_TEXT_LAYOUTS = {
  stacked: "Stacked title, text below",
  side: "Title left, text right",
  block: "One block, text below",
} as const;
export type WallTextLayout = keyof typeof WALL_TEXT_LAYOUTS;

// Title-colour presets — the strong red is the "PEOPLE MAKE THIS PLACE" look.
export const WALL_TEXT_SWATCHES = ["#b3261e", "#252722", "#f5f2eb", "#a67c37", "#1d4e89", "#3a3a36"];

type ElementDefaults = {
  label: string;
  color: string;
  length: number;
  y: number;
  // Distance from the back wall when the element is wall-mounted.
  wallOffset: number;
};

export const ELEMENT_DEFAULTS: Record<ElementType, ElementDefaults> = {
  partition: { label: "Partition wall", color: "#f5f2eb", length: 4, y: 0, wallOffset: 0 },
  chair: { label: "Chair", color: "#8a6a45", length: 1, y: 0, wallOffset: 0 },
  bench: { label: "Long bench", color: "#f5f2eb", length: 1, y: 0, wallOffset: 0 },
  table: { label: "Table", color: "#f5f2eb", length: 1, y: 0, wallOffset: 0 },
  door: { label: "Door", color: "#8a6a45", length: 1, y: 0, wallOffset: 0.15 },
  window: { label: "Window", color: "#f5f2eb", length: 1, y: 1.8, wallOffset: 0.16 },
  "wall-text": { label: "Wall text", color: "#f5f2eb", length: 4, y: 2.2, wallOffset: 0.16 },
  plinth: { label: "Plinth", color: "#f5f2eb", length: 1, y: 0, wallOffset: 0 },
  vitrine: { label: "Display case", color: "#f5f2eb", length: 1, y: 0, wallOffset: 0 },
  "track-light": { label: "Track light", color: "#fff0d6", length: 3, y: 0, wallOffset: 0 },
  shelf: { label: "Display shelf", color: "#f5f2eb", length: 2, y: 1.7, wallOffset: 0.2 },
  desk: { label: "Desk & chair", color: "#8a6a45", length: 1, y: 0, wallOffset: 0 },
  curtain: { label: "Sheer curtain", color: "#ffffff", length: 2.4, y: 0, wallOffset: 0.16 },
  column: { label: "Column", color: "#f5f2eb", length: 1, y: 0, wallOffset: 0 },
  platform: { label: "Platform · low stage", color: "#e8e4da", length: 3, y: 0, wallOffset: 0 },
  stairs: { label: "Stairs", color: "#f5f2eb", length: 2, y: 0, wallOffset: 0 },
  arch: { label: "Arch · doorway", color: "#f5f2eb", length: 2, y: 0, wallOffset: 0 },
};

// A new element, placed sensibly for its type: floor pieces near the
// centre of the room, wall pieces against the back wall, the track light
// just under the ceiling. `number` is the count of this type already in
// the room, so names stay unique ("Chair 1", "Chair 2", ...). Room
// dimensions are passed in so this file never imports the room presets.
export function createElement(
  type: ElementType,
  dims: { width: number; depth: number; height: number },
  number: number,
): RoomElement {
  const { width, depth, height } = dims;
  const defaults = ELEMENT_DEFAULTS[type];
  const plane = ELEMENT_PLANES[type];
  const spread = (number % 3) - 1; // -1, 0, 1: stagger repeat additions
  const x = plane === "floor" ? spread * Math.min(3, width / 4) : spread * 1.5;
  const z = plane === "wall" ? -depth / 2 + defaults.wallOffset : plane === "ceiling" ? 0 : spread * 1.2;
  const y = type === "track-light" ? Math.max(2.5, height - 0.4) : defaults.y;
  return {
    id: crypto.randomUUID(),
    type,
    name: `${defaults.label} ${number + 1}`,
    x: Math.round(x * 100) / 100,
    y,
    z: Math.round(z * 100) / 100,
    rotation: 0,
    scale: 1,
    color: defaults.color,
    length: defaults.length,
    variant: "standard",
    // A new wall text starts as a big bold red stacked title, like the
    // "PEOPLE MAKE THIS PLACE" reference photo; the user edits it all.
    title: type === "wall-text" ? "Exhibition\nTitle" : "",
    body: type === "wall-text" ? "Write the text visitors will read on this wall." : "",
    fontSize: type === "wall-text" ? 0.35 : 0.22,
    textColor: type === "wall-text" ? "#b3261e" : "#252722",
    font: "display",
    align: "left",
    layout: "stacked",
    bodySize: 0.11,
    bodyColor: "#3a3a36",
    hidden: false,
    locked: false,
    groupId: undefined,
  };
}
