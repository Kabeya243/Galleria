// Library tests — "Mes œuvres", the reusable artwork library
// (Nov 2026, Kabeya 8 Nov 11h26).
//
// Run: node scripts/test-library.mjs
//
// What it checks, code-level only (no database, no browser — same
// standing as scripts/test-exhibitions-all-galleries.mjs):
//   (a) the data model: LibraryWork exists, one row per
//       (owner, imageUrl), owned by the user;
//   (b) the reuse model is COPY, not share: the reuse path creates a
//       new Artwork row with the same imageUrl (no upload, no file
//       input) and a fresh placement, and deleting one copy from an
//       exhibition only ever removes that copy;
//   (c) the library stays current: the exhibition save (PUT) and the
//       single-artwork add (POST /api/artworks) record works in the
//       library, and the library read backfills from works already
//       hanging in the owner's exhibitions;
//   (d) the surfaces exist and are translated: sidebar entry
//       /artworks, the library page (search, reuse picker, two-step
//       delete), the editor's "from my works" picker, FR + EN keys
//       in lib/i18n.ts;
//   (e) no window.alert anywhere in the new or touched files
//       (inline errors only, standing rule).
//
// Exit 0 when every check passes, 1 otherwise. Prints one line per
// check. Visual rendering still needs a live browser session with a
// signed-in user.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");

