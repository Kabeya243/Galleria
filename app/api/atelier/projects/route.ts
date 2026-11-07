// Atelier projects API — list and save design documents in R2.
// Projects live at atelier/projects/<userId>/<id>.json with a JPEG
// thumbnail at atelier/projects/<userId>/<id>.jpg (sent by the editor
// as a small canvas snapshot). Nothing touches local disk.

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  atelierFileUrl,
  atelierProjectKey,
  atelierProjectThumbKey,
  isR2Configured,
  r2Get,
  r2List,
  r2Put,
} from "@/lib/atelier-store";
import { isValidAtelierId, validateAtelierDocument } from "@/lib/atelier-validate";
import type { AtelierDocument } from "@/lib/atelier-templates";

export const runtime = "nodejs";

const MAX_THUMBNAIL_BYTES = 400_000;

function decodeThumbnail(dataUrl: unknown): Uint8Array | null {
  if (typeof dataUrl !== "string") return null;
  const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl);
  if (!match) return null;
  try {
    const bytes = Buffer.from(match[1], "base64");
    return bytes.length > 0 && bytes.length <= MAX_THUMBNAIL_BYTES ? new Uint8Array(bytes) : null;
  } catch {
    return null;
  }
}

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ detail: "Connectez-vous pour voir vos designs." }, { status: 401 });
  if (!isR2Configured()) return NextResponse.json([]);
  const entries = await r2List(`atelier/projects/${user.id}/`);
  const projects: { id: string; name: string; updatedAt: string | null; thumbnail: string | null }[] = [];
  for (const entry of entries) {
    if (!entry.key.endsWith(".json")) continue;
    const bytes = await r2Get(entry.key);
    if (!bytes) continue;
    try {
      const doc = JSON.parse(new TextDecoder().decode(bytes)) as AtelierDocument & { updatedAt?: string };
      const id = entry.key.split("/").pop()?.replace(/\.json$/, "") ?? "";
      const thumbKey = atelierProjectThumbKey(user.id, id);
      const hasThumb = entries.some((e) => e.key === thumbKey);
      projects.push({
        id,
        name: doc.name || "Design sans titre",
        updatedAt: doc.updatedAt ?? null,
        thumbnail: hasThumb ? atelierFileUrl(thumbKey) : null,
      });
    } catch {
      // A corrupt project is skipped, not fatal.
    }
  }
  projects.sort((a, b) => (b.updatedAt ?? "").localeCompare(a.updatedAt ?? ""));
  return NextResponse.json(projects);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ detail: "Connectez-vous pour enregistrer." }, { status: 401 });
  if (!isR2Configured()) {
    return NextResponse.json({ detail: "Le stockage des designs n’est pas configuré." }, { status: 501 });
  }
  let document: unknown;
  try {
    document = await request.json();
  } catch {
    return NextResponse.json({ detail: "Document invalide." }, { status: 422 });
  }
  const error = validateAtelierDocument(document);
  if (error) return NextResponse.json({ detail: error }, { status: 422 });
  const doc = document as AtelierDocument & { updatedAt?: string; thumbnail?: string; thumbnailDataUrl?: string };
  const projectId = doc.id && isValidAtelierId(doc.id) ? doc.id : randomUUID();
  const saved = {
    ...doc,
    id: projectId,
    updatedAt: new Date().toISOString(),
    name: doc.name?.trim() ? doc.name : "Design sans titre",
    thumbnail: atelierFileUrl(atelierProjectThumbKey(user.id, projectId)),
  };
  delete (saved as Record<string, unknown>).thumbnailDataUrl;
  await r2Put(atelierProjectKey(user.id, projectId), JSON.stringify(saved, null, 2), "application/json");
  const thumb = decodeThumbnail(doc.thumbnailDataUrl);
  if (thumb) {
    await r2Put(atelierProjectThumbKey(user.id, projectId), thumb, "image/jpeg");
  }
  return NextResponse.json(saved);
}
