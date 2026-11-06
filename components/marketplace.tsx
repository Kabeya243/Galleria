"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

// Marketplace — the seller's tool. Create listings from your own
// artworks, manage prices and status, and answer purchase inquiries.
// Payments are NOT taken here: the inquiry is the path to a sale, and
// the public listing page carries a clearly-labelled Stripe integration
// point instead of a fake checkout.
//
// Design: the existing white-gallery luxury language only — white paper,
// near-black ink, discrete gold accent, Fraunces + DM Sans. Component
// styles live in the <style> block at the bottom of this file so
// globals.css stays untouched.

export type MarketplaceArtwork = {
  id: string;
  title: string;
  artist: string;
  year: string;
  medium: string;
  dimensions: string;
  description: string;
  imageUrl: string | null;
  exhibitionTitle: string;
};

export type MarketplaceListing = {
  id: string;
  sellerId: string;
  sellerName: string;
  artworkId: string | null;
  title: string;
  artist: string;
  year: string;
  medium: string;
  dimensions: string;
  description: string;
  imageUrl: string | null;
  price: number | null;
  currency: string;
  kind: string;
  editionSize: number | null;
  editionNumber: number | null;
  status: string;
  inquiryCount: number;
  createdAt: string;
  updatedAt: string;
};

export type MarketplaceInquiry = {
  id: string;
  // Null for an artist-contact message (no marketplace listing).
  listingId: string | null;
  listingTitle: string;
  listingPrice: number | null;
  listingCurrency: string;
  listingStatus: string;
  buyerId: string | null;
  buyerName: string;
  buyerEmail: string;
  message: string;
  status: string;
  createdAt: string;
};

const KINDS = [
  { value: "original", label: "Original" },
  { value: "edition", label: "Edition" },
  { value: "print", label: "Print" },
  { value: "digital", label: "Digital" },
];

const CURRENCIES = ["USD", "EUR", "GBP", "UGX", "KES", "ZAR", "XOF", "CHF"];

const STATUSES = ["active", "reserved", "sold", "withdrawn"] as const;

export function formatPrice(price: number | null, currency: string): string {
  if (price === null || price === undefined) return "Price on request";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(price);
  } catch {
    return `${price} ${currency}`;
  }
}

function kindLabel(kind: string): string {
  return KINDS.find((k) => k.value === kind)?.label ?? kind;
}

function statusLabel(status: string): string {
  return status === "active" ? "For sale" : status.charAt(0).toUpperCase() + status.slice(1);
}

async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = (await response.json().catch(() => ({}))) as { error?: string } & T;
  if (!response.ok) throw new Error(result.error ?? "Something went wrong.");
  return result as T;
}

