import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { getR2Bucket, getR2Client, isR2Configured } from "@/lib/r2";
import {
  ARTDRIVE_MAX_SIZE,
  artDriveShareLink,
  newArtDriveKey,
  newArtDriveToken,
  requireArtDriveManager,
} from "@/lib/artdrive";

export const runtime = "nodejs";

// Presigned PUT for a heavy ArtDrive file (over 4.5 MB): the browser
// uploads straight to R2, so the bytes never pass through Vercel. The
// client then calls /api/admin/artdrive/confirm with the returned key
// and token, which creates the database row — a file that never reaches
// storage leaves no row behind. The PUT needs the bucket CORS policy
// (PUT from the site origin, Content-Type allowed); without it the
// browser preflight fails and the client shows a clear error.
export async function POST(request: Request) {
  const auth = await requireArtDriveManager();
  if ("response" in auth) return auth.response;
  if (!isR2Configured()) {
    return NextResponse.json({ error: "File storage is not configured yet." }, { status: 501 });
  }

  let body: { fileName?: unknown; size?: unknown; mimeType?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send the file name, size and type." }, { status: 400 });
  }
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const size = typeof body.size === "number" ? body.size : 0;
  const mimeType = typeof body.mimeType === "string" && body.mimeType ? body.mimeType : "application/octet-stream";
  if (!fileName) {
    return NextResponse.json({ error: "Send the file name." }, { status: 400 });
  }
  if (!Number.isFinite(size) || size <= 0 || size > ARTDRIVE_MAX_SIZE) {
    return NextResponse.json({ error: "This file is too large (100 MB maximum)." }, { status: 413 });
  }

  const token = newArtDriveToken();
  const key = newArtDriveKey(token);
  let uploadUrl: string;
  try {
    uploadUrl = await getSignedUrl(
      getR2Client(),
      new PutObjectCommand({ Bucket: getR2Bucket(), Key: key, ContentType: mimeType }),
      { expiresIn: 3600 },
    );
  } catch (error) {
    console.error("Could not sign an ArtDrive upload.", error);
    return NextResponse.json({ error: "Could not prepare this upload." }, { status: 502 });
  }
  return NextResponse.json({
    token,
    key,
    uploadUrl,
    shareLink: artDriveShareLink(token),
  });
}
