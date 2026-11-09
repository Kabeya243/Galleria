import { redirect } from "next/navigation";
import ExhibitionsPage, { type OwnExhibition } from "@/components/exhibitions-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseGalleryRooms } from "@/lib/rooms";

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
      _count: { select: { artworks: true } },
      artworks: { select: { imageUrl: true }, orderBy: { createdAt: "asc" }, take: 1 },
    },
    orderBy: { updatedAt: "desc" },
  });
  return exhibitions.map((exhibition) => ({
    id: exhibition.id,
    title: exhibition.title,
    slug: exhibition.slug,
    status: exhibition.status === "public" ? ("public" as const) : ("draft" as const),
    roomCount: countRooms(exhibition.rooms),
    artworkCount: exhibition._count.artworks,
    views: exhibition.views,
    coverImageUrl: exhibition.artworks[0]?.imageUrl ?? null,
    updatedAt: exhibition.updatedAt.toISOString(),
  }));
}

export default async function ExhibitionsRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const exhibitions = await findOwnExhibitions(user.id);
  return <ExhibitionsPage user={user} exhibitions={exhibitions} />;
}
