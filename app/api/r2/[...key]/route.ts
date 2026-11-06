import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getR2Bucket, getR2Client, isR2Configured, r2PublicUrl } from "@/lib/r2";

export const runtime = "nodejs";

// Serve an R2-stored artwork image same-origin. R2 public URLs cannot be
// used as WebGL textures: three.js loads textures with crossOrigin
// "anonymous" and the bucket has no CORS policy, so the load fails and
// useTexture throws, crashing the whole editor (the "Replace image"
// crash). Served from this same-origin route the image needs no CORS, so
// the texture loads and the wall shows the image. The upload proxy
// (/api/uploads/r2) returns this URL instead of the raw R2 public URL.
// Access mirrors the legacy database-image route: a public exhibition's
// images are open to anyone, otherwise only the owner may see them (a
// just-uploaded image, not attached to a saved artwork yet, is only
// visible to the user whose id is in the key, so the editor preview
// works right after upload, before saving).
const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  heic: "image/heic",
  heif: "image/heif",
};

type RouteContext = { params: Promise<{ key: string[] }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { key } = await params;
  const objectKey = key.join("/");
  const match = /^uploads\/([A-Za-z0-9_-]+)\/([a-f0-9-]{36})\.(png|jpe?g|webp|avif|heic|heif)$/i.exec(objectKey);
  if (!match) return NextResponse.json({ error: "Image not found." }, { status: 404 });
  const ownerId = match[1];
  const extension = match[3].toLowerCase();
  if (!isR2Configured()) return NextResponse.json({ error: "Image not found." }, { status: 404 });

  const servingUrl = `/api/r2/${objectKey}`;
  const publicUrl = r2PublicUrl(objectKey);
  const artwork = await db.artwork.findFirst({
    where: { OR: [{ imageUrl: servingUrl }, { imageUrl: publicUrl }] },
    select: { exhibition: { select: { status: true, ownerId: true } } },
  });
  let isPublic = false;
  if (artwork) {
    isPublic = artwork.exhibition.status === "public";
    if (!isPublic) {
      const user = await getCurrentUser();
      if (!user || user.id !== artwork.exhibition.ownerId) {
        return NextResponse.json({ error: "Image not found." }, { status: 404 });
      }
    }
  } else {
    // Not attached to a saved artwork yet (just uploaded): only its
    // owner may see it, so the preview works right after upload.
    const user = await getCurrentUser();
    if (!user || user.id !== ownerId) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }
  }

  try {
    const object = await getR2Client().send(
      new GetObjectCommand({ Bucket: getR2Bucket(), Key: objectKey }),
    );
    if (!object.Body) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    const bytes = await object.Body.transformToByteArray();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": object.ContentType ?? CONTENT_TYPES[extension] ?? "application/octet-stream",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": isPublic ? "public, max-age=3600" : "private, no-store",
      },
    });
  } catch {
    return NextResponse.json({ error: "Image not found." }, { status: 404 });
  }
}
