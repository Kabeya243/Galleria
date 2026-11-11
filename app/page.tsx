import Dashboard from "@/components/dashboard";
import PublicHome, { type FeaturedPreview, type PublicHomeExhibition } from "@/components/public-home";
import { JsonLd, organizationJsonLd } from "@/components/seo-jsonld";
import { getCurrentUser } from "@/lib/auth";
import { db, withDbRetry } from "@/lib/db";
import { parseGalleryRooms, placedArtworks } from "@/lib/rooms";
import { toServingImageUrl } from "@/lib/r2";
import { loadUserDashboard } from "@/lib/user-dashboard-data";

// A "new" account (welcome tour): created in the last 30 days. The
// tour auto-opens once, on the first dashboard visit; older accounts
// never see it unprompted but can reopen it from the dashboard.
const NEW_USER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

function countRooms(value: string): number {
  try {
    return parseGalleryRooms(value).length;
  } catch {
    return 0;
  }
}

// Every published exhibition on the platform, newest first — the public
// homepage visitors browse without an account, Artsteps-style. Only
// "public" visibility is listed: private-link shows never appear here,
// and password-protected shows neither.
async function findPublicExhibitions(): Promise<PublicHomeExhibition[]> {
  const exhibitions = await db.exhibition.findMany({
    where: { status: "public", visibility: "public" },
    include: {
      owner: { select: { name: true } },
      artworks: { select: { roomId: true, imageUrl: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
  });
  return exhibitions.map((exhibition) => {
    const { count, coverImageUrl } = placedArtworks(exhibition.rooms, exhibition.artworks);
    return {
      id: exhibition.id,
      title: exhibition.title,
      slug: exhibition.slug,
      artistName: exhibition.owner.name,
      roomCount: countRooms(exhibition.rooms),
      artworkCount: count,
      views: exhibition.views,
      coverImageUrl: toServingImageUrl(coverImageUrl),
    };
  });
}

// The hero preview: the newest public exhibition with its first three
// artworks that have an image — the real works, shown live in 3D.
async function findFeaturedPreview(): Promise<FeaturedPreview | null> {
  const exhibition = await db.exhibition.findFirst({
    where: { status: "public", visibility: "public" },
    include: {
      owner: { select: { name: true } },
      artworks: {
        where: { imageUrl: { not: null } },
        select: { id: true, title: true, imageUrl: true, roomId: true },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
  });
  if (!exhibition) return null;
  const { placed, count } = placedArtworks(exhibition.rooms, exhibition.artworks);
  const artworks = placed
    .filter((artwork) => artwork.imageUrl)
    .slice(0, 3)
    .map((artwork) => ({
      id: artwork.id,
      title: artwork.title,
      imageUrl: artwork.imageUrl as string,
    }));
  if (artworks.length === 0) return null;
  return {
    id: exhibition.id,
    title: exhibition.title,
    slug: exhibition.slug,
    artistName: exhibition.owner.name,
    artworkCount: count,
    artworks,
  };
}

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    const [exhibitions, featured] = await withDbRetry(() =>
      Promise.all([findPublicExhibitions(), findFeaturedPreview()]),
    );
    return (
      <>
        <JsonLd data={organizationJsonLd()} />
        <PublicHome exhibitions={exhibitions} featured={featured} />
      </>
    );
  }

  // The overview only: stats, activity chart, top exhibitions. The plan
  // card lives on /dashboard/plan and the visitor analytics on
  // /dashboard/analytics (Nov 2026: the dashboard is pages now, not
  // one long scrolling page).
  const dashboard = await loadUserDashboard(user);

  return (
    <Dashboard
      user={user}
      isNewUser={Date.now() - user.createdAt.getTime() < NEW_USER_WINDOW_MS}
      exhibitionCount={dashboard.exhibitionCount}
      newestExhibition={dashboard.newestExhibition}
      stats={dashboard.stats}
      chart={dashboard.chart}
      chartTotal={dashboard.chartTotal}
      chartRange={dashboard.chartRange}
      topExhibitions={dashboard.topExhibitions}
    />
  );
}
