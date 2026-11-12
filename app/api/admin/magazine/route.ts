import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { db, withDbRetry } from "@/lib/db";
import {
  getAllMagazineArticles,
  serializeMagazineArticle,
  slugifyArticleTitle,
  uniqueArticleSlug,
} from "@/lib/magazine";

// Admin magazine articles: list every article (drafts included) or
// create one. Both need the magazine.manage permission — the manager
// holds it, a sub-admin only when granted. The editor is admin-only;
// the public never reaches these routes.
const articleSchema = z.object({
  title: z.string().trim().min(1).max(200),
  slug: z
    .string()
    .trim()
    .max(80)
    .regex(/^[a-z0-9-]*$/, "Use lowercase letters, numbers and dashes only.")
    .optional(),
  excerpt: z.string().trim().max(500).optional().nullable(),
  coverImageUrl: z.string().trim().min(1).max(2048),
  content: z.string().min(1).max(200000),
  status: z.enum(["draft", "published"]),
});

export async function GET() {
  const access = await requireAdminPermission("magazine.manage");
  if (!access) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const articles = await getAllMagazineArticles();
  return NextResponse.json({ articles });
}

export async function POST(request: Request) {
  const access = await requireAdminPermission("magazine.manage");
  if (!access) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = articleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the article fields and try again." }, { status: 400 });
  }
  const base = parsed.data.slug || slugifyArticleTitle(parsed.data.title);
  const slug = await uniqueArticleSlug(base);
  const now = new Date();
  const created = await withDbRetry(() =>
    db.magazineArticle.create({
      data: {
        slug,
        title: parsed.data.title,
        excerpt: parsed.data.excerpt || null,
        coverImageUrl: parsed.data.coverImageUrl,
        content: parsed.data.content,
        status: parsed.data.status,
        authorId: user.id,
        publishedAt: parsed.data.status === "published" ? now : null,
      },
      include: { author: { select: { name: true, email: true } } },
    }),
  );
  return NextResponse.json({ article: serializeMagazineArticle(created) }, { status: 201 });
}
