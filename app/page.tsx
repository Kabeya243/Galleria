import Dashboard from "@/components/dashboard";
import PublicHome, { type PublicHomeExhibition } from "@/components/public-home";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { parseGalleryRooms } from "@/lib/rooms";

function countRooms(value: string): number {
  try {
    return parseGalleryRooms(value).length;
  } catch {
    return 0;
  }
}

// Every published exhibition on the platform, newest first — the public
// homepage visitors browse without an account, Artsteps-style.
async function findPublicExhibitions(): Promise<PublicHomeExhibition[]> {
  const exhibitions = await db.exhibition.findMany({
    where: { status: "public" },
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

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) {
    const exhibitions = await findPublicExhibitions();
    return <PublicHome exhibitions={exhibitions} />;
  }

  const exhibitions = await db.exhibition.findMany({
    where: { ownerId: user.id },
    include: { artworks: { orderBy: { createdAt: "desc" } } },
    orderBy: { updatedAt: "desc" },
  });
  const artworkCount = exhibitions.reduce((count, exhibition) => count + exhibition.artworks.length, 0);
  const viewCount = exhibitions.reduce((count, exhibition) => count + exhibition.views, 0);

  return (
    <Dashboard
      user={user}
      exhibitions={exhibitions.map((exhibition) => ({
        id: exhibition.id,
        title: exhibition.title,
        slug: exhibition.slug,
        status: exhibition.status,
        views: exhibition.views,
        artworkCount: exhibition.artworks.length,
      }))}
      artworks={exhibitions.flatMap((exhibition) => exhibition.artworks).slice(0, 3)}
      artworkCount={artworkCount}
      viewCount={viewCount}
    />
  );
}
