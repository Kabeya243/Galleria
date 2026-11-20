import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

// Homepage highlight (Nov 2026): the admin picks which public
// exhibition is the homepage hero, from /admin/exhibitions. Setting
// highlighted=true stamps highlightedAt (the hero shows the most
// recently highlighted public show); false clears it and the hero
// falls back to the newest public exhibition. Only the admin can do
// this — it needs the exhibitions.highlight permission, which the
// manager holds and a sub-admin only when granted. Highlighting a
// draft or private-link show is allowed but changes nothing on the
// homepage until that show is public.
const highlightSchema = z.object({
  highlighted: z.boolean(),
});

export async function POST(request: Request, { params }: RouteContext) {
  const access = await requireAdminPermission("exhibitions.highlight");
  if (!access) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const { id } = await params;
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = highlightSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Could not change the highlight." }, { status: 400 });
  }
  const exhibition = await db.exhibition.findUnique({
    where: { id },
    select: { id: true, title: true },
  });
  if (!exhibition) {
    return NextResponse.json({ error: "Exhibition not found." }, { status: 404 });
  }
  const updated = await db.exhibition.update({
    where: { id },
    data: { highlightedAt: parsed.data.highlighted ? new Date() : null },
    select: { id: true, highlightedAt: true },
  });
  return NextResponse.json({ highlighted: updated.highlightedAt !== null });
}
