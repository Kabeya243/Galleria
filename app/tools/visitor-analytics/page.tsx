import { redirect } from "next/navigation";
import Link from "next/link";
import ToolsShell from "@/components/tools-shell";
import VisitorAnalytics from "@/components/visitor-analytics";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import { utcDay } from "@/lib/visits";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Visitor Analytics — Lakisa Tools",
  description:
    "Who visits your exhibitions: visits over time, unique visitors, most viewed artworks, devices, traffic sources and countries — anonymous counts only, no personal data.",
};

const DAYS = 30;

function referrerHost(referrer: string | null): string {
  if (!referrer) return "Direct or unknown";
  try {
    return new URL(referrer).hostname.replace(/^www\./, "");
  } catch {
    return "Direct or unknown";
  }
}

export default async function VisitorAnalyticsRoute({
  searchParams,
}: {
  searchParams: Promise<{ exhibitionId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("visitor-analytics", user.id);

  const exhibitions = await db.exhibition.findMany({
    where: { ownerId: user.id },
    select: { id: true, title: true, slug: true, status: true, views: true },
    orderBy: { updatedAt: "desc" },
  });

  const { exhibitionId } = await searchParams;
  const selected =
    exhibitions.find((e) => e.id === exhibitionId) ?? exhibitions[0] ?? null;

  // No exhibitions at all: the tool still renders, with an empty state.
  if (!selected) {
    return (
      <ToolsShell
        user={user}
        exhibitionCount={0}
        title="visitorAnalytics"
        eyebrow="visitorAnalyticsEyebrow"
        description="visitorAnalyticsDesc"
      >
        <div className={styles.emptyBox}>
          <strong>No exhibitions yet.</strong>
          <p>Publish an exhibition and visits will be counted here, day by day, as soon as someone opens it.</p>
          <Link href="/exhibitions" className="galleries-open-button">
            Go to your exhibitions
          </Link>
        </div>
      </ToolsShell>
    );
  }

  const now = new Date();
  const windowStart = utcDay(new Date(now.getTime() - (DAYS - 1) * 24 * 60 * 60 * 1000));

  // A "visit" here is an exhibition open (artworkId null) — the same
  // definition as the dashboard's Visitor statistics, so the two pages
  // agree. Artwork-detail opens are counted separately, under Most
  // viewed artworks, and must not inflate the visit totals.
  const [recentRows, allTimeCount, allTimeKeys, avgDuration, topArtworkGroups, deviceGroups, countryGroups, referrerRows] =
    await Promise.all([
      db.visitLog.findMany({
        where: { exhibitionId: selected.id, artworkId: null, day: { gte: windowStart } },
        select: { day: true, visitorKey: true },
      }),
      db.visitLog.count({ where: { exhibitionId: selected.id, artworkId: null } }),
      db.visitLog.findMany({
        where: { exhibitionId: selected.id, artworkId: null },
        select: { visitorKey: true },
        distinct: ["visitorKey"],
      }),
      db.visitLog.aggregate({
        where: { exhibitionId: selected.id, artworkId: null },
        _avg: { durationSeconds: true },
      }),
      db.visitLog.groupBy({
        by: ["artworkId"],
        where: { exhibitionId: selected.id, artworkId: { not: null } },
        _count: { _all: true },
        orderBy: { _count: { artworkId: "desc" } },
        take: 10,
      }),
      db.visitLog.groupBy({
        by: ["device"],
        where: { exhibitionId: selected.id, artworkId: null },
        _count: { _all: true },
      }),
      db.visitLog.groupBy({
        by: ["country"],
        where: { exhibitionId: selected.id, artworkId: null },
        _count: { _all: true },
        orderBy: { _count: { country: "desc" } },
      }),
      db.visitLog.findMany({
        where: { exhibitionId: selected.id, artworkId: null },
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

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitions.length}
      title="visitorAnalytics"
      eyebrow="visitorAnalyticsEyebrow"
      description="visitorAnalyticsDesc"
    >
      <VisitorAnalytics
        exhibitions={exhibitions.map((e) => ({
          id: e.id,
          title: e.title,
          slug: e.slug,
          status: e.status,
          views: e.views,
        }))}
        selectedId={selected.id}
        selectedSlug={selected.slug}
        selectedTitle={selected.title}
        daily={daily}
        totalVisits30={visits30}
        uniqueVisitors30={unique30}
        totalVisitsAllTime={allTimeCount}
        uniqueVisitorsAllTime={allTimeKeys.length}
        avgDurationSeconds={avgDuration._avg.durationSeconds != null ? Math.round(avgDuration._avg.durationSeconds) : null}
        topArtworks={topArtworks}
        devices={devices}
        referrers={referrers}
        countries={countries}
      />
    </ToolsShell>
  );
}
