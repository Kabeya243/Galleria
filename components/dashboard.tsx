"use client";

import Link from "next/link";
import Sidebar from "@/components/sidebar";
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

type ChartDay = { label: string; full: string; count: number; isRecentWeek: boolean };

export default function Dashboard({
  user,
  exhibitionCount,
  stats,
  chart,
  chartTotal,
  chartRange,
  topExhibitions,
}: {
  user: { name: string; email: string; isAdmin?: boolean };
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
}) {
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const firstName = user.name.split(" ")[0] || user.name;
  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  const filteredExhibitions = topExhibitions.filter((exhibition) =>
    exhibition.title.toLowerCase().includes(query.trim().toLowerCase()),
  );
  const maxCount = Math.max(1, ...chart.map((day) => day.count));

  async function createExhibition() {
    setCreating(true);
    try {
      const response = await fetch("/api/exhibitions", { method: "POST" });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not create an exhibition.");
      window.location.assign(`/editor/${result.exhibition.id}`);
    } catch (error) {
      console.error("Could not create exhibition.", error);
      window.alert(error instanceof Error ? error.message : "Could not create an exhibition.");
      setCreating(false);
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
      label: "My exhibitions",
      icon: <GalleryVerticalEnd size={14} />,
      value: stats.exhibitions.value,
      delta: stats.exhibitions.delta,
      tone: stats.exhibitions.tone,
    },
    {
      label: "My artworks",
      icon: <Image size={14} />,
      value: stats.artworks.value,
      delta: stats.artworks.delta,
      tone: stats.artworks.tone,
    },
    {
      label: "Total visits",
      icon: <Eye size={14} />,
      value: stats.views.value,
      delta: stats.views.note,
      tone: "flat",
    },
    {
      label: "Public exhibitions",
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
              <span className="eyebrow">Your creative space</span>
              <h1>Hello, {firstName}!</h1>
              <p className="welcome-copy">Here is an overview of your work on SANAA.</p>
            </div>
            <div className={styles.headerActions}>
              <label className={styles.search}>
                <Search size={16} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search your exhibitions…"
                  aria-label="Search your exhibitions"
                />
              </label>
              <span className={styles.avatar} aria-hidden="true">
                {initials}
              </span>
              <span className={styles.userName}>{user.name}</span>
              <button className={styles.createButton} onClick={createExhibition} disabled={creating}>
                <Plus size={16} /> {creating ? "Creating…" : "Create an exhibition"}
              </button>
            </div>
          </div>

          <section className={styles.stats} aria-label="Your statistics">
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

          <section className={styles.card} aria-label="Your activity">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Activity</span>
                <h2>Your activity</h2>
                <p className={styles.cardSub}>Artworks added per day · {chartRange}</p>
              </div>
              <strong className={styles.cardTotal}>
                {chartTotal} <span>new in 14 days</span>
              </strong>
            </div>
            <div className={styles.chart}>
              {chart.map((day) => (
                <div className={styles.barWrap} key={day.full} title={`${day.full}: ${day.count} artwork${day.count === 1 ? "" : "s"} added`}>
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
              <span><i className={`${styles.legendDot} ${styles.barRecent}`} /> Last 7 days</span>
              <span><i className={`${styles.legendDot} ${styles.barOlder}`} /> Previous 7 days</span>
            </div>
          </section>

          <section className={styles.card} aria-label="Top exhibitions by visits">
            <div className="section-heading">
              <div>
                <span className="eyebrow">Most visited</span>
                <h2>Top exhibitions by visits</h2>
                <p className={styles.cardSub}>Your most visited rooms</p>
              </div>
              <Link className="view-all" href="/exhibitions">
                See all exhibitions
              </Link>
            </div>
            {filteredExhibitions.length === 0 ? (
              <p className={styles.empty}>
                {topExhibitions.length === 0
                  ? "No exhibitions yet — create your first one to start."
                  : "No exhibitions match your search."}
              </p>
            ) : (
              <div className={styles.tableWrap}>
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Exhibition</th>
                      <th>Status</th>
                      <th>Artworks</th>
                      <th>Visits</th>
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
                            {exhibition.status === "public" ? "Public" : "Draft"}
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

          <footer className={styles.footer}>
            <span>© 2026 SANAA Studio</span>
            <span>Made for art, made for everyone.</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
