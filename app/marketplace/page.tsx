import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import CurrencySelector, { RatesNote } from "@/components/currency-selector";
import InDevelopmentBox from "@/components/in-development-box";
import BrandLogo from "@/components/brand-logo";
import PublicNav from "@/components/public-nav";
import ListingPrice from "@/components/listing-price";

export const metadata: Metadata = {
  title: "Marketplace: Lakisa",
  description: "Originals, editions, prints and digital works for sale by artists on Lakisa.",
};

const KINDS = ["original", "edition", "print", "digital"] as const;

type SearchParams = { q?: string; kind?: string; min?: string; max?: string; sort?: string };

function kindLabel(kind: string): string {
  return kind.charAt(0).toUpperCase() + kind.slice(1);
}

// Public marketplace: anyone can browse active listings. Search by
// title, artist or medium; filter by kind and price range; sort by
// newest, price or title. Filters are plain GET parameters, so the page
// works with no JavaScript at all.
export default async function MarketplaceBrowsePage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const q = (params.q ?? "").trim();
  const kind = params.kind ?? "";
  const min = params.min ?? "";
  const max = params.max ?? "";
  const sort = params.sort ?? "newest";
  const user = await getCurrentUser();

  const minPrice = min !== "" ? Number(min) : NaN;
  const maxPrice = max !== "" ? Number(max) : NaN;

  const listings = await db.listing.findMany({
    where: {
      status: "active",
      ...(KINDS.includes(kind as (typeof KINDS)[number]) ? { kind } : {}),
      ...(!Number.isNaN(minPrice) || !Number.isNaN(maxPrice)
        ? {
            price: {
              ...(!Number.isNaN(minPrice) ? { gte: Math.max(0, Math.floor(minPrice)) } : {}),
              ...(!Number.isNaN(maxPrice) ? { lte: Math.floor(maxPrice) } : {}),
            },
          }
        : {}),
      ...(q
        ? {
            OR: [
              { title: { contains: q, mode: "insensitive" } },
              { artist: { contains: q, mode: "insensitive" } },
              { medium: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { seller: { select: { name: true } } },
    orderBy:
      sort === "price-asc"
        ? { price: "asc" }
        : sort === "price-desc"
          ? { price: "desc" }
          : sort === "title"
            ? { title: "asc" }
            : { createdAt: "desc" },
    take: 200,
  });

  return (
    <main className="galleries-page">
      <header className="galleries-header">
        <Link className="brand-lockup" href="/">
          <BrandLogo variant="horizontal" height={52} />
        </Link>
        <PublicNav
          links={[
            { href: "/marketplace", label: "Marketplace" },
            { href: "/explore", label: "Exhibitions" },
            user
              ? { href: "/tools/marketplace", label: "Sell your work", primary: true }
              : { href: "/login", label: "Sign in", primary: true },
          ]}
        />
      </header>

      <div className="galleries-intro">
        <p className="eyebrow">
          <span className="status-dot" /> MARKETPLACE
        </p>
        <h1>Works for sale.</h1>
        <p>
          Originals, editions, prints and digital works, listed by the artists themselves. To buy
          one, send an inquiry, the seller replies directly, and price, shipping and payment are
          agreed between you.
        </p>
        <InDevelopmentBox title="In development">
          The marketplace is still being built. You can browse listings and send inquiries, but
          buying, payments and shipping are not handled on Lakisa yet: price, shipping and payment
          are agreed directly with the seller.
        </InDevelopmentBox>
      </div>

      <form method="get" action="/marketplace" className="mp-browse-filters">
        <input type="search" name="q" defaultValue={q} placeholder="Search title, artist or medium…" aria-label="Search listings" />
        <select name="kind" defaultValue={kind} aria-label="Filter by kind">
          <option value="">All kinds</option>
          {KINDS.map((k) => (
            <option key={k} value={k}>
              {kindLabel(k)}
            </option>
          ))}
        </select>
        <input type="number" name="min" defaultValue={min} placeholder="Min price" min={0} aria-label="Minimum price" />
        <input type="number" name="max" defaultValue={max} placeholder="Max price" min={0} aria-label="Maximum price" />
        <select name="sort" defaultValue={sort} aria-label="Sort listings">
          <option value="newest">Newest first</option>
          <option value="price-asc">Price: low to high</option>
          <option value="price-desc">Price: high to low</option>
          <option value="title">Title A–Z</option>
        </select>
        <button type="submit" className="primary-button">
          Search
        </button>
        {(q || kind || min || max || sort !== "newest") && (
          <Link href="/marketplace" className="mp-clear">
            Clear filters
          </Link>
        )}
      </form>

      <div className="mp-browse-currency">
        <CurrencySelector id="mp-currency" />
        <RatesNote />
      </div>

      {listings.length === 0 ? (
        <div className="galleries-intro">
          <div className="mp-browse-empty">
            <strong>No works match that search.</strong>
            <p>Try a different word, or clear the filters to see everything for sale.</p>
          </div>
        </div>
      ) : (
        <div className="galleries-grid">
          {listings.map((listing) => (
            <article key={listing.id} className="gallery-card">
              <Link href={`/marketplace/${listing.id}`} className="gallery-card-preview-button" aria-label={listing.title}>
                {listing.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={listing.imageUrl} alt={listing.title} className="mp-browse-image" loading="lazy" />
                ) : (
                  <div className="mp-browse-image mp-browse-image-empty">
                    <span>No image</span>
                  </div>
                )}
              </Link>
              <div className="gallery-card-body">
                <h3>
                  <Link href={`/marketplace/${listing.id}`}>{listing.title}</Link>
                </h3>
                <p>
                  {listing.artist}
                  {listing.year ? ` · ${listing.year}` : ""}
                </p>
                <p>
                  {kindLabel(listing.kind)}
                  {listing.editionSize ? ` · ${listing.editionNumber ?? "N/A"}/${listing.editionSize}` : ""}
                  {listing.medium ? ` · ${listing.medium}` : ""}
                </p>
                <p className="mp-browse-price">
                  <ListingPrice price={listing.price} currency={listing.currency} variant="browse" />
                </p>
                <p className="gallery-card-finishes">by {listing.seller.name}</p>
                <div className="gallery-card-actions">
                  <Link href={`/marketplace/${listing.id}`} className="galleries-open-button">
                    View the work
                  </Link>
                </div>
              </div>
            </article>
          ))}
          </div>
      )}

      <style>{`
        .mp-browse-filters { max-width: 1350px; margin: 0 auto; padding: 8px 44px 0; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
        .mp-browse-filters input, .mp-browse-filters select { padding: 10px 12px; border: 1px solid var(--line); border-radius: 6px; background: var(--paper); color: var(--ink); font: inherit; font-size: 13px; }
        .mp-browse-filters input[type="search"] { flex: 1 1 240px; }
        .mp-browse-filters input[type="number"] { width: 120px; }
        .mp-browse-currency { max-width: 1350px; margin: 0 auto; padding: 18px 44px 0; display: flex; flex-wrap: wrap; gap: 8px 18px; align-items: center; }
        .mp-clear { color: var(--muted); font-size: 12px; }
        .mp-browse-image { display: block; width: 100%; height: 220px; object-fit: cover; background: var(--surface-2); }
        .mp-browse-image-empty { display: grid; place-items: center; color: var(--muted); font-size: 12px; }
        .mp-browse-price { font: 450 18px/1.2 var(--font-display), Georgia, serif; color: var(--ink); }
        .mp-browse-empty { padding: 20px; border: 1px dashed var(--line); border-radius: 12px; background: var(--surface-3); }
        .mp-browse-empty p { margin: 6px 0 0; color: var(--muted); line-height: 1.6; }
        @media (max-width: 640px) {
          .mp-browse-filters { padding: 8px 20px 0; }
          .mp-browse-currency { padding: 14px 20px 0; }
          .mp-browse-filters input[type="number"] { flex: 1 1 120px; }
        }
      `}</style>
    </main>
  );
}
