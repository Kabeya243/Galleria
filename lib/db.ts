import { PrismaClient } from "@prisma/client";

// The database is Postgres, provisioned on Vercel via the Prisma Postgres
// integration (DATABASE_URL is a Postgres URL). No SQLite fallback: the
// schema provider is postgresql, and `prisma db push` in the build command
// creates the tables on deploy.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;
