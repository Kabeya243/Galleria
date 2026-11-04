import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser, toClientArtwork } from "@/lib/auth";
import { db } from "@/lib/db";

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

export async function POST() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to create an exhibition." }, { status: 401 });

  const exhibition = await db.exhibition.create({
    data: {
      title: "Untitled exhibition",
      slug: randomUUID(),
      ownerId: user.id,
    },
  });
  return NextResponse.json({ exhibition }, { status: 201 });
}
