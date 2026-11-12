"use client";

// Public magazine list (/magazine): published articles, newest first.
// Server-rendered data in, translated chrome via useT. Works logged out.
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

export default function MagazineListPage({
  articles,
}: {
  articles: SerializedMagazineArticle[];
}) {
  const t = useT();
  const { locale } = useLocale();
  const tag = LOCALE_TAGS[locale] ?? "en-GB";
  return (
    <main className="galleries-page">
      <header className="galleries-header">
        <Link className="brand-lockup" href="/">
          <BrandLogo variant="horizontal" height={52} />
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

      <section className="galleries-intro">
        <p className="eyebrow">{t("magazine", "eyebrow")}</p>
        <h1>{t("magazine", "title")}</h1>
        <p>{t("magazine", "copy")}</p>
      </section>

      {articles.length === 0 ? (
        <div className={styles.emptyState}>
          <strong>{t("magazine", "magazine")}</strong>
          <p>{t("magazine", "empty")}</p>
        </div>
      ) : (
        <section className={styles.articleGrid} aria-label={t("magazine", "magazine")}>
          {articles.map((article) => (
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
                {article.excerpt && <p className={styles.cardExcerpt}>{article.excerpt}</p>}
                <p className={styles.cardMeta}>
                  <span>
                    {formatDate(article.publishedAt ?? article.createdAt, tag)}
                  </span>
                  <span>
                    <Eye size={13} /> {article.views} {t("magazine", "views")}
                  </span>
                  <span aria-hidden="true">·</span>
                  <Link href={`/magazine/${article.slug}`}>
                    {t("magazine", "readArticle")} <ArrowRight size={13} />
                  </Link>
                </p>
              </div>
            </article>
          ))}
        </section>
      )}
      <SiteFooter />
    </main>
  );
}
