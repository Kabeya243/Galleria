import FeedPage from "@/components/feed-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Feed — SANAA",
  description: "Published exhibitions from artists across SANAA — step inside and walk through them.",
};

// The publication feed reads live from GET /api/social/feed on the
// client (cursor pagination, 12 per page); the server only resolves
// the viewer for the shell, like /explore does.
export default async function FeedRoute() {
  const user = await getCurrentUser();
  const ownExhibitionCount = user ? await db.exhibition.count({ where: { ownerId: user.id } }) : 0;
  return <FeedPage user={user} ownExhibitionCount={ownExhibitionCount} />;
}
