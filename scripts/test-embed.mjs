// Embed tests — public exhibitions as an <iframe> on a third-party site.
//
// Run: node scripts/test-embed.mjs [--report public/test-reports/embed-<stamp>.json]
//
// What it does (code-level only, no browser, no WebGL, no database):
//   (a) lib/embed.ts — the eligibility gate: only published + public
//       exhibitions are embeddable (private-link, password-protected
//       and drafts are all refused); the embed path/URL builders; the
//       snippet is a plain <iframe> (same-origin src, no <script>,
//       allowfullscreen, lazy loading) with the requested width/height
//       and safe defaults (100% x 600);
//   (b) wiring — the embed route exists, gates on isEmbeddableExhibition
//       and is never indexed (robots noindex); the share panel offers
//       the embed code; the public viewer has an embedded (chromeless)
//       mode; the FR + EN strings exist in lib/i18n.ts.
//
// Exit 0 when every check passes, 1 otherwise. Prints one line per check.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const reportArg = process.argv.find((arg) => arg.startsWith("--report"));

const checks = [];
function check(id, name, fn) {
  try {
    const detail = fn();
    checks.push({ id, name, status: "pass", detail: String(detail ?? "") });
    console.log(`PASS  ${name} — ${detail ?? ""}`);
  } catch (err) {
    checks.push({ id, name, status: "fail", detail: err instanceof Error ? err.message : String(err) });
    console.log(`FAIL  ${name} — ${err instanceof Error ? err.message : String(err)}`);
  }
}
function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}
function read(rel) {
  return readFileSync(join(ROOT, rel), "utf8");
}

// Node 24 type-stripping imports lib/embed.ts directly (no imports,
// no aliases, erasable syntax only).
const embed = await import(pathToFileURL(join(ROOT, "lib", "embed.ts")).href);

check("gate-public", "gate: published + public is embeddable", () => {
  assert(embed.isEmbeddableExhibition({ status: "public", visibility: "public" }) === true, "public show refused");
  return "status=public visibility=public -> true";
});
check("gate-private-link", "gate: private-link is refused", () => {
  assert(embed.isEmbeddableExhibition({ status: "public", visibility: "private-link" }) === false, "private-link allowed");
  return "visibility=private-link -> false";
});
check("gate-password", "gate: password-protected is refused", () => {
  assert(embed.isEmbeddableExhibition({ status: "public", visibility: "password" }) === false, "password show allowed");
  return "visibility=password -> false";
});
check("gate-draft", "gate: draft is refused", () => {
  assert(embed.isEmbeddableExhibition({ status: "draft", visibility: "public" }) === false, "draft allowed");
  return "status=draft -> false";
});
check("embed-path", "embed path encodes the slug", () => {
  assert(embed.embedPath("my-show") === "/embed/exhibition/my-show", embed.embedPath("my-show"));
  assert(embed.embedPath("a b") === "/embed/exhibition/a%20b", "slug not encoded");
  return "/embed/exhibition/<slug>";
});
check("embed-url", "embed URL joins origin and path", () => {
  assert(
    embed.buildEmbedUrl("https://galleria-bice.vercel.app/", "my-show") ===
      "https://galleria-bice.vercel.app/embed/exhibition/my-show",
    "trailing slash not handled",
  );
  return "origin + path, one slash";
});
check("snippet-shape", "snippet is a plain iframe, no script", () => {
  const snippet = embed.buildEmbedSnippet("https://example.test/embed/exhibition/my-show", {}, "My Show");
  assert(snippet.startsWith("<iframe "), "not an iframe");
  assert(snippet.includes('src="https://example.test/embed/exhibition/my-show"'), "src missing");
  assert(!snippet.includes("<script"), "snippet loads a script");
  assert(snippet.includes("allowfullscreen"), "allowfullscreen missing");
  assert(snippet.includes('loading="lazy"'), "lazy loading missing");
  assert(snippet.includes('title="My Show"'), "accessible title missing");
  return snippet;
});
check("snippet-size", "snippet honours width/height, defaults 100% x 600", () => {
  const def = embed.buildEmbedSnippet("https://example.test/e", {});
  assert(def.includes('width="100%"') && def.includes('height="600"'), `defaults wrong: ${def}`);
  const custom = embed.buildEmbedSnippet("https://example.test/e", { width: "800px", height: 450 });
  assert(custom.includes('width="800px"') && custom.includes('height="450"'), `custom size wrong: ${custom}`);
  const bad = embed.buildEmbedSnippet("https://example.test/e", { height: -5 });
  assert(bad.includes('height="600"'), "invalid height not defaulted");
  return "defaults 100% x 600, custom sizes pass through";
});
check("snippet-title-escape", "snippet escapes quotes in the title", () => {
  const snippet = embed.buildEmbedSnippet("https://example.test/e", {}, 'Say "hi"');
  assert(!snippet.includes('title="Say "hi""'), "title breaks the attribute");
  assert(snippet.includes("&quot;"), "quote not escaped");
  return 'title="Say &quot;hi&quot;"';
});
check("route-exists", "embed route exists and gates on the eligibility check", () => {
  const rel = "app/embed/exhibition/[slug]/page.tsx";
  assert(existsSync(join(ROOT, rel)), "route file missing");
  const src = read(rel);
  assert(src.includes("isEmbeddableExhibition"), "route does not call the gate");
  assert(src.includes("embedded"), "route does not render the chromeless viewer");
  assert(src.includes("index: false"), "embed page is not noindex");
  return rel;
});
check("share-offers-embed", "share panel offers the embed code (public shows only)", () => {
  const src = read("components/exhibition-share.tsx");
  assert(src.includes("buildEmbedSnippet"), "no snippet builder in the share panel");
  assert(src.includes('t("embed", "embedOnYourSite")'), "no embed heading in the share panel");
  assert(src.includes("embeddable"), "share panel does not check embeddability");
  return "exhibition-share.tsx";
});
check("viewer-embedded-mode", "public viewer has a chromeless embedded mode", () => {
  const src = read("components/public-exhibition.tsx");
  assert(src.includes("embedded = false"), "no embedded prop");
  assert(src.includes("!embedded"), "chrome is not hidden in embedded mode");
  return "public-exhibition.tsx";
});
check("i18n-embed", "embed strings exist in FR and EN", () => {
  const src = read("lib/i18n.ts");
  for (const key of ["embedOnYourSite", "embedHint", "copyEmbedCode", "embedCodeCopied", "notAvailable", "notAvailableHint"]) {
    const entry = new RegExp(`${key}:\\s*\\{[^}]*?fr: "[^"]+",\\s*en: "[^"]+"`, "s");
    assert(entry.test(src), `missing FR+EN pair for ${key}`);
  }
  return "lib/i18n.ts embed section, FR + EN";
});

const failed = checks.filter((c) => c.status === "fail").length;
console.log(`\n${checks.length - failed}/${checks.length} embed checks passed.`);
if (reportArg) {
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const out = reportArg.includes("=") ? reportArg.split("=")[1] : join(ROOT, "public", "test-reports", `embed-${stamp}.json`);
  mkdirSync(join(out, ".."), { recursive: true });
  writeFileSync(out, JSON.stringify({ generatedAt: new Date().toISOString(), checks }, null, 2));
  console.log(`Report: ${out}`);
}
process.exit(failed ? 1 : 0);
