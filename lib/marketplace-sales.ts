// Marketplace sales (Nov 2026): fees, offer and order serialisers,
// and the messages that keep buyer and seller in sync.
//
// Fees: two fees on the final agreed price.
// (a) Lakisa commission: 10% on Discovery and Creator, 5% on Studio,
// from the seller's plan at the time of the sale.
// (b) Flutterwave payment fee: about 4.8% by card, 3% by Mobile Money
// in Uganda (indicative rates, always shown as such).
// Manual payment (temporary, Nov 2026): the buyer pays outside
// Lakisa, by Mobile Money (MTN/Airtel) or bank transfer, so there is
// no payment provider and the payment fee is 0; only the Lakisa
// commission is deducted.
// The seller receives the final price minus the commission minus the
// payment fee. Money is whole currency units, like Listing price;
// each fee is rounded to the nearest unit. Example: a 1,500 $ sale on
// Creator by card: commission 150 $, payment fee 72 $, seller 1,278 $.
// The same sale paid manually: commission 150 $, payment fee 0 $,
// seller 1,350 $.
//
// No payment is taken here: these are the numbers the checkout shows
// and the order records. Flutterwave is not connected yet, so
// automatic orders stay pending_payment until billing connects;
// manual orders move to paid when the seller or an admin confirms
// receipt by hand.

import { db } from "@/lib/db";
import { findOrCreateConversation, notifyRecipient } from "@/lib/messages";

export const COMMISSION_RATE_DISCOVERY_CREATOR = 0.1;
export const COMMISSION_RATE_STUDIO = 0.05;
export const PAYMENT_FEE_RATE_CARD = 0.048;
export const PAYMENT_FEE_RATE_MOBILE_MONEY = 0.03;

// The same rates as a map, for pages that pass them to the client
// (the offer box shows the fee split before confirming). Manual
// methods cost no payment fee.
export const PAYMENT_FEE_RATES: Record<PaymentMethod, number> = {
  card: PAYMENT_FEE_RATE_CARD,
  mobile_money: PAYMENT_FEE_RATE_MOBILE_MONEY,
  manual_momo: 0,
  manual_bank: 0,
};

export type PaymentMethod = "card" | "mobile_money" | "manual_momo" | "manual_bank";

// Manual methods (Nov 2026): the buyer pays outside Lakisa, so no
// payment provider takes a fee.
export function isManualPaymentMethod(method: string): boolean {
  return method === "manual_momo" || method === "manual_bank";
}

export const ORDER_STATUSES = [
  "pending_payment",
  "paid",
  "shipped",
  "delivered",
  "completed",
  "cancelled",
  "refunded",
] as const;

export function isPaymentMethod(value: unknown): value is PaymentMethod {
  return (
    value === "card" ||
    value === "mobile_money" ||
    value === "manual_momo" ||
    value === "manual_bank"
  );
}

export function commissionRateForPlan(planSlug: string | null | undefined): number {
  return planSlug === "studio" ? COMMISSION_RATE_STUDIO : COMMISSION_RATE_DISCOVERY_CREATOR;
}

export function paymentFeeRateForMethod(method: PaymentMethod): number {
  if (method === "manual_momo" || method === "manual_bank") return 0;
  return method === "mobile_money" ? PAYMENT_FEE_RATE_MOBILE_MONEY : PAYMENT_FEE_RATE_CARD;
}

export function paymentMethodLabel(method: string): string {
  switch (method) {
    case "mobile_money":
      return "Mobile Money";
    case "manual_momo":
      return "Mobile Money (manual, MTN/Airtel)";
    case "manual_bank":
      return "Bank transfer (manual)";
    default:
      return "Card";
  }
}

export function computeFees(
  finalPrice: number,
  planSlug: string | null | undefined,
  method: PaymentMethod,
) {
  const commissionRate = commissionRateForPlan(planSlug);
  const paymentFeeRate = paymentFeeRateForMethod(method);
  const commissionAmount = Math.round(finalPrice * commissionRate);
  const paymentFeeAmount = Math.round(finalPrice * paymentFeeRate);
  return {
    commissionRate,
    commissionAmount,
    paymentFeeRate,
    paymentFeeAmount,
    sellerNet: finalPrice - commissionAmount - paymentFeeAmount,
  };
}

// The seller's plan slug at the time of the sale, read straight from
// the subscription row. No row yet means Discovery (10%). This reads
// Prisma directly and does not touch lib/subscriptions.ts.
export async function getSellerPlanSlug(sellerId: string): Promise<string> {
  const row = await db.subscription.findUnique({
    where: { userId: sellerId },
    include: { plan: { select: { slug: true } } },
  });
  return row?.plan.slug ?? "discovery";
}

