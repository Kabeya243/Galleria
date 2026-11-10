"use client";

import Link from "next/link";
import Avatar from "@/components/avatar";
import PlanCard from "@/components/plan-card";
import Sidebar from "@/components/sidebar";
import ExhibitionCreateDialog from "@/components/exhibition-create-dialog";
import VisitorAnalytics, {
  type AnalyticsDay,
  type AnalyticsExhibition,
  type CountRow,
  type TopArtwork,
} from "@/components/visitor-analytics";
import { useT } from "@/lib/i18n";
import type { RoomModelId } from "@/lib/rooms";
import {
  ArrowUpRight,
  Compass,
  Eye,
  GalleryVerticalEnd,
  Image,
  Plus,
  Search,
} from "lucide-react";
import { useState } from "react";
import styles from "./user-dashboard.module.css";

type StatDelta = { value: number; delta: string; tone: "up" | "flat" };

type TopExhibition = {
  id: string;
  title: string;
  slug: string;
  status: string;
  views: number;
  artworkCount: number;
};

// The full per-exhibition visitor analytics (merged here from the old
// Visitor Analytics tool, Nov 2026). Null when the user has no
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

type ChartDay = { label: string; full: string; count: number; isRecentWeek: boolean };

export default function Dashboard({
  user,
  exhibitionCount,
  stats,
  chart,
  chartTotal,
  chartRange,
  topExhibitions,
  visitorAnalytics,
}: {
  user: { id: string; name: string; email: string; avatarUrl?: string | null; isAdmin?: boolean };
  exhibitionCount: number;
  stats: {
    exhibitions: StatDelta;
    artworks: StatDelta;
    views: { value: number; note: string };
    publicExhibitions: StatDelta;
  };
  chart: ChartDay[];
  chartTotal: number;
  chartRange: string;
  topExhibitions: TopExhibition[];
  visitorAnalytics: DashboardVisitorAnalytics | null;
}) {
  const t = useT();
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const firstName = user.name.split(" ")[0] || user.name;

  const filteredExhibitions = topExhibitions.filter((exhibition) =>
    exhibition.title.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const maxCount = Math.max(1, ...chart.map((day) => day.count));

  // Feature 7: the title is mandatory and a room model is picked in the
  // dialog — the POST no longer creates an "Untitled exhibition".
  async function createExhibition(title: string, model: RoomModelId) {
    setCreating(true);
    try {
      const response = await fetch("/api/exhibitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, model }),
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? t("dashboard", "couldNotCreate"));
      window.location.assign(`/editor/${result.exhibition.id}`);
    } catch (error) {
      console.error("Could not create exhibition.", error);
      setCreateError(error instanceof Error ? error.message : t("dashboard", "couldNotCreate"));
      setCreating(false);
      throw error;
    }
  }

  const statCards: {
    label: string;
    icon: React.ReactNode;
    value: number;
    delta: string;
    tone: "up" | "flat";
  }[] = [
    {
      label: t("dashboard", "myExhibitions"),
      icon: <GalleryVerticalEnd size={14} />,
      value: stats.exhibitions.value,
      delta: stats.exhibitions.delta,
      tone: stats.exhibitions.tone,
    },
    {
      label: t("dashboard", "myArtworks"),
      icon: <Image size={14} />,
      value: stats.artworks.value,
      delta: stats.artworks.delta,
      tone: stats.artworks.tone,
    },
    {
      label: t("dashboard", "totalVisits"),
      icon: <Eye size={14} />,
      value: stats.views.value,
      delta: stats.views.note,
      tone: "flat",
    },
    {
      label: t("dashboard", "publicExhibitions"),
      icon: <Compass size={14} />,
      value: stats.publicExhibitions.value,
      delta: stats.publicExhibitions.delta,
      tone: stats.publicExhibitions.tone,
    },
  ];

  return (
    <div className="app-shell">
      <Sidebar user={user} active="overview" exhibitionCount={exhibitionCount} />

      <main className="dashboard-main">
        <div className="dashboard-content">
          <div className="welcome-row">
            <div>
              <span className="eyebrow">{t("dashboard", "creativeSpace")}</span>
              <h1>{t("dashboard", "hello")} {firstName}!</h1>
              <p className="welcome-copy">{t("dashboard", "overview")}</p>
            </div>
            <div className={styles.headerActions}>
              <label className={styles.search}>
                <Search size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder={t("dashboard", "searchPlaceholder")}
                  aria-label={t("dashboard", "searchAria")}
                />
              </label>
              <Avatar name={user.name} avatarUrl={user.avatarUrl} className={styles.avatar} />
              <span className={styles.userName}>{user.name}</span>
              <Link href={`/works/${user.id}`} className={styles.worksLink}>
                {t("works", "myWorks")}
              </Link>
              <button className={styles.createButton} onClick={() => setShowCreateDialog(true)} disabled={creating}>
                <Plus size={16} /> {creating ? t("dashboard", "creating") : t("dashboard", "createExhibition")}
              </button>
            </div>
          </div>

          {showCreateDialog && (
            <ExhibitionCreateDialog
              onClose={() => setShowCreateDialog(false)}
              onCreate={createExhibition}
            />
          )}

          {createError && (
            <div className="editor-error-banner" role="alert">
              <span>{createError}</span>
              <button type="button" aria-label={t("common", "dismiss")} onClick={() => setCreateError(null)}>
                ×
              </button>
            </div>
          )}

          <section className={styles.stats} aria-label={t("dashboard", "yourStatistics")}>
            {statCards.map((card) => (
              <article className="stat-card" key={card.label}>
                <div className="stat-label">
                  <span>{card.label}</span>
                  <span className="stat-icon">{card.icon}</span>
                </div>
                <div className="stat-value">{card.value}</div>
                <div className={`stat-trend ${card.tone === "up" ? styles.deltaUp : ""}`}>
                  {card.tone === "up" ? <ArrowUpRight size={13} /> : null}
                  {card.delta}
                </div>
              </article>
            ))}
          </section>

          <PlanCard />

          <section className={styles.card} aria-label="Your activity">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{t("dashboard", "activity")}</span>
                <h2>{t("dashboard", "yourActivity")}</h2>
                <p className={styles.cardSub}>{t("dashboard", "artworksPerDay")} {chartRange}</p>
              </div>
              <strong className={styles.cardTotal}>
                {chartTotal} <span>{t("dashboard", "newIn14Days")}</span>
              </strong>
            </div>
            <div className={styles.chart}>
              {chart.map((day) => (
                <div className={styles.barWrap} key={day.full} title={`${day.full}: ${day.count} ${day.count === 1 ? t("dashboard", "artworkAdded") : t("dashboard", "artworksAdded")}`}>
                  {day.count > 0 && <span className={styles.barValue}>{day.count}</span>}
                  <div
                    className={`${styles.bar} ${day.isRecentWeek ? styles.barRecent : styles.barOlder} ${day.count === maxCount && day.count > 0 ? styles.barMax : ""}`}
                    style={{ height: `${Math.max(day.count > 0 ? 6 : 2, (day.count / maxCount) * 100)}%` }}
                  />
                  <span className={styles.barLabel}>{day.label}</span>
                </div>
              ))}
            </div>
            <div className={styles.chartLegend}>
              <span><i className={`${styles.legendDot} ${styles.barRecent}`} /> {t("dashboard", "last7Days")}</span>
              <span><i className={`${styles.legendDot} ${styles.barOlder}`} /> {t("dashboard", "previous7Days")}</span>
            </div>
          </section>

          <section className={styles.card} aria-label="Top exhibitions by visits">
            <div className="section-heading">
              <div>
                <span className="eyebrow">{t("dashboard", "mostVisited")}</span>
                <h2>{t("dashboard", "topExhibitions")}</h2>
                <p className={styles.cardSub}>{t("dashboard", "yourMostVisited")}</p>
              </div>
              <Link className="view-all" href="/exhibitions">
                {t("dashboard", "seeAll")}
              </Link>
            </div>
            {filteredExhibitions.length === 0 ? (
              <p className={styles.empty}>
                {topExhibitions.length === 0
                  ? t("dashboard", "noExhibitionsYet")
                  : t("dashboard", "noExhibitionsMatch")}
              </p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>{t("dashboard", "exhibition")}</th>
                      <th>{t("dashboard", "status")}</th>
                      <th>{t("dashboard", "artworks")}</th>
                      <th>{t("dashboard", "visits")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredExhibitions.map((exhibition) => (
                      <tr key={exhibition.id}>
                        <td>
                          <Link className={styles.tableTitle} href={`/editor/${exhibition.id}`}>
                            {exhibition.title}
                          </Link>
                        </td>
                        <td>
                          <span className={`${styles.statusBadge} ${exhibition.status === "public" ? styles.statusPublic : styles.statusDraft}`}>
                            {exhibition.status === "public" ? t("dashboard", "public") : t("dashboard", "draft")}
                          </span>
                        </td>
                        <td>{exhibition.artworkCount}</td>
                        <td>{exhibition.views}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {/* Visitor analytics (merged here from the old Visitor
              Analytics tool, Nov 2026): visits, unique visitors, most
              viewed artworks, devices, traffic sources and countries,
              per exhibition, with a CSV export. The anchor
              #visitor-analytics is where /tools/visitor-analytics and
              the Intelligence hub link to. */}
          <section id="visitor-analytics" className={styles.card} aria-label={t("stats", "visitorStats")}>
            <div className="section-heading">
              <div>
                <span className="eyebrow">{t("stats", "visits")}</span>
                <h2>{t("stats", "visitorStats")}</h2>
                <p className={styles.cardSub}>{t("stats", "visitorStatsDesc")}</p>
              </div>
            </div>
            {visitorAnalytics === null ? (
              <p className={styles.empty}>{t("stats", "noExhibitionsForStats")}</p>
            ) : (
              <VisitorAnalytics
                {...visitorAnalytics}
                basePath="/"
                selectSuffix="#visitor-analytics"
              />
            )}
          </section>

          <footer className={styles.footer}>
            <span>{t("common", "footerRights")}</span>
            <span>{t("common", "footerTagline")}</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
