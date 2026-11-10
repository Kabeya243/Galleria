import Link from "next/link";
import AdminGalleries from "@/components/admin-galleries";
import AdminGalleryNames from "@/components/admin-gallery-names";
import AdminShell from "@/components/admin-shell";
import AdminSubscriptions from "@/components/admin-subscriptions";
import SubAdmins from "@/components/sub-admins";
import { hasAdminPermission, requireAdminAccess } from "@/lib/admin";
import { db } from "@/lib/db";
import { getGalleryNames } from "@/lib/gallery-names-server";
import { getHiddenRoomLayouts } from "@/lib/hidden-room-layouts";
import { getAllPlans } from "@/lib/subscriptions";
import { HIDDEN_LAYOUT_KEYS, ROOM_MODELS, roomLayouts, type RoomLayout } from "@/lib/rooms";
import { TOOL_LABELS, TOOL_SLUGS, type ToolSlug } from "@/lib/tool-use";

export const metadata = {
  title: "Admin: Lakisa",
  description:
    "The platform overview for the owner: users, exhibitions, artworks, visits and tool use, everything on one page.",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function relativeTime(d: Date): string {
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return d.toLocaleDateString("en-GB");
}

// Counts per day for the last `days` days (oldest first). `dates` are the
// createdAt values of the rows to bucket; the bucket key is the local date.
function dailyCounts(dates: Date[], days: number): { date: Date; count: number }[] {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (days - 1));
  const buckets = Array.from({ length: days }, (_, i) => {
    const date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { date, count: 0 };
  });
  const index = new Map(buckets.map((b, i) => [b.date.toDateString(), i]));
  for (const d of dates) {
    const i = index.get(new Date(d.getFullYear(), d.getMonth(), d.getDate()).toDateString());
    if (i !== undefined) buckets[i].count += 1;
  }
  return buckets;
}

function deltaTone(now: number, prev: number): { text: string; tone: "up" | "down" | "flat" } {
  const diff = now - prev;
  if (diff > 0) return { text: `+${diff} vs previous 7 days`, tone: "up" };
  if (diff < 0) return { text: `${diff} vs previous 7 days`, tone: "down" };
  return { text: "Same as previous 7 days", tone: "flat" };
}

// Small sparkline from real daily counts — pure SVG, no chart library.
// Colours come from the admin theme variables, so it follows dark/light.
function Sparkline({ values }: { values: number[] }) {
  const max = Math.max(...values, 1);
  const w = 140;
  const h = 36;
  const points = values.map((v, i) => {
    const x = values.length > 1 ? (i * (w - 4)) / (values.length - 1) + 2 : w / 2;
    const y = h - 3 - (v / max) * (h - 8);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  });
  const line = points.join(" ");
  return (
    <svg className="ad-spark" viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" aria-hidden="true">
      <polygon
        points={`2,${h} ${line} ${w - 2},${h}`}
        style={{ fill: "var(--ad-spark-fill)" }}
      />
      <polyline
        points={line}
        fill="none"
        style={{ stroke: "var(--ad-spark-stroke)" }}
        strokeWidth="1.5"
      />
    </svg>
  );
}

function EmptyBox({ title, body }: { title: string; body: string }) {
  return (
    <div className="ad-empty">
      <strong>{title}</strong>
      <p>{body}</p>
    </div>
  );
}

