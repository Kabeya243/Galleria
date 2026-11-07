"use client";

import { ALL_CURRENCIES, formatRateDate, type CurrencyCode } from "@/lib/currency";
import { useDisplayCurrency, useExchangeRates } from "@/lib/use-exchange-rates";

const LABELS: Record<CurrencyCode, string> = {
  USD: "USD — $",
  EUR: "EUR — €",
  GBP: "GBP — £",
  CHF: "CHF",
  UGX: "UGX",
  KES: "KES",
  ZAR: "ZAR",
  XOF: "XOF",
};

/** Visitor currency selector: which currency prices are shown in. */
export default function CurrencySelector({ id }: { id?: string }) {
  const [currency, setCurrency] = useDisplayCurrency();
  return (
    <label
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 8,
        fontSize: 13,
        color: "var(--muted)",
      }}
    >
      <span>Prices in</span>
      <select
        id={id}
        value={currency}
        onChange={(event) => setCurrency(event.target.value as CurrencyCode)}
        aria-label="Currency for prices"
        style={{
          padding: "8px 10px",
          border: "1px solid var(--line)",
          borderRadius: 6,
          background: "var(--paper)",
          color: "var(--ink)",
          font: "inherit",
          fontSize: 13,
        }}
      >
        {ALL_CURRENCIES.map((code) => (
          <option key={code} value={code}>
            {LABELS[code]}
          </option>
        ))}
      </select>
    </label>
  );
}

/**
 * One line stating which exchange rates the converted prices use, or why
 * there are none. Renders nothing while rates are still loading, so the
 * page does not flicker.
 */
export function RatesNote() {
  const rates = useExchangeRates();
  if (rates.status === "loading") return null;
  if (rates.status === "unavailable") {
    return (
      <span style={{ fontSize: 12, color: "var(--muted)" }}>
        Exchange rates are unavailable right now — prices are shown in their listing currency.
      </span>
    );
  }
  return (
    <span style={{ fontSize: 12, color: "var(--muted)" }}>
      Converted at the ECB reference rates of {formatRateDate(rates.date)} (via Frankfurter)
      {rates.stale ? " — Frankfurter did not answer, showing the last rates we have." : "."}
    </span>
  );
}
