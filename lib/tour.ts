// Guided tour (Nov 2026): one narrative walk per exhibition — the
// visitor follows the artist's stops in order, at their own pace.
//
// Storage: a JSON string in the Exhibition.tour column, exactly like
// Exhibition.rooms (see prisma/schema.prisma). No separate Tour/Stop
// model: there is exactly one tour per exhibition, its payload is tiny
// (≤ 12 stops), it is always edited and saved atomically with the
// exhibition itself, and no query ever needs a stop on its own. A
// separate model would add a migration, a join and a second save path
// for data that is never read apart from its exhibition.
//
// A stop is a stand point in a room (room-local x/z, like the
// TeleportTarget the minimap already walks to) plus the yaw to face
// once there, plus the title and text the visitor reads. Positions are
// room-local so a stop survives the room-plan offsets; the yaw is a
// rotation, so it needs no offset at all.

import { z } from "zod";

export const MAX_TOUR_STOPS = 12;

export const tourStopSchema = z.object({
  id: z.string().min(1).max(64),
  roomId: z.string().min(1).max(64),
  x: z.number().finite().min(-100).max(100),
  z: z.number().finite().min(-100).max(100),
  yaw: z.number().finite().min(-Math.PI * 8).max(Math.PI * 8),
  title: z.string().trim().max(120).default(""),
  text: z.string().max(2000).default(""),
});

export type TourStop = z.infer<typeof tourStopSchema>;

export const guidedTourSchema = z.object({
  enabled: z.boolean().default(false),
  stops: z.array(tourStopSchema).max(MAX_TOUR_STOPS).default([]),
});

export type GuidedTour = z.infer<typeof guidedTourSchema>;

/**
 * Parse a stored tour — the raw JSON string from the database, the
 * parsed object from the API, or nothing. Anything malformed returns
 * null instead of breaking the visit or the editor: an exhibition
 * without a valid tour simply has no guided tour.
 */
export function parseGuidedTour(value: unknown): GuidedTour | null {
  if (value === null || value === undefined) return null;
  try {
    const parsed = typeof value === "string" ? (JSON.parse(value) as unknown) : value;
    return guidedTourSchema.parse(parsed);
  } catch {
    return null;
  }
}

/** A tour is offerable when it is switched on and has at least one stop. */
export function hasUsableTour(tour: GuidedTour | null | undefined): tour is GuidedTour {
  return !!tour && tour.enabled && tour.stops.length > 0;
}

/** Drop stops whose room no longer exists (a room can be deleted after
    its stops were written): a visitor must never be walked to a room
    that is gone. Pure — the stored tour is untouched. */
export function pruneTourStops(tour: GuidedTour | null, roomIds: Iterable<string>): GuidedTour | null {
  if (!tour) return null;
  const known = new Set(roomIds);
  const stops = tour.stops.filter((stop) => known.has(stop.roomId));
  if (stops.length === tour.stops.length) return tour;
  return { ...tour, stops };
}

/** A new stop from the camera's current stand point and look direction
    (the editor's "add a stop from here"): room-local x/z and yaw, an
    empty title and text for the artist to write. */
export function createTourStop(roomId: string, x: number, z: number, yaw: number): TourStop {
  return {
    id: crypto.randomUUID(),
    roomId,
    x: Math.round(x * 100) / 100,
    z: Math.round(z * 100) / 100,
    yaw: Math.round(yaw * 1000) / 1000,
    title: "",
    text: "",
  };
}

/** A stop as the walk target the scene already understands: the same
    room-local point + yaw the minimap teleport walks to, so the tour
    reuses the tested cross-room walk (room switch, then walk to the
    point, then the gentle turn) instead of a blind jump. */
export function tourStopToTeleportTarget(stop: TourStop, nonce: number): {
  roomId: string;
  x: number;
  z: number;
  yaw: number;
  nonce: number;
} {
  return { roomId: stop.roomId, x: stop.x, z: stop.z, yaw: stop.yaw, nonce };
}
