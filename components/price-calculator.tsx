"use client";

import { useMemo, useState } from "react";
import { convert, formatCurrency, formatRateDate } from "@/lib/currency";
import { useExchangeRates } from "@/lib/use-exchange-rates";
import styles from "./tools.module.css";

const MEDIUMS = [
  "Charcoal",
  "Acrylic",
  "Oil",
  "Mixed media",
  "Graphite",
  "Pastel",
  "Collage",
  "Other",
] as const;

function money(value: number): string {
  return `$${Math.round(value).toLocaleString("en-US")}`;
}

// Price your work: a starting point, not a market price. Your cost is your
// hours at your rate plus your materials. The suggested price doubles that
// cost — after a gallery takes around 40–50% of the sale, you still cover
// what the piece cost you to make. The range (×1.5 to ×2.5) leaves room to
// sit below or above that, depending on the work and your market.
export default function PriceCalculator() {
  const [medium, setMedium] = useState<string>("Charcoal");
  const [widthCm, setWidthCm] = useState(130);
  const [heightCm, setHeightCm] = useState(94);
  const [hours, setHours] = useState(120);
  const [materials, setMaterials] = useState(150);
  const [hourlyRate, setHourlyRate] = useState(25);
  const rates = useExchangeRates();

  const result = useMemo(() => {
    const area = Math.max(0, widthCm) * Math.max(0, heightCm);
    const labour = Math.max(0, hours) * Math.max(0, hourlyRate);
    const materialCost = Math.max(0, materials);
    const cost = labour + materialCost;
    return {
      area,
      labour,
      materialCost,
      cost,
      low: cost * 1.5,
      recommended: cost * 2,
      high: cost * 2.5,
      perCm2: area > 0 ? (cost * 2) / area : 0,
    };
  }, [widthCm, heightCm, hours, materials, hourlyRate]);

  return (
    <div className={styles.calculator}>
      <div className={styles.calculatorForm}>
        <label className={styles.field}>
          <span>Medium</span>
          <select value={medium} onChange={(event) => setMedium(event.target.value)}>
            {MEDIUMS.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className={styles.field}>
          <span>Width (cm)</span>
          <input
            type="number"
            min={1}
            value={widthCm}
            onChange={(event) => setWidthCm(Number(event.target.value))}
          />
        </label>
        <label className={styles.field}>
          <span>Height (cm)</span>
          <input
            type="number"
            min={1}
            value={heightCm}
            onChange={(event) => setHeightCm(Number(event.target.value))}
          />
        </label>
        <label className={styles.field}>
          <span>Hours worked</span>
          <input
            type="number"
            min={0}
            value={hours}
            onChange={(event) => setHours(Number(event.target.value))}
          />
        </label>
        <label className={styles.field}>
          <span>Materials (USD)</span>
          <input
            type="number"
            min={0}
            value={materials}
            onChange={(event) => setMaterials(Number(event.target.value))}
          />
        </label>
        <label className={styles.field}>
          <span>Your hourly rate (USD)</span>
          <input
            type="number"
            min={0}
            value={hourlyRate}
            onChange={(event) => setHourlyRate(Number(event.target.value))}
          />
        </label>
      </div>

      <div className={styles.calculatorResult}>
        <p className={styles.resultEyebrow}>
          {medium} · {widthCm} × {heightCm} cm · {result.area.toLocaleString("en-US")} cm²
        </p>
        <p className={styles.resultPrice}>{money(result.recommended)}</p>
        <p className={styles.resultRange}>
          Suggested range: {money(result.low)} – {money(result.high)}
        </p>
        <dl className={styles.resultBreakdown}>
          <div>
            <dt>Your hours</dt>
            <dd>
              {hours} h × {money(hourlyRate)} = {money(result.labour)}
            </dd>
          </div>
          <div>
            <dt>Materials</dt>
            <dd>{money(result.materialCost)}</dd>
          </div>
          <div>
            <dt>What the piece cost you</dt>
            <dd>{money(result.cost)}</dd>
          </div>
          <div>
            <dt>Price per cm²</dt>
            <dd>{result.perCm2 > 0 ? `$${result.perCm2.toFixed(2)}` : "N/A"}</dd>
          </div>
        </dl>
        <p className={styles.resultNote}>
          A starting point, not a market price. Compare with similar works, your exhibition
          history and what your collectors have paid. A gallery usually takes around 40–50%
          of the sale price, doubling your cost means you still cover what the piece cost
          you to make.
        </p>

        {/* Multi-currency: the same suggested price in the buyer's currency. */}
        <div className={styles.resultCurrencies}>
          <p className={styles.resultCurrenciesTitle}>The same price in your buyer&apos;s currency</p>
          {rates.status === "loading" && <p className={styles.ratesNote}>Loading exchange rates…</p>}
          {rates.status === "unavailable" && (
            <p className={styles.ratesNote}>
              Exchange rates are unavailable right now. Prices are shown in US dollars only.
            </p>
          )}
          {rates.status === "ready" && (
            <>
              <dl className={styles.resultBreakdown}>
                {(["EUR", "GBP", "CHF", "UGX"] as const).map((code) => {
                  const recommended = convert(result.recommended, "USD", code, rates.rates);
                  const low = convert(result.low, "USD", code, rates.rates);
                  const high = convert(result.high, "USD", code, rates.rates);
                  if (recommended === null || low === null || high === null) return null;
                  return (
                    <div key={code}>
                      <dt>{code}</dt>
                      <dd>
                        {formatCurrency(recommended, code)}{" "}
                        <span className={styles.resultCurrenciesRange}>
                          ({formatCurrency(low, code)} – {formatCurrency(high, code)})
                        </span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
              <p className={styles.ratesNote}>
                ECB reference rates of {formatRateDate(rates.date)}, via Frankfurter (free, no
                sign-up). Converted figures are approximate.
                {rates.stale
                  ? " Frankfurter did not answer, showing the last rates we have."
                  : ""}
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
