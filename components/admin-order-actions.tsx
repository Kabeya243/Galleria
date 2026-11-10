"use client";

import { useState } from "react";

// Admin action on one order (Nov 2026): mark a manual payment as
// paid, by hand. Only for manual pending orders; automatic
// (Flutterwave) orders are never confirmed here, their confirmation
// comes from the payment webhook once it is connected. A transaction
// reference is required: the one the buyer sent, or one entered here.
// The page reloads after a successful confirmation so the table and
// the totals show the new state.

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(result.error ?? "Something went wrong.");
  return result as T;
}

export default function AdminOrderActions({
  orderId,
  paymentMethod,
  paymentReference,
  status,
}: {
  orderId: string;
  paymentMethod: string;
  paymentReference: string | null;
  status: string;
}) {
  const [reference, setReference] = useState(paymentReference ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const manual = paymentMethod === "manual_momo" || paymentMethod === "manual_bank";
  if (!manual || status !== "pending_payment") return null;

  async function markPaid() {
    const value = reference.trim();
    if (!value) {
      setError("A transaction reference is required to confirm payment.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await api(`/api/orders/${encodeURIComponent(orderId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "markPaid", paymentReference: value }),
      });
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm the payment.");
      setBusy(false);
    }
  }

  return (
    <span className="ad-order-actions">
      <input
        value={reference}
        onChange={(e) => setReference(e.target.value)}
        placeholder="Transaction reference"
        aria-label="Transaction reference"
      />
      <button type="button" disabled={busy} onClick={() => void markPaid()}>
        {busy ? "Confirming…" : "Mark as paid"}
      </button>
      {error && (
        <span className="ad-order-actions-error" role="alert">
          {error}
        </span>
      )}
      <style>{`
        .ad-order-actions { display: inline-flex; flex-wrap: wrap; align-items: center; gap: 6px; }
        .ad-order-actions input { width: 170px; padding: 6px 8px; border: 1px solid var(--line); border-radius: 5px; background: var(--paper); color: var(--ink); font: inherit; font-size: 12px; }
        .ad-order-actions button { padding: 6px 10px; border: 1px solid var(--line); border-radius: 5px; background: var(--paper); color: var(--ink); font-size: 12px; font-weight: 600; cursor: pointer; }
        .ad-order-actions button:disabled { opacity: .5; cursor: not-allowed; }
        .ad-order-actions-error { color: #7a2e22; font-size: 12px; }
      `}</style>
    </span>
  );
}
