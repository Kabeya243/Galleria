import { redirect } from "next/navigation";
import AdminDenied from "@/components/admin-denied";
import AdminShell from "@/components/admin-shell";
import { EmptyBox } from "@/components/admin-ui";
import {
  adminSections,
  getAdminContext,
  hasAdminPermission,
  loadAdminArtworks,
  loadAdminShellCounts,
} from "@/lib/admin-data";

export const metadata = {
  title: "All artworks: Lakisa",
  description: "Every artwork: what it is, where it hangs, and who it belongs to.",
};

export default async function AdminArtworksRoute() {
  const { user, access } = await getAdminContext();
  if (!access.isManager && !access.isSubAdmin) {
    return <AdminDenied user={user} />;
  }
  if (!hasAdminPermission(access, "artworks.view")) redirect("/admin");
  const [allArtworks, counts] = await Promise.all([loadAdminArtworks(), loadAdminShellCounts()]);
  return (
    <AdminShell
      user={user}
      title="All artworks"
      eyebrow={access.isManager ? "ADMIN · FOR THE OWNER ONLY" : "ADMIN · SUB-ADMIN"}
      description={`${allArtworks.length} artworks, what it is, where it hangs, and who it belongs to.`}
      counts={counts}
      sections={adminSections(access)}
      active="artworks"
    >
      <div className="ad-section">
        {allArtworks.length === 0 ? (
          <EmptyBox title="No artworks yet." body="Artworks appear here as soon as someone adds one to an exhibition." />
        ) : (
          <div className="ad-card ad-table-wrap">
            <table className="ad-table">
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
                {allArtworks.map((artwork) => (
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
          </div>
        )}
      </div>
    </AdminShell>
  );
}
