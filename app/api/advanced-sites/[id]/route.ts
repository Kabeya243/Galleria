// Advanced website builder API — one site of the signed-in user.
// GET: the full document (draft or published). DELETE: remove it
// (its pages, sections, blocks and media rows cascade).

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { siteDocumentFromDb } from "@/lib/advanced-sites";

export const runtime = "nodejs";

const include = {
  pages: {
    orderBy: { order: "asc" as const },
    include: {
      sections: {
        orderBy: { order: "asc" as const },
        include: { blocks: { orderBy: { order: "asc" as const } } },
      },
    },
  },
};

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to open your sites." }, { status: 401 });
  const { id } = await params;
  const site = await db.site.findFirst({ where: { id, userId: user.id }, include });
  if (!site) return NextResponse.json({ error: "Site not found." }, { status: 404 });
  return NextResponse.json(siteDocumentFromDb(site));
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete your site." }, { status: 401 });
  const { id } = await params;
  const result = await db.site.deleteMany({ where: { id, userId: user.id } });
  if (result.count === 0) return NextResponse.json({ error: "Site not found." }, { status: 404 });
  return new NextResponse(null, { status: 204 });
}
