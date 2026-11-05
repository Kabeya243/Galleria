import AdminShell from "@/components/admin-shell";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Admin — Artworks",
  description: "Every artwork on SANAA: title, medium, dimensions, year and exhibition.",
};

export default async function AdminArtworksRoute() {
  const user = await requireAdmin();
  const artworks = await db.artwork.findMany({
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      medium: true,
      dimensions: true,
      year: true,
      createdAt: true,
      exhibition: { select: { title: true, status: true, owner: { select: { name: true } } } },
    },
  });

  return (
    <AdminShell
      user={user}
      title="Artworks"
      eyebrow={`ADMIN · ${artworks.length} ARTWORKS`}
      description="Every artwork on SANAA — what it is, where it hangs, and who it belongs to."
    >
      {artworks.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No artworks yet.</strong>
          <p>Artworks appear here as soon as someone adds one to an exhibition.</p>
        </div>
      ) : (
        <table className={styles.inventoryTable}>
          <thead>
            <tr>
              <th>Artwork</th>
              <th>Medium</th>
              <th>Dimensions</th>
              <th>Year</th>
              <th>Exhibition</th>
              <th>Owner</th>
            </tr>
          </thead>
          <tbody>
            {artworks.map((artwork) => (
              <tr key={artwork.id}>
                <td>{artwork.title}</td>
                <td>{artwork.medium}</td>
                <td>{artwork.dimensions}</td>
                <td>{artwork.year}</td>
                <td>
                  {artwork.exhibition.title} ({artwork.exhibition.status})
                </td>
                <td>{artwork.exhibition.owner.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminShell>
  );
}
