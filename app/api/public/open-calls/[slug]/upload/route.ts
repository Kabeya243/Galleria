import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getR2Bucket, getR2Client, isR2Configured } from "@/lib/r2";

export const runtime = "nodejs";

// File upload for a public open-call form (no sign-in: applicants are
// the public). The signed-in presign route cannot be used here (401
// without a session), so this dedicated, limited route takes the file:
// one file per request, max 4.5 MB (Vercel's request body cap), images
// and PDF only. The file goes to R2 under open-calls/<slug>/<uuid>.<ext>
// and the route returns { key, name } — the form sends the key back with
// the response, and the owner opens the file through the owner-only
// /api/open-calls/files/... route. Nothing else is accepted.
const MAX_FILE_SIZE = 4_500_000;
const allowedMimeTypes: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
  "application/pdf": "pdf",
};

export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const call = await db.openCall.findUnique({ where: { slug }, select: { id: true, status: true, deadline: true } });
  if (!call || call.status !== "published") {
    return NextResponse.json({ error: "Open call not found." }, { status: 404 });
  }
  if (call.deadline && call.deadline.getTime() < Date.now()) {
    return NextResponse.json({ error: "This open call is closed." }, { status: 410 });
  }
  if (!isR2Configured()) {
    return NextResponse.json({ error: "File storage is not configured yet." }, { status: 501 });
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE + 64_000) {
    return NextResponse.json({ error: "This file is too large (over 4 MB). Try a smaller file." }, { status: 413 });
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
  const extension = allowedMimeTypes[file.type];
  if (!extension) {
    return NextResponse.json({ error: "Only images (PNG, JPEG, WebP, AVIF) and PDF files are accepted." }, { status: 400 });
  }
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "This file is too large (over 4 MB). Try a smaller file." }, { status: 413 });
  }
  if (file.size === 0) {
    return NextResponse.json({ error: "This file is empty." }, { status: 400 });
  }
  const key = `open-calls/${slug}/${randomUUID()}.${extension}`;
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    await getR2Client().send(
      new PutObjectCommand({
        Bucket: getR2Bucket(),
        Key: key,
        Body: bytes,
        ContentType: file.type,
      }),
    );
  } catch {
    return NextResponse.json({ error: "Could not store the file. Try again." }, { status: 500 });
  }
  return NextResponse.json({ key, name: file.name });
}