const checks = [];
function check(id, name, fn) {
  try {
    const detail = fn();
    checks.push({ id, name, status: "pass", detail: String(detail ?? "") });
    console.log(`PASS  [library] ${name} — ${detail ?? ""}`);
  } catch (err) {
    checks.push({ id, name, status: "fail", detail: err instanceof Error ? err.message : String(err) });
    console.log(`FAIL  [library] ${name} — ${err instanceof Error ? err.message : err}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const exists = (p) => existsSync(join(ROOT, p));

// ---------- (a) Data model ----------
check("schema-model", "LibraryWork model exists, owner-scoped, one row per image", () => {
  const schema = read("prisma/schema.prisma");
  assert(schema.includes("model LibraryWork"), "schema.prisma has no LibraryWork model");
  assert(schema.includes("@@unique([ownerId, imageUrl])"), "LibraryWork needs @@unique([ownerId, imageUrl])");
  assert(schema.includes("libraryWorks LibraryWork[]"), "User has no libraryWorks relation");
  assert(schema.includes("imageUrl    String"), "LibraryWork.imageUrl must be a required String");
  return "model LibraryWork, @@unique([ownerId, imageUrl]), User.libraryWorks";
});

check("schema-artwork-untouched", "Artwork still belongs to exactly one exhibition", () => {
  const schema = read("prisma/schema.prisma");
  assert(schema.includes("exhibitionId String"), "Artwork.exhibitionId missing");
  assert(schema.includes("onDelete: Cascade"), "Artwork -> Exhibition cascade missing");
  return "Artwork.exhibitionId + Cascade unchanged: reuse must copy, not share";
});

// ---------- (b) Reuse is a copy, delete is scoped ----------
check("lib-copy", "Reuse copies the work: same imageUrl, fresh id and placement", () => {
  const src = read("lib/library.ts");
  for (const s of ["copyLibraryWorkToExhibition", "db.artwork.create", "imageUrl: work.imageUrl"]) {
    assert(src.includes(s), `lib/library.ts missing ${s}`);
  }
  assert(src.includes("positionX: 0"), "copy needs a fresh default placement");
  assert(!src.includes("FormData") && !src.includes("PutObjectCommand"), "reuse path must not upload anything");
  return "copyLibraryWorkToExhibition creates a new Artwork row, same imageUrl";
});

check("lib-delete", "Library delete removes the row AND its exhibition copies", () => {
  const src = read("lib/library.ts");
  assert(src.includes("deleteLibraryWorkAndCopies"), "lib/library.ts missing deleteLibraryWorkAndCopies");
  assert(src.includes("db.artwork.deleteMany"), "library delete must remove the hanging copies");
  assert(src.includes("where: { imageUrl: work.imageUrl, exhibition: { ownerId } }"), "copies are matched by imageUrl within the owner's exhibitions");
  assert(!src.includes("DeleteObject") && !src.includes("deleteObject"), "library delete must never delete the R2 file");
  return "row + copies by imageUrl; R2 file kept";
});

check("lib-exhibition-delete-untouched", "Removing one copy from an exhibition only removes that copy", () => {
  const src = read("app/api/artworks/[id]/route.ts");
  assert(src.includes("db.artwork.delete({ where: { id } })"), "exhibition copy delete must delete exactly that Artwork row");
  assert(!src.includes("libraryWork"), "exhibition copy delete must not touch the library");
  return "DELETE /api/artworks/[id] deletes one row only";
});

// ---------- (c) The library stays current ----------
check("lib-backfill", "Library read backfills from works already hanging", () => {
  const src = read("lib/library.ts");
  for (const s of ["ensureLibraryWorks", "listLibraryWorks", "db.libraryWork.upsert", "update: {}"]) {
    assert(src.includes(s), `lib/library.ts missing ${s}`);
  }
  assert(src.includes("imageUrl: { not: null }"), "backfill only covers works with an image");
  return "ensureLibraryWorks (create-only upsert) + listLibraryWorks";
});

check("api-save-hooks", "Exhibition save and single-artwork add record works in the library", () => {
  const put = read("app/api/exhibitions/[id]/route.ts");
  const post = read("app/api/artworks/route.ts");
  assert(put.includes("upsertLibraryWorks"), "PUT /api/exhibitions/[id] must upsert the library");
  assert(post.includes("upsertLibraryWorks"), "POST /api/artworks must upsert the library");
  return "PUT exhibitions + POST artworks call upsertLibraryWorks";
});

check("api-routes", "Library API routes exist with the right methods", () => {
  assert(exists("app/api/library/route.ts"), "missing app/api/library/route.ts");
  assert(exists("app/api/library/[id]/route.ts"), "missing app/api/library/[id]/route.ts");
  assert(exists("app/api/library/[id]/reuse/route.ts"), "missing app/api/library/[id]/reuse/route.ts");
  assert(read("app/api/library/route.ts").includes("export async function GET"), "GET /api/library missing");
  assert(read("app/api/library/[id]/route.ts").includes("export async function DELETE"), "DELETE /api/library/[id] missing");
  const reuse = read("app/api/library/[id]/reuse/route.ts");
  assert(reuse.includes("export async function POST"), "POST /api/library/[id]/reuse missing");
  assert(!reuse.includes("FormData"), "reuse must take no file upload");
  return "GET /api/library, DELETE /api/library/[id], POST /api/library/[id]/reuse";
});

// ---------- (d) Surfaces + translations ----------
check("sidebar", "Sidebar has a visible Mes œuvres entry", () => {
  const src = read("components/sidebar.tsx");
  assert(src.includes('href: "/artworks"'), "sidebar has no /artworks entry");
  assert(src.includes('label: "myArtworks"'), "sidebar entry must use the myArtworks label");
  assert(src.includes('artworks: "my-artworks"'), "sidebar active mapping for artworks missing");
  return "Create group → /artworks, label myArtworks";
});

check("library-page", "Library page: search, reuse picker, two-step delete", () => {
  assert(exists("app/artworks/page.tsx"), "missing app/artworks/page.tsx");
  const page = read("app/artworks/page.tsx");
  assert(page.includes("listLibraryWorks"), "page must list the library server-side");
  assert(exists("components/library-page.tsx"), "missing components/library-page.tsx");
  const src = read("components/library-page.tsx");
  for (const s of ["searchPlaceholder", "/reuse", "confirmingDeleteId", "deleteWarning", "addedTo"]) {
    assert(src.includes(s), `components/library-page.tsx missing ${s}`);
  }
  assert(src.includes('active="artworks"'), "library page must highlight the sidebar entry");
  return "/artworks + search + reuse + two-step delete with warning";
});

check("editor-picker", "Editor offers From my works next to the upload", () => {
  const src = read("components/editor.tsx");
  for (const s of ["addLibraryArtwork", "openLibraryPicker", "/api/library", "imageUrl: work.imageUrl"]) {
    assert(src.includes(s), `components/editor.tsx missing ${s}`);
  }
  assert(src.includes('t("library", "fromLibrary")'), "editor button must use the library label");
  return "picker fetches /api/library, adds a copy with the same imageUrl";
});

check("i18n", "FR + EN keys for the nav entry and the library section", () => {
  const src = read("lib/i18n.ts");
  const nav = src.slice(src.indexOf("nav: {"), src.indexOf("artwork: {"));
  assert(nav.includes('myArtworks: { fr: "Mes œuvres", en: "My artworks" }'), "nav.myArtworks missing or untranslated");
  const section = src.slice(src.indexOf("library: {"), src.indexOf("// Public creator wall"));
  assert(section.length > 500, "library i18n section missing");
  for (const key of [
    "yourLibrary", "copy", "searchPlaceholder", "noWorks", "noWorksDesc", "noMatch",
    "inExhibitions", "notInExhibition", "addToExhibition", "chooseExhibition", "addedTo",
    "delete", "clickAgainDelete", "deleteWarning", "couldNotLoad", "couldNotAdd",
    "couldNotDelete", "fromLibrary", "chooseFromLibrary", "libraryEmpty", "reuseHint",
  ]) {
    // Values may span lines: check the key opens a { fr: …, en: … } pair.
    assert(new RegExp(`\\b${key}: \\{[\\s\\S]{0,600}?fr: "[^"]+",[\\s\\S]{0,600}?en: "[^"]+"`).test(section), `library.${key} missing or untranslated`);
  }
  return "nav.myArtworks + 21 library keys, FR + EN";
});

// ---------- (e) No window.alert ----------
check("no-alert", "No window.alert in the new or touched files", () => {
  for (const f of [
    "lib/library.ts",
    "app/api/library/route.ts",
    "app/api/library/[id]/route.ts",
    "app/api/library/[id]/reuse/route.ts",
    "app/artworks/page.tsx",
    "components/library-page.tsx",
    "components/editor.tsx",
    "components/sidebar.tsx",
  ]) {
    assert(!read(f).includes("window.alert"), `${f} uses window.alert`);
  }
  return "inline errors only";
});

const failed = checks.filter((c) => c.status === "fail");
console.log(`\n${checks.length - failed.length}/${checks.length} library checks passed.`);
if (failed.length) {
  console.log(`FAILED: ${failed.map((c) => c.id).join(", ")}`);
  process.exit(1);
}
