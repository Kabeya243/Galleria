import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, isAdminEmail } from "@/lib/auth";
import { db } from "@/lib/db";
import { getHiddenRoomLayouts } from "@/lib/hidden-room-layouts";
import { roomLayouts } from "@/lib/rooms";

// Hide / restore room templates from the admin panel. Hiding only
// records the layout id in the database (the template itself stays in
// code), so the removal survives reloads and redeploys, and exhibitions
// already built with the template keep working. Admin only, enforced
// server-side — the UI never decides this on its own.
const bodySchema = z.object({ layout: z.string().trim().min(1) });

async function adminUser() {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}

// Hide a template: POST { layout }.
export async function POST(request: Request) {
  if (!(await adminUser())) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Empty body — the schema below reports the missing layout.
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A template is required." }, { status: 400 });
  }
  const { layout } = parsed.data;
  if (!(layout in roomLayouts)) {
    return NextResponse.json({ error: "Unknown template." }, { status: 400 });
  }
  await db.hiddenRoomTemplate.upsert({
    where: { layout },
    update: {},
    create: { layout },
  });
  return NextResponse.json({ hidden: await getHiddenRoomLayouts() });
}

// Restore a hidden template: DELETE ?layout=<id>.
export async function DELETE(request: Request) {
  if (!(await adminUser())) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }
  const layout = new URL(request.url).searchParams.get("layout")?.trim() ?? "";
  if (!layout) {
    return NextResponse.json({ error: "A template is required." }, { status: 400 });
  }
  await db.hiddenRoomTemplate.deleteMany({ where: { layout } });
  return NextResponse.json({ hidden: await getHiddenRoomLayouts() });
}
