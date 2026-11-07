"use client";

import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Sidebar from "@/components/sidebar";
import ThemeToggle from "@/components/theme-toggle";
import styles from "./public-home.module.css";
import { useT } from "@/lib/i18n";

// Explore: the public exhibitions of OTHER people. Signed-in users see it
// inside their workspace (sidebar), visitors see the public header —
// either way the grid is the same list of exhibitions to walk through.
export type ExploreExhibition = {
  id: string;
  title: string;
  slug: string;
  artistName: string;
  roomCount: number;
  artworkCount: number;
  views: number;
  coverImageUrl: string | null;
};

function ExhibitionGrid({ exhibitions }: { exhibitions: ExploreExhibition[] }) {
  const t = useT();
  return (
    <section className="galleries-grid" id="exhibitions">
      {exhibitions.length === 0 ? (
        <div className={styles.emptyState}>
          <strong>{t("explore", "noPublic")}</strong>
          <p>{t("explore", "noPublicDesc")}</p>
          <Link href="/register" className="galleries-open-button">
            {t("explore", "createAccount")} <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        exhibitions.map((exhibition) => (
          <article key={exhibition.id} className={`gallery-card ${styles.card}`}>
            <Link
              href={`/exhibition/${exhibition.slug}`}
              className={styles.coverLink}
              aria-label={`${t("explore", "visit")} — ${exhibition.title}`}
            >
              {exhibition.coverImageUrl ? (
                <img
                  src={exhibition.coverImageUrl}
                  alt={exhibition.title}
                  className={styles.cover}
                  loading="lazy"
                />
              ) : (
                <span className={styles.coverFallback}>SANAA</span>
              )}
            </Link>
            <div className="gallery-card-body">
              <h3>
                <Link href={`/exhibition/${exhibition.slug}`}>{exhibition.title}</Link>
              </h3>
              <p>{exhibition.artistName}</p>
              <p className="gallery-card-finishes">
                {exhibition.roomCount} {exhibition.roomCount === 1 ? t("exhibitions", "room") : t("exhibitions", "rooms")} ·{" "}
                {exhibition.artworkCount} {exhibition.artworkCount === 1 ? t("exhibitions", "artwork") : t("exhibitions", "artworks")} ·{" "}
                {exhibition.views} {exhibition.views === 1 ? t("exhibitions", "visitSingular") : t("exhibitions", "visits")}
              </p>
              <div className="gallery-card-actions">
                <Link href={`/exhibition/${exhibition.slug}`} className="galleries-open-button">
                  {t("explore", "visitExhibition")} <ArrowUpRight size={14} />
                </Link>
              </div>
            </div>
          </article>
        ))
      )}
    </section>
  );
}

export default function ExplorePage({
  user,
  exhibitions,
  ownExhibitionCount,
}: {
  user: { id: string; name: string; email: string; isAdmin?: boolean } | null;
  exhibitions: ExploreExhibition[];
  ownExhibitionCount: number;
}) {
  const t = useT();
  if (!user) {
    return (
      <main className="galleries-page">
        <header className="galleries-header">
          <Link className="brand-lockup" href="/">
            <span className="brand-mark">s.</span>
            <span className="brand-name">SANAA</span>
          </Link>
          <nav className="galleries-nav">
            <Link href="/galleries">{t("explore", "galleries")}</Link>
            <Link href="/register">{t("explore", "createAccount")}</Link>
            <Link href="/login" className="galleries-signin">{t("explore", "signIn")}</Link>
          </nav>
        </header>

        <section className="galleries-intro">
          <p className="eyebrow">{t("explore", "exploreOtherPublic")}</p>
          <h1>
            {t("explore", "title")}<span className="title-period">.</span>
          </h1>
          <p>{t("explore", "copyPublic")}</p>
        </section>

        <ExhibitionGrid exhibitions={exhibitions} />

        <footer className={styles.homeFooter}>
          <span>{t("common", "footerRights")}</span>
          <span>{t("common", "footerTagline")}</span>
        </footer>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Sidebar user={user} active="explore" exhibitionCount={ownExhibitionCount} />

      <section className="dashboard-main">
        <header className="topbar">
          <div className="breadcrumbs"><span>{t("common", "workspace")}</span><span className="crumb-slash">/</span><strong>{t("explore", "explore")}</strong></div>
          <div className="topbar-actions">
            <ThemeToggle />
            {/* Phase 8: the Search / Notifications / Help buttons were
                dead — no handler, no backend — so they were removed.
                The working exhibition search is on the dashboard. */}
          </div>
        </header>

        <div className="dashboard-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow"><span className="status-dot" /> {t("explore", "exploreOther")}</p>
              <h1>{t("explore", "title")}<span className="title-period">.</span></h1>
              <p className="welcome-copy">{t("explore", "copySignedIn")}</p>
            </div>
          </section>

          <ExhibitionGrid exhibitions={exhibitions} />
        </div>
      </section>
    </main>
  );
}
