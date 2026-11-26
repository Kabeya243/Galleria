// User dashboard data (Nov 2026): the dashboard used to be one single
// page (/) that loaded everything — stats, activity, top exhibitions,
// plan card data and visitor analytics — on each visit. Each dashboard
// page now loads only what its own section needs, through the loaders
// below. The queries are the ones the home page ran, moved verbatim.
// Server-only.

import { getCurrentUser } from "@/lib/auth";
import { db, withDbRetry } from "@/lib/db";
import { toServingImageUrl } from "@/lib/r2";
import { parseGalleryRooms, placedArtworks } from "@/lib/rooms";
import { getExhibitionAnalytics } from "@/lib/visitor-analytics-server";
import type {
  AnalyticsDay,
  AnalyticsExhibition,
  CountRow,
  TopArtwork,
} from "@/components/visitor-analytics";

// The full per-exhibition visitor analytics. Null when the user has no
// exhibition yet.
export type DashboardVisitorAnalytics = {
  exhibitions: AnalyticsExhibition[];
  selectedId: string;
  selectedSlug: string;
  selectedTitle: string;
  daily: AnalyticsDay[];
  totalVisits30: number;
  uniqueVisitors30: number;
  totalVisitsAllTime: number;
  uniqueVisitorsAllTime: number;
  avgDurationSeconds: number | null;
  topArtworks: TopArtwork[];
  devices: CountRow[];
  referrers: CountRow[];
  countries: CountRow[];
};

const DAY_MS = 86_400_000;

function utcDayStart(time: number): number {
  const d = new Date(time);
  return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
}

type DashboardUser = NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;

