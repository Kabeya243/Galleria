import { toServingImageUrl } from "@/lib/r2";
import { parseGalleryRooms } from "@/lib/rooms";
import { isSculptureServingUrl } from "@/lib/sculpture";
import { isAllowedArtworkImageUrl } from "@/lib/validation";
import { isVideoServingUrl } from "@/lib/video";
import { db } from "@/lib/db";

// Shared library helpers ("Mes œuvres"): the reusable artwork library
// behind GET /api/library, the /artworks page, the editor's "from my
// works" picker and the reuse endpoint.
//
// Model (prisma/schema.prisma, LibraryWork): one canonical row per
// (owner, media URL) — the media URL is the work's identity, because a
// reused work is a COPY of the same R2 file, never a re-upload. For an
// image work the identity is imageUrl; for a video work (Nov 2026) it
// is videoUrl and imageUrl is null; for a sculpture work it is
// sculptureUrl and imageUrl is null (a poster, when one was set, is
// not the identity). An Artwork row belongs to exactly one exhibition
// and carries that exhibition's own position / room / frame, so copies
// are independent rows: editing or moving a copy never touches the
// library row or the copies in other exhibitions.

export type LibraryWorkItem = {
  id: string;
  title: string;
  artist: string;
  year: string;
  medium: string;
  dimensions: string;
  description: string;
  // Null for video works (their media is videoUrl below).
  imageUrl: string | null;
  // Null for image works. A video work's serving URL.
  videoUrl: string | null;
  // Null for image and video works. A sculpture work's GLB serving URL.
  sculptureUrl: string | null;
  frame: string;
  palette: string[] | null;
  altText: string | null;
  createdAt: string;
  /** Exhibitions of this owner where a copy of the work hangs. */
  exhibitionIds: string[];
};

export type LibraryArtworkFields = {
  title: string;
  artist: string;
  year: string;
  medium: string;
  dimensions: string;
  description: string;
  imageUrl: string | null;
  videoUrl?: string | null;
  sculptureUrl?: string | null;
  frame: string;
  palette?: string[] | string | null;
  altText?: string | null;
};

// The identity of a work in the library: its media URL — the sculpture
// URL for a sculpture work, the video URL for a video work, the image
// URL for an image work. Null only for a work with no media at all (a
// text panel), which is never a library work.
function mediaUrlOf(artwork: { imageUrl?: string | null; videoUrl?: string | null; sculptureUrl?: string | null }): string | null {
  // The image goes through the same-origin serving URL (see lib/r2.ts):
  // a stored R2 public URL from an older host would otherwise 404.
  return artwork.sculptureUrl ?? artwork.videoUrl ?? toServingImageUrl(artwork.imageUrl) ?? null;
}

function parsePalette(value: string | null | undefined): string[] | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === "string") : null;
  } catch {
    return null;
  }
}

function toItem(
  row: {
    id: string;
    title: string;
    artist: string;
    year: string;
    medium: string;
    dimensions: string;
    description: string;
    imageUrl: string | null;
    videoUrl: string | null;
    sculptureUrl: string | null;
    frame: string;
    palette: string | null;
    altText: string | null;
    createdAt: Date;
  },
  exhibitionIds: string[],
): LibraryWorkItem {
  return {
    id: row.id,
    title: row.title,
    artist: row.artist,
    year: row.year,
    medium: row.medium,
    dimensions: row.dimensions,
    description: row.description,
    imageUrl: row.imageUrl,
    videoUrl: row.videoUrl,
    sculptureUrl: row.sculptureUrl,
    frame: row.frame,
    palette: parsePalette(row.palette),
    altText: row.altText,
    createdAt: row.createdAt.toISOString(),
    exhibitionIds,
  };
}

