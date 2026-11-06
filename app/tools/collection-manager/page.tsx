import { redirect } from "next/navigation";
import Link from "next/link";
import ToolsShell from "@/components/tools-shell";
import CollectionManager from "@/components/collection-manager";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Collection Manager — SANAA Tools",
  description:
    "Your whole collection in one place — every artwork across all your exhibitions, with search, filters, tags, availability, provenance, inventory numbers, condition reports and bulk actions.",
};

export default async function CollectionManagerRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("collection-manager", user.id);
  const [exhibitionCount, artworks, records] = await Promise.all([
    db.exhibition.count({ where: { ownerId: user.id } }),
    db.artwork.findMany({
      where: { exhibition: { ownerId: user.id } },
      select: {
        id: true,
        title: true,
        artist: true,
        year: true,
        medium: true,
        dimensions: true,
        imageUrl: true,
        exhibitionId: true,
        createdAt: true,
        exhibition: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.savedWork.findMany({
      where: { userId: user.id, kind: "collection-record" },
      select: { id: true, title: true, data: true, artworkId: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 500,
    }),
  ]);

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="Collection Manager"
      eyebrow="TOOLS · COLLECTION MANAGER"
      description="Every artwork you own, across all your exhibitions, in one table. Search, filter and sort, tag works, track availability and location, and keep provenance, inventory numbers, condition reports and notes on each piece."
    >
      {artworks.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No artworks yet.</strong>
          <p>Open an exhibition in the editor and add your first work — it will show up here as soon as it exists.</p>
          <Link href="/exhibitions" className="galleries-open-button">
            Go to your exhibitions
          </Link>
        </div>
      ) : (
        <CollectionManager
          artworks={artworks.map((a) => ({
            id: a.id,
            title: a.title,
            artist: a.artist,
            year: a.year,
            medium: a.medium,
            dimensions: a.dimensions,
            imageUrl: a.imageUrl,
            exhibitionId: a.exhibitionId,
            exhibitionTitle: a.exhibition.title,
            createdAt: a.createdAt.toISOString(),
          }))}
          initialRecords={records.map((r) => ({
            id: r.id,
            title: r.title,
            data: r.data,
            artworkId: r.artworkId,
            updatedAt: r.updatedAt.toISOString(),
          }))}
        />
      )}
    </ToolsShell>
  );
}
