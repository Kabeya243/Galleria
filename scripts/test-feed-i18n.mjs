// Publication feed checks (chantier 5/5) — i18n keys + non-regression.
//
// Run: node scripts/test-feed-i18n.mjs
// Exit 0 when every check passes, 1 otherwise.
//
// Checks:
//   (a) the `feed` section of lib/i18n.ts has all 16 keys, each with a
//       non-empty fr AND en string (chantier 4 suggestion);
//   (b) components/feed-page.tsx reads live data only — it fetches
//       /api/social/feed and contains no hard-coded exhibition data;
//   (c) the / and /galleries routes are untouched by this chantier:
//       app/page.tsx, app/galleries/page.tsx, components/hub-page.tsx
//       and components/galleries-page.tsx are unmodified vs HEAD.
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const failures = [];
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` — ${detail}` : ""}`);
  if (!ok) failures.push(name);
};

// --- (a) i18n feed keys -------------------------------------------------
const EXPECTED_KEYS = [
  "feed", "eyebrow", "title", "copy", "feedLabel", "loading", "empty",
  "loadMore", "loadingMore", "visit", "like", "unlike", "error",
  "signIn", "likeError", "retry",
];
const i18n = readFileSync(join(ROOT, "lib", "i18n.ts"), "utf8");
const sectionStart = i18n.indexOf("// Publication feed (/feed)");
const sectionEnd = i18n.indexOf("// Tools hub (/tools)");
const section = i18n.slice(sectionStart, sectionEnd);
check("i18n feed section found", sectionStart !== -1 && sectionEnd > sectionStart);
for (const key of EXPECTED_KEYS) {
  const match = section.match(
    new RegExp(`${key}:\\s*\\{[^}]*?fr:\\s*"([^"]+)"[^}]*?en:\\s*"([^"]+)"`, "s"),
  );
  check(
    `i18n feed.${key} has non-empty fr + en`,
    Boolean(match?.[1]?.trim() && match?.[2]?.trim()),
    match ? `fr="${match[1].slice(0, 40)}" en="${match[2].slice(0, 40)}"` : "missing",
  );
}

// --- (b) feed page reads live data only ----------------------------------
const feedPage = readFileSync(join(ROOT, "components", "feed-page.tsx"), "utf8");
check("feed page fetches /api/social/feed", feedPage.includes("/api/social/feed"));
check(
  "feed page has no hard-coded exhibition data",
  !/const\s+(MOCK|FAKE|PLACEHOLDER|DEMO)_(POSTS|EXHIBITIONS)\b/.test(feedPage),
);

// --- (c) / and /galleries untouched --------------------------------------
const ROUTE_FILES = [
  "app/page.tsx",
  "app/galleries/page.tsx",
  "components/hub-page.tsx",
  "components/galleries-page.tsx",
];
for (const file of ROUTE_FILES) {
  let untouched = false;
  try {
    execFileSync("git", ["diff", "--quiet", "HEAD", "--", file], { cwd: ROOT, stdio: "ignore" });
    const status = execFileSync("git", ["status", "--porcelain", "--", file], { cwd: ROOT })
      .toString().trim();
    untouched = status === "";
  } catch {
    untouched = false;
  }
  check(`${file} unmodified vs HEAD (non-regression / and /galleries)`, untouched);
}

if (failures.length) {
  console.log(`\n${failures.length} check(s) failed.`);
  process.exit(1);
}
console.log("\nAll feed i18n / non-regression checks passed.");
