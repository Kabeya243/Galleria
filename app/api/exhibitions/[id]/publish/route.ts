import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

// Publishing chooses who can open the show (feature 8):
// - "public": listed on SANAA, open to everyone.
// - "private-link": published but never listed — only the direct URL opens it.
// - "password": published, but a password is asked before entering.
// Without a visibility the route keeps its old toggle: a published show
// goes back to draft, a draft is published with its current visibility
// (or "public" when it has none yet).
const publishSchema = z.object({
  visibility: z.enum(["public", "private-link", "password"]).optional(),
  password: z.string().min(8, "The password needs at least 8 characters.").optional(),
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
  const { visibility, password } = parsed.data;

  // A password-protected show needs a password at publish time.
  if (visibility === "password" && !password) {
    return NextResponse.json(
      { error: "A password is required for a password-protected exhibition." },
      { status: 400 },
    );
  }

  // No visibility: toggle (the old behaviour).
  if (!visibility) {
    const isPublic = exhibition.status === "public";
    const updated = await db.exhibition.update({
      where: { id },
      data: {
        status: isPublic ? "draft" : "public",
        publishedAt: isPublic ? null : new Date(),
      },
    });
    return NextResponse.json({ status: updated.status, slug: updated.slug });
  }

  const updated = await db.exhibition.update({
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
  return NextResponse.json({ status: updated.status, slug: updated.slug, visibility: updated.visibility });
}
