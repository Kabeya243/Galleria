// Creates a DRAFT test exhibition on SANAA:
// "We Are Enough As We Are" — the Sunlight Gallery with its four
// seeded demo artworks (the bundled placeholders, NOT Kabeya's real
// works and NOT the sold works).
//
// WHAT IT CREATES (and nothing else)
//   - 1 exhibition, status "draft" (never published), slug
//     we-are-enough-as-we-are-test
//   - 1 Sunlight room (22 × 26 m, the only template)
//   - 4 Artwork rows (the Sunlight template's demo works, on the
//     three freestanding panels, with the bundled placeholder images)
//   - Draft URL (owner only): https://galleria-bice.vercel.app/editor/<id>
//
// RUN IT (from ~/workspace/galleria, against the PRODUCTION database):
//   node --env-file=.env scripts/seed-sunlight-test.mjs
//
// PREREQUISITES
//   - DATABASE_URL must be set (via .env). The script refuses to run
//     without it and never guesses a database.
//   - The test account test-sanaa-2026e@example.com must exist (it
//     owns the public solo exhibition — never delete it).
//
// SAFETY
//   - Idempotent: if an exhibition with this slug already exists, the
//     script prints its id and stops without creating anything.
//   - It never deletes or updates existing rows.
//   - It never publishes: status stays "draft", publishedAt stays null.

import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Run the script with the database you want to seed, e.g.:\n" +
      "  node --env-file=.env scripts/seed-sunlight-test.mjs\n" +
      "The script never guesses a database and will not run without one.",
  );
  process.exit(1);
}

const db = new PrismaClient();

const SLUG = "we-are-enough-as-we-are-test";
const TITLE = "We Are Enough As We Are";
const SITE_URL = "https://galleria-bice.vercel.app";
const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "test-sanaa-2026e@example.com";

// One Sunlight room — the exact preset from lib/rooms.ts
// (createGalleryRoom(0, "sunlight")).
const roomId = randomUUID();
const rooms = [
  {
    id: roomId,
    name: "Room 1",
    layout: "sunlight",
    wallColor: "#f6f6f4",
    sideWallColor: "#f6f6f4",
    floorColor: "#a9aaad",
    ceilingColor: "#fafaf8",
    wallTexture: "plaster",
    floorTexture: "concrete",
    ceilingTexture: "plaster",
    spotlights: false,
    partitionWalls: [],
    curatorialText: "",
    floorType: "polished-concrete",
    lightType: "sunlight",
    wallPaint: {},
    elements: [],
  },
];

// The Sunlight template's four demo artworks (seedSunlightArtworks in
// lib/rooms.ts): placeholder images only, on the three freestanding
// panels. Real Artwork rows, so the editor can select, re-image,
// move or delete each one.
const placeholder =
  "Placeholder artwork from the Sunlight Gallery template — replace it with your own work.";
const artworks = [
  {
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
].map((work) => ({
  id: randomUUID(),
  title: work.title,
  artist: "",
  year: "",
  medium: "Mixed media",
  dimensions: work.dimensions,
  description: placeholder,
  color: work.color,
  accent: work.accent,
  positionX: work.positionX,
  positionY: work.positionY,
  positionZ: work.positionZ,
  rotation: work.rotation,
  scale: 1,
  frame: "wood",
  imageUrl: work.imageUrl,
  roomId,
}));

async function seedSunlightTest() {
  const owner = await db.user.findUnique({ where: { email: ownerEmail } });
  if (!owner) {
    const users = await db.user.findMany({ select: { id: true, email: true, name: true } });
    const listing = users.length
      ? users.map((user) => `  - ${user.name} <${user.email}> (${user.id})`).join("\n")
      : "  (no users in this database)";
    throw new Error(
      `No SANAA account found for ${ownerEmail}.\nAccounts in this database:\n${listing}\n` +
        'Re-run with the right address, e.g. SEED_OWNER_EMAIL="name@example.com".',
    );
  }

  const existing = await db.exhibition.findFirst({
    where: { slug: SLUG },
    select: { id: true, title: true, ownerId: true, status: true },
  });
  if (existing) {
    if (existing.ownerId === owner.id && existing.title === TITLE) {
      console.log(
        `The Sunlight test exhibition already exists (${existing.id}, status "${existing.status}").\n` +
          `Draft URL (owner only): ${SITE_URL}/editor/${existing.id}`,
      );
      return;
    }
    throw new Error(
      `The slug "${SLUG}" is already used by another exhibition (${existing.id}). Pick another slug in the script.`,
    );
  }

  const exhibition = await db.exhibition.create({
    data: {
      title: TITLE,
      slug: SLUG,
      description:
        "Test exhibition for the Sunlight Gallery — four placeholder artworks on the freestanding panels. Draft only.",
      status: "draft",
      roomColor: rooms[0].wallColor,
      rooms: JSON.stringify(rooms),
      ownerId: owner.id,
      artworks: { create: artworks },
    },
    select: { id: true },
  });

  console.log(
    `\nCreated draft test exhibition "${TITLE}" (${exhibition.id}) with 1 Sunlight room and ${artworks.length} placeholder artworks.` +
      `\nDraft URL (owner only): ${SITE_URL}/editor/${exhibition.id}` +
      `\nStatus: draft — nothing was published.`,
  );
}

seedSunlightTest()
  .catch((error) => {
    console.error("Could not seed the Sunlight test exhibition.", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
