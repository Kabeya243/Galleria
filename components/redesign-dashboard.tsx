"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import RedesignOnboarding, { type RedesignOnboardingExhibition } from "@/components/redesign-onboarding";
import RedesignShell from "@/components/redesign-shell";
import type { PaletteExhibition } from "@/components/redesign-command-palette";
import { coverImageRef, handleCoverImageError } from "@/lib/image-fallback";
import { useT } from "@/lib/i18n";
import { USER_ROLES } from "@/lib/validation";
import {
  Eye,
  GalleryVerticalEnd,
  Image,
} from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./redesign-dashboard.module.css";

// Redesign dashboard v2 (Nov 2026): the screenshot's layout on real
// data — hero greeting, KPI cards with sparklines (real VisitLog daily
// series), the 3-step Create card, the My Exhibitions grid and the
// Recent Artworks column. All data comes from loadUserDashboard
// (lib/user-dashboard-data.ts); nothing here is demo content. The
// shell (topbar, tabs, sidebar, palette, create dialog, tour) lives
// in components/redesign-shell.tsx and is shared by every redesigned
// page; this file only renders the dashboard's own content.

type KpiStat = { value: number; note: string; spark: number[] };

type RecentArtwork = {
  id: string;
  title: string;
  artist: string;
  medium: string;
  year: string;
  imageUrl: string | null;
  exhibitionId: string;
  exhibitionTitle: string;
  views: number;
};

type TopExhibition = {
  id: string;
  title: string;
  slug: string;
  status: string;
  views: number;
  artworkCount: number;
  coverImageUrl: string | null;
  roomCount: number;
};

// Compact counts the way the screenshot shows them: 9.30K, 2.20K.
function compact(value: number): string {
  if (value >= 1000) return `${(value / 1000).toFixed(2)}K`;
  return value.toLocaleString("en-US");
}

