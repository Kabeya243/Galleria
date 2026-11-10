import Link from "next/link";
import { redirect } from "next/navigation";
import AdminDenied from "@/components/admin-denied";
import { AdminHero } from "@/components/admin-shell";
import { EmptyBox } from "@/components/admin-ui";
import {
  getAdminContext,
  hasAdminPermission,
  loadAdminExhibitions,
} from "@/lib/admin-data";

export const metadata = {
  title: "All exhibitions: Lakisa",
  description: "Every exhibition: who built it, whether it is public, how many works it holds and how many visits it received.",
};

export default async function AdminExhibitionsRoute() {
  const { user, access } = await getAdminContext();
  if (!access.isManager && !access.isSubAdmin) {
    return <AdminDenied user={user} />;
  }
  if (!hasAdminPermission(access, "exhibitions.view")) redirect("/admin");
  const allExhibitions = await loadAdminExhibitions();
  return (
    <>
      <AdminHero
        eyebrow={access.isManager ? "ADMIN · FOR THE OWNER ONLY" : "ADMIN · SUB-ADMIN"}
        title="All exhibitions"
        description={`${allExhibitions.length} exhibitions, who built it, whether it is public, how many works it holds and how many visits it received.`}
      />
      <div className="ad-section">
        {allExhibitions.length === 0 ? (
          <EmptyBox title="No exhibitions yet." body="Exhibitions appear here as soon as someone creates one." />
        ) : (
          <div className="ad-card ad-table-wrap">
            <table className="ad-table">
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
                {allExhibitions.map((exhibition) => (
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
          </div>
        )}
      </div>
    </>
  );
}
