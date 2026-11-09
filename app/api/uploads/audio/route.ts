import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getR2Bucket, getR2Client, isR2Configured } from "@/lib/r2";

export const runtime = "nodejs";

// Server-side audio upload to R2 (proxy): the small-file path. Same shape
// as the image proxy (/api/uploads/r2) with its own allowlist and prefix,
// so the two never mix: MP3 and AAC only, 4.5 MB max (Vercel's
// request-body cap), stored under audio/<userId>/<uuid>.<ext> and served
// same-origin from /api/audio/<key>. Longer tracks go straight to R2
// with a presigned PUT URL (/api/uploads/presign, 50 MB) and get the
// same serving URL.
// Only music the artist owns or that is free to share may be uploaded
// — the editor says so next to the upload field.
const MAX_FILE_SIZE = 4_500_000;
const allowedMimeTypes: Record<string, string> = {
  "audio/mpeg": "mp3",
  "audio/mp3": "mp3",
  "audio/mp4": "m4a",
  "audio/x-m4a": "m4a",
};
const TOO_LARGE =
  "This audio file is too large (over 4.5 MB). Try a shorter track, or export it at 128 kbps.";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload music." }, { status: 401 });
  if (!isR2Configured()) {
    return NextResponse.json({ error: "Music storage is not configured yet." }, { status: 501 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE + 64_000) {
    return NextResponse.json({ error: TOO_LARGE }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Choose an audio file to upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an audio file." }, { status: 400 });
  const contentType = file.type.toLowerCase();
  const extension = allowedMimeTypes[contentType];
  if (!extension) {
    return NextResponse.json({ error: "Upload an MP3 or AAC (.m4a) audio file." }, { status: 415 });
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: TOO_LARGE }, { status: 413 });
  }

  const key = `audio/${user.id}/${randomUUID()}.${extension}`;
  const buffer = new Uint8Array(await file.arrayBuffer());
  try {
    await getR2Client().send(
      new PutObjectCommand({ Bucket: getR2Bucket(), Key: key, ContentType: contentType, Body: buffer }),
    );
  } catch (error) {
    console.error("Could not upload audio to R2.", error);
    return NextResponse.json({ error: "Could not upload this audio file." }, { status: 502 });
  }
  // Same-origin serving URL, not the raw R2 public URL: the bucket has
  // no CORS policy, so the raw URL is unreliable from the browser.
  return NextResponse.json({ url: `/api/audio/${key}`, key }, { status: 200 });
}
