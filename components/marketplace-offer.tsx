"use client";

import { useEffect, useState } from "react";
import { useLocale, useT } from "@/lib/i18n";
import { BuyerGuide } from "@/components/marketplace-guides";
import type { ClientOffer, ClientOrder } from "@/lib/marketplace-sales";

// Buy and make an offer, on a public listing page. The buyer can buy
// at the shown price or make an offer; the seller's minimum price
// bounds the negotiation, and offers below it are refused
// automatically (the server answers with the minimum, shown here).
// When an offer is accepted, the buyer pays the agreed price through
// Lakisa. The fee split is shown before confirming: the agreed price,
// the Lakisa commission, the Flutterwave payment fee (indicative
// rate), what the seller receives, and what the buyer pays. No real
// payment moves: Flutterwave is not connected, so the order is
// recorded as pending payment. The buyer guide opens the first time
// the buyer starts an offer or a purchase.

function money(amount: number | null, currency: string): string {
  if (amount === null || amount === undefined) return "Price on request";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(result.error ?? "Something went wrong.");
  return result as T;
}

const BUYER_GUIDE_KEY = "lakisa-buyer-guide-seen";

export default function MarketplaceOfferBox({
  listingId,
  price,
  minPrice,
  currency,
  commissionRate,
  cardFeeRate,
  mobileFeeRate,
  myOffer: initialOffer,
  myOrder: initialOrder,
}: {
  listingId: string;
  price: number | null;
  minPrice: number | null;
  currency: string;
  commissionRate: number;
  cardFeeRate: number;
  mobileFeeRate: number;
  myOffer: ClientOffer | null;
  myOrder: ClientOrder | null;
}) {
  const t = useT();
  const { locale } = useLocale();
  const fr = locale === "fr";

  const [myOffer, setMyOffer] = useState<ClientOffer | null>(initialOffer);
  const [myOrder, setMyOrder] = useState<ClientOrder | null>(initialOrder);
  const [method, setMethod] = useState<"card" | "mobile_money">("card");
  const [offerOpen, setOfferOpen] = useState(false);
  const [buyOpen, setBuyOpen] = useState(false);
  const [offerAmount, setOfferAmount] = useState("");
  const [offerMessage, setOfferMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(false);
  const [guideSeen, setGuideSeen] = useState(true);
  const [pendingAction, setPendingAction] = useState<"offer" | "buy" | null>(null);

  useEffect(() => {
    try {
      setGuideSeen(window.localStorage.getItem(BUYER_GUIDE_KEY) === "seen");
    } catch {
      setGuideSeen(true);
    }
  }, []);

  function closeGuide() {
    setShowGuide(false);
    try {
      window.localStorage.setItem(BUYER_GUIDE_KEY, "seen");
    } catch {
      // Storage unavailable: the guide shows again next time.
    }
    setGuideSeen(true);
    if (pendingAction === "offer") setOfferOpen(true);
    if (pendingAction === "buy") setBuyOpen(true);
    setPendingAction(null);
  }

  // The first offer or purchase starts with the buyer guide; the
  // form opens once the guide is closed.
  function startOffer() {
    if (!guideSeen) {
      setPendingAction("offer");
      setShowGuide(true);
      return;
    }
    setOfferOpen(true);
  }

  function startBuy() {
    if (!guideSeen) {
      setPendingAction("buy");
      setShowGuide(true);
      return;
    }
    setBuyOpen(true);
  }

  function feeSplit(amount: number) {
    const feeRate = method === "mobile_money" ? mobileFeeRate : cardFeeRate;
    const commission = Math.round(amount * commissionRate);
    const fee = Math.round(amount * feeRate);
    return { feeRate, commission, fee, net: amount - commission - fee };
  }

  async function submitOffer(event: React.FormEvent) {
    event.preventDefault();
    const amount = Math.floor(Number(offerAmount));
    if (!amount || amount <= 0) {
      setError("Enter an offer amount.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api<{ offer: ClientOffer }>("/api/offers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, amount, message: offerMessage.trim() }),
      });
      setMyOffer(result.offer);
      setOfferOpen(false);
      setOfferAmount("");
      setOfferMessage("");
      setNotice(t("marketplaceSales", "offerSent"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the offer.");
    } finally {
      setBusy(false);
    }
  }

  async function actOnOffer(action: "acceptCounter" | "withdraw") {
    if (!myOffer) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api<{ offer: ClientOffer }>(`/api/offers/${encodeURIComponent(myOffer.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (action === "withdraw") {
        setMyOffer(null);
      } else {
        setMyOffer(result.offer);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the offer.");
    } finally {
      setBusy(false);
    }
  }

  async function placeOrder(offerId: string | null) {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api<{ order: ClientOrder }>("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          listingId,
          ...(offerId ? { offerId } : { buyNow: true }),
          paymentMethod: method,
        }),
      });
      setMyOrder(result.order);
      setBuyOpen(false);
      setNotice(t("marketplaceSales", "orderCreated"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not place the order.");
    } finally {
      setBusy(false);
    }
  }

  async function cancelOrder() {
    if (!myOrder) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await api(`/api/orders/${encodeURIComponent(myOrder.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      setMyOrder(null);
      setNotice(t("marketplaceSales", "orderCancelled"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel the order.");
    } finally {
      setBusy(false);
    }
  }

  const agreedPrice =
    myOffer && myOffer.status === "accepted" ? (myOffer.counterAmount ?? myOffer.amount) : null;
  const buyPrice = agreedPrice ?? price;
  const split = buyPrice !== null ? feeSplit(buyPrice) : null;
  const rangeText =
    minPrice !== null && price !== null
      ? fr
        ? `Offres de ${money(minPrice, currency)} à ${money(price, currency)}`
        : `Offers from ${money(minPrice, currency)} to ${money(price, currency)}`
      : null;

  return (
    <div className="mp-offer-box">
      {showGuide && <BuyerGuide onClose={closeGuide} />}
      <h2>{t("marketplaceSales", "buyNow")}</h2>
      {rangeText && <p className="mp-offer-range">{rangeText}</p>}
      <p className="mp-offer-hint">
        <button type="button" className="mp-link-button" onClick={() => setShowGuide(true)}>
          {t("marketplaceGuides", "howBuyingWorks")}
        </button>
      </p>
      {error && (
        <p className="mp-offer-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="mp-offer-notice" role="status">
          {notice}
        </p>
      )}

      {myOrder ? (
        <div className="mp-order-card">
          <strong>Order pending payment</strong>
          <p>
            {money(myOrder.finalPrice, myOrder.currency)} for this work. No real payment passes
            yet: Flutterwave is not connected, so the order stays pending payment and you will not
            be charged now.
          </p>
          <dl className="mp-fees">
            <div>
              <dt>{t("marketplaceSales", "agreedPrice")}</dt>
              <dd>{money(myOrder.finalPrice, myOrder.currency)}</dd>
            </div>
            <div>
              <dt>
                {t("marketplaceSales", "lakisaCommission")} ({Math.round(myOrder.commissionRate * 100)}%)
              </dt>
              <dd>-{money(myOrder.commissionAmount, myOrder.currency)}</dd>
            </div>
            <div>
              <dt>
                {t("marketplaceSales", "paymentFee")} ({myOrder.paymentMethod === "mobile_money" ? "Mobile Money" : "Card"},{" "}
                {Math.round(myOrder.paymentFeeRate * 100)}%, {t("marketplaceSales", "indicativeRates").toLowerCase()})
              </dt>
              <dd>-{money(myOrder.paymentFeeAmount, myOrder.currency)}</dd>
            </div>
            <div>
              <dt>{t("marketplaceSales", "sellerReceives")}</dt>
              <dd>{money(myOrder.sellerNet, myOrder.currency)}</dd>
            </div>
          </dl>
          <button type="button" className="mp-small-button mp-small-button-quiet" disabled={busy} onClick={() => void cancelOrder()}>
            {t("marketplaceSales", "cancelOrder")}
          </button>
        </div>
      ) : (
        <>
          {myOffer && myOffer.status === "accepted" && agreedPrice !== null ? (
            <div className="mp-order-card">
              <strong>Offer accepted: {money(agreedPrice, currency)}</strong>
              <p>Pay the agreed price through Lakisa.</p>
              {split && (
                <dl className="mp-fees">
                  <div>
                    <dt>{t("marketplaceSales", "agreedPrice")}</dt>
                    <dd>{money(agreedPrice, currency)}</dd>
                  </div>
                  <div>
                    <dt>
                      {t("marketplaceSales", "lakisaCommission")} ({Math.round(commissionRate * 100)}%)
                    </dt>
                    <dd>-{money(split.commission, currency)}</dd>
                  </div>
                  <div>
                    <dt>
                      {t("marketplaceSales", "paymentFee")} (
                      {method === "mobile_money" ? "Mobile Money" : "Card"}, {Math.round(split.feeRate * 100)}%,{" "}
                      {t("marketplaceSales", "indicativeRates").toLowerCase()})
                    </dt>
                    <dd>-{money(split.fee, currency)}</dd>
                  </div>
                  <div>
                    <dt>{t("marketplaceSales", "sellerReceives")}</dt>
                    <dd>{money(split.net, currency)}</dd>
                  </div>
                  <div>
                    <dt>{t("marketplaceSales", "youPay")}</dt>
                    <dd>{money(agreedPrice, currency)}</dd>
                  </div>
                </dl>
              )}
              <label>
                <span>{t("marketplaceSales", "paymentMethod")}</span>
                <select value={method} onChange={(e) => setMethod(e.target.value as "card" | "mobile_money")}>
                  <option value="card">{t("marketplaceSales", "card")}</option>
                  <option value="mobile_money">{t("marketplaceSales", "mobileMoney")}</option>
                </select>
              </label>
              <p className="mp-offer-note">{t("marketplaceSales", "orderPendingNote")}</p>
              <button type="button" className="primary-button" disabled={busy} onClick={() => void placeOrder(myOffer.id)}>
                {busy ? "Placing…" : t("marketplaceSales", "placeOrder")}
              </button>
            </div>
          ) : (
            <>
              {myOffer && (myOffer.status === "open" || myOffer.status === "countered") && (
                <div className="mp-order-card">
                  <strong>
                    {t("marketplaceSales", "yourOffer")}: {money(myOffer.amount, currency)}
                  </strong>
                  {myOffer.status === "countered" && myOffer.counterAmount !== null ? (
                    <p>
                      The seller proposed {money(myOffer.counterAmount, currency)} instead. Accept
                      it, make another offer, or withdraw.
                    </p>
                  ) : (
                    <p>The seller has not answered yet. You can withdraw and make another offer.</p>
                  )}
                  <div className="mp-actions">
                    {myOffer.status === "countered" && (
                      <button type="button" className="mp-small-button" disabled={busy} onClick={() => void actOnOffer("acceptCounter")}>
                        {t("marketplaceSales", "acceptCounter")}
                      </button>
                    )}
                    <button type="button" className="mp-small-button mp-small-button-quiet" disabled={busy} onClick={() => void actOnOffer("withdraw")}>
                      {t("marketplaceSales", "withdrawOffer")}
                    </button>
                  </div>
                </div>
              )}

              {price !== null && (
                <>
                  {buyOpen ? (
                    <div className="mp-order-card">
                      <strong>
                        {t("marketplaceSales", "buyNow")}: {money(price, currency)}
                      </strong>
                      {split && (
                        <dl className="mp-fees">
                          <div>
                            <dt>{t("marketplaceSales", "agreedPrice")}</dt>
                            <dd>{money(price, currency)}</dd>
                          </div>
                          <div>
                            <dt>
                              {t("marketplaceSales", "lakisaCommission")} ({Math.round(commissionRate * 100)}%)
                            </dt>
                            <dd>-{money(split.commission, currency)}</dd>
                          </div>
                          <div>
                            <dt>
                              {t("marketplaceSales", "paymentFee")} (
                              {method === "mobile_money" ? "Mobile Money" : "Card"}, {Math.round(split.feeRate * 100)}%,{" "}
                              {t("marketplaceSales", "indicativeRates").toLowerCase()})
                            </dt>
                            <dd>-{money(split.fee, currency)}</dd>
                          </div>
                          <div>
                            <dt>{t("marketplaceSales", "sellerReceives")}</dt>
                            <dd>{money(split.net, currency)}</dd>
                          </div>
                          <div>
                            <dt>{t("marketplaceSales", "youPay")}</dt>
                            <dd>{money(price, currency)}</dd>
                          </div>
                        </dl>
                      )}
                      <label>
                        <span>{t("marketplaceSales", "paymentMethod")}</span>
                        <select value={method} onChange={(e) => setMethod(e.target.value as "card" | "mobile_money")}>
                          <option value="card">{t("marketplaceSales", "card")}</option>
                          <option value="mobile_money">{t("marketplaceSales", "mobileMoney")}</option>
                        </select>
                      </label>
                      <p className="mp-offer-note">{t("marketplaceSales", "orderPendingNote")}</p>
                      <button type="button" className="primary-button" disabled={busy} onClick={() => void placeOrder(null)}>
                        {busy ? "Placing…" : t("marketplaceSales", "placeOrder")}
                      </button>
                    </div>
                  ) : (
                    <button type="button" className="primary-button" onClick={startBuy}>
                      {t("marketplaceSales", "buyNow")}
                    </button>
                  )}
                </>
              )}

              {offerOpen ? (
                <form onSubmit={submitOffer} className="mp-offer-form">
                  <label>
                    <span>{t("marketplaceSales", "offerAmount")} ({currency}) *</span>
                    <input
                      value={offerAmount}
                      onChange={(e) => setOfferAmount(e.target.value)}
                      inputMode="numeric"
                      required
                      placeholder={minPrice !== null ? `Minimum ${money(minPrice, currency)}` : "Your price"}
                    />
                  </label>
                  <label>
                    <span>{t("marketplaceSales", "offerMessage")}</span>
                    <textarea value={offerMessage} onChange={(e) => setOfferMessage(e.target.value)} rows={2} />
                  </label>
                  <button type="submit" className="primary-button" disabled={busy}>
                    {busy ? "Sending…" : t("marketplaceSales", "sendOffer")}
                  </button>
                </form>
              ) : (
                <button type="button" className="mp-small-button" onClick={startOffer}>
                  {t("marketplaceSales", "makeOffer")}
                </button>
              )}
            </>
          )}
        </>
      )}
      <style>{`
        .mp-offer-box { display: grid; gap: 12px; padding: 20px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-3); }
        .mp-offer-box h2 { margin: 0; font: 450 20px/1.2 var(--font-display), Georgia, serif; }
        .mp-offer-range { margin: 0; color: var(--muted); font-size: 13px; }
        .mp-offer-hint { margin: 0; }
        .mp-link-button { padding: 0; border: 0; background: transparent; color: var(--ink); font: inherit; font-size: 13px; text-decoration: underline; cursor: pointer; }
        .mp-offer-error { padding: 10px 12px; border: 1px solid #d8a49a; border-radius: 8px; background: #f9ecea; color: #7a2e22; font-size: 13px; }
        .mp-offer-notice { padding: 10px 12px; border: 1px solid #c8b98a; border-radius: 8px; background: #f7f1e3; color: #5c4a1e; font-size: 13px; }
        .mp-order-card { display: grid; gap: 10px; padding: 14px; border: 1px solid var(--line); border-radius: 8px; background: var(--paper); }
        .mp-order-card p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.6; }
        .mp-fees { margin: 0; display: grid; gap: 6px; }
        .mp-fees > div { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
        .mp-fees dt { color: var(--muted); }
        .mp-fees dd { margin: 0; font-weight: 600; }
        .mp-offer-form { display: grid; gap: 12px; }
        .mp-offer-form label, .mp-order-card label { display: grid; gap: 6px; font-size: 12px; font-weight: 600; }
        .mp-offer-form label > span, .mp-order-card label > span { color: var(--muted); font-weight: 500; }
        .mp-offer-form input, .mp-offer-form textarea, .mp-order-card select { width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--paper); color: var(--ink); font: inherit; font-weight: 400; }
        .mp-offer-note { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
        .mp-actions { display: flex; flex-wrap: wrap; gap: 8px; }
        .mp-small-button { display: inline-flex; align-items: center; padding: 7px 10px; border: 1px solid var(--line); border-radius: 5px; background: var(--paper); color: var(--ink); font-size: 11px; font-weight: 600; cursor: pointer; text-decoration: none; }
        .mp-small-button:disabled { opacity: .5; cursor: not-allowed; }
        .mp-small-button-quiet { background: transparent; border-color: transparent; color: var(--muted); }
      `}</style>
    </div>
  );
}
