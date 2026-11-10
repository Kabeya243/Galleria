// User dashboard data (Nov 2026): the dashboard used to be one single
// page (/) that loaded everything — stats, activity, top exhibitions,
// plan card data and visitor analytics — on each visit. Each dashboard
// page now loads only what its own section needs, through the loaders
// below. The queries are the ones the home page ran, moved verbatim.
// Server-only.

import { getCurrentUser } from "@/lib/auth";
import { db, withDbRetry } from "@/lib/db";
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

function deltaText(recentCount: number): { delta: string; tone: "up" | "flat" } {
  if (recentCount > 0) {
    return { delta: `+${recentCount} in the last 7 days`, tone: "up" };
  }
  return { delta: "No new in the last 7 days", tone: "flat" };
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
          select: { id: true, createdAt: true, imageUrl: true },
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

  return {
    exhibitionCount: exhibitions.length,
    // The most recently updated exhibition: the guided start ("Create
    // your first exhibition in 3 steps") opens it in the editor for
    // steps 2 and 3. Null when the account has no exhibition yet.
    newestExhibition: exhibitions[0]
      ? { id: exhibitions[0].id, slug: exhibitions[0].slug, status: exhibitions[0].status }
      : null,
    stats: {
      exhibitions: { value: exhibitions.length, ...deltaText(exhibitionsRecent) },
      artworks: { value: artworkCount, ...deltaText(artworksRecent) },
      views: { value: viewCount, note: "All time · page loads" },
      publicExhibitions: { value: publicExhibitions.length, ...deltaText(publishedRecent) },
    },
    chart,
    chartTotal,
    chartRange,
    topExhibitions,
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
