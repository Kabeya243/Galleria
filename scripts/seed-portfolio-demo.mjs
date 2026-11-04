import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const db = new PrismaClient();
const title = "AFROCENTRIK: Memory, Identity & Pride";
const rooms = [
  {
    id: "demo-origins",
    name: "Origins & Memory",
    layout: "cube",
    wallColor: "#eee7db",
    sideWallColor: "#d9d0c3",
    floorColor: "#b8afa1",
  },
  {
    id: "demo-presence",
    name: "Presence",
    layout: "grand-hall",
    wallColor: "#d8c8b7",
    sideWallColor: "#b8a894",
    floorColor: "#85786b",
  },
  {
    id: "demo-inner-worlds",
    name: "Inner Worlds",
    layout: "quiet-minimal",
    wallColor: "#d1d4c4",
    sideWallColor: "#b4b9a7",
    floorColor: "#929582",
  },
  {
    id: "demo-reflections",
    name: "Reflections",
    layout: "cube",
    wallColor: "#dfc9bd",
    sideWallColor: "#bea79b",
    floorColor: "#918178",
  },
];
const artworks = [
  {
    title: "Sankofa",
    filename: "sankofa.webp",
    year: "2025",
    medium: "Charcoal, oil paint and acrylic on paper",
    dimensions: "89 x 89 cm",
    description: "A portrait rooted in the movement between memory, heritage and the future.",
    roomId: rooms[0].id,
    x: -5,
    z: -5.72,
  },
  {
    title: "Authenticity I",
    filename: "authenticity1.webp",
    year: "2024",
    medium: "Charcoal on paper",
    dimensions: "120 x 89 cm",
    description: "A study of identity and the quiet strength of an unguarded gaze.",
    roomId: rooms[0].id,
    x: 0,
    z: -5.72,
  },
  {
    title: "Feline Look",
    filename: "felinelook.webp",
    year: "2024",
    medium: "Charcoal and pastels on paper",
    dimensions: "120 x 89 cm",
    description: "A portrait balancing presence, texture and a direct, confident gaze.",
    roomId: rooms[0].id,
    x: 5,
    z: -5.72,
  },
  {
    title: "Angelic",
    filename: "Angelic.webp",
    year: "2023",
    medium: "Charcoal on paper",
    dimensions: "90 x 60 cm",
    description: "A portrait celebrating grace, dignity and the inner life of its subject.",
    roomId: rooms[1].id,
    x: -7,
    z: -7.72,
  },
  {
    title: "Dream in a Blue Sun",
    filename: "Dream-in-a-blue-sun.webp",
    year: "2025",
    medium: "Charcoal and acrylic on paper",
    dimensions: "120 x 89 cm",
    description: "An expressive portrait where colour and memory open onto an imagined world.",
    roomId: rooms[1].id,
    x: 0,
    z: -7.72,
  },
  {
    title: "Insecure",
    filename: "insecure.webp",
    year: "2026",
    medium: "Charcoal and acrylic on paper",
    dimensions: "120 x 89 cm",
    description: "A contemporary portrait reflecting vulnerability and self-perception.",
    roomId: rooms[1].id,
    x: 7,
    z: -7.72,
  },
  {
    title: "Immaculate",
    filename: "immaculate.webp",
    year: "2023",
    medium: "Charcoal on paper",
    dimensions: "90 x 60 cm",
    description: "A portrait attentive to detail, stillness and the dignity of its subject.",
    roomId: rooms[2].id,
    x: -4,
    z: -4.72,
  },
  {
    title: "Scarfed",
    filename: "scarfed.webp",
    year: "2025",
    medium: "Charcoal and mixed media on paper",
    dimensions: "Dimensions not listed",
    description: "A portrait in which adornment and gesture shape a distinct presence.",
    roomId: rooms[2].id,
    x: 0,
    z: -4.72,
  },
  {
    title: "Authenticity II",
    filename: "authenticity2.webp",
    year: "2024-2025",
    medium: "Charcoal and acrylic on paper",
    dimensions: "120 x 89 cm",
    description: "A companion portrait exploring authenticity, memory and cultural pride.",
    roomId: rooms[2].id,
    x: 4,
    z: -4.72,
  },
  {
    title: "Unknown",
    filename: "unknown.webp",
    year: "Details not listed",
    medium: "Details not listed",
    dimensions: "Details not listed",
    description: "A selected portrait from the artist's portfolio.",
    roomId: rooms[3].id,
    x: 0,
    z: -5.72,
  },
];

async function seedDemo() {
  const users = await db.user.findMany({ select: { id: true } });
  if (users.length !== 1) {
    throw new Error("Create exactly one local SANAA account before seeding the portfolio demo.");
  }

  const existing = await db.exhibition.findFirst({
    where: { ownerId: users[0].id, title },
    select: { id: true },
  });
  if (existing) {
    console.log("The AFROCENTRIK demo already exists.");
    return;
  }

  const exhibition = await db.exhibition.create({
    data: {
      title,
      slug: `afrocentrik-demo-${randomUUID()}`,
      description:
        "A three-room virtual exhibition bringing together selected portraits by Kabeya Ilunga. Explore African memory, identity, dignity and Black pride through charcoal and mixed media.",
      status: "draft",
      roomColor: rooms[0].wallColor,
      rooms: JSON.stringify(rooms),
      ownerId: users[0].id,
      artworks: {
        create: artworks.map((artwork) => ({
          id: randomUUID(),
          title: artwork.title,
          artist: "Kabeya Ilunga",
          year: artwork.year,
          medium: artwork.medium,
          dimensions: artwork.dimensions,
          description: artwork.description,
          color: "#b8a184",
          accent: "#343e36",
          positionX: artwork.x,
          positionY: 2.45,
          positionZ: artwork.z,
          rotation: 0,
          scale: 0.88,
          imageUrl: `/api/portfolio-artworks/${artwork.filename}`,
          roomId: artwork.roomId,
        })),
      },
    },
    select: { id: true },
  });

  console.log(`Created AFROCENTRIK demo ${exhibition.id} with 4 rooms and 10 artworks.`);
}

seedDemo()
  .catch((error) => {
    console.error("Could not seed the portfolio demo.", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
