import { redirect } from "next/navigation";
import LibraryPage from "@/components/library-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listLibraryWorks } from "@/lib/library";

export const metadata = {
  title: "Mes œuvres — Lakisa",
  description: "Your reusable artwork library — every work you have uploaded, across all your exhibitions.",
};

// The artist's own reusable library: every work they have ever
// uploaded, all exhibitions together (backfilled from the artworks
// already hanging in their exhibitions on first read — see
// lib/library.ts), plus their exhibitions for the "add to an
// exhibition" picker. Reuse is a copy with the same image — never a
// re-upload.
export default async function ArtworksRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const [works, exhibitions] = await Promise.all([
    listLibraryWorks(user.id),
    db.exhibition.findMany({
      where: { ownerId: user.id },
      select: { id: true, title: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);
  return <LibraryPage user={user} works={works} exhibitions={exhibitions} />;
}
