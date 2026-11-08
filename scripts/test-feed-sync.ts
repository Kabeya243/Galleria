// Unit test for the publication-feed webhook sync (chantier 3/5).
// Run: node scripts/test-feed-sync.ts
// No database, no server: fetch is mocked and every branch of
// lib/feed-sync.ts is exercised — publish, unpublish, opt-out, no cover,
// missing key, webhook error, and timeout. All failures must stay
// fail-soft: syncPublicationFeed never throws.

import { absoluteCoverUrl, resolveFeedBaseUrl, syncPublicationFeed } from "../lib/feed-sync.ts";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) {
    console.log(`  ok   ${name}`);
  } else {
    failures++;
    console.log(`  FAIL ${name}\n       expected: ${JSON.stringify(expected)}\n       actual:   ${JSON.stringify(actual)}`);
  }
}

type Call = { url: string; method: string; headers: Record<string, string>; body: unknown };
type MockBehaviour = "ok" | "error500" | "throw" | "hang";

function makeMockFetch(behaviour: MockBehaviour = "ok") {
  const calls: Call[] = [];
  const fn = (async (url: string, init?: { headers?: Record<string, string>; body?: string; signal?: AbortSignal }) => {
    calls.push({
      url,
      method: "POST",
      headers: init?.headers ?? {},
      body: init?.body ? JSON.parse(init.body) : undefined,
    });
    if (behaviour === "throw") throw new Error("network down");
    if (behaviour === "hang") {
      await new Promise<void>((_resolve, reject) => {
        init?.signal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted.", "AbortError"));
        });
      });
    }
    if (behaviour === "error500") {
      return { ok: false, status: 500, text: async () => "Internal Server Error" };
    }
    return { ok: true, status: 200, text: async () => "{}" };
  }) as unknown as typeof fetch;
  return { fn, calls };
}

// Silence the expected console.error/warn noise from the fail-soft paths.
const origError = console.error;
const origWarn = console.warn;
function silenceLogs(): void {
  console.error = () => {};
  console.warn = () => {};
}
function restoreLogs(): void {
  console.error = origError;
  console.warn = origWarn;
}

const ORIGIN = "https://galleria-bice.vercel.app";
const BASE = { exhibitionId: "exh_1", authorId: "user_1", baseUrl: ORIGIN, internalKey: "secret-key" };

console.log("absoluteCoverUrl");
check("relative /api/r2 URL is absolutized", absoluteCoverUrl("/api/r2/uploads/u/abc.jpg", ORIGIN), `${ORIGIN}/api/r2/uploads/u/abc.jpg`);
check("legacy relative /api/uploads URL is absolutized", absoluteCoverUrl("/api/uploads/xyz.jpg", ORIGIN), `${ORIGIN}/api/uploads/xyz.jpg`);
check("absolute https URL passes through", absoluteCoverUrl("https://pub-xxxx.r2.dev/uploads/u/abc.jpg", ORIGIN), "https://pub-xxxx.r2.dev/uploads/u/abc.jpg");
check("http URL is rejected (feed API requires https)", absoluteCoverUrl("http://localhost:3000/api/r2/x.jpg", ORIGIN), null);
check("null cover stays null", absoluteCoverUrl(null, ORIGIN), null);
check("empty cover stays null", absoluteCoverUrl("", ORIGIN), null);

console.log("resolveFeedBaseUrl");
delete process.env.SOCIAL_API_URL;
check("falls back to the request origin", resolveFeedBaseUrl(`${ORIGIN}/api/exhibitions/exh_1/publish`), ORIGIN);
process.env.SOCIAL_API_URL = "https://feed.example.com/";
check("SOCIAL_API_URL override wins, trailing slash trimmed", resolveFeedBaseUrl(`${ORIGIN}/api/exhibitions/exh_1/publish`), "https://feed.example.com");
delete process.env.SOCIAL_API_URL;

console.log("syncPublicationFeed — publish path");
{
  const { fn, calls } = makeMockFetch();
  const result = await syncPublicationFeed(
    { ...BASE, status: "public", visibility: "public", publishToFeed: true, coverImageUrl: `${ORIGIN}/api/r2/uploads/u/abc.jpg` },
    fn,
  );
  check("public/public + cover returns published", result, "published");
  check("one webhook call", calls.length, 1);
  check("calls exhibition-published on the same origin", calls[0]?.url, `${ORIGIN}/api/social/internal/exhibition-published`);
  check("sends the internal key header", calls[0]?.headers["X-Sanaa-Internal-Key"], "secret-key");
  check(
    "body carries exhibitionId, authorId, cover and publishToFeed",
    calls[0]?.body,
    { exhibitionId: "exh_1", authorId: "user_1", coverImageUrl: `${ORIGIN}/api/r2/uploads/u/abc.jpg`, publishToFeed: true },
  );
}

