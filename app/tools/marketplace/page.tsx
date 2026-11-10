import { redirect } from "next/navigation";
import ToolsShell from "@/components/tools-shell";
import MarketplaceTool from "@/components/marketplace";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import { toClientOffer, toClientOrder } from "@/lib/marketplace-sales";

export const metadata = {
  title: "Marketplace: Lakisa Tools",
  description: "List your works for sale, manage offers, orders and fees, and answer purchase inquiries.",
};

export default async function MarketplaceRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("marketplace", user.id);

  const [exhibitionCount, exhibitions, listings, inquiries, offers, orders] = await Promise.all([
    db.exhibition.count({ where: { ownerId: user.id } }),
    db.exhibition.findMany({
      where: { ownerId: user.id },
      select: {
        id: true,
        title: true,
        artworks: {
          select: { id: true, title: true, artist: true, year: true, medium: true, dimensions: true, description: true, imageUrl: true },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.listing.findMany({
      where: { sellerId: user.id },
      include: { seller: { select: { name: true } }, _count: { select: { inquiries: true } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.inquiry.findMany({
      where: { listing: { sellerId: user.id } },
      include: { listing: { select: { title: true, price: true, currency: true, status: true } } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.offer.findMany({
      where: { sellerId: user.id },
      include: {
        listing: { select: { title: true, currency: true } },
        buyer: { select: { name: true } },
        seller: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
    db.order.findMany({
      where: { sellerId: user.id },
      include: {
        listing: { select: { title: true } },
        buyer: { select: { name: true } },
        seller: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const artworks = exhibitions.flatMap((exhibition) =>
    exhibition.artworks.map((artwork) => ({ ...artwork, exhibitionTitle: exhibition.title })),
  );

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="marketplace"
      eyebrowOverride={`TOOLS · SELLING · ${listings.length} ${listings.length === 1 ? "LISTING" : "LISTINGS"}`}
      description="marketplaceDesc"
    >
      <MarketplaceTool
        artworks={artworks}
        listings={listings.map((row) => ({
          id: row.id,
          sellerId: row.sellerId,
          sellerName: row.seller.name,
          artworkId: row.artworkId,
          title: row.title,
          artist: row.artist,
          year: row.year,
          medium: row.medium,
          dimensions: row.dimensions,
          description: row.description,
          imageUrl: row.imageUrl,
          price: row.price,
          minPrice: row.minPrice,
          saleConditions: row.saleConditions,
          shippingIncluded: row.shippingIncluded,
          shippingDelay: row.shippingDelay,
          returnsAccepted: row.returnsAccepted,
          oneTimePayment: row.oneTimePayment,
          currency: row.currency,
          kind: row.kind,
          editionSize: row.editionSize,
          editionNumber: row.editionNumber,
          status: row.status,
          inquiryCount: row._count.inquiries,
          createdAt: row.createdAt.toISOString(),
          updatedAt: row.updatedAt.toISOString(),
        }))}
        inquiries={inquiries.map((row) => ({
          id: row.id,
          listingId: row.listingId,
          listingTitle: row.listing?.title ?? "",
          listingPrice: row.listing?.price ?? null,
          listingCurrency: row.listing?.currency ?? "USD",
          listingStatus: row.listing?.status ?? "",
          buyerId: row.buyerId,
          buyerName: row.buyerName,
          buyerEmail: row.buyerEmail,
          message: row.message,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
        }))}
        offers={offers.map((row) => toClientOffer(row))}
        orders={orders.map((row) => toClientOrder(row))}
      />
    </ToolsShell>
  );
}
