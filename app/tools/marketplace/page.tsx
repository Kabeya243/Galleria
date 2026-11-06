import { redirect } from "next/navigation";
import ToolsShell from "@/components/tools-shell";
import MarketplaceTool from "@/components/marketplace";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";

export const metadata = {
  title: "Marketplace — SANAA Tools",
  description: "List your works for sale, manage prices and status, and answer purchase inquiries.",
};

export default async function MarketplaceRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("marketplace", user.id);

  const [exhibitionCount, exhibitions, listings, inquiries] = await Promise.all([
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
  ]);

  const artworks = exhibitions.flatMap((exhibition) =>
    exhibition.artworks.map((artwork) => ({ ...artwork, exhibitionTitle: exhibition.title })),
  );

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="Marketplace"
      eyebrow={`TOOLS · SELLING · ${listings.length} ${listings.length === 1 ? "LISTING" : "LISTINGS"}`}
      description="Put a work up for sale, set its price, and talk to the buyer who asks about it. The inquiry is the sale path — a visitor writes, you reply by email, and you agree the sale directly. No payment is taken on SANAA yet."
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
          listingTitle: row.listing.title,
          listingPrice: row.listing.price,
          listingCurrency: row.listing.currency,
          listingStatus: row.listing.status,
          buyerId: row.buyerId,
          buyerName: row.buyerName,
          buyerEmail: row.buyerEmail,
          message: row.message,
          status: row.status,
          createdAt: row.createdAt.toISOString(),
        }))}
      />
    </ToolsShell>
  );
}
