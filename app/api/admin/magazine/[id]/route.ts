import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin";
import { db, withDbRetry } from "@/lib/db";
import {
  getMagazineArticleById,
  serializeMagazineArticleForAdmin,
  slugifyArticleTitle,
  uniqueArticleSlug,
} from "@/lib/magazine";

// One admin magazine article: read, update or delete. All need the
// magazine.manage permission.
const updateSchema = z.object({
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

async function load(id: string) {
  return getMagazineArticleById(id);
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAdminPermission("magazine.manage");
  if (!access) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const { id } = await params;
  const article = await load(id);
  if (!article) {
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  }
  return NextResponse.json({ article: serializeMagazineArticleForAdmin(article) });
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAdminPermission("magazine.manage");
  if (!access) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const { id } = await params;
  const existing = await load(id);
  if (!existing) {
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the article fields and try again." }, { status: 400 });
  }
  const base = parsed.data.slug || slugifyArticleTitle(parsed.data.title);
  const slug = base === existing.slug ? existing.slug : await uniqueArticleSlug(base, id);
  const now = new Date();
  const updated = await withDbRetry(() =>
    db.magazineArticle.update({
      where: { id },
      data: {
        slug,
        title: parsed.data.title,
        excerpt: parsed.data.excerpt || null,
        coverImageUrl: parsed.data.coverImageUrl,
        content: parsed.data.content,
        status: parsed.data.status,
        // (Re)publishing stamps the publish date; unpublishing keeps
        // the last one, so the date survives a draft round-trip.
        publishedAt:
          parsed.data.status === "published" ? existing.publishedAt ?? now : existing.publishedAt,
      },
      include: { author: { select: { name: true, email: true } } },
    }),
  );
  return NextResponse.json({ article: serializeMagazineArticleForAdmin(updated) });
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const access = await requireAdminPermission("magazine.manage");
  if (!access) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const { id } = await params;
  const existing = await load(id);
  if (!existing) {
    return NextResponse.json({ error: "Article not found." }, { status: 404 });
  }
  await withDbRetry(() => db.magazineArticle.delete({ where: { id } }));
  return NextResponse.json({ ok: true });
}
