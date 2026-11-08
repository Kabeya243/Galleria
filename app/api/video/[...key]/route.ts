import { GetObjectCommand, HeadObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getR2Bucket, getR2Client, isR2Configured, r2PublicUrl } from "@/lib/r2";

export const runtime = "nodejs";

// Serve an R2-stored video artwork same-origin. Same pattern as the
// audio route (/api/audio/[...key]) with its own prefix and Content-Type,
// plus HTTP Range support: without it the browser cannot seek inside the
// video (and most browsers refuse to play a <video> or VideoTexture
// stream they cannot range — playback stalls or never starts). The Range
// header is passed through to R2's GetObject, which honours it; the
// response then carries Content-Range and a 206 status.
// Access mirrors the images: a published exhibition's videos are open
// to anyone, otherwise only the owner may watch them (a just-uploaded
// video, not attached to a saved artwork yet, is only visible to the
// user whose id is in the key, so the editor preview works right after
// upload, before saving). A video hanging in the reusable library but
// in no exhibition yet is covered by the same owner-only rule.
const CONTENT_TYPES: Record<string, string> = {
  mp4: "video/mp4",
};

// Parse "bytes=start-end" (either end may be open). Returns null when
// the header is absent or malformed — the caller then serves the file
// whole (200) instead of failing the playback.
function parseRange(header: string | null, size: number): { start: number; end: number } | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  let start = match[1] === "" ? NaN : Number(match[1]);
  let end = match[2] === "" ? NaN : Number(match[2]);
  if (Number.isNaN(start) && Number.isNaN(end)) return null;
  if (Number.isNaN(start)) {
    // Suffix range: "bytes=-500" = the last 500 bytes.
    start = Math.max(0, size - end);
    end = size - 1;
  } else if (Number.isNaN(end)) {
    end = size - 1;
  }
  if (start < 0 || end < start || start >= size) return null;
  return { start, end: Math.min(end, size - 1) };
}

type RouteContext = { params: Promise<{ key: string[] }> };

export async function GET(request: Request, { params }: RouteContext) {
  const { key } = await params;
  const objectKey = key.join("/");
  const match = /^videos\/([A-Za-z0-9_-]+)\/([a-f0-9-]{36})\.mp4$/i.exec(objectKey);
  if (!match) return NextResponse.json({ error: "Video not found." }, { status: 404 });
  const ownerId = match[1];
  const extension = "mp4";
  if (!isR2Configured()) return NextResponse.json({ error: "Video not found." }, { status: 404 });

  const servingUrl = `/api/video/${objectKey}`;
  const publicUrl = r2PublicUrl(objectKey);
  const artwork = await db.artwork.findFirst({
    where: { OR: [{ videoUrl: servingUrl }, { videoUrl: publicUrl }] },
    select: { exhibition: { select: { status: true, ownerId: true } } },
  });
  let isPublic = false;
  if (artwork) {
    isPublic = artwork.exhibition.status === "public";
    if (!isPublic) {
      const user = await getCurrentUser();
      if (!user || user.id !== artwork.exhibition.ownerId) {
        return NextResponse.json({ error: "Video not found." }, { status: 404 });
      }
    }
  } else {
    // Not attached to a saved artwork yet (just uploaded, or only in
    // the library): only its owner may watch it, so the editor preview
    // works right after upload, before saving.
    const user = await getCurrentUser();
    if (!user || user.id !== ownerId) {
      return NextResponse.json({ error: "Video not found." }, { status: 404 });
    }
  }

  try {
    const rangeHeader = request.headers.get("range");
    let range: { start: number; end: number } | null = null;
    if (rangeHeader) {
      const head = await getR2Client().send(
        new HeadObjectCommand({ Bucket: getR2Bucket(), Key: objectKey }),
      );
      const size = head.ContentLength ?? 0;
      range = parseRange(rangeHeader, size);
      if (rangeHeader && !range) {
        // Unsatisfiable range: say so instead of serving the whole file
        // as if the request had been honoured.
        return new NextResponse(null, {
          status: 416,
          headers: { "Content-Range": `bytes */${size}`, "Accept-Ranges": "bytes" },
        });
      }
    }

    const object = await getR2Client().send(
      new GetObjectCommand({
        Bucket: getR2Bucket(),
        Key: objectKey,
        ...(range ? { Range: `bytes=${range.start}-${range.end}` } : {}),
      }),
    );
    if (!object.Body) return NextResponse.json({ error: "Video not found." }, { status: 404 });
    const bytes = await object.Body.transformToByteArray();
    const headers: Record<string, string> = {
      "Content-Type": object.ContentType ?? CONTENT_TYPES[extension] ?? "application/octet-stream",
      "X-Content-Type-Options": "nosniff",
      "Accept-Ranges": "bytes",
      "Cache-Control": isPublic ? "public, max-age=3600" : "private, no-store",
    };
    if (range && object.ContentRange) {
      // R2 honoured the range: 206 + the exact slice it returned.
      headers["Content-Range"] = object.ContentRange;
      headers["Content-Length"] = String(bytes.length);
      return new NextResponse(Buffer.from(bytes), { status: 206, headers });
    }
    headers["Content-Length"] = String(bytes.length);
    return new NextResponse(Buffer.from(bytes), { headers });
  } catch {
    return NextResponse.json({ error: "Video not found." }, { status: 404 });
  }
}
