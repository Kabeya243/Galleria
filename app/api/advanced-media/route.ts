// Advanced website builder — media upload to R2 (never local disk).
// POST: one JPG/PNG/WebP image (max 4.5 MB — the Vercel request-body
// cap, same as /api/uploads/r2). Stored as sites/<userId>/<uuid>.<ext>
// in the « sanaa » bucket and recorded as a Media row on the given
// site (siteId must belong to the signed-in user). The returned URL is
// /api/site-media/<key>: that route serves the file to anyone when the
// site is published, and to the owner only while it is a draft.
// GET: the signed-in user's media library (newest first).

import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getR2Bucket, getR2Client, isR2Configured } from "@/lib/r2";

export const runtime = "nodejs";
export const maxDuration = 30;

const MAX_FILE_SIZE = 4_500_000;
const extensions: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
};

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to open your media." }, { status: 401 });
  const siteId = new URL(request.url).searchParams.get("siteId");
  const where = siteId ? { site: { id: siteId, userId: user.id } } : { site: { userId: user.id } };
  const rows = await db.media.findMany({ where, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json(rows.map((row) => ({ url: row.url, name: row.name, siteId: row.siteId })));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload an image." }, { status: 401 });
  if (!isR2Configured()) {
    return NextResponse.json({ error: "Image storage is not configured yet." }, { status: 501 });
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE + 64_000) {
    return NextResponse.json({ error: "The image is too large (over 4.5 MB)." }, { status: 413 });
  }
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json({ error: "The upload form is invalid." }, { status: 400 });
  }
  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  const extension = extensions[file.type];
  if (!extension) {
    return NextResponse.json({ error: "Accepted formats: JPG, PNG and WebP." }, { status: 415 });
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "The image is too large (over 4.5 MB)." }, { status: 413 });
  }
  const siteId = form.get("siteId");
  let site: { id: string } | null = null;
  if (typeof siteId === "string" && siteId) {
    site = await db.site.findFirst({ where: { id: siteId, userId: user.id }, select: { id: true } });
    if (!site) return NextResponse.json({ error: "Site not found." }, { status: 404 });
  }
  const key = `sites/${user.id}/${randomUUID()}${extension}`;
  try {
    await getR2Client().send(
      new PutObjectCommand({ Bucket: getR2Bucket(), Key: key, ContentType: file.type, Body: new Uint8Array(await file.arrayBuffer()) }),
    );
  } catch (error) {
    console.error("Could not upload site image to R2.", error);
    return NextResponse.json({ error: "The image could not be saved." }, { status: 502 });
  }
  const url = `/api/site-media/${key}`;
  if (site) {
    await db.media.create({ data: { url, name: file.name, mimeType: file.type, size: file.size, siteId: site.id } });
  }
  return NextResponse.json({ url, name: file.name, size: file.size });
}
