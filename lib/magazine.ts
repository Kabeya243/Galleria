// Magazine data helpers (Nov 2026): the public list and detail reads,
// the admin reads, and the views counter. Server-only: Prisma lives
// here, never import this from a client component.

import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { utcDay } from "@/lib/visits";

export type MagazineArticleWithAuthor = Prisma.MagazineArticleGetPayload<{
  include: { author: { select: { name: true; email: true } } };
}>;

/**
 * Public byline: always "Lakisa". Kabeya's personal name must never
 * appear on the public platform, so the public serializer never
 * surfaces the author's real name or email, whoever the internal
 * author is. Admin reads use serializeMagazineArticleForAdmin.
 */
export const MAGAZINE_PUBLIC_AUTHOR = "Lakisa";

export function serializeMagazineArticle(article: MagazineArticleWithAuthor) {
  return {
    id: article.id,
    slug: article.slug,
    title: article.title,
    excerpt: article.excerpt,
    coverImageUrl: article.coverImageUrl,
    content: article.content,
    status: article.status,
    views: article.views,
    readingTime: readingTimeMinutes(article.content),
    authorName: MAGAZINE_PUBLIC_AUTHOR,
    createdAt: article.createdAt.toISOString(),
    updatedAt: article.updatedAt.toISOString(),
    publishedAt: article.publishedAt ? article.publishedAt.toISOString() : null,
  };
}

/** Admin-only serializer: the real internal author (never public). */
export function serializeMagazineArticleForAdmin(article: MagazineArticleWithAuthor) {
  return {
    ...serializeMagazineArticle(article),
    authorName: article.author.name,
    authorEmail: article.author.email,
  };
}

export type SerializedMagazineArticle = ReturnType<typeof serializeMagazineArticle>;

/** URL slug from a title: lowercase, accents stripped, dashes. */
export function slugifyArticleTitle(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "article";
}

/** A unique slug for a title, appending -2, -3… when the slug is taken. */
export async function uniqueArticleSlug(base: string, excludeId?: string): Promise<string> {
  let slug = base;
  let attempt = 1;
  for (;;) {
    const existing = await db.magazineArticle.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!existing || (excludeId && existing.id === excludeId)) return slug;
    attempt += 1;
    slug = `${base}-${attempt}`;
  }
}

const authorSelect = { author: { select: { name: true, email: true } } } as const;

/** Estimated reading time in minutes (about 200 words per minute). */
export function readingTimeMinutes(content: string): number {
  const words = content.trim().split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words / 200));
}

/** Other published articles, newest first (for "More from the magazine"). */
export async function getMorePublishedArticles(
  excludeId: string,
  limit = 3,
): Promise<SerializedMagazineArticle[]> {
  const articles = await db.magazineArticle.findMany({
    where: { status: "published", id: { not: excludeId } },
    include: authorSelect,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
    take: limit,
  });
  return articles.map(serializeMagazineArticle);
}

/** Published articles, newest first (most recently published first). */
export async function getPublishedArticles(): Promise<SerializedMagazineArticle[]> {
  const articles = await db.magazineArticle.findMany({
    where: { status: "published" },
    include: authorSelect,
    orderBy: [{ publishedAt: "desc" }, { createdAt: "desc" }],
  });
  return articles.map(serializeMagazineArticle);
}

/** One published article by slug, or null. */
export async function getPublishedArticleBySlug(
  slug: string,
): Promise<MagazineArticleWithAuthor | null> {
  return db.magazineArticle.findFirst({
    where: { slug, status: "published" },
    include: authorSelect,
  });
}

/** Any article by id (admin reads, drafts included). */
export async function getMagazineArticleById(
  id: string,
): Promise<MagazineArticleWithAuthor | null> {
  return db.magazineArticle.findUnique({
    where: { id },
    include: authorSelect,
  });
}

/** All articles, newest first (admin list, drafts included). Uses the
 * admin serializer so the editor sees the real internal author. */
export async function getAllMagazineArticles(): Promise<
  ReturnType<typeof serializeMagazineArticleForAdmin>[]
> {
  const articles = await db.magazineArticle.findMany({
    include: authorSelect,
    orderBy: [{ createdAt: "desc" }],
  });
  return articles.map(serializeMagazineArticleForAdmin);
}

/**
 * Count one view for an article, once per visitor per day. The
 * MagazineView row is the dedup: the unique (articleId, visitorKey,
 * day) constraint makes a second read by the same visitor on the same
 * day a no-op. Best-effort: a logging failure never breaks the page.
 */
export async function recordMagazineView(articleId: string, visitorKey: string): Promise<void> {
  try {
    const day = utcDay(new Date());
    await db.magazineView.create({
      data: { articleId, visitorKey, day },
    });
    await db.magazineArticle.update({
      where: { id: articleId },
      data: { views: { increment: 1 } },
    });
  } catch (error) {
    // Unique violation (P2002) = already counted today: expected, not
    // an error. Anything else is a logging failure: swallow it, the
    // article must keep rendering.
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code?: unknown }).code === "P2002"
    ) {
      return;
    }
    return;
  }
}
