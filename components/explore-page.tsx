"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import RedesignShell from "@/components/redesign-shell";
import BrandLogo from "@/components/brand-logo";
import PublicNav from "@/components/public-nav";
import styles from "./public-home.module.css";
import page from "./redesign-pages.module.css";
import dash from "./redesign-dashboard.module.css";
import { useT } from "@/lib/i18n";
import { coverImageRef, handleCoverImageError } from "@/lib/image-fallback";

// Explore: the public exhibitions. Signed-in users see it
// inside their workspace (redesign shell), visitors see the public
// header — either way the grid is the same list of exhibitions to walk
// through. The prototype's category chips are reduced to what the
// data supports: every room, or the rooms published in the last 7
// days. There is no medium stored per exhibition, so no
// Painting/Photography filter is invented.
export type ExploreExhibition = {
  id: string;
  title: string;
  slug: string;
  artistName: string;
  ownerId: string;
  roomCount: number;
  artworkCount: number;
  views: number;
  coverImageUrl: string | null;
  publishedAt: string | null;
};

function ExhibitionGrid({ exhibitions }: { exhibitions: ExploreExhibition[] }) {
  const t = useT();
  const [onlyNew, setOnlyNew] = useState(false);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const visible = onlyNew
    ? exhibitions.filter((item) => item.publishedAt && new Date(item.publishedAt).getTime() >= weekAgo)
    : exhibitions;
  const newCount = exhibitions.filter(
    (item) => item.publishedAt && new Date(item.publishedAt).getTime() >= weekAgo,
  ).length;

  return (
    <>
      <div className={page.chips} role="group" aria-label={t("explore", "filterLabel")}>
        <button
          type="button"
          className={`${page.chip}${!onlyNew ? ` ${page.chipOn}` : ""}`}
          aria-pressed={!onlyNew}
          onClick={() => setOnlyNew(false)}
        >
          {t("explore", "filterAll")} · {exhibitions.length}
        </button>
        <button
          type="button"
          className={`${page.chip}${onlyNew ? ` ${page.chipOn}` : ""}`}
          aria-pressed={onlyNew}
          onClick={() => setOnlyNew(true)}
        >
          {t("explore", "filterNew")} · {newCount}
        </button>
      </div>

      {visible.length === 0 ? (
        <div className={`${dash.card} ${page.emptyState}`}>
          <h3>{t("explore", "noPublic")}</h3>
          <p>{t("explore", "noPublicDesc")}</p>
          <Link href="/register" className={`${page.btn} ${page.btnCta}`}>
            {t("explore", "createAccount")} <ArrowRight size={15} />
          </Link>
        </div>
      ) : (
        <div className={page.gridCards}>
          {visible.map((exhibition) => (
            <article key={exhibition.id} className={page.expoCard}>
              <Link
                href={`/exhibition/${exhibition.slug}`}
                className={page.expoCover}
                aria-label={`${t("explore", "visit")}, ${exhibition.title}`}
              >
                {exhibition.coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={exhibition.coverImageUrl}
                    alt={exhibition.title}
                    loading="lazy"
                    onError={handleCoverImageError} ref={coverImageRef}
                  />
                ) : (
                  <span className={page.expoCoverFallback}>LAKISA</span>
                )}
                <span className={`${page.pill} ${page.pillLive} ${page.pillOnCover}`}>
                  <span className={page.pillDot} aria-hidden="true" />
                  {t("explore", "liveNow")}
                </span>
              </Link>
              <div className={page.expoBody}>
                <h3 className={page.expoTitle}>
                  <Link href={`/exhibition/${exhibition.slug}`} style={{ color: "inherit", textDecoration: "none" }}>
                    {exhibition.title}
                  </Link>
                </h3>
                <p className={page.expoMeta}>{exhibition.artistName}</p>
                <div className={page.expoFoot}>
                  <span>
                    {exhibition.roomCount} {exhibition.roomCount === 1 ? t("exhibitions", "room") : t("exhibitions", "rooms")} ·{" "}
                    {exhibition.artworkCount} {exhibition.artworkCount === 1 ? t("exhibitions", "artwork") : t("exhibitions", "artworks")}
                  </span>
                  <span>
                    <b className={dash.tnum}>{exhibition.views}</b>{" "}
                    {exhibition.views === 1 ? t("exhibitions", "visitSingular") : t("exhibitions", "visits")}
                  </span>
                </div>
                <div className={page.expoActions}>
                  <Link href={`/exhibition/${exhibition.slug}`} className={page.btn}>
                    {t("explore", "visitExhibition")} <ArrowUpRight size={14} />
                  </Link>
                  {/* No "Send a message" button on the card: messaging the
                      exhibitor lives in the rooms menu inside the
                      exhibition visit itself (see public-exhibition). */}
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </>
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
            <BrandLogo variant="horizontal" height={52} />
          </Link>
          <PublicNav
            links={[
              { href: "/galleries", label: t("explore", "galleries") },
              { href: "/register", label: t("explore", "createAccount") },
              { href: "/login", label: t("explore", "signIn"), primary: true },
            ]}
          />
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
    <RedesignShell user={user} active="explore" exhibitionCount={ownExhibitionCount}>
      <div className={page.pageHead}>
        <div>
          <h1>{t("explore", "title")}</h1>
          <p className={page.pageSub}>{t("explore", "copySignedIn")}</p>
        </div>
      </div>
      <ExhibitionGrid exhibitions={exhibitions} />
    </RedesignShell>
  );
}
