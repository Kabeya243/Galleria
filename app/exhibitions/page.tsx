import { redirect } from "next/navigation";
import ExhibitionsPage, { type OwnExhibition } from "@/components/exhibitions-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseGalleryRooms, placedArtworks } from "@/lib/rooms";
import { toServingImageUrl } from "@/lib/r2";

export const metadata = {
  title: "Exhibitions: Lakisa",
  description: "Your exhibitions, drafts and published rooms, in one place.",
};

function countRooms(value: string): number {
  try {
    return parseGalleryRooms(value).length;
  } catch {
    return 0;
  }
}

// The owner's own exhibitions only — drafts and published — newest first.
async function findOwnExhibitions(ownerId: string): Promise<OwnExhibition[]> {
  const exhibitions = await db.exhibition.findMany({
    where: { ownerId },
    include: {
      artworks: { select: { roomId: true, imageUrl: true }, orderBy: { createdAt: "asc" } },
    },
    orderBy: { updatedAt: "desc" },
  });
  return exhibitions.map((exhibition) => {
    const { count, coverImageUrl } = placedArtworks(exhibition.rooms, exhibition.artworks);
    return {
      id: exhibition.id,
      title: exhibition.title,
      slug: exhibition.slug,
      status: exhibition.status === "public" ? ("public" as const) : ("draft" as const),
      roomCount: countRooms(exhibition.rooms),
      artworkCount: count,
      views: exhibition.views,
      coverImageUrl: toServingImageUrl(coverImageUrl),
      updatedAt: exhibition.updatedAt.toISOString(),
    };
  });
}

export default async function ExhibitionsRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const exhibitions = await findOwnExhibitions(user.id);
  return <ExhibitionsPage user={user} exhibitions={exhibitions} />;
}
