import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, toClientArtwork } from "@/lib/auth";
import { copyLibraryWorkToExhibition } from "@/lib/library";

type RouteContext = { params: Promise<{ id: string }> };

const reuseSchema = z.object({
  exhibitionId: z.string().min(1),
  roomId: z.string().min(1).max(100).optional(),
});

// Reuse a library work in an exhibition: a COPY, not a re-upload.
// The new Artwork row reuses the library work's imageUrl (the same
// R2 file) and metadata, with a fresh default placement in the target
// room. The copy is independent afterwards: moving, reframing or
// deleting it never touches the library row or other exhibitions.
export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to reuse an artwork." }, { status: 401 });
  const { id } = await params;

  let input: z.infer<typeof reuseSchema>;
  try {
    input = reuseSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "That reuse is not valid." }, { status: 400 });
  }

  const result = await copyLibraryWorkToExhibition(user.id, id, input.exhibitionId, input.roomId);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ artwork: toClientArtwork(result.artwork) }, { status: 201 });
}
