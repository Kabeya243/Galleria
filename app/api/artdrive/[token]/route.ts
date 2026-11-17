import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { artDriveShareLink } from "@/lib/artdrive";

export const runtime = "nodejs";

// Public metadata for one ArtDrive share link: what the share page
// needs to show the file (name, size, type, date). No owner info, no
// storage key — the token in the URL is the access control, like Drive.
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const file = await db.artDriveFile.findUnique({ where: { token } });
  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  return NextResponse.json({
    file: {
      fileName: file.fileName,
      mimeType: file.mimeType,
      size: file.size,
      downloads: file.downloads,
      createdAt: file.createdAt.toISOString(),
      shareLink: artDriveShareLink(file.token),
    },
  });
}
