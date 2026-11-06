"use client";

import { useState } from "react";

// The inquiry form on a public listing page. A visitor sends their
// name, email and message; it is stored for the seller to read and
// answer. No payment, no account, no email sent from here.

export default function ListingInquiryForm({ listingId, listingTitle }: { listingId: string; listingTitle: string }) {
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ listingId, buyerName: buyerName.trim(), buyerEmail: buyerEmail.trim(), message: message.trim() }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not send your inquiry.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your inquiry.");
    } finally {
      setBusy(false);
    }
  }

  if (sent) {
    return (
      <div className="inq-sent" role="status">
        <strong>Your inquiry is with the seller.</strong>
        <p>
          The seller reads inquiries in their Marketplace tool and will reply to {buyerEmail}.
          No payment is taken here — price, shipping and payment are agreed directly with them.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="inq-form">
      <h2>Ask about this work</h2>
      <p>
        Write to the seller about “{listingTitle}”. Your name, email and message are stored only
        so the seller can reply to you.
      </p>
      {error && (
        <p className="inq-error" role="alert">
          {error}
        </p>
      )}
      <label>
        <span>Your name *</span>
        <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} required maxLength={200} placeholder="Your name" />
      </label>
      <label>
        <span>Your email *</span>
        <input type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} required maxLength={200} placeholder="you@example.com" />
      </label>
      <label>
        <span>Message *</span>
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
          rows={4}
          placeholder="I would like to know more about this work — is it still available, and what would shipping cost?"
        />
      </label>
      <button type="submit" className="primary-button" disabled={busy}>
        {busy ? "Sending…" : "Send inquiry"}
      </button>
      <style>{`
        .inq-form { display: grid; gap: 12px; padding: 20px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-3); }
        .inq-form h2 { margin: 0; font: 450 20px/1.2 var(--font-display), Georgia, serif; }
        .inq-form p { margin: 0; color: var(--muted); line-height: 1.6; font-size: 13px; }
        .inq-form label { display: grid; gap: 6px; font-size: 12px; font-weight: 600; }
        .inq-form label > span { color: var(--muted); font-weight: 500; }
        .inq-form input, .inq-form textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--paper); color: var(--ink); font: inherit; font-weight: 400; }
        .inq-form textarea { resize: vertical; }
        .inq-error { padding: 10px 12px; border: 1px solid #d8a49a; border-radius: 8px; background: #f9ecea; color: #7a2e22; }
        .inq-sent { padding: 20px; border: 1px solid #c8b98a; border-radius: 12px; background: #f7f1e3; }
        .inq-sent p { margin: 6px 0 0; color: var(--muted); line-height: 1.6; }
      `}</style>
    </form>
  );
}
