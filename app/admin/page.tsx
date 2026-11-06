import Link from "next/link";
import AdminShell from "@/components/admin-shell";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { TOOL_LABELS, TOOL_SLUGS, type ToolSlug } from "@/lib/tool-use";

export const metadata = {
  title: "Admin — SANAA",
  description:
    "The platform overview for the owner: users, exhibitions, artworks, visits and tool use — everything on one page.",
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

export default async function AdminRoute({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireAdmin();
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
  ]);

  const userCount = userDates.length;
  const exhibitionCount = exhibitionDates.length;
  const artworkCount = artworkDates.length;
  const storageBytes = Number(storage[0]?.total ?? 0);
  const views = totalViews._sum.views ?? 0;

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
      title: `New signup — ${a.name}`,
      sub: `${a.email}${a.role ? ` · ${a.role}` : ""}${a.country ? ` · ${a.country}` : ""}`,
      at: a.createdAt,
    })),
    ...recentExhibitions.map((e) => ({
      key: `exhibition-${e.id}`,
      kind: "exhibition",
      title: `Exhibition created — ${e.title}`,
      sub: `by ${e.owner.name} · ${e.status}`,
      at: e.createdAt,
    })),
    ...recentArtworks.map((a) => ({
      key: `artwork-${a.id}`,
      kind: "artwork",
      title: `Artwork added — ${a.title}`,
      sub: `in ${a.exhibition.title}`,
      at: a.createdAt,
    })),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, 8);

  const todayLabel = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <AdminShell
      user={user}
      title="Hello, Kabeya"
      eyebrow="ADMIN · FOR THE OWNER ONLY"
      description={`${todayLabel} — a look at who joined, what was built, and what visitors viewed on SANAA.`}
      counts={{ users: userCount, exhibitions: exhibitionCount, artworks: artworkCount, tools: totalToolUses }}
    >
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
                <h2>Signups — last 14 days</h2>
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
              <ul className="ad-feed">
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
              <h2>Visits — last 30 days</h2>
              <p className="ad-card-sub">Exhibition views per day, all exhibitions</p>
            </div>
            <strong className="ad-card-total">
              {visitsTotal30} <span>visits</span>
            </strong>
          </div>
          {visitsTotal30 === 0 ? (
            <EmptyBox
              title="No visits yet."
              body="Visits are logged from the day Visitor Analytics ships — one row per public exhibition view. They will appear here day by day."
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
              <ul className="ad-share">
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
                <p className="ad-card-sub">What accounts do on SANAA</p>
              </div>
            </div>
            {roles.length === 0 ? (
              <EmptyBox title="No users yet." body="Roles appear here once accounts sign up." />
            ) : (
              <ul className="ad-share">
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
                      <td>{account.country ?? "—"}</td>
                      <td>{account.role ?? "—"}</td>
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

      {/* Tools used */}
      <section id="tools" className="ad-section">
        <div className="ad-section-head">
          <h2>Tools used</h2>
          <p>
            {totalToolUses} {totalToolUses === 1 ? "use" : "uses"} recorded — per tool, all time and in the last 30
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
            <ul className="ad-share">
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
                body="Tracking started with this version — uses appear here as soon as someone opens a tool."
              />
            ) : (
              <ul className="ad-feed">
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

      {/* All users */}
      <section id="users" className="ad-section">
        <div className="ad-section-head">
          <h2>All users</h2>
          <p>
            {allUsers.length} {query ? `matching “${query}”` : "registered"} — who they are, what they do, where they
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
                    <td>{account.role ?? "—"}</td>
                    <td>{account.country ?? "—"}</td>
                    <td>{account._count.exhibitions}</td>
                    <td>{account.createdAt.toLocaleDateString("en-GB")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* All exhibitions */}
      <section id="exhibitions" className="ad-section">
        <div className="ad-section-head">
          <h2>All exhibitions</h2>
          <p>
            {allExhibitions.length} exhibitions — who built it, whether it is public, how many works it holds and how
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

      {/* All artworks */}
      <section id="artworks" className="ad-section">
        <div className="ad-section-head">
          <h2>All artworks</h2>
          <p>{allArtworks.length} artworks — what it is, where it hangs, and who it belongs to.</p>
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

      <p className="ad-foot">
        Legacy image storage in the database: {formatBytes(storageBytes)} (R2 is separate).
      </p>
    </AdminShell>
  );
}
