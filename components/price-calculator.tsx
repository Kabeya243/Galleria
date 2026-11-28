"use client";

import { useMemo, useState } from "react";
import { convert, formatCurrency, formatRateDate } from "@/lib/currency";
import { useExchangeRates } from "@/lib/use-exchange-rates";
import { LOCALE_NAMES, useLocale } from "@/lib/i18n";
import { buildPriceSuggestionPrompt, parseAiJson } from "@/lib/ai-tools-prompts";
import { callAiGenerate } from "@/lib/ai-generate-client";
import page from "./redesign-pages.module.css";
import dash from "./redesign-dashboard.module.css";

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

type AiPriceSuggestion = {
  low: number;
  recommended: number;
  high: number;
  justification: string;
};

function isValidSuggestion(value: unknown): value is AiPriceSuggestion {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.low === "number" &&
    typeof v.recommended === "number" &&
    typeof v.high === "number" &&
    Number.isFinite(v.low) &&
    Number.isFinite(v.recommended) &&
    Number.isFinite(v.high) &&
    v.low > 0 &&
    v.low < v.recommended &&
    v.recommended < v.high &&
    typeof v.justification === "string" &&
    v.justification.trim().length > 0
  );
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
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [hours, setHours] = useState(120);
  const [materials, setMaterials] = useState(150);
  const [hourlyRate, setHourlyRate] = useState(25);
  const rates = useExchangeRates();
  const { locale } = useLocale();

  // AI suggestion: shown next to the cost-based price, never applied.
  // The artist keeps the cost-based price unless they choose otherwise.
  const [aiBusy, setAiBusy] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState<AiPriceSuggestion | null>(null);
  const [aiRawText, setAiRawText] = useState<string | null>(null);
  const [aiError, setAiError] = useState<string | null>(null);

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

  // The artist's own listed prices, in USD, so the suggestion sits near
  // their real prices. Non-USD listings are converted when exchange
  // rates are ready; otherwise only USD listings are used. A failed
  // fetch simply means an empty list, the prompt says so plainly.
  async function fetchOwnPricesUsd(): Promise<number[]> {
    try {
      const res = await fetch("/api/listings?mine=1");
      if (!res.ok) return [];
      const data = (await res.json()) as {
        listings?: Array<{ price?: number | null; currency?: string }>;
      };
      const rows = Array.isArray(data.listings) ? data.listings : [];
      const prices: number[] = [];
      for (const row of rows) {
        if (typeof row.price !== "number" || row.price <= 0) continue;
        const currency = row.currency || "USD";
        if (currency === "USD") {
          prices.push(Math.round(row.price));
        } else if (rates.status === "ready" && rates.rates) {
          const usd = convert(row.price, currency, "USD", rates.rates);
          if (usd !== null && usd > 0) prices.push(usd);
        }
      }
      return prices.slice(0, 20);
    } catch {
      return [];
    }
  }

  async function suggestWithAi() {
    if (aiBusy) return;
    setAiBusy(true);
    setAiError(null);
    setAiRawText(null);
    try {
      const existingPrices = await fetchOwnPricesUsd();
      const { system, prompt } = buildPriceSuggestionPrompt({
        medium,
        widthCm,
        heightCm,
        year: year.trim(),
        costLow: result.low,
        costRecommended: result.recommended,
        costHigh: result.high,
        existingPrices,
        language: LOCALE_NAMES[locale],
      });
      const reply = await callAiGenerate({ prompt, system, maxTokens: 400 });
      const parsed = parseAiJson<AiPriceSuggestion>(reply.text);
      if (!isValidSuggestion(parsed)) {
        // The reply was not the JSON asked for: show the raw text and
        // say so, instead of guessing a range from it.
        setAiSuggestion(null);
        setAiRawText(reply.text);
        return;
      }
      setAiSuggestion(parsed);
    } catch (err) {
      setAiError(err instanceof Error ? err.message : "The AI request failed. Try again.");
    } finally {
      setAiBusy(false);
    }
  }

  return (
    <div className={page.sectionStack}>
      <section className={dash.card} aria-label="Price inputs">
        <div className={page.formGrid}>
          <label className={page.field}>
            <span>Medium</span>
            <select value={medium} onChange={(event) => setMedium(event.target.value)} className={page.select}>
              {MEDIUMS.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>
          <label className={page.field}>
            <span>Width (cm)</span>
            <input
              type="number"
              min={1}
              value={widthCm}
              onChange={(event) => setWidthCm(Number(event.target.value))}
              className={page.input}
            />
          </label>
          <label className={page.field}>
            <span>Height (cm)</span>
            <input
              type="number"
              min={1}
              value={heightCm}
              onChange={(event) => setHeightCm(Number(event.target.value))}
              className={page.input}
            />
          </label>
          <label className={page.field}>
            <span>Year</span>
            <input
              type="number"
              min={1900}
              max={2100}
              value={year}
              onChange={(event) => setYear(event.target.value)}
              className={page.input}
            />
          </label>
          <label className={page.field}>
            <span>Hours worked</span>
            <input
              type="number"
              min={0}
              value={hours}
              onChange={(event) => setHours(Number(event.target.value))}
              className={page.input}
            />
          </label>
          <label className={page.field}>
            <span>Materials (USD)</span>
            <input
              type="number"
              min={0}
              value={materials}
              onChange={(event) => setMaterials(Number(event.target.value))}
              className={page.input}
            />
          </label>
          <label className={page.field}>
            <span>Your hourly rate (USD)</span>
            <input
              type="number"
              min={0}
              value={hourlyRate}
              onChange={(event) => setHourlyRate(Number(event.target.value))}
              className={page.input}
            />
          </label>
        </div>
      </section>

      <section className={dash.card} aria-label="Suggested price">
        <div className={dash.cardHead}>
          <div>
            <span className={dash.eyebrow}>
              {medium} · {widthCm} × {heightCm} cm · {year.trim() || "no year"} · {result.area.toLocaleString("en-US")} cm²
            </span>
            <h2>Suggested price</h2>
          </div>
        </div>
        <div className={`${dash.kpiValue} ${dash.tnum}`} style={{ marginTop: 12 }}>
          {money(result.recommended)}
        </div>
        <p className={dash.cardSub}>
          Suggested range: {money(result.low)} – {money(result.high)}
        </p>
        <dl style={{ margin: "16px 0 0" }}>
          <div className={page.row}>
            <dt className={page.rowMain} style={{ fontSize: 13.5, color: "var(--rd-t2)" }}>Your hours</dt>
            <dd className={page.rowSide} style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>
              {hours} h × {money(hourlyRate)} = {money(result.labour)}
            </dd>
          </div>
          <div className={page.row}>
            <dt className={page.rowMain} style={{ fontSize: 13.5, color: "var(--rd-t2)" }}>Materials</dt>
            <dd className={page.rowSide} style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>{money(result.materialCost)}</dd>
          </div>
          <div className={page.row}>
            <dt className={page.rowMain} style={{ fontSize: 13.5, color: "var(--rd-t2)" }}>What the piece cost you</dt>
            <dd className={page.rowSide} style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>{money(result.cost)}</dd>
          </div>
          <div className={page.row}>
            <dt className={page.rowMain} style={{ fontSize: 13.5, color: "var(--rd-t2)" }}>Price per cm²</dt>
            <dd className={page.rowSide} style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>
              {result.perCm2 > 0 ? `$${result.perCm2.toFixed(2)}` : "N/A"}
            </dd>
          </div>
        </dl>
        <p className={dash.cardSub} style={{ marginTop: 16 }}>
          A starting point, not a market price. Compare with similar works, your exhibition
          history and what your collectors have paid. A gallery usually takes around 40–50%
          of the sale price, doubling your cost means you still cover what the piece cost
          you to make.
        </p>

        {/* AI suggestion: a second opinion next to the cost-based price.
            It never replaces your price, you decide what to use. */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--rd-border)" }}>
          <p style={{ margin: "0 0 4px", fontSize: 13.5, fontWeight: 700 }}>AI suggestion</p>
          <p className={dash.cardSub} style={{ margin: "0 0 12px" }}>
            A second opinion based on your cost, your size and medium, and the prices
            of your other listed works. It does not change the price above.
          </p>
          <button
            type="button"
            className={`${page.btn} ${page.btnCta}`}
            onClick={() => void suggestWithAi()}
            disabled={aiBusy}
          >
            {aiBusy ? "Thinking…" : aiSuggestion ? "Suggest again" : "Get an AI price suggestion"}
          </button>
          {aiError && (
            <p role="alert" className={dash.cardSub} style={{ marginTop: 12, color: "var(--rd-red)", fontWeight: 600 }}>
              {aiError}
            </p>
          )}
          {aiRawText && !aiSuggestion && (
            <div style={{ marginTop: 12 }}>
              <p className={dash.cardSub} style={{ color: "var(--rd-red)", fontWeight: 600 }}>
                The reply was not clear, so no range is shown. Here is the raw text:
              </p>
              <p
                className={dash.cardSub}
                style={{
                  marginTop: 8,
                  padding: 12,
                  border: "1px solid var(--rd-border)",
                  borderRadius: 8,
                  whiteSpace: "pre-wrap",
                }}
              >
                {aiRawText}
              </p>
            </div>
          )}
          {aiSuggestion && (
            <div style={{ marginTop: 16 }}>
              <div className={`${dash.kpiValue} ${dash.tnum}`}>{money(aiSuggestion.recommended)}</div>
              <p className={dash.cardSub}>
                AI range: {money(aiSuggestion.low)} – {money(aiSuggestion.high)}
              </p>
              <p className={dash.cardSub} style={{ marginTop: 8 }}>
                {aiSuggestion.justification}
              </p>
              <p className={dash.cardSub} style={{ marginTop: 8 }}>
                A suggestion only. Your cost-based price above stays as it is until you
                decide otherwise.
              </p>
            </div>
          )}
        </div>

        {/* Multi-currency: the same suggested price in the buyer's currency. */}
        <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid var(--rd-border)" }}>
          <p style={{ margin: "0 0 8px", fontSize: 13.5, fontWeight: 700 }}>The same price in your buyer&apos;s currency</p>
          {rates.status === "loading" && <p className={dash.cardSub}>Loading exchange rates…</p>}
          {rates.status === "unavailable" && (
            <p className={dash.cardSub}>
              Exchange rates are unavailable right now. Prices are shown in US dollars only.
            </p>
          )}
          {rates.status === "ready" && (
            <>
              <dl style={{ margin: 0 }}>
                {(["EUR", "GBP", "CHF", "UGX"] as const).map((code) => {
                  const recommended = convert(result.recommended, "USD", code, rates.rates);
                  const low = convert(result.low, "USD", code, rates.rates);
                  const high = convert(result.high, "USD", code, rates.rates);
                  if (recommended === null || low === null || high === null) return null;
                  return (
                    <div key={code} className={page.row}>
                      <dt className={page.rowMain} style={{ fontSize: 13.5, color: "var(--rd-t2)" }}>{code}</dt>
                      <dd className={page.rowSide} style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>
                        {formatCurrency(recommended, code)}{" "}
                        <span style={{ color: "var(--rd-t2)", fontWeight: 400 }}>
                          ({formatCurrency(low, code)} – {formatCurrency(high, code)})
                        </span>
                      </dd>
                    </div>
                  );
                })}
              </dl>
              <p className={dash.cardSub} style={{ marginTop: 12 }}>
                ECB reference rates of {formatRateDate(rates.date)}, via Frankfurter (free, no
                sign-up). Converted figures are approximate.
                {rates.stale
                  ? " Frankfurter did not answer, showing the last rates we have."
                  : ""}
              </p>
            </>
          )}
        </div>
      </section>
    </div>
  );
}
