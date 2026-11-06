import { randomUUID } from "crypto";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";

// Server-side visit logging for public exhibitions (see VisitLog in
// prisma/schema.prisma). Best-effort by design: every write is wrapped
// so logging can never break the page or the API route that calls it.
// No personal data is collected: the visitorKey is a random anonymous
// id, no IP address is ever stored, and country comes only from the
// x-vercel-ip-country header Vercel adds when it knows it — otherwise
// null, never guessed.

export const VISITOR_COOKIE = "sanaa_visitor";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export type DeviceClass = "desktop" | "mobile" | "tablet";

/** Classify a user-agent into a device class; null when it says nothing. */
export function deviceFromUserAgent(ua: string | null): DeviceClass | null {
  if (!ua) return null;
  const lower = ua.toLowerCase();
  if (/tablet|ipad|playbook|silk/.test(lower)) return "tablet";
  if (/mobi|iphone|ipod|android|phone/.test(lower)) return "mobile";
  return "desktop";
}

/** UTC midnight for a date, so daily buckets are a plain group-by. */
export function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export type VisitContext = {
  visitorKey: string;
  country: string | null;
  device: DeviceClass | null;
  referrer: string | null;
};

/**
 * Read the visit context from the incoming request headers. In a Server
 * Component the visitor cookie is read-only, so a missing cookie yields
 * a fresh random key for this one row (the client ensures a persistent
 * cookie exists via POST /api/visits with identifyOnly — see the route).
 * In a Route Handler, use getOrCreateVisitorKey() instead so the key
 * persists.
 */
export async function readVisitContext(): Promise<VisitContext> {
  const h = await headers();
  const jar = await cookies();
  const ua = h.get("user-agent");
  const referrer = h.get("referer");
  return {
    visitorKey: jar.get(VISITOR_COOKIE)?.value ?? randomUUID(),
    country: h.get("x-vercel-ip-country") ?? null,
    device: deviceFromUserAgent(ua),
    referrer: referrer && referrer.length <= 2048 ? referrer : null,
  };
}

/**
 * Route-handler only: return the visitorKey cookie, setting a fresh
 * random one (httpOnly, 1 year) when the visitor has none yet.
 */
export async function getOrCreateVisitorKey(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(VISITOR_COOKIE)?.value;
  if (existing) return existing;
  const key = randomUUID();
  // In a Route Handler the cookie store is mutable; the cast keeps the
  // Server Component (read-only) typing from rejecting the call.
  const mutable = jar as unknown as {
    set: (name: string, value: string, opts: Record<string, unknown>) => void;
  };
  mutable.set(VISITOR_COOKIE, key, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  });
  return key;
}

export type LogVisitInput = {
  exhibitionId: string;
  artworkId?: string | null;
  visitorKey: string;
  country?: string | null;
  device?: DeviceClass | null;
  referrer?: string | null;
  at?: Date;
};

/** Insert one VisitLog row. Never throws — callers must not fail on it. */
export async function logVisit(input: LogVisitInput): Promise<void> {
  try {
    const at = input.at ?? new Date();
    await db.visitLog.create({
      data: {
        exhibitionId: input.exhibitionId,
        artworkId: input.artworkId ?? null,
        day: utcDay(at),
        visitorKey: input.visitorKey,
        country: input.country ?? null,
        device: input.device ?? null,
        referrer: input.referrer ?? null,
      },
    });
  } catch {
    // Visit logging is best-effort; the exhibition page must keep working.
  }
}
