import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, toClientArtwork } from "@/lib/auth";
import { db } from "@/lib/db";
import { createGalleryRoom, ROOM_MODELS, roomModelLayout } from "@/lib/rooms";
import { seedTemplateArtworks } from "@/lib/template-artworks";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your exhibitions." }, { status: 401 });

  const exhibitions = await db.exhibition.findMany({
    where: { ownerId: user.id },
    include: { artworks: { orderBy: { createdAt: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
  return NextResponse.json({
    exhibitions: exhibitions.map((exhibition) => ({
      ...exhibition,
      artworks: exhibition.artworks.map(toClientArtwork),
    })),
  });
}

// Creating an exhibition needs a title (feature 7 — no more "Untitled
// exhibition") and an optional room model, which seeds the first room
// with that model's layout. The editor still lets the title be edited
// and the layout be switched afterwards.
const createExhibitionSchema = z.object({
  title: z.string().trim().min(1, "A title is required."),
  model: z.enum(ROOM_MODELS.map((model) => model.id) as [string, ...string[]]).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to create an exhibition." }, { status: 401 });

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Empty body — the schema below reports the missing title.
  }
  const parsed = createExhibitionSchema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return NextResponse.json(
      { error: first?.message ?? "A title is required." },
      { status: 400 },
    );
  }
  // Twenty-one models now: the Sunlight Gallery, the nine galleries
  // added in November 2026, and the eleven from Galeries_3D.html,
  // added the same month. An unknown or retired model id falls back to
  // Sunlight (roomModelLayout), and a hidden-layout fallback has no
  // alternative to fall back to.
  const layout = roomModelLayout(parsed.data.model ?? "sunlight");

  const room = { ...createGalleryRoom(0, layout), templateArtSeeded: true };
  const rooms = [room];
  const exhibition = await db.exhibition.create({
    data: {
      title: parsed.data.title,
      slug: randomUUID(),
      ownerId: user.id,
      rooms: JSON.stringify(rooms),
      // Every gallery ships with its template artworks pre-placed as
      // normal artworks (lib/template-artworks.ts), so the room looks
      // like the reference on opening — and each one can be edited,
      // re-imaged, moved, resized or deleted in the editor like any
      // artwork the owner adds by hand. (Sunlight's four were the
      // first; the other galleries' paintings used to belong to the
      // shell, which the editor could not touch.) A layout with no
      // template artworks seeds none.
      artworks: { create: seedTemplateArtworks(layout, room.id) },
    },
  });
  return NextResponse.json({ exhibition }, { status: 201 });
}
