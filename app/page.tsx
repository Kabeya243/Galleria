import Dashboard from "@/components/dashboard";
import PublicHome, { type FeaturedPreview, type PublicHomeExhibition } from "@/components/public-home";
import { getCurrentUser } from "@/lib/auth";
import { db, withDbRetry } from "@/lib/db";
import { parseGalleryRooms } from "@/lib/rooms";
import { toServingImageUrl } from "@/lib/r2";
import { getExhibitionAnalytics } from "@/lib/visitor-analytics-server";

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
      _count: { select: { artworks: true } },
      artworks: { select: { imageUrl: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
    orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
  });
  return exhibitions.map((exhibition) => ({
    id: exhibition.id,
    title: exhibition.title,
    slug: exhibition.slug,
    artistName: exhibition.owner.name,
    roomCount: countRooms(exhibition.rooms),
    artworkCount: exhibition._count.artworks,
    views: exhibition.views,
    coverImageUrl: toServingImageUrl(exhibition.artworks[0]?.imageUrl),
  }));
}

// The hero preview: the newest public exhibition with its first three
// artworks that have an image — the real works, shown live in 3D.
async function findFeaturedPreview(): Promise<FeaturedPreview | null> {
  const exhibition = await db.exhibition.findFirst({
    where: { status: "public", visibility: "public" },
    include: {
      owner: { select: { name: true } },
      _count: { select: { artworks: true } },
      artworks: {
        where: { imageUrl: { not: null } },
        select: { id: true, title: true, imageUrl: true },
        orderBy: { createdAt: "asc" },
        take: 3,
      },
    },
    orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
  });
  if (!exhibition) return null;
  const artworks = exhibition.artworks
    .filter((artwork) => artwork.imageUrl)
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
    artworkCount: exhibition._count.artworks,
    artworks,
  };
}

const DAY_MS = 86_400_000;

function utcDayStart(time: number): number {
  const d = new Date(time);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

function deltaText(recentCount: number): { delta: string; tone: "up" | "flat" } {
  if (recentCount > 0) {
    return { delta: `+${recentCount} in the last 7 days`, tone: "up" };
  }
  return { delta: "No new in the last 7 days", tone: "flat" };
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ exhibitionId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) {
    const [exhibitions, featured] = await withDbRetry(() =>
      Promise.all([findPublicExhibitions(), findFeaturedPreview()]),
    );
    return <PublicHome exhibitions={exhibitions} featured={featured} />;
  }

  const { exhibitionId } = await searchParams;

  // Retried: a transient connection failure here used to take the
  // whole dashboard down with an "Application error" page.
  const exhibitions = await withDbRetry(() =>
    db.exhibition.findMany({
      where: { ownerId: user.id },
      include: {
        artworks: {
          select: { id: true, createdAt: true, imageUrl: true },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { artworks: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  );
  const artworks = exhibitions.flatMap((exhibition) => exhibition.artworks);
  // Distinct works, not placements: one library item can sit in several
  // exhibitions, and the count used to jump when an existing work was
  // added to a show. Same rule as the artwork library (media URL,
  // falling back to the row id when there is no image).
  const artworkCount = new Set(artworks.map((a) => a.imageUrl ?? `id:${a.id}`)).size;
  const viewCount = exhibitions.reduce((count, exhibition) => count + exhibition.views, 0);
  const publicExhibitions = exhibitions.filter((exhibition) => exhibition.status === "public");

  // Windows in UTC days (createdAt is stored in UTC).
  const now = Date.now();
  const todayStart = utcDayStart(now);
  const last7Start = todayStart - 6 * DAY_MS;
  const last7End = todayStart + DAY_MS;
  const inLast7Days = (time: number) => time >= last7Start && time < last7End;

  const exhibitionsRecent = exhibitions.filter((e) => inLast7Days(e.createdAt.getTime())).length;
  const artworksRecent = artworks.filter((a) => inLast7Days(a.createdAt.getTime())).length;
  const publishedRecent = publicExhibitions.filter(
    (e) => e.publishedAt && inLast7Days(e.publishedAt.getTime()),
  ).length;

  // Artworks added per day, last 14 days, oldest first. Visits have no
  // per-day history (only a total per exhibition), so the chart shows
  // creation activity instead — never invented visit history.
  const chart = Array.from({ length: 14 }, (_, index) => {
    const dayStart = todayStart - (13 - index) * DAY_MS;
    const dayEnd = dayStart + DAY_MS;
    const count = artworks.filter((a) => {
      const t = a.createdAt.getTime();
      return t >= dayStart && t < dayEnd;
    }).length;
    const d = new Date(dayStart);
    return {
      label: String(d.getUTCDate()),
      full: d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" }),
      count,
      isRecentWeek: index >= 7,
    };
  });
  const chartTotal = chart.reduce((sum, day) => sum + day.count, 0);
  const chartRange = `${chart[0].full} – ${chart[13].full}`;

  const topExhibitions = [...exhibitions]
    .sort((a, b) => b.views - a.views)
    .slice(0, 6)
    .map((exhibition) => ({
      id: exhibition.id,
      title: exhibition.title,
      slug: exhibition.slug,
      status: exhibition.status,
      views: exhibition.views,
      artworkCount: exhibition._count.artworks,
    }));

  // Visitor analytics (merged here from the old Visitor Analytics tool,
  // Nov 2026): the full per-exhibition analytics live on the dashboard
  // now, under #visitor-analytics. The selected exhibition comes from
  // ?exhibitionId=, defaulting to the most recently updated one.
  const analyticsExhibitions = exhibitions.map((exhibition) => ({
    id: exhibition.id,
    title: exhibition.title,
    slug: exhibition.slug,
    status: exhibition.status,
    views: exhibition.views,
  }));
  const selectedAnalytics =
    analyticsExhibitions.find((e) => e.id === exhibitionId) ?? analyticsExhibitions[0] ?? null;
  const analytics = selectedAnalytics
    ? await withDbRetry(() => getExhibitionAnalytics(selectedAnalytics.id)).catch(() => null)
    : null;

  return (
    <Dashboard
      user={user}
      exhibitionCount={exhibitions.length}
      stats={{
        exhibitions: { value: exhibitions.length, ...deltaText(exhibitionsRecent) },
        artworks: { value: artworkCount, ...deltaText(artworksRecent) },
        views: { value: viewCount, note: "All time · page loads" },
        publicExhibitions: { value: publicExhibitions.length, ...deltaText(publishedRecent) },
      }}
      chart={chart}
      chartTotal={chartTotal}
      chartRange={chartRange}
      topExhibitions={topExhibitions}
      visitorAnalytics={
        analytics && selectedAnalytics
          ? {
              exhibitions: analyticsExhibitions,
              selectedId: selectedAnalytics.id,
              selectedSlug: selectedAnalytics.slug,
              selectedTitle: selectedAnalytics.title,
              ...analytics,
            }
          : null
      }
    />
  );
}
