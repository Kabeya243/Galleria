import Link from "next/link";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import styles from "./public-home.module.css";

// The public homepage, Artsteps-style: every published exhibition on the
// platform, open to visitors without an account. Logged-in users never see
// this — app/page.tsx sends them to their workspace (Dashboard) instead.
export type PublicHomeExhibition = {
  id: string;
  title: string;
  slug: string;
  artistName: string;
  roomCount: number;
  artworkCount: number;
  views: number;
  coverImageUrl: string | null;
};

export default function PublicHome({ exhibitions }: { exhibitions: PublicHomeExhibition[] }) {
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
        <p className="eyebrow">VIRTUAL EXHIBITIONS · OPEN TO EVERYONE</p>
        <h1>
          Walk through art, from anywhere<span className="title-period">.</span>
        </h1>
        <p>
          Step inside exhibitions built by artists from all over the world — wander the rooms,
          stand in front of the work, and explore at your own pace. No account needed to visit.
        </p>
        <div className={styles.heroActions}>
          <Link href="/register" className="galleries-open-button">
            Create your own exhibition <ArrowRight size={15} />
          </Link>
          <a href="#exhibitions" className={styles.heroSecondary}>
            Browse the exhibitions ↓
          </a>
        </div>
      </section>

      <section className="galleries-grid" id="exhibitions">
        {exhibitions.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>No public exhibitions yet.</strong>
            <p>Be the first to open a room and invite the world in.</p>
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

      <footer className={styles.homeFooter}>
        <span>© 2026 SANAA Studio</span>
        <span>Made for art, made for everyone.</span>
      </footer>
    </main>
  );
}
