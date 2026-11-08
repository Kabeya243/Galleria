// Advanced website builder API — the 11 original templates.
// Read from the Template table; the table is seeded from the bundled
// definitions (lib/advanced-site-templates.ts) on first call, so the
// editor works even before any manual seed run. Authenticated: the
// editor page only.

import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getSiteTemplates } from "@/lib/advanced-sites";

export const runtime = "nodejs";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to open the editor." }, { status: 401 });
  try {
    return NextResponse.json(await getSiteTemplates());
  } catch (error) {
    console.error("Could not load site templates", error);
    return NextResponse.json({ error: "Could not load the templates." }, { status: 503 });
  }
}
