"use client";

import { useState } from "react";
import Link from "next/link";
import {
  isManualOrder,
  ManualPaymentBuyerBox,
  ManualPaymentSellerBox,
  PaymentMethodLabel,
} from "@/components/manual-payment";
import type { ClientOrder } from "@/lib/marketplace-sales";

// The user's orders, as buyer and as seller. Each order shows the
// fee split recorded at the time of the sale: the agreed price, the
// Lakisa commission, the payment fee (0 for a manual payment, only
// the commission is deducted), and what the seller receives. A pending
// order can be cancelled by either side; the work goes back for sale
// and the accepted offer reopens. A manual payment is completed here:
// the buyer sends the transaction reference, the seller confirms
// receipt, and the order moves to paid.

function money(amount: number, currency: string): string {
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

export default function OrdersList({
  orders: initialOrders,
  userId,
}: {
  orders: ClientOrder[];
  userId: string;
}) {
  const [orders, setOrders] = useState<ClientOrder[]>(initialOrders);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function cancelOrder(id: string) {
    setBusyId(id);
    setError(null);
    try {
      const result = await api<{ order: ClientOrder }>(`/api/orders/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      setOrders((current) => current.map((o) => (o.id === id ? result.order : o)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel the order.");
    } finally {
      setBusyId(null);
    }
  }

  if (orders.length === 0) {
    return (
      <div className="ord-empty">
        <strong>No orders yet.</strong>
        <p>When you buy a work on the marketplace, or when one of your works sells, the order lands here.</p>
      </div>
    );
  }

  return (
    <div className="ord-list">
      {error && (
        <p className="ord-error" role="alert">
          {error}
        </p>
      )}
      {orders.map((order) => {
        const asBuyer = order.buyerId === userId;
        return (
          <article key={order.id} className="ord-card">
            <div className="ord-head">
              <h2>
                <Link href={`/marketplace/${order.listingId}`}>{order.listingTitle}</Link>
              </h2>
              <span className="ord-badge">{order.status.replace(/_/g, " ")}</span>
            </div>
            <p className="ord-meta">
              {asBuyer ? `You bought from ${order.sellerName}` : `You sold to ${order.buyerName}`} ·{" "}
              <PaymentMethodLabel method={order.paymentMethod} /> ·{" "}
              {new Date(order.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
            </p>
            {order.paymentReference && (
              <p className="ord-meta">Transaction reference: {order.paymentReference}</p>
            )}
            <dl className="ord-fees">
              <div>
                <dt>Agreed price</dt>
                <dd>{money(order.finalPrice, order.currency)}</dd>
              </div>
              <div>
                <dt>Lakisa commission ({Math.round(order.commissionRate * 100)}%)</dt>
                <dd>-{money(order.commissionAmount, order.currency)}</dd>
              </div>
              <div>
                <dt>
                  Payment fee (
                  {order.paymentFeeRate > 0
                    ? `${Math.round(order.paymentFeeRate * 100)}%, indicative`
                    : "no payment fee"}
                  )
                </dt>
                <dd>-{money(order.paymentFeeAmount, order.currency)}</dd>
              </div>
              <div>
                <dt>{asBuyer ? "Seller receives" : "You receive"}</dt>
                <dd>{money(order.sellerNet, order.currency)}</dd>
              </div>
            </dl>
            {order.status === "pending_payment" && (
              <>
                {isManualOrder(order) ? (
                  asBuyer ? (
                    <ManualPaymentBuyerBox
                      order={order}
                      onUpdated={(updated) =>
                        setOrders((current) => current.map((o) => (o.id === updated.id ? updated : o)))
                      }
                    />
                  ) : (
                    <ManualPaymentSellerBox
                      order={order}
                      onUpdated={(updated) =>
                        setOrders((current) => current.map((o) => (o.id === updated.id ? updated : o)))
                      }
                    />
                  )
                ) : (
                  <p className="ord-note">
                    Pending payment: Flutterwave is not connected yet, so no money has moved. The work
                    is reserved for this order.
                  </p>
                )}
                <button
                  type="button"
                  className="ord-cancel"
                  disabled={busyId === order.id}
                  onClick={() => void cancelOrder(order.id)}
                >
                  {busyId === order.id ? "Cancelling…" : "Cancel order"}
                </button>
              </>
            )}
          </article>
        );
      })}
      <style>{`
        .ord-list { display: grid; gap: 16px; }
        .ord-empty { padding: 20px; border: 1px dashed var(--line); border-radius: 12px; background: var(--surface-3); }
        .ord-empty p { margin: 6px 0 0; color: var(--muted); line-height: 1.6; }
        .ord-card { padding: 20px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-3); display: grid; gap: 10px; }
        .ord-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
        .ord-head h2 { margin: 0; font-size: 17px; }
        .ord-head a { color: inherit; text-decoration: none; }
        .ord-head a:hover { text-decoration: underline; }
        .ord-badge { display: inline-block; flex-shrink: 0; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; background: var(--surface-2); color: var(--muted); text-transform: capitalize; }
        .ord-meta { margin: 0; color: var(--muted); font-size: 12px; }
        .ord-fees { margin: 0; display: grid; gap: 6px; }
        .ord-fees > div { display: flex; justify-content: space-between; gap: 12px; font-size: 13px; }
        .ord-fees dt { color: var(--muted); }
        .ord-fees dd { margin: 0; font-weight: 600; }
        .ord-note { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.6; }
        .ord-cancel { justify-self: start; padding: 7px 10px; border: 1px solid var(--line); border-radius: 5px; background: transparent; color: var(--muted); font-size: 11px; font-weight: 600; cursor: pointer; }
        .ord-cancel:disabled { opacity: .5; cursor: not-allowed; }
        .ord-error { padding: 10px 12px; border: 1px solid #d8a49a; border-radius: 8px; background: #f9ecea; color: #7a2e22; font-size: 13px; }
      `}</style>
    </div>
  );
}
