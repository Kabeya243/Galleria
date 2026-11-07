"use client";

import { convert, formatCurrency, DISPLAY_CURRENCIES } from "@/lib/currency";
import { useDisplayCurrency, useExchangeRates } from "@/lib/use-exchange-rates";

// A listing price, shown in the visitor's chosen currency with the other
// buyer currencies alongside. Before rates load (or when they are
// unavailable) the listing's own currency is shown, so the price is never
// blank and the page still works with no JavaScript at all.
//
// Variants:
// - "browse" / "detail": the visitor-facing price — main figure in the
//   visitor's currency, conversions in the other buyer currencies.
// - "card": the seller's own listing card — main figure stays in the
//   listing currency (that is the price the seller set), conversions
//   underneath show what a buyer sees.

export default function ListingPrice({
  price,
  currency,
  variant = "browse",
}: {
  price: number | null;
  currency: string;
  variant?: "browse" | "detail" | "card";
}) {
  const [displayCurrency] = useDisplayCurrency();
  const rates = useExchangeRates();

  if (price === null || price === undefined) {
    return <span>Price on request</span>;
  }

  const ready = rates.status === "ready";
  const mainCurrency = ready && variant !== "card" ? displayCurrency : currency;
  const mainValue = ready ? convert(price, currency, mainCurrency, rates.rates) : price;
  const mainText = mainValue === null ? formatCurrency(price, currency) : formatCurrency(mainValue, mainCurrency);

  const others =
    ready && rates.rates
      ? DISPLAY_CURRENCIES.filter((code) => code !== mainCurrency)
          .map((code) => {
            const value = convert(price, currency, code, rates.rates);
            return value === null ? null : formatCurrency(value, code);
          })
          .filter((text): text is string => text !== null)
      : [];

  return (
    <span style={{ display: "block" }}>
      <span style={{ display: "block" }}>{mainText}</span>
      {others.length > 0 && (
        <span
          style={{
            display: "block",
            marginTop: variant === "detail" ? 6 : 2,
            fontSize: 12,
            fontWeight: 400,
            fontFamily: "var(--font-body, inherit)",
            color: "var(--muted)",
            lineHeight: 1.5,
          }}
        >
          ≈ {others.join(" · ")}
        </span>
      )}
    </span>
  );
}
