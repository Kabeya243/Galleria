// Shared server-side loading for a published exhibition's public
// viewer — used by the public page (app/exhibition/[slug]/page.tsx)
// and by the chromeless embed page (app/embed/exhibition/[slug]/page.tsx).
// Both pages render the same visit; only the surrounding chrome and
// the visibility gate differ.

import { toClientArtwork } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserProfile } from "@/lib/profile";
import { parseGalleryRooms } from "@/lib/rooms";
import { parseGuidedTour, pruneTourStops, type GuidedTour } from "@/lib/tour";
import type { ExhibitionMusic } from "@/components/exhibition-audio-player";
import type { PublicAccessibilityPack } from "@/components/public-exhibition";

// A published exhibition, whatever its visibility: "public" (listed),
// "private-link" (published, never listed — only the direct URL opens
// it) or "password" (published, but a password is asked first). Drafts
// never open here.
export async function findPublishedExhibition(slug: string) {
  return db.exhibition.findFirst({
    where: { slug, status: "public" },
    include: {
      owner: { select: { name: true } },
      artworks: { orderBy: { createdAt: "asc" } },
    },
  });
}

export type PublishedExhibition = NonNullable<
  Awaited<ReturnType<typeof findPublishedExhibition>>
>;

export async function loadAccessibilityPack(
  ownerId: string,
  exhibitionId: string,
): Promise<PublicAccessibilityPack | null> {
  const packRows = await db.savedWork.findMany({
    where: { userId: ownerId, kind: "accessibility-pack" },
    orderBy: { updatedAt: "desc" },
  });
  for (const row of packRows) {
    try {
      const data = JSON.parse(row.data) as {
        exhibitionId?: string;
        introEn?: string;
        introFr?: string;
        entries?: Record<
          string,
          {
            audioDescription?: string;
            audioDescriptionFr?: string;
            artistNarration?: string;
            curatorNarration?: string;
            caption?: string;
            captionFr?: string;
            transcript?: string;
          }
        >;
      };
      if (data.exhibitionId !== exhibitionId) continue;
      const entries = Object.entries(data.entries ?? {})
        .map(([artworkId, entry]) => ({
          artworkId,
          audioDescription: entry.audioDescription ?? "",
          audioDescriptionFr: entry.audioDescriptionFr ?? "",
          artistNarration: entry.artistNarration ?? "",
          curatorNarration: entry.curatorNarration ?? "",
          caption: entry.caption ?? "",
          captionFr: entry.captionFr ?? "",
          transcript: entry.transcript ?? "",
        }))
        .filter(
          (entry) =>
            entry.audioDescription.trim() ||
            entry.audioDescriptionFr.trim() ||
            entry.artistNarration.trim() ||
            entry.curatorNarration.trim() ||
            entry.caption.trim() ||
            entry.transcript.trim(),
        );
      if (entries.length > 0 || (data.introEn ?? "").trim() || (data.introFr ?? "").trim()) {
        return {
          introEn: data.introEn ?? "",
          introFr: data.introFr ?? "",
          entries,
        };
      }
      break;
    } catch {
      continue;
    }
  }
  return null;
}

/**
 * Everything the public viewer needs for one published exhibition:
 * the exhibition itself (with rooms, artworks and owner avatar),
 * its accessibility pack (null when none) and its background music
 * (null when none). Returns null when the slug is not a published
 * exhibition. Callers apply their own visibility gate on top.
 */
export async function loadPublicExhibition(slug: string): Promise<{
  exhibition: {
    id: string;
    slug: string;
    title: string;
    description: string;
    ownerId: string;
    ownerName: string;
    ownerAvatarUrl?: string | null;
    visibility: string;
    rooms: ReturnType<typeof parseGalleryRooms>;
    artworks: ReturnType<typeof toClientArtwork>[];
    // The exhibition's guided tour, if any — stops whose room no
    // longer exists are pruned, so the visitor is never walked to a
    // room that is gone. Null when the exhibition has no tour.
    tour: GuidedTour | null;
  };
  accessibilityPack: PublicAccessibilityPack | null;
  music: ExhibitionMusic | null;
} | null> {
  const exhibition = await findPublishedExhibition(slug);
  if (!exhibition) return null;
  const rooms = parseGalleryRooms(exhibition.rooms);
  return {
    exhibition: {
      id: exhibition.id,
      slug: exhibition.slug,
      title: exhibition.title,
      description: exhibition.description,
      ownerId: exhibition.ownerId,
      ownerName: exhibition.owner.name,
      ownerAvatarUrl: (await getUserProfile(exhibition.ownerId)).avatarUrl,
      visibility: exhibition.visibility,
      rooms,
      tour: pruneTourStops(parseGuidedTour(exhibition.tour), rooms.map((room) => room.id)),
      artworks: exhibition.artworks.map(toClientArtwork),
    },
    accessibilityPack: await loadAccessibilityPack(exhibition.ownerId, exhibition.id),
    music: exhibition.audioUrl
      ? {
          url: exhibition.audioUrl,
          title: exhibition.audioTitle,
          loop: exhibition.audioLoop,
          volume: exhibition.audioVolume,
        }
      : null,
  };
}
