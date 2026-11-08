import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { absoluteCoverUrl, resolveFeedBaseUrl, syncPublicationFeed } from "@/lib/feed-sync";

type RouteContext = { params: Promise<{ id: string }> };

// Publishing chooses who can open the show (feature 8):
// - "public": listed on SANAA, open to everyone.
// - "private-link": published but never listed — only the direct URL opens it.
// - "password": published, but a password is asked before entering.
// Without a visibility the route keeps its old toggle: a published show
// goes back to draft, a draft is published with its current visibility
// (or "public" when it has none yet).
// publishToFeed (default true) is the author's choice from the publish
// dialog: unchecked, a public show stays out of the publication feed.
const publishSchema = z.object({
  visibility: z.enum(["public", "private-link", "password"]).optional(),
  password: z.string().min(8, "The password needs at least 8 characters.").optional(),
  publishToFeed: z.boolean().optional(),
});

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to publish this exhibition." }, { status: 401 });
  const { id } = await params;
  const exhibition = await db.exhibition.findFirst({
    where: { id, ownerId: user.id },
    select: { id: true, status: true, slug: true, visibility: true },
  });
  if (!exhibition) return NextResponse.json({ error: "Exhibition not found." }, { status: 404 });

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Empty body — the toggle below still applies.
  }
  const parsed = publishSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "Could not publish this exhibition." },
      { status: 400 },
    );
  }
  const { visibility, password, publishToFeed = true } = parsed.data;

  // A password-protected show needs a password at publish time.
  if (visibility === "password" && !password) {
    return NextResponse.json(
      { error: "A password is required for a password-protected exhibition." },
      { status: 400 },
    );
  }

  let updated: { status: string; slug: string; visibility: string };
  // No visibility: toggle (the old behaviour).
  if (!visibility) {
    const isPublic = exhibition.status === "public";
    updated = await db.exhibition.update({
      where: { id },
      data: {
        status: isPublic ? "draft" : "public",
        publishedAt: isPublic ? null : new Date(),
      },
    });
  } else {
    updated = await db.exhibition.update({
      where: { id },
      data: {
        status: "public",
        visibility,
        // A password is stored as a bcrypt hash, never in clear text. Any
        // other visibility clears the previous hash.
        accessPasswordHash: visibility === "password" ? await hash(password as string, 12) : null,
        publishedAt: new Date(),
      },
    });
  }

  // Publication feed sync (chantier 3/5): tell the FastAPI feed API about
  // the new state — publish the post (public + public, with a cover), or
  // remove it (draft, private-link, password, or opted out). Fail-soft:
  // syncPublicationFeed never throws, so a feed failure can never fail
  // the publication itself.
  const origin = new URL(request.url).origin;
  let coverImageUrl: string | null = null;
  if (updated.status === "public" && updated.visibility === "public" && publishToFeed) {
    // The feed cover is the first artwork that has an image, oldest first.
    const cover = await db.artwork.findFirst({
      where: { exhibitionId: id, imageUrl: { not: null } },
      orderBy: { createdAt: "asc" },
      select: { imageUrl: true },
    });
    coverImageUrl = absoluteCoverUrl(cover?.imageUrl ?? null, origin);
  }
  await syncPublicationFeed(
    {
      exhibitionId: id,
      authorId: user.id,
      status: updated.status,
      visibility: updated.visibility,
      publishToFeed,
      coverImageUrl,
      baseUrl: resolveFeedBaseUrl(request.url),
      internalKey: process.env.SOCIAL_INTERNAL_API_KEY,
    },
  );

  return NextResponse.json(
    visibility
      ? { status: updated.status, slug: updated.slug, visibility: updated.visibility }
      : { status: updated.status, slug: updated.slug },
  );
}
