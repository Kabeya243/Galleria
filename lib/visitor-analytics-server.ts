import { db } from "@/lib/db";
import { utcDay } from "@/lib/visits";
import type {
  AnalyticsDay,
  CountRow,
  TopArtwork,
} from "@/components/visitor-analytics";

const DAYS = 30;

function referrerHost(referrer: string | null): string {
  if (!referrer) return "Direct or unknown";
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return "Direct or unknown";
  }
}

export type ExhibitionAnalytics = {
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

// Visitor analytics for one exhibition, computed server-side from
// VisitLog. A "visit" is an exhibition open (artworkId null) — the
// same definition as the dashboard's Visitor statistics, so the two
// agree. Artwork-detail opens are counted separately, under Most
// viewed artworks, and must not inflate the visit totals. Used by the
// dashboard (the analytics now live on /dashboard/analytics, see
// app/dashboard/analytics/page.tsx); the old /tools/visitor-analytics
// page redirects to /dashboard/analytics.
export async function getExhibitionAnalytics(
  exhibitionId: string,
): Promise<ExhibitionAnalytics> {
  const now = new Date();
  const windowStart = utcDay(new Date(now.getTime() - (DAYS - 1) * 24 * 60 * 60 * 1000));

  const [
    recentRows,
    allTimeCount,
    allTimeKeys,
    avgDuration,
    topArtworkGroups,
    deviceGroups,
    countryGroups,
    referrerRows,
  ] = await Promise.all([
    db.visitLog.findMany({
      where: { exhibitionId, artworkId: null, day: { gte: windowStart } },
      select: { day: true, visitorKey: true },
    }),
    db.visitLog.count({ where: { exhibitionId, artworkId: null } }),
    db.visitLog.findMany({
      where: { exhibitionId, artworkId: null },
      select: { visitorKey: true },
      distinct: ["visitorKey"],
    }),
    db.visitLog.aggregate({
      where: { exhibitionId, artworkId: null },
      _avg: { durationSeconds: true },
    }),
    db.visitLog.groupBy({
      by: ["artworkId"],
      where: { exhibitionId, artworkId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { artworkId: "desc" } },
      take: 10,
    }),
    db.visitLog.groupBy({
      by: ["device"],
      where: { exhibitionId, artworkId: null },
      _count: { _all: true },
    }),
    db.visitLog.groupBy({
      by: ["country"],
      where: { exhibitionId, artworkId: null },
      _count: { _all: true },
      orderBy: { _count: { country: "desc" } },
    }),
    db.visitLog.findMany({
      where: { exhibitionId, artworkId: null },
      select: { referrer: true },
      take: 10000,
    }),
  ]);

  // Daily buckets, oldest first, one per day for the last 30 days.
  const dailyMap = new Map<string, { visits: number; keys: Set<string> }>();
  for (let i = 0; i < DAYS; i++) {
    const d = new Date(windowStart.getTime() + i * 24 * 60 * 60 * 1000);
    dailyMap.set(d.toISOString().slice(0, 10), { visits: 0, keys: new Set() });
  }
  for (const row of recentRows) {
    const bucket = dailyMap.get(row.day.toISOString().slice(0, 10));
    if (!bucket) continue;
    bucket.visits += 1;
    bucket.keys.add(row.visitorKey);
  }
  const daily = [...dailyMap.entries()].map(([date, b]) => ({
    date,
    visits: b.visits,
    unique: b.keys.size,
  }));
  const visits30 = daily.reduce((sum, d) => sum + d.visits, 0);
  const unique30 = new Set(recentRows.map((r) => r.visitorKey)).size;

  const artworkIds = topArtworkGroups
    .map((g) => g.artworkId)
    .filter((id): id is string => id !== null);
  const artworks = artworkIds.length
    ? await db.artwork.findMany({
        where: { id: { in: artworkIds } },
        select: { id: true, title: true },
      })
    : [];
  const titleById = new Map(artworks.map((a) => [a.id, a.title]));
  const topArtworks = topArtworkGroups.map((g) => ({
    id: g.artworkId ?? "",
    title: titleById.get(g.artworkId ?? "") ?? "Removed artwork",
    views: g._count._all,
  }));

  const devices = deviceGroups
    .map((g) => ({ name: g.device ?? "Unknown", count: g._count._all }))
    .sort((a, b) => b.count - a.count);
  const countries = countryGroups
    .map((g) => ({ name: g.country ?? "Unknown", count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  const referrerCounts = new Map<string, number>();
  for (const row of referrerRows) {
    const host = referrerHost(row.referrer);
    referrerCounts.set(host, (referrerCounts.get(host) ?? 0) + 1);
  }
  const referrers = [...referrerCounts.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  return {
    daily,
    totalVisits30: visits30,
    uniqueVisitors30: unique30,
    totalVisitsAllTime: allTimeCount,
    uniqueVisitorsAllTime: allTimeKeys.length,
    avgDurationSeconds:
      avgDuration._avg.durationSeconds != null
        ? Math.round(avgDuration._avg.durationSeconds)
        : null,
    topArtworks,
    devices,
    referrers,
    countries,
  };
}
