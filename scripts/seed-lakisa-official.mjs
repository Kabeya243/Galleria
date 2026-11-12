// Creates the official Lakisa account and its first curated exhibition
// "First Light" — six acrylic landscapes hung in one row at eye level
// (centre 1.50 m) on the Sunlight Gallery back wall.
//
// WHAT IT CREATES (and nothing else)
//   - 1 user: official@lakisa.art, name "Lakisa Official", role
//     "curator", email verified (emailVerifiedAt set, so the account can
//     sign in without the SMTP verification email), terms accepted.
//   - 1 exhibition, slug "first-light", status "public", visibility
//     "public", publishedAt now, one Sunlight room (22 x 26 m).
//   - 6 artworks (one row on the back wall, z = -13.9, rotation 0):
//     Savanna Sunset, Mountain Lake, Green Hills, Desert Dunes,
//     Forest Mist, Coastal Cliffs — medium "acrylique sur toile".
//   - 6 LibraryWork rows (one per work) and 1 Post row (feed cover =
//     the first work), so the show appears in the publication feed.
//
// RUN IT (from ~/workspace/galleria, against the PRODUCTION database):
//   DATABASE_URL=<production Neon URL from Vercel env vars> \
//   R2_ACCOUNT_ID=<...> R2_ACCESS_KEY_ID=<...> \
//   R2_SECRET_ACCESS_KEY=<...> R2_BUCKET_NAME=<...> \
//   R2_PUBLIC_URL=<...> LAKISA_OFFICIAL_PASSWORD=<chosen password> \
//   node scripts/seed-lakisa-official.mjs
//
// PREREQUISITES
//   - DATABASE_URL must be the production Neon URL (Vercel env vars).
//     The script refuses to run without it and never guesses a database.
//   - R2_* must be the production bucket (Vercel env vars). Images are
//     uploaded to uploads/<userId>/<uuid>.jpg and stored as the R2
//     public URL, exactly like the editor upload flow.
//   - LAKISA_OFFICIAL_PASSWORD is required: the script never invents a
//     password nobody knows. Kabeya changes it after first sign-in.
//   - The 6 JPGs must exist in
//     ~/workspace/your_files/lakisa-instagram/acrylic-landscapes/.
//
// SAFETY
//   - Idempotent: re-running it creates nothing twice. An existing
//     official@lakisa.art keeps its password; an existing "first-light"
//     exhibition is reused (and published if it was a draft); artworks
//     already hanging by title are skipped (no re-upload).
//   - It never deletes or updates existing rows except: setting
//     emailVerifiedAt / termsAcceptedAt on the official account when
//     null, and publishing a draft "first-light" exhibition.
//   - It never touches any other user, exhibition or artwork.

import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import bcryptjs from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const REQUIRED_ENV = [
  "DATABASE_URL",
  "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY",
  "R2_BUCKET_NAME",
  "R2_PUBLIC_URL",
  "LAKISA_OFFICIAL_PASSWORD",
];
const missing = REQUIRED_ENV.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Missing required environment variables: ${missing.join(", ")}`);
  console.error(
    "Run with the production values from the Vercel env vars, e.g.:\n" +
      "  DATABASE_URL=<Neon URL> R2_ACCOUNT_ID=<...> R2_ACCESS_KEY_ID=<...> \\\n" +
      "  R2_SECRET_ACCESS_KEY=<...> R2_BUCKET_NAME=<...> R2_PUBLIC_URL=<...> \\\n" +
      "  LAKISA_OFFICIAL_PASSWORD=<chosen password> node scripts/seed-lakisa-official.mjs",
  );
  process.exit(1);
}

const db = new PrismaClient();
const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});
const BUCKET = process.env.R2_BUCKET_NAME;
const PUBLIC_URL = process.env.R2_PUBLIC_URL.replace(/\/$/, "");

const OFFICIAL_EMAIL = "official@lakisa.art";
const OFFICIAL_NAME = "Lakisa Official";
const EXHIBITION_SLUG = "first-light";
const EXHIBITION_TITLE = "First Light";
const PUBLIC_EXHIBITION_URL = `https://lakisa.art/exhibition/${EXHIBITION_SLUG}`;
const LANDSCAPES_DIR = path.join(
  process.env.HOME ?? "",
  "workspace/your_files/lakisa-instagram/acrylic-landscapes",
);

