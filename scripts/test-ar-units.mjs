// Unit checks for the AR "Voir sur mon mur" shared helpers
// (lib/webxr.ts) — run by scripts/test-new-features.mjs, or directly:
//   node scripts/test-ar-units.mjs
//
// The helpers under test are pure (dimension parsing, hit-pose
// verticality, error mapping), so they run in plain node: the file is
// transpiled on the fly with the project's own TypeScript compiler
// (no extra dependency, no browser, no headset). The session itself
// (requestArSession, the animation loop, the reticle) cannot run
// headless — it is covered by code inspection in the harness and by
// the manual checks, and must be verified on a real ARCore phone.
//
// Exit code 0 when every case passes, 1 otherwise.

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";

const ROOT = join(fileURLToPath(import.meta.url), "..", "..");
const require = createRequire(import.meta.url);
const ts = require(join(ROOT, "node_modules", "typescript"));

const src = readFileSync(join(ROOT, "lib", "webxr.ts"), "utf8");
const transpiled = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2020 },
});
const tmpPath = join(ROOT, "node_modules", ".ar-webxr-test.mjs");
writeFileSync(tmpPath, transpiled.outputText);
const webxr = await import(tmpPath);

const { parseArtworkDimensions, hitPoseIsVertical, describeArError } = webxr;
const { AR_EYE_HEIGHT_M, AR_FIXED_DISTANCE_M, AR_FRAME_BORDER_M, AR_NO_WALL_TIMEOUT_MS } = webxr;

let passed = 0;
let failed = 0;
function check(name, ok, detail = "") {
  if (ok) {
    passed++;
    console.log(`PASS  [AR units] ${name}${detail ? ` — ${detail}` : ""}`);
  } else {
    failed++;
    console.log(`FAIL  [AR units] ${name}${detail ? ` — ${detail}` : ""}`);
  }
}
const close = (a, b) =>
  a === null ? b === null : b !== null && Math.abs(a.w - b.w) < 1e-9 && Math.abs(a.h - b.h) < 1e-9;

// Dimensions: cm to metres, the real-size rule the whole feature
// stands on. "130×94 cm" must become a 1.30 × 0.94 m plane.
for (const [input, want] of [
  ["130×94 cm", { w: 1.3, h: 0.94 }],
  ["120 x 89", { w: 1.2, h: 0.89 }],
  ["1,2×0,9 m", { w: 1.2, h: 0.9 }],
  ["92×86 cm", { w: 0.92, h: 0.86 }],
  ["130×94", { w: 1.3, h: 0.94 }],
  ["no dims", null],
  ["", null],
]) {
  check(`parseArtworkDimensions(${JSON.stringify(input)})`, close(parseArtworkDimensions(input), want), JSON.stringify(parseArtworkDimensions(input)));
}

// Verticality: the hit pose's local +Z is the plane normal. Identity
// (normal horizontal) is a wall; ±90° about X (normal straight
// up/down) is a floor/ceiling; 90° about Y is still a wall.
for (const [q, want, label] of [
  [{ x: 0, y: 0, z: 0, w: 1 }, true, "identity quaternion (wall)"],
  [{ x: -0.7071, y: 0, z: 0, w: 0.7071 }, false, "X -90° (normal -Y, floor)"],
  [{ x: 0.7071, y: 0, z: 0, w: 0.7071 }, false, "X +90° (normal +Y, ceiling)"],
  [{ x: 0, y: 0.7071, z: 0, w: 0.7071 }, true, "Y 90° (wall, turned)"],
]) {
  check(`hitPoseIsVertical: ${label}`, hitPoseIsVertical(q) === want, String(hitPoseIsVertical(q)));
}

// Error vocabulary: denied / noHitTest / failed map to the i18n keys
// the UI shows (never a raw browser message).
const denied = new Error("x");
denied.name = "NotAllowedError";
check("describeArError: NotAllowedError → denied", describeArError(denied) === "denied");
check(
  "describeArError: hit-test message → noHitTest",
  describeArError(new Error("hit-test not supported")) === "noHitTest",
);
check("describeArError: plain Error → failed", describeArError(new Error("boom")) === "failed");

// Constants the placement depends on.
check("AR_EYE_HEIGHT_M is 1.5 m", AR_EYE_HEIGHT_M === 1.5, String(AR_EYE_HEIGHT_M));
check("AR_FIXED_DISTANCE_M is 1.5 m", AR_FIXED_DISTANCE_M === 1.5, String(AR_FIXED_DISTANCE_M));
check("AR_FRAME_BORDER_M is 0.04 m", AR_FRAME_BORDER_M === 0.04, String(AR_FRAME_BORDER_M));
check("AR_NO_WALL_TIMEOUT_MS is 10000 ms", AR_NO_WALL_TIMEOUT_MS === 10000, String(AR_NO_WALL_TIMEOUT_MS));

console.log(`\nAR units: ${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
