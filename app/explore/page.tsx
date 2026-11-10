import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import ExplorePage, { type ExploreExhibition } from "@/components/explore-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseGalleryRooms } from "@/lib/rooms";
import { toServingImageUrl } from "@/lib/r2";

export const metadata = {
  title: "Explore: Lakisa",
  description: "Browse public exhibitions by other artists, curators and galleries, and walk through them.",
};

function countRooms(value: string): number {
  try {
    return parseGalleryRooms(value).length;
  } catch {
    return 0;
  }
}

// Every public exhibition on the platform — including the viewer's
// own. Explore is the public list, so a public exhibition must be
// visible here whoever looks at it (the old owner exclusion hid your
// own public shows from you, which read as a bug in testing).
async function findPublicExhibitions(): Promise<ExploreExhibition[]> {
  const exhibitions = await db.exhibition.findMany({
    where: {
      status: "public",
      visibility: "public",
    },
    include: {
      owner: { select: { id: true, name: true } },
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
    ownerId: exhibition.owner.id,
    roomCount: countRooms(exhibition.rooms),
    artworkCount: exhibition._count.artworks,
    views: exhibition.views,
    coverImageUrl: toServingImageUrl(exhibition.artworks[0]?.imageUrl),
  }));
}

export default async function ExploreRoute() {
  const user = await getCurrentUser();
  const exhibitions = await findPublicExhibitions();
  const ownExhibitionCount = user ? await db.exhibition.count({ where: { ownerId: user.id } }) : 0;
  return <ExplorePage user={user} exhibitions={exhibitions} ownExhibitionCount={ownExhibitionCount} />;
}
