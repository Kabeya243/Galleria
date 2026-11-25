"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import ExhibitionCreateDialog from "@/components/exhibition-create-dialog";
import NotificationBell from "@/components/notification-bell";
import RedesignCommandPalette, { type PaletteExhibition } from "@/components/redesign-command-palette";
import RedesignOnboarding, { type RedesignOnboardingExhibition } from "@/components/redesign-onboarding";
import RedesignSidebar, { REDESIGN_SIDEBAR_COLLAPSED_KEY } from "@/components/redesign-sidebar";
import WelcomeTour, { hasSeenWelcomeTour } from "@/components/welcome-tour";
import { useLocale, useT, LOCALE_TAGS } from "@/lib/i18n";
import type { RoomModelId } from "@/lib/rooms";
import { applyTheme, getStoredTheme, resolveTheme } from "@/lib/theme";
import { USER_ROLES } from "@/lib/validation";
import {
  ArrowUpRight,
  Compass,
  Eye,
  GalleryVerticalEnd,
  Image,
  Moon,
  Plus,
  Route,
  Search,
  Sun,
} from "lucide-react";
import { useEffect, useState } from "react";
import styles from "./redesign-dashboard.module.css";

// Redesign dashboard (Phase 1, Nov 2026): the prototype's layout on
// real data — grouped sidebar, ⌘K palette, light/dark toggle, compact
// 3-step onboarding, KPI cards with deltas and micro-actions, activity
// chart and top exhibitions. All data comes from loadUserDashboard
// (lib/user-dashboard-data.ts); nothing here is demo content. The old
// components/dashboard.tsx stays on disk, unused, until the redesign
// is validated and the old one is removed.

type StatDelta = { value: number; delta: string; tone: "up" | "flat" };

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

type ChartDay = { label: string; full: string; count: number; isRecentWeek: boolean };

