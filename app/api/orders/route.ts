import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  computeFees,
  effectiveOfferPrice,
  getSellerPlanSlug,
  postSaleMessage,
  toClientOrder,
} from "@/lib/marketplace-sales";

// Marketplace orders (Nov 2026): a purchase that goes through
// Lakisa. GET ?mine=1 lists the caller's orders, as buyer and as
// seller. POST creates an order in pending_payment, from an accepted
// offer or from a direct buy at the listed price. Automatic methods
// (card, Mobile Money via Flutterwave) stay pending payment until
// billing connects, because no real payment moves yet. Manual methods
// (manual_momo, manual_bank) are the temporary system: the buyer pays
// the seller directly, outside Lakisa, sends the transaction
// reference, and the seller or an admin confirms receipt by hand;
// the payment fee is 0 for manual payments, only the Lakisa
// commission is deducted. The fees are computed from the seller's
// plan at the time of the sale and recorded on the order, so the
// split never changes afterwards.

const createSchema = z.object({
  listingId: z.string().min(1).max(100),
  offerId: z.string().min(1).max(100).optional(),
  buyNow: z.boolean().optional(),
  paymentMethod: z.enum(["card", "mobile_money", "manual_momo", "manual_bank"]).optional(),
});

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view orders." }, { status: 401 });
  if (new URL(request.url).searchParams.get("mine") !== "1") {
    return NextResponse.json({ error: "Use ?mine=1 to list your orders." }, { status: 400 });
  }
  const rows = await db.order.findMany({
    where: { OR: [{ buyerId: user.id }, { sellerId: user.id }] },
    include: {
      listing: { select: { title: true } },
      buyer: { select: { name: true } },
      seller: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ orders: rows.map(toClientOrder) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to place an order." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the order and try again." }, { status: 400 });
  }
  const method = parsed.data.paymentMethod ?? "card";
  const listing = await db.listing.findUnique({
    where: { id: parsed.data.listingId },
    include: { seller: { select: { id: true, name: true, email: true } } },
  });
  if (!listing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  if (listing.sellerId === user.id) {
    return NextResponse.json({ error: "You cannot buy your own listing." }, { status: 400 });
  }
  if (listing.status === "sold" || listing.status === "withdrawn") {
    return NextResponse.json({ error: "This listing is no longer for sale." }, { status: 400 });
  }
  // A listing reserved by another buyer's pending order cannot be
  // bought, and a buyer cannot hold two pending orders on one work.
  const existingPending = await db.order.findFirst({
    where: { listingId: listing.id, status: "pending_payment" },
    select: { id: true, buyerId: true },
  });
  if (existingPending && existingPending.buyerId !== user.id) {
    return NextResponse.json({ error: "This work is reserved for another buyer." }, { status: 400 });
  }
  if (existingPending && existingPending.buyerId === user.id) {
    return NextResponse.json({ error: "You already have a pending order for this work." }, { status: 400 });
  }

  let finalPrice: number;
  let offerId: string | null = null;
  if (parsed.data.offerId) {
    const offer = await db.offer.findUnique({ where: { id: parsed.data.offerId } });
    if (!offer || offer.listingId !== listing.id) {
      return NextResponse.json({ error: "Offer not found." }, { status: 404 });
    }
    if (offer.buyerId !== user.id) {
      return NextResponse.json({ error: "This offer is not yours." }, { status: 403 });
    }
    if (offer.status !== "accepted") {
      return NextResponse.json({ error: "This offer has not been accepted yet." }, { status: 400 });
    }
    finalPrice = effectiveOfferPrice(offer);
    offerId = offer.id;
  } else if (parsed.data.buyNow) {
    if (listing.status !== "active") {
      return NextResponse.json({ error: "This listing is not open for direct purchase." }, { status: 400 });
    }
    if (listing.price === null) {
      return NextResponse.json({ error: "This work is priced on request: make an offer instead." }, { status: 400 });
    }
    finalPrice = listing.price;
  } else {
    return NextResponse.json({ error: "An accepted offer or a direct purchase is required." }, { status: 400 });
  }

  const planSlug = await getSellerPlanSlug(listing.sellerId);
  const fees = computeFees(finalPrice, planSlug, method);
  const order = await db.order.create({
    data: {
      listingId: listing.id,
      buyerId: user.id,
      sellerId: listing.sellerId,
      offerId,
      title: listing.title,
      finalPrice,
      currency: listing.currency,
      commissionRate: fees.commissionRate,
      commissionAmount: fees.commissionAmount,
      paymentMethod: method,
      paymentFeeRate: fees.paymentFeeRate,
      paymentFeeAmount: fees.paymentFeeAmount,
      sellerNet: fees.sellerNet,
      status: "pending_payment",
    },
    include: {
      listing: { select: { title: true } },
      buyer: { select: { name: true } },
      seller: { select: { name: true } },
    },
  });
  // The work is reserved while the order waits for payment, so nobody
  // else can buy it in the meantime.
  await db.listing.update({ where: { id: listing.id }, data: { status: "reserved" } });
  const origin = new URL(request.url).origin;
  const manual = method === "manual_momo" || method === "manual_bank";
  await postSaleMessage({
    senderId: user.id,
    senderName: user.name,
    recipientId: listing.sellerId,
    recipientEmail: listing.seller.email,
    artworkId: listing.artworkId,
    body: manual
      ? `New order: ${finalPrice} ${listing.currency} for "${listing.title}" (manual payment, pending). Lakisa commission ${fees.commissionAmount}, no payment fee, you receive ${fees.sellerNet}. The buyer pays you directly by ${method === "manual_momo" ? "Mobile Money (MTN/Airtel)" : "bank transfer"} and will send the transaction reference. Confirm receipt in your Orders when the money arrives.`
      : `New order: ${finalPrice} ${listing.currency} for "${listing.title}" (pending payment). Lakisa commission ${fees.commissionAmount}, payment fee ${fees.paymentFeeAmount}, you receive ${fees.sellerNet}.`,
    origin,
  });
  return NextResponse.json({ order: toClientOrder(order) }, { status: 201 });
}