// The price an accepted offer settles at: the counter price when the
// buyer accepted a counter, otherwise the offered price.
export function effectiveOfferPrice(offer: {
  amount: number;
  counterAmount: number | null;
}): number {
  return offer.counterAmount ?? offer.amount;
}

export function orderStatusLabel(status: string): string {
  switch (status) {
    case "pending_payment":
      return "Pending payment";
    case "paid":
      return "Paid";
    case "shipped":
      return "Shipped";
    case "delivered":
      return "Delivered";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "refunded":
      return "Refunded";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

export function offerStatusLabel(status: string): string {
  switch (status) {
    case "open":
      return "Open";
    case "accepted":
      return "Accepted";
    case "countered":
      return "Counter offer";
    case "declined":
      return "Declined";
    case "withdrawn":
      return "Withdrawn";
    default:
      return status.charAt(0).toUpperCase() + status.slice(1);
  }
}

export type ClientOffer = {
  id: string;
  listingId: string;
  listingTitle: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  amount: number;
  counterAmount: number | null;
  // The currency comes from the listing (offers are priced in the
  // listing's currency); it is needed wherever the offer is shown.
  currency: string;
  message: string;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export function toClientOffer(row: {
  id: string;
  listingId: string;
  listing: { title: string; currency: string };
  buyerId: string;
  buyer: { name: string };
  sellerId: string;
  seller: { name: string };
  amount: number;
  counterAmount: number | null;
  message: string;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}): ClientOffer {
  return {
    id: row.id,
    listingId: row.listingId,
    listingTitle: row.listing.title,
    buyerId: row.buyerId,
    buyerName: row.buyer.name,
    sellerId: row.sellerId,
    sellerName: row.seller.name,
    amount: row.amount,
    counterAmount: row.counterAmount,
    currency: row.listing.currency,
    message: row.message,
    status: row.status,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type ClientOrder = {
  id: string;
  listingId: string;
  listingTitle: string;
  buyerId: string;
  buyerName: string;
  sellerId: string;
  sellerName: string;
  offerId: string | null;
  title: string;
  finalPrice: number;
  currency: string;
  commissionRate: number;
  commissionAmount: number;
  paymentMethod: string;
  paymentFeeRate: number;
  paymentFeeAmount: number;
  sellerNet: number;
  status: string;
  // Manual payment (Nov 2026): the transaction reference the buyer
  // sent, and when the receipt was confirmed by hand.
  paymentReference: string | null;
  paidConfirmedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export function toClientOrder(row: {
  id: string;
  listingId: string;
  listing: { title: string };
  buyerId: string;
  buyer: { name: string };
  sellerId: string;
  seller: { name: string };
  offerId: string | null;
  title: string;
  finalPrice: number;
  currency: string;
  commissionRate: number;
  commissionAmount: number;
  paymentMethod: string;
  paymentFeeRate: number;
  paymentFeeAmount: number;
  sellerNet: number;
  status: string;
  paymentReference: string | null;
  paidConfirmedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}): ClientOrder {
  return {
    id: row.id,
    listingId: row.listingId,
    listingTitle: row.listing.title,
    buyerId: row.buyerId,
    buyerName: row.buyer.name,
    sellerId: row.sellerId,
    sellerName: row.seller.name,
    offerId: row.offerId,
    title: row.title,
    finalPrice: row.finalPrice,
    currency: row.currency,
    commissionRate: row.commissionRate,
    commissionAmount: row.commissionAmount,
    paymentMethod: row.paymentMethod,
    paymentFeeRate: row.paymentFeeRate,
    paymentFeeAmount: row.paymentFeeAmount,
    sellerNet: row.sellerNet,
    status: row.status,
    paymentReference: row.paymentReference,
    paidConfirmedAt: row.paidConfirmedAt ? row.paidConfirmedAt.toISOString() : null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// Post an offer or order event into the existing private messaging
// thread between buyer and seller, so both sides see it in their
// inbox (/messages). Best effort on the email: a missing SMTP setup
// never blocks the record itself.
export async function postSaleMessage(args: {
  senderId: string;
  senderName: string;
  recipientId: string;
  recipientEmail: string;
  artworkId: string | null;
  body: string;
  origin: string;
}) {
  try {
    const conversation = await findOrCreateConversation(args.senderId, args.recipientId, {
      artworkId: args.artworkId,
    });
    await db.message.create({
      data: { conversationId: conversation.id, senderId: args.senderId, body: args.body },
    });
    await db.conversation.update({
      where: { id: conversation.id },
      data: { updatedAt: new Date() },
    });
    await notifyRecipient(
      args.recipientEmail,
      args.senderName,
      args.body,
      conversation.id,
      args.origin,
    );
  } catch {
    // The offer or order itself is already saved; the message is only
    // a notification and must never fail the sale step.
  }
}
