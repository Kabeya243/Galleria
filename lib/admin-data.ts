// Admin data loaders (Nov 2026): the Admin used to be one single page
// that ran every query for every section on each visit. Each admin page
// now loads only what its own section needs, through the loaders below.
// Nothing here changes the numbers: the queries and the derivations are
// the ones the single page ran, moved verbatim. Server-only: Prisma and
// node fs live here, never import this from a client component.

import { hasAdminPermission, requireAdminAccess, type AdminAccess } from "@/lib/admin";
import { db } from "@/lib/db";
import { getGalleryNames } from "@/lib/gallery-names-server";
import { getHiddenRoomLayouts } from "@/lib/hidden-room-layouts";
import { getAllPromoCodes } from "@/lib/promo-codes";
import { getReferralStats } from "@/lib/referrals";
import { getAllPlans } from "@/lib/subscriptions";
import { HIDDEN_LAYOUT_KEYS, ROOM_MODELS, roomLayouts, type RoomLayout } from "@/lib/rooms";
import { TOOL_LABELS, TOOL_SLUGS, type ToolSlug } from "@/lib/tool-use";

export { hasAdminPermission };

// The section ids an admin viewer may open, in nav order. The manager
// holds every permission, so every section shows for him.
export function adminSections(access: AdminAccess): string[] {
  return [
    ...(hasAdminPermission(access, "stats.view") ? ["overview", "tools", "test-reports"] : []),
    ...(hasAdminPermission(access, "users.view") ? ["users"] : []),
    ...(hasAdminPermission(access, "exhibitions.view") ? ["exhibitions"] : []),
    ...(hasAdminPermission(access, "artworks.view") ? ["artworks"] : []),
    ...(hasAdminPermission(access, "galleries.view") ? ["galleries"] : []),
    ...(hasAdminPermission(access, "subscriptions.view") ? ["subscriptions"] : []),
    ...(hasAdminPermission(access, "orders.view") ? ["orders"] : []),
    ...(access.isManager ? ["sub-admins"] : []),
  ];
}

// The gate every admin page runs first: signed-out visitors are sent to
// /login (requireAdminAccess redirects); a signed-in account without
// admin access gets NO_ACCESS and the page renders the denied panel.
export async function getAdminContext() {
  return requireAdminAccess();
}

