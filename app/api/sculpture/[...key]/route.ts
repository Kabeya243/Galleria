import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getR2Bucket, getR2Client, isR2Configured, r2PublicUrl } from "@/lib/r2";

export const runtime = "nodejs";

// Serve an R2-stored sculpture (GLB) same-origin. Same pattern as the
// image route (/api/r2/[...key]) with its own prefix and Content-Type,
// minus the Range support: GLTFLoader fetches the whole file in one
// request and never seeks inside it, so ranges buy nothing here.
// Access mirrors the images: a published exhibition's sculptures are
// open to anyone, otherwise only the owner may fetch them (a
// just-uploaded sculpture, not attached to a saved artwork yet, is
// only visible to the user whose id is in the key, so the editor
// preview works right after upload, before saving). A sculpture
// hanging in the reusable library but in no exhibition yet is covered
// by the same owner-only rule.
type RouteContext = { params: Promise<{ key: string[] }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const { key } = await params;
  const objectKey = key.join("/");
  const match = /^sculptures\/([A-Za-z0-9_-]+)\/([a-f0-9-]{36})\.glb$/i.exec(objectKey);
  if (!match) return NextResponse.json({ error: "Sculpture not found." }, { status: 404 });
  const ownerId = match[1];
  if (!isR2Configured()) return NextResponse.json({ error: "Sculpture not found." }, { status: 404 });

  const servingUrl = `/api/sculpture/${objectKey}`;
  const publicUrl = r2PublicUrl(objectKey);
  const artwork = await db.artwork.findFirst({
    where: { OR: [{ sculptureUrl: servingUrl }, { sculptureUrl: publicUrl }] },
    select: { exhibition: { select: { status: true, ownerId: true } } },
  });
  let isPublic = false;
  if (artwork) {
    isPublic = artwork.exhibition.status === "public";
    if (!isPublic) {
      const user = await getCurrentUser();
      if (!user || user.id !== artwork.exhibition.ownerId) {
        return NextResponse.json({ error: "Sculpture not found." }, { status: 404 });
      }
    }
  } else {
    // Not attached to a saved artwork yet (just uploaded, or only in
    // the library): only its owner may fetch it, so the editor preview
    // works right after upload, before saving.
    const user = await getCurrentUser();
    if (!user || user.id !== ownerId) {
      return NextResponse.json({ error: "Sculpture not found." }, { status: 404 });
    }
  }

  try {
    const object = await getR2Client().send(
      new GetObjectCommand({ Bucket: getR2Bucket(), Key: objectKey }),
    );
    if (!object.Body) return NextResponse.json({ error: "Sculpture not found." }, { status: 404 });
    const bytes = await object.Body.transformToByteArray();
    return new NextResponse(Buffer.from(bytes), {
      headers: {
        "Content-Type": "model/gltf-binary",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": isPublic ? "public, max-age=3600" : "private, no-store",
        "Content-Length": String(bytes.length),
      },
    });
  } catch {
    return NextResponse.json({ error: "Sculpture not found." }, { status: 404 });
  }
}
