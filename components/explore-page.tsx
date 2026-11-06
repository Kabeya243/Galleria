import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import Sidebar from "@/components/sidebar";
import ThemeToggle from "@/components/theme-toggle";
import styles from "./public-home.module.css";

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
  return (
    <section className="galleries-grid" id="exhibitions">
      {exhibitions.length === 0 ? (
        <div className={styles.emptyState}>
          <strong>No public exhibitions from other artists yet.</strong>
          <p>When other artists publish a room, it will appear here.</p>
          <Link href="/register" className="galleries-open-button">
            Create an account <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        exhibitions.map((exhibition) => (
          <article key={exhibition.id} className={`gallery-card ${styles.card}`}>
            <Link
              href={`/exhibition/${exhibition.slug}`}
              className={styles.coverLink}
              aria-label={`Visit ${exhibition.title}`}
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
                {exhibition.roomCount} {exhibition.roomCount === 1 ? "room" : "rooms"} ·{" "}
                {exhibition.artworkCount} {exhibition.artworkCount === 1 ? "artwork" : "artworks"} ·{" "}
                {exhibition.views} {exhibition.views === 1 ? "visit" : "visits"}
              </p>
              <div className="gallery-card-actions">
                <Link href={`/exhibition/${exhibition.slug}`} className="galleries-open-button">
                  Visit exhibition <ArrowUpRight size={14} />
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
  if (!user) {
    return (
      <main className="galleries-page">
        <header className="galleries-header">
          <Link className="brand-lockup" href="/">
            <span className="brand-mark">s.</span>
            <span className="brand-name">SANAA</span>
          </Link>
          <nav className="galleries-nav">
            <Link href="/galleries">Galleries</Link>
            <Link href="/register">Create an account</Link>
            <Link href="/login" className="galleries-signin">Sign in</Link>
          </nav>
        </header>

        <section className="galleries-intro">
          <p className="eyebrow">EXPLORE · EXHIBITIONS BY OTHER ARTISTS</p>
          <h1>
            Other rooms, other artists<span className="title-period">.</span>
          </h1>
          <p>
            Every public exhibition on SANAA, made by someone else — wander in and walk through
            their rooms at your own pace. No account needed to visit.
          </p>
        </section>

        <ExhibitionGrid exhibitions={exhibitions} />

        <footer className={styles.homeFooter}>
          <span>© 2026 SANAA Studio</span>
          <span>Made for art, made for everyone.</span>
        </footer>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Sidebar user={user} active="explore" exhibitionCount={ownExhibitionCount} />

      <section className="dashboard-main">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>Explore</strong></div>
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
              <p className="eyebrow"><span className="status-dot" /> EXPLORE · OTHER ARTISTS</p>
              <h1>Other rooms, other artists<span className="title-period">.</span></h1>
              <p className="welcome-copy">Public exhibitions by other artists, curators and galleries — walk through them for inspiration.</p>
            </div>
          </section>

          <ExhibitionGrid exhibitions={exhibitions} />
        </div>
      </section>
    </main>
  );
}
