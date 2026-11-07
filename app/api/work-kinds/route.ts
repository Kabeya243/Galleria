import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { WORK_KINDS, setWorkKind, type WorkKind } from "@/lib/works";

// Set (or clear) the kind of one artwork — oeuvre / design / création —
// for the "Mes travaux" wall. Ownership runs through the exhibition, as
// in /api/artworks/[id]. The kind is stored in the owner's "work-kinds"
// SavedWork row (no DB migration), never on the Artwork table.
const bodySchema = z.object({
  artworkId: z.string().min(1).max(100),
  kind: z.enum(WORK_KINDS).nullable(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  let input: z.infer<typeof bodySchema>;
  try {
    input = bodySchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "That kind is not valid." }, { status: 400 });
  }
  const artwork = await db.artwork.findFirst({
    where: { id: input.artworkId, exhibition: { ownerId: user.id } },
    select: { id: true },
  });
  if (!artwork) return NextResponse.json({ error: "Artwork not found." }, { status: 404 });
  const kinds = await setWorkKind(user.id, input.artworkId, input.kind as WorkKind | null);
  return NextResponse.json({ ok: true, kind: kinds[input.artworkId] ?? null });
}
