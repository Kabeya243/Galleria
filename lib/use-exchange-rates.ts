// Client hooks for exchange rates and the visitor's display currency.
//
// useExchangeRates: every component on a page shares ONE fetch of
// /api/rates (module-level in-flight promise + result cache), so a
// marketplace grid with twenty prices still makes a single request.
// A missing rate never blocks anything: the hook reports "unavailable"
// and callers fall back to the listing's own currency.
//
// useDisplayCurrency: the visitor's chosen currency, kept in
// localStorage ("sanaa-display-currency", default USD) and synced across
// every component on the page through a CustomEvent + the storage event.
// useSyncExternalStore keeps server rendering honest: the server renders
// USD, the client picks up the stored choice right after subscribing
// and re-renders if it differs.

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { isSupportedCurrency, type CurrencyCode, type RatesResponse } from "@/lib/currency";

export type RatesState =
  | { status: "loading"; rates: null; date: null; stale: false }
  | { status: "ready"; rates: RatesResponse["rates"]; date: string; stale: boolean }
  | { status: "unavailable"; rates: null; date: null; stale: false };

let cachedRates: RatesResponse | null = null;
let inflight: Promise<RatesResponse> | null = null;

async function loadRates(): Promise<RatesResponse> {
  if (cachedRates) return cachedRates;
  if (!inflight) {
    inflight = (async () => {
      const res = await fetch("/api/rates");
      if (!res.ok) throw new Error(`Rates request failed: ${res.status}`);
      const json = (await res.json()) as RatesResponse;
      if (!json || typeof json !== "object" || !json.rates || typeof json.rates !== "object") {
        throw new Error("Bad rates response");
      }
      cachedRates = json;
      return json;
    })();
    // Clear the marker once settled so a later retry can happen.
    inflight.then(
      () => {
        inflight = null;
      },
      () => {
        inflight = null;
      },
    );
  }
  return inflight;
}

export function useExchangeRates(): RatesState {
  const [state, setState] = useState<RatesState>({ status: "loading", rates: null, date: null, stale: false });
  useEffect(() => {
    let cancelled = false;
    loadRates()
      .then((json) => {
        if (!cancelled) setState({ status: "ready", rates: json.rates, date: json.date, stale: json.stale });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "unavailable", rates: null, date: null, stale: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return state;
}

// --- Visitor's display currency ------------------------------------------

const DISPLAY_CURRENCY_KEY = "sanaa-display-currency";
const DISPLAY_CURRENCY_EVENT = "sanaa:display-currency";

function readDisplayCurrency(): CurrencyCode {
  if (typeof window === "undefined") return "USD";
  try {
    const stored = window.localStorage.getItem(DISPLAY_CURRENCY_KEY);
    if (isSupportedCurrency(stored)) return stored;
  } catch {
    // Private mode or blocked storage — fall through to USD.
  }
  return "USD";
}

let displayCurrency: CurrencyCode = "USD";
const displayCurrencyListeners = new Set<() => void>();

function getDisplayCurrencySnapshot(): CurrencyCode {
  return displayCurrency;
}

function getDisplayCurrencyServerSnapshot(): CurrencyCode {
  return "USD";
}

function subscribeDisplayCurrency(onChange: () => void): () => void {
  displayCurrencyListeners.add(onChange);
  // First subscribe on the client picks up the stored choice; React
  // re-checks the snapshot right after subscribing and re-renders if it
  // differs from the server-rendered value.
  displayCurrency = readDisplayCurrency();
  const handler = () => {
    const next = readDisplayCurrency();
    if (next !== displayCurrency) {
      displayCurrency = next;
      displayCurrencyListeners.forEach((fn) => fn());
    }
  };
  window.addEventListener(DISPLAY_CURRENCY_EVENT, handler);
  window.addEventListener("storage", handler);
  return () => {
    displayCurrencyListeners.delete(onChange);
    window.removeEventListener(DISPLAY_CURRENCY_EVENT, handler);
    window.removeEventListener("storage", handler);
  };
}

export function useDisplayCurrency(): [CurrencyCode, (next: CurrencyCode) => void] {
  const currency = useSyncExternalStore(
    subscribeDisplayCurrency,
    getDisplayCurrencySnapshot,
    getDisplayCurrencyServerSnapshot,
  );
  const setCurrency = useCallback((next: CurrencyCode) => {
    try {
      window.localStorage.setItem(DISPLAY_CURRENCY_KEY, next);
    } catch {
      // Private mode or blocked storage — the choice just doesn't persist.
    }
    displayCurrency = next;
    window.dispatchEvent(new Event(DISPLAY_CURRENCY_EVENT));
    displayCurrencyListeners.forEach((fn) => fn());
  }, []);
  return [currency, setCurrency];
}
