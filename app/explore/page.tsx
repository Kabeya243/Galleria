import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import ExplorePage, { type ExploreExhibition } from "@/components/explore-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseGalleryRooms } from "@/lib/rooms";

export const metadata = {
  title: "Explore — Lakisa",
  description: "Browse public exhibitions by other artists, curators and galleries — and walk through them.",
};

function countRooms(value: string): number {
  try {
    return parseGalleryRooms(value).length;
  } catch {
    return 0;
  }
}

// Every public exhibition by OTHER people — when signed in, the viewer's
// own exhibitions are left out, so Explore is where you discover others.
async function findOtherPublicExhibitions(viewerId?: string): Promise<ExploreExhibition[]> {
  const exhibitions = await db.exhibition.findMany({
    where: {
      status: "public",
      visibility: "public",
      ...(viewerId ? { ownerId: { not: viewerId } } : {}),
    },
    include: {
      owner: { select: { name: true } },
      _count: { select: { artworks: true } },
      artworks: { select: { imageUrl: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
    orderBy: { publishedAt: { sort: "desc", nulls: "last" } },
  });
  return exhibitions.map((exhibition) => ({
    id: exhibition.id,
    title: exhibition.title,
    slug: exhibition.slug,
    artistName: exhibition.owner.name,
    roomCount: countRooms(exhibition.rooms),
    artworkCount: exhibition._count.artworks,
    views: exhibition.views,
    coverImageUrl: exhibition.artworks[0]?.imageUrl ?? null,
  }));
}

export default async function ExploreRoute() {
  const user = await getCurrentUser();
  const exhibitions = await findOtherPublicExhibitions(user?.id);
  const ownExhibitionCount = user ? await db.exhibition.count({ where: { ownerId: user.id } }) : 0;
  return <ExplorePage user={user} exhibitions={exhibitions} ownExhibitionCount={ownExhibitionCount} />;
}