// Create the library row for one artwork when it does not exist yet
// (create-only — a copy's title or frame may have been edited for one
// show, so an existing row is never overwritten from a copy). Image
// works upsert on the @@unique([ownerId, imageUrl]); video and
// sculpture works have imageUrl null, which Postgres treats as distinct
// in a unique index, so they go through findFirst + create on their
// own URL instead — the same create-only rule, just a different lookup.
async function ensureLibraryRow(
  ownerId: string,
  artwork: {
    title: string;
    artist: string;
    year: string;
    medium: string;
    dimensions: string;
    description: string;
    imageUrl: string | null;
    videoUrl?: string | null;
    sculptureUrl?: string | null;
    frame: string;
    palette?: string | string[] | null;
    altText?: string | null;
  },
): Promise<void> {
  const sculptureUrl = artwork.sculptureUrl ?? null;
  const videoUrl = sculptureUrl ? null : (artwork.videoUrl ?? null);
  const imageUrl = sculptureUrl || videoUrl ? null : artwork.imageUrl;
  if (sculptureUrl) {
    const existing = await db.libraryWork.findFirst({ where: { ownerId, sculptureUrl }, select: { id: true } });
    if (existing) return;
  } else if (videoUrl) {
    const existing = await db.libraryWork.findFirst({ where: { ownerId, videoUrl }, select: { id: true } });
    if (existing) return;
  }
  const data = {
    ownerId,
    title: artwork.title,
    artist: artwork.artist,
    year: artwork.year,
    medium: artwork.medium,
    dimensions: artwork.dimensions,
    description: artwork.description,
    imageUrl,
    videoUrl,
    sculptureUrl,
    frame: artwork.frame,
    palette: typeof artwork.palette === "string" ? artwork.palette : artwork.palette ? JSON.stringify(artwork.palette) : null,
    altText: artwork.altText ?? null,
  };
  if (sculptureUrl || videoUrl) {
    await db.libraryWork.create({ data });
  } else if (imageUrl) {
    await db.libraryWork.upsert({
      where: { ownerId_imageUrl: { ownerId, imageUrl } },
      update: {},
      create: data,
    });
  }
}

// Backfill: one library row per distinct media URL among the owner's
// artworks (earliest hanging copy supplies the metadata). Works
// without any media (curatorial text panels) are not library works.
// Idempotent — rows already present (same owner + media URL) are left
// alone — so it is safe to run on every library read: existing works
// appear from the first visit, with no migration script to run
// against production and no database access needed from the deploy.
export async function ensureLibraryWorks(ownerId: string): Promise<void> {
  const artworks = await db.artwork.findMany({
    where: { exhibition: { ownerId }, OR: [{ imageUrl: { not: null } }, { videoUrl: { not: null } }, { sculptureUrl: { not: null } }] },
    select: {
      title: true,
      artist: true,
      year: true,
      medium: true,
      dimensions: true,
      description: true,
      imageUrl: true,
      videoUrl: true,
      sculptureUrl: true,
      frame: true,
      palette: true,
      altText: true,
    },
    orderBy: { createdAt: "asc" },
  });
  const seen = new Set<string>();
  for (const artwork of artworks) {
    const mediaUrl = mediaUrlOf(artwork);
    if (!mediaUrl || seen.has(mediaUrl)) continue;
    seen.add(mediaUrl);
    await ensureLibraryRow(ownerId, artwork);
  }
}

// Record freshly saved artworks in the library (create-only, same
// rule as the backfill). Called from the exhibition save (PUT) and
// the single-artwork add (POST /api/artworks) so every new upload
// joins the library without the editor client having to know about it.
export async function upsertLibraryWorks(ownerId: string, artworks: LibraryArtworkFields[]): Promise<void> {
  const seen = new Set<string>();
  for (const artwork of artworks) {
    const mediaUrl = mediaUrlOf(artwork);
    if (!mediaUrl || seen.has(mediaUrl)) continue;
    seen.add(mediaUrl);
    await ensureLibraryRow(ownerId, artwork);
  }
}

