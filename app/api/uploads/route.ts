import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import sharp, { type Metadata } from "sharp";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 8 * 1024 * 1024;
const allowedMimeTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/avif",
  "image/heic",
  "image/heif",
]);
const allowedExtensions = new Set(["png", "jpg", "jpeg", "webp", "avif", "heic", "heif"]);

function detectImageType(bytes: Uint8Array) {
  if (bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)) return "png";
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpg";
  if (
    bytes.length >= 12 &&
    String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
    String.fromCharCode(...bytes.slice(8, 12)) === "WEBP"
  ) return "webp";
  if (bytes.length >= 16 && String.fromCharCode(...bytes.slice(4, 8)) === "ftyp") {
    const ftyp = String.fromCharCode(...bytes.slice(8, 16)).replace(/\0+$/, "");
    if (["avif", "avis", "heic", "heix", "hevc", "hevx", "heim", "heis", "mif1", "msf1", "heif", "heif"].includes(ftyp)) return "avif";
  }
  return null;
}

function isAllowedImageFile(file: File) {
  const mimeType = file.type.toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return allowedMimeTypes.has(mimeType) || allowedExtensions.has(extension);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to upload artwork." }, { status: 401 });

  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE + 64_000) {
    return NextResponse.json({ error: "Images must be smaller than 8 MB." }, { status: 413 });
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Choose an image file." }, { status: 400 });
  if (!isAllowedImageFile(file)) {
    return NextResponse.json({ error: "Upload a valid PNG, JPEG, WebP, AVIF, HEIC or HEIF image." }, { status: 415 });
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Images must be smaller than 8 MB." }, { status: 413 });
  }

  const buffer = new Uint8Array(await file.arrayBuffer());
  if (!detectImageType(buffer)) {
    return NextResponse.json({ error: "Upload a valid PNG, JPEG, WebP, AVIF, HEIC or HEIF image." }, { status: 415 });
  }

  const image = sharp(buffer, { limitInputPixels: 40_000_000, failOn: "warning" });
  let metadata: Metadata;
  try {
    metadata = await image.metadata();
  } catch (error) {
    console.warn("Rejected an invalid image upload.", error);
    return NextResponse.json({ error: "This image file could not be decoded." }, { status: 415 });
  }
  if (!metadata.width || !metadata.height || (metadata.pages ?? 1) > 1) {
    return NextResponse.json({ error: "Upload a single-frame image with valid dimensions." }, { status: 415 });
  }
  if (metadata.width * metadata.height > 40_000_000) {
    return NextResponse.json({ error: "Images must be smaller than 40 megapixels." }, { status: 413 });
  }

  let optimized: Buffer;
  try {
    optimized = await image
      .rotate()
      .resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 85, effort: 4 })
      .toBuffer();
  } catch (error) {
    console.error("Could not optimize uploaded image.", error);
    return NextResponse.json({ error: "Could not process this image." }, { status: 500 });
  }

  // Stored in the database, not on disk: Vercel's filesystem is read-only
  // at runtime, so writing to data/uploads threw and the route answered
  // with an empty 500 (the "Unexpected end of JSON input" error).
  const id = randomUUID();
  const filename = `${id}.webp`;
  try {
    await db.upload.create({
      data: { id, data: Buffer.from(optimized), mimeType: "image/webp", ownerId: user.id },
    });
  } catch (error) {
    console.error("Could not save uploaded image.", error);
    return NextResponse.json({ error: "Could not save this image." }, { status: 500 });
  }
  return NextResponse.json({ url: `/api/uploads/${filename}` }, { status: 201 });
}
