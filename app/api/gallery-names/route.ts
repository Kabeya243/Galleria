import { NextResponse } from "next/server";
import { getGalleryNames } from "@/lib/gallery-names-server";

// Public gallery names (English + French, admin overrides included):
// GET /api/gallery-names -> { names: { <layout>: { en, fr } } }.
export async function GET() {
  return NextResponse.json({ names: await getGalleryNames() });
}
