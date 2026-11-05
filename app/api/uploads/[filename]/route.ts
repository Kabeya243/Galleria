import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ filename: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { filename } = await params;
  if (!/^[a-f0-9-]{36}\.webp$/i.test(filename)) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  const imageUrl = `/api/uploads/${filename}`;
  const upload = await db.upload.findUnique({ where: { id: filename.slice(0, -5) } });
  if (!upload) return NextResponse.json({ error: "Image not found." }, { status: 404 });

  const artwork = await db.artwork.findFirst({
    where: { imageUrl },
    select: { exhibition: { select: { status: true, ownerId: true } } },
  });
  if (artwork) {
    if (artwork.exhibition.status !== "public") {
      const user = await getCurrentUser();
      if (!user || user.id !== artwork.exhibition.ownerId) {
        return NextResponse.json({ error: "Image not found." }, { status: 404 });
      }
    }
  } else {
    // Not attached to a saved artwork yet (just uploaded): only its owner
    // may see it, so the preview works right after upload, before saving.
    const user = await getCurrentUser();
    if (!user || user.id !== upload.ownerId) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }
  }

  return new NextResponse(Buffer.from(upload.data), {
    headers: {
      "Content-Type": "image/webp",
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": artwork?.exhibition.status === "public" ? "public, max-age=3600" : "private, no-store",
    },
  });
}
