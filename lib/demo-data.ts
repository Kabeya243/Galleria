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
};

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
