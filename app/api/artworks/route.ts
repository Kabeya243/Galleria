import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { upsertLibraryWorks } from "@/lib/library";

// Create one artwork inside one of the signed-in user's exhibitions.
// Used by Art in Context (step 1 upload, step 7 "add a copy to this
// exhibition"): the editor's whole-exhibition PUT is the wrong shape for
// adding a single work, so this route creates the single Artwork row.
const createSchema = z.object({
  exhibitionId: z.string().min(1),
  title: z.string().trim().min(1).max(200),
  artist: z.string().max(200).optional().default(""),
  year: z.string().max(20).optional().default(""),
  medium: z.string().max(200).optional().default(""),
  dimensions: z.string().max(100).optional().default(""),
  description: z.string().max(2000).optional().default(""),
  imageUrl: z.string().max(500).optional().nullable(),
  videoUrl: z.string().max(500).optional().nullable(),
  frame: z.string().max(100).optional().default("wood"),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to add an artwork." }, { status: 401 });

  let input: z.infer<typeof createSchema>;
  try {
    input = createSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "That artwork is not valid." }, { status: 400 });
  }

  const exhibition = await db.exhibition.findFirst({
    where: { id: input.exhibitionId, ownerId: user.id },
    select: { id: true },
  });
  if (!exhibition) return NextResponse.json({ error: "Exhibition not found." }, { status: 404 });

  const artwork = await db.artwork.create({
    data: {
      title: input.title,
      artist: input.artist,
      year: input.year,
      medium: input.medium,
      dimensions: input.dimensions,
      description: input.description,
      imageUrl: input.imageUrl ?? null,
      videoUrl: input.videoUrl ?? null,
      frame: input.frame,
      exhibitionId: input.exhibitionId,
    },
  });
  // Every work added to an exhibition joins the reusable library
  // (create-only — a copy never overwrites the canonical row), so
  // "Mes œuvres" stays current without a separate upload step.
  await upsertLibraryWorks(user.id, [{ ...input, imageUrl: input.imageUrl ?? null, videoUrl: input.videoUrl ?? null }]);
  return NextResponse.json({ artwork }, { status: 201 });
}
