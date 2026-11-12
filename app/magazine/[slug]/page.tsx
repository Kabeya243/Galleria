import type { Metadata } from "next";
import { notFound } from "next/navigation";
import MagazineArticlePage from "@/components/magazine-article-page";
import MagazineIdentify from "@/components/magazine-identify";
import { renderMarkdown } from "@/lib/magazine-markdown";
import {
  getMorePublishedArticles,
  getPublishedArticleBySlug,
  recordMagazineView,
  serializeMagazineArticle,
} from "@/lib/magazine";
import { readVisitContext } from "@/lib/visits";

// Public magazine article: /magazine/[slug]. No sign-in. Reading it
// counts one view for this visitor for today (anonymous visitorKey
// cookie, one row per visitor per article per day), so a refresh does
// not inflate the count. Rendered on demand so the views count and
// the content are always fresh.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) return { title: "Magazine · Lakisa" };
  return {
    title: `${article.title} · Lakisa`,
    description: article.excerpt ?? article.title,
    openGraph: {
      title: article.title,
      description: article.excerpt ?? undefined,
      images: article.coverImageUrl ? [{ url: article.coverImageUrl }] : undefined,
    },
  };
}

export default async function MagazineArticleRoute({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) notFound();
  // Count the view (best-effort, never breaks the page), then render
  // with the fresh count.
  const ctx = await readVisitContext();
  await recordMagazineView(article.id, ctx.visitorKey);
  const fresh = await getPublishedArticleBySlug(slug);
  const bodyHtml = renderMarkdown(article.content);
  const more = await getMorePublishedArticles(article.id, 3);
  return (
    <>
      <MagazineIdentify />
      <MagazineArticlePage
        article={serializeMagazineArticle(fresh ?? article)}
        bodyHtml={bodyHtml}
        more={more}
      />
    </>
  );
}
