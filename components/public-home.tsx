import Link from "next/link";
import { ArrowRight, ArrowUpRight, Clock, Images } from "lucide-react";
import HeroGalleryPreview, { type HeroPreviewArtwork } from "@/components/hero-gallery-preview";
import styles from "./public-home.module.css";

// The public homepage — pure black & white editorial design. Logged-in
// users never see this; app/page.tsx sends them to their workspace
// (Dashboard) instead. All data is real: public exhibitions from the
// database, real artwork images, real artist names. The visit time is an
// estimate (one minute per artwork, five minutes minimum).
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

export type FeaturedPreview = {
  id: string;
  title: string;
  slug: string;
  artistName: string;
  artworkCount: number;
  artworks: HeroPreviewArtwork[];
};

function visitMinutes(artworkCount: number): number {
  return Math.max(5, artworkCount);
}

function FloorMinimap() {
  return (
    <svg viewBox="0 0 120 84" width="86" height="60" aria-hidden="true">
      <rect x="6" y="6" width="108" height="72" fill="none" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1.5" />
      <line x1="62" y1="6" x2="62" y2="48" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.2" />
      <line x1="6" y1="48" x2="62" y2="48" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.2" />
      <path d="M88 62 L78 48 L98 48 Z" fill="#ffffff" fillOpacity="0.22" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1" />
      <circle cx="88" cy="62" r="3.5" fill="#ffffff" />
    </svg>
  );
}

export default function PublicHome({
  exhibitions,
  featured,
}: {
  exhibitions: PublicHomeExhibition[];
  featured: FeaturedPreview | null;
}) {
  const shown = exhibitions.slice(0, 3);
  const visitHref = featured ? `/exhibition/${featured.slug}` : "/galleries";

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          <span className={styles.brandMark} aria-hidden="true" />
          <span className={styles.brandName}>SANAA</span>
        </Link>
        <nav className={styles.nav} aria-label="Main">
          <Link href="/explore">Explore</Link>
          <Link href="/galleries">Exhibitions</Link>
          <Link href="/create">Create</Link>
          <Link href="#about">About</Link>
          <Link href="/login" className={styles.signin}>
            Sign in
          </Link>
        </nav>
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Virtual exhibitions · Open to everyone</p>
          <h1 className={styles.title}>Walk through art, from anywhere.</h1>
          <p className={styles.subtitle}>
            Step inside exhibitions built by artists from all over the world. Wander the rooms,
            stand in front of the work, explore at your own pace — no account needed to visit.
          </p>
          <div className={styles.heroActions}>
            <Link href={visitHref} className={styles.primaryBtn}>
              Visit an exhibition <ArrowRight size={16} />
            </Link>
            <Link href="/register" className={styles.outlineBtn}>
              Create my own
            </Link>
          </div>
        </div>

        <div className={styles.previewWrap}>
          {featured && featured.artworks.length > 0 ? (
            <Link
              href={`/exhibition/${featured.slug}`}
              className={styles.preview}
              aria-label={`Visit ${featured.title}`}
            >
              <HeroGalleryPreview artworks={featured.artworks} />
              <span className={styles.liveLabel}>
                <span className={styles.liveDot} aria-hidden="true" /> Live preview
              </span>
              <span className={styles.minimap}>
                <FloorMinimap />
                <em>Floor 1 · Map</em>
              </span>
              <span className={styles.caption}>
                <strong>{featured.title}</strong>
                <span>
                  {featured.artistName} · {featured.artworkCount}{" "}
                  {featured.artworkCount === 1 ? "artwork" : "artworks"}
                </span>
              </span>
            </Link>
          ) : (
            <Link href="/galleries" className={styles.previewFallback}>
              <strong>Walk through art, from anywhere.</strong>
              <span>Browse the public exhibitions and step inside a room.</span>
              <span className={styles.previewFallbackCta}>
                Browse exhibitions <ArrowRight size={15} />
              </span>
            </Link>
          )}
        </div>
      </section>

      <section className={styles.section} id="exhibitions">
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>Trending exhibitions</h2>
          {exhibitions.length > 3 && (
            <Link href="/galleries" className={styles.sectionLink}>
              Browse all exhibitions <ArrowUpRight size={14} />
            </Link>
          )}
        </div>
        {shown.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>No public exhibitions yet.</strong>
            <p>Be the first to open a room and invite the world in.</p>
            <Link href="/register" className={styles.primaryBtn}>
              Create an account <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {shown.map((exhibition) => (
              <Link
                key={exhibition.id}
                href={`/exhibition/${exhibition.slug}`}
                className={styles.card}
                aria-label={`Visit ${exhibition.title}`}
              >
                {exhibition.coverImageUrl ? (
                  <img
                    src={exhibition.coverImageUrl}
                    alt=""
                    className={styles.cover}
                    loading="lazy"
                  />
                ) : (
                  <span className={styles.coverFallback}>SANAA</span>
                )}
                <span className={styles.cardBody}>
                  <span className={styles.cardTitle}>{exhibition.title}</span>
                  <span className={styles.cardArtist}>{exhibition.artistName}</span>
                  <span className={styles.cardMeta}>
                    <span>
                      <Images size={13} /> {exhibition.artworkCount}{" "}
                      {exhibition.artworkCount === 1 ? "artwork" : "artworks"}
                    </span>
                    <span>
                      <Clock size={13} /> {visitMinutes(exhibition.artworkCount)} min
                    </span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className={styles.about} id="about">
        <h2>About SANAA</h2>
        <p>
          SANAA is a virtual exhibition platform where artists build rooms, hang their work,
          and invite the world to walk through — from anywhere. No downloads, no account
          needed to visit.
        </p>
      </section>

      <footer className={styles.footer}>
        <span>© 2026 SANAA Studio</span>
        <span>Made for art, made for everyone.</span>
      </footer>
    </main>
  );
}
