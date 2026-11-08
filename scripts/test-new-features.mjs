// Feature tests for the SANAA extension mission (parts 1–5):
// profile photos, works wall, website builder (51 templates), portfolio
// PDF builder (Atelier editor, 8 templates, server-side export) and the
// admin test report itself.
//
// Run: node scripts/test-new-features.mjs [--build]
//   --build  also runs `npm run build` (slow, ~3 min) and records it.
//
// Writes public/test-reports/latest.json (read by the admin page) and a
// timestamped copy next to it. Exit code 0 when every check passes or is
// skipped, 1 when any check fails.
//
// Interactive browser flows (avatar upload, template pick + publish,
// PDF export) cannot run in this headless script — they are covered by
// code inspection here and must be verified live in a browser (see the
// "manual" checks in the report).

import { execFileSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const WITH_BUILD = process.argv.includes("--build");
const REPORT_DIR = join(ROOT, "public", "test-reports");

const checks = [];
function check(feature, id, name, fn) {
  try {
    const detail = fn();
    checks.push({ feature, id, name, status: "pass", detail: String(detail ?? "") });
    console.log(`PASS  [${feature}] ${name} — ${detail ?? ""}`);
  } catch (err) {
    checks.push({ feature, id, name, status: "fail", detail: err instanceof Error ? err.message : String(err) });
    console.log(`FAIL  [${feature}] ${name} — ${err instanceof Error ? err.message : err}`);
  }
}
function skip(feature, id, name, detail) {
  checks.push({ feature, id, name, status: "skip", detail });
  console.log(`SKIP  [${feature}] ${name} — ${detail}`);
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
const read = (p) => readFileSync(join(ROOT, p), "utf8");
const exists = (p) => existsSync(join(ROOT, p));

// ---------- Part 1 — Profile photos ----------
check("Profile photos", "profile-files", "Profile files exist", () => {
  for (const f of ["lib/profile.ts", "components/avatar.tsx", "app/api/settings/profile/route.ts", "app/api/saved-work/route.ts"]) {
    assert(exists(f), `missing ${f}`);
  }
  return "lib/profile.ts, components/avatar.tsx, settings profile API, saved-work API";
});
check("Profile photos", "profile-lib", "Profile lib exposes get/upsert + avatar/bio", () => {
  const src = read("lib/profile.ts");
  for (const s of ["parseProfileData", "getUserProfile", "upsertUserProfile", "avatarUrl", "bio"]) {
    assert(src.includes(s), `lib/profile.ts missing ${s}`);
  }
  const api = read("app/api/saved-work/route.ts");
  assert(api.includes('"profile"'), 'saved-work KINDS missing "profile"');
  return "parseProfileData/getUserProfile/upsertUserProfile present; kind 'profile' registered";
});
check("Profile photos", "profile-ui", "Avatar shown on dashboard, sidebar, settings, public creator card", () => {
  for (const [f, needle] of [
    ["components/dashboard.tsx", "Avatar"],
    ["components/sidebar.tsx", "Avatar"],
    ["components/settings-page.tsx", "Avatar"],
    ["components/public-exhibition.tsx", "avatarUrl"],
  ]) {
    assert(read(f).includes(needle), `${f} missing ${needle}`);
  }
  return "dashboard, sidebar, settings, public exhibition creator card";
});

// ---------- Part 2 — Works wall ----------
check("Works wall", "works-files", "Works wall files exist", () => {
  for (const f of ["lib/works.ts", "app/works/[id]/page.tsx", "components/works-page.tsx", "app/api/work-kinds/route.ts"]) {
    assert(exists(f), `missing ${f}`);
  }
  return "lib/works.ts, /works/[id] page, works-page, /api/work-kinds";
});
check("Works wall", "works-kinds", "Kind classification + overrides + API", () => {
  const src = read("lib/works.ts");
  for (const s of ["classifyWorkKind", "getWorkKindOverrides", "setWorkKind", '"work-kinds"']) {
    assert(src.includes(s), `lib/works.ts missing ${s}`);
  }
  const api = read("app/api/work-kinds/route.ts");
  assert(api.includes("POST"), "work-kinds route missing POST");
  const saved = read("app/api/saved-work/route.ts");
  assert(saved.includes('"work-kinds"'), 'saved-work KINDS missing "work-kinds"');
  return "classify/get/set + POST /api/work-kinds; kind 'work-kinds' registered";
});
check("Works wall", "works-links", "Linked from dashboard + settings, i18n works section", () => {
  assert(read("components/dashboard.tsx").includes("/works/"), "dashboard missing /works/ link");
  assert(read("components/settings-page.tsx").includes("/works/"), "settings missing /works/ link");
  assert(read("lib/i18n.ts").includes("works: {"), "i18n missing works section");
  return "dashboard 'Mes travaux', settings public-page link, EN+FR keys";
});

// ---------- Part 3 — Website builder, 51 templates ----------
check("Website builder", "site-count", "51 LEGACY site templates kept read-only (renderer for already-published sites), unique ids, 10 families", () => {
  const src = read("lib/site-templates.ts");
  // Template entries are one-line objects: id, label, family — the family
  // list entries have no `family:` field, so this matches templates only.
  const tplIds = [...src.matchAll(/id: "([a-z0-9-]+)", label: "[^"]+", family: "/g)].map((m) => m[1]);
  assert(tplIds.length === 51, `expected 51 templates, found ${tplIds.length}`);
  assert(new Set(tplIds).size === 51, "duplicate template ids");
  const fams = [...src.matchAll(/family: "([a-z-]+)"/g)].map((m) => m[1]);
  assert(new Set(fams).size === 10, `expected 10 families, found ${new Set(fams).size}`);
  return `51 templates, 10 families (${[...new Set(fams)].join(", ")})`;
});
check("Website builder", "site-render", "Legacy preview still renders hero styles + radius; simple editor removed", () => {
  const preview = read("components/site-preview.tsx");
  for (const s of ['heroStyle === "split"', 'heroStyle === "banner"', "imageRadius"]) {
    assert(preview.includes(s), `site-preview missing ${s}`);
  }
  assert(preview.includes("LEGACY renderer"), "site-preview not marked legacy");
  assert(!exists("components/website-builder.tsx"), "simple builder editor still present");
  assert(read("lib/site-templates.ts").includes("LEGACY template registry"), "site-templates not marked legacy");
  return "split/banner heroes, image radius in legacy renderer; simple editor gone";
});


// ---------- Part 3b — Advanced website builder (Claude editor) ----------
check("Advanced website builder", "adv-files", "Editor, public view, APIs, lib, seed, CSS, demo images exist", () => {
  for (const f of [
    "components/advanced-site-editor.tsx", "components/advanced-site-editor.css",
    "components/advanced-site-view.tsx", "components/advanced-site-published.css",
    "components/advanced-site-contact-form.tsx", "components/advanced-site-gallery-lightbox.tsx",
    "app/tools/website-builder/advanced/page.tsx", "app/sites/[id]/[pageSlug]/page.tsx",
    "app/api/advanced-sites/route.ts", "app/api/advanced-sites/[id]/route.ts",
    "app/api/site-templates/route.ts", "app/api/advanced-media/route.ts",
    "app/api/site-media/[...key]/route.ts",
    "lib/advanced-site-types.ts", "lib/advanced-site-templates.ts", "lib/advanced-sites.ts",
    "scripts/seed-site-templates.mjs",
  ]) {
    assert(exists(f), `missing ${f}`);
  }
  for (const img of ["architecture.jpg", "artist-portrait.jpg", "books-studio.jpg", "gallery-show.jpg",
    "leonardo-last-supper.jpg", "leonardo-mona-lisa.jpg", "leonardo-self-portrait.jpg", "live-music.jpg",
    "lookbook-fashion.jpg", "portrait-studio.jpg", "studio-art.jpg"]) {
    assert(exists(`public/images/${img}`), `missing demo image ${img}`);
  }
  return "editor + view + 5 API routes + lib + seed + CSS + 11 demo images";
});
check("Advanced website builder", "adv-prisma", "Schema has Site/Page/Section/Block/Template/Media, one User, sites fused", () => {
  const schema = read("prisma/schema.prisma");
  for (const m of ["model Site {", "model Page {", "model Section {", "model Block {", "model Template {", "model Media {"]) {
    assert(schema.includes(m), `schema missing ${m}`);
  }
  assert((schema.match(/model User \{/g) ?? []).length === 1, "more than one User model");
  assert(schema.includes("sites         Site[]"), "User.sites relation missing");
  return "6 models + User.sites, single User model";
});
check("Advanced website builder", "adv-templates", "11 original templates, unique ids", () => {
  const src = read("lib/advanced-site-templates.ts");
  const ids = [...src.matchAll(/id: "([a-z-]+)", name: /g)].map((m) => m[1]);
  assert(ids.length === 11, `expected 11 templates, found ${ids.length}`);
  assert(new Set(ids).size === 11, "duplicate template ids");
  return `11 templates (${ids.join(", ")})`;
});
check("Advanced website builder", "adv-no-local", "Editor persists to DB/R2 only: no localStorage, no local uploads, no mock fetch", () => {
  const editor = read("components/advanced-site-editor.tsx");
  // Header comments name localStorage / public/uploads as the things that
  // were removed — only real code counts, so strip comments first.
  const code = editor.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
  assert(!/localStorage\.(get|set|remove)Item/.test(code), "editor still uses localStorage");
  assert(!code.includes("/api/media"), "editor still calls the local media API");
  assert(!code.includes("public/uploads"), "editor still references local uploads");
  assert(editor.includes("/api/advanced-sites"), "editor missing advanced-sites API");
  assert(editor.includes("/api/advanced-media"), "editor missing advanced-media API");
  const media = read("app/api/advanced-media/route.ts");
  assert(media.includes("PutObjectCommand"), "media route does not write to R2");
  assert(!media.includes("writeFile"), "media route still writes to local disk");
  return "autosave → /api/advanced-sites, uploads → R2, no localStorage";
});
check("Advanced website builder", "adv-auth", "All advanced APIs require sign-in and scope to the owner", () => {
  for (const f of ["app/api/advanced-sites/route.ts", "app/api/advanced-sites/[id]/route.ts",
    "app/api/site-templates/route.ts", "app/api/advanced-media/route.ts"]) {
    const src = read(f);
    assert(src.includes("getCurrentUser()"), `${f} missing auth`);
    assert(src.includes("401"), `${f} missing 401 branch`);
  }
  const sites = read("app/api/advanced-sites/route.ts");
  assert(sites.includes("userId: user.id") || sites.includes("user.id"), "sites API not owner-scoped");
  assert(read("app/api/advanced-sites/[id]/route.ts").includes("userId: user.id"), "site-by-id API not owner-scoped");
  return "getCurrentUser + 401 on all 4 routes, owner-scoped reads/writes";
});
check("Advanced website builder", "adv-routes", "Public route resolves slug first, SavedWork id second; simple builder removed, old route redirects", () => {
  const pub = read("app/sites/[id]/page.tsx");
  assert(pub.includes("getPublishedSite(id)"), "public route does not try the advanced site first");
  assert(pub.includes("findSite(id)"), "public route lost the SavedWork fallback");
  assert(pub.indexOf("getPublishedSite(id)") < pub.indexOf("findSite(id)"), "slug-first order broken");
  assert(exists("app/sites/[id]/[pageSlug]/page.tsx"), "advanced sub-page route missing");
  assert(!exists("components/website-builder.tsx"), "simple builder editor still present");
  assert(read("app/tools/website-builder/page.tsx").includes('redirect("/tools/website-builder/advanced")'), "old builder route does not redirect to the advanced editor");
  assert(!read("app/tools/website-builder/advanced/page.tsx").includes("créateur simple"), "advanced page still links back to the simple builder");
  return "slug-first /sites/[id], [pageSlug] sub-pages, legacy SavedWork fallback kept, /tools/website-builder redirects to advanced";
});
check("Advanced website builder", "adv-css", "Editor CSS scoped (no Tailwind 3, no global .topbar), published CSS imported once", () => {
  const css = read("components/advanced-site-editor.css").replace(/\/\*[\s\S]*?\*\//g, "");
  assert(!/^@tailwind/m.test(css), "editor CSS still has Tailwind directives");
  assert(!/^\.topbar \{/m.test(css), "editor CSS has an unscoped .topbar rule");
  assert(css.includes(".advanced-editor .topbar"), "editor CSS not scoped under .advanced-editor");
  assert(!css.includes("--ink:") || css.includes("--adv-ink:"), "editor CSS still defines SANAA --ink");
  const layout = read("app/layout.tsx");
  assert(layout.includes("advanced-site-editor.css"), "layout does not import editor CSS");
  assert(layout.includes("advanced-site-published.css"), "layout does not import published CSS");
  return "scoped .advanced-editor, --adv-* vars, both CSS files in layout";
});

// ---------- Part 3c — Site templates UI/UX (burger, footer, icons, a11y) ----------
check("Advanced website builder", "adv-nav-burger", "Published nav: burger ≤768px, Escape + close on link, aria-expanded", () => {
  assert(exists("components/advanced-site-nav.tsx"), "missing components/advanced-site-nav.tsx");
  const nav = read("components/advanced-site-nav.tsx");
  for (const s of ["Menu", "X", "aria-expanded", "aria-controls", "aria-label", "Escape", "setOpen(false)", "aria-current"]) {
    assert(nav.includes(s), `published nav missing ${s}`);
  }
  const view = read("components/advanced-site-view.tsx");
  assert(view.includes("PublishedSiteNav"), "published view does not use PublishedSiteNav");
  return "burger nav with Escape, aria-expanded/controls/label, aria-current";
});
check("Advanced website builder", "adv-footer", "Full footer on every page: nav, contact, socials, copyright, back to top", () => {
  const view = read("components/advanced-site-view.tsx");
  for (const s of ["PublishedSiteFooter", "published-site-footer", "Navigation du pied de page", "mailto:", "Retour en haut", "hasFooterBlock"]) {
    assert(view.includes(s), `published view footer missing ${s}`);
  }
  const src = read("lib/advanced-site-templates.ts");
  assert((src.match(/type: "footer"/g) ?? []).length === 13, "footer block not declared in all 11 templates + library + site builder");
  assert((src.match(/type: "social"/g) ?? []).length === 13, "social block not declared in all 11 templates + library + site builder");
  assert(src.includes('page.sections.push({ id: id(), title: "Pied de page"'), "createTemplateSite does not append the footer section");
  const css = read("components/advanced-site-published.css");
  assert(css.includes(".published-site-footer"), "published CSS missing footer styles");
  return "footer block in 11 templates, appended to every page, fallback for older sites";
});
check("Advanced website builder", "adv-icons", "Lucide icons, no text glyphs as icons (♫ ▶ ⌖ →)", () => {
  for (const f of ["components/advanced-site-view.tsx", "components/advanced-site-gallery-lightbox.tsx",
    "components/advanced-site-contact-form.tsx", "components/advanced-site-editor.tsx"]) {
    const code = read(f).replace(/\/\/.*$/gm, "");
    for (const glyph of ["♫", "▶", "⌖"]) assert(!code.includes(glyph), `${f} still uses ${glyph} as an icon`);
  }
  assert(read("components/advanced-site-view.tsx").includes("lucide-react"), "published view missing lucide icons");
  const lightbox = read("components/advanced-site-gallery-lightbox.tsx");
  for (const s of ["ChevronLeft", "ChevronRight", "X", "closeRef", "triggerRef"]) {
    assert(lightbox.includes(s), `lightbox missing ${s}`);
  }
  return "lucide icons in view, lightbox, form, editor; no ♫ ▶ ⌖ glyphs";
});
check("Advanced website builder", "adv-a11y", "Skip link, single h1, focus-visible, alt text, lightbox focus", () => {
  const view = read("components/advanced-site-view.tsx");
  for (const s of ["published-skip-link", "Aller au contenu", "firstBlockId", 'id={type === "contact"']) {
    assert(view.includes(s), `published view missing ${s}`);
  }
  assert(read("components/advanced-site-nav.tsx").includes("aria-current"), "published nav missing aria-current");
  assert(!/<h1[^>]*>/.test(view.replace(/HeadingTag/g, "H")), "published view still hardcodes <h1> per block");
  const css = read("components/advanced-site-published.css");
  assert(css.includes(":focus-visible"), "published CSS missing :focus-visible");
  assert(css.includes("overflow-x: clip"), "published CSS missing overflow-x guard");
  assert(!css.includes("padding: 18px 5%;     .gallery-lightbox"), "broken nested 680px media query still present");
  assert(css.includes("@media (max-width: 768px)"), "published CSS missing 768px burger breakpoint");
  assert(css.includes(".published-burger"), "published CSS missing burger styles");
  return "skip link, one h1, focus-visible, 768px breakpoint, CSS nesting bug fixed";
});
check("Advanced website builder", "adv-editor-preview", "Editor preview: wrapping nav at 390px, footer/social blocks", () => {
  const css = read("components/advanced-site-editor.css");
  assert(css.includes(".canvas-site-nav { padding: 17px 6%; display: flex; flex-wrap: wrap;"), "editor canvas nav does not wrap");
  assert(css.includes(".preview-footer"), "editor CSS missing footer preview");
  assert(css.includes(".preview-social"), "editor CSS missing social preview");
  const editor = read("components/advanced-site-editor.tsx");
  assert(editor.includes('block.type === "footer"'), "editor preview does not render footer blocks");
  assert(editor.includes('block.type === "social"'), "editor preview does not render social blocks");
  return "canvas nav wraps, footer/social preview blocks, aria-current on page links";
});
check("Website builder", "simple-footer-burger", "Simple builder: burger, full footer, icons, responsive grids", () => {
  const preview = read("components/site-preview.tsx");
  for (const s of ["Menu", "aria-expanded", "Escape", "Back to top", "Mail", "Instagram", "galleryCols", "compact ? \"1fr\" : \"1fr 1fr\"", "id=\"works\"", "id=\"about\"", "id=\"contact\""]) {
    assert(preview.includes(s), `site-preview missing ${s}`);
  }
  return "burger + footer + lucide icons + collapsing hero/gallery grids";
});

// ---------- Part 4 — Portfolio PDF, 50 templates ----------
check("Portfolio PDF", "atelier-templates", "8 Atelier templates, unique ids, old 50 deleted", () => {
  const dir = join(ROOT, "lib", "atelier-templates");
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));
  const ids = files.map((f) => JSON.parse(read(`lib/atelier-templates/${f}`)).id);
  assert(ids.length === 8, `expected 8 templates, found ${ids.length}`);
  assert(new Set(ids).size === 8, "duplicate template ids");
  assert(!exists("lib/pdf-templates.ts"), "old 50-template file still present");
  return `8 templates (${ids.join(", ")})`;
});
check("Portfolio PDF", "atelier-files", "Atelier editor, export function, API routes, tools entry, i18n", () => {
  for (const f of [
    "components/atelier-editor.tsx",
    "components/atelier-editor.css",
    "public/atelier/editor.js",
    "public/vendor/fabric.min.js",
    "api/index.py",
    "api/atelier/fonts/Manrope-Regular.ttf",
    "api/requirements.txt",
    "app/api/atelier/templates/route.ts",
    "app/api/atelier/projects/route.ts",
    "app/api/atelier/uploads/route.ts",
    "app/api/atelier/file/[...key]/route.ts",
    "app/tools/portfolio-pdf/page.tsx",
  ]) {
    assert(exists(f), `missing ${f}`);
  }
  assert(!exists("api/atelier/export.py"), "old export path still present (must be api/index.py)");
  assert(!exists("components/portfolio-pdf-builder.tsx"), "old builder still present");
  assert(!exists("components/portfolio-print.tsx"), "old print renderer still present");
  assert(!read("public/atelier/editor.js").includes("window.print()"), "editor still uses window.print()");
  assert(!read("public/atelier/editor.js").includes("window.alert("), "editor uses window.alert");
  assert(read("api/index.py").includes("def export_pdf"), "export function missing PDF renderer");
  // Vercel silently ignores a Python function at api/atelier/export.py in a
  // Next.js project (the Next.js app answers 404 for /api/atelier/export/*).
  // The entrypoint must be api/index.py, reached by an explicit rewrite.
  const vercel = JSON.parse(read("vercel.json"));
  const rewrites = vercel.rewrites || [];
  assert(
    rewrites.some((r) => r.source === "/api/atelier/export/:path*" && r.destination === "/api/index.py"),
    "vercel.json missing /api/atelier/export/* -> /api/index.py rewrite",
  );
  assert(read("components/tools-page.tsx").includes("/tools/portfolio-pdf"), "tools list missing portfolio-pdf entry");
  assert(read("lib/i18n.ts").includes("portfolioPdf:"), "i18n missing portfolioPdf keys");
  assert(read("lib/tool-use.ts").includes('"portfolio-pdf"'), "tool-use missing portfolio-pdf slug");
  // Standalone editor page (8 Nov): no platform shell around the editor,
  // a collapsible icon-only sidebar rail instead, editor in full view.
  const editorPage = read("app/tools/portfolio-pdf/page.tsx");
  assert(!editorPage.includes("ToolsShell"), "editor page still uses ToolsShell (platform menu must not wrap the editor)");
  assert(editorPage.includes("collapsible"), "editor page missing collapsible sidebar");
  assert(editorPage.includes("standalone"), "editor page missing standalone editor");
  assert(read("components/sidebar.tsx").includes("collapsed"), "sidebar missing collapsed mode");
  assert(read("components/atelier-editor.tsx").includes("atelier-standalone"), "editor missing standalone styles");
  // Saved-designs bar removed (8 Nov): the editor page must fit the
  // window — no bar above the editor's own top bar. Designs live in
  // the editor's own "Designs" tab (left rail) instead.
  const editorTsx = read("components/atelier-editor.tsx");
  assert(!editorTsx.includes("atelier-projects-bar"), "editor still renders the Mes designs bar");
  assert(!editorTsx.includes("Mes designs"), "editor still renders the Mes designs bar");
  assert(editorTsx.includes('data-tab="designs"'), "editor missing Designs rail tab");
  const editorJs = read("public/atelier/editor.js");
  assert(editorJs.includes('designs:["MES DESIGNS"'), "editor.js missing designs tab");
  assert(editorJs.includes("loadDesigns"), "editor.js missing designs list loader");
  assert(
    read("components/atelier-editor.css").includes(".atelier-standalone-main { flex: 1; min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; }"),
    "standalone main can overflow the viewport (needs min-height: 0 + overflow hidden)",
  );
  return "editor + local Fabric.js + Python export (api/index.py + rewrite) + R2 API routes + tools entry + EN/FR keys + tool slug";
});

check("Portfolio PDF", "atelier-transitions", "Smooth open/close transitions, 0.25s max", () => {
  const globals = read("app/globals.css");
  const editorCss = read("components/atelier-editor.css");
  const editorJs = read("public/atelier/editor.js");
  // Sidebar (big movement): 0.25s ease on width; labels fade and collapse
  // instead of snapping away with display:none.
  assert(globals.includes("transition: width .25s ease, min-width .25s ease, padding .25s ease"), "sidebar missing 0.25s width transition");
  assert(!globals.includes(".sidebar.collapsed .brand-name { display: none; }"), "sidebar labels still snap via display:none");
  assert(globals.includes("transition: transform .25s ease; box-shadow: 0 0 40px"), "mobile slide-over not 0.25s");
  // Left panel (0.25s): the grid column shrinks, the panel fades — no display:none.
  assert(editorCss.includes("transition: grid-template-columns .25s ease"), "editor layout missing grid transition");
  assert(editorCss.includes(".editor-layout.panel-closed { grid-template-columns: 66px 0 minmax(270px, 1fr) 286px; }"), "editor missing panel-closed grid");
  assert(!editorCss.includes(".left-panel.closed { display: none; }"), "left panel still snaps via display:none");
  assert(editorJs.includes("panel-closed"), "editor.js does not toggle panel-closed");
  // Export menu + rail tab switch (0.25s): fade/slide, no display toggle.
  assert(editorCss.includes("transition: opacity .25s ease, transform .25s ease, visibility 0s linear .25s"), "export menu missing 0.25s fade");
  assert(!editorCss.includes(".export-menu.open { display: block; }"), "export menu still snaps via display");
  assert(editorCss.includes("atelier-panel-fade .25s ease"), "panel tab switch missing fade");
  assert(editorJs.includes("panel-swap"), "editor.js does not re-trigger panel fade");
  // Nothing over 0.25s: sweep every transition/animation declaration in
  // both stylesheets for a duration above 0.25s.
  for (const [name, css] of [["globals", globals], ["editor", editorCss]]) {
    const slow = css.match(/transition:[^;]*\.[345]s|animation:[^;]*\.[345]s/g);
    assert(!slow, `${name} still has >0.25s transitions: ${slow?.join(" | ")}`);
  }
  // Hover + overlay (8 Nov): the collapsible rail unfolds on hover and
  // floats above the editor instead of pushing it — the editor never
  // shifts when the menu opens. Close is delayed so a brief slip of
  // the mouse does not flicker it shut; the click toggle stays.
  const sidebarTsx = read("components/sidebar.tsx");
  assert(sidebarTsx.includes("onMouseEnter"), "sidebar missing hover open");
  assert(sidebarTsx.includes("onMouseLeave"), "sidebar missing hover close");
  assert(sidebarTsx.includes("sidebar-collapsible"), "sidebar missing overlay class");
  assert(sidebarTsx.includes("180"), "sidebar missing hover close delay");
  assert(globals.includes(".sidebar-collapsible { position: fixed;"), "collapsible sidebar not a fixed overlay on desktop");
  assert(globals.includes(".sidebar-collapsible:not(.collapsed) { box-shadow:"), "expanded overlay menu missing shadow");
  assert(editorCss.includes(".atelier-standalone-main { margin-left: 64px; }"), "standalone main does not reserve the 64px rail");
  // Platform-wide rail (8 Nov): the collapsible sidebar is the default
  // everywhere, and every .app-shell page reserves the 64px icon strip
  // next to the fixed overlay sidebar.
  assert(sidebarTsx.includes("collapsible = true"), "sidebar not collapsible by default");
  assert(globals.includes(".app-shell > .sidebar-collapsible ~ * { margin-left: 64px; }"), "app-shell does not reserve the 64px rail");
  // Scrollbars (8 Nov, Kabeya decision): hidden below 1024 px, thin
  // gold pill on desktop (min-width: 1024 px); scrolling intact.
  assert(globals.includes("scrollbar-width: none"), "scrollbars not hidden on mobile (Firefox)");
  assert(globals.includes("*::-webkit-scrollbar { display: none;"), "scrollbars not hidden on mobile (Chromium/Safari)");
  assert(globals.includes("@media (min-width: 1024px)"), "desktop scrollbar breakpoint missing");
  assert(globals.includes("scrollbar-width: thin"), "desktop scrollbar not thin (Firefox)");
  assert(globals.includes("scrollbar-color: rgba(201, 168, 106, 0.55) transparent"), "desktop scrollbar gold missing (Firefox)");
  assert(globals.includes("*::-webkit-scrollbar-thumb { background: rgba(201, 168, 106, 0.55); border-radius: 999px; }"), "desktop pill thumb missing (Chromium/Safari)");
  return "all open/close 0.25s, nothing over 0.25s + hover overlay rail platform-wide + scrollbars hidden < 1024px, thin gold pill >= 1024px";
});

check("Gallery walk", "walk-smoothing", "Velocity smoothing: no instant on/off, smooth arrive", () => {
  const params = read("lib/editor-params.ts");
  assert(params.includes("export const WALK_ACCEL = 10;"), "missing WALK_ACCEL");
  assert(params.includes("export const WALK_DECEL = 7;"), "missing WALK_DECEL");
  assert(params.includes("export const WALK_ARRIVE_DIST = 1.5;"), "missing WALK_ARRIVE_DIST");
  assert(params.includes("export const WALK_STOP_EPS = 0.02;"), "missing WALK_STOP_EPS");
  for (const f of ["components/gallery-scene.tsx", "components/gallery-rooms.tsx"]) {
    const src = read(f);
    assert(src.includes("velRef = useRef({ x: 0, z: 0 })"), `${f} missing velocity ref`);
    assert(src.includes("1 - Math.exp(-rate * delta)"), `${f} missing exponential velocity easing`);
    assert(src.includes("WALK_ARRIVE_DIST"), `${f} missing arrive slowdown`);
    assert(src.includes("WALK_STOP_EPS"), `${f} missing velocity snap-to-zero`);
  }
  // No instant movement left: the old `v = SPEED * delta` applied
  // directly to the camera is gone from both walk loops.
  assert(!read("components/gallery-scene.tsx").includes("const v = SUNLIGHT_WALK_SPEED * delta;"), "Sunlight still moves instantly");
  assert(!read("components/gallery-rooms.tsx").includes("const v = (def?.walkSpeed ?? 4) * delta;"), "rooms still move instantly");
  // Top speed unchanged: 4 m/s (4.2 for the faster rooms).
  assert(read("lib/sunlight.ts").includes("SUNLIGHT_WALK_SPEED = 4;"), "Sunlight walk speed changed");
  assert(!read("lib/gallery-defs.ts").includes("walkSpeed: 3,"), "a room still walks at 3 m/s");
  return "velocity eases in/out (accel 10/s, decel 7/s), arrive slows inside 1.5 m, top speed still 4 m/s";
});

// ---------- Part 5 — Exhibitions in every gallery (Chantier 5) ----------
// The per-gallery exhibition checks live in their own script
// (scripts/test-exhibitions-all-galleries.mjs): it executes the repo's
// own TypeScript (gallery defs, Compose wall, seed artworks) for all
// 21 galleries and checks every placement against the wall it hangs
// on. This section wires it into the suite, so the whole battery stays
// one command. A failure here is a REAL recorded bug (see the script's
// report), not a harness problem — do not "fix" it by weakening the
// check; the debug chantier owns the fix.
check("Exhibitions — all galleries", "exhibitions-all", "21 galleries: defs, opening, Compose wall, place-on-wall, navigation", () => {
  try {
    const out = execFileSync("node", ["scripts/test-exhibitions-all-galleries.mjs", "--report=public/test-reports/exhibitions-latest.json"], { cwd: ROOT, stdio: "pipe", timeout: 120000, encoding: "utf8" });
    return String(out).trim().split("\n").filter(Boolean).slice(-8).join(" | ");
  } catch (err) {
    const stdout = String(err.stdout ?? "");
    const fails = stdout.split("\n").filter((l) => l.startsWith("FAIL"));
    throw new Error(`exhibition tests failed: ${fails.join(" // ").slice(0, 900) || String(err.message).slice(0, 300)}`);
  }
});
// ---------- Part 6 — Exhibition background music (option A) ----------
// One track per exhibition: 4 Prisma fields, validation, upload +
// same-origin serving with Range, player wired to the "Enter" gesture,
// entry-screen line, editor Music section, FR+EN strings. Real
// playback (autoplay on iOS, TTS ducking, seeking) needs a live
// browser — recorded as manual checks below.
check("Exhibition music", "music-schema", "Prisma: audioUrl/audioTitle/audioLoop/audioVolume on Exhibition", () => {
  const src = read("prisma/schema.prisma");
  for (const s of ["audioUrl     String?", "audioTitle   String?", "audioLoop    Boolean  @default(true)", "audioVolume  Float    @default(0.5)"]) {
    assert(src.includes(s), `schema missing ${s}`);
  }
  return "4 fields, nullable + defaults (additive migration via db push)";
});
check("Exhibition music", "music-validation", "Validation accepts the 4 audio fields, same-origin URL only", () => {
  const src = read("lib/validation.ts");
  for (const s of ["audioUrl:", "audioTitle:", "audioLoop:", "audioVolume:", 'startsWith("/api/audio/")']) {
    assert(src.includes(s), `validation missing ${s}`);
  }
  return "audioUrl nullable + /api/audio/ prefix, title ≤120, volume 0..1, loop boolean";
});
check("Exhibition music", "music-api", "PUT persists the 4 fields; public page passes music to the viewer", () => {
  const route = read("app/api/exhibitions/[id]/route.ts");
  for (const s of ["input.audioUrl", "input.audioTitle", "input.audioLoop", "input.audioVolume"]) {
    assert(route.includes(s), `PUT missing ${s}`);
  }
  const page = read("app/exhibition/[slug]/page.tsx");
  assert(page.includes("music={"), "public page does not pass music to PublicExhibition");
  // The music fields are read in the shared loader (lib/exhibition-public.ts),
  // used by the public page and the embed page.
  const loader = read("lib/exhibition-public.ts");
  assert(loader.includes("exhibition.audioUrl"), "shared loader does not read audioUrl");
  return "PUT writes audio fields when sent; /exhibition/[slug] forwards url/title/loop/volume";
});
check("Exhibition music", "music-upload", "Audio upload route: MP3/AAC only, 4.5 MB cap, audio/<userId>/ prefix", () => {
  const src = read("app/api/uploads/audio/route.ts");
  for (const s of ['"audio/mpeg"', '"audio/mp4"', "MAX_FILE_SIZE = 4_500_000", "audio/${user.id}/", "/api/audio/${key}"]) {
    assert(src.includes(s), `upload route missing ${s}`);
  }
  assert(!src.includes("image/"), "audio upload route still mentions images");
  return "allowlist audio/mpeg + audio/mp4, 413 over 4.5 MB, R2 audio/<userId>/<uuid>";
});
check("Exhibition music", "music-serve", "Audio serve route: Range (206), Accept-Ranges, same access rule as images", () => {
  const src = read("app/api/audio/[...key]/route.ts");
  for (const s of ["parseRange", "Content-Range", "Accept-Ranges", "status: 206", "status: 416", "audioUrl: servingUrl", "audio/mpeg", "audio/mp4"]) {
    assert(src.includes(s), `serve route missing ${s}`);
  }
  assert(src.includes("Range: `bytes=${range.start}-${range.end}`"), "Range not passed to R2 GetObject");
  return "bytes= ranges honoured via R2 (206/416), public show open, else owner only";
});
check("Exhibition music", "music-player", "Player: no autoplay on mount, starts on Enter gesture, ducks under TTS, volume persisted", () => {
  const src = read("components/exhibition-audio-player.tsx");
  for (const s of ["startSignal", "sanaa-music-volume", "volume * 0.15", 'loop={music.loop ?? true}', "aria-pressed", "pausedByHandRef"]) {
    assert(src.includes(s), `player missing ${s}`);
  }
  assert(!/autoPlay/.test(src), "player uses autoPlay — forbidden");
  assert(!src.includes("new Audio("), "player uses new Audio() instead of <audio>");
  const viewer = read("components/public-exhibition.tsx");
  assert(viewer.includes("setEnterSignal((n) => n + 1)"), "viewer never bumps enterSignal");
  assert(viewer.includes("ducked={speakingKey !== null}"), "viewer does not duck under TTS");
  assert(viewer.includes("enabled={soundOn}"), "viewer does not wire the sound switch");
  return "play() only from startSignal (Enter/teleport), duck 15% while speaking, volume in localStorage";
});
check("Exhibition music", "music-entry", "Entry screen shows the track title when the show has music", () => {
  const src = read("components/exhibition-entry-screen.tsx");
  assert(src.includes("musicTitle"), "entry screen has no musicTitle prop");
  assert(src.includes('t("entry", "music")'), "entry screen does not use the music label");
  return "“Music: <title>” under the visit meta, only when a track exists";
});
check("Exhibition music", "music-editor", "Editor Music section: upload, title, volume, loop, remove, preview, saved via Save", () => {
  const src = read("components/editor.tsx");
  for (const s of ["uploadMusicFile", "/api/uploads/audio", 't("music", "onlyOwnMusic")', 't("music", "musicTooLarge")', "audioUrl: music?.url ?? null", "audioVolume: music?.volume ?? 0.5"]) {
    assert(src.includes(s), `editor missing ${s}`);
  }
  assert(src.includes("audio/mpeg,audio/mp4,.mp3,.m4a"), "editor file input does not restrict to audio");
  return "Room settings → Music: upload MP3/AAC, title, volume, loop, remove, <audio> preview; Save sends the 4 fields";
});
check("Exhibition music", "music-i18n", "FR + EN strings for music, incl. the rights line", () => {
  const src = read("lib/i18n.ts");
  assert(src.includes("music: {"), "i18n missing music section");
  for (const s of ["playMusic", "pauseMusic", "musicVolume", "musicTooLarge", "musicInvalidFormat", "onlyOwnMusic"]) {
    assert(src.includes(s), `i18n missing ${s}`);
  }
  assert(src.includes("Only upload music you own or that is free to share."), "rights line missing");
  return "music section FR+EN; rights line in both locales";
});
check("Exhibition music", "music-no-delete", "Removing a track never deletes the R2 file (no DeleteObject)", () => {
  for (const f of ["app/api/audio/[...key]/route.ts", "app/api/uploads/audio/route.ts", "app/api/exhibitions/[id]/route.ts", "components/editor.tsx"]) {
    assert(!read(f).includes("DeleteObjectCommand"), `${f} deletes R2 objects`);
  }
  return "no DeleteObject anywhere in the music path — orphaned files are a noted cleanup debt";
});
check("Code quality", "no-alert", "No window.alert in the new code", () => {
  const files = [
    "lib/profile.ts", "lib/works.ts", "lib/site-templates.ts", "lib/atelier-templates.ts",
    "lib/atelier-validate.ts", "lib/atelier-store.ts",
    "components/avatar.tsx", "components/works-page.tsx",
    "components/site-preview.tsx", "components/atelier-editor.tsx",
    "components/settings-page.tsx", "components/dashboard.tsx",
    "app/works/[id]/page.tsx", "app/api/work-kinds/route.ts", "app/tools/portfolio-pdf/page.tsx",
    "app/api/atelier/templates/route.ts", "app/api/atelier/projects/route.ts",
    "app/api/atelier/uploads/route.ts", "app/api/atelier/file/[...key]/route.ts",
    "components/exhibition-audio-player.tsx", "components/public-exhibition.tsx",
    "components/exhibition-entry-screen.tsx", "components/editor.tsx",
    "app/api/uploads/audio/route.ts", "app/api/audio/[...key]/route.ts",
    "app/api/exhibitions/[id]/route.ts", "app/exhibition/[slug]/page.tsx",
  ];
  const offenders = files.filter((f) => exists(f) && /window\.alert\s*\(/.test(read(f)));
  assert(offenders.length === 0, `window.alert in: ${offenders.join(", ")}`);
  return `${files.length} new/changed files checked`;
});
check("Code quality", "tsc", "TypeScript compiles clean (npx tsc --noEmit)", () => {
  try {
    execFileSync("npx", ["tsc", "--noEmit"], { cwd: ROOT, stdio: "pipe", timeout: 240000 });
  } catch (err) {
    throw new Error(`tsc failed: ${String(err.stdout ?? err.message).slice(0, 500)}`);
  }
  return "tsc --noEmit exit 0";
});
if (WITH_BUILD) {
  check("Code quality", "build", "Production build passes (npm run build)", () => {
    try {
      execFileSync("npm", ["run", "build"], { cwd: ROOT, stdio: "pipe", timeout: 580000 });
    } catch (err) {
      throw new Error(`build failed: ${String(err.stdout ?? err.message).slice(0, 500)}`);
    }
    return "npm run build exit 0";
  });
} else {
  skip("Code quality", "build", "Production build passes (npm run build)", "not run — pass --build to include it");
}

// ---------- Server smoke tests (needs a production build in .next) ----------
// NOTE: the local .env DATABASE_URL is a placeholder (file:./dev.db) while
// the Prisma schema requires postgresql://, so DB-backed pages (home, the
// public works wall) return 500 LOCALLY. That is a local-environment limit,
// not a production bug — production on Vercel has the real Postgres URL
// and those pages were verified live. When the local URL is not postgres,
// the DB-backed smoke checks are skipped with that reason; the auth-gated
// checks (which fail before any DB access) still run.
import net from "node:net";
async function pickFreePort(from, to) {
  for (let p = from; p <= to; p++) {
    const free = await new Promise((resolve) => {
      const s = net.createServer();
      s.once("error", () => resolve(false));
      s.once("listening", () => s.close(() => resolve(true)));
      s.listen(p, "127.0.0.1");
    });
    if (free) return p;
  }
  throw new Error(`no free port in ${from}..${to}`);
}
const PORT = await pickFreePort(3100, 3110);
function localDbIsPostgres() {
  for (const f of [".env.local", ".env"]) {
    try {
      const raw = read(f);
      const m = raw.match(/^DATABASE_URL=(.+)$/m);
      if (m) return /^(postgresql|postgres):\/\//.test(m[1].trim().replace(/^["']|["']$/g, ""));
    } catch { /* file absent — try the next */ }
  }
  return false;
}
async function smoke() {
  if (!exists(".next/BUILD_ID")) {
    skip("Smoke tests", "server", "Production server smoke tests", "no .next build found — run npm run build first");
    return;
  }
  const dbOk = localDbIsPostgres();
  // Detached process group so the finally-block kill takes the next-server
  // child with it — a stray server holding the port made earlier runs flaky.
  const server = spawn("npm", ["run", "start", "--", "-p", String(PORT)], { cwd: ROOT, stdio: "pipe", detached: true });
  const base = `http://127.0.0.1:${PORT}`;
  try {
    // Wait for readiness (up to ~40 s): poll a fast, auth-gated API route
    // that answers without touching the database.
    let ready = false;
    for (let i = 0; i < 40; i++) {
      try {
        await fetch(`${base}/api/saved-work?kind=portfolio-pdf`, { redirect: "manual", signal: AbortSignal.timeout(5000) });
        ready = true;
        break;
      } catch {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
    assert(ready, "production server did not start in 40 s");
    const get = async (path) => {
      try {
        const res = await fetch(`${base}${path}`, { redirect: "manual", signal: AbortSignal.timeout(30000) });
        return { status: res.status, location: res.headers.get("location") };
      } catch (err) {
        return { status: 0, location: null, error: err instanceof Error ? err.message : String(err) };
      }
    };
    const home = await get("/");
    if (dbOk) {
      check("Smoke tests", "server-home", "Home responds (redirects to login without a session)", () => {
        assert([200, 307].includes(home.status), `GET / → ${home.status}`);
        return `GET / → ${home.status}${home.location ? ` → ${home.location}` : ""}`;
      });
    } else {
      skip("Smoke tests", "server-home", "Home responds (redirects to login without a session)", "local DATABASE_URL is a placeholder (not postgres) — DB-backed pages cannot render locally; verified live on Vercel");
    }
    const works = await get("/works/test-user-id");
    if (dbOk) {
      check("Smoke tests", "server-works", "Public works wall renders (200, no auth needed)", () => {
        assert(works.status === 200, `GET /works/test-user-id → ${works.status}`);
        return "GET /works/test-user-id → 200";
      });
    } else {
      skip("Smoke tests", "server-works", "Public works wall renders (200, no auth needed)", "local DATABASE_URL is a placeholder (not postgres) — DB-backed pages cannot render locally; verified live on Vercel");
    }
    const pdf = await get("/tools/portfolio-pdf");
    check("Smoke tests", "server-pdf", "Portfolio PDF tool route exists (redirects to login without a session)", () => {
      assert(pdf.status !== 0, `request failed: ${pdf.error ?? "unknown"}`);
      assert([200, 307].includes(pdf.status), `GET /tools/portfolio-pdf → ${pdf.status}`);
      return `GET /tools/portfolio-pdf → ${pdf.status}${pdf.location ? ` → ${pdf.location}` : ""}`;
    });
    const builder = await get("/tools/website-builder");
    check("Smoke tests", "server-builder", "Old website builder route redirects (to advanced editor, or login without a session)", () => {
      assert(builder.status !== 0, `request failed: ${builder.error ?? "unknown"}`);
      assert([200, 307].includes(builder.status), `GET /tools/website-builder → ${builder.status}`);
      return `GET /tools/website-builder → ${builder.status}${builder.location ? ` → ${builder.location}` : ""}`;
    });
    const advEditor = await get("/tools/website-builder/advanced");
    check("Smoke tests", "server-adv-builder", "Advanced website builder route exists (redirects to login without a session)", () => {
      assert(advEditor.status !== 0, `request failed: ${advEditor.error ?? "unknown"}`);
      assert([200, 307].includes(advEditor.status), `GET /tools/website-builder/advanced → ${advEditor.status}`);
      return `GET /tools/website-builder/advanced → ${advEditor.status}${advEditor.location ? ` → ${advEditor.location}` : ""}`;
    });
    const advSites = await get("/api/advanced-sites");
    check("Smoke tests", "server-adv-sites", "Advanced sites API responds (401/307 without a session)", () => {
      assert(advSites.status !== 0, `request failed: ${advSites.error ?? "unknown"}`);
      assert([200, 307, 401].includes(advSites.status), `GET /api/advanced-sites → ${advSites.status}`);
      return `GET /api/advanced-sites → ${advSites.status}`;
    });
    const advTemplates = await get("/api/site-templates");
    check("Smoke tests", "server-adv-templates", "Site templates API responds (401/307 without a session)", () => {
      assert(advTemplates.status !== 0, `request failed: ${advTemplates.error ?? "unknown"}`);
      assert([200, 307, 401].includes(advTemplates.status), `GET /api/site-templates → ${advTemplates.status}`);
      return `GET /api/site-templates → ${advTemplates.status}`;
    });
    const saved = await get("/api/saved-work?kind=portfolio-pdf");
    check("Smoke tests", "server-saved-work", "Saved-work API responds (401/307 without a session)", () => {
      assert(saved.status !== 0, `request failed: ${saved.error ?? "unknown"}`);
      assert([200, 307, 401].includes(saved.status), `GET /api/saved-work → ${saved.status}`);
      return `GET /api/saved-work?kind=portfolio-pdf → ${saved.status}`;
    });
  } finally {
    try { process.kill(-server.pid, "SIGTERM"); } catch { server.kill("SIGTERM"); }
  }
}

await smoke();

// ---------- Certificates & document tools (8 Nov mission) ----------
check("Certificates", "cert-files", "Archive route + helper + Atelier-style CSS + Python export exist", () => {
  for (const f of ["lib/tool-archive.ts", "app/api/tool-archives/route.ts", "components/certificate-tool.tsx", "components/certificate-tool.css", "api/index.py"]) {
    assert(exists(f), `missing ${f}`);
  }
  assert(read("api/requirements.txt").includes("qrcode"), "requirements.txt missing qrcode (PDF QR code)");
  return "tool-archive lib + /api/tool-archives + certificate-tool(.css) + api/index.py + qrcode";
});
check("Certificates", "cert-templates", "10 original certificate templates, unique ids", () => {
  const src = read("components/certificate-tool.tsx");
  const ids = [...src.matchAll(/id: "(classic|minimal|gallery|heritage|modern|noir|deco|monogram|ledger|ribbon)"/g)].map((m) => m[1]);
  assert(ids.length === 10, `expected 10 templates, found ${ids.length}`);
  assert(new Set(ids).size === 10, "duplicate template ids");
  for (const name of ["Heritage", "Modern", "Atelier Noir", "Deco", "Monogram", "Ledger", "Ribbon"]) {
    assert(src.includes(name), `template ${name} missing`);
  }
  return "Classic, Minimal, Gallery, Heritage, Modern, Atelier Noir, Deco, Monogram, Ledger, Ribbon";
});
check("Certificates", "cert-archive", "R2 archive mirrors Atelier: certificates/<userId> keys, auth, 501 when unconfigured", () => {
  const api = read("app/api/tool-archives/route.ts");
  assert(api.includes("certificates/${userId}/${id}.json"), "certificate R2 key prefix missing");
  assert(api.includes("tool-archives/${kind}/${userId}/${id}.json"), "other-tools R2 key prefix missing");
  assert(api.includes("getCurrentUser"), "archive route missing auth");
  assert(api.includes("501"), "archive route missing 501 when R2 unconfigured");
  const helper = read("lib/tool-archive.ts");
  assert(helper.includes('"/api/tool-archives"'), "helper does not post to /api/tool-archives");
  const tool = read("components/certificate-tool.tsx");
  assert(tool.includes('archiveToolDocument("certificate"'), "certificate tool does not archive on issue");
  assert(tool.includes('deleteToolArchive("certificate"'), "certificate tool does not delete the archive on revoke");
  assert(tool.includes("archivedIds"), "certificate tool does not track archived ids");
  return "certificates/<userId>/<id>.json + tool-archives/<kind>/<userId>/<id>.json, user-scoped, best-effort";
});
check("Certificates", "cert-pdf", "Python certificate PDF: route before the generic export, template-aware, QR", () => {
  const src = read("api/index.py");
  const certRoute = src.indexOf('"/api/atelier/export/certificate"');
  const genericRoute = src.indexOf('"/api/atelier/export/{format_name}"');
  assert(certRoute > 0 && genericRoute > certRoute, "certificate route must be registered before the generic export route");
  assert(src.includes("def export_certificate_pdf"), "export_certificate_pdf missing");
  assert(src.includes("_CERT_TEMPLATES"), "per-template PDF rendering missing");
  assert(src.includes("import qrcode"), "QR code generation missing");
  const tool = read("components/certificate-tool.tsx");
  assert(tool.includes('"/api/atelier/export/certificate"'), "tool does not call the certificate PDF export");
  return "POST /api/atelier/export/certificate → one-page PDF, 10 templates, QR, auth via sanaa_session";
});
check("Certificates", "cert-design", "Certificate Studio uses the Atelier dark/gold language, no window.alert", () => {
  const tool = read("components/certificate-tool.tsx");
  assert(tool.includes("certificate-scope"), "tool missing .certificate-scope");
  assert(tool.includes("cert-topbar"), "tool missing the Atelier-style topbar");
  assert(tool.includes("cert-tpl-grid"), "tool missing the template gallery");
  assert(!tool.includes("window.alert"), "tool still uses window.alert");
  const css = read("components/certificate-tool.css");
  assert(css.includes("--cert-gold"), "CSS missing the gold token");
  assert(css.includes(".certificate-scope .cert-topbar"), "CSS not scoped under .certificate-scope");
  return "topbar + left panel + dark workspace + template gallery; errors inline";
});
check("Document tools", "doc-tools-archive", "All five other document tools archive to R2 on save and delete the archive on delete", () => {
  const kinds = {
    "components/presentation-designer.tsx": "presentation",
    "components/exhibition-planner.tsx": "exhibition-plan",
    "components/marketing-studio.tsx": "marketing-asset",
    "components/print-studio.tsx": "print-job",
    "components/art-in-context.tsx": "context-project",
  };
  for (const [file, kind] of Object.entries(kinds)) {
    const src = read(file);
    assert(src.includes("lib/tool-archive"), `${file} missing the archive helper import`);
    assert(src.includes(`archiveToolDocument("${kind}"`), `${file} does not archive ${kind} on save`);
    assert(src.includes(`deleteToolArchive("${kind}"`), `${file} does not delete the ${kind} archive`);
  }
  return "presentation, exhibition-plan, marketing-asset, print-job, context-project";
});
check("Certificates", "cert-i18n", "Documents description updated FR+EN (10 templates, account save, R2 archive, PDF)", () => {
  const src = read("lib/i18n.ts");
  const fr = src.includes("dix modèles originaux");
  const en = src.includes("ten original templates");
  assert(fr && en, "documentsDesc missing the 10-template wording in FR or EN");
  assert(src.includes("R2"), "documentsDesc does not mention the R2 archive");
  return "documentsDesc FR+EN: 10 templates, saved in account + DB, R2 archive, one-page PDF";
});

// Manual (browser-only) checks — recorded as skipped, to be verified live.
skip("Manual (browser)", "manual-music-enter", "Exhibition music: enter with Son ON (music starts) and Son OFF (silent); pause/resume; sound switch mid-visit; volume persisted across visits", "needs a live browser session with a signed-in user + a real MP3");
skip("Manual (browser)", "manual-music-tts", "Exhibition music: TTS audio guide ducks the music to ~15% while speaking, full volume after; music keeps playing across room changes and in List view", "needs a live browser session");
skip("Manual (browser)", "manual-music-ios", "Exhibition music: real playback on iOS Safari (play from the Enter gesture, no autoplay block), seek inside the track (Range/206), file > 4.5 MB shows the clear error, show without music shows no control", "needs a real device/browser session");
skip("Manual (browser)", "manual-avatar", "Upload a profile photo, see it on dashboard + public creator card", "needs a live browser session (subagent cannot drive the browser)");
skip("Manual (browser)", "manual-works", "Tag a work's kind on /works/[id] as the owner, filter the wall", "needs a live browser session");
skip("Manual (browser)", "manual-site", "Pick a site template, edit, preview, publish a site", "needs a live browser session");
skip("Manual (browser)", "manual-adv-site", "Advanced editor: pick a template, edit, autosave, publish, open /sites/[slug] + sub-page", "needs a live browser session with a signed-in user");
skip("Manual (browser)", "manual-adv-site-ux", "Published site UX in a real browser: burger opens/closes at 390px, full footer on all 11 designs, lightbox keyboard nav, no horizontal overflow at 390/768/1280px", "needs a live browser session with a signed-in user");
skip("Manual (browser)", "manual-certificates", "Certificate Studio: pick each of the 10 templates, check the live preview, issue a certificate, confirm the 'Archived in your account' note, download the PDF (one page, right template, QR scans), reprint, revoke", "needs a live browser session with a signed-in user");
skip("Manual (browser)", "manual-pdf", "Open an Atelier template, edit, save, export a real PDF", "needs a live browser session (subagent cannot drive the browser)");
skip("Manual (browser)", "manual-exhibitions", "Open an exhibition in each of the 21 galleries: artworks visible on walls (none floating, none buried in a wall), walk + mini-plan teleport in every room", "needs a live browser session with a signed-in user");

// ---------- Report ----------
let commit = "unknown";
try {
  commit = execFileSync("git", ["rev-parse", "--short", "HEAD"], { cwd: ROOT, encoding: "utf8" }).trim();
} catch { /* not a git checkout */ }
const passed = checks.filter((c) => c.status === "pass").length;
const failed = checks.filter((c) => c.status === "fail").length;
const skipped = checks.filter((c) => c.status === "skip").length;
const report = {
  generatedAt: new Date().toISOString(),
  commit,
  summary: { total: checks.length, passed, failed, skipped },
  checks,
};
mkdirSync(REPORT_DIR, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
writeFileSync(join(REPORT_DIR, "latest.json"), JSON.stringify(report, null, 2));
writeFileSync(join(REPORT_DIR, `${stamp}.json`), JSON.stringify(report, null, 2));
console.log(`\nReport: ${passed}/${checks.length} passed, ${failed} failed, ${skipped} skipped → public/test-reports/latest.json`);
process.exit(failed > 0 ? 1 : 0);