// The owner's exhibitions with their artworks, newest first. Retried:
// a transient connection failure here used to take the whole dashboard
// down with an "Application error" page.
async function loadOwnExhibitions(user: DashboardUser) {
  return withDbRetry(() =>
    db.exhibition.findMany({
      where: { ownerId: user.id },
      include: {
        artworks: {
          // roomId is selected so placedArtworks() can tell which works
          // are actually hung in a room (cover image for the top list).
          // Title, artist, medium and year feed the Recent artworks
          // column on the dashboard.
          select: {
            id: true,
            createdAt: true,
            imageUrl: true,
            roomId: true,
            title: true,
            artist: true,
            medium: true,
            year: true,
          },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { artworks: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
  );
}

// Overview (/) : stats, activity chart, top exhibitions. No plan card
// data (PlanCard fetches its own) and no visitor analytics (they live
// on /dashboard/analytics now).
export async function loadUserDashboard(user: DashboardUser) {
  const exhibitions = await loadOwnExhibitions(user);
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

  // Visit history (VisitLog: one row per visitor per day per
  // exhibition, artworkId set when a specific work was viewed). The
  // KPI sparklines are the real daily series for the last 14 days;
  // nothing here is invented. The 30-day window covers both the
  // 14-day sparklines and the engagement share below.
  const exhibitionIds = exhibitions.map((exhibition) => exhibition.id);
  const thirtyDaysAgo = new Date(todayStart - 29 * DAY_MS);
  const [visitRows, artworkViewsAllTime, artworkViewGroups] = await Promise.all([
    exhibitionIds.length > 0
      ? withDbRetry(() =>
          db.visitLog.findMany({
            where: { exhibitionId: { in: exhibitionIds }, day: { gte: thirtyDaysAgo } },
            select: { day: true, exhibitionId: true, artworkId: true },
          }),
        )
      : Promise.resolve([] as { day: Date; exhibitionId: string; artworkId: string | null }[]),
    exhibitionIds.length > 0
      ? withDbRetry(() =>
          db.visitLog.count({
            where: { exhibitionId: { in: exhibitionIds }, artworkId: { not: null } },
          }),
        )
      : Promise.resolve(0),
    exhibitionIds.length > 0
      ? withDbRetry(() =>
          db.visitLog.groupBy({
            by: ["artworkId"],
            where: { exhibitionId: { in: exhibitionIds }, artworkId: { not: null } },
            _count: { _all: true },
          }),
        )
      : Promise.resolve([] as { artworkId: string | null; _count: { _all: number } }[]),
  ]);

  const dayKey = (time: number) => new Date(time).toISOString().slice(0, 10);
  const rowsByDay = new Map<string, typeof visitRows>();
  for (const row of visitRows) {
    const key = dayKey(row.day.getTime());
    const bucket = rowsByDay.get(key);
    if (bucket) bucket.push(row);
    else rowsByDay.set(key, [row]);
  }
  // Last 14 days, oldest first.
  const last14Keys = Array.from({ length: 14 }, (_, index) =>
    dayKey(todayStart - (13 - index) * DAY_MS),
  );
  const dailyVisits = last14Keys.map((key) => rowsByDay.get(key)?.length ?? 0);
  const dailyArtworkViews = last14Keys.map(
    (key) => rowsByDay.get(key)?.filter((row) => row.artworkId).length ?? 0,
  );
  const dailyExhibitionsVisited = last14Keys.map(
    (key) => new Set(rowsByDay.get(key)?.map((row) => row.exhibitionId)).size,
  );
  const visited30 = new Set(visitRows.map((row) => row.exhibitionId)).size;
  const engagementPct =
    exhibitions.length > 0 ? Math.round((visited30 / exhibitions.length) * 1000) / 10 : 0;

  const artworkViewsById = new Map<string, number>();
  for (const group of artworkViewGroups) {
    if (group.artworkId) artworkViewsById.set(group.artworkId, group._count._all);
  }

  // The three most recently added distinct works (same dedupe rule as
  // the artwork count: one library item can sit in several shows),
  // with their real per-work view counts.
  const seenImages = new Set<string>();
  const recentArtworks = exhibitions
    .flatMap((exhibition) =>
      exhibition.artworks.map((artwork) => ({
        ...artwork,
        exhibitionId: exhibition.id,
        exhibitionTitle: exhibition.title,
      })),
    )
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .filter((artwork) => {
      const key = artwork.imageUrl ?? `id:${artwork.id}`;
      if (seenImages.has(key)) return false;
      seenImages.add(key);
      return true;
    })
    .slice(0, 3)
    .map((artwork) => ({
      id: artwork.id,
      title: artwork.title,
      artist: artwork.artist,
      medium: artwork.medium,
      year: artwork.year,
      imageUrl: artwork.imageUrl ? toServingImageUrl(artwork.imageUrl) : null,
      exhibitionId: artwork.exhibitionId,
      exhibitionTitle: artwork.exhibitionTitle,
      views: artworkViewsById.get(artwork.id) ?? 0,
    }));

  const topExhibitions = [...exhibitions]
    .sort((a, b) => b.views - a.views)
    .slice(0, 6)
    .map((exhibition) => {
      // Cover + room count for the ranked top list (redesign, Phase 1):
      // the first placed artwork with an image, and the number of rooms
      // in the show. A show with no placed image has no cover.
      const { coverImageUrl } = placedArtworks(exhibition.rooms, exhibition.artworks);
      let roomCount = 0;
      try {
        roomCount = parseGalleryRooms(exhibition.rooms).length;
      } catch {
        roomCount = 0;
      }
      return {
        id: exhibition.id,
        title: exhibition.title,
        slug: exhibition.slug,
        status: exhibition.status,
        views: exhibition.views,
        artworkCount: exhibition._count.artworks,
        coverImageUrl: coverImageUrl ? toServingImageUrl(coverImageUrl) : null,
        roomCount,
      };
    });

  return {
    exhibitionCount: exhibitions.length,
    // Every own exhibition (id, title, slug, status) for the ⌘K
    // command palette search. Newest first.
    exhibitions: exhibitions.map((exhibition) => ({
      id: exhibition.id,
      title: exhibition.title,
      slug: exhibition.slug,
      status: exhibition.status,
    })),
    // The most recently updated exhibition: the guided start ("Create
    // your first exhibition in 3 steps") opens it in the editor for
    // steps 2 and 3. Null when the account has no exhibition yet.
    newestExhibition: exhibitions[0]
      ? { id: exhibitions[0].id, slug: exhibitions[0].slug, status: exhibitions[0].status }
      : null,
    stats: {
      // Total visits: the established all-time counter (sum of the
      // per-exhibition page-load counters), with the real daily
      // VisitLog series of the last 14 days as its sparkline.
      visits: { value: viewCount, note: "All time · page loads", spark: dailyVisits },
      // Engagement: the share of the user's exhibitions that drew at
      // least one visit in the last 30 days, with the daily count of
      // distinct exhibitions visited as its sparkline.
      engagement: {
        value: engagementPct,
        note: `${visited30} of ${exhibitions.length} visited in the last 30 days`,
        spark: dailyExhibitionsVisited,
      },
      // Artwork views: VisitLog rows that viewed a specific work,
      // all time, with the real daily series as its sparkline.
      artworkViews: { value: artworkViewsAllTime, note: "All time · artwork views", spark: dailyArtworkViews },
    },
    recentArtworks,
    topExhibitions,
    // Counts the onboarding progress reads (steps 2 and 3).
    artworkCount,
    publicExhibitionCount: publicExhibitions.length,
  };
}

// Visitor analytics (/dashboard/analytics): the full per-exhibition
// analytics, with the selected exhibition from ?exhibitionId=,
// defaulting to the most recently updated one.
export async function loadDashboardAnalytics(user: DashboardUser, exhibitionId?: string) {
  const exhibitions = await loadOwnExhibitions(user);
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
  return {
    exhibitionCount: exhibitions.length,
    visitorAnalytics:
      analytics && selectedAnalytics
        ? {
            exhibitions: analyticsExhibitions,
            selectedId: selectedAnalytics.id,
            selectedSlug: selectedAnalytics.slug,
            selectedTitle: selectedAnalytics.title,
            ...analytics,
          }
        : null,
  };
}
