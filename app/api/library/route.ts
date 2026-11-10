import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { listLibraryWorks, upsertLibraryWorks } from "@/lib/library";

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

// Add one artwork straight into the central library ("Mes œuvres"),
// without going through an exhibition first. The work is then
// available everywhere that reads the library: the editor's picker,
// the certificate artwork list, the PDF editor's image tab. One
// canonical row per media URL (see lib/library.ts): adding the same
// image twice does not duplicate it.
export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to add an artwork." }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid artwork details." }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  const clean = (value: unknown, max = 500): string =>
    typeof value === "string" ? value.trim().slice(0, max) : "";
  const title = clean(data.title, 200);
  const imageUrl = clean(data.imageUrl, 2000);
  if (!title) return NextResponse.json({ error: "A title is required." }, { status: 400 });
  if (!imageUrl) return NextResponse.json({ error: "An image is required." }, { status: 400 });
  await upsertLibraryWorks(user.id, [
    {
      title,
      artist: clean(data.artist, 200) || user.name,
      year: clean(data.year, 20),
      medium: clean(data.medium, 200),
      dimensions: clean(data.dimensions, 100),
      description: clean(data.description, 2000),
      imageUrl,
      frame: clean(data.frame, 200) || "wood",
    },
  ]);
  const works = await listLibraryWorks(user.id);
  const work = works.find((item) => item.imageUrl === imageUrl) ?? null;
  if (!work) return NextResponse.json({ error: "Could not save this artwork." }, { status: 500 });
  return NextResponse.json({ work }, { status: 201 });
}
