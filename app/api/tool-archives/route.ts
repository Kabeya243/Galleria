// Tool-document archive API — the R2 file copy behind the document
// tools' database saves (see lib/tool-archive.ts).
//
// Mirrors the Atelier projects route (app/api/atelier/projects/route.ts):
// same R2 bucket, same user-scoped keys, nothing on local disk. The
// database row in /api/saved-work stays the source of truth for the
// on-screen lists; this route only stores / removes the JSON archive
// file. GET lists which archive ids exist for one kind, so a tool can
// show an honest "archived in your account" badge.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isR2Configured, r2Delete, r2List, r2Put } from "@/lib/atelier-store";

export const runtime = "nodejs";

const KINDS = ["certificate", "presentation", "exhibition-plan", "marketing-asset", "print-job", "context-project"] as const;
type ArchiveKind = (typeof KINDS)[number];

function archiveKey(kind: ArchiveKind, userId: string, id: string): string {
  // Certificates get the dedicated prefix Kabeya asked for; the other
  // document tools share one prefix, split by kind.
  return kind === "certificate" ? `certificates/${userId}/${id}.json` : `tool-archives/${kind}/${userId}/${id}.json`;
}

function archivePrefix(kind: ArchiveKind, userId: string): string {
  return kind === "certificate" ? `certificates/${userId}/` : `tool-archives/${kind}/${userId}/`;
}

function isValidId(id: unknown): id is string {
  return typeof id === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(id);
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ detail: "Connectez-vous pour voir vos archives." }, { status: 401 });
  const kind = new URL(request.url).searchParams.get("kind");
  if (!kind || !(KINDS as readonly string[]).includes(kind)) {
    return NextResponse.json({ detail: "Type d’archive invalide." }, { status: 400 });
  }
  if (!isR2Configured()) return NextResponse.json({ ids: [], configured: false });
  const entries = await r2List(archivePrefix(kind as ArchiveKind, user.id));
  const ids = entries
    .filter((entry) => entry.key.endsWith(".json"))
    .map((entry) => entry.key.split("/").pop()?.replace(/\.json$/, "") ?? "")
    .filter(Boolean);
  return NextResponse.json({ ids, configured: true });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ detail: "Connectez-vous pour archiver." }, { status: 401 });
  if (!isR2Configured()) {
    return NextResponse.json({ detail: "Le stockage des archives n’est pas configuré." }, { status: 501 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ detail: "Document invalide." }, { status: 422 });
  }
  const { kind, id, data } = (body ?? {}) as { kind?: unknown; id?: unknown; data?: unknown };
  if (!kind || !(KINDS as readonly string[]).includes(kind as string)) {
    return NextResponse.json({ detail: "Type d’archive invalide." }, { status: 400 });
  }
  if (!isValidId(id)) {
    return NextResponse.json({ detail: "Identifiant d’archive invalide." }, { status: 400 });
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return NextResponse.json({ detail: "Document invalide." }, { status: 422 });
  }
  const payload = JSON.stringify({ ...(data as Record<string, unknown>), archivedAt: new Date().toISOString() }, null, 2);
  if (payload.length > 2_000_000) {
    return NextResponse.json({ detail: "Document trop volumineux pour l’archive." }, { status: 413 });
  }
  await r2Put(archiveKey(kind as ArchiveKind, user.id, id as string), payload, "application/json");
  return NextResponse.json({ ok: true, key: archiveKey(kind as ArchiveKind, user.id, id as string) });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ detail: "Connectez-vous pour supprimer une archive." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const kind = params.get("kind");
  const id = params.get("id");
  if (!kind || !(KINDS as readonly string[]).includes(kind) || !isValidId(id)) {
    return NextResponse.json({ detail: "Archive invalide." }, { status: 400 });
  }
  if (!isR2Configured()) return NextResponse.json({ ok: true, configured: false });
  await r2Delete(archiveKey(kind as ArchiveKind, user.id, id as string));
  return NextResponse.json({ ok: true });
}
