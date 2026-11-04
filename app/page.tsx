import { redirect } from "next/navigation";
import Dashboard from "@/components/dashboard";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function HomePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

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
