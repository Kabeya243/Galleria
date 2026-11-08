import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { getCurrentUser, toClientArtwork, withoutExhibitionPasswordHash } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseGalleryRooms } from "@/lib/rooms";
import { exhibitionUpdateSchema } from "@/lib/validation";
import { canEditExhibition } from "@/lib/teams";

type RouteContext = { params: Promise<{ id: string }> };

const ARTWORK_FIELD_LABELS: Record<string, string> = {
  title: "title",
  artist: "artist",
  year: "year",
  medium: "medium",
  dimensions: "dimensions",
  description: "description",
  color: "frame colour",
  accent: "accent colour",
  imageUrl: "image",
  text: "curatorial text",
  textFont: "curatorial text typeface",
  palette: "colour palette",
  altText: "alt text",
  roomId: "room",
  position: "position",
  rotation: "rotation",
  scale: "size",
  frame: "frame",
};

// Turn the first validation failure into a message that names the artwork
// and the missing detail, instead of Zod's raw "String must contain at
// least 1 character(s)".
function readableExhibitionError(error: ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid exhibition data.";
  let detail = issue.message;
  if (detail.includes("at least 1 character") || detail === "Required") detail = "is required";
  else if (detail === "Invalid") detail = "is not valid";
  const path = issue.path;
  if (path[0] === "artworks" && typeof path[1] === "number") {
    const field = typeof path[2] === "string" ? ARTWORK_FIELD_LABELS[path[2]] ?? path[2] : "details";
    return `Artwork ${path[1] + 1}: ${field} ${detail}.`;
  }
  if (path[0] === "title") return `Exhibition title ${detail}.`;
  if (path[0] === "rooms") return `A room ${detail}.`;
  return issue.message;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to edit this exhibition." }, { status: 401 });
  const { id } = await params;
  // The owner, or a team editor with an edit share on this exhibition
  // (Teams & Collaboration, Phase 6). Anyone else gets a plain 404.
  const exhibition = await db.exhibition.findFirst({
    where: { id },
    include: { artworks: { orderBy: { createdAt: "asc" } } },
  });
  if (!exhibition) return NextResponse.json({ error: "Exhibition not found." }, { status: 404 });
  if (exhibition.ownerId !== user.id && !(await canEditExhibition(user.id, id))) {
    return NextResponse.json({ error: "Exhibition not found." }, { status: 404 });
  }

  // The access password hash never leaves the server — the editor only
  // needs the visibility, never the hash itself.
  const exhibitionWithoutHash = withoutExhibitionPasswordHash(exhibition);
  return NextResponse.json({
    exhibition: {
      ...exhibitionWithoutHash,
      rooms: parseGalleryRooms(exhibition.rooms),
      artworks: exhibition.artworks.map(toClientArtwork),
    },
  });
}

export async function PUT(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to save this exhibition." }, { status: 401 });
  const { id } = await params;

  try {
    const input = exhibitionUpdateSchema.parse(await request.json());
    const existing = await db.exhibition.findFirst({ where: { id } });
    if (!existing) return NextResponse.json({ error: "Exhibition not found." }, { status: 404 });
    // Save path: the owner, or a team editor with an edit share
    // (Teams & Collaboration, Phase 6). Viewers and strangers are
    // refused here, server-side, whatever the UI shows.
    if (existing.ownerId !== user.id && !(await canEditExhibition(user.id, id))) {
      return NextResponse.json({ error: "Exhibition not found." }, { status: 404 });
    }

    await db.$transaction(async (transaction) => {
      await transaction.exhibition.update({
        where: { id },
        data: {
          title: input.title,
          description: input.description,
          roomColor: input.rooms[0].wallColor,
          rooms: JSON.stringify(input.rooms),
        },
      });
      await transaction.artwork.deleteMany({ where: { exhibitionId: id } });
      if (input.artworks.length) {
        await transaction.artwork.createMany({
          data: input.artworks.map((artwork) => ({
            id: artwork.id,
            title: artwork.title,
            artist: artwork.artist,
            year: artwork.year,
            medium: artwork.medium,
            dimensions: artwork.dimensions,
            description: artwork.description,
            color: artwork.color,
            accent: artwork.accent,
            positionX: artwork.position[0],
            positionY: artwork.position[1],
            positionZ: artwork.position[2],
            rotation: artwork.rotation,
            scale: artwork.scale,
            frame: artwork.frame,
            imageUrl: artwork.imageUrl ?? null,
            text: artwork.text ?? null,
            textFont: artwork.textFont ?? null,
            palette: artwork.palette ? JSON.stringify(artwork.palette) : null,
            altText: artwork.altText ?? null,
            roomId: artwork.roomId,
            exhibitionId: id,
          })),
        });
      }
    });

    const exhibition = await db.exhibition.findUniqueOrThrow({
      where: { id },
      include: { artworks: { orderBy: { createdAt: "asc" } } },
    });
    return NextResponse.json({
      exhibition: {
        ...withoutExhibitionPasswordHash(exhibition),
        rooms: parseGalleryRooms(exhibition.rooms),
        artworks: exhibition.artworks.map(toClientArtwork),
      },
    });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: readableExhibitionError(error) }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid exhibition data." }, { status: 400 });
    }
    console.error("Could not save exhibition.", error);
    return NextResponse.json({ error: "Could not save this exhibition." }, { status: 500 });
  }
}

// Update an exhibition's title / curatorial statement only — Art in
// Context step 8 saves the show's wording to the real Exhibition row
// without re-saving the whole room (the full PUT is the editor's path).
export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to edit this exhibition." }, { status: 401 });
  const { id } = await params;

  let input: { title?: string; description?: string };
  try {
    input = z
      .object({
        title: z.string().trim().min(1).max(120).optional(),
        description: z.string().max(2000).optional(),
      })
      .refine((data) => data.title !== undefined || data.description !== undefined)
      .parse(await request.json());
  } catch {
    return NextResponse.json({ error: "That exhibition update is not valid." }, { status: 400 });
  }

  const existing = await db.exhibition.findFirst({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Exhibition not found." }, { status: 404 });
  if (existing.ownerId !== user.id && !(await canEditExhibition(user.id, id))) {
    return NextResponse.json({ error: "Exhibition not found." }, { status: 404 });
  }

  const updated = await db.exhibition.update({
    where: { id },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.description !== undefined ? { description: input.description } : {}),
    },
  });
  return NextResponse.json({
    exhibition: { id: updated.id, title: updated.title, description: updated.description, status: updated.status, slug: updated.slug },
  });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete this exhibition." }, { status: 401 });
  const { id } = await params;
  const result = await db.exhibition.deleteMany({ where: { id, ownerId: user.id } });
  if (!result.count) return NextResponse.json({ error: "Exhibition not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