// One Sunlight room — the exact preset from lib/rooms.ts
// (createGalleryRoom(0, "sunlight")), same as scripts/seed-sunlight-test.mjs.
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

// The six landscapes, in hanging order left to right. Widths/heights are
// the real size on the wall in metres (dimensions field x scale 1).
// One row at eye level (centre 1.50 m), 12 cm apart, centred on the
// 22 m back wall: total 7.00 m of works + 0.60 m of gaps = 7.60 m,
// so the row runs from x = -3.80 to x = +3.80. z = -13.9 is the back
// wall face (z = -14) + 0.1 m off the surface; rotation 0 faces +z,
// into the room (see sunlightPlaceOnWall in lib/sunlight-elements.ts).
const WORKS = [
  { file: "01_Savanna_Sunset.jpg", title: "Savanna Sunset", width: 1.25, height: 1.0, dimensions: "125 × 100 cm", x: -3.175, color: "#c44a20" },
  { file: "02_Mountain_Lake.jpg", title: "Mountain Lake", width: 1.0, height: 1.25, dimensions: "100 × 125 cm", x: -1.93, color: "#34546e" },
  { file: "03_Green_Hills.jpg", title: "Green Hills", width: 1.25, height: 1.0, dimensions: "125 × 100 cm", x: -0.685, color: "#3a7a3e" },
  { file: "04_Desert_Dunes.jpg", title: "Desert Dunes", width: 1.25, height: 1.0, dimensions: "125 × 100 cm", x: 0.685, color: "#ba783e" },
  { file: "05_Forest_Mist.jpg", title: "Forest Mist", width: 1.0, height: 1.25, dimensions: "100 × 125 cm", x: 1.93, color: "#34443a" },
  { file: "06_Coastal_Cliffs.jpg", title: "Coastal Cliffs", width: 1.25, height: 1.0, dimensions: "125 × 100 cm", x: 3.175, color: "#2e6e96" },
];

function referralCodeFor(name) {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5) || "LAKISA";
  const suffix = Array.from({ length: 4 }, () => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]).join("");
  return `${letters}-${suffix}`;
}

async function uploadToR2(userId, fileName) {
  const buffer = await readFile(path.join(LANDSCAPES_DIR, fileName));
  const key = `uploads/${userId}/${randomUUID()}.jpg`;
  await s3.send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: buffer, ContentType: "image/jpeg" }),
  );
  return `${PUBLIC_URL}/${key}`;
}

