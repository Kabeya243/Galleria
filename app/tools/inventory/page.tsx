import { redirect } from "next/navigation";
import Link from "next/link";
import InventoryTable from "@/components/inventory-table";
import ToolsShell from "@/components/tools-shell";
import { getCurrentUser } from "@/lib/auth";
import { requireToolAccess } from "@/lib/subscriptions";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import dash from "@/components/redesign-dashboard.module.css";
import page from "@/components/redesign-pages.module.css";

export const metadata = {
  title: "Inventory & Collections: Lakisa Tools",
  description: "Your artworks in one list, what you made, where it is, and what it is worth.",
};

export default async function InventoryRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requireToolAccess(user, "inventory");
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
      redesign
      redesignActive="inventory"
      title="inventory"
      eyebrowOverride={`TOOLS · INVENTORY · ${artworks.length} ARTWORK${artworks.length === 1 ? "" : "S"}`}
      description="inventoryDesc"
    >
      <div className={dash.kpis} style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
        <article className={`${dash.card} ${dash.kpi}`}>
          <div className={dash.kpiLabel}>
            <span>Artworks in total</span>
          </div>
          <div className={`${dash.kpiValue} ${dash.tnum}`}>{artworks.length}</div>
        </article>
        <article className={`${dash.card} ${dash.kpi}`}>
          <div className={dash.kpiLabel}>
            <span>In published exhibitions</span>
          </div>
          <div className={`${dash.kpiValue} ${dash.tnum}`}>{inPublic}</div>
        </article>
        <article className={`${dash.card} ${dash.kpi}`}>
          <div className={dash.kpiLabel}>
            <span>In drafts</span>
          </div>
          <div className={`${dash.kpiValue} ${dash.tnum}`}>{inDrafts}</div>
        </article>
      </div>

      {artworks.length === 0 ? (
        <section className={`${dash.card} ${page.emptyState}`}>
          <h3>No artworks yet.</h3>
          <p>Open an exhibition in the editor and add your first work, it will show up here.</p>
          <Link href="/exhibitions" className={`${page.btn} ${page.btnCta}`}>
            Go to your exhibitions
          </Link>
        </section>
      ) : (
        <InventoryTable artworks={artworks} />
      )}
    </ToolsShell>
  );
}
