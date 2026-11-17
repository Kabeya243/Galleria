import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getR2Bucket, getR2Client, isR2Configured } from "@/lib/r2";
import {
  ARTDRIVE_PROXY_LIMIT,
  artDriveShareLink,
  newArtDriveKey,
  newArtDriveToken,
  requireArtDriveManager,
} from "@/lib/artdrive";

export const runtime = "nodejs";

// ArtDrive admin API (manager only): list the shared files, and upload
// a small file through the server proxy. Files up to 4.5 MB come here
// (Vercel's request-body cap); heavier files go straight to R2 with a
// presigned PUT URL (/api/admin/artdrive/presign) and are then confirmed
// with /api/admin/artdrive/confirm. The stored file gets a random
// share token, so the link itself is the access control, like Drive.
function toClientFile(file: {
  id: string;
  token: string;
  fileName: string;
  mimeType: string;
  size: number;
  downloads: number;
  createdAt: Date;
}) {
  return {
    id: file.id,
    token: file.token,
    fileName: file.fileName,
    mimeType: file.mimeType,
    size: file.size,
    downloads: file.downloads,
    createdAt: file.createdAt.toISOString(),
    shareLink: artDriveShareLink(file.token),
  };
}

export async function GET() {
  const auth = await requireArtDriveManager();
  if ("response" in auth) return auth.response;
  const files = await db.artDriveFile.findMany({
    where: { ownerId: auth.user.id },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ files: files.map(toClientFile) });
}

export async function POST(request: Request) {
  const auth = await requireArtDriveManager();
  if ("response" in auth) return auth.response;
  if (!isR2Configured()) {
    return NextResponse.json({ error: "File storage is not configured yet." }, { status: 501 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > ARTDRIVE_PROXY_LIMIT + 64_000) {
    return NextResponse.json(
      { error: "This file is too large for a direct upload. Use the large-file upload instead." },
      { status: 413 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Choose a file to upload." }, { status: 400 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "This file is empty." }, { status: 400 });
  }
  if (file.size > ARTDRIVE_PROXY_LIMIT) {
    return NextResponse.json(
      { error: "This file is too large for a direct upload. Use the large-file upload instead." },
      { status: 413 },
    );
  }

  const token = newArtDriveToken();
  const key = newArtDriveKey(token);
  const mimeType = file.type || "application/octet-stream";
  const buffer = new Uint8Array(await file.arrayBuffer());
  try {
    await getR2Client().send(
      new PutObjectCommand({ Bucket: getR2Bucket(), Key: key, ContentType: mimeType, Body: buffer }),
    );
  } catch (error) {
    console.error("Could not upload file to R2 (ArtDrive).", error);
    return NextResponse.json({ error: "Could not upload this file." }, { status: 502 });
  }

  const row = await db.artDriveFile.create({
    data: {
      token,
      fileName: file.name,
      mimeType,
      size: file.size,
      r2Key: key,
      ownerId: auth.user.id,
    },
  });
  return NextResponse.json({ file: toClientFile(row) }, { status: 201 });
}
