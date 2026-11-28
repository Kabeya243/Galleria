import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listLibraryWorks, stringifyTags, upsertLibraryWorks } from "@/lib/library";

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
  // Tags kept by the artist in the form (AI tag tool): an array of
  // short strings, normalised to lowercase and de-duplicated, stored
  // as a JSON string like palette.
  const rawTags = Array.isArray(data.tags) ? data.tags : [];
  const tags = rawTags
    .filter((tag): tag is string => typeof tag === "string")
    .map((tag) => tag.trim().toLowerCase())
    .filter((tag) => tag.length > 0 && tag.length <= 40)
    .slice(0, 20);
  const uniqueTags = [...new Set(tags)];
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
      tags: uniqueTags,
    },
  ]);
  const works = await listLibraryWorks(user.id);
  const work = works.find((item) => item.imageUrl === imageUrl) ?? null;
  if (!work) return NextResponse.json({ error: "Could not save this artwork." }, { status: 500 });
  // The library upsert is create-only (an existing row is never
  // overwritten from a copy), so a re-save of a work that is already
  // in the library would silently drop the tags just chosen: write
  // them explicitly here when any were kept.
  if (uniqueTags.length > 0) {
    await db.libraryWork.update({ where: { id: work.id }, data: { tags: stringifyTags(uniqueTags) } });
    const updated = (await listLibraryWorks(user.id)).find((item) => item.id === work.id) ?? work;
    return NextResponse.json({ work: updated }, { status: 201 });
  }
  return NextResponse.json({ work }, { status: 201 });
}
