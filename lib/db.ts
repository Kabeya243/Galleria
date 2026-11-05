import { PrismaClient } from "@prisma/client";

// On Vercel the filesystem is read-only except /tmp, and DATABASE_URL may be
// unset in the dashboard. Default to a /tmp SQLite file so the app runs as a
// demo. Data there is ephemeral: it disappears when the serverless instance
// recycles. Real persistence needs a hosted database (Postgres).
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = "file:/tmp/sanaa.db";
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const baseDb =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = baseDb;

// Create the tables on first use when the database file is fresh
// (a new /tmp file on Vercel has no schema). Runs once per instance.
// DDL matches `npx prisma migrate diff --from-empty --to-schema-datamodel`.
const SCHEMA_STATEMENTS = [
  `CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`,
  `CREATE TABLE IF NOT EXISTS "Exhibition" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'draft',
    "roomColor" TEXT NOT NULL DEFAULT '#f5f2eb',
    "rooms" TEXT NOT NULL DEFAULT '[{"id":"room-main","name":"Room 1","layout":"cube","wallColor":"#f5f2eb","sideWallColor":"#e2ded6","floorColor":"#3f3d3a","ceilingColor":"#f5f2eb","wallTexture":"plaster","floorTexture":"stone","ceilingTexture":"plaster","spotlights":true,"partitionWalls":[],"curatorialText":""}]',
    "views" INTEGER NOT NULL DEFAULT 0,
    "publishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "ownerId" TEXT NOT NULL,
    CONSTRAINT "Exhibition_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE TABLE IF NOT EXISTS "Artwork" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "artist" TEXT NOT NULL DEFAULT '',
    "year" TEXT NOT NULL DEFAULT '',
    "medium" TEXT NOT NULL DEFAULT '',
    "dimensions" TEXT NOT NULL DEFAULT '',
    "description" TEXT NOT NULL DEFAULT '',
    "color" TEXT NOT NULL DEFAULT '#b8a184',
    "accent" TEXT NOT NULL DEFAULT '#343e36',
    "positionX" REAL NOT NULL DEFAULT 0,
    "positionY" REAL NOT NULL DEFAULT 2.5,
    "positionZ" REAL NOT NULL DEFAULT -5.72,
    "rotation" REAL NOT NULL DEFAULT 0,
    "scale" REAL NOT NULL DEFAULT 1,
    "imageUrl" TEXT,
    "roomId" TEXT NOT NULL DEFAULT 'room-main',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "exhibitionId" TEXT NOT NULL,
    CONSTRAINT "Artwork_exhibitionId_fkey" FOREIGN KEY ("exhibitionId") REFERENCES "Exhibition" ("id") ON DELETE CASCADE ON UPDATE CASCADE
  )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email")`,
  `CREATE UNIQUE INDEX IF NOT EXISTS "Exhibition_slug_key" ON "Exhibition"("slug")`,
  `CREATE INDEX IF NOT EXISTS "Exhibition_ownerId_idx" ON "Exhibition"("ownerId")`,
  `CREATE INDEX IF NOT EXISTS "Exhibition_status_slug_idx" ON "Exhibition"("status", "slug")`,
  `CREATE INDEX IF NOT EXISTS "Artwork_exhibitionId_idx" ON "Artwork"("exhibitionId")`,
];

let schemaEnsured = false;
let schemaPromise: Promise<void> | null = null;

async function ensureSchema(): Promise<void> {
  if (schemaEnsured) return;
  if (!schemaPromise) {
    schemaPromise = (async () => {
      for (const statement of SCHEMA_STATEMENTS) {
        await baseDb.$executeRawUnsafe(statement);
      }
      schemaEnsured = true;
    })();
  }
  await schemaPromise;
}

// Every database operation first makes sure the tables exist, so a fresh
// demo database (Vercel /tmp) initializes itself on first use.
export const db = baseDb.$extends({
  query: {
    async $allOperations({ args, query }) {
      await ensureSchema();
      return query(args);
    },
  },
});
