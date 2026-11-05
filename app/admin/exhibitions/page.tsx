import Link from "next/link";
import AdminShell from "@/components/admin-shell";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Admin — Exhibitions",
  description: "Every exhibition on SANAA: owner, status, artworks and visits.",
};

export default async function AdminExhibitionsRoute() {
  const user = await requireAdmin();
  const exhibitions = await db.exhibition.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      title: true,
      slug: true,
      status: true,
      views: true,
      createdAt: true,
      updatedAt: true,
      owner: { select: { name: true, email: true } },
      _count: { select: { artworks: true } },
    },
  });

  return (
    <AdminShell
      user={user}
      title="Exhibitions"
      eyebrow={`ADMIN · ${exhibitions.length} EXHIBITIONS`}
      description="Every exhibition on SANAA — who built it, whether it is public, how many works it holds and how many visits it received."
    >
      {exhibitions.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No exhibitions yet.</strong>
          <p>Exhibitions appear here as soon as someone creates one.</p>
        </div>
      ) : (
        <table className={styles.inventoryTable}>
          <thead>
            <tr>
              <th>Exhibition</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Artworks</th>
              <th>Visits</th>
              <th>Updated</th>
            </tr>
          </thead>
          <tbody>
            {exhibitions.map((exhibition) => (
              <tr key={exhibition.id}>
                <td>
                  {exhibition.status === "public" ? (
                    <Link href={`/exhibition/${exhibition.slug}`}>{exhibition.title}</Link>
                  ) : (
                    exhibition.title
                  )}
                </td>
                <td>
                  {exhibition.owner.name} ({exhibition.owner.email})
                </td>
                <td>{exhibition.status}</td>
                <td>{exhibition._count.artworks}</td>
                <td>{exhibition.views}</td>
                <td>{exhibition.updatedAt.toLocaleDateString("en-GB")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminShell>
  );
}
