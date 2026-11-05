// Creates Kabeya Ilunga's public solo exhibition on SANAA:
// "Already Enough As We Are" — 7 works in one White Cube room.
//
// WHAT IT CREATES (and nothing else)
//   - 1 exhibition, status "public", slug
//     kabeya-ilunga-already-enough-as-we-are
//   - 7 Upload rows (the artwork images, stored in the database) +
//     7 Artwork rows pointing at them
//   - Public URL: https://galleria-bice.vercel.app/exhibition/kabeya-ilunga-already-enough-as-we-are
//
// RUN IT (from ~/workspace/galleria, against the PRODUCTION database):
//   DATABASE_URL="postgres://..." \
//   SEED_OWNER_EMAIL="kabeyailunga243@gmail.com" \
//   node scripts/seed-kabeya-solo.mjs
//
// PREREQUISITES
//   - The Upload model must exist in the generated Prisma client: it comes
//     from the upload-to-database change (uploads stored in Postgres instead
//     of data/uploads). If the script complains the model is missing, run
//     `npx prisma generate` after that change is in place and try again.
//   - DATABASE_URL must point at the database you want to seed. The script
//     refuses to run without it and never guesses a database.
//   - The 7 source images below must exist (5 clean photos from the
//     dot.ateliers dossier and Kabeya's website images, plus the 2 sold
//     works).
//
// SAFETY
//   - Idempotent: if an exhibition with this slug already exists, the
//     script prints its URL and stops without creating anything.
//   - It never deletes or updates existing rows.
//   - The two SOLD works (The Red Nails, Maze Of Blackness I, Genesis) are
//     included and marked with a red circle (🔴) in their title and
//     description — they hang as sold, not available.
//   - "Crown of Continuity": title, medium and dimensions come from the
//     file name — confirm them with Kabeya before publishing (the file
//     itself is his, from his website's works folder).
//
// MANUAL EQUIVALENT (no script): see scripts/seed-kabeya-solo.README.md.

import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
import sharp from "sharp";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Run the script with the database you want to seed, e.g.:\n" +
      '  DATABASE_URL="postgres://..." node scripts/seed-kabeya-solo.mjs\n' +
      "The script never guesses a database and will not run without one.",
  );
  process.exit(1);
}

const db = new PrismaClient();

const SLUG = "kabeya-ilunga-already-enough-as-we-are";
const TITLE = "Already Enough As We Are";
const SITE_URL = "https://galleria-bice.vercel.app";

const dotAteliersDir =
  process.env.KABEYA_ARTWORKS_DIR ??
  "/home/hatch/workspace/goals/dot-ateliers-2027-residency-application/files";
const websiteWorksDir =
  process.env.KABEYA_WEBSITE_WORKS_DIR ?? "/home/hatch/workspace/site-kabeyailunga/images/works";
const ownerEmail = process.env.SEED_OWNER_EMAIL ?? "kabeyailunga243@gmail.com";

// Clean photos only. The two sold works are marked with a red circle (🔴):
// they hang in the exhibition as sold, not available.
const works = [
  {
    file: path.join(dotAteliersDir, "Ilunga_Kabeya_TheRedNails_Acrylics-Charcoals_2026_130x94cm.jpg"),
    title: "The Red Nails 🔴",
    year: "2026",
    medium: "Acrylics and charcoals on paper",
    dimensions: "130 × 94 cm",
    description: "🔴 Sold. A portrait from the Maze of Blackness series, in acrylics and charcoals on paper.",
    x: -7,
  },
  {
    file: path.join(dotAteliersDir, "Ilunga_Kabeya_TheNoseRing_Acrylics-Charcoal_2026_130x94cm.jpg"),
    title: "The Nose Ring",
    year: "2026",
    medium: "Acrylics and charcoal on paper",
    dimensions: "130 × 94 cm",
    description: "A portrait from the Maze of Blackness series, in acrylics and charcoal on paper.",
    x: -4.67,
  },
  {
    file: path.join(
      dotAteliersDir,
      "Ilunga_Kabeya_TheBoyWithGoldJewelry_Acrylics-Sequins-Charcoal_2026_120x89cm.jpg",
    ),
    title: "The Boy with Gold Jewelry",
    year: "2026",
    medium: "Acrylics, sequins and charcoal on paper",
    dimensions: "120 × 89 cm",
    description:
      "A young man wears only small gold earrings. Gold signifies assurance, self-confidence and community riches.",
    x: -2.33,
  },
  {
    file: path.join(
      dotAteliersDir,
      "Ilunga_Kabeya_TheFamilyPhotograph_Acrylics-Charcoal_2026_120x94cm.jpg",
    ),
    title: "The Family Photograph",
    year: "2026",
    medium: "Acrylics and charcoal on paper",
    dimensions: "120 × 94 cm",
    description: "A large-scale portrait in acrylics and charcoal on paper.",
    x: 0,
  },
  {
    file: path.join(websiteWorksDir, "authenticity-i.jpg"),
    title: "Authenticity I",
    year: "2024",
    medium: "Charcoal on paper",
    dimensions: "120 × 89 cm",
    description: "Scarifications and a halo — one of Kabeya's favourite portraits.",
    x: 2.33,
  },
  {
    // Title, medium and dimensions from the file name — confirm with Kabeya.
    file: path.join(websiteWorksDir, "crown-continuity.jpg"),
    title: "Crown of Continuity",
    year: "2026",
    medium: "Acrylics and graphite on paper",
    dimensions: "120 × 89 cm",
    description: "A portrait in acrylics and graphite on paper.",
    x: 4.67,
  },
  {
    file: path.join(websiteWorksDir, "genesis.jpg"),
    title: "Maze Of Blackness I, Genesis 🔴",
    year: "2026",
    medium: "Acrylics, collage and charcoals on paper",
    dimensions: "92 × 86 cm",
    description: "🔴 Sold. The first work of the Maze of Blackness series — acrylics, collage and charcoals on paper.",
    x: 7,
  },
];

