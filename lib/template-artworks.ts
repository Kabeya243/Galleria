// Template artworks — the demo paintings baked into the generic room
// shells (components/gallery-rooms.tsx), as REAL artworks, so the
// editor can select each one, change its title, replace its image,
// move/resize it or delete it, exactly like an artwork the owner
// hangs by hand. This is the Sunlight pattern (seedSunlightArtworks
// in lib/rooms.ts), extended to every gallery whose shell hangs
// framed paintings.
//
// Each seed copies the baked call's position, size and rotation
// (x, y, z, ry, w, h) and hangs the FROZEN image of the procedural
// painting (public/artworks/template/, rendered once from the same
// painter — the shell's live texture is random per load, so the
// frozen file is one variant of it). The Arche reuses the bundled
// stone-gallery files, the same kinds its shell paints.
//
// NOT converted, by design: the Serpentine's 48 photos
// (buildSerpentine, hangPhoto) are the wall itself — a curved
// photo-wall positioned by arc math, not framed pieces on flat
// walls — so they stay fixed parts of the room. See the report.
//
// A room shows either the baked paintings (templateArtSeeded false,
// rooms created before this change) or the seeded rows (true) —
// never both: buildGalleryShell hides the baked art once the room
// is seeded. The description below is the marker the editor uses
// to recognise a seeded row (e.g. when a layout switch swaps them).
import { seedSunlightArtworks, type RoomLayout } from "@/lib/rooms";

// The description every seeded template artwork carries.
export const TEMPLATE_ART_DESCRIPTION =
  "Template artwork from the gallery — replace it with your own work.";

// One seed = one Prisma Artwork create input (no id; the route and
// the editor add the id). Mirrors seedSunlightArtworks' shape.
export type TemplateArtworkSeed = {
  title: string;
  artist: string;
  year: string;
  medium: string;
  description: string;
  scale: number;
  frame: string;
  roomId: string;
  dimensions: string;
  color: string;
  accent: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotation: number;
  imageUrl: string;
};

type RawSeed = {
  title: string;
  x: number;
  y: number;
  z: number;
  ry: number;
  w: number;
  h: number;
  image: string;
  frame: string;
  color: string;
  accent: string;
};

const TPL = "/artworks/template";
const STONE = "/artworks/stone-gallery";

function toSeed(raw: RawSeed, roomId: string): TemplateArtworkSeed {
  return {
    title: raw.title,
    artist: "",
    year: "",
    medium: "Mixed media",
    description: TEMPLATE_ART_DESCRIPTION,
    scale: 1,
    frame: raw.frame,
    roomId,
    dimensions: `${Math.round(raw.w * 100)} × ${Math.round(raw.h * 100)} cm`,
    color: raw.color,
    accent: raw.accent,
    positionX: raw.x,
    positionY: raw.y,
    positionZ: raw.z,
    rotation: raw.ry,
    imageUrl: raw.image,
  };
}

// The hall11 rooms (Salles Vertes, Elegant Gallery, Couloir Doré,
// Voûtes) hang their frames from one formula (see hall11 in
// components/gallery-rooms.tsx): two side walls, pn frames per wall
// at z = L/2 − 5 − i·(L−10)/pn, x = ±(W/2 − 0.05), y 2.2, facing
// inward. The seeds follow the builder's loop order (left wall
// first, then right), so image N hangs on frame N.
function hall11Seeds(
  roomName: string,
  imagePrefix: string,
  opts: { W: number; L: number; pn: number; fw: number; fh: number; fc: string; color: string; accent: string },
): RawSeed[] {
  const hw = opts.W / 2;
  const st = (opts.L - 10) / opts.pn;
  const zs = Array.from({ length: opts.pn }, (_, i) => opts.L / 2 - 5 - i * st);
  const seeds: RawSeed[] = [];
  let n = 0;
  for (const s of [-1, 1] as const) {
    for (const z of zs) {
      n += 1;
      seeds.push({
        title: `${roomName} Painting ${n}`,
        x: s * (hw - 0.05),
        y: 2.2,
        z,
        ry: (-s * Math.PI) / 2,
        w: opts.fw,
        h: opts.fh,
        image: `${TPL}/${imagePrefix}-${n}.jpg`,
        frame: opts.fc,
        color: opts.color,
        accent: opts.accent,
      });
    }
  }
  return seeds;
}

