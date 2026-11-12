import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getR2Bucket, getR2Client, isR2Configured, r2PublicUrl } from "@/lib/r2";

export const runtime = "nodejs";

// A presigned PUT URL lets the browser upload a file straight to R2,
// bypassing Vercel's 4.5 MB request body limit entirely. The API only
// signs the upload, so the bytes never pass through this server. This is
// the primary path for heavy files (long video, detailed GLB, long
// audio track, very large photo); small files keep using the server
// proxy routes, which need no CORS at all. The browser PUT needs a
// CORS policy on the bucket (PUT from the site origin, Content-Type
// header allowed). Without it the preflight fails and the client
// falls back to the proxy for small files and shows a clear error for
// heavy ones. The returned `url` is the same-origin serving URL
// (/api/r2/…, /api/video/…, /api/sculpture/…, /api/audio/…): the
// stored URL, so textures, videos and GLBs load without CORS, exactly
// as if the file had come through the proxy.
type UploadKind = "image" | "video" | "sculpture" | "audio";

const KINDS: Record<
  UploadKind,
  {
    maxSize: number;
    prefix: string;
    mimeTypes: Record<string, string>;
    servingUrl: (key: string) => string;
    // Filename fallback when the browser reports no usable type.
    typeFromName?: (name: string) => string | null;
  }
> = {
  image: {
    maxSize: 5 * 1024 * 1024,
    prefix: "uploads",
    mimeTypes: {
      "image/png": "png",
      "image/jpeg": "jpg",
      "image/jpg": "jpg",
      "image/webp": "webp",
      "image/avif": "avif",
      "image/heic": "heic",
      "image/heif": "heif",
    },
    servingUrl: (key) => `/api/r2/${key}`,
  },
  video: {
    maxSize: 50 * 1024 * 1024,
    prefix: "videos",
    mimeTypes: { "video/mp4": "mp4" },
    servingUrl: (key) => `/api/video/${key}`,
    typeFromName: (name) => (name.endsWith(".mp4") ? "video/mp4" : null),
  },
  sculpture: {
    maxSize: 100 * 1024 * 1024,
    prefix: "sculptures",
    mimeTypes: { "model/gltf-binary": "glb", "application/octet-stream": "glb" },
    servingUrl: (key) => `/api/sculpture/${key}`,
    typeFromName: (name) => (name.endsWith(".glb") ? "model/gltf-binary" : null),
  },
  audio: {
    maxSize: 10 * 1024 * 1024,
    prefix: "audio",
    mimeTypes: {
      "audio/mpeg": "mp3",
      "audio/mp3": "mp3",
      "audio/mp4": "m4a",
      "audio/x-m4a": "m4a",
    },
    servingUrl: (key) => `/api/audio/${key}`,
    typeFromName: (name) =>
      name.endsWith(".mp3") ? "audio/mpeg" : name.endsWith(".m4a") ? "audio/mp4" : null,
  },
};

const KIND_LABELS: Record<UploadKind, string> = {
  image: "image",
  video: "video",
  sculpture: "sculpture",
  audio: "audio file",
};

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload." }, { status: 401 });
  if (!isR2Configured()) {
    // No bucket configured yet: the client falls back to the legacy
    // proxy route (small files) instead of failing.
    return NextResponse.json({ error: "Storage is not configured yet." }, { status: 501 });
  }

  let body: { filename?: unknown; contentType?: unknown; size?: unknown; kind?: unknown } = {};
  try {
    body = (await request.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Send the file name, type and size." }, { status: 400 });
  }

  const kind: UploadKind =
    body.kind === "video" || body.kind === "sculpture" || body.kind === "audio" ? body.kind : "image";
  const config = KINDS[kind];
  const label = KIND_LABELS[kind];
  const filename = typeof body.filename === "string" ? body.filename.toLowerCase() : "";
  let contentType = typeof body.contentType === "string" ? body.contentType.toLowerCase() : "";
  let extension = config.mimeTypes[contentType];
  if (!extension && config.typeFromName) {
    // Some browsers report no type for .glb/.mp4/.mp3, so trust the
    // extension, and sign that type so the PUT header matches.
    const fallback = config.typeFromName(filename);
    if (fallback) {
      contentType = fallback;
      extension = config.mimeTypes[fallback];
    }
  }
  if (!extension) {
    return NextResponse.json({ error: `Upload a valid ${label} file.` }, { status: 415 });
  }
  if (kind === "sculpture" && !filename.endsWith(".glb")) {
    return NextResponse.json({ error: "Upload a .glb file." }, { status: 415 });
  }
  const size = typeof body.size === "number" ? body.size : 0;
  if (!Number.isFinite(size) || size <= 0 || size > config.maxSize) {
    const maxMb = Math.round(config.maxSize / (1024 * 1024));
    return NextResponse.json({ error: `This ${label} is too large (over ${maxMb} MB).` }, { status: 413 });
  }

  const key = `${config.prefix}/${user.id}/${randomUUID()}.${extension}`;
  const client = getR2Client();
  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: getR2Bucket(), Key: key, ContentType: contentType }),
    // One hour: a 50 MB upload on a slow connection takes a while,
    // and a signature that expires mid-upload fails the whole PUT.
    { expiresIn: 3600 },
  );
  return NextResponse.json(
    { uploadUrl, url: config.servingUrl(key), publicUrl: r2PublicUrl(key), key, contentType },
    { status: 200 },
  );
}
