// Advanced website builder API — the owner's sites only.
// GET: list the signed-in user's sites (full documents, drafts included).
// POST: upsert one whole SiteDocument (draft autosave + publish).
// Every write is owner-scoped via getCurrentUser(); a slug owned by
// another user can never be taken (see saveAdvancedSite).

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { isSiteDocument, listAdvancedSites, saveAdvancedSite, siteDocumentFromDb } from "@/lib/advanced-sites";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to open your sites." }, { status: 401 });
  try {
    return NextResponse.json(await listAdvancedSites(user.id));
  } catch (error) {
    console.error("Could not list advanced sites", error);
    return NextResponse.json({ error: "Could not load your sites." }, { status: 503 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to save your site." }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "The request body must be valid JSON." }, { status: 400 });
  }
  if (!isSiteDocument(body) || body.pages.length === 0) {
    return NextResponse.json({ error: "The site sent is incomplete or invalid." }, { status: 400 });
  }
  try {
    const saved = await saveAdvancedSite(user.id, body);
    return NextResponse.json(siteDocumentFromDb(saved));
  } catch (error) {
    console.error("Could not save advanced site", error);
    const message = error instanceof Error ? error.message : "Save failed.";
    const status = message.includes("déjà utilisé") ? 409 : 503;
    return NextResponse.json({ error: message }, { status });
  }
}