// The seeded rows per layout, in the builder's call order. Rooms
// with no entry have no baked paintings (Halle, Musée, Claire-voie,
// Parquet, Verrière, Patio, Courbes, Atelier lattes) or keep theirs
// fixed by design (Serpentine).
const TEMPLATE_ARTWORKS: Partial<Record<RoomLayout, RawSeed[]>> = {
  // La Vitrine — buildVitrine, deuxHang (pink, dark), white frames.
  vitrine: [
    { title: "Vitrine Painting 1", x: -5, y: 1.9, z: -11.95, ry: 0, w: 3.2, h: 2.5, image: `${TPL}/vitrine-pink.jpg`, frame: "white", color: "#cfd6f0", accent: "#e86aa0" },
    { title: "Vitrine Painting 2", x: -0.2, y: 1.95, z: -11.95, ry: 0, w: 2.1, h: 2.8, image: `${TPL}/vitrine-dark.jpg`, frame: "white", color: "#2a1638", accent: "#c8662a" },
  ],
  // Le Loft Béton — buildLoft, deuxHang, black frames.
  loft: [
    { title: "Loft Painting 1", x: -8.93, y: 1.95, z: -1, ry: Math.PI / 2, w: 3.3, h: 2.7, image: `${TPL}/loft-yellow.jpg`, frame: "black", color: "#e6c765", accent: "#c9a54a" },
    { title: "Loft Painting 2", x: -1.5, y: 1.95, z: -3.88, ry: 0, w: 2.1, h: 3.3, image: `${TPL}/loft-tall.jpg`, frame: "black", color: "#2a3b88", accent: "#d8321e" },
    { title: "Loft Painting 3", x: -1.5, y: 1.9, z: -4.12, ry: Math.PI, w: 1.8, h: 2.3, image: `${TPL}/loft-orange-1.jpg`, frame: "black", color: "#d85a28", accent: "#f0b030" },
    { title: "Loft Painting 4", x: 8.93, y: 1.9, z: -6, ry: -Math.PI / 2, w: 3.1, h: 2.5, image: `${TPL}/loft-blk.jpg`, frame: "black", color: "#f0d060", accent: "#f4a8c0" },
    { title: "Loft Painting 5", x: -4.5, y: 1.9, z: -11.93, ry: 0, w: 2, h: 2.5, image: `${TPL}/loft-orange-2.jpg`, frame: "black", color: "#d85a28", accent: "#f0b030" },
  ],
  // L'Arche — buildArche, hang (pierreArt), dark-wood frames. The
  // images are the bundled stone-gallery files, the same kinds.
  arche: [
    { title: "Arche Painting 1", x: -9.9, y: 2.3, z: -2.5, ry: Math.PI / 2, w: 2.2, h: 2.6, image: `${STONE}/collage.jpg`, frame: "wood", color: "#cdb78f", accent: "#4a2f22" },
    { title: "Arche Painting 2", x: -6, y: 2.4, z: -3.6, ry: 0, w: 1.4, h: 2.6, image: `${STONE}/vivid.jpg`, frame: "wood", color: "#d9a23a", accent: "#b4361f" },
    { title: "Arche Painting 3", x: 6, y: 2.3, z: -3.6, ry: 0, w: 2.2, h: 1.7, image: `${STONE}/red.jpg`, frame: "wood", color: "#8b1c14", accent: "#d8581e" },
    { title: "Arche Painting 4", x: -3.4, y: 2.4, z: -14.9, ry: 0, w: 1.4, h: 2.6, image: `${STONE}/vivid.jpg`, frame: "wood", color: "#d9a23a", accent: "#b4361f" },
    { title: "Arche Painting 5", x: 0, y: 2.6, z: -14.9, ry: 0, w: 0.9, h: 1.5, image: `${STONE}/red.jpg`, frame: "wood", color: "#8b1c14", accent: "#d8581e" },
    { title: "Arche Painting 6", x: 5, y: 1.9, z: -14.85, ry: 0, w: 2, h: 1.5, image: `${STONE}/red.jpg`, frame: "wood", color: "#8b1c14", accent: "#d8581e" },
    { title: "Arche Painting 7", x: 9.9, y: 2.3, z: -8, ry: -Math.PI / 2, w: 1.6, h: 2.4, image: `${STONE}/vivid.jpg`, frame: "wood", color: "#d9a23a", accent: "#b4361f" },
  ],
  // Le Pavillon — buildPavillon, g11Frame on both side rooms.
  pavillon: [
    { title: "Pavillon Painting 1", x: -7.95, y: 1.7, z: -1, ry: Math.PI / 2, w: 1.1, h: 1.5, image: `${TPL}/pavillon-1.jpg`, frame: "wood", color: "#2a4fa0", accent: "#f2c230" },
    { title: "Pavillon Painting 2", x: 7.95, y: 1.7, z: -1, ry: -Math.PI / 2, w: 1.1, h: 1.5, image: `${TPL}/pavillon-2.jpg`, frame: "wood", color: "#cfd8c9", accent: "#4a7a4a" },
  ],
  // La Classique — buildClassique, g11Frame, 2 walls × 4.
  classique: [
    { title: "Classique Painting 1", x: -3.92, y: 3, z: 9.5, ry: Math.PI / 2, w: 1.7, h: 2.5, image: `${TPL}/classique-1.jpg`, frame: "wood", color: "#2a1c14", accent: "#8a3a1c" },
    { title: "Classique Painting 2", x: -3.92, y: 3, z: 3, ry: Math.PI / 2, w: 1.7, h: 2.5, image: `${TPL}/classique-2.jpg`, frame: "wood", color: "#2a1c14", accent: "#8a3a1c" },
    { title: "Classique Painting 3", x: -3.92, y: 3, z: -3.5, ry: Math.PI / 2, w: 1.7, h: 2.5, image: `${TPL}/classique-3.jpg`, frame: "wood", color: "#2a1c14", accent: "#8a3a1c" },
    { title: "Classique Painting 4", x: -3.92, y: 3, z: -10, ry: Math.PI / 2, w: 1.7, h: 2.5, image: `${TPL}/classique-4.jpg`, frame: "wood", color: "#2a1c14", accent: "#8a3a1c" },
    { title: "Classique Painting 5", x: 3.92, y: 3, z: 9.5, ry: -Math.PI / 2, w: 1.7, h: 2.5, image: `${TPL}/classique-5.jpg`, frame: "wood", color: "#2a1c14", accent: "#8a3a1c" },
    { title: "Classique Painting 6", x: 3.92, y: 3, z: 3, ry: -Math.PI / 2, w: 1.7, h: 2.5, image: `${TPL}/classique-6.jpg`, frame: "wood", color: "#2a1c14", accent: "#8a3a1c" },
    { title: "Classique Painting 7", x: 3.92, y: 3, z: -3.5, ry: -Math.PI / 2, w: 1.7, h: 2.5, image: `${TPL}/classique-7.jpg`, frame: "wood", color: "#2a1c14", accent: "#8a3a1c" },
    { title: "Classique Painting 8", x: 3.92, y: 3, z: -10, ry: -Math.PI / 2, w: 1.7, h: 2.5, image: `${TPL}/classique-8.jpg`, frame: "wood", color: "#2a1c14", accent: "#8a3a1c" },
  ],
  // L'Atrium blanc — buildAtriumBlanc, g11Frame, black frames.
  "atrium-blanc": [
    { title: "Atrium Painting 1", x: -1.8, y: 2.2, z: -13.93, ry: 0, w: 0.5, h: 0.7, image: `${TPL}/atrium-1.jpg`, frame: "black", color: "#3a8a4a", accent: "#e8d36a" },
    { title: "Atrium Painting 2", x: -0.8, y: 2.2, z: -13.93, ry: 0, w: 0.6, h: 0.75, image: `${TPL}/atrium-2.jpg`, frame: "black", color: "#1c1c1c", accent: "#c8c8c8" },
  ],
  // Les Salles Vertes — hall11, W 14, L 32, pn 3, 2 × 2.6 m.
  "salles-vertes": hall11Seeds("Salles Vertes", "salles-vertes", { W: 14, L: 32, pn: 3, fw: 2, fh: 2.6, fc: "wood", color: "#2a1c14", accent: "#8a3a1c" }),
  // Elegant Gallery (key "couloir-sombre") — hall11, W 7, L 46,
  // pn 6, 0.9 × 1.2 m.
  "couloir-sombre": hall11Seeds("Elegant Gallery", "elegant", { W: 7, L: 46, pn: 6, fw: 0.9, fh: 1.2, fc: "wood", color: "#1b1410", accent: "#8a3a1c" }),
  // Le Couloir Doré — hall11, W 7, L 46, pn 4, 1.7 × 2.4 m.
  "couloir-dore": hall11Seeds("Couloir Doré", "couloir-dore", { W: 7, L: 46, pn: 4, fw: 1.7, fh: 2.4, fc: "wood", color: "#2a1c14", accent: "#8a3a1c" }),
  // Les Voûtes — hall11, W 10, L 30, pn 2, 1.7 × 1.5 m, plus two
  // explicit frames on the back wall.
  voutes: [
    ...hall11Seeds("Voûtes", "voutes", { W: 10, L: 30, pn: 2, fw: 1.7, fh: 1.5, fc: "white", color: "#f4f2ec", accent: "#e0572a" }),
    { title: "Voûtes Painting 5", x: -3.2, y: 2.4, z: -14.93, ry: 0, w: 0.9, h: 1.1, image: `${TPL}/voutes-a.jpg`, frame: "white", color: "#f4f0e6", accent: "#e0572a" },
    { title: "Voûtes Painting 6", x: 3.4, y: 2.4, z: -14.93, ry: 0, w: 1.6, h: 1.4, image: `${TPL}/voutes-b.jpg`, frame: "white", color: "#f4f0e6", accent: "#f2c230" },
  ],
  // L'Escalier — buildEscalier, g11Frame: the 7 m mural + two small
  // frames on the opposite wall.
  escalier: [
    { title: "Escalier Mural", x: 7.9, y: 3.2, z: -3, ry: -Math.PI / 2, w: 7, h: 2.8, image: `${TPL}/escalier-mural.jpg`, frame: "white", color: "#e8e2d0", accent: "#f2b02a" },
    { title: "Escalier Painting 1", x: -7.9, y: 2.4, z: -1, ry: Math.PI / 2, w: 1.6, h: 2.1, image: `${TPL}/escalier-1.jpg`, frame: "wood", color: "#caa27a", accent: "#8a3a1c" },
    { title: "Escalier Painting 2", x: -7.9, y: 2.2, z: -5, ry: Math.PI / 2, w: 1.1, h: 1.4, image: `${TPL}/escalier-2.jpg`, frame: "wood", color: "#c26a2a", accent: "#e8b04a" },
  ],
};

// The template artworks of a room, as real artworks (Prisma create
// inputs). Sunlight keeps its own four (seedSunlightArtworks); a
// layout with no baked paintings returns [].
export function seedTemplateArtworks(layout: RoomLayout, roomId: string): TemplateArtworkSeed[] {
  if (layout === "sunlight") return seedSunlightArtworks(roomId);
  const raws = TEMPLATE_ARTWORKS[layout];
  if (!raws) return [];
  return raws.map((raw) => toSeed(raw, roomId));
}

// How many template artworks a layout seeds (0 when it has none).
export function templateArtworkCount(layout: RoomLayout): number {
  if (layout === "sunlight") return 4;
  return TEMPLATE_ARTWORKS[layout]?.length ?? 0;
}