export default function RedesignDashboard({
  user,
  isNewUser,
  exhibitionCount,
  newestExhibition,
  exhibitions,
  stats,
  chart,
  chartTotal,
  chartRange,
  topExhibitions,
}: {
  user: { id: string; name: string; email: string; avatarUrl?: string | null; isAdmin?: boolean; role?: string | null; country?: string | null };
  isNewUser: boolean;
  exhibitionCount: number;
  newestExhibition: RedesignOnboardingExhibition | null;
  exhibitions: PaletteExhibition[];
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
  const t = useT();
  const { locale } = useLocale();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const firstName = user.name.split(" ")[0] || user.name;

  // Sidebar collapse preference (per browser), read after mount.
  useEffect(() => {
    try {
      setSidebarCollapsed(window.localStorage.getItem(REDESIGN_SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      setSidebarCollapsed(false);
    }
  }, []);

  function handleSidebarCollapsed(value: boolean) {
    setSidebarCollapsed(value);
    try {
      window.localStorage.setItem(REDESIGN_SIDEBAR_COLLAPSED_KEY, value ? "1" : "0");
    } catch {
      // Private mode: the preference just does not stick.
    }
  }

  // Theme toggle (same mechanism as components/theme-toggle.tsx and
  // lib/theme.ts: localStorage + cookie, data-theme on <html>).
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const sync = () => setEffectiveTheme(resolveTheme(getStoredTheme()));
    sync();
    window.addEventListener("sanaa-theme-change", sync);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", sync);
    return () => {
      window.removeEventListener("sanaa-theme-change", sync);
      media.removeEventListener("change", sync);
    };
  }, []);

  function toggleTheme() {
    applyTheme(effectiveTheme === "dark" ? "light" : "dark");
  }

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
      // Dismissal is a nicety; without storage the card just shows again.
    }
    setProfileDismissed(true);
  }

  // Welcome tour: it opens once, on the first dashboard visit after
  // the account was created. The header button reopens it any time.
  useEffect(() => {
    if (isNewUser && !hasSeenWelcomeTour(user.id)) {
      setShowTour(true);
    }
  }, [isNewUser, user.id]);

  // Legacy anchor: the visitor analytics used to live on this page
  // under #visitor-analytics. They are their own page now
  // (/dashboard/analytics), so an old link landing here with that
  // anchor is sent to the new page instead of nowhere.
  useEffect(() => {
    if (window.location.hash === "#visitor-analytics") {
      router.replace("/dashboard/analytics");
    }
  }, [router]);

  const maxCount = Math.max(1, ...chart.map((day) => day.count));

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

  const today = new Date().toLocaleDateString(LOCALE_TAGS[locale] ?? "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const statCards: Array<{
    label: string;
    icon: React.ReactNode;
    value: number;
    delta: string;
    tone: "up" | "flat";
    action: React.ReactNode;
  }> = [
    {
      label: t("dashboard", "myExhibitions"),
      icon: <GalleryVerticalEnd size={15} />,
      value: stats.exhibitions.value,
      delta: stats.exhibitions.delta,
      tone: stats.exhibitions.tone,
      action: (
        <button type="button" className={styles.kpiAction} onClick={() => setShowCreateDialog(true)}>
          <Plus size={14} /> {t("redesign", "newExhibition")}
        </button>
      ),
    },
    {
      label: t("dashboard", "myArtworks"),
      icon: <Image size={15} />,
      value: stats.artworks.value,
      delta: stats.artworks.delta,
      tone: stats.artworks.tone,
      action: (
        <Link className={styles.kpiAction} href="/artworks">
          <Plus size={14} /> {t("redesign", "addArtwork")}
        </Link>
      ),
    },
    {
      label: t("dashboard", "totalVisits"),
      icon: <Eye size={15} />,
      value: stats.views.value,
      delta: stats.views.note,
      tone: "flat" as const,
      action: (
        <Link className={styles.kpiAction} href="/dashboard/analytics">
          {t("redesign", "viewInsights")} <ArrowUpRight size={14} />
        </Link>
      ),
    },
    {
      label: t("dashboard", "publicExhibitions"),
      icon: <Compass size={15} />,
      value: stats.publicExhibitions.value,
      delta: stats.publicExhibitions.delta,
      tone: stats.publicExhibitions.tone,
      action: (
        <Link className={styles.kpiAction} href={`/works/${user.id}`}>
          {t("redesign", "viewPublicPages")} <ArrowUpRight size={14} />
        </Link>
      ),
    },
  ];

  return (
    <div className={`${styles.shell}${sidebarCollapsed ? ` ${styles.shellCollapsed}` : ""}`}>
      <RedesignSidebar
        user={user}
        active="dashboard"
        exhibitionCount={exhibitionCount}
        collapsed={sidebarCollapsed}
        onCollapsedChange={handleSidebarCollapsed}
      />

      <div className={styles.main}>
        <header className={styles.topbar}>
          <button
            type="button"
            className={styles.searchBtn}
            onClick={() => setPaletteOpen(true)}
            aria-haspopup="dialog"
            aria-label={t("redesign", "searchAria")}
          >
            <Search size={16} />
            <span>{t("redesign", "searchPlaceholder")}</span>
            <kbd className={styles.searchKbd}>⌘K</kbd>
          </button>
          <span className={styles.topSpacer} aria-hidden="true" />
          <button
            type="button"
            className={styles.iconBtn}
            onClick={toggleTheme}
            aria-label={effectiveTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={effectiveTheme === "dark" ? "Light mode" : "Dark mode"}
          >
            {effectiveTheme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <span className={styles.bellSlot}>
            <NotificationBell />
          </span>
          <button type="button" className={styles.tourBtn} onClick={() => setShowTour(true)}>
            <Route size={16} /> {t("redesign", "takeTour")}
          </button>
          <button
            type="button"
            className={styles.createBtn}
            onClick={() => setShowCreateDialog(true)}
            disabled={creating}
          >
            <Plus size={16} /> <span>{creating ? t("dashboard", "creating") : t("redesign", "createExhibition")}</span>
          </button>
        </header>

        <RedesignCommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          exhibitions={exhibitions}
          onCreate={() => setShowCreateDialog(true)}
          onTour={() => setShowTour(true)}
        />

        <main className={styles.content}>
          <div className={styles.greet}>
            <div>
              <h1>
                {t("dashboard", "hello")} {firstName}!
              </h1>
              <p className={styles.greetSub}>{t("dashboard", "overview")}</p>
            </div>
            <p className={styles.today}>
              <b>{today}</b>
            </p>
          </div>

          {showCreateDialog && (
            <ExhibitionCreateDialog
              onClose={() => setShowCreateDialog(false)}
              onCreate={createExhibition}
            />
          )}

          <WelcomeTour
            userId={user.id}
            open={showTour}
            onClose={() => setShowTour(false)}
            onStartCreating={() => setShowCreateDialog(true)}
          />

          {createError && (
            <div className="editor-error-banner" role="alert">
              <span>{createError}</span>
              <button type="button" aria-label={t("common", "dismiss")} onClick={() => setCreateError(null)}>
                ×
              </button>
            </div>
          )}

          <RedesignOnboarding
            exhibitionCount={exhibitionCount}
            artworksCount={stats.artworks.value}
            publicExhibitionsCount={stats.publicExhibitions.value}
            newestExhibition={newestExhibition}
            onCreate={() => setShowCreateDialog(true)}
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

          <section className={styles.kpis} aria-label={t("dashboard", "yourStatistics")}>
            {statCards.map((card) => (
              <article className={`${styles.card} ${styles.kpi}`} key={card.label}>
                <div className={styles.kpiLabel}>
                  <span>{card.label}</span>
                  <span className={styles.kpiIcon}>{card.icon}</span>
                </div>
                <div className={`${styles.kpiValue} ${styles.tnum}`}>{card.value.toLocaleString("en-US")}</div>
                <p className={styles.kpiDelta}>
                  {card.tone === "up" ? (
                    <>
                      <ArrowUpRight size={13} /> <span className={styles.kpiDeltaUp}>{card.delta}</span>
                    </>
                  ) : (
                    card.delta
                  )}
                </p>
                {card.action}
              </article>
            ))}
          </section>

          <section className={styles.card} aria-label={t("dashboard", "yourActivity")}>
            <div className={styles.cardHead}>
              <div>
                <span className={styles.eyebrow}>{t("dashboard", "activity")}</span>
                <h2>{t("dashboard", "yourActivity")}</h2>
                <p className={styles.cardSub}>
                  {t("dashboard", "artworksPerDay")} {chartRange}
                </p>
              </div>
              <strong className={styles.chartTotal}>
                <span className={styles.tnum}>{chartTotal}</span> <span>{t("dashboard", "newIn14Days")}</span>
              </strong>
            </div>
            <div className={styles.chart}>
              {chart.map((day) => (
                <div
                  className={styles.barWrap}
                  key={day.full}
                  title={`${day.full}: ${day.count} ${day.count === 1 ? t("dashboard", "artworkAdded") : t("dashboard", "artworksAdded")}`}
                >
                  {day.count > 0 && <span className={`${styles.barValue} ${styles.tnum}`}>{day.count}</span>}
                  <div
                    className={`${styles.bar} ${day.isRecentWeek ? styles.barRecent : ""}`}
                    style={{ height: `${Math.max(day.count > 0 ? 6 : 2, (day.count / maxCount) * 100)}%` }}
                  />
                  <span className={styles.barLabel}>{day.label}</span>
                </div>
              ))}
            </div>
            <div className={styles.legend}>
              <span>
                <i className={`${styles.legendDot} ${styles.legendDotRecent}`} /> {t("dashboard", "last7Days")}
              </span>
              <span>
                <i className={styles.legendDot} /> {t("dashboard", "previous7Days")}
              </span>
            </div>
          </section>

          <section className={styles.card} aria-label={t("dashboard", "topExhibitions")}>
            <div className={styles.cardHead}>
              <div>
                <span className={styles.eyebrow}>{t("dashboard", "mostVisited")}</span>
                <h2>{t("dashboard", "topExhibitions")}</h2>
                <p className={styles.cardSub}>{t("dashboard", "yourMostVisited")}</p>
              </div>
              <Link className={styles.cardLink} href="/exhibitions">
                {t("dashboard", "seeAll")}
              </Link>
            </div>
            {topExhibitions.length === 0 ? (
              <p className={styles.empty}>{t("dashboard", "noExhibitionsYet")}</p>
            ) : (
              <ol className={styles.topList}>
                {topExhibitions.map((exhibition, index) => (
                  <li key={exhibition.id}>
                    <Link className={styles.topRow} href={`/editor/${exhibition.id}`}>
                      <span className={styles.topRank}>{index + 1}</span>
                      {exhibition.coverImageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          className={styles.topThumb}
                          src={exhibition.coverImageUrl}
                          alt=""
                          loading="lazy"
                        />
                      ) : (
                        <span className={`${styles.topThumb} ${styles.topThumbFallback}`} aria-hidden="true">
                          <GalleryVerticalEnd size={20} />
                        </span>
                      )}
                      <span className={styles.topMeta}>
                        <span className={styles.topTitle}>{exhibition.title}</span>
                        <span className={styles.topSub}>
                          {exhibition.status === "public"
                            ? ""
                            : `${t("dashboard", "draft")} · `}
                          {exhibition.artworkCount} {t("redesign", "works")}
                          {exhibition.roomCount > 0
                            ? ` · ${exhibition.roomCount} ${
                                exhibition.roomCount === 1
                                  ? t("redesign", "roomOne")
                                  : t("redesign", "roomMany")
                              }`
                            : ""}
                        </span>
                      </span>
                      <span className={styles.topViews}>
                        <b className={styles.tnum}>{exhibition.views.toLocaleString("en-US")}</b>
                        <span>{t("dashboard", "visits")}</span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <footer className={styles.footer}>
            <span>{t("common", "footerRights")}</span>
            <span>{t("common", "footerTagline")}</span>
          </footer>
        </main>
      </div>
    </div>
  );
}
