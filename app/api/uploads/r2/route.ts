import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getR2Bucket, getR2Client, isR2Configured } from "@/lib/r2";

export const runtime = "nodejs";

// Server-side upload to R2 (proxy). The browser cannot PUT to R2 directly:
// the bucket has no CORS policy, so the browser's preflight fails and
// fetch rejects with "Failed to fetch" — that is the error users kept
// seeing on every image upload. Until a CORS policy can be set in
// Cloudflare (access is currently blocked), the bytes go through this
// same-origin route instead and the server puts them in R2: no CORS is
// involved on either leg, and the stored URL is the same as before
// (uploads/<userId>/<uuid>.<ext>).
// Trade-off: Vercel caps the request body at 4.5 MB, so the editor
// compresses images first (see compressImage in the editor) and an
// oversized file gets a clear 413 message. Once CORS is configured on
// the bucket, the presigned direct upload (/api/uploads/presign) can be
// re-enabled to lift the cap.
const MAX_FILE_SIZE = 4_500_000;
const allowedMimeTypes: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
};
const TOO_LARGE =
  "This image is too large to upload (over 4 MB even after compression). Try a smaller file.";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload artwork." }, { status: 401 });
  if (!isR2Configured()) {
    // No bucket configured yet: the editor falls back to the legacy
    // /api/uploads route (database storage) instead of failing.
    return NextResponse.json({ error: "Image storage is not configured yet." }, { status: 501 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE + 64_000) {
    return NextResponse.json({ error: TOO_LARGE }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
  const contentType = file.type.toLowerCase();
  const extension = allowedMimeTypes[contentType];
  if (!extension) {
    return NextResponse.json({ error: "Upload a valid PNG, JPEG, WebP, AVIF, HEIC or HEIF image." }, { status: 415 });
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: TOO_LARGE }, { status: 413 });
  }

  const key = `uploads/${user.id}/${randomUUID()}.${extension}`;
  const buffer = new Uint8Array(await file.arrayBuffer());
  try {
    await getR2Client().send(
      new PutObjectCommand({ Bucket: getR2Bucket(), Key: key, ContentType: contentType, Body: buffer }),
    );
  } catch (error) {
    console.error("Could not upload image to R2.", error);
    return NextResponse.json({ error: "Could not upload this image." }, { status: 502 });
  }
  // Same-origin serving URL, not the raw R2 public URL: three.js loads
  // textures with crossOrigin "anonymous" and the bucket has no CORS
  // policy, so the raw R2 URL fails to load as a texture and useTexture
  // throws, crashing the editor (the "Replace image" crash). Served
  // from /api/r2/<key> the image is same-origin and loads fine.
  return NextResponse.json({ url: `/api/r2/${key}`, key }, { status: 200 });
}