console.log("syncPublicationFeed — unpublish paths");
for (const [label, input] of [
  ["private-link calls unpublish", { ...BASE, status: "public", visibility: "private-link", publishToFeed: true, coverImageUrl: `${ORIGIN}/api/r2/x.jpg` }],
  ["password calls unpublish", { ...BASE, status: "public", visibility: "password", publishToFeed: true, coverImageUrl: `${ORIGIN}/api/r2/x.jpg` }],
  ["toggle back to draft calls unpublish", { ...BASE, status: "draft", visibility: "public", publishToFeed: true, coverImageUrl: `${ORIGIN}/api/r2/x.jpg` }],
] as const) {
  const { fn, calls } = makeMockFetch();
  const result = await syncPublicationFeed(input, fn);
  check(`${label} → unpublished`, result, "unpublished");
  check(`${label} → one call`, calls.length, 1);
  check(`${label} → exhibition-unpublished`, calls[0]?.url, `${ORIGIN}/api/social/internal/exhibition-unpublished`);
  check(`${label} → body is just the exhibition id`, calls[0]?.body, { exhibitionId: "exh_1" });
}

console.log("syncPublicationFeed — opt-out and no-cover");
{
  const { fn, calls } = makeMockFetch();
  const result = await syncPublicationFeed(
    { ...BASE, status: "public", visibility: "public", publishToFeed: false, coverImageUrl: `${ORIGIN}/api/r2/x.jpg` },
    fn,
  );
  check("publishToFeed=false returns unpublished", result, "unpublished");
  check("publishToFeed=false calls exhibition-published with publishToFeed:false", calls[0]?.body, {
    exhibitionId: "exh_1",
    authorId: "user_1",
    coverImageUrl: null,
    publishToFeed: false,
  });
}
{
  const { fn, calls } = makeMockFetch();
  silenceLogs();
  const result = await syncPublicationFeed(
    { ...BASE, status: "public", visibility: "public", publishToFeed: true, coverImageUrl: null },
    fn,
  );
  restoreLogs();
  check("no cover image → skipped-no-cover", result, "skipped-no-cover");
  check("no cover image → webhook never called", calls.length, 0);
}
{
  const { fn, calls } = makeMockFetch();
  silenceLogs();
  const result = await syncPublicationFeed(
    { ...BASE, status: "public", visibility: "public", publishToFeed: true, coverImageUrl: `${ORIGIN}/api/r2/x.jpg`, internalKey: undefined },
    fn,
  );
  restoreLogs();
  check("missing internal key → skipped-no-key", result, "skipped-no-key");
  check("missing internal key → webhook never called", calls.length, 0);
}

console.log("syncPublicationFeed — fail-soft");
{
  const { fn } = makeMockFetch("throw");
  silenceLogs();
  const result = await syncPublicationFeed(
    { ...BASE, status: "public", visibility: "public", publishToFeed: true, coverImageUrl: `${ORIGIN}/api/r2/x.jpg` },
    fn,
  );
  restoreLogs();
  check("fetch throwing does not throw (publication still succeeds)", result, "published");
}
{
  const { fn } = makeMockFetch("error500");
  silenceLogs();
  const result = await syncPublicationFeed(
    { ...BASE, status: "public", visibility: "public", publishToFeed: true, coverImageUrl: `${ORIGIN}/api/r2/x.jpg` },
    fn,
  );
  restoreLogs();
  check("webhook 500 does not throw (publication still succeeds)", result, "published");
}
{
  const { fn } = makeMockFetch("hang");
  silenceLogs();
  const started = Date.now();
  const result = await syncPublicationFeed(
    { ...BASE, status: "public", visibility: "public", publishToFeed: true, coverImageUrl: `${ORIGIN}/api/r2/x.jpg` },
    fn,
    { timeoutMs: 50 },
  );
  const elapsed = Date.now() - started;
  restoreLogs();
  check("hung webhook aborts on timeout and does not throw", result, "published");
  check("timeout is short (under 2 s)", elapsed < 2000, true);
}

console.log(failures === 0 ? "\nAll feed-sync checks passed." : `\n${failures} check(s) FAILED.`);
process.exit(failures === 0 ? 0 : 1);
