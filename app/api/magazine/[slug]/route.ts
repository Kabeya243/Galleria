import { NextResponse } from "next/server";
import { getPublishedArticleBySlug, recordMagazineView, serializeMagazineArticle } from "@/lib/magazine";
import { getOrCreateVisitorKey } from "@/lib/visits";

// Public article read: one published article by slug. Reading it counts
// one view for this visitor for today (anonymous visitorKey cookie;
// a refresh does not inflate the count).
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const article = await getPublishedArticleBySlug(slug);
  if (!article) {
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  }
  const visitorKey = await getOrCreateVisitorKey();
  await recordMagazineView(article.id, visitorKey);
  // Re-read the count so the response carries the fresh number.
  const fresh = await getPublishedArticleBySlug(slug);
  return NextResponse.json({ article: serializeMagazineArticle(fresh ?? article) });
}
