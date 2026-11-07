// Single Atelier template — built-in first, then the user's own
// saved templates in R2.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { atelierTemplateById } from "@/lib/atelier-templates";
import { atelierTemplateKey, isR2Configured, r2Get } from "@/lib/atelier-store";
import { isValidAtelierId } from "@/lib/atelier-validate";

export const runtime = "nodejs";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ detail: "Connectez-vous pour voir les modèles." }, { status: 401 });
  const { id } = await params;
  if (!isValidAtelierId(id)) {
    return NextResponse.json({ detail: "Identifiant de modèle invalide." }, { status: 400 });
  }
  const builtIn = atelierTemplateById(id);
  if (builtIn) return NextResponse.json(builtIn);
  if (isR2Configured()) {
    const bytes = await r2Get(atelierTemplateKey(user.id, id));
    if (bytes) {
      try {
        return NextResponse.json(JSON.parse(new TextDecoder().decode(bytes)));
      } catch {
        return NextResponse.json({ detail: "Le modèle est illisible." }, { status: 500 });
      }
    }
  }
  return NextResponse.json({ detail: "Modèle introuvable." }, { status: 404 });
}
