import { readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const mimeTypes: Record<string, string> = {
  webp: "image/webp",
};

type RouteContext = { params: Promise<{ filename: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { filename } = await params;
  if (!/^[a-f0-9-]{36}\.webp$/i.test(filename)) {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }

  const imageUrl = `/api/uploads/${filename}`;
  const artwork = await db.artwork.findFirst({
    where: { imageUrl },
    select: { exhibition: { select: { status: true, ownerId: true } } },
  });
  if (!artwork) return NextResponse.json({ error: "Image not found." }, { status: 404 });

  if (artwork.exhibition.status !== "public") {
    const user = await getCurrentUser();
    if (!user || user.id !== artwork.exhibition.ownerId) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }
  }

  try {
    const bytes = await readFile(path.join(process.cwd(), "data", "uploads", filename));
    const extension = filename.split(".").pop()?.toLowerCase() ?? "png";
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": mimeTypes[extension] ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": artwork.exhibition.status === "public" ? "public, max-age=3600" : "private, no-store",
      },
    });
  } catch (error) {
    console.error("Could not read uploaded image.", error);
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }
}
