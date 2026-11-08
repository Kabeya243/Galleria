import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import PublicExhibition from "@/components/public-exhibition";
import ExhibitionPasswordGate from "@/components/exhibition-password-gate";
import { toClientArtwork } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUserProfile } from "@/lib/profile";
import { parseGalleryRooms } from "@/lib/rooms";
import { logVisit, readVisitContext } from "@/lib/visits";

type RouteProps = { params: Promise<{ slug: string }> };

// A published exhibition, whatever its visibility: "public" (listed),
// "private-link" (published, never listed — only the direct URL opens
// it) or "password" (published, but a password is asked first). Drafts
// never open here.
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
  // A password-protected show keeps its title and description out of
  // the page metadata — the link must not leak the show before the
  // password is entered.
  if (exhibition.visibility === "password") {
    return { title: "Protected exhibition — SANAA" };
  }
  const description =
    exhibition.description || `A virtual exhibition curated by ${exhibition.owner.name}.`;
  // Open Graph + Twitter per exhibition, so a shared link unfurls with
  // this show's own title, description and cover image. The image is
  // the first artwork with one; without any image the tags still carry
  // title and description (no broken image). The image alt is the
  // artwork's alt-text when it has one (caption/Gemini, validated by the
  // artist), so the shared image is described, not just titled.
  const firstArtwork = exhibition.artworks.find((artwork) => artwork.imageUrl);
  const firstImage = firstArtwork?.imageUrl ?? null;
  const images = firstImage
    ? [{ url: firstImage, alt: firstArtwork?.altText?.trim() ? firstArtwork.altText.trim() : exhibition.title }]
    : [];
  return {
    title: `${exhibition.title} — SANAA`,
    description,
    openGraph: {
      title: `${exhibition.title} — SANAA`,
      description,
      type: "website",
      images,
    },
    twitter: {
      card: images.length ? "summary_large_image" : "summary",
      title: `${exhibition.title} — SANAA`,
      description,
      images: images.map((image) => image.url),
    },
  };
}

export default async function PublicExhibitionPage({ params }: RouteProps) {
  const { slug } = await params;
  const exhibition = await findPublishedExhibition(slug);
  if (!exhibition) notFound();

  // Password-protected: the unlock cookie (set by /unlock after the
  // password is checked) is the only way in — without it, the password
  // screen shows and the works are never sent to the browser.
  if (exhibition.visibility === "password") {
    const store = await cookies();
    if (!store.get(`sanaa_exh_${exhibition.id}`)) {
      return <ExhibitionPasswordGate exhibitionId={exhibition.id} title={exhibition.title} />;
    }
  }

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
        ownerAvatarUrl: (await getUserProfile(exhibition.ownerId)).avatarUrl,
        rooms: parseGalleryRooms(exhibition.rooms),
        artworks: exhibition.artworks.map(toClientArtwork),
      }}
      accessibilityPack={accessibilityPack}
      music={
        exhibition.audioUrl
          ? {
              url: exhibition.audioUrl,
              title: exhibition.audioTitle,
              loop: exhibition.audioLoop,
              volume: exhibition.audioVolume,
            }
          : null
      }
    />
  );
}
