// Atelier uploads API — images the editor can place on the canvas.
// Files go to R2 at atelier/uploads/<userId>/<uuid>.<ext> (never local
// disk). SVG uploads get the same safety checks as the Atelier project
// (no scripts, entities or external references, must parse as SVG).
// Vercel caps the proxied request body at 4.5 MB, so uploads above
// that are refused with a clear message — same limit as the existing
// /api/uploads/r2 artwork route.

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { atelierFileUrl, atelierUploadKey, isR2Configured, r2List, r2Put } from "@/lib/atelier-store";

export const runtime = "nodejs";

const MAX_FILE_SIZE = 4_500_000;
const EXTENSIONS: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/svg+xml": "svg",
};
const UNSAFE_SVG = /<!DOCTYPE|<!ENTITY|<\s*script|on\w+\s*=|(?:href|src)\s*=\s*['"](?!#)|url\(\s*['"]?(?:https?:|\/\/|file:|javascript:)/i;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ detail: "Connectez-vous pour voir vos images." }, { status: 401 });
  if (!isR2Configured()) return NextResponse.json([]);
  const entries = await r2List(`atelier/uploads/${user.id}/`);
  const files = entries
    .filter((e) => /\.(jpe?g|png|webp|svg)$/i.test(e.key))
    .sort((a, b) => (b.lastModified?.getTime() ?? 0) - (a.lastModified?.getTime() ?? 0))
    .map((e) => ({
      name: e.key.split("/").pop() ?? e.key,
      url: atelierFileUrl(e.key),
      thumbnail: atelierFileUrl(e.key),
    }));
  return NextResponse.json(files);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ detail: "Connectez-vous pour importer une image." }, { status: 401 });
  if (!isR2Configured()) {
    return NextResponse.json({ detail: "Le stockage des images n’est pas configuré." }, { status: 501 });
  }
  const contentLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > MAX_FILE_SIZE + 64_000) {
    return NextResponse.json(
      { detail: "L’image dépasse la limite de 4,5 Mo (limite Vercel sur l’envoi). Essayez un fichier plus petit." },
      { status: 413 },
    );
  }
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ detail: "Choisissez un fichier image." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File)) return NextResponse.json({ detail: "Choisissez un fichier image." }, { status: 400 });
  const contentType = file.type.toLowerCase();
  const extension = EXTENSIONS[contentType];
  if (!extension) {
    return NextResponse.json({ detail: "Formats acceptés : JPG, PNG, WebP et SVG." }, { status: 415 });
  }
  if (file.size === 0 || file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { detail: "L’image dépasse la limite de 4,5 Mo (limite Vercel sur l’envoi). Essayez un fichier plus petit." },
      { status: 413 },
    );
  }
  const bytes = new Uint8Array(await file.arrayBuffer());
  const fileName = `${randomUUID().replace(/-/g, "")}.${extension}`;
  if (extension === "svg") {
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    } catch {
      return NextResponse.json({ detail: "Ce fichier SVG est invalide." }, { status: 415 });
    }
    if (UNSAFE_SVG.test(text) || !/<svg[\s>]/i.test(text)) {
      return NextResponse.json({ detail: "SVG non sécurisé ou invalide." }, { status: 415 });
    }
  }
  const key = atelierUploadKey(user.id, fileName);
  try {
    await r2Put(key, bytes, extension === "svg" ? "image/svg+xml" : contentType);
  } catch (error) {
    console.error("Could not upload Atelier image to R2.", error);
    return NextResponse.json({ detail: "Impossible d’importer cette image." }, { status: 502 });
  }
  const url = atelierFileUrl(key);
  return NextResponse.json({ name: fileName, url, thumbnail: url });
}