// The whole library for one owner: backfill first, then every row
// with the exhibitions where a copy hangs.
export async function listLibraryWorks(ownerId: string): Promise<LibraryWorkItem[]> {
  await ensureLibraryWorks(ownerId);
  const [rows, copies] = await Promise.all([
    db.libraryWork.findMany({
      where: { ownerId },
      orderBy: { createdAt: "desc" },
    }),
    db.artwork.findMany({
      where: { exhibition: { ownerId }, OR: [{ imageUrl: { not: null } }, { videoUrl: { not: null } }, { sculptureUrl: { not: null } }] },
      select: { imageUrl: true, videoUrl: true, sculptureUrl: true, exhibitionId: true },
    }),
  ]);
  const byMedia = new Map<string, Set<string>>();
  for (const copy of copies) {
    const mediaUrl = mediaUrlOf(copy);
    if (!mediaUrl) continue;
    const set = byMedia.get(mediaUrl) ?? new Set<string>();
    set.add(copy.exhibitionId);
    byMedia.set(mediaUrl, set);
  }
  return rows.map((row) => toItem(row, [...(byMedia.get(mediaUrlOf(row) ?? "") ?? [])]));
}

// Copy a library work into an exhibition: a NEW Artwork row with the
// same media URL (the same R2 file — no upload, no new bytes), the
// library's metadata, and a fresh default placement in the target
// room. The copy is independent afterwards: moving it, reframing it
// or deleting it never touches the library row or other exhibitions.
export async function copyLibraryWorkToExhibition(
  ownerId: string,
  libraryWorkId: string,
  exhibitionId: string,
  roomId?: string,
) {
  const [work, exhibition] = await Promise.all([
    db.libraryWork.findFirst({ where: { id: libraryWorkId, ownerId } }),
    db.exhibition.findFirst({ where: { id: exhibitionId, ownerId }, select: { id: true, rooms: true } }),
  ]);
  if (!work) return { error: "Work not found in your library.", status: 404 as const };
  if (!exhibition) return { error: "Exhibition not found.", status: 404 as const };
  // A work with no usable media (a dead image link, no image at all)
  // cannot hang: refuse it here instead of creating a black
  // placeholder copy the editor would have to strip at save time. A
  // stored R2 URL from an older host still counts: it normalizes to
  // the serving URL, and the copy stores the normalized URL.
  const servingImageUrl = work.imageUrl ? toServingImageUrl(work.imageUrl) : null;
  const hasUsableMedia =
    (servingImageUrl && isAllowedArtworkImageUrl(servingImageUrl)) ||
    (work.videoUrl && isVideoServingUrl(work.videoUrl)) ||
    (work.sculptureUrl && isSculptureServingUrl(work.sculptureUrl));
  if (!hasUsableMedia) {
    return {
      error: `"${work.title}" has no image to hang. Its image link is broken, so re-upload the image in the library first.`,
      status: 400 as const,
    };
  }
  const mediaUrl = mediaUrlOf(work);
  // One copy per exhibition: a second add of the same work used to
  // create another Artwork row stacked on exactly the same spot, and
  // the exhibitions list counted every copy.
  const existingCopies = await db.artwork.findMany({
    where: { exhibitionId },
    select: { imageUrl: true, videoUrl: true, sculptureUrl: true },
  });
  if (mediaUrl && existingCopies.some((copy) => mediaUrlOf(copy) === mediaUrl)) {
    return { error: `"${work.title}" is already in that exhibition.`, status: 409 as const };
  }
  // The copy hangs in a real room of the exhibition: the room the
  // caller asked for when it exists, else the first room. The old
  // default ("room-main") is not a room of most exhibitions, so the
  // copy was invisible in the editor while still counted in the list.
  let targetRoomId = "room-main";
  try {
    const rooms = parseGalleryRooms(exhibition.rooms);
    if (roomId && rooms.some((room) => room.id === roomId)) targetRoomId = roomId;
    else if (rooms[0]) targetRoomId = rooms[0].id;
  } catch {
    // A rooms value that does not parse keeps the old default.
  }
  // Spread the copies along the back wall instead of stacking them
  // all on the same spot: each new copy steps 1.5 m sideways.
  const inRoomCount = await db.artwork.count({ where: { exhibitionId, roomId: targetRoomId } });
  const alongOffset = ((inRoomCount % 5) - 2) * 1.5;
  const artwork = await db.artwork.create({
    data: {
      title: work.title,
      artist: work.artist,
      year: work.year,
      medium: work.medium,
      dimensions: work.dimensions,
      description: work.description,
      imageUrl: servingImageUrl ?? work.imageUrl,
      videoUrl: work.videoUrl,
      sculptureUrl: work.sculptureUrl,
      frame: work.frame,
      palette: work.palette,
      altText: work.altText,
      // A sculpture copy stands on the floor at the room's centre,
      // not on the wall at eye level — the editor moves it from there.
      positionX: alongOffset,
      positionY: work.sculptureUrl ? 0 : 2.5,
      positionZ: work.sculptureUrl ? 2 : -5.72,
      rotation: 0,
      scale: 1,
      roomId: targetRoomId,
      exhibitionId,
    },
  });
  return { artwork, status: 201 as const };
}

