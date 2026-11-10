import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { isManualPaymentMethod, postSaleMessage, toClientOrder } from "@/lib/marketplace-sales";

// One order: read it (buyer, seller, or an admin with orders.view),
// or change it while it is still pending payment:
// - cancel: buyer, seller or an admin with orders.manage. Cancelling
//   reopens the accepted offer, so the buyer can pay again later, and
//   puts the listing back for sale when no other pending order holds
//   it.
// - submitReference: the buyer, on a manual payment only. The buyer
//   paid the seller directly, outside Lakisa, and sends the
//   transaction reference as proof.
// - markPaid: the seller, or an admin with orders.manage, on a manual
//   payment only. The seller confirms the money arrived; the order
//   moves to paid and the work is marked sold. A reference is
//   required: the one the buyer sent, or one entered here. Automatic
//   (Flutterwave) orders are never marked paid by hand: their
//   confirmation comes from the payment webhook once it is connected.

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({
  action: z.enum(["cancel", "submitReference", "markPaid"]),
  paymentReference: z.string().trim().min(1).max(200).optional(),
});

async function loadOrder(userId: string, id: string) {
  const order = await db.order.findUnique({
    where: { id },
    include: {
      listing: { select: { title: true, artworkId: true } },
      buyer: { select: { id: true, name: true, email: true } },
      seller: { select: { id: true, name: true, email: true } },
    },
  });
  if (!order) return null;
  return order;
}

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view an order." }, { status: 401 });
  const { id } = await params;
  const order = await loadOrder(user.id, id);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const isParty = order.buyerId === user.id || order.sellerId === user.id;
  const access = isParty ? null : await requireAdminPermission("orders.view");
  if (!isParty && !access) {
    return NextResponse.json({ error: "This order is not yours." }, { status: 403 });
  }
  return NextResponse.json({ order: toClientOrder(order) });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to change an order." }, { status: 401 });
  const { id } = await params;
  const order = await loadOrder(user.id, id);
  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });
  const body: unknown = await request.json().catch(() => null);
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Check the action and try again." }, { status: 400 });
  }
  const action = parsed.data.action;
  const origin = new URL(request.url).origin;

  // --- The buyer sends the transaction reference (manual only) -----
  if (action === "submitReference") {
    if (order.buyerId !== user.id) {
      return NextResponse.json({ error: "Only the buyer can send the payment reference." }, { status: 403 });
    }
    if (order.status !== "pending_payment") {
      return NextResponse.json({ error: "Only a pending order can receive a payment reference." }, { status: 400 });
    }
    if (!isManualPaymentMethod(order.paymentMethod)) {
      return NextResponse.json({ error: "This order is paid automatically, not manually." }, { status: 400 });
    }
    const reference = parsed.data.paymentReference;
    if (!reference) {
      return NextResponse.json({ error: "A transaction reference is required." }, { status: 400 });
    }
    const updated = await db.order.update({
      where: { id: order.id },
      data: { paymentReference: reference },
      include: {
        listing: { select: { title: true } },
        buyer: { select: { name: true } },
        seller: { select: { name: true } },
      },
    });
    await postSaleMessage({
      senderId: user.id,
      senderName: user.name,
      recipientId: order.sellerId,
      recipientEmail: order.seller.email,
      artworkId: order.listing.artworkId,
      body: `Payment reference received for "${order.listing.title}" (${order.finalPrice} ${order.currency}): ${reference}. Please check that the money arrived, then confirm receipt in your Orders.`,
      origin,
    });
    return NextResponse.json({ order: toClientOrder(updated) });
  }

  // --- The seller or an admin confirms receipt (manual only) -------
  if (action === "markPaid") {
    const isSeller = order.sellerId === user.id;
    const access = isSeller ? null : await requireAdminPermission("orders.manage");
    if (!isSeller && !access) {
      return NextResponse.json({ error: "Only the seller or an admin can confirm this payment." }, { status: 403 });
    }
    if (order.status !== "pending_payment") {
      return NextResponse.json({ error: "Only a pending order can be marked paid." }, { status: 400 });
    }
    if (!isManualPaymentMethod(order.paymentMethod)) {
      return NextResponse.json({ error: "Only a manual payment can be confirmed by hand." }, { status: 400 });
    }
    const reference = order.paymentReference ?? parsed.data.paymentReference;
    if (!reference) {
      return NextResponse.json({ error: "A transaction reference is required to confirm payment." }, { status: 400 });
    }
    const now = new Date();
    const updated = await db.order.update({
      where: { id: order.id },
      data: {
        status: "paid",
        paidAt: now,
        paidConfirmedBy: user.id,
        paidConfirmedAt: now,
        paymentReference: reference,
      },
      include: {
        listing: { select: { title: true } },
        buyer: { select: { name: true } },
        seller: { select: { name: true } },
      },
    });
    // The work is sold when the payment is confirmed.
    await db.listing.update({ where: { id: order.listingId }, data: { status: "sold" } });
    await postSaleMessage({
      senderId: user.id,
      senderName: user.name,
      recipientId: order.buyerId,
      recipientEmail: order.buyer.email,
      artworkId: order.listing.artworkId,
      body: `Payment confirmed for "${order.listing.title}" (${order.finalPrice} ${order.currency}, reference ${reference}). The work is sold; the seller will send it as agreed.`,
      origin,
    });
    return NextResponse.json({ order: toClientOrder(updated) });
  }

  // --- Cancel --------------------------------------------------------
  const isParty = order.buyerId === user.id || order.sellerId === user.id;
  const access = isParty ? null : await requireAdminPermission("orders.manage");
  if (!isParty && !access) {
    return NextResponse.json({ error: "Only the buyer, the seller or an admin can cancel this order." }, { status: 403 });
  }
  if (order.status !== "pending_payment") {
    return NextResponse.json({ error: "Only a pending order can be cancelled." }, { status: 400 });
  }
  const updated = await db.order.update({
    where: { id: order.id },
    data: { status: "cancelled", cancelledAt: new Date() },
    include: {
      listing: { select: { title: true } },
      buyer: { select: { name: true } },
      seller: { select: { name: true } },
    },
  });
  // Reopen the accepted offer, so the buyer can pay again later, and
  // put the listing back for sale when no other pending order holds it.
  if (order.offerId) {
    await db.offer.updateMany({
      where: { id: order.offerId, status: "accepted" },
      data: { status: "open" },
    });
  }
  const otherPending = await db.order.findFirst({
    where: { listingId: order.listingId, status: "pending_payment" },
    select: { id: true },
  });
  if (!otherPending) {
    await db.listing.update({ where: { id: order.listingId }, data: { status: "active" } });
  }
  const otherId = order.buyerId === user.id ? order.sellerId : order.buyerId;
  const otherEmail = order.buyerId === user.id ? order.seller.email : order.buyer.email;
  await postSaleMessage({
    senderId: user.id,
    senderName: user.name,
    recipientId: otherId,
    recipientEmail: otherEmail,
    artworkId: order.listing.artworkId,
    body: `Order cancelled: ${order.finalPrice} ${order.currency} for "${order.listing.title}". The work is back for sale.`,
    origin,
  });
  return NextResponse.json({ order: toClientOrder(updated) });
}
