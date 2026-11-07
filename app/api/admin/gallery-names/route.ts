import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, isAdminEmail } from "@/lib/auth";
import { db } from "@/lib/db";
import { getGalleryNames } from "@/lib/gallery-names-server";
import { roomLayouts } from "@/lib/rooms";

// Rename a gallery from the admin panel. The rename is stored in the
// database (model GalleryName) so it survives reloads and redeploys;
// the code defaults (lib/gallery-names.ts) apply when no row exists.
// Admin only, enforced server-side — the UI never decides this on its
// own. PUT { layout, nameEn, nameFr } -> { names } (the full map).
const bodySchema = z.object({
  layout: z.string().trim().min(1),
  nameEn: z.string().trim().min(1).max(80),
  nameFr: z.string().trim().min(1).max(80),
});

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    return NextResponse.json({ error: "Admin only." }, { status: 403 });
  }
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Empty body — the schema below reports the missing fields.
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "A gallery, an English name and a French name are required." },
      { status: 400 },
    );
  }
  const { layout, nameEn, nameFr } = parsed.data;
  if (!(layout in roomLayouts)) {
    return NextResponse.json({ error: "Unknown gallery." }, { status: 400 });
  }
  await db.galleryName.upsert({
    where: { layout },
    update: { nameEn, nameFr },
    create: { layout, nameEn, nameFr },
  });
  return NextResponse.json({ names: await getGalleryNames() });
}
