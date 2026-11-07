// Entrance captures for the 21 galleries: screenshots the
// /capture/[layout] page of each gallery (a bare 3D render from its
// entrance) into public/gallery-thumbnails/<layout>.jpg (640×240).
// Drives headless Chromium over CDP with Node's built-in WebSocket —
// no extra dependency. Each page marks itself data-capture-ready
// once the scene has rendered; the script polls for that flag before
// shooting, and reports every failure instead of inventing an image.
//
// Usage: start the dev server first (npm run dev), then:
//   node scripts/capture-galleries.mjs [layout ...]
// With no arguments it captures all 21 layouts. Env: CHROME_BIN,
// CAPTURE_BASE (default http://localhost:3000).
import { spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = process.env.CHROME_BIN ?? `${process.env.HOME}/workspace/chrome-for-testing/chrome-linux64/chrome`;
const BASE = process.env.CAPTURE_BASE ?? "http://localhost:3000";
// The thumbnails are displayed at 640×240, so capture at that size:
// a quarter of the pixels of 1280×480, and software WebGL renders
// each frame in ~1 s instead of ~4 s.
const WIDTH = 640;
const HEIGHT = 240;
const PORT = 9333;

const ALL_LAYOUTS = [
  "sunlight",
  "serpentine",
  "vitrine",
  "loft",
  "halle",
  "arche",
  "musee",
  "claire-voie",
  "parquet",
  "verriere",
  "pavillon",
  "classique",
  "atrium-blanc",
  "patio",
  "escalier",
  "salles-vertes",
  "couloir-sombre",
  "couloir-dore",
  "voutes",
  "courbes",
  "atrium-lattes",
];

const layouts = process.argv.slice(2).length ? process.argv.slice(2) : ALL_LAYOUTS;
for (const layout of layouts) {
  if (!ALL_LAYOUTS.includes(layout)) {
    console.error(`Unknown layout: ${layout}`);
    process.exit(2);
  }
}

// Minimal CDP client over Node's built-in WebSocket.
class Cdp {
  constructor(url) {
    this.ws = new WebSocket(url);
    this.nextId = 1;
    this.pending = new Map();
    this.ws.addEventListener("message", (event) => {
      const message = JSON.parse(event.data);
      if (message.id !== undefined && this.pending.has(message.id)) {
        const { resolve, reject } = this.pending.get(message.id);
        this.pending.delete(message.id);
        if (message.error) reject(new Error(`${message.error.message} (${message.error.code})`));
        else resolve(message.result);
      }
    });
  }
  ready() {
    return new Promise((resolve, reject) => {
      this.ws.addEventListener("open", resolve, { once: true });
      this.ws.addEventListener("error", reject, { once: true });
    });
  }
  send(method, params = {}) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }
  close() {
    this.ws.close();
  }
}

async function waitForHttp(url, timeoutMs = 30000) {
  const started = Date.now();
  for (;;) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // not up yet
    }
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for ${url}`);
    await sleep(500);
  }
}

async function main() {
  mkdirSync("public/gallery-thumbnails", { recursive: true });
  const chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    "--no-sandbox",
    "--disable-gpu",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--hide-scrollbars",
    "--user-data-dir=/tmp/chrome-capture-profile",
    "about:blank",
  ], { stdio: "ignore" });
  try {
    await waitForHttp(`http://localhost:${PORT}/json/version`);
    console.log(`Chromium up (CDP :${PORT}), capturing ${layouts.length} galleries from ${BASE}`);
    const failures = [];
    for (const layout of layouts) {
      const url = `${BASE}/capture/${layout}`;
      const started = Date.now();
      let tabId = null;
      try {
        const created = await fetch(`http://localhost:${PORT}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
        if (!created.ok) throw new Error(`Could not open a tab (${created.status})`);
        const tab = await created.json();
        tabId = tab.id;
        const cdp = new Cdp(tab.webSocketDebuggerUrl);
        await cdp.ready();
        await cdp.send("Page.enable");
        await cdp.send("Runtime.enable");
        // Force the exact viewport: --window-size leaves ~139 px of
        // headless chrome around the page, so the canvas would be
        // short. Bring the tab forward too, so requestAnimationFrame
        // runs at full speed instead of throttled.
        await cdp.send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
        await cdp.send("Page.bringToFront");
        // Wait for the page to mark itself ready (3D rendered).
        let ready = false;
        while (Date.now() - started < 120000) {
          const result = await cdp.send("Runtime.evaluate", {
            expression: `document.querySelector('[data-capture-ready="true"]') !== null`,
            returnByValue: true,
          });
          if (result.result?.value === true) {
            ready = true;
            break;
          }
          await sleep(500);
        }
        if (!ready) throw new Error("Timed out waiting for the 3D scene (data-capture-ready never appeared)");
        // One extra beat, so the frame on screen is the settled one.
        await sleep(500);
        const shot = await cdp.send("Page.captureScreenshot", { format: "jpeg", quality: 82 });
        if (!shot.data) throw new Error("Empty screenshot");
        const path = `public/gallery-thumbnails/${layout}.jpg`;
        writeFileSync(path, Buffer.from(shot.data, "base64"));
        console.log(`OK   ${layout} (${((Date.now() - started) / 1000).toFixed(1)}s) -> ${path}`);
        cdp.close();
      } catch (error) {
        console.error(`FAIL ${layout}: ${error instanceof Error ? error.message : String(error)}`);
        failures.push(layout);
      } finally {
        if (tabId) {
          await fetch(`http://localhost:${PORT}/json/close/${tabId}`).catch(() => undefined);
        }
      }
    }
    if (failures.length) {
      console.error(`\n${failures.length} capture(s) failed: ${failures.join(", ")}`);
      process.exitCode = 1;
    } else {
      console.log(`\nAll ${layouts.length} captures done.`);
    }
  } finally {
    chrome.kill();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
