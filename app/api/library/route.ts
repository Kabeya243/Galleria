import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listLibraryWorks } from "@/lib/library";

// The artist's own reusable library: every work they have ever
// uploaded, all exhibitions together. The read backfills from the
// artworks already hanging in their exhibitions (lib/library.ts), so
// works uploaded before the library existed show up on first visit.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your artworks." }, { status: 401 });
  const works = await listLibraryWorks(user.id);
  return NextResponse.json({ works });
}
