import { HeadObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getR2Bucket, getR2Client, isR2Configured } from "@/lib/r2";
import {
  ARTDRIVE_MAX_SIZE,
  artDriveShareLink,
  requireArtDriveManager,
} from "@/lib/artdrive";

export const runtime = "nodejs";

// Confirm a direct ArtDrive upload: after the browser PUT the file to
// the presigned URL, this creates the database row (and the share link).
// The object is checked in R2 first (HeadObject), so a failed or
// abandoned PUT never creates a share link to a file that is not there.
export async function POST(request: Request) {
  const auth = await requireArtDriveManager();
  if ("response" in auth) return auth.response;
  if (!isR2Configured()) {
    return NextResponse.json({ error: "File storage is not configured yet." }, { status: 501 });
  }

  let body: { token?: unknown; key?: unknown; fileName?: unknown; size?: unknown; mimeType?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Send the upload details." }, { status: 400 });
  }
  const token = typeof body.token === "string" ? body.token : "";
  const key = typeof body.key === "string" ? body.key : "";
  const fileName = typeof body.fileName === "string" ? body.fileName.trim() : "";
  const size = typeof body.size === "number" ? body.size : 0;
  const mimeType = typeof body.mimeType === "string" && body.mimeType ? body.mimeType : "application/octet-stream";
  if (!token || !key || !fileName) {
    return NextResponse.json({ error: "Send the upload details." }, { status: 400 });
  }
  if (!key.startsWith(`artdrive/${token}/`)) {
    return NextResponse.json({ error: "This upload does not match its share link." }, { status: 400 });
  }
  if (!Number.isFinite(size) || size <= 0 || size > ARTDRIVE_MAX_SIZE) {
    return NextResponse.json({ error: "This file is too large (100 MB maximum)." }, { status: 413 });
  }

  try {
    const head = await getR2Client().send(new HeadObjectCommand({ Bucket: getR2Bucket(), Key: key }));
    if (head.ContentLength !== size) {
      return NextResponse.json(
        { error: "The uploaded file does not match its size. Upload it again." },
        { status: 400 },
      );
    }
  } catch {
    return NextResponse.json(
      { error: "The file did not reach storage. Upload it again." },
      { status: 400 },
    );
  }

  const row = await db.artDriveFile.create({
    data: {
      token,
      fileName,
      mimeType,
      size,
      r2Key: key,
      ownerId: auth.user.id,
    },
  });
  return NextResponse.json(
    {
      file: {
        id: row.id,
        token: row.token,
        fileName: row.fileName,
        mimeType: row.mimeType,
        size: row.size,
        downloads: row.downloads,
        createdAt: row.createdAt.toISOString(),
        shareLink: artDriveShareLink(row.token),
      },
    },
    { status: 201 },
  );
}
