// Atelier templates API — the 8 built-in Atelier templates plus the
// user's own saved templates ("Mes modèles", stored in R2).
// The old SANAA PDF templates are gone (deleted 8 Nov 2026 on Kabeya's
// decision); nothing here references lib/pdf-templates.ts.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ATELIER_TEMPLATES, type AtelierDocument } from "@/lib/atelier-templates";
import { atelierTemplateKey, isR2Configured, r2Get, r2List, r2Put } from "@/lib/atelier-store";
import { isValidAtelierId, validateAtelierDocument } from "@/lib/atelier-validate";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ detail: "Connectez-vous pour voir les modèles." }, { status: 401 });
  const templates: AtelierDocument[] = [...ATELIER_TEMPLATES];
  if (isR2Configured()) {
    const entries = await r2List(`atelier/templates/${user.id}/`);
    for (const entry of entries) {
      if (!entry.key.endsWith(".json")) continue;
      const bytes = await r2Get(entry.key);
      if (!bytes) continue;
      try {
        const doc = JSON.parse(new TextDecoder().decode(bytes)) as AtelierDocument;
        if (doc && typeof doc.id === "string") templates.push(doc);
      } catch {
        // A corrupt user template is skipped, not fatal.
      }
    }
  }
  return NextResponse.json(templates);
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ detail: "Connectez-vous pour enregistrer un modèle." }, { status: 401 });
  if (!isR2Configured()) {
    return NextResponse.json({ detail: "Le stockage des modèles n’est pas configuré." }, { status: 501 });
  }
  let document: unknown;
  try {
    document = await request.json();
  } catch {
    return NextResponse.json({ detail: "Document invalide." }, { status: 422 });
  }
  const error = validateAtelierDocument(document);
  if (error) return NextResponse.json({ detail: error }, { status: 422 });
  const doc = document as AtelierDocument;
  if (!isValidAtelierId(doc.id)) {
    return NextResponse.json({ detail: "Identifiant de modèle invalide." }, { status: 400 });
  }
  const saved = { ...doc, category: "Mes modèles" };
  await r2Put(
    atelierTemplateKey(user.id, doc.id),
    JSON.stringify(saved, null, 2),
    "application/json",
  );
  return NextResponse.json({ id: doc.id, message: "Modèle enregistré." });
}
