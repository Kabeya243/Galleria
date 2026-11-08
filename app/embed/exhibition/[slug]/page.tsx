import type { Metadata } from "next";
import EmbedUnavailable from "@/components/embed-unavailable";
import PublicExhibition from "@/components/public-exhibition";
import { db } from "@/lib/db";
import { isEmbeddableExhibition } from "@/lib/embed";
import { findPublishedExhibition, loadPublicExhibition } from "@/lib/exhibition-public";
import { logVisit, readVisitContext } from "@/lib/visits";

type RouteProps = { params: Promise<{ slug: string }> };

// Embed page for a public exhibition: the same 3D visit as the public
// page, without any SANAA platform chrome (no back link, no share
// panel, no login or platform navigation) so it can live inside an
// <iframe> on the artist's own site or a third-party site.
//
// Only published + public exhibitions are embeddable. Anything else —
// draft, private-link or password-protected — renders the same generic
// error page with no title, description or artwork, so the embed can
// never leak a show that is not public. The page is never indexed.
export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const exhibition = await findPublishedExhibition(slug);
  const embeddable = exhibition !== null && isEmbeddableExhibition(exhibition);
  return {
    title: embeddable ? `${exhibition.title} — SANAA` : "Exhibition not available — SANAA",
    robots: { index: false, follow: false },
  };
}

export default async function EmbedExhibitionPage({ params }: RouteProps) {
  const { slug } = await params;
  const loaded = await loadPublicExhibition(slug);
  // Not published, not public, private-link or password-protected:
  // the same generic error either way — no title, no description, no
  // artwork, no hint about which case it is.
  if (!loaded || !isEmbeddableExhibition({ status: "public", visibility: loaded.exhibition.visibility })) {
    return <EmbedUnavailable />;
  }
  const { exhibition, accessibilityPack, music } = loaded;

  // An embed view is a real visit: same counter and per-day history
  // as the public page.
  await db.exhibition.update({
    where: { id: exhibition.id },
    data: { views: { increment: 1 } },
  });
  const visit = await readVisitContext();
  await logVisit({ exhibitionId: exhibition.id, ...visit });

  return (
    <PublicExhibition
      exhibition={exhibition}
      accessibilityPack={accessibilityPack}
      music={music}
      embedded
    />
  );
}
