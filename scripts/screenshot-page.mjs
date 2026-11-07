// One-off page screenshot via the stock headless Chrome (CDP).
// Usage: node scripts/screenshot-page.mjs <url-path> <out.png|jpg> [width] [height] [waitMs] [full]
// With "full" as the 6th argument, captures the whole page height.
import { spawn } from "node:child_process";
import { writeFileSync } from "node:fs";
import { setTimeout as sleep } from "node:timers/promises";

const CHROME = `${process.env.HOME}/workspace/chrome-for-testing/chrome-linux64/chrome`;
const BASE = process.env.CAPTURE_BASE ?? "http://localhost:3000";
const PORT = 9338;

const [path, out, widthArg, heightArg, waitArg, fullArg, scrollArg] = process.argv.slice(2);
if (!path || !out) {
  console.error("Usage: node scripts/screenshot-page.mjs <url-path> <out> [width] [height] [waitMs]");
  process.exit(2);
}
const WIDTH = Number(widthArg ?? 1280);
const HEIGHT = Number(heightArg ?? 800);
const WAIT = Number(waitArg ?? 8000);

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
        if (message.error) reject(new Error(message.error.message));
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
  close() { this.ws.close(); }
}

async function waitForHttp(url, timeoutMs = 30000) {
  const started = Date.now();
  for (;;) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch { /* not up yet */ }
    if (Date.now() - started > timeoutMs) throw new Error(`Timed out waiting for ${url}`);
    await sleep(500);
  }
}

async function main() {
  const chrome = spawn(CHROME, [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--window-size=${WIDTH},${HEIGHT}`,
    "--no-sandbox",
    "--disable-gpu",
    "--use-angle=swiftshader",
    "--enable-unsafe-swiftshader",
    "--hide-scrollbars",
    "--user-data-dir=/tmp/chrome-shot-profile",
    "about:blank",
  ], { stdio: "ignore" });
  try {
    await waitForHttp(`http://localhost:${PORT}/json/version`);
    const url = `${BASE}${path}`;
    const created = await fetch(`http://localhost:${PORT}/json/new?${encodeURIComponent(url)}`, { method: "PUT" });
    const tab = await created.json();
    const cdp = new Cdp(tab.webSocketDebuggerUrl);
    await cdp.ready();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Emulation.setDeviceMetricsOverride", { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false });
    await cdp.send("Page.bringToFront");
    await sleep(WAIT);
    if (scrollArg) {
      await cdp.send("Runtime.evaluate", { expression: `(function(){ const m = document.querySelector("main"); if (m) { m.scrollTop = ${Number(scrollArg)}; return "main:" + m.scrollTop; } window.scrollTo(0, ${Number(scrollArg)}); return "win:" + window.scrollY; })();` });
      await sleep(1500);
    }
    const shot = await cdp.send("Page.captureScreenshot", {
      format: out.endsWith(".jpg") ? "jpeg" : "png",
      quality: 85,
      captureBeyondViewport: fullArg === "full",
    });
    writeFileSync(out, Buffer.from(shot.data, "base64"));
    console.log(`OK ${url} -> ${out}`);
    cdp.close();
  } finally {
    chrome.kill();
  }
}

main().catch((error) => { console.error(error.message); process.exit(1); });