// Nav badge counts for the admin shell (cheap count() queries, run on
// every admin page so the sidebar badges stay true).
export async function loadAdminShellCounts() {
  const [users, exhibitions, artworks, tools, orders] = await Promise.all([
    db.user.count(),
    db.exhibition.count(),
    db.artwork.count(),
    db.toolUse.count(),
    db.order.count(),
  ]);
  return { users, exhibitions, artworks, tools, orders };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function relativeTime(d: Date): string {
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
export function dailyCounts(dates: Date[], days: number): { date: Date; count: number }[] {
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

export function deltaTone(now: number, prev: number): { text: string; tone: "up" | "down" | "flat" } {
  const diff = now - prev;
  if (diff > 0) return { text: `+${diff} vs previous 7 days`, tone: "up" };
  if (diff < 0) return { text: `${diff} vs previous 7 days`, tone: "down" };
  return { text: "Same as previous 7 days", tone: "flat" };
}

// Feature-test report (parts 1-5 of the SANAA extension mission), written
// by scripts/test-new-features.mjs to public/test-reports/latest.json.
// Read from disk on each admin visit; missing or unreadable file = empty
// state, never a crash.
export type TestReportCheck = {
  feature: string;
  id: string;
  name: string;
  status: "pass" | "fail" | "skip";
  detail: string;
};
export type TestReport = {
  generatedAt: string;
  commit: string;
  summary: { total: number; passed: number; failed: number; skipped: number };
  checks: TestReportCheck[];
};

export async function readTestReport(): Promise<TestReport | null> {
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

// ---- Overview (the /admin page) ----

const countryName = new Intl.DisplayNames(["en"], { type: "region" });

export function visitCountry(code: string | null): string {
  if (!code) return "";
  try {
    return countryName.of(code) ?? code;
  } catch {
    return code;
  }
}

export function visitLocation(v: {
  city: string | null;
  region: string | null;
  country: string | null;
}): string {
  const parts = [v.city, v.region, visitCountry(v.country)].filter(
    (p): p is string => Boolean(p && p.trim()),
  );
  return parts.length > 0 ? parts.join(", ") : "Not specified";
}

export function formatDuration(seconds: number | null): string {
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

export async function loadAdminOverview() {
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
    visitLogDays,
    recentVisits,
    browserGroups,
    osGroups,
    deviceGroups,
    cityGroups,
    uniqueVisitors30Rows,
    returningVisitors30Rows,
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

  return {
    userCount,
    exhibitionCount,
    artworkCount,
    storageBytes,
    views,
    publicExhibitions,
    usersThisWeek,
    exhibitionsThisWeek,
    artworksThisWeek,
    usersDelta,
    exhibitionsDelta,
    artworksDelta,
    signupDays,
    exhibitionDays,
    artworkDays,
    signupsTotal,
    signupMax,
    visitDays,
    visitsTotal30,
    visitMax,
    browserStats,
    browserMax,
    osStats,
    osMax,
    deviceStats,
    deviceMax,
    cityStats,
    cityMax,
    recentVisits,
    visitExhibitionById,
    visitArtworkById,
    uniqueVisitors30,
    newVisitors30,
    returningVisitors30,
    countries,
    roles,
    topExhibitions,
    recentUsers,
    activity,
  };
}

// ---- Tools used (/admin/tools) ----

export async function loadAdminTools() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [toolUseAllTime, toolUseLast30Days, recentToolUses] = await Promise.all([
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
  ]);
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
  return { toolStats, totalToolUses, toolMax, recentToolUses, recentToolUsers };
}

// ---- All users (/admin/users) ----

export async function loadAdminUsers(query: string) {
  return db.user.findMany({
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
  });
}

// ---- All exhibitions (/admin/exhibitions) ----

export async function loadAdminExhibitions() {
  return db.exhibition.findMany({
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
  });
}

// ---- All artworks (/admin/artworks) ----

export async function loadAdminArtworks() {
  return db.artwork.findMany({
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
  });
}

// ---- Galleries (/admin/galleries) ----

export async function loadAdminGalleries() {
  const [hiddenRoomLayouts, galleryNames] = await Promise.all([
    // Room templates the owner hid in the admin: the list lives in code,
    // this only masks ids.
    getHiddenRoomLayouts(),
    // Gallery names in both languages, admin renames included.
    getGalleryNames(),
  ]);
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
  return { hiddenRoomLayouts, galleryNames, galleryTemplates };
}

// ---- Test reports (/admin/test-reports) ----

export async function loadAdminTestReports() {
  return readTestReport();
}

// ---- Subscriptions (/admin/subscriptions) ----
// The numbers are the ones the single admin page computed, moved verbatim.
// Sales: real numbers from the subscription rows, never invented. MRR
// counts recurring terms only (monthly at full price, yearly at one
// twelfth); a one-month-only term is one-time revenue, not recurring.
// Total collected is $0 until billing is connected: every plan change
// today is a free trial, so nothing has been charged. Conversion is
// paying accounts over all accounts.

export async function loadAdminSubscriptions() {
  const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
  const [plans, allSubscriptions, subscriptionCounts, paidSubscriptions, userCount, promoCodes, referralStats] = await Promise.all([
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
    db.user.count(),
    // Promo codes and referrals (Nov 2026): every code with its uses,
    // and the referral numbers, all counted from the database.
    getAllPromoCodes(),
    getReferralStats(),
  ]);
  const subscriptionStats = plans.map((p) => ({
    name: p.name,
    count: subscriptionCounts.find((c) => c.planId === p.id)?._count._all ?? 0,
  }));
  const subscriptionMax = Math.max(...subscriptionStats.map((s) => s.count), 1);
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
  // Promo codes are serialised for the client component (dates as
  // ISO strings); referral stats are plain JSON already.
  const promoCodeRows = promoCodes.map((p) => ({
    ...p,
    expiresAt: p.expiresAt ? p.expiresAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
  }));
  return {
    plans,
    subscriptionRows,
    subscriptionStats,
    subscriptionMax,
    salesMrr,
    salesPayingByPlan,
    salesConversion,
    salesNewPaid14d,
    salesPrices,
    paidSubscriptions,
    userCount,
    allSubscriptionsCount: allSubscriptions.length,
    promoCodes: promoCodeRows,
    referralStats,
  };
}

// ---- Orders (/admin/orders) ----

// Every marketplace order, with the fee split and the platform totals
// (grouped by currency, since orders can be priced in different
// currencies). Commission collected counts live orders only
// (cancelled and refunded orders are excluded); "to pay out" counts
// the seller share of orders whose payment cleared, and "waiting for
// payment" the seller share of pending orders. Until Flutterwave is
// connected every order is pending payment, so the collected and
// paid-out totals are zero and the pending total is the amount that
// will be due to sellers once payments clear.
export async function loadAdminOrders() {
  const rows = await db.order.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
    include: {
      listing: { select: { title: true } },
      buyer: { select: { name: true, email: true } },
      seller: { select: { name: true, email: true } },
    },
  });
  const live = rows.filter((o) => o.status !== "cancelled" && o.status !== "refunded");
  const paid = live.filter((o) => o.status !== "pending_payment");
  const pending = live.filter((o) => o.status === "pending_payment");
  const sumByCurrency = (list: typeof rows, field: "commissionAmount" | "sellerNet") => {
    const map = new Map<string, number>();
    for (const o of list) {
      map.set(o.currency, (map.get(o.currency) ?? 0) + o[field]);
    }
    return [...map.entries()].map(([currency, amount]) => ({ currency, amount }));
  };
  return {
    orders: rows.map((o) => ({
      id: o.id,
      listingId: o.listingId,
      listingTitle: o.listing.title,
      buyerName: o.buyer.name,
      buyerEmail: o.buyer.email,
      sellerName: o.seller.name,
      sellerEmail: o.seller.email,
      finalPrice: o.finalPrice,
      currency: o.currency,
      commissionRate: o.commissionRate,
      commissionAmount: o.commissionAmount,
      paymentMethod: o.paymentMethod,
      paymentFeeRate: o.paymentFeeRate,
      paymentFeeAmount: o.paymentFeeAmount,
      sellerNet: o.sellerNet,
      status: o.status,
      createdAt: o.createdAt.toISOString(),
    })),
    totals: {
      commission: sumByCurrency(live, "commissionAmount"),
      toPayOut: sumByCurrency(paid, "sellerNet"),
      waitingPayment: sumByCurrency(pending, "sellerNet"),
    },
    orderCount: rows.length,
  };
}
