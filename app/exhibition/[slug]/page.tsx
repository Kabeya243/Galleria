import type { Metadata } from "next";
import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import PublicExhibition from "@/components/public-exhibition";
import ExhibitionPasswordGate from "@/components/exhibition-password-gate";
import { db } from "@/lib/db";
import { findPublishedExhibition, loadPublicExhibition } from "@/lib/exhibition-public";
import { logVisit, readVisitContext } from "@/lib/visits";

type RouteProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const exhibition = await findPublishedExhibition(slug);
  if (!exhibition) return { title: "Exhibition not found: Lakisa VR" };
  // A password-protected show keeps its title and description out of
  // the page metadata — the link must not leak the show before the
  // password is entered.
  if (exhibition.visibility === "password") {
    return { title: "Protected exhibition: Lakisa VR" };
  }
  const description =
    exhibition.description || `A virtual exhibition curated by ${exhibition.owner.name}.`;
  // Open Graph + Twitter per exhibition, so a shared link unfurls with
  // this show's own title, description and image. The image is the
  // first artwork with one; without any image the tags still carry
  // title and description (no broken image). The image alt is the
  // artwork's alt-text when it has one (caption/Gemini, validated by the
  // artist), so the shared image is described, not just titled.
  const firstArtwork = exhibition.artworks.find((artwork) => artwork.imageUrl);
  const firstImage = firstArtwork?.imageUrl ?? null;
  const images = firstImage
    ? [{ url: firstImage, alt: firstArtwork?.altText?.trim() ? firstArtwork.altText.trim() : exhibition.title }]
    : [];
  return {
    title: `${exhibition.title}: Lakisa VR`,
    description,
    openGraph: {
      title: `${exhibition.title}: Lakisa VR`,
      description,
      type: "website",
      images,
    },
    twitter: {
      card: images.length ? "summary_large_image" : "summary",
      title: `${exhibition.title}: Lakisa VR`,
      description,
      images: images.map((image) => image.url),
    },
  };
}

export default async function PublicExhibitionPage({ params }: RouteProps) {
  const { slug } = await params;
  const loaded = await loadPublicExhibition(slug);
  if (!loaded) notFound();
  const { exhibition, accessibilityPack, music } = loaded;

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

  return (
    <PublicExhibition
      exhibition={exhibition}
      accessibilityPack={accessibilityPack}
      music={music}
    />
  );
}
