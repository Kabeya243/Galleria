// Serve an advanced-site image from R2, same-origin (no CORS needed).
// Public when the image belongs to a PUBLISHED site (a Media row whose
// site is published); otherwise only the site owner may see it, so the
// editor preview works right after upload, before publishing.
// Mirrors the access logic of /api/r2/[...key], scoped to the
// sites/<userId>/<uuid>.<ext> keys written by /api/advanced-media.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getR2Client, getR2Bucket, isR2Configured } from "@/lib/r2";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
};

type RouteContext = { params: Promise<{ key: string[] }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { key } = await params;
  const objectKey = key.join("/");
  const match = /^sites\/([A-Za-z0-9_-]+)\/([a-f0-9-]{36})\.(png|jpe?g|webp)$/i.exec(objectKey);
  if (!match) return NextResponse.json({ error: "Image not found." }, { status: 404 });
  if (!isR2Configured()) return NextResponse.json({ error: "Image not found." }, { status: 404 });

  const servingUrl = `/api/site-media/${objectKey}`;
  const media = await db.media.findFirst({
    where: { url: servingUrl },
    select: { site: { select: { published: true, userId: true } } },
  });
  let isPublic = false;
  if (media) {
    isPublic = media.site.published;
    if (!isPublic) {
      const user = await getCurrentUser();
      if (!user || user.id !== media.site.userId) {
        return NextResponse.json({ error: "Image not found." }, { status: 404 });
      }
    }
  } else {
    // Uploaded but not yet attached to a saved site: owner only.
    const user = await getCurrentUser();
    if (!user || user.id !== match[1]) {
      return NextResponse.json({ error: "Image not found." }, { status: 404 });
    }
  }

  try {
    const object = await getR2Client().send(new GetObjectCommand({ Bucket: getR2Bucket(), Key: objectKey }));
    if (!object.Body) return NextResponse.json({ error: "Image not found." }, { status: 404 });
    const bytes = await object.Body.transformToByteArray();
    const extension = match[3].toLowerCase();
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
