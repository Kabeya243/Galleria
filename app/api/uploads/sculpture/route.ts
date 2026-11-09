import { randomUUID } from "node:crypto";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getR2Bucket, getR2Client, isR2Configured } from "@/lib/r2";
import { SCULPTURE_MAX_FILE_SIZE, SCULPTURE_MIME_TYPES } from "@/lib/sculpture";

export const runtime = "nodejs";

// Server-side sculpture upload to R2 (proxy): the small-file path. Same
// shape as the image, audio and video proxies (/api/uploads/r2,
// /api/uploads/audio, /api/uploads/video) with its own allowlist and
// prefix: GLB only, 4.5 MB max (Vercel's request-body cap), stored under
// sculptures/<userId>/<uuid>.glb and served same-origin from
// /api/sculpture/<key>. Heavier pieces go straight to R2 with a
// presigned PUT URL (/api/uploads/presign, 100 MB) and get the same
// serving URL.
const TOO_LARGE =
  "This sculpture is too large (over 4.5 MB). Try compressing it (Draco or meshopt in Blender, or gltfpack) or a simpler model.";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload a sculpture." }, { status: 401 });
  if (!isR2Configured()) {
    return NextResponse.json({ error: "Sculpture storage is not configured yet." }, { status: 501 });
  }

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > SCULPTURE_MAX_FILE_SIZE + 64_000) {
    return NextResponse.json({ error: TOO_LARGE }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Choose a sculpture file to upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose a sculpture file." }, { status: 400 });
  const name = file.name.toLowerCase();
  if (!name.endsWith(".glb")) {
    return NextResponse.json({ error: "Upload a .glb file. A .gltf file cannot be stored on its own. Re-export it as .glb in Blender." }, { status: 415 });
  }
  const contentType = file.type.toLowerCase();
  const extension = SCULPTURE_MIME_TYPES[contentType];
  if (!extension) {
    return NextResponse.json({ error: "Upload a .glb file." }, { status: 415 });
  }
  if (file.size === 0 || file.size > SCULPTURE_MAX_FILE_SIZE) {
    return NextResponse.json({ error: TOO_LARGE }, { status: 413 });
  }
  // A GLB file starts with the magic bytes "glTF" — reject anything
  // else wearing a .glb name before it reaches R2 or the loader.
  const head = new Uint8Array(await file.slice(0, 4).arrayBuffer());
  if (head.length < 4 || head[0] !== 0x67 || head[1] !== 0x6c || head[2] !== 0x54 || head[3] !== 0x46) {
    return NextResponse.json({ error: "This file is not a valid .glb (it does not start with the glTF header)." }, { status: 415 });
  }

  const key = `sculptures/${user.id}/${randomUUID()}.glb`;
  const buffer = new Uint8Array(await file.arrayBuffer());
  try {
    await getR2Client().send(
      new PutObjectCommand({ Bucket: getR2Bucket(), Key: key, ContentType: "model/gltf-binary", Body: buffer }),
    );
  } catch (error) {
    console.error("Could not upload sculpture to R2.", error);
    return NextResponse.json({ error: "Could not upload this sculpture." }, { status: 502 });
  }
  // Same-origin serving URL, not the raw R2 public URL: the bucket has
  // no CORS policy, so the raw URL is unreliable from the browser —
  // and GLTFLoader fetches the file, which needs the same origin (or
  // CORS headers) to read it at all.
  return NextResponse.json({ url: `/api/sculpture/${key}`, key }, { status: 200 });
}
