import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to publish this exhibition." }, { status: 401 });
  const { id } = await params;
  const exhibition = await db.exhibition.findFirst({
    where: { id, ownerId: user.id },
    select: { id: true, status: true, slug: true },
  });
  if (!exhibition) return NextResponse.json({ error: "Exhibition not found." }, { status: 404 });

  const updated = await db.exhibition.update({
    where: { id },
    data: {
      status: exhibition.status === "public" ? "draft" : "public",
      publishedAt: exhibition.status === "public" ? null : new Date(),
    },
  });
  return NextResponse.json({ status: updated.status, slug: updated.slug });
}
