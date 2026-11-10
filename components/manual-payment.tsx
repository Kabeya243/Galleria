"use client";

import { useState } from "react";
import { useT } from "@/lib/i18n";
import type { ClientOrder } from "@/lib/marketplace-sales";

// Manual payment (temporary, Nov 2026): the buyer pays the seller
// directly, outside Lakisa, by Mobile Money (MTN/Airtel) or bank
// transfer, then sends the transaction reference; the seller (or an
// admin) confirms receipt by hand, and the order moves to paid.
// Shared by the listing page, the seller tool and My orders, so the
// flow is the same everywhere. The payment fee is 0 for manual
// payments: only the Lakisa commission is deducted.

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(result.error ?? "Something went wrong.");
  return result as T;
}

// Payment method label, in the viewer's language. The server helper
// (lib/marketplace-sales) cannot be imported here: it pulls in Prisma.
export function PaymentMethodLabel({ method }: { method: string }) {
  const t = useT();
  const label =
    method === "manual_momo"
      ? t("marketplaceSales", "manualMomo")
      : method === "manual_bank"
        ? t("marketplaceSales", "manualBank")
        : method === "mobile_money"
          ? t("marketplaceSales", "mobileMoney")
          : t("marketplaceSales", "card");
  return <>{label}</>;
}

export function isManualOrder(order: ClientOrder): boolean {
  return order.paymentMethod === "manual_momo" || order.paymentMethod === "manual_bank";
}

// The buyer side: pay the seller directly, then send the reference.
export function ManualPaymentBuyerBox({
  order,
  onUpdated,
}: {
  order: ClientOrder;
  onUpdated: (order: ClientOrder) => void;
}) {
  const t = useT();
  const [reference, setReference] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (order.status !== "pending_payment" || !isManualOrder(order)) return null;
  if (order.paymentReference) {
    return (
      <p className="mp-manual-note">
        {t("marketplaceSales", "referenceSentShort")} ({order.paymentReference})
      </p>
    );
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const value = reference.trim();
    if (!value) {
      setError("Enter the transaction reference.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api<{ order: ClientOrder }>(`/api/orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "submitReference", paymentReference: value }),
      });
      onUpdated(result.order);
      setReference("");
      setNotice(t("marketplaceSales", "referenceSent"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the reference.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mp-manual-form">
      <p>{t("marketplaceSales", "manualPayInstructions")}</p>
      <label>
        <span>{t("marketplaceSales", "paymentReference")} *</span>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={t("marketplaceSales", "paymentReferencePlaceholder")}
          required
        />
      </label>
      {error && (
        <p className="mp-manual-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="mp-manual-notice" role="status">
          {notice}
        </p>
      )}
      <button type="submit" className="primary-button" disabled={busy}>
        {busy ? "Sending…" : t("marketplaceSales", "sendReference")}
      </button>
      <style>{`
        .mp-manual-form { display: grid; gap: 10px; }
        .mp-manual-form p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.6; }
        .mp-manual-form label { display: grid; gap: 6px; font-size: 12px; font-weight: 600; }
        .mp-manual-form label > span { color: var(--muted); font-weight: 500; }
        .mp-manual-form input { width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--paper); color: var(--ink); font: inherit; font-weight: 400; }
        .mp-manual-note { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.6; }
        .mp-manual-error { padding: 10px 12px; border: 1px solid #d8a49a; border-radius: 8px; background: #f9ecea; color: #7a2e22; font-size: 13px; }
        .mp-manual-notice { padding: 10px 12px; border: 1px solid #c8b98a; border-radius: 8px; background: #f7f1e3; color: #5c4a1e; font-size: 13px; }
      `}</style>
    </form>
  );
}

// The seller side: confirm the money arrived, and the order is paid.
export function ManualPaymentSellerBox({
  order,
  onUpdated,
}: {
  order: ClientOrder;
  onUpdated: (order: ClientOrder) => void;
}) {
  const t = useT();
  const [reference, setReference] = useState(order.paymentReference ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  if (order.status !== "pending_payment" || !isManualOrder(order)) return null;

  async function confirm(event: React.FormEvent) {
    event.preventDefault();
    const value = reference.trim();
    if (!value) {
      setError("A transaction reference is required to confirm payment.");
      return;
    }
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const result = await api<{ order: ClientOrder }>(`/api/orders/${encodeURIComponent(order.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markPaid", paymentReference: value }),
      });
      onUpdated(result.order);
      setNotice(t("marketplaceSales", "paymentConfirmed"));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm the payment.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={confirm} className="mp-manual-form">
      {order.paymentReference ? (
        <p>
          {t("marketplaceSales", "awaitingConfirmation")}: {order.paymentReference}
        </p>
      ) : (
        <p>{t("marketplaceSales", "waitingForReference")}</p>
      )}
      <label>
        <span>{t("marketplaceSales", "paymentReference")}</span>
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder={t("marketplaceSales", "paymentReferencePlaceholder")}
        />
      </label>
      {error && (
        <p className="mp-manual-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="mp-manual-notice" role="status">
          {notice}
        </p>
      )}
      <button type="submit" className="primary-button" disabled={busy}>
        {busy ? "Confirming…" : t("marketplaceSales", "markPaid")}
      </button>
      <style>{`
        .mp-manual-form { display: grid; gap: 10px; }
        .mp-manual-form p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.6; }
        .mp-manual-form label { display: grid; gap: 6px; font-size: 12px; font-weight: 600; }
        .mp-manual-form label > span { color: var(--muted); font-weight: 500; }
        .mp-manual-form input { width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--paper); color: var(--ink); font: inherit; font-weight: 400; }
        .mp-manual-error { padding: 10px 12px; border: 1px solid #d8a49a; border-radius: 8px; background: #f9ecea; color: #7a2e22; font-size: 13px; }
        .mp-manual-notice { padding: 10px 12px; border: 1px solid #c8b98a; border-radius: 8px; background: #f7f1e3; color: #5c4a1e; font-size: 13px; }
      `}</style>
    </form>
  );
}
