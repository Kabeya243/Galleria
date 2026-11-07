import { NextResponse } from "next/server";

// Exchange rates for the tools (Frankfurter, ECB reference rates).
//
// Frankfurter is free, no key, no sign-up, no monthly quota:
//   GET https://api.frankfurter.dev/v2/rates?base=USD&quotes=EUR,GBP,CHF,UGX,KES,ZAR,XOF
// returns an array of { date, base, quote, rate } — one entry per
// currency, each dated with the latest rate available for it. Rates are
// daily (published on business days around 16:00 CET), not live, and
// there is no crypto.
//
// This route normalises the array into one object, caches it in memory
// for 24 h, and — if Frankfurter does not answer — serves the last rates
// we have (marked stale) instead of failing. The response also carries a
// CDN cache header, so a warm edge cache keeps serving the last good
// rates even across a cold start. Only when there is no rate at all
// (first call ever, Frankfurter down) does it answer 503, and the
// clients then show prices in their listing currency only.
//
// Public: visitors need rates without signing in (marketplace pages).

export const dynamic = "force-dynamic";

const FRANKFURTER_URL =
  "https://api.frankfurter.dev/v2/rates?base=USD&quotes=EUR,GBP,CHF,UGX,KES,ZAR,XOF";

const CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 h
const FETCH_TIMEOUT_MS = 8000;

type CachedRates = { date: string; rates: Record<string, number>; fetchedAt: number };

let cache: CachedRates | null = null;

type FrankfurterEntry = { date?: unknown; base?: unknown; quote?: unknown; rate?: unknown };

async function fetchFreshRates(): Promise<CachedRates> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(FRANKFURTER_URL, { signal: controller.signal, cache: "no-store" });
    if (!res.ok) throw new Error(`Frankfurter answered ${res.status}`);
    const json: unknown = await res.json();
    if (!Array.isArray(json) || json.length === 0) throw new Error("Frankfurter returned no rates");
    const rates: Record<string, number> = {};
    let latestDate = "";
    for (const entry of json as FrankfurterEntry[]) {
      if (
        typeof entry.quote !== "string" ||
        typeof entry.rate !== "number" ||
        !Number.isFinite(entry.rate) ||
        entry.rate <= 0
      ) {
        continue;
      }
      rates[entry.quote] = entry.rate;
      if (typeof entry.date === "string" && entry.date > latestDate) latestDate = entry.date;
    }
    if (Object.keys(rates).length === 0 || !latestDate) {
      throw new Error("Frankfurter returned no usable rates");
    }
    return { date: latestDate, rates, fetchedAt: Date.now() };
  } finally {
    clearTimeout(timer);
  }
}

export async function GET() {
  const now = Date.now();
  if (cache && now - cache.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(
      { base: "USD", date: cache.date, rates: cache.rates, stale: false },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" } },
    );
  }
  try {
    const fresh = await fetchFreshRates();
    cache = fresh;
    return NextResponse.json(
      { base: "USD", date: fresh.date, rates: fresh.rates, stale: false },
      { headers: { "Cache-Control": "public, s-maxage=86400, stale-while-revalidate=86400" } },
    );
  } catch {
    if (cache) {
      // Frankfurter did not answer: serve yesterday's rates and say so.
      return NextResponse.json(
        { base: "USD", date: cache.date, rates: cache.rates, stale: true },
        { headers: { "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400" } },
      );
    }
    return NextResponse.json(
      { error: "Exchange rates are unavailable right now. Prices are shown in US dollars only." },
      { status: 503 },
    );
  }
}
