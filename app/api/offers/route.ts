import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { postSaleMessage, toClientOffer } from "@/lib/marketplace-sales";

// Marketplace offers (Nov 2026): negotiation on a listing. GET lists
// the offers on one listing (the seller sees all of them, a buyer
// sees only their own). POST makes an offer: the buyer proposes a
// price, and the seller accepts, counters or declines it later.
// An offer below the seller's minimum price is refused at creation,
// with a clear message. One active offer (open or countered) per
// buyer per listing: making a new offer withdraws the previous one.

const createSchema = z.object({
  listingId: z.string().min(1).max(100),
  amount: z.number().int().min(1).max(100_000_000),
  message: z.string().max(2000).optional(),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view offers." }, { status: 401 });
  const listingId = new URL(request.url).searchParams.get("listingId") ?? "";
  const listing = await db.listing.findUnique({
    where: { id: listingId },
    select: { sellerId: true },
  });
  if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  const isSeller = listing.sellerId === user.id;
  const rows = await db.offer.findMany({
    where: { listingId, ...(isSeller ? {} : { buyerId: user.id }) },
    include: {
      listing: { select: { title: true, currency: true } },
      buyer: { select: { name: true } },
      seller: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ offers: rows.map(toClientOffer) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to make an offer." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the offer amount and try again." }, { status: 400 });
  }
  const listing = await db.listing.findUnique({
    where: { id: parsed.data.listingId },
    include: { seller: { select: { id: true, name: true, email: true } } },
  });
  if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  if (listing.sellerId === user.id) {
    return NextResponse.json({ error: "You cannot make an offer on your own listing." }, { status: 400 });
  }
  if (listing.status !== "active" && listing.status !== "reserved") {
    return NextResponse.json({ error: "This listing is no longer open for offers." }, { status: 400 });
  }
  if (listing.minPrice !== null && parsed.data.amount < listing.minPrice) {
    return NextResponse.json(
      {
        error: `Offers below the seller's minimum price of ${listing.minPrice} ${listing.currency} are refused automatically.`,
        minimumPrice: listing.minPrice,
      },
      { status: 400 },
    );
  }
  // One active offer per buyer per listing: a new offer withdraws the
  // previous open or countered one.
  await db.offer.updateMany({
    where: { listingId: listing.id, buyerId: user.id, status: { in: ["open", "countered"] } },
    data: { status: "withdrawn" },
  });
  const offer = await db.offer.create({
    data: {
      listingId: listing.id,
      buyerId: user.id,
      sellerId: listing.sellerId,
      amount: parsed.data.amount,
      message: parsed.data.message?.trim() ?? "",
    },
    include: {
      listing: { select: { title: true, currency: true } },
      buyer: { select: { name: true } },
      seller: { select: { name: true } },
    },
  });
  const origin = new URL(request.url).origin;
  await postSaleMessage({
    senderId: user.id,
    senderName: user.name,
    recipientId: listing.sellerId,
    recipientEmail: listing.seller.email,
    artworkId: listing.artworkId,
    body: `New offer: ${parsed.data.amount} ${listing.currency} on "${listing.title}".`,
    origin,
  });
  return NextResponse.json({ offer: toClientOffer(offer) }, { status: 201 });
}