// One White Cube room (18 × 12 m), works along the back wall.
const rooms = [
  {
    id: randomUUID(),
    name: "Room 1",
    layout: "cube",
    wallColor: "#f5f2eb",
    sideWallColor: "#e8e4da",
    floorColor: "#4a4743",
    ceilingColor: "#f5f2eb",
    wallTexture: "plaster",
    floorTexture: "stone",
    ceilingTexture: "plaster",
    spotlights: true,
    partitionWalls: [],
    curatorialText: "We are already enough as we are.",
  },
];

async function seedKabeyaSolo() {
  // The Upload model comes from the upload-to-database change. Without it
  // the images would have nowhere to go (uploads no longer live on disk).
  if (typeof db.upload?.create !== "function") {
    throw new Error(
      "The Upload model is missing from the generated Prisma client. " +
        "Run `npx prisma generate` once the upload-to-database change is in place, then try again.",
    );
  }

  const owner = await db.user.findUnique({ where: { email: ownerEmail } });
  if (!owner) {
    const users = await db.user.findMany({ select: { id: true, email: true, name: true } });
    const listing = users.length
      ? users.map((user) => `  - ${user.name} <${user.email}> (${user.id})`).join("\n")
      : "  (no users in this database)";
    throw new Error(
      `No SANAA account found for ${ownerEmail}.\nAccounts in this database:\n${listing}\n` +
        "Re-run with the right address, e.g. SEED_OWNER_EMAIL=\"name@example.com\".",
    );
  }

  const existing = await db.exhibition.findFirst({
    where: { slug: SLUG },
    select: { id: true, title: true, ownerId: true },
  });
  if (existing) {
    if (existing.ownerId === owner.id && existing.title === TITLE) {
      console.log(
        `The solo exhibition already exists (${existing.id}).\nPublic URL: ${SITE_URL}/exhibition/${SLUG}`,
      );
      return;
    }
    throw new Error(
      `The slug "${SLUG}" is already used by another exhibition (${existing.id}). Pick another slug in the script.`,
    );
  }

  // Fail fast if a source image is missing — before creating anything.
  for (const work of works) {
    try {
      await access(work.file);
    } catch {
      throw new Error(`Source image missing: ${work.file}`);
    }
  }

  // Same processing as the upload route: rotate, cap at 4096 px, WebP 85.
  const artworks = [];
  for (const work of works) {
    const buffer = await readFile(work.file);
    const optimized = await sharp(buffer, { limitInputPixels: 40_000_000, failOn: "warning" })
      .rotate()
      .resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85, effort: 4 })
      .toBuffer();
    const id = randomUUID();
    await db.upload.create({
      data: { id, data: Buffer.from(optimized), mimeType: "image/webp", ownerId: owner.id },
    });
    artworks.push({
      id: randomUUID(),
      title: work.title,
      artist: "Kabeya Ilunga",
      year: work.year,
      medium: work.medium,
      dimensions: work.dimensions,
      description: work.description,
      color: "#b8a184",
      accent: "#343e36",
      positionX: work.x,
      positionY: 2.45,
      positionZ: -5.72,
      rotation: 0,
      scale: 0.88,
      imageUrl: `/api/uploads/${id}.webp`,
      roomId: rooms[0].id,
    });
    console.log(`Uploaded ${work.title} (${work.file})`);
  }

  const exhibition = await db.exhibition.create({
    data: {
      title: TITLE,
      slug: SLUG,
      description:
        "A solo exhibition by Kabeya Ilunga. Large-scale portraits in charcoal, acrylic and mixed media " +
        "around Black pride, African memory and identity — a realistic face, stylized clothing, textile " +
        "patterns and ornaments, on vivid backgrounds. At the heart of the work is one conviction: " +
        "we are already enough as we are.",
      status: "public",
      publishedAt: new Date(),
      roomColor: rooms[0].wallColor,
      rooms: JSON.stringify(rooms),
      ownerId: owner.id,
      artworks: { create: artworks },
    },
    select: { id: true },
  });

  console.log(
    `\nCreated solo exhibition "${TITLE}" (${exhibition.id}) with 1 room and ${artworks.length} artworks.` +
      `\nPublic URL: ${SITE_URL}/exhibition/${SLUG}` +
      `\nIt now appears on the public homepage. Walk through it and check every image loads.`,
  );
}

seedKabeyaSolo()
  .catch((error) => {
    console.error("Could not seed Kabeya's solo exhibition.", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
