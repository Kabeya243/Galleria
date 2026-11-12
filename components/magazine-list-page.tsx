"use client";

// Public magazine front page (/magazine): a featured lead story, then
// the rest as a clean grid. Light editorial theme (off-white paper,
// Playfair headlines, gold accents) scoped by styles.magazineRoot;
// the shared header, nav and footer components are reused. The
// BrandLogo is forced to its light variant so the black lockup reads
// on the off-white masthead. Works logged out.
import Link from "next/link";
import { ArrowRight, Eye } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import PublicNav from "@/components/public-nav";
import SiteFooter from "@/components/site-footer";
import { LOCALE_TAGS, useLocale, useT } from "@/lib/i18n";
import type { SerializedMagazineArticle } from "@/lib/magazine";
import styles from "./magazine-page.module.css";

function formatDate(iso: string | null, tag: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString(tag, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

function Meta({
  article,
  tag,
  t,
  showAuthor = true,
}: {
  article: SerializedMagazineArticle;
  tag: string;
  t: ReturnType<typeof useT>;
  showAuthor?: boolean;
}) {
  return (
    <>
      <span>{formatDate(article.publishedAt ?? article.createdAt, tag)}</span>
      <span aria-hidden="true" className={styles.metaDot}>
        ·
      </span>
      <span>
        <Eye size={13} /> {article.views} {t("magazine", "views")}
      </span>
      {showAuthor && (
        <>
          <span aria-hidden="true" className={styles.metaDot}>
            ·
          </span>
          <span>
            {t("magazine", "by")} {article.authorName}
          </span>
        </>
      )}
      <span aria-hidden="true" className={styles.metaDot}>
        ·
      </span>
      <span>
        {article.readingTime} {t("magazine", "minRead")}
      </span>
    </>
  );
}

export default function MagazineListPage({
  articles,
}: {
  articles: SerializedMagazineArticle[];
}) {
  const t = useT();
  const { locale } = useLocale();
  const tag = LOCALE_TAGS[locale] ?? "en-GB";
  const [featured, ...rest] = articles;
  return (
    <main className={`galleries-page ${styles.magazineRoot}`}>
      <header className="galleries-header">
        <Link className="brand-lockup" href="/">
          <BrandLogo variant="horizontal" height={52} theme="light" />
        </Link>
        <PublicNav
          links={[
            { href: "/explore", label: t("nav", "explore") },
            { href: "/feed", label: t("nav", "feed") },
            { href: "/magazine", label: t("nav", "magazine") },
            { href: "/open-call", label: t("openCall", "heroTitle") },
            { href: "/login", label: t("explore", "signIn"), primary: true },
          ]}
        />
      </header>

      <section className={styles.masthead}>
        <p className={styles.eyebrow}>{t("magazine", "eyebrow")}</p>
        <h1>{t("magazine", "title")}</h1>
        <p>{t("magazine", "copy")}</p>
      </section>

      {articles.length === 0 ? (
        <div className={styles.emptyState}>
          <strong>{t("magazine", "magazine")}</strong>
          <p>{t("magazine", "empty")}</p>
        </div>
      ) : (
        <>
          {featured && (
            <section
              className={styles.featured}
              aria-label={t("magazine", "featured")}
            >
              <Link
                href={`/magazine/${featured.slug}`}
                className={styles.featuredCover}
                aria-label={`${t("magazine", "readArticle")}, ${featured.title}`}
              >
                {featured.coverImageUrl ? (
                  <img
                    src={featured.coverImageUrl}
                    alt={featured.title}
                    loading="eager"
                  />
                ) : (
                  <span className={styles.coverFallback}>LAKISA</span>
                )}
              </Link>
              <div className={styles.featuredBody}>
                <p className={styles.eyebrow}>{t("magazine", "featured")}</p>
                <h2>
                  <Link href={`/magazine/${featured.slug}`}>{featured.title}</Link>
                </h2>
                {featured.excerpt && (
                  <p className={styles.featuredExcerpt}>{featured.excerpt}</p>
                )}
                <p className={styles.featuredMeta}>
                  <Meta article={featured} tag={tag} t={t} />
                </p>
                <p style={{ margin: "18px 0 0" }}>
                  <Link
                    href={`/magazine/${featured.slug}`}
                    className={styles.readLink}
                  >
                    {t("magazine", "readArticle")} <ArrowRight size={14} />
                  </Link>
                </p>
              </div>
            </section>
          )}

          {rest.length > 0 && (
            <>
              <div className={styles.sectionHead}>
                <h2>{t("magazine", "latestStories")}</h2>
              </div>
              <section
                className={styles.articleGrid}
                aria-label={t("magazine", "latestStories")}
              >
                {rest.map((article) => (
                  <article key={article.id} className={styles.articleCard}>
                    <Link
                      href={`/magazine/${article.slug}`}
                      className={styles.coverLink}
                      aria-label={`${t("magazine", "readArticle")}, ${article.title}`}
                    >
                      {article.coverImageUrl ? (
                        <img
                          src={article.coverImageUrl}
                          alt={article.title}
                          className={styles.cover}
                          loading="lazy"
                        />
                      ) : (
                        <span className={styles.coverFallback}>LAKISA</span>
                      )}
                    </Link>
                    <div className={styles.cardBody}>
                      <h3>
                        <Link href={`/magazine/${article.slug}`}>{article.title}</Link>
                      </h3>
                      {article.excerpt && (
                        <p className={styles.cardExcerpt}>{article.excerpt}</p>
                      )}
                      <p className={styles.cardMeta}>
                        <Meta article={article} tag={tag} t={t} />
                      </p>
                    </div>
                  </article>
                ))}
              </section>
            </>
          )}
        </>
      )}
      <SiteFooter />
    </main>
  );
}