// Sparkline: a 14-point daily series as a filled area + line. Flat
// when every value is zero (a new account with no visits yet).
function Sparkline({ values, color }: { values: number[]; color: string }) {
  const max = Math.max(1, ...values);
  const width = 100;
  const height = 36;
  const pad = 2;
  const points = values.map((value, index) => {
    const x = pad + (index * (width - pad * 2)) / Math.max(1, values.length - 1);
    const y = height - pad - (value / max) * (height - pad * 2);
    return [x, y] as const;
  });
  const line = points.map(([x, y], index) => `${index === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${line} L${points[points.length - 1][0].toFixed(1)},${height} L${points[0][0].toFixed(1)},${height} Z`;
  return (
    <svg className={styles.spark} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-hidden="true">
      <path d={area} fill={color} fillOpacity={0.1} />
      <path
        d={line}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

export default function RedesignDashboard({
  user,
  isNewUser,
  exhibitionCount,
  artworkCount,
  publicExhibitionCount,
  newestExhibition,
  exhibitions,
  stats,
  recentArtworks,
  topExhibitions,
}: {
  user: { id: string; name: string; email: string; avatarUrl?: string | null; isAdmin?: boolean; role?: string | null; country?: string | null };
  isNewUser: boolean;
  exhibitionCount: number;
  artworkCount: number;
  publicExhibitionCount: number;
  newestExhibition: RedesignOnboardingExhibition | null;
  exhibitions: PaletteExhibition[];
  stats: {
    visits: KpiStat;
    engagement: KpiStat;
    artworkViews: KpiStat;
  };
  recentArtworks: RecentArtwork[];
  topExhibitions: TopExhibition[];
}) {
  const t = useT();
  const router = useRouter();

  // Complete your profile (ported from the old dashboard): Google
  // sign-in gives no role or country, so accounts created that way
  // arrive without them. This card asks once, on the dashboard, until
  // the two fields are filled or the visitor dismisses it.
  const [profileRole, setProfileRole] = useState(user.role ?? "");
  const [profileCountry, setProfileCountry] = useState(user.country ?? "");
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileNote, setProfileNote] = useState<string | null>(null);
  const [profileDone, setProfileDone] = useState(false);
  const [profileDismissed, setProfileDismissed] = useState(false);
  useEffect(() => {
    try {
      setProfileDismissed(
        window.localStorage.getItem(`lakisa-profile-prompt-${user.id}`) === "dismissed",
      );
    } catch {
      setProfileDismissed(false);
    }
  }, [user.id]);
  const profileIncomplete = (!user.role || !user.country) && !profileDone && !profileDismissed;

  async function saveProfilePrompt() {
    setProfileSaving(true);
    setProfileNote(null);
    try {
      const response = await fetch("/api/settings/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: user.name,
          role: profileRole || undefined,
          country: profileCountry.trim() || undefined,
        }),
      });
      const result = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not save your profile.");
      setProfileDone(true);
      router.refresh();
    } catch (error) {
      setProfileNote(error instanceof Error ? error.message : "Could not save your profile.");
    } finally {
      setProfileSaving(false);
    }
  }

  function dismissProfilePrompt() {
    try {
      window.localStorage.setItem(`lakisa-profile-prompt-${user.id}`, "dismissed");
    } catch {
      // Private mode: the card just hides for this visit.
    }
    setProfileDismissed(true);
  }

  // Legacy anchor: the visitor analytics used to live on this page
  // under #visitor-analytics. They are their own page now
  // (/dashboard/analytics), so an old link landing here with that
  // anchor is sent to the new page instead of nowhere.
  useEffect(() => {
    if (window.location.hash === "#visitor-analytics") {
      router.replace("/dashboard/analytics");
    }
  }, [router]);

  const kpis: Array<{
    label: string;
    value: string;
    note: string;
    spark: number[];
    color: string;
  }> = [
    {
      label: t("dashboard", "totalVisits"),
      value: compact(stats.visits.value),
      note: stats.visits.note,
      spark: stats.visits.spark,
      color: "#5b8def",
    },
    {
      label: t("dashboard", "exhibitionEngagement"),
      value: `${stats.engagement.value.toFixed(1)}%`,
      note: stats.engagement.note,
      spark: stats.engagement.spark,
      color: "#a55eea",
    },
    {
      label: t("dashboard", "artworkViews"),
      value: compact(stats.artworkViews.value),
      note: stats.artworkViews.note,
      spark: stats.artworkViews.spark,
      color: "#2fbf71",
    },
  ];

  return (
    <RedesignShell
      user={user}
      active="dashboard"
      exhibitionCount={exhibitionCount}
      exhibitions={exhibitions}
      openTourOnMount={isNewUser}
    >
      {({ openCreate }) => (
        <>
          <div className={styles.dashGrid}>
            <div className={styles.dashCol}>
              <section className={`${styles.card} ${styles.hero}`} aria-label={t("dashboard", "hello")}>
                <h1>
                  {t("dashboard", "hello")} {user.name}!
                  <span className={styles.heroTagline}>{t("dashboard", "elevateCreativity")}</span>
                </h1>
              </section>

              <section className={styles.kpis3} aria-label={t("dashboard", "yourStatistics")}>
                {kpis.map((kpi) => {
                  const min = Math.min(...kpi.spark);
                  const max = Math.max(...kpi.spark);
                  return (
                    <article className={`${styles.card} ${styles.kpiSpark}`} key={kpi.label}>
                      <span className={styles.kpiSparkLabel}>{kpi.label}</span>
                      <span className={`${styles.kpiSparkValue} ${styles.tnum}`}>{kpi.value}</span>
                      <p className={styles.kpiSparkNote}>{kpi.note}</p>
                      <Sparkline values={kpi.spark} color={kpi.color} />
                      <span className={styles.sparkAxis} aria-hidden="true">
                        <span className={styles.tnum}>{compact(min)}</span>
                        <span className={styles.tnum}>{compact(max)}</span>
                      </span>
                    </article>
                  );
                })}
              </section>

              <RedesignOnboarding
                exhibitionCount={exhibitionCount}
                artworksCount={artworkCount}
                publicExhibitionsCount={publicExhibitionCount}
                newestExhibition={newestExhibition}
                onCreate={openCreate}
              />

              {profileIncomplete && (
                <section className={styles.card} aria-label="Complete your profile">
                  <div className={styles.cardHead}>
                    <div>
                      <span className={styles.eyebrow}>Your profile</span>
                      <h2>Tell us who you are</h2>
                      <p className={styles.cardSub}>
                        Are you an artist, a curator, a collector? And where are you based? It helps us invite you to
                        the right open calls and shows.
                      </p>
                    </div>
                  </div>
                  <div className={styles.profilePromptFields}>
                    <label className={styles.profileField}>
                      <span>{t("auth", "yourRole")}</span>
                      <select value={profileRole} onChange={(e) => setProfileRole(e.target.value)}>
                        <option value="">{t("auth", "chooseRole")}</option>
                        {USER_ROLES.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.profileField}>
                      <span>{t("auth", "country")}</span>
                      <input
                        value={profileCountry}
                        onChange={(e) => setProfileCountry(e.target.value)}
                        placeholder={t("auth", "countryPlaceholder")}
                        maxLength={80}
                      />
                    </label>
                    <button
                      type="button"
                      className={styles.createBtn}
                      onClick={() => void saveProfilePrompt()}
                      disabled={profileSaving}
                    >
                      {profileSaving ? "Saving…" : "Save"}
                    </button>
                    <button type="button" className={styles.textBtn} onClick={dismissProfilePrompt}>
                      Not now
                    </button>
                  </div>
                  {profileNote && <p className={styles.profileNote}>{profileNote}</p>}
                  <p className={styles.profileHint}>
                    You can change these anytime in <Link href="/settings">Settings</Link>.
                  </p>
                </section>
              )}
            </div>

            <div className={styles.dashCol}>
              <div className={styles.sectionHead}>
                <h2>{t("redesign", "myExhibitions")}</h2>
                <Link className={styles.cardLink} href="/exhibitions">
                  {t("dashboard", "seeAll")}
                </Link>
              </div>
              {topExhibitions.length === 0 ? (
                <p className={styles.empty}>{t("dashboard", "noExhibitionsYet")}</p>
              ) : (
                <div className={styles.expoGrid}>
                  {topExhibitions.map((exhibition) => (
                    <Link key={exhibition.id} className={styles.expoMini} href={`/editor/${exhibition.id}`}>
                      <span className={styles.expoMiniCover}>
                        {exhibition.coverImageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={exhibition.coverImageUrl}
                            alt=""
                            loading="lazy"
                            onError={handleCoverImageError}
                            ref={coverImageRef}
                          />
                        ) : (
                          <span className={styles.expoMiniCoverFallback} aria-hidden="true">
                            <GalleryVerticalEnd size={20} />
                          </span>
                        )}
                      </span>
                      <span className={styles.expoMiniBody}>
                        <span className={styles.expoMiniTitle}>{exhibition.title}</span>
                        <span className={styles.expoMiniFoot}>
                          <span
                            className={`${styles.badge} ${
                              exhibition.status === "public" ? styles.badgeLive : styles.badgeDraft
                            }`}
                          >
                            <span className={styles.badgeDot} aria-hidden="true" />
                            {exhibition.status === "public"
                              ? t("exhibitions", "published")
                              : t("exhibitions", "draft")}
                          </span>
                          <span className={styles.expoMiniVisits}>
                            <Eye size={13} />{" "}
                            <span className={styles.tnum}>{exhibition.views.toLocaleString("en-US")}</span>
                          </span>
                        </span>
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>

            <div className={`${styles.dashCol} ${styles.recentCol}`}>
              <div className={styles.sectionHead}>
                <h2>{t("dashboard", "recentArtworks")}</h2>
                <Link className={styles.cardLink} href="/artworks">
                  {t("dashboard", "seeAllArtworks")}
                </Link>
              </div>
              {recentArtworks.length === 0 ? (
                <p className={styles.empty}>{t("works", "noWorksYet")}</p>
              ) : (
                <div className={styles.recentList}>
                  {recentArtworks.map((artwork) => {
                    const subtitle = [artwork.artist || artwork.exhibitionTitle, artwork.medium, artwork.year]
                      .filter(Boolean)
                      .join(" · ");
                    return (
                      <Link key={artwork.id} className={styles.recentCard} href="/artworks">
                        <span className={styles.recentThumb}>
                          {artwork.imageUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={artwork.imageUrl}
                              alt=""
                              loading="lazy"
                              onError={handleCoverImageError}
                              ref={coverImageRef}
                            />
                          ) : (
                            <span className={styles.expoMiniCoverFallback} aria-hidden="true">
                              <Image size={20} />
                            </span>
                          )}
                        </span>
                        <span className={styles.recentBody}>
                          <span className={styles.recentTitle}>{artwork.title}</span>
                          <span className={styles.recentArtist}>{subtitle}</span>
                          <span className={styles.recentFoot}>
                            <span>
                              <Eye size={13} />{" "}
                              <span className={styles.tnum}>{artwork.views.toLocaleString("en-US")}</span>
                            </span>
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <footer className={styles.footer}>
            <span>{t("common", "footerRights")}</span>
            <span>{t("common", "footerTagline")}</span>
          </footer>
        </>
      )}
    </RedesignShell>
  );
}
