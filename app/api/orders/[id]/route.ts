import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { postSaleMessage, toClientOrder } from "@/lib/marketplace-sales";

// One order: read it (buyer, seller, or an admin with orders.view),
// or cancel it while it is still pending payment. Cancelling reopens
// the accepted offer, so the buyer can pay again later, and puts the
// listing back for sale when no other pending order holds it. Paid,
// shipped, delivered and completed are set later, by the payment
// webhook and the seller, once Flutterwave is connected; they are not
// reachable from this route today.

type RouteContext = { params: Promise<{ id: string }> };

const patchSchema = z.object({ action: z.literal("cancel") });

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
    return NextResponse.json({ error: "Only cancelling is available for now." }, { status: 400 });
  }
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
  const origin = new URL(request.url).origin;
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
