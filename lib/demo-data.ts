export type Artwork = {
  id: string;
  title: string;
  artist?: string;
  year: string;
  medium: string;
  dimensions: string;
  description: string;
  color: string;
  accent: string;
  position: [number, number, number];
  rotation: number;
  scale: number;
  imageUrl?: string | null;
  roomId: string;
  // Frame around the artwork in the 3D room ("wood" when absent).
  frame?: FrameVariant;
};

// Frame finishes for artworks in the 3D room. Each style carries its
// profile, so the 3D render matches the real frame it was digitized
// from: border width and depth in metres, how far the artwork sits
// recessed behind the front face, the extra opening around a floated
// work (shadow boxes), the procedural texture kind, a beaded inner edge,
// and an optional mat / thin gold trim between frame and artwork.
// The first six are the original flat frames; the rest are digitized
// from Kabeya's reference photos (Nov 2026).
export type FrameTextureKind = "plain" | "wood" | "gold-brushed" | "gold-carved" | "yellow-gloss" | "black-gloss" | "black-matte";
export type FrameMatKind = "velvet" | "paper" | "yellow";
export type FrameSpec = {
  label: string;
  color: string;
  metalness: number;
  roughness: number;
  // Border width and total depth of the frame, in metres.
  width: number;
  depth: number;
  // How far behind the front face the artwork sits (shadow boxes).
  recess: number;
  // Extra opening around the artwork: the work floats in the middle of
  // the tray instead of filling the frame (shadow boxes).
  floatGap: number;
  texture: FrameTextureKind;
  bead: boolean;
  // Mat between frame and artwork (a real border the artwork sits on).
  mat?: { color: string; width: number; texture: FrameMatKind };
  // Thin gold ring: around the artwork, between frame and mat, or both.
  trim?: { color: string; width: number; at: "artwork" | "mat" | "both" };
  // Back-panel colour inside the tray (shadow boxes): the dark wood or
  // black the floated work hangs against.
  trayColor?: string;
};
const flat = (spec: Omit<FrameSpec, "width" | "depth" | "recess" | "floatGap" | "texture" | "bead"> & Partial<Pick<FrameSpec, "width" | "depth" | "recess" | "floatGap" | "texture" | "bead">>): FrameSpec => ({
  width: 0.1,
  depth: 0.12,
  recess: 0,
  floatGap: 0,
  texture: "plain",
  bead: false,
  ...spec,
});
export const FRAME_VARIANTS = {
  none: flat({ label: "No frame", color: "#000000", metalness: 0, roughness: 1, width: 0, depth: 0 }),
  wood: flat({ label: "Wood", color: "#9c7c54", metalness: 0, roughness: 0.75, texture: "wood" }),
  metal: flat({ label: "Metal", color: "#9a9a98", metalness: 0.85, roughness: 0.35 }),
  gold: flat({ label: "Gold", color: "#a67c37", metalness: 0.9, roughness: 0.3, texture: "gold-brushed" }),
  black: flat({ label: "Black", color: "#141414", metalness: 0.1, roughness: 0.6, texture: "black-matte" }),
  white: flat({ label: "White", color: "#f5f2eb", metalness: 0, roughness: 0.8 }),
  // Wood shadow box (photo-65): warm medium-brown natural wood, visible
  // grain, deep tray, artwork floated and recessed inside.
  "wood-box": flat({ label: "Wood shadow box", color: "#8a6242", metalness: 0, roughness: 0.7, width: 0.07, depth: 0.18, recess: 0.1, floatGap: 0.08, texture: "wood", trayColor: "#6b4a30" }),
  // Gold ornate + red velvet (photo_1-16): bright gold frame, fine beaded
  // inner edge, wide deep-red velvet mat, thin gold frame around the work.
  "gold-velvet": flat({ label: "Gold ornate · red velvet", color: "#c9a227", metalness: 0.85, roughness: 0.35, width: 0.09, depth: 0.12, texture: "gold-brushed", bead: true, mat: { color: "#6e0f1a", width: 0.14, texture: "velvet" }, trim: { color: "#d4af37", width: 0.015, at: "artwork" } }),
  // Gold classic (photo_2-8): warm gold, smooth stepped profile, beaded
  // inner line, medium width, elegant.
  "gold-classic": flat({ label: "Gold classic", color: "#b08d3e", metalness: 0.85, roughness: 0.35, width: 0.09, depth: 0.12, texture: "gold-brushed", bead: true }),
  // Gold baroque carved (photo_3-5): heavily carved floral/scroll relief,
  // wide, antique gold with dark recesses.
  "gold-baroque": flat({ label: "Gold baroque", color: "#a67c37", metalness: 0.8, roughness: 0.45, width: 0.16, depth: 0.13, texture: "gold-carved" }),
  // Yellow lacquer (photo_4-4): vivid yellow, wide flat smooth profile,
  // high gloss; the work floats small on a wide yellow field.
  "yellow-lacquer": flat({ label: "Yellow lacquer", color: "#f5c400", metalness: 0.05, roughness: 0.15, width: 0.06, depth: 0.14, recess: 0.04, texture: "yellow-gloss", mat: { color: "#f5c400", width: 0.25, texture: "yellow" } }),
  // Black + gold + cream mat (photo_5-4, lower frame): wide glossy black
  // frame, thin gold trim, wide cream passe-partout, thin gold frame
  // around the artwork.
  "black-gold-cream": flat({ label: "Black + gold · cream mat", color: "#141414", metalness: 0.2, roughness: 0.35, width: 0.11, depth: 0.12, texture: "black-gloss", mat: { color: "#f2ead8", width: 0.16, texture: "paper" }, trim: { color: "#c9a227", width: 0.02, at: "both" } }),
  // Black + cream mat (photo_5-4, upper frame): thin black frame, wide
  // cream mat, no gold.
  "black-cream": flat({ label: "Black · cream mat", color: "#1a1a1a", metalness: 0.1, roughness: 0.6, width: 0.035, depth: 0.1, texture: "black-matte", mat: { color: "#f2ead8", width: 0.16, texture: "paper" } }),
  // Gold museum wide (photo_6-3): very wide ornate gold museum frame,
  // beaded inner edge, warm gold, grand.
  "gold-museum": flat({ label: "Gold museum", color: "#c19a3d", metalness: 0.85, roughness: 0.3, width: 0.2, depth: 0.13, texture: "gold-brushed", bead: true }),
  // Black shadow box (photo_7-2): deep matte black tray, wide, artwork
  // floated inside with a visible gap.
  "black-box": flat({ label: "Black shadow box", color: "#1c1c1c", metalness: 0.05, roughness: 0.9, width: 0.08, depth: 0.2, recess: 0.12, floatGap: 0.1, texture: "black-matte", trayColor: "#111111" }),
};