export default function MarketplaceTool({
  artworks: initialArtworks,
  listings: initialListings,
  inquiries: initialInquiries,
}: {
  artworks: MarketplaceArtwork[];
  listings: MarketplaceListing[];
  inquiries: MarketplaceInquiry[];
}) {
  const [artworks] = useState(initialArtworks);
  const [listings, setListings] = useState<MarketplaceListing[]>(initialListings);
  const [inquiries, setInquiries] = useState<MarketplaceInquiry[]>(initialInquiries);

  const [notice, setNotice] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  // --- New listing form ----------------------------------------------
  const [artworkId, setArtworkId] = useState("");
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [year, setYear] = useState("");
  const [medium, setMedium] = useState("");
  const [dimensions, setDimensions] = useState("");
  const [description, setDescription] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [price, setPrice] = useState("");
  const [currency, setCurrency] = useState("USD");
  const [kind, setKind] = useState("original");
  const [editionSize, setEditionSize] = useState("");
  const [editionNumber, setEditionNumber] = useState("");

  // --- Per-listing editing -------------------------------------------
  const [editingPriceId, setEditingPriceId] = useState<string | null>(null);
  const [priceDraft, setPriceDraft] = useState("");
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [inquiryFilter, setInquiryFilter] = useState("all");

  const openInquiries = useMemo(() => inquiries.filter((i) => i.status === "open").length, [inquiries]);
  const visibleInquiries = useMemo(
    () => (inquiryFilter === "all" ? inquiries : inquiries.filter((i) => i.status === inquiryFilter)),
    [inquiries, inquiryFilter],
  );

  function pickArtwork(id: string) {
    setArtworkId(id);
    const artwork = artworks.find((a) => a.id === id);
    if (!artwork) return;
    setTitle(artwork.title);
    setArtist(artwork.artist);
    setYear(artwork.year);
    setMedium(artwork.medium);
    setDimensions(artwork.dimensions);
    setDescription(artwork.description);
    setImageUrl(artwork.imageUrl ?? "");
  }

  function resetForm() {
    setArtworkId("");
    setTitle("");
    setArtist("");
    setYear("");
    setMedium("");
    setDimensions("");
    setDescription("");
    setImageUrl("");
    setPrice("");
    setCurrency("USD");
    setKind("original");
    setEditionSize("");
    setEditionNumber("");
  }

  async function createListing(event: React.FormEvent) {
    event.preventDefault();
    if (!title.trim()) {
      setNotice({ kind: "error", text: "Give the listing a title." });
      return;
    }
    setBusy(true);
    setNotice(null);
    try {
      const result = await api<{ listing: MarketplaceListing }>("/api/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(artworkId ? { artworkId } : {}),
          title: title.trim(),
          artist: artist.trim(),
          year: year.trim(),
          medium: medium.trim(),
          dimensions: dimensions.trim(),
          description: description.trim(),
          ...(imageUrl.trim() ? { imageUrl: imageUrl.trim() } : {}),
          price: price.trim() === "" ? null : Math.max(0, Math.floor(Number(price))),
          currency,
          kind,
          editionSize: kind === "edition" && editionSize.trim() !== "" ? Math.floor(Number(editionSize)) : null,
          editionNumber: kind === "edition" && editionNumber.trim() !== "" ? Math.floor(Number(editionNumber)) : null,
        }),
      });
      setListings((current) => [result.listing, ...current]);
      resetForm();
      setNotice({ kind: "ok", text: `“${result.listing.title}” is live on the public marketplace.` });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not create the listing." });
    } finally {
      setBusy(false);
    }
  }

  async function updateListing(id: string, patch: Partial<MarketplaceListing>, successText?: string) {
    setBusy(true);
    setNotice(null);
    try {
      const result = await api<{ listing: MarketplaceListing }>(`/api/listings/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      setListings((current) => current.map((l) => (l.id === id ? result.listing : l)));
      if (successText) setNotice({ kind: "ok", text: successText });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not update the listing." });
    } finally {
      setBusy(false);
    }
  }

  async function deleteListing(id: string) {
    setBusy(true);
    setNotice(null);
    try {
      await api(`/api/listings/${encodeURIComponent(id)}`, { method: "DELETE" });
      setListings((current) => current.filter((l) => l.id !== id));
      setConfirmingDeleteId(null);
      setNotice({ kind: "ok", text: "Listing deleted." });
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not delete the listing." });
    } finally {
      setBusy(false);
    }
  }

  async function updateInquiry(id: string, status: "open" | "answered" | "closed") {
    setBusy(true);
    setNotice(null);
    try {
      await api(`/api/inquiries/${encodeURIComponent(id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      setInquiries((current) => current.map((i) => (i.id === id ? { ...i, status } : i)));
    } catch (error) {
      setNotice({ kind: "error", text: error instanceof Error ? error.message : "Could not update the inquiry." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mp-wrap">
      {notice && (
        <p className={`mp-notice ${notice.kind === "error" ? "mp-notice-error" : ""}`} role="status">
          {notice.text}
        </p>
      )}

      <section className="mp-section">
        <h2>New listing</h2>
        <p className="mp-hint">
          Pick one of your own artworks to prefill the details, or list a work manually. It appears
          on the public marketplace at <Link href="/marketplace">/marketplace</Link> as soon as you
          save it. No payment is taken here — a buyer sends an inquiry, you reply by email, and the
          sale is agreed directly.
        </p>
        <form onSubmit={createListing} className="mp-form">
          <label>
            <span>From your artworks</span>
            <select value={artworkId} onChange={(e) => pickArtwork(e.target.value)}>
              <option value="">— List manually, or pick an artwork —</option>
              {artworks.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} · {a.exhibitionTitle}
                </option>
              ))}
            </select>
          </label>
          <div className="mp-grid">
            <label>
              <span>Title *</span>
              <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. The Nose Ring" required />
            </label>
            <label>
              <span>Artist</span>
              <input value={artist} onChange={(e) => setArtist(e.target.value)} placeholder="Artist name" />
            </label>
            <label>
              <span>Year</span>
              <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2026" />
            </label>
            <label>
              <span>Medium</span>
              <input value={medium} onChange={(e) => setMedium(e.target.value)} placeholder="Charcoal and acrylic on paper" />
            </label>
            <label>
              <span>Dimensions</span>
              <input value={dimensions} onChange={(e) => setDimensions(e.target.value)} placeholder="130 × 94 cm" />
            </label>
            <label>
              <span>Kind</span>
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                {KINDS.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>Price</span>
              <input value={price} onChange={(e) => setPrice(e.target.value)} inputMode="numeric" placeholder="Leave empty for price on request" />
            </label>
            <label>
              <span>Currency</span>
              <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
                {CURRENCIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </label>
            {kind === "edition" && (
              <>
                <label>
                  <span>Edition size</span>
                  <input value={editionSize} onChange={(e) => setEditionSize(e.target.value)} inputMode="numeric" placeholder="e.g. 10" />
                </label>
                <label>
                  <span>Edition number</span>
                  <input value={editionNumber} onChange={(e) => setEditionNumber(e.target.value)} inputMode="numeric" placeholder="e.g. 3" />
                </label>
              </>
            )}
          </div>
          <label>
            <span>Description</span>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} placeholder="What should a buyer know about this work?" />
          </label>
          <label>
            <span>Image URL (optional — prefilled from the artwork)</span>
            <input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" />
          </label>
          <button type="submit" className="primary-button" disabled={busy}>
            {busy ? "Saving…" : "Publish listing"}
          </button>
        </form>
      </section>

      <section className="mp-section">
        <h2>
          Your listings <span className="mp-count">{listings.length}</span>
        </h2>
        {listings.length === 0 ? (
          <div className="mp-empty">
            <strong>No listings yet.</strong>
            <p>Your first listing takes a minute: pick an artwork above, set a price, publish.</p>
          </div>
        ) : (
          <div className="mp-listings">
            {listings.map((listing) => (
              <article key={listing.id} className="mp-card">
                {listing.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={listing.imageUrl} alt={listing.title} className="mp-card-image" loading="lazy" />
                ) : (
                  <div className="mp-card-image mp-card-image-empty" aria-label="No image">
                    <span>No image</span>
                  </div>
                )}
                <div className="mp-card-body">
                  <div className="mp-card-head">
                    <h3>
                      <Link href={`/marketplace/${listing.id}`}>{listing.title}</Link>
                    </h3>
                    <span className={`mp-badge mp-badge-${listing.status}`}>{statusLabel(listing.status)}</span>
                  </div>
                  <p className="mp-card-meta">
                    {listing.artist}
                    {listing.year ? ` · ${listing.year}` : ""}
                    {listing.medium ? ` · ${listing.medium}` : ""}
                  </p>
                  <p className="mp-card-meta">
                    {kindLabel(listing.kind)}
                    {listing.editionSize ? ` · ${listing.editionNumber ?? "—"}/${listing.editionSize}` : ""}
                    {listing.dimensions ? ` · ${listing.dimensions}` : ""}
                  </p>
                  <p className="mp-card-price">{formatPrice(listing.price, listing.currency)}</p>
                  <p className="mp-card-meta">
                    {listing.inquiryCount} {listing.inquiryCount === 1 ? "inquiry" : "inquiries"}
                  </p>
                  {editingPriceId === listing.id ? (
                    <form
                      className="mp-price-form"
                      onSubmit={(e) => {
                        e.preventDefault();
                        const next = priceDraft.trim() === "" ? null : Math.max(0, Math.floor(Number(priceDraft)));
                        void updateListing(listing.id, { price: next }, "Price updated.");
                        setEditingPriceId(null);
                      }}
                    >
                      <input
                        value={priceDraft}
                        onChange={(e) => setPriceDraft(e.target.value)}
                        inputMode="numeric"
                        placeholder="New price (empty = on request)"
                        autoFocus
                      />
                      <button type="submit" className="mp-small-button" disabled={busy}>
                        Save
                      </button>
                      <button type="button" className="mp-small-button mp-small-button-quiet" onClick={() => setEditingPriceId(null)}>
                        Cancel
                      </button>
                    </form>
                  ) : (
                    <div className="mp-actions">
                      <button
                        type="button"
                        className="mp-small-button"
                        disabled={busy}
                        onClick={() => {
                          setEditingPriceId(listing.id);
                          setPriceDraft(listing.price === null ? "" : String(listing.price));
                        }}
                      >
                        Edit price
                      </button>
                      {listing.status === "active" && (
                        <button type="button" className="mp-small-button" disabled={busy} onClick={() => void updateListing(listing.id, { status: "reserved" }, "Marked reserved.")}>
                          Mark reserved
                        </button>
                      )}
                      {listing.status !== "sold" && (
                        <button type="button" className="mp-small-button" disabled={busy} onClick={() => void updateListing(listing.id, { status: "sold" }, "Marked sold.")}>
                          Mark sold
                        </button>
                      )}
                      {listing.status !== "active" && (
                        <button type="button" className="mp-small-button" disabled={busy} onClick={() => void updateListing(listing.id, { status: "active" }, "Back for sale.")}>
                          Back for sale
                        </button>
                      )}
                      {listing.status !== "withdrawn" && (
                        <button type="button" className="mp-small-button" disabled={busy} onClick={() => void updateListing(listing.id, { status: "withdrawn" }, "Withdrawn from the marketplace.")}>
                          Withdraw
                        </button>
                      )}
                      {confirmingDeleteId === listing.id ? (
                        <>
                          <button type="button" className="mp-small-button mp-small-button-danger" disabled={busy} onClick={() => void deleteListing(listing.id)}>
                            Delete for good?
                          </button>
                          <button type="button" className="mp-small-button mp-small-button-quiet" onClick={() => setConfirmingDeleteId(null)}>
                            Keep it
                          </button>
                        </>
                      ) : (
                        <button type="button" className="mp-small-button mp-small-button-quiet" disabled={busy} onClick={() => setConfirmingDeleteId(listing.id)}>
                          Delete
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="mp-section">
        <h2>
          Purchase inquiries <span className="mp-count">{openInquiries} open</span>
        </h2>
        <p className="mp-hint">
          Buyers write to you through the listing page. There is no email notification yet — check
          back here and reply directly to the buyer&apos;s email address.
        </p>
        <div className="mp-filter-row">
          {(["all", "open", "answered", "closed"] as const).map((f) => (
            <button
              key={f}
              type="button"
              className={`mp-filter ${inquiryFilter === f ? "mp-filter-active" : ""}`}
              onClick={() => setInquiryFilter(f)}
            >
              {f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
        {visibleInquiries.length === 0 ? (
          <div className="mp-empty">
            <strong>No inquiries here yet.</strong>
            <p>
              {inquiryFilter === "all"
                ? "When a visitor asks about one of your listings, their message lands here with their email address."
                : `No ${inquiryFilter} inquiries.`}
            </p>
          </div>
        ) : (
          <ul className="mp-inquiries">
            {visibleInquiries.map((inquiry) => (
              <li key={inquiry.id} className="mp-inquiry">
                <div className="mp-inquiry-head">
                  <strong>{inquiry.buyerName}</strong>
                  <a href={`mailto:${inquiry.buyerEmail}`}>{inquiry.buyerEmail}</a>
                  <span className={`mp-badge mp-badge-${inquiry.status}`}>{inquiry.status}</span>
                </div>
                <p className="mp-inquiry-listing">
                  About: <Link href={`/marketplace/${inquiry.listingId}`}>{inquiry.listingTitle}</Link> ·{" "}
                  {formatPrice(inquiry.listingPrice, inquiry.listingCurrency)} · {new Date(inquiry.createdAt).toLocaleString()}
                </p>
                <p className="mp-inquiry-message">{inquiry.message}</p>
                <div className="mp-actions">
                  {inquiry.status !== "answered" && (
                    <button type="button" className="mp-small-button" disabled={busy} onClick={() => void updateInquiry(inquiry.id, "answered")}>
                      Mark answered
                    </button>
                  )}
                  {inquiry.status !== "closed" && (
                    <button type="button" className="mp-small-button" disabled={busy} onClick={() => void updateInquiry(inquiry.id, "closed")}>
                      Close
                    </button>
                  )}
                  {inquiry.status !== "open" && (
                    <button type="button" className="mp-small-button mp-small-button-quiet" disabled={busy} onClick={() => void updateInquiry(inquiry.id, "open")}>
                      Reopen
                    </button>
                  )}
                  <a className="mp-small-button mp-small-button-link" href={`mailto:${inquiry.buyerEmail}?subject=${encodeURIComponent(`About “${inquiry.listingTitle}” on SANAA`)}`}>
                    Reply by email
                  </a>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <style>{`
        .mp-wrap { display: grid; gap: 36px; }
        .mp-section h2 { margin: 0 0 8px; font: 450 22px/1.2 var(--font-display), Georgia, serif; }
        .mp-count { font: 600 12px/1 var(--font-body, inherit); color: var(--muted); }
        .mp-hint { margin: 0 0 16px; color: var(--muted); line-height: 1.6; max-width: 720px; }
        .mp-hint a { color: var(--ink); text-decoration: underline; }
        .mp-notice { margin: 0; padding: 12px 14px; border: 1px solid #c8b98a; border-radius: 8px; background: #f7f1e3; color: #5c4a1e; }
        .mp-notice-error { border-color: #d8a49a; background: #f9ecea; color: #7a2e22; }
        .mp-form { display: grid; gap: 14px; padding: 20px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-3); }
        .mp-form label { display: grid; gap: 6px; font-size: 12px; font-weight: 600; color: var(--ink); }
        .mp-form label > span { color: var(--muted); font-weight: 500; }
        .mp-form input, .mp-form select, .mp-form textarea { width: 100%; padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--paper); color: var(--ink); font: inherit; font-weight: 400; }
        .mp-form textarea { resize: vertical; }
        .mp-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 14px; }
        .mp-listings { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 20px; }
        .mp-card { border: 1px solid var(--line); border-radius: 12px; background: var(--surface-3); overflow: hidden; box-shadow: 0 1px 3px rgba(36,30,22,.06); }
        .mp-card-image { display: block; width: 100%; height: 200px; object-fit: cover; background: var(--surface-2); }
        .mp-card-image-empty { display: grid; place-items: center; color: var(--muted); font-size: 12px; }
        .mp-card-body { padding: 14px 16px 16px; display: grid; gap: 6px; }
        .mp-card-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 10px; }
        .mp-card-head h3 { margin: 0; font-size: 16px; }
        .mp-card-head a { color: inherit; text-decoration: none; }
        .mp-card-head a:hover { text-decoration: underline; }
        .mp-card-meta { margin: 0; color: var(--muted); font-size: 12px; line-height: 1.5; }
        .mp-card-price { margin: 4px 0 0; font: 450 18px/1.2 var(--font-display), Georgia, serif; }
        .mp-badge { display: inline-block; flex-shrink: 0; padding: 3px 8px; border-radius: 999px; font-size: 11px; font-weight: 600; background: var(--surface-2); color: var(--muted); text-transform: capitalize; }
        .mp-badge-active, .mp-badge-open { background: #e7ecdf; color: #3f5a2e; }
        .mp-badge-reserved { background: #f7f1e3; color: #7a5c17; }
        .mp-badge-sold, .mp-badge-closed { background: #ece7dd; color: #6b655a; }
        .mp-badge-answered { background: #e3e9f2; color: #2e4a6b; }
        .mp-badge-withdrawn { background: #f9ecea; color: #7a2e22; }
        .mp-actions { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
        .mp-small-button { display: inline-flex; align-items: center; padding: 7px 10px; border: 1px solid var(--line); border-radius: 5px; background: var(--paper); color: var(--ink); font-size: 11px; font-weight: 600; cursor: pointer; text-decoration: none; }
        .mp-small-button:hover { background: var(--surface-2); }
        .mp-small-button:disabled { opacity: .5; cursor: not-allowed; }
        .mp-small-button-quiet { background: transparent; border-color: transparent; color: var(--muted); }
        .mp-small-button-danger { border-color: #d8a49a; color: #7a2e22; }
        .mp-small-button-link { text-decoration: none; }
        .mp-price-form { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 6px; }
        .mp-price-form input { flex: 1 1 140px; padding: 8px 10px; border: 1px solid var(--line); border-radius: 5px; background: var(--paper); color: var(--ink); font: inherit; font-size: 12px; }
        .mp-empty { padding: 20px; border: 1px dashed var(--line); border-radius: 12px; background: var(--surface-3); }
        .mp-empty p { margin: 6px 0 0; color: var(--muted); line-height: 1.6; }
        .mp-filter-row { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; }
        .mp-filter { padding: 6px 12px; border: 1px solid var(--line); border-radius: 999px; background: transparent; color: var(--muted); font-size: 12px; font-weight: 600; cursor: pointer; }
        .mp-filter-active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
        .mp-inquiries { list-style: none; margin: 0; padding: 0; display: grid; gap: 14px; }
        .mp-inquiry { padding: 16px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-3); }
        .mp-inquiry-head { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
        .mp-inquiry-head a { color: var(--muted); font-size: 12px; }
        .mp-inquiry-listing { margin: 8px 0 0; color: var(--muted); font-size: 12px; }
        .mp-inquiry-listing a { color: var(--ink); }
        .mp-inquiry-message { margin: 10px 0 0; line-height: 1.6; white-space: pre-wrap; }
        @media (max-width: 640px) {
          .mp-card-image { height: 170px; }
          .mp-form { padding: 14px; }
        }
      `}</style>
    </div>
  );
}
