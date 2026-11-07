// Single Atelier project — open, delete, duplicate. Keys are always
// namespaced by the signed-in user's id, so a user can only ever
// address their own projects.

import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  atelierFileUrl,
  atelierProjectKey,
  atelierProjectThumbKey,
  isR2Configured,
  r2Delete,
  r2Get,
  r2Put,
} from "@/lib/atelier-store";
import { isValidAtelierId } from "@/lib/atelier-validate";
import type { AtelierDocument } from "@/lib/atelier-templates";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

function notConfigured() {
  return NextResponse.json({ detail: "Le stockage des designs n’est pas configuré." }, { status: 501 });
}

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ detail: "Connectez-vous pour ouvrir ce design." }, { status: 401 });
  const { id } = await params;
  if (!isValidAtelierId(id)) {
    return NextResponse.json({ detail: "Identifiant de projet invalide." }, { status: 400 });
  }
  if (!isR2Configured()) return notConfigured();
  const bytes = await r2Get(atelierProjectKey(user.id, id));
  if (!bytes) return NextResponse.json({ detail: "Projet introuvable." }, { status: 404 });
  try {
    return NextResponse.json(JSON.parse(new TextDecoder().decode(bytes)));
  } catch {
    return NextResponse.json({ detail: "Le fichier de projet est illisible." }, { status: 500 });
  }
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ detail: "Connectez-vous pour supprimer ce design." }, { status: 401 });
  const { id } = await params;
  if (!isValidAtelierId(id)) {
    return NextResponse.json({ detail: "Identifiant de projet invalide." }, { status: 400 });
  }
  if (!isR2Configured()) return notConfigured();
  const bytes = await r2Get(atelierProjectKey(user.id, id));
  if (!bytes) return NextResponse.json({ detail: "Projet introuvable." }, { status: 404 });
  await r2Delete(atelierProjectKey(user.id, id));
  await r2Delete(atelierProjectThumbKey(user.id, id));
  return NextResponse.json({ message: "Projet supprimé." });
}

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ detail: "Connectez-vous pour dupliquer ce design." }, { status: 401 });
  const { id } = await params;
  if (!isValidAtelierId(id)) {
    return NextResponse.json({ detail: "Identifiant de projet invalide." }, { status: 400 });
  }
  if (!isR2Configured()) return notConfigured();
  let body: { action?: string } = {};
  try {
    body = (await request.json()) as { action?: string };
  } catch {
    body = {};
  }
  if (body.action !== "duplicate") {
    return NextResponse.json({ detail: "Action non prise en charge." }, { status: 400 });
  }
  const bytes = await r2Get(atelierProjectKey(user.id, id));
  if (!bytes) return NextResponse.json({ detail: "Projet introuvable." }, { status: 404 });
  let document: AtelierDocument & { updatedAt?: string; thumbnail?: string };
  try {
    document = JSON.parse(new TextDecoder().decode(bytes)) as AtelierDocument & { updatedAt?: string; thumbnail?: string };
  } catch {
    return NextResponse.json({ detail: "Le fichier de projet est illisible." }, { status: 500 });
  }
  const copyId = randomUUID();
  const copy = {
    ...document,
    id: copyId,
    name: `${document.name || "Design"} — copie`,
    updatedAt: new Date().toISOString(),
    thumbnail: atelierFileUrl(atelierProjectThumbKey(user.id, copyId)),
  };
  await r2Put(atelierProjectKey(user.id, copyId), JSON.stringify(copy, null, 2), "application/json");
  const thumb = await r2Get(atelierProjectThumbKey(user.id, id));
  if (thumb) await r2Put(atelierProjectThumbKey(user.id, copyId), thumb, "image/jpeg");
  return NextResponse.json(copy);
}