export type FrameVariant = keyof typeof FRAME_VARIANTS;

export const demoArtworks: Artwork[] = [
  {
    id: "art-1",
    title: "The quiet between",
    year: "2025",
    medium: "Oil and charcoal on canvas",
    dimensions: "90 × 120 cm",
    description: "A study of stillness, memory and the places we carry.",
    color: "#b8a184",
    accent: "#343e36",
    position: [-4.3, 2.45, -5.72],
    rotation: 0,
    scale: 1,
    roomId: "room-main",
  },
  {
    id: "art-2",
    title: "Soft geometry",
    year: "2024",
    medium: "Mixed media on linen",
    dimensions: "75 × 95 cm",
    description: "Colour and form meet in a composition shaped by movement.",
    color: "#c66545",
    accent: "#e5ba7b",
    position: [0, 2.65, -5.72],
    rotation: 0,
    scale: 1,
    roomId: "room-main",
  },
  {
    id: "art-3",
    title: "A map of elsewhere",
    year: "2025",
    medium: "Acrylic on canvas",
    dimensions: "100 × 100 cm",
    description: "An imagined landscape built from fragments of lived experience.",
    color: "#79899a",
    accent: "#d8c8a9",
    position: [4.3, 2.45, -5.72],
    rotation: 0,
    scale: 1,
    roomId: "room-main",
  },
];
