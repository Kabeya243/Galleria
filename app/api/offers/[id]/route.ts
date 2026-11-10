import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { postSaleMessage, toClientOffer } from "@/lib/marketplace-sales";

// One offer: the seller accepts, counters or declines it; the buyer
// accepts a counter or withdraws it. The accepted offer's price is
// the amount, or the counter amount when the buyer accepted a counter.
// Every change posts a message into the existing private thread
// between buyer and seller, so both sides see it in their inbox.

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  action: z.enum(["accept", "acceptCounter", "counter", "decline", "withdraw"]),
  counterAmount: z.number().int().min(1).max(100_000_000).optional(),
});

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to answer an offer." }, { status: 401 });
  const { id } = await params;
  const offer = await db.offer.findUnique({
    where: { id },
    include: {
      listing: {
        select: { id: true, title: true, currency: true, minPrice: true, artworkId: true },
      },
      buyer: { select: { id: true, name: true, email: true } },
      seller: { select: { id: true, name: true, email: true } },
    },
  });
  if (!offer) return NextResponse.json({ error: "Offer not found." }, { status: 404 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the action and try again." }, { status: 400 });
  }
  const { action } = parsed.data;
  const isSeller = offer.sellerId === user.id;
  const isBuyer = offer.buyerId === user.id;
  const active = offer.status === "open" || offer.status === "countered";

  let nextStatus: string;
  let counterAmount: number | undefined;
  let messageBody = "";
  let recipientId = "";
  let recipientEmail = "";

  if (action === "accept") {
    if (!isSeller || offer.status !== "open") {
      return NextResponse.json({ error: "Only the seller can accept an open offer." }, { status: 400 });
    }
    nextStatus = "accepted";
    messageBody = `Your offer of ${offer.amount} ${offer.listing.currency} on "${offer.listing.title}" was accepted. You can now pay that price through Lakisa.`;
    recipientId = offer.buyerId;
    recipientEmail = offer.buyer.email;
  } else if (action === "acceptCounter") {
    if (!isBuyer || offer.status !== "countered" || offer.counterAmount === null) {
      return NextResponse.json({ error: "There is no counter offer to accept." }, { status: 400 });
    }
    nextStatus = "accepted";
    messageBody = `The buyer accepted your counter offer of ${offer.counterAmount} ${offer.listing.currency} on "${offer.listing.title}". They can now pay that price through Lakisa.`;
    recipientId = offer.sellerId;
    recipientEmail = offer.seller.email;
  } else if (action === "counter") {
    if (!isSeller || !active) {
      return NextResponse.json({ error: "Only the seller can counter an open offer." }, { status: 400 });
    }
    const counter = parsed.data.counterAmount;
    if (!counter) {
      return NextResponse.json({ error: "A counter price is required." }, { status: 400 });
    }
    if (offer.listing.minPrice !== null && counter < offer.listing.minPrice) {
      return NextResponse.json(
        {
          error: `The counter price cannot be below the minimum price of ${offer.listing.minPrice} ${offer.listing.currency}.`,
        },
        { status: 400 },
      );
    }
    nextStatus = "countered";
    counterAmount = counter;
    messageBody = `Counter offer: ${counter} ${offer.listing.currency} on "${offer.listing.title}". You can accept it, make another offer, or withdraw.`;
    recipientId = offer.buyerId;
    recipientEmail = offer.buyer.email;
  } else if (action === "decline") {
    if (!isSeller || !active) {
      return NextResponse.json({ error: "Only the seller can decline an open offer." }, { status: 400 });
    }
    nextStatus = "declined";
    messageBody = `Your offer of ${offer.amount} ${offer.listing.currency} on "${offer.listing.title}" was declined.`;
    recipientId = offer.buyerId;
    recipientEmail = offer.buyer.email;
  } else {
    if (!isBuyer || !active) {
      return NextResponse.json({ error: "Only the buyer can withdraw an open offer." }, { status: 400 });
    }
    nextStatus = "withdrawn";
    messageBody = `The buyer withdrew their offer of ${offer.amount} ${offer.listing.currency} on "${offer.listing.title}".`;
    recipientId = offer.sellerId;
    recipientEmail = offer.seller.email;
  }

  const updated = await db.offer.update({
    where: { id: offer.id },
    data: {
      status: nextStatus,
      ...(counterAmount !== undefined ? { counterAmount } : {}),
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
    recipientId,
    recipientEmail,
    artworkId: offer.listing.artworkId,
    body: messageBody,
    origin,
  });
  return NextResponse.json({ offer: toClientOffer(updated) });
}
