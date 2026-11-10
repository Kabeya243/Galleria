import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getR2Bucket, getR2Client, isR2Configured } from "@/lib/r2";

export const runtime = "nodejs";

// Serve a file attached to an open-call response (GET
// /api/open-calls/files/open-calls/<slug>/<uuid>.<ext>). Owner only:
// the signed-in user must own the call the file belongs to. Applicants
// have no account and never get a link to this route — the public form
// only shows the file name after upload.
const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  avif: "image/avif",
  pdf: "application/pdf",
};

type RouteContext = { params: Promise<{ key: string[] }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { key } = await params;
  const objectKey = key.join("/");
  const match = /^open-calls\/([A-Za-z0-9-]+)\/([a-f0-9-]{36})\.(png|jpe?g|webp|avif|pdf)$/i.exec(objectKey);
  if (!match) return NextResponse.json({ error: "File not found." }, { status: 404 });
  const slug = match[1];
  const extension = match[3].toLowerCase();
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const call = await db.openCall.findUnique({ where: { slug }, select: { ownerId: true } });
  if (!call || call.ownerId !== user.id) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  if (!isR2Configured()) return NextResponse.json({ error: "File not found." }, { status: 404 });
  try {
    const object = await getR2Client().send(
      new GetObjectCommand({ Bucket: getR2Bucket(), Key: objectKey }),
    );
    if (!object.Body) return NextResponse.json({ error: "File not found." }, { status: 404 });
    const bytes = await object.Body.transformToByteArray();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": CONTENT_TYPES[extension] ?? "application/octet-stream",
        "Content-Disposition": `inline; filename="${objectKey.split("/").pop()}"`,
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
}
