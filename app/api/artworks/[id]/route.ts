import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { FRAME_VARIANTS, type FrameVariant } from "@/lib/demo-data";

// Update one artwork's frame — the standalone Frame Studio's save. Only
// the frame changes; everything else about the artwork (and the
// exhibition it hangs in) is untouched. The frame value uses the same
// validation as the exhibition save: a built-in variant, or a custom
// Frame Studio configuration encoded as "custom:<base64url JSON>". The
// renderer falls back to wood for anything it cannot decode, so a bad
// value never breaks the room — but the API still rejects it.
const patchSchema = z.object({
  frame: z.union([
    z.enum(Object.keys(FRAME_VARIANTS) as [FrameVariant, ...FrameVariant[]]),
    z.string().regex(/^custom:[A-Za-z0-9_-]{1,2000}={0,2}$/),
  ]),
});

type RouteContext = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to frame this artwork." }, { status: 401 });
  const { id } = await params;

  let input: z.infer<typeof patchSchema>;
  try {
    input = patchSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "That frame is not valid." }, { status: 400 });
  }

  // Ownership runs through the exhibition: the artwork must hang in one
  // of the signed-in user's exhibitions.
  const artwork = await db.artwork.findFirst({
    where: { id, exhibition: { ownerId: user.id } },
    select: { id: true },
  });
  if (!artwork) return NextResponse.json({ error: "Artwork not found." }, { status: 404 });

  await db.artwork.update({ where: { id }, data: { frame: input.frame } });
  return NextResponse.json({ ok: true, frame: input.frame });
}

// Delete one artwork — the Collection Manager's bulk delete. Ownership
// runs through the exhibition, as above. Deleting an artwork removes it
// from its exhibition; any SavedWork rows that reference it (collection
// records, frame presets) are left in place and simply stop matching.
export async function DELETE(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete an artwork." }, { status: 401 });
  const { id } = await params;

  const artwork = await db.artwork.findFirst({
    where: { id, exhibition: { ownerId: user.id } },
    select: { id: true },
  });
  if (!artwork) return NextResponse.json({ error: "Artwork not found." }, { status: 404 });

  await db.artwork.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
