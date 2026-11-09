import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import ListingInquiryForm from "@/components/marketplace-inquiry-form";
import CurrencySelector, { RatesNote } from "@/components/currency-selector";
import BrandLogo from "@/components/brand-logo";
import ListingPrice from "@/components/listing-price";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

type RouteProps = { params: Promise<{ id: string }> };

function kindLabel(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { id } = await params;
  const listing = await db.listing.findUnique({ where: { id }, select: { title: true, artist: true, description: true } });
  if (!listing) return { title: "Listing not found: Lakisa" };
  return {
    title: `${listing.title}: Lakisa Marketplace`,
    description: listing.description || `${listing.title} by ${listing.artist}, for sale on Lakisa.`,
  };
}

// Public listing detail. The seller's name and the work's details are
// public; the inquiry form is the working path to a sale. Checkout is
// deliberately NOT a button: there is no payment provider connected,
// so the page says so plainly and names what connecting Stripe needs.
export default async function ListingDetailPage({ params }: RouteProps) {
  const { id } = await params;
  const listing = await db.listing.findUnique({
    where: { id },
    include: { seller: { select: { id: true, name: true } } },
  });
  if (!listing || listing.status === "withdrawn") notFound();

  const user = await getCurrentUser();
  const isOwner = user?.id === listing.sellerId;
  const openToInquiries = listing.status === "active" || listing.status === "reserved";

  return (
    <main className="galleries-page">
      <header className="galleries-header">
        <Link className="brand-lockup" href="/">
          <BrandLogo variant="horizontal" height={52} />
        </Link>
        <nav className="galleries-nav">
          <Link href="/marketplace">Marketplace</Link>
          <Link href="/explore">Exhibitions</Link>
          {user ? (
            <Link href="/tools/marketplace" className="galleries-signin">
              Sell your work
            </Link>
          ) : (
            <Link href="/login" className="galleries-signin">
              Sign in
            </Link>
          )}
        </nav>
      </header>

      <div className="mp-detail">
        <p className="eyebrow">
          <span className="status-dot" /> MARKETPLACE · {kindLabel(listing.kind).toUpperCase()}
          {listing.status !== "active" ? ` · ${listing.status.toUpperCase()}` : ""}
        </p>
        <div className="mp-detail-grid">
          <div>
            {listing.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={listing.imageUrl} alt={listing.title} className="mp-detail-image" />
            ) : (
              <div className="mp-detail-image mp-detail-image-empty">
                <span>No image provided</span>
              </div>
            )}
          </div>
          <div className="mp-detail-body">
            <h1>{listing.title}</h1>
            <p className="mp-detail-artist">
              {listing.artist}
              {listing.year ? ` · ${listing.year}` : ""}
            </p>
            <p className="mp-detail-price">
              <ListingPrice price={listing.price} currency={listing.currency} variant="detail" />
            </p>
            <div className="mp-detail-currency">
              <CurrencySelector id="mp-detail-currency" />
              <RatesNote />
            </div>
            <dl className="mp-detail-facts">
              <div>
                <dt>Seller</dt>
                <dd>{listing.seller.name}</dd>
              </div>
              {listing.medium && (
                <div>
                  <dt>Medium</dt>
                  <dd>{listing.medium}</dd>
                </div>
              )}
              {listing.dimensions && (
                <div>
                  <dt>Dimensions</dt>
                  <dd>{listing.dimensions}</dd>
                </div>
              )}
              {listing.editionSize && (
                <div>
                  <dt>Edition</dt>
                  <dd>
                    {listing.editionNumber ?? "N/A"} of {listing.editionSize}
                  </dd>
                </div>
              )}
              <div>
                <dt>Status</dt>
                <dd>{listing.status === "active" ? "For sale" : listing.status.charAt(0).toUpperCase() + listing.status.slice(1)}</dd>
              </div>
              <div>
                <dt>Listed</dt>
                <dd>{new Date(listing.createdAt).toLocaleDateString(undefined, { day: "numeric", month: "long", year: "numeric" })}</dd>
              </div>
            </dl>
            {listing.description && <p className="mp-detail-description">{listing.description}</p>}
            {isOwner && (
              <p className="mp-detail-owner-note">
                This is your listing.{" "}
                <Link href="/tools/marketplace">Manage it in the Marketplace tool</Link>.
              </p>
            )}
          </div>
        </div>

        <div className="mp-detail-lower">
          <div>
            {openToInquiries && !isOwner ? (
              <ListingInquiryForm listingId={listing.id} listingTitle={listing.title} />
            ) : listing.status === "sold" ? (
              <div className="mp-detail-note">
                <strong>This work has sold.</strong>
                <p>It stays listed as a record. Browse the marketplace for other works by this artist.</p>
              </div>
            ) : isOwner ? (
              <div className="mp-detail-note">
                <strong>Your listing.</strong>
                <p>Visitors see the inquiry form here; their messages arrive in your Marketplace tool.</p>
              </div>
            ) : (
              <div className="mp-detail-note">
                <strong>Inquiries are closed for this listing.</strong>
                <p>It is no longer open for sale.</p>
              </div>
            )}
          </div>

          <aside className="mp-checkout-box">
            <h2>Checkout: Stripe integration point (not connected)</h2>
            <p>
              There is no payment provider connected to Lakisa yet, so this listing has no checkout
              button and no money moves on this page. The inquiry above is the complete working
              path to a sale: you and the seller agree the price, shipping and payment directly.
            </p>
            <p>To turn this into a real checkout, the platform needs:</p>
            <ul>
              <li>A Stripe account for the seller or the platform.</li>
              <li>
                <code>STRIPE_SECRET_KEY</code> set in the Vercel project environment.
              </li>
              <li>A Checkout Session created server-side for this listing, with the listing id as metadata.</li>
            </ul>
            <p className="mp-checkout-note">
              Until then, never send payment details through the inquiry form, agree payment with
              the seller by email first.
            </p>
            <Link href="/marketplace" className="galleries-open-button">
              Back to the marketplace
            </Link>
          </aside>
        </div>
      </div>

      <style>{`
        .mp-detail { max-width: 1100px; margin: 0 auto; padding: 64px 44px 60px; }
        .mp-detail-grid { display: grid; grid-template-columns: 1.1fr 1fr; gap: 36px; margin-top: 20px; }
        .mp-detail h1 { margin: 0; font: 450 clamp(28px, 3vw, 40px)/1.1 var(--font-display), Georgia, serif; }
        .mp-detail-image { display: block; width: 100%; height: auto; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-2); }
        .mp-detail-image-empty { display: grid; place-items: center; min-height: 320px; color: var(--muted); }
        .mp-detail-artist { margin: 10px 0 0; color: var(--muted); font-size: 15px; }
        .mp-detail-price { margin: 14px 0 0; font: 450 28px/1.2 var(--font-display), Georgia, serif; }
        .mp-detail-currency { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 8px 18px; align-items: center; }
        .mp-detail-facts { margin: 20px 0 0; display: grid; gap: 10px; }
        .mp-detail-facts > div { display: grid; grid-template-columns: 120px 1fr; gap: 12px; padding-bottom: 10px; border-bottom: 1px solid var(--line); }
        .mp-detail-facts dt { color: var(--muted); font-size: 12px; }
        .mp-detail-facts dd { margin: 0; font-size: 13px; }
        .mp-detail-description { margin: 20px 0 0; line-height: 1.7; white-space: pre-wrap; }
        .mp-detail-owner-note { margin: 20px 0 0; padding: 12px 14px; border: 1px solid #c8b98a; border-radius: 8px; background: #f7f1e3; font-size: 13px; line-height: 1.6; }
        .mp-detail-owner-note a { color: var(--ink); }
        .mp-detail-lower { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin-top: 36px; align-items: start; }
        .mp-detail-note { padding: 20px; border: 1px solid var(--line); border-radius: 12px; background: var(--surface-3); }
        .mp-detail-note p { margin: 6px 0 0; color: var(--muted); line-height: 1.6; }
        .mp-checkout-box { padding: 20px; border: 1px dashed #a67c37; border-radius: 12px; background: #fbf7ef; }
        .mp-checkout-box h2 { margin: 0 0 10px; font: 450 18px/1.3 var(--font-display), Georgia, serif; }
        .mp-checkout-box p, .mp-checkout-box li { color: var(--muted); font-size: 13px; line-height: 1.65; }
        .mp-checkout-box ul { margin: 8px 0 12px; padding-left: 18px; }
        .mp-checkout-box code { background: var(--surface-2); padding: 1px 5px; border-radius: 4px; font-size: 12px; }
        .mp-checkout-note { color: var(--ink) !important; }
        @media (max-width: 820px) {
          .mp-detail { padding: 40px 20px 48px; }
          .mp-detail-grid, .mp-detail-lower { grid-template-columns: 1fr; }
        }
      `}</style>
    </main>
  );
}