async function main() {
  // --- 1. Official account ---
  let user = await db.user.findUnique({ where: { email: OFFICIAL_EMAIL } });
  if (user) {
    console.log(`Account ${OFFICIAL_EMAIL} already exists (${user.id}); keeping its password.`);
    if (!user.emailVerifiedAt || !user.termsAcceptedAt) {
      user = await db.user.update({
        where: { id: user.id },
        data: {
          emailVerifiedAt: user.emailVerifiedAt ?? new Date(),
          termsAcceptedAt: user.termsAcceptedAt ?? new Date(),
        },
      });
      console.log("Marked the account verified + terms accepted.");
    }
  } else {
    let referralCode = referralCodeFor(OFFICIAL_NAME);
    for (let attempt = 0; attempt < 3; attempt++) {
      const taken = await db.user.findUnique({ where: { referralCode }, select: { id: true } });
      if (!taken) break;
      referralCode = referralCodeFor(OFFICIAL_NAME);
    }
    user = await db.user.create({
      data: {
        email: OFFICIAL_EMAIL,
        name: OFFICIAL_NAME,
        passwordHash: await bcryptjs.hash(process.env.LAKISA_OFFICIAL_PASSWORD, 12),
        role: "curator",
        emailVerifiedAt: new Date(),
        termsAcceptedAt: new Date(),
        referralCode,
      },
    });
    console.log(`Created account ${OFFICIAL_EMAIL} (${user.id}).`);
  }

  // --- 2. Exhibition "First Light" ---
  let exhibition = await db.exhibition.findUnique({ where: { slug: EXHIBITION_SLUG } });
  if (exhibition) {
    console.log(`Exhibition "${EXHIBITION_SLUG}" already exists (${exhibition.id}).`);
    if (exhibition.status !== "public" || exhibition.visibility !== "public" || !exhibition.publishedAt) {
      exhibition = await db.exhibition.update({
        where: { id: exhibition.id },
        data: { status: "public", visibility: "public", publishedAt: exhibition.publishedAt ?? new Date() },
      });
      console.log("Published the existing exhibition.");
    }
  } else {
    exhibition = await db.exhibition.create({
      data: {
        title: EXHIBITION_TITLE,
        slug: EXHIBITION_SLUG,
        description: "Six acrylic landscapes, curated by Lakisa Official, hung in the Sunlight Gallery.",
        status: "public",
        visibility: "public",
        publishedAt: new Date(),
        rooms: JSON.stringify(rooms),
        ownerId: user.id,
      },
    });
    console.log(`Created exhibition "${EXHIBITION_TITLE}" (${exhibition.id}).`);
  }

  // --- 3. The six landscapes, hung in one row at eye level ---
  let firstImageUrl = null;
  for (const work of WORKS) {
    const existing = await db.artwork.findFirst({
      where: { exhibitionId: exhibition.id, title: work.title },
      select: { id: true, imageUrl: true },
    });
    if (existing) {
      console.log(`Skipping "${work.title}" (already hanging).`);
      firstImageUrl ??= existing.imageUrl;
      continue;
    }
    const imageUrl = await uploadToR2(user.id, work.file);
    firstImageUrl ??= imageUrl;
    await db.artwork.create({
      data: {
        title: work.title,
        artist: OFFICIAL_NAME,
        year: "2026",
        medium: "acrylique sur toile",
        dimensions: work.dimensions,
        description: "",
        color: work.color,
        accent: "#1a1a1a",
        positionX: work.x,
        positionY: 1.5,
        positionZ: -13.9,
        rotation: 0,
        scale: 1,
        frame: "wood",
        imageUrl,
        roomId,
        exhibitionId: exhibition.id,
      },
    });
    try {
      await db.libraryWork.create({
        data: {
          ownerId: user.id,
          title: work.title,
          artist: OFFICIAL_NAME,
          year: "2026",
          medium: "acrylique sur toile",
          dimensions: work.dimensions,
          description: "",
          imageUrl,
          frame: "wood",
        },
      });
    } catch (error) {
      if (error?.code !== "P2002") throw error;
      console.log(`Library row for "${work.title}" already exists.`);
    }
    console.log(`Hung "${work.title}" at x=${work.x}, y=1.5, z=-13.9.`);
  }

  // --- 4. Feed post (so the show appears in the publication feed) ---
  const post = await db.post.findUnique({ where: { exhibitionId: exhibition.id } });
  if (!post && firstImageUrl) {
    await db.post.create({
      data: { exhibitionId: exhibition.id, authorId: user.id, coverImageUrl: firstImageUrl },
    });
    console.log("Created the feed post.");
  } else if (post) {
    console.log("Feed post already exists.");
  }

  console.log(`\nDone. Public exhibition: ${PUBLIC_EXHIBITION_URL}`);
  console.log(`Account: ${OFFICIAL_EMAIL} (sign in with LAKISA_OFFICIAL_PASSWORD; change it after first sign-in).`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
