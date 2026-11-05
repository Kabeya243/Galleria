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

// Frame finishes for artworks in the 3D room: material colour,
// metalness and roughness for the frame box around each work.
export const FRAME_VARIANTS = {
  none: { label: "No frame", color: "#000000", metalness: 0, roughness: 1 },
  wood: { label: "Wood", color: "#9c7c54", metalness: 0, roughness: 0.75 },
  metal: { label: "Metal", color: "#9a9a98", metalness: 0.85, roughness: 0.35 },
  gold: { label: "Gold", color: "#a67c37", metalness: 0.9, roughness: 0.3 },
  black: { label: "Black", color: "#141414", metalness: 0.1, roughness: 0.6 },
  white: { label: "White", color: "#f5f2eb", metalness: 0, roughness: 0.8 },
} as const;

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
