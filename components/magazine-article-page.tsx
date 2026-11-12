"use client";

// Public magazine article (/magazine/[slug]): cover, title, excerpt,
// Markdown body (rendered server-side to safe HTML), date and views.
// Works logged out. The view is counted server-side on page render.
import Link from "next/link";
import { ArrowLeft, Eye } from "lucide-react";
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
}: {
  article: SerializedMagazineArticle;
  bodyHtml: string;
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

      <article className={styles.articleWrap}>
        <Link href="/magazine" className={styles.backLink}>
          <ArrowLeft size={14} /> {t("magazine", "backToMagazine")}
        </Link>
        {article.coverImageUrl && (
          <img src={article.coverImageUrl} alt={article.title} className={styles.articleCover} />
        )}
        <h1 className={styles.articleTitle}>{article.title}</h1>
        {article.excerpt && <p className={styles.articleExcerpt}>{article.excerpt}</p>}
        <p className={styles.articleMeta}>
          <span>
            {t("magazine", "by")} {article.authorName}
          </span>
          <span>{formatDate(article.publishedAt ?? article.createdAt, tag)}</span>
          <span>
            <Eye size={13} /> {article.views} {t("magazine", "views")}
          </span>
        </p>
        <div
          className={styles.articleBody}
          dangerouslySetInnerHTML={{ __html: bodyHtml }}
        />
      </article>
      <SiteFooter />
    </main>
  );
}
