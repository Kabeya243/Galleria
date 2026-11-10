import { redirect } from "next/navigation";
import Link from "next/link";
import InventoryTable from "@/components/inventory-table";
import ToolsShell from "@/components/tools-shell";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Inventory & Collections: Lakisa Tools",
  description: "Your artworks in one list, what you made, where it is, and what it is worth.",
};

export default async function InventoryRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("inventory", user.id);
  const [exhibitionCount, artworks] = await Promise.all([
    db.exhibition.count({ where: { ownerId: user.id } }),
    db.artwork.findMany({
      where: { exhibition: { ownerId: user.id } },
      select: {
        id: true,
        title: true,
        medium: true,
        dimensions: true,
        year: true,
        exhibition: { select: { id: true, title: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  const inPublic = artworks.filter((artwork) => artwork.exhibition.status === "public").length;
  const inDrafts = artworks.length - inPublic;

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="inventory"
      eyebrowOverride={`TOOLS · INVENTORY · ${artworks.length} ARTWORK${artworks.length === 1 ? "" : "S"}`}
      description="inventoryDesc"
    >
      <div className={styles.summaryRow}>
        <div>
          <strong>{artworks.length}</strong>
          <span>artworks in total</span>
        </div>
        <div>
          <strong>{inPublic}</strong>
          <span>in published exhibitions</span>
        </div>
        <div>
          <strong>{inDrafts}</strong>
          <span>in drafts</span>
        </div>
      </div>

      {artworks.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No artworks yet.</strong>
          <p>Open an exhibition in the editor and add your first work, it will show up here.</p>
          <Link href="/exhibitions" className="galleries-open-button">
            Go to your exhibitions
          </Link>
        </div>
      ) : (
        <InventoryTable artworks={artworks} />
      )}
    </ToolsShell>
  );
}
