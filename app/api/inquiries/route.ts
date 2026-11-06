import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Purchase inquiries (Phase 6). POST is public — any visitor can ask
// about an active or reserved listing. GET is seller-only: a seller
// reads inquiries on their own listings, never anyone else's. Email
// notifications are out of scope: the seller checks the inbox here and
// replies directly to the buyer's email address.

const createSchema = z
  .object({
    listingId: z.string().min(1).max(100).optional(),
    artworkId: z.string().min(1).max(100).optional(),
    exhibitionId: z.string().min(1).max(100).optional(),
    buyerName: z.string().min(1).max(200),
    buyerEmail: z.string().min(3).max(200).email(),
    message: z.string().min(1).max(4000),
  })
  .refine((data) => data.listingId || (data.artworkId && data.exhibitionId), {
    message: "A listing or an artwork is required.",
  });

function toClientInquiry(row: {
  id: string;
  listingId: string | null;
  artworkId: string | null;
  exhibitionId: string | null;
  buyerId: string | null;
  buyerName: string;
  buyerEmail: string;
  message: string;
  status: string;
  createdAt: Date;
  listing?: { title: string; price: number | null; currency: string; status: string } | null;
}) {
  return {
    id: row.id,
    listingId: row.listingId,
    artworkId: row.artworkId,
    exhibitionId: row.exhibitionId,
    listingTitle: row.listing?.title ?? "",
    listingPrice: row.listing?.price ?? null,
    listingCurrency: row.listing?.currency ?? "USD",
    listingStatus: row.listing?.status ?? "",
    buyerId: row.buyerId,
    buyerName: row.buyerName,
    buyerEmail: row.buyerEmail,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt,
  };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to read inquiries." }, { status: 401 });
  const params = new URL(request.url).searchParams;
  const listingId = params.get("listingId") ?? "";
  const exhibitionId = params.get("exhibitionId") ?? "";
  const status = params.get("status") ?? "";

  // Artist-contact inquiries on the caller's own exhibitions (sent from
  // an artwork detail panel — no marketplace listing involved).
  if (exhibitionId) {
    const exhibition = await db.exhibition.findFirst({
      where: { id: exhibitionId, ownerId: user.id },
      select: { id: true },
    });
    if (!exhibition) return NextResponse.json({ error: "Exhibition not found." }, { status: 404 });
    const rows = await db.inquiry.findMany({
      where: {
        exhibitionId,
        ...(status === "open" || status === "answered" || status === "closed" ? { status } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return NextResponse.json({ inquiries: rows.map(toClientInquiry) });
  }

  const rows = await db.inquiry.findMany({
    where: {
      listing: { sellerId: user.id },
      ...(listingId ? { listingId } : {}),
      ...(status === "open" || status === "answered" || status === "closed" ? { status } : {}),
    },
    include: { listing: { select: { title: true, price: true, currency: true, status: true } } },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ inquiries: rows.map(toClientInquiry) });
}

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Name, a valid email and a message are required." }, { status: 400 });
  const data = parsed.data;

  // If the visitor is signed in, link the inquiry to their account.
  const user = await getCurrentUser().catch(() => null);

  // Artist-contact path: a message about an artwork in a published
  // exhibition — no marketplace listing. The artwork must belong to the
  // exhibition, and the exhibition must be published.
  if (data.artworkId && data.exhibitionId) {
    const artwork = await db.artwork.findFirst({
      where: { id: data.artworkId, exhibitionId: data.exhibitionId },
      select: { id: true, exhibition: { select: { status: true } } },
    });
    if (!artwork) return NextResponse.json({ error: "Artwork not found." }, { status: 404 });
    if (artwork.exhibition.status !== "public") {
      return NextResponse.json({ error: "This exhibition is not open to messages." }, { status: 409 });
    }
    const row = await db.inquiry.create({
      data: {
        artworkId: artwork.id,
        exhibitionId: data.exhibitionId,
        buyerId: user?.id ?? null,
        buyerName: data.buyerName.trim(),
        buyerEmail: data.buyerEmail.trim().toLowerCase(),
        message: data.message.trim(),
        status: "open",
      },
    });
    return NextResponse.json({ inquiry: toClientInquiry(row) }, { status: 201 });
  }

  const listing = await db.listing.findUnique({ where: { id: data.listingId }, select: { id: true, status: true } });
  if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  if (listing.status !== "active" && listing.status !== "reserved") {
    return NextResponse.json({ error: "This listing is no longer open to inquiries." }, { status: 409 });
  }

  const row = await db.inquiry.create({
    data: {
      listingId: listing.id,
      buyerId: user?.id ?? null,
      buyerName: data.buyerName.trim(),
      buyerEmail: data.buyerEmail.trim().toLowerCase(),
      message: data.message.trim(),
      status: "open",
    },
    include: { listing: { select: { title: true, price: true, currency: true, status: true } } },
  });
  return NextResponse.json({ inquiry: toClientInquiry(row) }, { status: 201 });
}
