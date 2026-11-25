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
import page from "./redesign-pages.module.css";
import dash from "./redesign-dashboard.module.css";

// The user's orders (Phase 2, Nov 2026), as buyer and as seller.
// Each order shows the fee split recorded at the time of the sale:
// the agreed price, the Lakisa commission, the payment fee (0 for a
// manual payment, only the commission is deducted), and what the
// seller receives. A pending order can be cancelled by either side;
// the work goes back for sale and the accepted offer reopens. A manual
// payment is completed here: the buyer sends the transaction
// reference, the seller confirms receipt, and the order moves to paid.

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

function statusPillClass(status: string): string {
  if (status === "completed" || status === "paid") return page.pillLive;
  if (status === "pending_payment") return page.pillAmber;
  return page.pillDraft;
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
      <section className={`${dash.card} ${page.emptyState}`}>
        <h3>No orders yet.</h3>
        <p>When you buy a work on the marketplace, or when one of your works sells, the order lands here.</p>
      </section>
    );
  }

  return (
    <div className={page.sectionStack}>
      {error && (
        <p role="alert" style={{ color: "var(--rd-red)", fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}
      {orders.map((order) => {
        const asBuyer = order.buyerId === userId;
        return (
          <article key={order.id} className={dash.card}>
            <div className={dash.cardHead}>
              <div>
                <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700 }}>
                  <Link href={`/marketplace/${order.listingId}`} style={{ color: "inherit", textDecoration: "none" }}>
                    {order.listingTitle}
                  </Link>
                </h2>
                <p className={dash.cardSub}>
                  {asBuyer ? `You bought from ${order.sellerName}` : `You sold to ${order.buyerName}`} ·{" "}
                  <PaymentMethodLabel method={order.paymentMethod} /> ·{" "}
                  {new Date(order.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}
                </p>
                {order.paymentReference && (
                  <p className={dash.cardSub}>Transaction reference: {order.paymentReference}</p>
                )}
              </div>
              <span className={`${page.pill} ${statusPillClass(order.status)}`}>
                {order.status.replace(/_/g, " ")}
              </span>
            </div>
            <dl style={{ margin: "16px 0 0" }}>
              <div className={page.row}>
                <dt className={page.rowMain} style={{ fontSize: 13.5, color: "var(--rd-t2)" }}>Agreed price</dt>
                <dd className={page.rowSide} style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>{money(order.finalPrice, order.currency)}</dd>
              </div>
              <div className={page.row}>
                <dt className={page.rowMain} style={{ fontSize: 13.5, color: "var(--rd-t2)" }}>
                  Lakisa commission ({Math.round(order.commissionRate * 100)}%)
                </dt>
                <dd className={page.rowSide} style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>
                  -{money(order.commissionAmount, order.currency)}
                </dd>
              </div>
              <div className={page.row}>
                <dt className={page.rowMain} style={{ fontSize: 13.5, color: "var(--rd-t2)" }}>
                  Payment fee (
                  {order.paymentFeeRate > 0
                    ? `${Math.round(order.paymentFeeRate * 100)}%, indicative`
                    : "no payment fee"}
                  )
                </dt>
                <dd className={page.rowSide} style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>
                  -{money(order.paymentFeeAmount, order.currency)}
                </dd>
              </div>
              <div className={page.row}>
                <dt className={page.rowMain} style={{ fontSize: 13.5, color: "var(--rd-t2)" }}>
                  {asBuyer ? "Seller receives" : "You receive"}
                </dt>
                <dd className={page.rowSide} style={{ margin: 0, fontSize: 13.5, fontWeight: 700 }}>
                  {money(order.sellerNet, order.currency)}
                </dd>
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
                  <p className={dash.cardSub} style={{ marginTop: 12 }}>
                    Pending payment: Flutterwave is not connected yet, so no money has moved. The work
                    is reserved for this order.
                  </p>
                )}
                <div style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className={`${page.btn} ${page.btnDanger}`}
                    disabled={busyId === order.id}
                    onClick={() => void cancelOrder(order.id)}
                  >
                    {busyId === order.id ? "Cancelling…" : "Cancel order"}
                  </button>
                </div>
              </>
            )}
          </article>
        );
      })}
    </div>
  );
}
