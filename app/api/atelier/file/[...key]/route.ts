// Serve an Atelier file (editor upload or project thumbnail) from R2,
// same-origin so Fabric.js loads it with crossOrigin "anonymous"
// without any CORS. Owner-only: the user id in the key must match the
// signed-in user — a user can never see another user's Atelier files.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isR2Configured, r2Get } from "@/lib/atelier-store";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  svg: "image/svg+xml",
};

type RouteContext = { params: Promise<{ key: string[] }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Image not found." }, { status: 404 });
  const { key } = await params;
  const objectKey = key.join("/");
  const match = /^atelier\/(uploads|projects)\/([A-Za-z0-9_-]+)\/[A-Za-z0-9_-]+\.(png|jpe?g|webp|svg)$/i.exec(objectKey);
  if (!match) return NextResponse.json({ error: "Image not found." }, { status: 404 });
  if (match[2] !== user.id) return NextResponse.json({ error: "Image not found." }, { status: 404 });
  if (!isR2Configured()) return NextResponse.json({ error: "Image not found." }, { status: 404 });
  const bytes = await r2Get(objectKey);
  if (!bytes) return NextResponse.json({ error: "Image not found." }, { status: 404 });
  const extension = match[3].toLowerCase();
  return new NextResponse(bytes as BodyInit, {
    headers: {
      "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