// Ranked share bars (same look as "Users by country"): the top entries
// with their share of the largest one.
function ShareBars({ items, max }: { items: Array<{ name: string; count: number }>; max: number }) {
  return (
    <ul className="ad-share ad-scroll">
      {items.map((item) => (
        <li key={item.name}>
          <div className="ad-share-row">
            <span className="ad-share-name">{item.name}</span>
            <span className="ad-share-count">{item.count}</span>
          </div>
          <div className="ad-share-track">
            <div
              className="ad-share-fill"
              style={{ width: `${Math.max((item.count / max) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}

// Feature-test report (parts 1–5 of the SANAA extension mission), written
// by scripts/test-new-features.mjs to public/test-reports/latest.json.
// Read from disk on each admin visit; missing or unreadable file = empty
// state, never a crash.
type TestReportCheck = {
  feature: string;
  id: string;
  name: string;
  status: "pass" | "fail" | "skip";
  detail: string;
};
type TestReport = {
  generatedAt: string;
  commit: string;
  summary: { total: number; passed: number; failed: number; skipped: number };
  checks: TestReportCheck[];
};

async function readTestReport(): Promise<TestReport | null> {
  try {
    const { readFile } = await import("node:fs/promises");
    const { join } = await import("node:path");
    const raw = await readFile(join(process.cwd(), "public", "test-reports", "latest.json"), "utf8");
    const parsed = JSON.parse(raw) as TestReport;
    if (!parsed || !Array.isArray(parsed.checks) || !parsed.summary) return null;
    return parsed;
  } catch {
    return null;
  }
}

export default async function AdminRoute({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { user, access } = await requireAdminAccess();
  // Signed-in but not an admin: a clean access-denied panel, rendered
  // here before any of the 29 data queries run, instead of a redirect
  // to a dashboard that may itself be having a bad minute.
  if (!access.isManager && !access.isSubAdmin) {
    return (
      <main className="ad-root">
        <div className="ad-denied">
          <h1>Admin access required</h1>
          <p>
            This area is for the Lakisa manager and sub-admins. You are
            signed in as {user.name ?? user.email}, and this account does
            not have admin access.
          </p>
          <Link href="/" className="ad-denied-link">
            Back to your dashboard
          </Link>
        </div>
      </main>
    );
  }
  // Section gates for sub-admins (the manager holds every permission,
  // so every section shows for him). The sections below only render
  // when the permission is held — the data never leaves the server
  // for a section the viewer cannot open.
  const canStats = hasAdminPermission(access, "stats.view");
  const canUsers = hasAdminPermission(access, "users.view");
  const canExhibitions = hasAdminPermission(access, "exhibitions.view");
  const canArtworks = hasAdminPermission(access, "artworks.view");
  const canGalleries = hasAdminPermission(access, "galleries.view");
  const canManageGalleries = hasAdminPermission(access, "galleries.manage");
  const canSubscriptions = hasAdminPermission(access, "subscriptions.view");
  const canManageSubscriptions = hasAdminPermission(access, "subscriptions.manage");
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const now = new Date();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [
    userDates,
    exhibitionDates,
    artworkDates,
    totalViews,
    publicExhibitions,
    topExhibitions,
    recentUsers,
    recentExhibitions,
    recentArtworks,
    countryGroups,
    roleGroups,
    storage,
    allUsers,
    allExhibitions,
    allArtworks,
    toolUseAllTime,
    toolUseLast30Days,
    recentToolUses,
    visitLogDays,
    recentVisits,
    browserGroups,
    osGroups,
    deviceGroups,
    cityGroups,
    uniqueVisitors30Rows,
    returningVisitors30Rows,
    hiddenRoomLayouts,
    galleryNames,
    testReport,
    plans,
    allSubscriptions,
    subscriptionCounts,
    paidSubscriptions,
  ] = await Promise.all([
    db.user.findMany({ select: { createdAt: true } }),
    db.exhibition.findMany({ select: { createdAt: true } }),
    db.artwork.findMany({ select: { createdAt: true } }),
    db.exhibition.aggregate({ _sum: { views: true } }),
    db.exhibition.count({ where: { status: "public" } }),
    db.exhibition.findMany({
      orderBy: { views: "desc" },
      take: 6,
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        views: true,
        owner: { select: { name: true, email: true } },
        _count: { select: { artworks: true } },
      },
    }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        country: true,
        createdAt: true,
        _count: { select: { exhibitions: true } },
      },
    }),
    db.exhibition.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, status: true, createdAt: true, owner: { select: { name: true } } },
    }),
    db.artwork.findMany({
      orderBy: { createdAt: "desc" },
      take: 5,
      select: { id: true, title: true, createdAt: true, exhibition: { select: { title: true } } },
    }),
    db.user.groupBy({ by: ["country"], _count: { _all: true } }),
    db.user.groupBy({ by: ["role"], _count: { _all: true } }),
    db.$queryRaw<{ total: bigint }[]>`SELECT COALESCE(SUM(octet_length(data)), 0) AS total FROM "Upload"`,
    db.user.findMany({
      where: query
        ? {
            OR: [
              { name: { contains: query, mode: "insensitive" } },
              { email: { contains: query, mode: "insensitive" } },
              { country: { contains: query, mode: "insensitive" } },
            ],
          }
        : undefined,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        country: true,
        createdAt: true,
        _count: { select: { exhibitions: true } },
      },
    }),
    db.exhibition.findMany({
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        title: true,
        slug: true,
        status: true,
        views: true,
        createdAt: true,
        updatedAt: true,
        owner: { select: { name: true, email: true } },
        _count: { select: { artworks: true } },
      },
    }),
    db.artwork.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        title: true,
        medium: true,
        dimensions: true,
        year: true,
        createdAt: true,
        exhibition: { select: { title: true, status: true, owner: { select: { name: true } } } },
      },
    }),
    // Tool use: per-tool totals, all time and last 30 days, plus the most
    // recent opens. The table starts empty and grows from the day tracking
    // shipped — a tool with no rows yet simply shows 0.
    db.toolUse.groupBy({ by: ["tool"], _count: { _all: true } }),
    db.toolUse.groupBy({
      by: ["tool"],
      where: { createdAt: { gte: thirtyDaysAgo } },
      _count: { _all: true },
    }),
    db.toolUse.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: { id: true, tool: true, userId: true, createdAt: true },
    }),
    // Per-day exhibition visits for the last 30 days (VisitLog.day is
    // already the UTC-midnight date, so bucketing is a plain group-by).
    db.visitLog.findMany({
      where: { day: { gte: thirtyDaysAgo } },
      select: { day: true },
    }),
    // Latest individual visits with their details (city, device, OS,
    // browser, duration, what was viewed). Old rows have nulls and show
    // as "Not specified" in the table.
    db.visitLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 60,
      select: {
        id: true,
        exhibitionId: true,
        artworkId: true,
        country: true,
        city: true,
        region: true,
        latitude: true,
        longitude: true,
        device: true,
        os: true,
        browser: true,
        durationSeconds: true,
        createdAt: true,
      },
    }),
    // Visitor breakdowns for the last 30 days (only rows that have the
    // field; the rest are grouped under "Not specified" in code).
    db.visitLog.groupBy({
      by: ["browser"],
      where: { day: { gte: thirtyDaysAgo } },
      _count: { _all: true },
    }),
    db.visitLog.groupBy({
      by: ["os"],
      where: { day: { gte: thirtyDaysAgo } },
      _count: { _all: true },
    }),
    db.visitLog.groupBy({
      by: ["device"],
      where: { day: { gte: thirtyDaysAgo } },
      _count: { _all: true },
    }),
    db.visitLog.groupBy({
      by: ["city"],
      where: { day: { gte: thirtyDaysAgo } },
      _count: { _all: true },
    }),
    // Unique visitors in the last 30 days (distinct anonymous visitor
    // keys) and how many of them had already visited before the window
    // (returning). The rest are new. See the note under the Recent
    // visits table: a first-time visitor's very first view is logged
    // before the anonymous cookie is set, so "new" can read slightly
    // high; "returning" is exact.
    db.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(DISTINCT "visitorKey") AS total
      FROM "VisitLog" WHERE day >= ${thirtyDaysAgo}`,
    db.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(DISTINCT "visitorKey") AS total FROM "VisitLog" v
      WHERE v.day >= ${thirtyDaysAgo}
      AND EXISTS (
        SELECT 1 FROM "VisitLog" v2
        WHERE v2."visitorKey" = v."visitorKey" AND v2.day < ${thirtyDaysAgo}
      )`,
    // Room templates the owner hid in the admin (see the Galleries
    // section below): the list lives in code, this only masks ids.
    getHiddenRoomLayouts(),
    // Gallery names in both languages, admin renames included (see the
    // Gallery names section below).
    getGalleryNames(),
    // Feature-test report (see the Test reports section below).
    readTestReport(),
    // Subscriptions (Nov 2026): the plans, every account's subscription
    // and the subscriber count per plan (see the Subscriptions section).
    getAllPlans(),
    db.subscription.findMany({
      orderBy: { createdAt: "desc" },
      take: 500,
      include: {
        user: { select: { id: true, name: true, email: true, createdAt: true } },
        plan: true,
      },
    }),
    db.subscription.groupBy({ by: ["planId"], _count: { _all: true } }),
    // Active paid subscriptions, for the Sales card (MRR, paying
    // subscribers, conversion). A separate query so the 500-row cap on
    // the table below never skews the money numbers.
    db.subscription.findMany({
      where: { status: "active", plan: { slug: { not: "discovery" } } },
      include: { plan: true },
    }),
  ]);

  const userCount = userDates.length;
  const exhibitionCount = exhibitionDates.length;
  const artworkCount = artworkDates.length;
  const storageBytes = Number(storage[0]?.total ?? 0);
  const views = totalViews._sum.views ?? 0;

  // Titles for the Recent visits table (exhibitions and artworks the
  // visits point at). Removed ones show as "Removed exhibition" /
  // "Removed artwork" instead of a bare id.
  const visitExhibitionIds = [...new Set(recentVisits.map((v) => v.exhibitionId))];
  const visitArtworkIds = [
    ...new Set(recentVisits.map((v) => v.artworkId).filter((id): id is string => id !== null)),
  ];
  const [visitExhibitions, visitArtworks] = await Promise.all([
    visitExhibitionIds.length
      ? db.exhibition.findMany({
          where: { id: { in: visitExhibitionIds } },
          select: { id: true, title: true, slug: true, status: true },
        })
      : Promise.resolve([]),
    visitArtworkIds.length
      ? db.artwork.findMany({
          where: { id: { in: visitArtworkIds } },
          select: { id: true, title: true },
        })
      : Promise.resolve([]),
  ]);
  const visitExhibitionById = new Map(visitExhibitions.map((e) => [e.id, e]));
  const visitArtworkById = new Map(visitArtworks.map((a) => [a.id, a]));

  // Unique visitors in the last 30 days: distinct anonymous keys, split
  // into new (first seen inside the window) and returning (seen before).
  const uniqueVisitors30 = Number(uniqueVisitors30Rows[0]?.total ?? 0);
  const returningVisitors30 = Number(returningVisitors30Rows[0]?.total ?? 0);
  const newVisitors30 = Math.max(uniqueVisitors30 - returningVisitors30, 0);

  // Country codes (Vercel sends "UG", "KE", ...) shown as names.
  const countryName = new Intl.DisplayNames(["en"], { type: "region" });
  function visitCountry(code: string | null): string {
    if (!code) return "";
    try {
      return countryName.of(code) ?? code;
    } catch {
      return code;
    }
  }
  function visitLocation(v: {
    city: string | null;
    region: string | null;
    country: string | null;
  }): string {
    const parts = [v.city, v.region, visitCountry(v.country)].filter(
      (p): p is string => Boolean(p && p.trim()),
    );
    return parts.length > 0 ? parts.join(", ") : "Not specified";
  }
  function formatDuration(seconds: number | null): string {
    if (seconds == null) return "Not recorded";
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    return rest === 0 ? `${minutes}m` : `${minutes}m ${rest}s`;
  }
  function breakdown(
    groups: Array<{ _count: { _all: number }; [key: string]: unknown }>,
    key: string,
  ): Array<{ name: string; count: number }> {
    return groups
      .map((g) => {
        const value = g[key];
        return {
          name: (typeof value === "string" ? value : "").trim() || "Not specified",
          count: g._count._all,
        };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }
  const browserStats = breakdown(browserGroups, "browser");
  const osStats = breakdown(osGroups, "os");
  const deviceStats = breakdown(deviceGroups, "device");
  const cityStats = breakdown(cityGroups, "city");
  const browserMax = Math.max(...browserStats.map((b) => b.count), 1);
  const osMax = Math.max(...osStats.map((b) => b.count), 1);
  const deviceMax = Math.max(...deviceStats.map((b) => b.count), 1);
  const cityMax = Math.max(...cityStats.map((b) => b.count), 1);

  const inRange = (dates: Date[], from: Date, to?: Date) =>
    dates.filter((d) => d >= from && (to === undefined || d < to)).length;

  const usersThisWeek = inRange(userDates.map((u) => u.createdAt), sevenDaysAgo);
  const usersPrevWeek = inRange(userDates.map((u) => u.createdAt), fourteenDaysAgo, sevenDaysAgo);
  const exhibitionsThisWeek = inRange(exhibitionDates.map((e) => e.createdAt), sevenDaysAgo);
  const exhibitionsPrevWeek = inRange(exhibitionDates.map((e) => e.createdAt), fourteenDaysAgo, sevenDaysAgo);
  const artworksThisWeek = inRange(artworkDates.map((a) => a.createdAt), sevenDaysAgo);
  const artworksPrevWeek = inRange(artworkDates.map((a) => a.createdAt), fourteenDaysAgo, sevenDaysAgo);

  const signupDays = dailyCounts(userDates.map((u) => u.createdAt), 14);
  const exhibitionDays = dailyCounts(exhibitionDates.map((e) => e.createdAt), 14);
  const artworkDays = dailyCounts(artworkDates.map((a) => a.createdAt), 14);
  const signupsTotal = signupDays.reduce((sum, d) => sum + d.count, 0);
  const signupMax = Math.max(...signupDays.map((d) => d.count), 1);

  // Visits per day for the last 30 days, from VisitLog (one row per
  // exhibition view). Buckets keyed by the stored UTC date.
  const visitDays = Array.from({ length: 30 }, (_, i) => {
    const date = new Date(
      Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - (29 - i)),
    );
    return { date, count: 0 };
  });
  const visitDayIndex = new Map(visitDays.map((b, i) => [b.date.toISOString().slice(0, 10), i]));
  for (const row of visitLogDays) {
    const i = visitDayIndex.get(row.day.toISOString().slice(0, 10));
    if (i !== undefined) visitDays[i].count += 1;
  }
  const visitsTotal30 = visitDays.reduce((sum, d) => sum + d.count, 0);
  const visitMax = Math.max(...visitDays.map((d) => d.count), 1);

  const usersDelta = deltaTone(usersThisWeek, usersPrevWeek);
  const exhibitionsDelta = deltaTone(exhibitionsThisWeek, exhibitionsPrevWeek);
  const artworksDelta = deltaTone(artworksThisWeek, artworksPrevWeek);

  const countries = countryGroups
    .map((g) => ({ name: (g.country ?? "").trim() || "Not specified", count: g._count._all }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const roles = roleGroups
    .map((g) => ({ name: (g.role ?? "").trim() || "Not specified", count: g._count._all }))
    .sort((a, b) => b.count - a.count);

  // Tools used: every tool is listed, even with zero recorded uses — the
  // table starts empty and grows from the day tracking shipped.
  const toolAllTime = new Map(toolUseAllTime.map((g) => [g.tool, g._count._all]));
  const toolLast30 = new Map(toolUseLast30Days.map((g) => [g.tool, g._count._all]));
  const toolStats = TOOL_SLUGS.map((slug: ToolSlug) => ({
    slug,
    label: TOOL_LABELS[slug],
    allTime: toolAllTime.get(slug) ?? 0,
    last30: toolLast30.get(slug) ?? 0,
  })).sort((a, b) => b.allTime - a.allTime);
  const totalToolUses = toolStats.reduce((sum, t) => sum + t.allTime, 0);
  const toolMax = Math.max(...toolStats.map((t) => t.allTime), 1);
  // Names for the recent tool activity feed (one lookup for the users who
  // opened a tool recently; signed-out opens show as "Signed-out visitor").
  const recentToolUserIds = [...new Set(recentToolUses.map((u) => u.userId).filter((id): id is string => id !== null))];
  const recentToolUsers = new Map(
    (
      await db.user.findMany({
        where: { id: { in: recentToolUserIds } },
        select: { id: true, name: true, email: true },
      })
    ).map((u) => [u.id, u]),
  );

  // Latest activity: newest signups, exhibitions and artworks, merged and
  // sorted by when they happened. All real rows, nothing invented.
  const activity = [
    ...recentUsers.map((a) => ({
      key: `user-${a.id}`,
      kind: "signup",
      title: `New signup: ${a.name}`,
      sub: `${a.email}${a.role ? ` · ${a.role}` : ""}${a.country ? ` · ${a.country}` : ""}`,
      at: a.createdAt,
    })),
    ...recentExhibitions.map((e) => ({
      key: `exhibition-${e.id}`,
      kind: "exhibition",
      title: `Exhibition created: ${e.title}`,
      sub: `by ${e.owner.name} · ${e.status}`,
      at: e.createdAt,
    })),
    ...recentArtworks.map((a) => ({
      key: `artwork-${a.id}`,
      kind: "artwork",
      title: `Artwork added: ${a.title}`,
      sub: `in ${a.exhibition.title}`,
      at: a.createdAt,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  // Subscriptions per plan (Nov 2026): subscriber counts for the
  // Subscriptions section, from the plan rows and the group-by counts.
  const subscriptionStats = plans.map((p) => ({
    name: p.name,
    count: subscriptionCounts.find((c) => c.planId === p.id)?._count._all ?? 0,
  }));
  const subscriptionMax = Math.max(...subscriptionStats.map((s) => s.count), 1);
  // Sales (Nov 2026): real numbers from the subscription rows, never
  // invented. MRR counts recurring terms only (monthly at full price,
  // yearly at one twelfth); a one-month-only term is one-time revenue,
  // not recurring. Total collected is $0 until billing is connected:
  // every plan change today is a free trial, so nothing has been
  // charged. Conversion is paying accounts over all accounts.
  const salesMrr = paidSubscriptions.reduce((sum, s) => {
    if (s.billingCycle === "monthly") return sum + s.plan.monthlyPriceUsd;
    if (s.billingCycle === "yearly") return sum + s.plan.yearlyPriceUsd / 12;
    return sum;
  }, 0);
  const salesPayingByPlan = plans
    .filter((p) => p.slug !== "discovery")
    .map((p) => ({
      name: p.name,
      count: paidSubscriptions.filter((s) => s.planId === p.id).length,
    }));
  const salesConversion =
    userCount > 0 ? (paidSubscriptions.length / userCount) * 100 : 0;
  const salesNewPaid14d = paidSubscriptions.filter(
    (s) => s.startedAt >= fourteenDaysAgo,
  ).length;
  const salesPrices = plans
    .filter((p) => p.slug !== "discovery")
    .map(
      (p) =>
        `${p.name} $${p.monthlyPriceUsd}/month, $${p.yearlyPriceUsd}/year, $${p.singleMonthPriceUsd} one month`,
    )
    .join(" · ");

  const subscriptionRows = allSubscriptions.map((s) => ({
    userId: s.user.id,
    name: s.user.name,
    email: s.user.email,
    joinedAt: s.user.createdAt.toISOString(),
    planId: s.plan.id,
    planSlug: s.plan.slug,
    planName: s.plan.name,
    status: s.status,
    billingCycle: s.billingCycle,
    source: s.source,
    startedAt: s.startedAt.toISOString(),
    endsAt: s.endsAt ? s.endsAt.toISOString() : null,
  }));

  const todayLabel = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Room templates for the Galleries section: the layouts in code
  // (Sunlight only), with a note for the creation model.
  const modelNote = new Map<RoomLayout, string>(ROOM_MODELS.map((model) => [model.layout, `Creation model · ${model.id}`]));
  const galleryTemplates = (Object.keys(roomLayouts) as RoomLayout[]).filter((key) => !HIDDEN_LAYOUT_KEYS.has(key)).map((key) => {
    const preset = roomLayouts[key];
    return {
      key,
      label: preset.label,
      category: preset.category,
      width: preset.width,
      depth: preset.depth,
      height: preset.height,
      note: modelNote.get(key),
    };
  });

  return (
    <AdminShell
      user={user}
      title={access.isManager ? "Hello, Kabeya" : `Hello, ${user.name}`}
      eyebrow={access.isManager ? "ADMIN · FOR THE OWNER ONLY" : "ADMIN · SUB-ADMIN"}
      description={
        access.isManager
          ? `${todayLabel}, a look at who joined, what was built, and what visitors viewed on Lakisa.`
          : `${todayLabel}, the sections of Lakisa you may manage.`
      }
      counts={{ users: userCount, exhibitions: exhibitionCount, artworks: artworkCount, tools: totalToolUses }}
      sections={[
        ...(canStats ? ["overview", "tools", "test-reports"] : []),
        ...(canUsers ? ["users"] : []),
        ...(canExhibitions ? ["exhibitions"] : []),
        ...(canArtworks ? ["artworks"] : []),
        ...(canGalleries ? ["galleries"] : []),
        ...(canSubscriptions ? ["subscriptions"] : []),
        ...(access.isManager ? ["sub-admins"] : []),
      ]}
    >
      {canStats && (
      <div id="overview" className="ad-section">
        {/* Stat cards */}
        <div className="ad-grid-stats">
          <div className="ad-card ad-stat">
            <span className="ad-stat-label">Total users</span>
            <strong className="ad-stat-value">{userCount}</strong>
            <span className={`ad-stat-delta ad-delta-${usersDelta.tone}`}>{usersDelta.text}</span>
            <span className="ad-stat-note">{usersThisWeek} new in the last 7 days</span>
            <Sparkline values={signupDays.map((d) => d.count)} />
          </div>
          <div className="ad-card ad-stat">
            <span className="ad-stat-label">Total exhibitions</span>
            <strong className="ad-stat-value">{exhibitionCount}</strong>
            <span className={`ad-stat-delta ad-delta-${exhibitionsDelta.tone}`}>{exhibitionsDelta.text}</span>
            <span className="ad-stat-note">{publicExhibitions} public</span>
            <Sparkline values={exhibitionDays.map((d) => d.count)} />
          </div>
          <div className="ad-card ad-stat">
            <span className="ad-stat-label">Total artworks</span>
            <strong className="ad-stat-value">{artworkCount}</strong>
            <span className={`ad-stat-delta ad-delta-${artworksDelta.tone}`}>{artworksDelta.text}</span>
            <span className="ad-stat-note">{artworksThisWeek} added in the last 7 days</span>
            <Sparkline values={artworkDays.map((d) => d.count)} />
          </div>
          <div className="ad-card ad-stat">
            <span className="ad-stat-label">Total visits</span>
            <strong className="ad-stat-value">{views}</strong>
            <span className="ad-stat-delta ad-delta-flat">All exhibitions, all time</span>
            <span className="ad-stat-note">{visitsTotal30} in the last 30 days (VisitLog)</span>
          </div>
        </div>

        {/* Signups chart + activity feed */}
        <div className="ad-layout-main">
          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <h2>Signups: last 14 days</h2>
                <p className="ad-card-sub">New accounts per day</p>
              </div>
              <strong className="ad-card-total">
                {signupsTotal} <span>new</span>
              </strong>
            </div>
            <div className="ad-bars">
              {signupDays.map((d) => (
                <div
                  key={d.date.toDateString()}
                  className="ad-bar-wrap"
                  title={`${d.date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}: ${d.count} signup${d.count === 1 ? "" : "s"}`}
                >
                  <span className="ad-bar-value">{d.count > 0 ? d.count : ""}</span>
                  <div
                    className={`ad-bar${d.count === signupMax && d.count > 0 ? " ad-bar-max" : ""}`}
                    style={{ height: `${d.count > 0 ? Math.max((d.count / signupMax) * 100, 7) : 2}%` }}
                  />
                </div>
              ))}
            </div>
            <div className="ad-bar-labels">
              {signupDays.map((d) => (
                <span key={d.date.toDateString()}>{d.date.getDate()}</span>
              ))}
            </div>
            <p className="ad-card-sub ad-chart-foot">
              {signupDays[0].date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
              {signupDays[signupDays.length - 1].date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
            </p>
          </section>

          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <h2>Latest activity</h2>
                <p className="ad-card-sub">Signups, exhibitions and artworks</p>
              </div>
            </div>
            {activity.length === 0 ? (
              <EmptyBox
                title="Nothing yet."
                body="Activity appears here as soon as someone signs up or builds something."
              />
            ) : (
              <ul className="ad-feed ad-scroll">
                {activity.map((item) => (
                  <li key={item.key}>
                    <span className={`ad-feed-dot ad-feed-${item.kind}`} aria-hidden="true" />
                    <div className="ad-feed-body">
                      <strong>{item.title}</strong>
                      <span>{item.sub}</span>
                    </div>
                    <span className="ad-feed-time">{relativeTime(item.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Visits per day — last 30 days, from VisitLog (one row per
            exhibition view; artwork-detail opens included). */}
        <section className="ad-card" style={{ marginBottom: 20 }}>
          <div className="ad-card-head">
            <div>
              <h2>Visits: last 30 days</h2>
              <p className="ad-card-sub">Exhibition views per day, all exhibitions</p>
            </div>
            <strong className="ad-card-total">
              {visitsTotal30} <span>visits</span>
            </strong>
          </div>
          {visitsTotal30 === 0 ? (
            <EmptyBox
              title="No visits yet."
              body="Visits are logged from the day Visitor Analytics ships, one row per public exhibition view. They will appear here day by day."
            />
          ) : (
            <>
              <div className="ad-bars">
                {visitDays.map((d) => (
                  <div
                    key={d.date.toISOString()}
                    className="ad-bar-wrap"
                    title={`${d.date.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" })}: ${d.count} visit${d.count === 1 ? "" : "s"}`}
                  >
                    <span className="ad-bar-value">{d.count > 0 ? d.count : ""}</span>
                    <div
                      className={`ad-bar${d.count === visitMax && d.count > 0 ? " ad-bar-max" : ""}`}
                      style={{ height: `${d.count > 0 ? Math.max((d.count / visitMax) * 100, 7) : 2}%` }}
                    />
                  </div>
                ))}
              </div>
              <div className="ad-bar-labels">
                {visitDays.map((d) => (
                  <span key={d.date.toISOString()}>{d.date.getUTCDate()}</span>
                ))}
              </div>
              <p className="ad-card-sub ad-chart-foot">
                {visitDays[0].date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })} –{" "}
                {visitDays[visitDays.length - 1].date.toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
              </p>
            </>
          )}
        </section>

        {/* Visitor details: who the visitors are and what each visit
            looked like. Location comes from the visitor's IP address
            (city level, from Vercel's headers); the site never asks for
            GPS, so this is the city, not an exact position. Visitors stay
            anonymous: no names, emails or IP addresses are stored. */}
        <div className="ad-layout-half">
          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <h2>Visitors by browser</h2>
                <p className="ad-card-sub">Last 30 days, from VisitLog</p>
              </div>
            </div>
            {browserStats.length === 0 ? (
              <EmptyBox title="No visits yet." body="Browsers appear here once a public exhibition is opened." />
            ) : (
              <ShareBars items={browserStats} max={browserMax} />
            )}
          </section>

          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <h2>Visitors by operating system</h2>
                <p className="ad-card-sub">Last 30 days, from VisitLog</p>
              </div>
            </div>
            {osStats.length === 0 ? (
              <EmptyBox title="No visits yet." body="Systems appear here once a public exhibition is opened." />
            ) : (
              <ShareBars items={osStats} max={osMax} />
            )}
          </section>
        </div>

        <div className="ad-layout-half">
          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <h2>Visitors by device</h2>
                <p className="ad-card-sub">Last 30 days, from VisitLog</p>
              </div>
            </div>
            {deviceStats.length === 0 ? (
              <EmptyBox title="No visits yet." body="Devices appear here once a public exhibition is opened." />
            ) : (
              <ShareBars items={deviceStats} max={deviceMax} />
            )}
          </section>

          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <h2>Visitors by city</h2>
                <p className="ad-card-sub">Last 30 days, IP-based, city level</p>
              </div>
            </div>
            {cityStats.length === 0 ? (
              <EmptyBox title="No visits yet." body="Cities appear here once a public exhibition is opened." />
            ) : (
              <ShareBars items={cityStats} max={cityMax} />
            )}
          </section>
        </div>

        <section className="ad-card ad-table-card">
          <div className="ad-card-head">
            <div>
              <h2>Recent visits</h2>
              <p className="ad-card-sub">
                The latest visits, with location, device, browser and what was viewed.{" "}
                {uniqueVisitors30} unique visitors in the last 30 days · {newVisitors30} new ·{" "}
                {returningVisitors30} returning.
              </p>
            </div>
            <strong className="ad-card-total">
              {visitsTotal30} <span>visits in 30 days</span>
            </strong>
          </div>
          <p className="ad-card-sub" style={{ marginBottom: 12 }}>
            Location is IP-based (city level, never GPS). A first-time visitor&apos;s very first view is
            logged before the anonymous cookie is set, so the new-visitor count can read slightly high;
            the returning count is exact.
          </p>
          {recentVisits.length === 0 ? (
            <EmptyBox title="No visits yet." body="Visits appear here once a public exhibition is opened." />
          ) : (
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>When</th>
                    <th>Location</th>
                    <th>Device</th>
                    <th>OS</th>
                    <th>Browser</th>
                    <th>Viewed</th>
                    <th>Duration</th>
                  </tr>
                </thead>
                <tbody>
                  {recentVisits.map((visit) => {
                    const exhibition = visitExhibitionById.get(visit.exhibitionId);
                    const artwork = visit.artworkId ? visitArtworkById.get(visit.artworkId) : undefined;
                    const coords =
                      visit.latitude != null && visit.longitude != null
                        ? `${visit.latitude}, ${visit.longitude}`
                        : null;
                    return (
                      <tr key={visit.id}>
                        <td>
                          {visit.createdAt.toLocaleString("en-GB", {
                            day: "numeric",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td title={coords ?? undefined}>{visitLocation(visit)}</td>
                        <td>{visit.device ?? "Not specified"}</td>
                        <td>{visit.os ?? "Not specified"}</td>
                        <td>{visit.browser ?? "Not specified"}</td>
                        <td>
                          {exhibition ? (
                            exhibition.status === "public" ? (
                              <Link href={`/exhibition/${exhibition.slug}`}>{exhibition.title}</Link>
                            ) : (
                              exhibition.title
                            )
                          ) : (
                            "Removed exhibition"
                          )}
                          {artwork ? ` · ${artwork.title}` : visit.artworkId ? " · Removed artwork" : ""}
                        </td>
                        <td>{formatDuration(visit.durationSeconds)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Countries + roles */}
        <div className="ad-layout-half">
          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <h2>Users by country</h2>
                <p className="ad-card-sub">Where accounts are based</p>
              </div>
            </div>
            {countries.length === 0 ? (
              <EmptyBox title="No users yet." body="Countries appear here once accounts sign up." />
            ) : (
              <ul className="ad-share ad-scroll">
                {countries.map((c) => (
                  <li key={c.name}>
                    <div className="ad-share-row">
                      <span className="ad-share-name">{c.name}</span>
                      <span className="ad-share-count">
                        {c.count} · {userCount > 0 ? Math.round((c.count / userCount) * 100) : 0}%
                      </span>
                    </div>
                    <div className="ad-share-track">
                      <div
                        className="ad-share-fill"
                        style={{ width: `${userCount > 0 ? Math.max((c.count / userCount) * 100, 2) : 0}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <h2>Users by role</h2>
                <p className="ad-card-sub">What accounts do on Lakisa</p>
              </div>
            </div>
            {roles.length === 0 ? (
              <EmptyBox title="No users yet." body="Roles appear here once accounts sign up." />
            ) : (
              <ul className="ad-share ad-scroll">
                {roles.map((r) => (
                  <li key={r.name}>
                    <div className="ad-share-row">
                      <span className="ad-share-name">{r.name}</span>
                      <span className="ad-share-count">
                        {r.count} · {userCount > 0 ? Math.round((r.count / userCount) * 100) : 0}%
                      </span>
                    </div>
                    <div className="ad-share-track">
                      <div
                        className="ad-share-fill ad-share-fill-alt"
                        style={{ width: `${userCount > 0 ? Math.max((r.count / userCount) * 100, 2) : 0}%` }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        {/* Top exhibitions */}
        <section className="ad-card ad-table-card">
          <div className="ad-card-head">
            <div>
              <h2>Top exhibitions by visits</h2>
              <p className="ad-card-sub">The most visited rooms on the platform</p>
            </div>
            <a className="ad-card-link" href="#exhibitions">
              See all exhibitions
            </a>
          </div>
          {topExhibitions.length === 0 ? (
            <EmptyBox title="No visits yet." body="Visits appear here once a public exhibition is opened." />
          ) : (
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Exhibition</th>
                    <th>Owner</th>
                    <th>Status</th>
                    <th>Artworks</th>
                    <th>Visits</th>
                  </tr>
                </thead>
                <tbody>
                  {topExhibitions.map((exhibition) => (
                    <tr key={exhibition.id}>
                      <td>
                        {exhibition.status === "public" ? (
                          <Link href={`/exhibition/${exhibition.slug}`}>{exhibition.title}</Link>
                        ) : (
                          exhibition.title
                        )}
                      </td>
                      <td>
                        {exhibition.owner.name} ({exhibition.owner.email})
                      </td>
                      <td>{exhibition.status}</td>
                      <td>{exhibition._count.artworks}</td>
                      <td>{exhibition.views}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Recent users */}
        <section className="ad-card ad-table-card">
          <div className="ad-card-head">
            <div>
              <h2>Recent users</h2>
              <p className="ad-card-sub">The latest accounts to join</p>
            </div>
            <a className="ad-card-link" href="#users">
              See all users
            </a>
          </div>
          {recentUsers.length === 0 ? (
            <EmptyBox title="No users yet." body="New registrations will appear here." />
          ) : (
            <div className="ad-table-wrap">
              <table className="ad-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Email</th>
                    <th>Country</th>
                    <th>Role</th>
                    <th>Exhibitions</th>
                    <th>Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {recentUsers.map((account) => (
                    <tr key={account.id}>
                      <td>{account.name}</td>
                      <td>{account.email}</td>
                      <td>{account.country ?? "N/A"}</td>
                      <td>{account.role ?? "N/A"}</td>
                      <td>{account._count.exhibitions}</td>
                      <td>{account.createdAt.toLocaleDateString("en-GB")}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
      )}

      {/* Tools used */}
      {canStats && (
      <section id="tools" className="ad-section">
        <div className="ad-section-head">
          <h2>Tools used</h2>
          <p>
            {totalToolUses} {totalToolUses === 1 ? "use" : "uses"} recorded, per tool, all time and in the last 30
            days. Tracking started when this version shipped, so a tool nobody has opened yet shows 0.
          </p>
        </div>
        <div className="ad-layout-half">
          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <h2>Uses per tool</h2>
                <p className="ad-card-sub">Every tool, ranked by total uses</p>
              </div>
              <strong className="ad-card-total">
                {totalToolUses} <span>total</span>
              </strong>
            </div>
            <ul className="ad-share ad-scroll">
              {toolStats.map((t) => (
                <li key={t.slug}>
                  <div className="ad-share-row">
                    <span className="ad-share-name">{t.label}</span>
                    <span className="ad-share-count">
                      {t.allTime} total · {t.last30} in 30 days
                    </span>
                  </div>
                  <div className="ad-share-track">
                    <div
                      className="ad-share-fill"
                      style={{ width: `${t.allTime > 0 ? Math.max((t.allTime / toolMax) * 100, 2) : 0}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <h2>Recent tool activity</h2>
                <p className="ad-card-sub">The latest tools opened, and by whom</p>
              </div>
            </div>
            {recentToolUses.length === 0 ? (
              <EmptyBox
                title="No tool use yet."
                body="Tracking started with this version, uses appear here as soon as someone opens a tool."
              />
            ) : (
              <ul className="ad-feed ad-scroll">
                {recentToolUses.map((use) => {
                  const who = use.userId ? recentToolUsers.get(use.userId) : undefined;
                  return (
                    <li key={use.id}>
                      <span className="ad-feed-dot ad-feed-tool" aria-hidden="true" />
                      <div className="ad-feed-body">
                        <strong>{TOOL_LABELS[use.tool as ToolSlug] ?? use.tool}</strong>
                        <span>{who ? `${who.name} (${who.email})` : "Signed-out visitor"}</span>
                      </div>
                      <span className="ad-feed-time">{relativeTime(use.createdAt)}</span>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      </section>
      )}

      {/* All users */}
      {canUsers && (
      <section id="users" className="ad-section">
        <div className="ad-section-head">
          <h2>All users</h2>
          <p>
            {allUsers.length} {query ? `matching “${query}”` : "registered"}, who they are, what they do, where they
            are based, and when they signed up.
          </p>
        </div>
        <form className="ad-search" method="get" action="#users">
          <input name="q" defaultValue={query} placeholder="Search by name, email or country…" aria-label="Search users" />
          <button type="submit">Search</button>
        </form>
        {allUsers.length === 0 ? (
          <EmptyBox title="No users match." body="Try a different search, or clear it to see everyone." />
        ) : (
          <div className="ad-card ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Country</th>
                  <th>Exhibitions</th>
                  <th>Signed up</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((account) => (
                  <tr key={account.id}>
                    <td>{account.name}</td>
                    <td>{account.email}</td>
                    <td>{account.role ?? "N/A"}</td>
                    <td>{account.country ?? "N/A"}</td>
                    <td>{account._count.exhibitions}</td>
                    <td>{account.createdAt.toLocaleDateString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {/* All exhibitions */}
      {canExhibitions && (
      <section id="exhibitions" className="ad-section">
        <div className="ad-section-head">
          <h2>All exhibitions</h2>
          <p>
            {allExhibitions.length} exhibitions, who built it, whether it is public, how many works it holds and how
            many visits it received.
          </p>
        </div>
        {allExhibitions.length === 0 ? (
          <EmptyBox title="No exhibitions yet." body="Exhibitions appear here as soon as someone creates one." />
        ) : (
          <div className="ad-card ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Exhibition</th>
                  <th>Owner</th>
                  <th>Status</th>
                  <th>Artworks</th>
                  <th>Visits</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {allExhibitions.map((exhibition) => (
                  <tr key={exhibition.id}>
                    <td>
                      {exhibition.status === "public" ? (
                        <Link href={`/exhibition/${exhibition.slug}`}>{exhibition.title}</Link>
                      ) : (
                        exhibition.title
                      )}
                    </td>
                    <td>
                      {exhibition.owner.name} ({exhibition.owner.email})
                    </td>
                    <td>{exhibition.status}</td>
                    <td>{exhibition._count.artworks}</td>
                    <td>{exhibition.views}</td>
                    <td>{exhibition.updatedAt.toLocaleDateString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {/* All artworks */}
      {canArtworks && (
      <section id="artworks" className="ad-section">
        <div className="ad-section-head">
          <h2>All artworks</h2>
          <p>{allArtworks.length} artworks, what it is, where it hangs, and who it belongs to.</p>
        </div>
        {allArtworks.length === 0 ? (
          <EmptyBox title="No artworks yet." body="Artworks appear here as soon as someone adds one to an exhibition." />
        ) : (
          <div className="ad-card ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Artwork</th>
                  <th>Medium</th>
                  <th>Dimensions</th>
                  <th>Year</th>
                  <th>Exhibition</th>
                  <th>Owner</th>
                </tr>
              </thead>
              <tbody>
                {allArtworks.map((artwork) => (
                  <tr key={artwork.id}>
                    <td>{artwork.title}</td>
                    <td>{artwork.medium}</td>
                    <td>{artwork.dimensions}</td>
                    <td>{artwork.year}</td>
                    <td>
                      {artwork.exhibition.title} ({artwork.exhibition.status})
                    </td>
                    <td>{artwork.exhibition.owner.name}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {/* Galleries — room templates */}
      {canGalleries && (
      <section id="galleries" className="ad-section">
        <div className="ad-section-head">
          <h2>Galleries</h2>
          <p>
            {galleryTemplates.length} room templates, the models visitors can pick. Deleting one hides it
            from the catalogue, the creation dialog and the editor; exhibitions already built with it keep
            working.
          </p>
        </div>
        <AdminGalleries templates={galleryTemplates} hidden={hiddenRoomLayouts} canManage={canManageGalleries} />
        <div className="ad-section-head" style={{ marginTop: 28 }}>
          <h3>Gallery names</h3>
          <p>
            Rename any gallery in English and in French. The new name shows on the catalogue, in the
            creation dialog and in the editor, in the matching language.
          </p>
        </div>
        <AdminGalleryNames names={galleryNames} canManage={canManageGalleries} />
      </section>
      )}

      {/* Test reports — feature tests for the new tools (profile photos,
          works wall, website builder, portfolio PDF). Written by
          scripts/test-new-features.mjs to public/test-reports/latest.json. */}
      {canStats && (
      <section id="test-reports" className="ad-section">
        <div className="ad-section-head">
          <h2>Test reports</h2>
          <p>
            Results of the automated feature tests for the new tools, profile photos, works wall, website
            builder (51 templates) and portfolio PDF builder (50 templates). Re-run with{" "}
            <code>node scripts/test-new-features.mjs --build</code>.
          </p>
        </div>
        {!testReport ? (
          <EmptyBox
            title="No test report yet."
            body="Run node scripts/test-new-features.mjs from the repo to generate public/test-reports/latest.json. It will show up here."
          />
        ) : (
          <div className="ad-card ad-table-wrap">
            <p style={{ margin: "0 0 12px", fontSize: 13 }}>
              <strong>
                {testReport.summary.passed}/{testReport.summary.total} passed
              </strong>
              {testReport.summary.failed > 0 && (
                <> · <strong style={{ color: "#9a2b2b" }}>{testReport.summary.failed} failed</strong></>
              )}
              {testReport.summary.skipped > 0 && <> · {testReport.summary.skipped} skipped</>}
              {" · "}generated {new Date(testReport.generatedAt).toLocaleString("en-GB")}
              {" · "}commit <code>{testReport.commit}</code>
            </p>
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Feature</th>
                  <th>Check</th>
                  <th>Status</th>
                  <th>Detail</th>
                </tr>
              </thead>
              <tbody>
                {testReport.checks.map((c) => (
                  <tr key={c.id}>
                    <td>{c.feature}</td>
                    <td>{c.name}</td>
                    <td>
                      {c.status === "pass" ? (
                        <strong style={{ color: "#2e7d32" }}>Passed</strong>
                      ) : c.status === "fail" ? (
                        <strong style={{ color: "#9a2b2b" }}>Failed</strong>
                      ) : (
                        <span style={{ color: "var(--muted)" }}>Skipped</span>
                      )}
                    </td>
                    <td>{c.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      )}

      {/* Subscriptions — the plans, subscribers per plan, every
          account's plan, and plan editing. Free trial: the paywall is
          off, so every tool is open to every account; this section
          manages the structure billing will use later. */}
      {canSubscriptions && (
      <section id="subscriptions" className="ad-section">
        <div className="ad-section-head">
          <h2>Subscriptions</h2>
          <p>
            {allSubscriptions.length} subscribers. Everything is free to try for now: the paywall is
            off, so every tool is open to every account. These plans are the structure billing will
            use later, once a payment provider is connected.
          </p>
        </div>
        <div className="ad-layout-half">
          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <h2>Subscribers per plan</h2>
                <p className="ad-card-sub">Accounts on each plan</p>
              </div>
            </div>
            {subscriptionStats.length === 0 ? (
              <EmptyBox title="No plans yet." body="Plans are seeded automatically on first read." />
            ) : (
              <ShareBars items={subscriptionStats} max={subscriptionMax} />
            )}
          </section>

          <section className="ad-card">
            <div className="ad-card-head">
              <div>
                <h2>Paywall status</h2>
                <p className="ad-card-sub">Free trial mode</p>
              </div>
            </div>
            <p style={{ margin: "0 0 12px", fontSize: 14, lineHeight: 1.6 }}>
              The paywall is <strong>off</strong>: every account can use every tool for free, no
              card, no payment. Plan changes (below, or by the user on the pricing page) are free
              and immediate. To turn billing on later, connect a payment provider first, then set{" "}
              <code>LAKISA_PAYWALL_ENABLED=true</code> in Vercel.
            </p>
            <a className="ad-card-link" href="/pricing" target="_blank" rel="noreferrer">
              See the public pricing page
            </a>
          </section>
        </div>

        <section className="ad-card" style={{ marginTop: 16 }}>
          <div className="ad-card-head">
            <div>
              <h2>Sales</h2>
              <p className="ad-card-sub">
                Real subscription revenue, from the database. Nothing here is a forecast.
              </p>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
            }}
          >
            <div className="ad-card ad-stat">
              <span className="ad-stat-label">Monthly recurring revenue</span>
              <strong className="ad-stat-value">${salesMrr.toFixed(2)}</strong>
              <span className="ad-stat-note">Recurring terms only; one-month terms excluded</span>
            </div>
            <div className="ad-card ad-stat">
              <span className="ad-stat-label">Total collected</span>
              <strong className="ad-stat-value">$0.00</strong>
              <span className="ad-stat-note">Billing is not connected yet, nothing charged</span>
            </div>
            <div className="ad-card ad-stat">
              <span className="ad-stat-label">Paying subscribers</span>
              <strong className="ad-stat-value">{paidSubscriptions.length}</strong>
              <span className="ad-stat-note">
                {salesPayingByPlan.map((p) => `${p.name} ${p.count}`).join(" · ") || "No paid plan yet"}
              </span>
            </div>
            <div className="ad-card ad-stat">
              <span className="ad-stat-label">Conversion</span>
              <strong className="ad-stat-value">{salesConversion.toFixed(1)}%</strong>
              <span className="ad-stat-note">
                {paidSubscriptions.length} paying of {userCount} accounts
              </span>
            </div>
            <div className="ad-card ad-stat">
              <span className="ad-stat-label">New paid, last 14 days</span>
              <strong className="ad-stat-value">{salesNewPaid14d}</strong>
              <span className="ad-stat-note">Paid plans started in the last 14 days</span>
            </div>
          </div>
          <p style={{ margin: "16px 0 0", fontSize: 14, lineHeight: 1.6 }}>
            Current prices: {salesPrices}
          </p>
        </section>
        <AdminSubscriptions plans={plans} subscriptions={subscriptionRows} canManage={canManageSubscriptions} />
      </section>
      )}

      {/* Sub-admins — manager only. The manager adds accounts with
          limited access to this dashboard and picks their sections. */}
      {access.isManager && (
      <section id="sub-admins" className="ad-section">
        <div className="ad-section-head">
          <h2>Sub-admins</h2>
          <p>
            Give a signed-up account limited access to this dashboard. A sub-admin signs in with
            their own account and only sees the sections you pick. Only you, the manager, can add
            or remove sub-admins, and you keep full access.
          </p>
        </div>
        <SubAdmins />
      </section>
      )}

      {canStats && (
      <p className="ad-foot">
        Legacy image storage in the database: {formatBytes(storageBytes)} (R2 is separate).
      </p>
      )}
    </AdminShell>
  );
}
