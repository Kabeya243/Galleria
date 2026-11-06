import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicExhibition from "@/components/public-exhibition";
import { toClientArtwork } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseGalleryRooms } from "@/lib/rooms";
import { logVisit, readVisitContext } from "@/lib/visits";

type RouteProps = { params: Promise<{ slug: string }> };

async function findPublishedExhibition(slug: string) {
  return db.exhibition.findFirst({
    where: { slug, status: "public" },
    include: {
      owner: { select: { name: true } },
      artworks: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const exhibition = await findPublishedExhibition(slug);
  if (!exhibition) return { title: "Exhibition not found — SANAA" };
  return {
    title: `${exhibition.title} — SANAA`,
    description: exhibition.description || `A virtual exhibition curated by ${exhibition.owner.name}.`,
  };
}

export default async function PublicExhibitionPage({ params }: RouteProps) {
  const { slug } = await params;
  const exhibition = await findPublishedExhibition(slug);
  if (!exhibition) notFound();

  await db.exhibition.update({
    where: { id: exhibition.id },
    data: { views: { increment: 1 } },
  });

  // Per-day visit history behind the blunt views counter. Best-effort:
  // logVisit never throws, so a logging failure cannot break the page.
  const visit = await readVisitContext();
  await logVisit({ exhibitionId: exhibition.id, ...visit });

  // Accessibility pack (Accessibility & Audio Guide Studio): the owner
  // writes audio descriptions, narration, captions and transcripts per
  // artwork; when a pack exists for this exhibition the public viewer
  // surfaces it in an Accessibility panel. Stored as SavedWork kind
  // "accessibility-pack" with the exhibition id inside its data JSON.
  let accessibilityPack: {
    introEn: string;
    introFr: string;
    entries: {
      artworkId: string;
      audioDescription: string;
      audioDescriptionFr: string;
      artistNarration: string;
      curatorNarration: string;
      caption: string;
      captionFr: string;
      transcript: string;
    }[];
  } | null = null;
  const packRows = await db.savedWork.findMany({
    where: { userId: exhibition.ownerId, kind: "accessibility-pack" },
    orderBy: { updatedAt: "desc" },
  });
  for (const row of packRows) {
    try {
      const data = JSON.parse(row.data) as {
        exhibitionId?: string;
        introEn?: string;
        introFr?: string;
        entries?: Record<string, {
          audioDescription?: string;
          audioDescriptionFr?: string;
          artistNarration?: string;
          curatorNarration?: string;
          caption?: string;
          captionFr?: string;
          transcript?: string;
        }>;
      };
      if (data.exhibitionId !== exhibition.id) continue;
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
        .filter((entry) =>
          entry.audioDescription.trim() ||
          entry.audioDescriptionFr.trim() ||
          entry.artistNarration.trim() ||
          entry.curatorNarration.trim() ||
          entry.caption.trim() ||
          entry.transcript.trim(),
        );
      if (entries.length > 0 || (data.introEn ?? "").trim() || (data.introFr ?? "").trim()) {
        accessibilityPack = {
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

  return (
    <PublicExhibition
      exhibition={{
        id: exhibition.id,
        title: exhibition.title,
        description: exhibition.description,
        ownerName: exhibition.owner.name,
        rooms: parseGalleryRooms(exhibition.rooms),
        artworks: exhibition.artworks.map(toClientArtwork),
      }}
      accessibilityPack={accessibilityPack}
    />
  );
}
