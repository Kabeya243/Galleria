// Exchange rates (Frankfurter, ECB reference rates) + currency math.
//
// Frankfurter is free, no key, no sign-up, no monthly quota: the server
// route /api/rates fetches daily rates (base USD) and caches them 24 h.
// Everything in this file is pure — no fetch, no React — so it is safe to
// import from server and client code alike.
//
// Rates are quoted as "1 USD = X units of currency", so converting
// between two non-USD currencies goes through USD. Converted figures are
// display-rounded to whole units (artwork prices are whole numbers) and
// are always presented as approximate ("~").

export const BASE_CURRENCY = "USD" as const;

/** Currencies shown to buyers (the five in the brief). */
export const DISPLAY_CURRENCIES = ["USD", "EUR", "GBP", "CHF", "UGX"] as const;

/** Every currency a listing can be priced in (the marketplace list). */
export const ALL_CURRENCIES = ["USD", "EUR", "GBP", "UGX", "KES", "ZAR", "XOF", "CHF"] as const;

export type CurrencyCode = (typeof ALL_CURRENCIES)[number];

/** Rates keyed by currency code: units of that currency per 1 USD. */
export type RatesMap = Record<string, number>;

export type RatesResponse = {
  base: "USD";
  /** ISO date (yyyy-mm-dd) of the latest rate in the set. */
  date: string;
  rates: RatesMap;
  /** True when Frankfurter did not answer and these are the last rates we had. */
  stale: boolean;
};

export function isSupportedCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (ALL_CURRENCIES as readonly string[]).includes(value);
}

/** Units of `currency` per 1 USD, or null when unknown (USD is always 1). */
export function rateOf(currency: string, rates: RatesMap): number | null {
  if (currency === "USD") return 1;
  const rate = rates[currency];
  return typeof rate === "number" && Number.isFinite(rate) && rate > 0 ? rate : null;
}

/**
 * Convert `amount` from `from` to `to` using rates quoted per 1 USD.
 * Returns null when a rate is missing. Display rounding is whole units —
 * artwork prices are whole numbers, and converted figures are explicitly
 * approximate.
 */
export function convert(amount: number, from: string, to: string, rates: RatesMap): number | null {
  if (!Number.isFinite(amount)) return null;
  if (from === to) return Math.round(amount);
  const fromRate = rateOf(from, rates);
  const toRate = rateOf(to, rates);
  if (fromRate === null || toRate === null) return null;
  return Math.round((amount / fromRate) * toRate);
}

export function formatCurrency(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${Math.round(amount).toLocaleString("en-US")} ${currency}`;
  }
}

/** "2026-11-08" -> "8 November 2026". Falls back to the raw string. */
export function formatRateDate(isoDate: string): string {
  const parsed = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(parsed.getTime())) return isoDate;
  return parsed.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
}
