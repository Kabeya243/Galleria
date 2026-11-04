import type { Metadata } from "next";
import { notFound } from "next/navigation";
import PublicExhibition from "@/components/public-exhibition";
import { toClientArtwork } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseGalleryRooms } from "@/lib/rooms";

type RouteProps = { params: Promise<{ slug: string }> };

async function findPublishedExhibition(slug: string) {
  return db.exhibition.findFirst({
    where: { slug, status: "public" },
    include: {
      owner: { select: { name: true } },
      artworks: { orderBy: { createdAt: "asc" } },
    },
  });
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const exhibition = await findPublishedExhibition(slug);
  if (!exhibition) return { title: "Exhibition not found — SANAA" };
  return {
    title: `${exhibition.title} — SANAA`,
    description: exhibition.description || `A virtual exhibition curated by ${exhibition.owner.name}.`,
  };
}

export default async function PublicExhibitionPage({ params }: RouteProps) {
  const { slug } = await params;
  const exhibition = await findPublishedExhibition(slug);
  if (!exhibition) notFound();

  await db.exhibition.update({
    where: { id: exhibition.id },
    data: { views: { increment: 1 } },
  });

  return (
    <PublicExhibition
      exhibition={{
        title: exhibition.title,
        description: exhibition.description,
        ownerName: exhibition.owner.name,
        rooms: parseGalleryRooms(exhibition.rooms),
        artworks: exhibition.artworks.map(toClientArtwork),
      }}
    />
  );
}
