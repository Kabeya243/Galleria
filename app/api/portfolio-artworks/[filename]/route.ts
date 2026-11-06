import { access, readFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";

export const runtime = "nodejs";

const portfolioArtworks: Record<string, string> = {
  "sankofa.webp": "image/webp",
  "authenticity1.webp": "image/webp",
  "felinelook.webp": "image/webp",
  "Angelic.webp": "image/webp",
  "Dream-in-a-blue-sun.webp": "image/webp",
  "scarfed.webp": "image/webp",
  "immaculate.webp": "image/webp",
  "insecure.webp": "image/webp",
  "unknown.webp": "image/webp",
  "authenticity2.webp": "image/webp",
};

type RouteContext = { params: Promise<{ filename: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { filename } = await params;
  const contentType = portfolioArtworks[filename];
  if (!contentType) return NextResponse.json({ error: "Image not found." }, { status: 404 });

  try {
    // The images/works directory is a local portfolio asset folder: it
    // does not exist on Vercel, so a missing file (or directory) is a
    // plain 404, never a 500.
    const artworkPath = path.join(process.cwd(), "..", "images", "works", filename);
    await access(artworkPath);
    const bytes = await readFile(artworkPath);
    return new NextResponse(bytes, {
      headers: {
        "Content-Type": contentType,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=86400",
      },
    });
  } catch (error) {
    console.error("Could not read portfolio artwork.", error);
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }
}
