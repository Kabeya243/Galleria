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

// Transient Prisma errors worth one retry (serverless cold starts,
// Neon idle connections, brief pool exhaustion). A retry never fixes
// a deterministic error, so only these codes — and the matching
// connection messages — are retried. This is what turned an occasional
// hiccup into a full "Application error" page on the dashboard.
const TRANSIENT_PRISMA_CODES = new Set(["P1001", "P1002", "P1008", "P1017", "P2024"]);

export function isTransientDbError(error: unknown): boolean {
  if (typeof error === "object" && error !== null && "code" in error) {
    const code = (error as { code?: unknown }).code;
    if (typeof code === "string" && TRANSIENT_PRISMA_CODES.has(code)) return true;
  }
  const message = error instanceof Error ? error.message : "";
  return /can't reach database server|connection (timed out|closed|terminated)|timed out fetching/i.test(
    message,
  );
}

/** Run a database call, retrying transient connection failures. */
export async function withDbRetry<T>(fn: () => Promise<T>, attempts = 3): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (!isTransientDbError(error) || attempt === attempts - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 150 * (attempt + 1)));
    }
  }
  throw lastError;
}
