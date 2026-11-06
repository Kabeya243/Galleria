// Shared serialiser for marketplace listings (Phase 6). Lives in lib
// because Next.js route files may only export HTTP handlers.

export function toClientListing(row: {
  id: string;
  sellerId: string;
  artworkId: string | null;
  title: string;
  artist: string;
  year: string;
  medium: string;
  dimensions: string;
  description: string;
  imageUrl: string | null;
  price: number | null;
  currency: string;
  kind: string;
  editionSize: number | null;
  editionNumber: number | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
  seller?: { name: string };
  _count?: { inquiries: number };
}) {
  return {
    id: row.id,
    sellerId: row.sellerId,
    sellerName: row.seller?.name ?? "",
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
    inquiryCount: row._count?.inquiries ?? 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
