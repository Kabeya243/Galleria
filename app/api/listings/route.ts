import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { toClientListing } from "@/lib/listings";

// Marketplace listings (Phase 6).
// GET is public: only active listings, with search / kind / price / sort.
// POST is owner-only: the seller creates a listing from one of their own
// artworks (prefilled) or with manual details. No payment is taken here —
// the inquiry flow is the path to a sale; checkout is a labelled Stripe
// integration point on the listing page, not a real charge.

const KINDS = ["original", "edition", "print", "digital"] as const;
const CURRENCIES = ["USD", "EUR", "GBP", "UGX", "KES", "ZAR", "XOF", "CHF"] as const;

const createSchema = z.object({
  artworkId: z.string().min(1).max(100).optional(),
  title: z.string().min(1).max(200),
  artist: z.string().max(200).optional(),
  year: z.string().max(20).optional(),
  medium: z.string().max(200).optional(),
  dimensions: z.string().max(100).optional(),
  description: z.string().max(4000).optional(),
  imageUrl: z.string().max(1000).optional(),
  price: z.number().int().min(0).max(100_000_000).nullable().optional(),
  currency: z.enum(CURRENCIES).optional(),
  kind: z.enum(KINDS).optional(),
  editionSize: z.number().int().min(1).max(10000).nullable().optional(),
  editionNumber: z.number().int().min(1).max(10000).nullable().optional(),
});

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const q = (params.get("q") ?? "").trim();
  const kind = params.get("kind") ?? "";
  const min = params.get("min");
  const max = params.get("max");
  const sort = params.get("sort") ?? "newest";
  const sellerId = params.get("sellerId") ?? "";
  // The seller tool lists its own listings (any status) through this
  // same endpoint with ?mine=1; the public browse never sees that path.
  const mine = params.get("mine") === "1";

  let sellerFilter: string | undefined;
  if (mine) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: "Sign in to view your listings." }, { status: 401 });
    sellerFilter = user.id;
  } else if (sellerId) {
    sellerFilter = sellerId;
  }

  const minPrice = min !== null && min !== "" ? Number(min) : NaN;
  const maxPrice = max !== null && max !== "" ? Number(max) : NaN;

  const rows = await db.listing.findMany({
    where: {
      ...(mine ? {} : { status: "active" }),
      ...(sellerFilter ? { sellerId: sellerFilter } : {}),
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
    include: { seller: { select: { name: true } }, _count: { select: { inquiries: true } } },
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
  return NextResponse.json({ listings: rows.map(toClientListing) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to create a listing." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the listing details and try again." }, { status: 400 });
  const data = parsed.data;

  // An artworkId must belong to the seller — no listing someone else's work.
  let artwork: { id: string; title: string; artist: string; year: string; medium: string; dimensions: string; description: string; imageUrl: string | null } | null = null;
  if (data.artworkId) {
    artwork = await db.artwork.findFirst({
      where: { id: data.artworkId, exhibition: { ownerId: user.id } },
      select: { id: true, title: true, artist: true, year: true, medium: true, dimensions: true, description: true, imageUrl: true },
    });
    if (!artwork) return NextResponse.json({ error: "That artwork is not yours." }, { status: 403 });
  }

  const row = await db.listing.create({
    data: {
      sellerId: user.id,
      artworkId: artwork?.id ?? null,
      title: data.title || artwork?.title || "Untitled",
      artist: data.artist ?? artwork?.artist ?? "",
      year: data.year ?? artwork?.year ?? "",
      medium: data.medium ?? artwork?.medium ?? "",
      dimensions: data.dimensions ?? artwork?.dimensions ?? "",
      description: data.description ?? artwork?.description ?? "",
      imageUrl: data.imageUrl ?? artwork?.imageUrl ?? null,
      price: data.price ?? null,
      currency: data.currency ?? "USD",
      kind: data.kind ?? "original",
      editionSize: data.editionSize ?? null,
      editionNumber: data.editionNumber ?? null,
      status: "active",
    },
    include: { seller: { select: { name: true } }, _count: { select: { inquiries: true } } },
  });
  return NextResponse.json({ listing: toClientListing(row) }, { status: 201 });
}
