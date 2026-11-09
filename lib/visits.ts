import { randomUUID } from "crypto";
import { cookies, headers } from "next/headers";
import { db } from "@/lib/db";
import {
  deviceFromUserAgent,
  parseUserAgent,
  type DeviceClass,
} from "@/lib/user-agent";

export { deviceFromUserAgent, type DeviceClass };

// Server-side visit logging for public exhibitions (see VisitLog in
// prisma/schema.prisma). Best-effort by design: every write is wrapped
// so logging can never break the page or the API route that calls it.
// No personal data is collected: the visitorKey is a random anonymous
// id, no IP address is ever stored, and country comes only from the
// x-vercel-ip-country header Vercel adds when it knows it, otherwise
// null, never guessed.

export const VISITOR_COOKIE = "sanaa_visitor";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365; // 1 year

export type VisitGeo = {
  country: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
};

function cleanHeader(value: string | null): string | null {
  if (!value) return null;
  const v = value.trim();
  if (!v || v.toLowerCase() === "unknown") return null;
  return v;
}

// Vercel percent-encodes the city (for example "New%20York").
function decodeCity(value: string | null): string | null {
  const v = cleanHeader(value);
  if (!v) return null;
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function parseCoordinate(value: string | null): number | null {
  const v = cleanHeader(value);
  if (!v) return null;
  const n = Number.parseFloat(v);
  return Number.isFinite(n) ? n : null;
}

/**
 * IP geolocation from the headers Vercel adds. This is city level: the
 * headers come from an IP database, never from GPS. The site never asks
 * visitors for their position, so there is no exact location to store.
 * Missing headers (local dev, non-Vercel hosting) yield nulls.
 */
export function geoFromHeaders(h: Headers): VisitGeo {
  return {
    country: cleanHeader(h.get("x-vercel-ip-country")),
    city: decodeCity(h.get("x-vercel-ip-city")),
    region: cleanHeader(h.get("x-vercel-ip-country-region")),
    latitude: parseCoordinate(h.get("x-vercel-ip-latitude")),
    longitude: parseCoordinate(h.get("x-vercel-ip-longitude")),
  };
}

/** UTC midnight for a date, so daily buckets are a plain group-by. */
export function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

export type VisitContext = {
  visitorKey: string;
  country: string | null;
  city: string | null;
  region: string | null;
  latitude: number | null;
  longitude: number | null;
  device: DeviceClass | null;
  os: string | null;
  browser: string | null;
  referrer: string | null;
};

/**
 * Read the visit context from the incoming request headers. In a Server
 * Component the visitor cookie is read-only, so a missing cookie yields
 * a fresh random key for this one row (the client ensures a persistent
 * cookie exists via POST /api/visits with identifyOnly, see the route).
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
    ...geoFromHeaders(h),
    ...parseUserAgent(ua),
    referrer: referrer && referrer.length <= 2048 ? referrer : null,
  };
}

/**
 * Same as readVisitContext, but from a Route Handler's request headers
 * (a plain Headers object, not next/headers). Used by /api/visits.
 */
export function visitContextFromHeaders(h: Headers, visitorKey: string): VisitContext {
  const referrer = h.get("referer");
  return {
    visitorKey,
    ...geoFromHeaders(h),
    ...parseUserAgent(h.get("user-agent")),
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
  city?: string | null;
  region?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  device?: DeviceClass | null;
  os?: string | null;
  browser?: string | null;
  referrer?: string | null;
  at?: Date;
};

/** Insert one VisitLog row. Never throws, callers must not fail on it. */
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
        city: input.city ?? null,
        region: input.region ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        device: input.device ?? null,
        os: input.os ?? null,
        browser: input.browser ?? null,
        referrer: input.referrer ?? null,
      },
    });
  } catch {
    // Visit logging is best-effort; the exhibition page must keep working.
  }
}
