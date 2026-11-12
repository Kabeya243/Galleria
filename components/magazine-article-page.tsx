"use client";

// Public magazine article (/magazine/[slug]): centered editorial
// header, hero cover, readable body, reading progress, and more from
// the magazine. Light editorial theme (off-white paper, Playfair
// headlines, gold accents) scoped by styles.magazineRoot; the shared
// header, nav and footer are reused, with the BrandLogo forced to its
// light variant. Works logged out. The view is counted server-side
// on page render.
import { useRef } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye } from "lucide-react";
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

export default function MagazineArticlePage({
  article,
  bodyHtml,
  more,
}: {
  article: SerializedMagazineArticle;
  bodyHtml: string;
  more: SerializedMagazineArticle[];
}) {
  const t = useT();
  const { locale } = useLocale();
  const tag = LOCALE_TAGS[locale] ?? "en-GB";
  const progressRef = useRef<HTMLDivElement>(null);

  // The page scrolls inside .galleries-page (html/body never scroll),
  // so progress is measured on that container, not on window.
  function onScroll(event: React.UIEvent<HTMLElement>) {
    const el = event.currentTarget;
    const max = el.scrollHeight - el.clientHeight;
    const pct = max > 0 ? Math.min(100, Math.max(0, (el.scrollTop / max) * 100)) : 0;
    if (progressRef.current) progressRef.current.style.width = `${pct}%`;
  }

  return (
    <main className={`galleries-page ${styles.magazineRoot}`} onScroll={onScroll}>
      <div
        ref={progressRef}
        className={styles.progressBar}
        style={{ width: "0%" }}
        aria-hidden="true"
      />
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

      <article className={styles.articleWrap}>
        <Link href="/magazine" className={styles.backLink}>
          <ArrowLeft size={14} /> {t("magazine", "backToMagazine")}
        </Link>

        <header className={styles.articleHeader}>
          <p className={styles.articleEyebrow}>{t("magazine", "eyebrow")}</p>
          <h1 className={styles.articleTitle}>{article.title}</h1>
          {article.excerpt && (
            <p className={styles.articleExcerpt}>{article.excerpt}</p>
          )}
          <p className={styles.articleMeta}>
            <span>
              {t("magazine", "by")} <strong>{article.authorName}</strong>
            </span>
            <span aria-hidden="true" className={styles.metaDot}>
              ·
            </span>
            <span>{formatDate(article.publishedAt ?? article.createdAt, tag)}</span>
            <span aria-hidden="true" className={styles.metaDot}>
              ·
            </span>
            <span>
              <Eye size={13} /> {article.views} {t("magazine", "views")}
            </span>
            <span aria-hidden="true" className={styles.metaDot}>
              ·
            </span>
            <span>
              {article.readingTime} {t("magazine", "minRead")}
            </span>
          </p>
        </header>

        {article.coverImageUrl && (
          <div className={styles.articleHero}>
            <img
              src={article.coverImageUrl}
              alt={article.title}
              className={styles.articleCover}
            />
          </div>
        )}

        <div
          className={styles.articleBody}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />

        {more.length > 0 && (
          <section
            className={styles.moreSection}
            aria-label={t("magazine", "moreFromMagazine")}
          >
            <h2>{t("magazine", "moreFromMagazine")}</h2>
            <div className={styles.moreGrid}>
              {more.map((item) => (
                <article key={item.id} className={styles.articleCard}>
                  <Link
                    href={`/magazine/${item.slug}`}
                    className={styles.coverLink}
                    aria-label={`${t("magazine", "readArticle")}, ${item.title}`}
                  >
                    {item.coverImageUrl ? (
                      <img
                        src={item.coverImageUrl}
                        alt={item.title}
                        className={styles.cover}
                        loading="lazy"
                      />
                    ) : (
                      <span className={styles.coverFallback}>LAKISA</span>
                    )}
                  </Link>
                  <div className={styles.cardBody}>
                    <h3>
                      <Link href={`/magazine/${item.slug}`}>{item.title}</Link>
                    </h3>
                    <p className={styles.cardMeta}>
                      <span>
                        {formatDate(item.publishedAt ?? item.createdAt, tag)}
                      </span>
                      <span aria-hidden="true" className={styles.metaDot}>
                        ·
                      </span>
                      <span>
                        <Eye size={13} /> {item.views} {t("magazine", "views")}
                      </span>
                      <span aria-hidden="true" className={styles.metaDot}>
                        ·
                      </span>
                      <Link
                        href={`/magazine/${item.slug}`}
                        className={styles.readLink}
                      >
                        {t("magazine", "readArticle")} <ArrowRight size={13} />
                      </Link>
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </section>
        )}
      </article>
      <SiteFooter />
    </main>
  );
}
