import Dashboard from "@/components/dashboard";
import PublicHome, { type FeaturedPreview, type PublicHomeExhibition } from "@/components/public-home";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseGalleryRooms } from "@/lib/rooms";

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
    coverImageUrl: exhibition.artworks[0]?.imageUrl ?? null,
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

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    const [exhibitions, featured] = await Promise.all([
      findPublicExhibitions(),
      findFeaturedPreview(),
    ]);
    return <PublicHome exhibitions={exhibitions} featured={featured} />;
  }

  const exhibitions = await db.exhibition.findMany({
    where: { ownerId: user.id },
    include: {
      artworks: { select: { id: true, createdAt: true }, orderBy: { createdAt: "desc" } },
      _count: { select: { artworks: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const artworks = exhibitions.flatMap((exhibition) => exhibition.artworks);
  const artworkCount = artworks.length;
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

  // Creator visit statistics (feature 6): from VisitLog — exhibition-level
  // rows only (artworkId null) for visits and duration, artwork rows for
  // the most-viewed works. Country comes only from the Vercel geo header
  // (x-vercel-ip-country); a missing country is never guessed.
  const exhibitionIds = exhibitions.map((exhibition) => exhibition.id);
  const [visitAggregate, topArtworkRows, topCountryRows] = await Promise.all([
    db.visitLog.aggregate({
      where: { exhibitionId: { in: exhibitionIds }, artworkId: null },
      _count: { _all: true },
      _avg: { durationSeconds: true },
    }),
    db.visitLog.groupBy({
      by: ["artworkId"],
      where: { exhibitionId: { in: exhibitionIds }, artworkId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { artworkId: "desc" } },
      take: 5,
    }),
    db.visitLog.groupBy({
      by: ["country"],
      where: { exhibitionId: { in: exhibitionIds }, artworkId: null, country: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { country: "desc" } },
      take: 5,
    }),
  ]);
  const topArtworkIds = topArtworkRows
    .map((row) => row.artworkId)
    .filter((id): id is string => id !== null);
  const topArtworkDetails =
    topArtworkIds.length > 0
      ? await db.artwork.findMany({
          where: { id: { in: topArtworkIds } },
          select: { id: true, title: true, exhibition: { select: { title: true } } },
        })
      : [];
  const visitStats = {
    totalVisits: visitAggregate._count._all,
    avgDurationSeconds:
      visitAggregate._avg.durationSeconds != null
        ? Math.round(visitAggregate._avg.durationSeconds)
        : null,
    topArtworks: topArtworkRows
      .map((row) => {
        const detail = topArtworkDetails.find((artwork) => artwork.id === row.artworkId);
        if (!detail) return null;
        return {
          id: detail.id,
          title: detail.title,
          exhibitionTitle: detail.exhibition.title,
          views: row._count._all,
        };
      })
      .filter((row): row is NonNullable<typeof row> => row !== null),
    topCountries: topCountryRows.map((row) => ({
      country: row.country ?? "Unknown",
      visits: row._count._all,
    })),
  };

  return (
    <Dashboard
      user={user}
      exhibitionCount={exhibitions.length}
      stats={{
        exhibitions: { value: exhibitions.length, ...deltaText(exhibitionsRecent) },
        artworks: { value: artworkCount, ...deltaText(artworksRecent) },
        views: { value: viewCount, note: "All time" },
        publicExhibitions: { value: publicExhibitions.length, ...deltaText(publishedRecent) },
      }}
      chart={chart}
      chartTotal={chartTotal}
      chartRange={chartRange}
      topExhibitions={topExhibitions}
      visitStats={visitStats}
    />
  );
}
