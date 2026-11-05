import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getR2Bucket, getR2Client, isR2Configured, r2PublicUrl } from "@/lib/r2";

export const runtime = "nodejs";

// A presigned PUT URL lets the browser upload an artwork image straight to
// R2, bypassing Vercel's 4.5 MB request body limit entirely. The API only
// signs the upload — the bytes never pass through this server.
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const allowedMimeTypes: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/heic": "heic",
  "image/heif": "heif",
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload artwork." }, { status: 401 });
  if (!isR2Configured()) {
    // No bucket configured yet: the editor falls back to the legacy
    // /api/uploads route (database storage) instead of failing.
    return NextResponse.json({ error: "Image storage is not configured yet." }, { status: 501 });
  }

  let body: { filename?: unknown; contentType?: unknown; size?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Send the file name, type and size." }, { status: 400 });
  }

  const contentType = typeof body.contentType === "string" ? body.contentType.toLowerCase() : "";
  const extension = allowedMimeTypes[contentType];
  if (!extension) {
    return NextResponse.json({ error: "Upload a valid PNG, JPEG, WebP, AVIF, HEIC or HEIF image." }, { status: 415 });
  }
  const size = typeof body.size === "number" ? body.size : 0;
  if (!Number.isFinite(size) || size <= 0 || size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Images must be smaller than 50 MB." }, { status: 413 });
  }

  const key = `uploads/${user.id}/${randomUUID()}.${extension}`;
  const client = getR2Client();
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: getR2Bucket(), Key: key, ContentType: contentType }),
    { expiresIn: 300 },
  );
  return NextResponse.json({ uploadUrl, publicUrl: r2PublicUrl(key), key }, { status: 200 });
}