// Remove one library work from one exhibition: delete the copies of
// the work that hang there (by media URL, so a copy re-titled for
// that show still matches). The library row stays, and copies in
// other exhibitions are untouched. Returns how many copies went.
export async function removeLibraryWorkFromExhibition(
  ownerId: string,
  libraryWorkId: string,
  exhibitionId: string,
) {
  const [work, exhibition] = await Promise.all([
    db.libraryWork.findFirst({ where: { id: libraryWorkId, ownerId } }),
    db.exhibition.findFirst({ where: { id: exhibitionId, ownerId }, select: { id: true } }),
  ]);
  if (!work) return { error: "Work not found in your library.", status: 404 as const };
  if (!exhibition) return { error: "Exhibition not found.", status: 404 as const };
  const mediaUrl = mediaUrlOf(work);
  if (!mediaUrl) return { error: "This work has no image to remove.", status: 400 as const };
  const deleted = await db.artwork.deleteMany({
    where: {
      exhibitionId,
      ...(work.sculptureUrl
        ? { sculptureUrl: work.sculptureUrl }
        : work.videoUrl
          ? { videoUrl: work.videoUrl }
          : { imageUrl: work.imageUrl }),
    },
  });
  // The stored imageUrl may be a stale R2 URL while the copy stores
  // the normalized serving URL (or the other way round): match on the
  // normalized media URL too, so no copy is left behind.
  const copies = await db.artwork.findMany({
    where: { exhibitionId },
    select: { id: true, imageUrl: true, videoUrl: true, sculptureUrl: true },
  });
  const staleIds = copies.filter((copy) => mediaUrlOf(copy) === mediaUrl).map((copy) => copy.id);
  if (staleIds.length > 0) {
    await db.artwork.deleteMany({ where: { id: { in: staleIds } } });
  }
  return { removedCopies: deleted.count + staleIds.length, status: 200 as const };
}

// The one explicit, confirmed delete (from "Mes œuvres"): the library
// row AND every copy hanging in the owner's exhibitions. The copies
// have to go too — otherwise the next library read would backfill the
// row straight back from the copy still on the wall. The R2 file is
// never deleted. Returns how many exhibition copies went with it.
export async function deleteLibraryWorkAndCopies(ownerId: string, libraryWorkId: string) {
  const work = await db.libraryWork.findFirst({ where: { id: libraryWorkId, ownerId } });
  if (!work) return { error: "Work not found in your library.", status: 404 as const };
  const mediaUrl = mediaUrlOf(work);
  const deleted = await db.artwork.deleteMany({
    where: {
      exhibition: { ownerId },
      ...(work.sculptureUrl
        ? { sculptureUrl: work.sculptureUrl }
        : work.videoUrl
          ? { videoUrl: work.videoUrl }
          : { imageUrl: mediaUrl }),
    },
  });
  await db.libraryWork.delete({ where: { id: work.id } });
  return { deletedCopies: deleted.count, status: 200 as const };
}
