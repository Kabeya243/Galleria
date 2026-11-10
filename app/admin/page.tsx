import Link from "next/link";
import { redirect } from "next/navigation";
import AdminDenied from "@/components/admin-denied";
import AdminHashRedirect from "@/components/admin-hash-redirect";
import { AdminHero } from "@/components/admin-shell";
import { EmptyBox, ShareBars, Sparkline } from "@/components/admin-ui";
import {
  adminSections,
  formatBytes,
  formatDuration,
  getAdminContext,
  hasAdminPermission,
  loadAdminOverview,
  relativeTime,
  visitLocation,
} from "@/lib/admin-data";

export const metadata = {
  title: "Admin: Lakisa",
  description:
    "The platform overview for the owner: users, exhibitions, artworks, visits and tool use.",
};

export default async function AdminOverviewRoute() {
  const { user, access } = await getAdminContext();
  // Signed-in but not an admin: a clean access-denied panel, rendered
  // here before any data query runs, instead of a redirect to a
  // dashboard that may itself be having a bad minute.
  if (!access.isManager && !access.isSubAdmin) {
    return <AdminDenied user={user} />;
  }
  const sections = adminSections(access);
  if (sections.length === 0) {
    return <AdminDenied user={user} />;
  }
  // A sub-admin without stats.view has no overview to show: send them
  // to the first section they may open instead of an empty page.
  if (!hasAdminPermission(access, "stats.view")) {
    redirect(sections[0] === "overview" ? "/admin" : `/admin/${sections[0]}`);
  }
  const overview = await loadAdminOverview();
  const {
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
  } = overview;

  const now = new Date();
  const todayLabel = now.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <>
      <AdminHero
        eyebrow={access.isManager ? "ADMIN · FOR THE OWNER ONLY" : "ADMIN · SUB-ADMIN"}
        title={access.isManager ? "Hello, Kabeya" : `Hello, ${user.name}`}
        description={
          access.isManager
            ? `${todayLabel}, a look at who joined, what was built, and what visitors viewed on Lakisa.`
            : `${todayLabel}, the sections of Lakisa you may manage.`
        }
      />
      <AdminHashRedirect />
      <div className="ad-section">
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
            <a className="ad-card-link" href="/admin/exhibitions">
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
            <a className="ad-card-link" href="/admin/users">
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

      <p className="ad-foot">
        Legacy image storage in the database: {formatBytes(storageBytes)} (R2 is separate).
      </p>
    </>
  );
}
