import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser, toClientArtwork } from "@/lib/auth";
import { db } from "@/lib/db";
import { getHiddenRoomLayouts } from "@/lib/hidden-room-layouts";
import { createGalleryRoom, ROOM_MODELS, roomModelLayout, seedStoneGalleryArtworks } from "@/lib/rooms";

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
  const requestedLayout = roomModelLayout(parsed.data.model ?? "minimalist");
  // A model the owner hid in the admin cannot seed a new exhibition:
  // fall back to the White Cube instead of creating with a hidden room.
  const hiddenLayouts = await getHiddenRoomLayouts();
  const layout = hiddenLayouts.includes(requestedLayout) ? "cube" : requestedLayout;

  const frontRoom = createGalleryRoom(0, layout === "stone-gallery" ? "stone-gallery-front" : layout);
  // The Stone Gallery is TWO rooms: the front (entrance) half and the
  // back half behind the arched dividing wall, created together from
  // the one "stone" model. The plan is the reference room's own — the
  // front half 20 × 13 m centred at global z = +5.5, the back half
  // 20 × 11 m centred at global z = −6.5 — only made functional, so
  // the mini-plan shows Room 1 and Room 2 and the visitor can move
  // between them. Both halves get the Stone concrete floor (the preset
  // infers floorType "stone-concrete" from floorTexture
  // "stone-concrete") and the arched dividing wall as a real partition
  // in the front room. The front room MUST be "stone-gallery-front",
  // not the single "stone-gallery" layout: every Stone check in the
  // scene (room offsets, the arch-crossing room switch, the hidden
  // shared walls, the split ceiling lights) keys on the half layouts,
  // and the inspector reads the layout's dimensions — a front room
  // saved as "stone-gallery" displays 20×24 m, sits at z = 0, pushes
  // the back half beside it along X and never switches rooms at the
  // arch.
  const rooms = layout === "stone-gallery"
    ? [frontRoom, createGalleryRoom(1, "stone-gallery-back")]
    : [frontRoom];
  const exhibition = await db.exhibition.create({
    data: {
      title: parsed.data.title,
      slug: randomUUID(),
      ownerId: user.id,
      rooms: JSON.stringify(rooms),
      // The Stone Gallery ships with its seven demo artworks pre-placed
      // as normal artworks, so the rooms look like the reference on
      // opening — and each one can be edited, re-imaged or deleted in
      // the editor like any artwork the owner adds by hand.
      artworks: layout === "stone-gallery" ? { create: seedStoneGalleryArtworks(rooms[0].id, rooms[1].id) } : undefined,
    },
  });
  return NextResponse.json({ exhibition }, { status: 201 });
}
