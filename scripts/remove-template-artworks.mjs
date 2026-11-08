// Removes the fictitious/placeholder artworks that were seeded into
// exhibitions before Chantier 6 (Nov 2026) — the "Template artwork"
// and Sunlight "Placeholder artwork" rows created by
// lib/template-artworks.ts / seedSunlightArtworks, plus the copies the
// editor migration added on load.
//
// WHAT IT DELETES (and nothing else)
//   - Artwork rows whose description is exactly one of the two template
//     markers below. Those rows are unambiguous: no real artwork ever
//     carried those descriptions, and the code that created them is
//     gone, so nothing will re-seed them.
//   - It never deletes exhibitions, users, rooms, or any artwork with
//     another description (real works stay, even in the same rooms).
//   - Rooms whose saved JSON still contains "templateArtSeeded": true
//     need no rewrite: the field is gone from the schema and the
//     parser ignores it.
//
// RUN IT (from ~/workspace/galleria, against the PRODUCTION database):
//   node --env-file=.env scripts/remove-template-artworks.mjs           (dry run)
//   node --env-file=.env scripts/remove-template-artworks.mjs --confirm (delete)
//
// PREREQUISITES
//   - DATABASE_URL must be set (via .env). The script refuses to run
//     without it and never guesses a database. (The .env on the dev VM
//     does not carry a direct postgres URL — run this where the
//     production DATABASE_URL lives, e.g. Vercel or a machine with it.)
//
// SAFETY
//   - Dry run by default: counts and lists what would be deleted, then
//     stops. Deletion needs the explicit --confirm flag.
//   - Prints the affected exhibitions (id, title, status) before and
//     after, so the result can be checked in the editor.

import { PrismaClient } from "@prisma/client";

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error(
    "DATABASE_URL is not set. Run the script with the database you want to clean, e.g.:\n" +
      "  node --env-file=.env scripts/remove-template-artworks.mjs\n" +
      "The script never guesses a database and will not run without one.",
  );
  process.exit(1);
}

const db = new PrismaClient();

const TEMPLATE_DESCRIPTIONS = [
  "Template artwork from the gallery — replace it with your own work.",
  "Placeholder artwork from the Sunlight Gallery template — replace it with your own work.",
];

const confirm = process.argv.includes("--confirm");

async function main() {
  const rows = await db.artwork.findMany({
    where: { description: { in: TEMPLATE_DESCRIPTIONS } },
    select: { id: true, title: true, description: true, exhibitionId: true, imageUrl: true },
    orderBy: { createdAt: "asc" },
  });
  const exhibitionIds = [...new Set(rows.map((row) => row.exhibitionId))];
  const exhibitions = exhibitionIds.length
    ? await db.exhibition.findMany({
        where: { id: { in: exhibitionIds } },
        select: { id: true, title: true, status: true, slug: true },
      })
    : [];
  const byTitle = new Map();
  for (const row of rows) byTitle.set(row.title, (byTitle.get(row.title) ?? 0) + 1);

  console.log(`\nTemplate artworks in the database: ${rows.length}`);
  for (const [title, count] of [...byTitle.entries()].sort()) {
    console.log(`  ${count}× ${title}`);
  }
  console.log(`Affected exhibitions: ${exhibitions.length}`);
  for (const exhibition of exhibitions) {
    console.log(`  - "${exhibition.title}" (${exhibition.id}, status "${exhibition.status}", slug ${exhibition.slug})`);
  }
  const bundled = rows.filter((row) => row.imageUrl?.startsWith("/artworks/")).length;
  console.log(`Rows pointing at the removed bundled images (/artworks/...): ${bundled}`);

  if (rows.length === 0) {
    console.log("Nothing to delete.");
    return;
  }
  if (!confirm) {
    console.log("\nDry run — nothing was deleted. Re-run with --confirm to delete these rows.");
    return;
  }
  const deleted = await db.artwork.deleteMany({ where: { description: { in: TEMPLATE_DESCRIPTIONS } } });
  console.log(`\nDeleted ${deleted.count} template artwork rows. Exhibitions and real artworks untouched.`);
}

main()
  .catch((error) => {
    console.error("Could not remove the template artworks.", error);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
