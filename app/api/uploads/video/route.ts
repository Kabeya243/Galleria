import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getR2Bucket, getR2Client, isR2Configured } from "@/lib/r2";
import { VIDEO_MAX_FILE_SIZE, VIDEO_MIME_TYPES } from "@/lib/video";

export const runtime = "nodejs";

// Server-side video upload to R2 (proxy): the small-file path. Same shape
// as the image proxy (/api/uploads/r2) and the audio proxy
// (/api/uploads/audio) with its own allowlist and prefix, so the three
// never mix: MP4 (H.264) only, 4.5 MB max (Vercel's request-body cap),
// stored under videos/<userId>/<uuid>.mp4 and served same-origin from
// /api/video/<key>. Longer films go straight to R2 with a presigned PUT
// URL (/api/uploads/presign, 50 MB) and get the same serving URL.
// Only video the artist owns or that is free to share may be uploaded
// — the editor says so next to the upload field.
const TOO_LARGE =
  "This video is too large (over 4.5 MB). Try a shorter clip, or export it at 720p and a lower bitrate.";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload video." }, { status: 401 });
  if (!isR2Configured()) {
    return NextResponse.json({ error: "Video storage is not configured yet." }, { status: 501 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > VIDEO_MAX_FILE_SIZE + 64_000) {
    return NextResponse.json({ error: TOO_LARGE }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Choose a video file to upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a video file." }, { status: 400 });
  const contentType = file.type.toLowerCase();
  const extension = VIDEO_MIME_TYPES[contentType];
  if (!extension) {
    return NextResponse.json({ error: "Upload an MP4 (H.264) video file." }, { status: 415 });
  }
  if (file.size === 0 || file.size > VIDEO_MAX_FILE_SIZE) {
    return NextResponse.json({ error: TOO_LARGE }, { status: 413 });
  }

  const key = `videos/${user.id}/${randomUUID()}.${extension}`;
  const buffer = new Uint8Array(await file.arrayBuffer());
  try {
    await getR2Client().send(
      new PutObjectCommand({ Bucket: getR2Bucket(), Key: key, ContentType: contentType, Body: buffer }),
    );
  } catch (error) {
    console.error("Could not upload video to R2.", error);
    return NextResponse.json({ error: "Could not upload this video." }, { status: 502 });
  }
  // Same-origin serving URL, not the raw R2 public URL: the bucket has
  // no CORS policy, so the raw URL is unreliable from the browser — and
  // a WebGL VideoTexture needs the same origin (or CORS headers) to
  // read the video's pixels at all.
  return NextResponse.json({ url: `/api/video/${key}`, key }, { status: 200 });
}
