// Seed the 11 advanced website-builder templates into PostgreSQL.
//   node scripts/seed-site-templates.mjs
//
// Upserts only (never deletes): safe to re-run, safe on a database that
// already holds sites. Needs a real DATABASE_URL — on this VM the .env
// value is a placeholder, so run it where the production DATABASE_URL
// lives (or rely on the self-seed: GET /api/site-templates upserts the
// same 11 definitions on first call, and the advanced editor page does
// the same when it loads).
//
// The definitions live in lib/advanced-site-templates.ts (type-only
// imports, no runtime dependencies), so Node's built-in type stripping
// can import it directly — no tsx, no build step.

import { PrismaClient } from "@prisma/client";
import { templates } from "../lib/advanced-site-templates.ts";

const db = new PrismaClient();

async function main() {
  for (const template of templates) {
    await db.template.upsert({
      where: { id: template.id },
      create: {
        id: template.id,
        name: template.name,
        category: template.category,
        definition: template,
      },
      update: {
        name: template.name,
        category: template.category,
        definition: template,
      },
    });
    console.log(`seeded template ${template.id} (${template.name})`);
  }
  console.log(`Done: ${templates.length} templates.`);
}

main()
  .catch((error) => {
    console.error("Template seed failed", error);
    process.exitCode = 1;
  })
  .finally(async () => db.$disconnect());
