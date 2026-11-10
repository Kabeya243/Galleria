import { redirect } from "next/navigation";
import AdminDenied from "@/components/admin-denied";
import { AdminHero } from "@/components/admin-shell";
import { EmptyBox } from "@/components/admin-ui";
import {
  getAdminContext,
  hasAdminPermission,
  loadAdminUsers,
} from "@/lib/admin-data";

export const metadata = {
  title: "All users: Lakisa",
  description: "Every registered account: who they are, what they do, where they are based, and when they signed up.",
};

export default async function AdminUsersRoute({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { user, access } = await getAdminContext();
  if (!access.isManager && !access.isSubAdmin) {
    return <AdminDenied user={user} />;
  }
  if (!hasAdminPermission(access, "users.view")) redirect("/admin");
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const allUsers = await loadAdminUsers(query);
  return (
    <>
      <AdminHero
        eyebrow={access.isManager ? "ADMIN · FOR THE OWNER ONLY" : "ADMIN · SUB-ADMIN"}
        title="All users"
        description={`${allUsers.length} ${query ? `matching “${query}”` : "registered"}, who they are, what they do, where they are based, and when they signed up.`}
      />
      <div className="ad-section">
        <form className="ad-search" method="get" action="/admin/users">
          <input name="q" defaultValue={query} placeholder="Search by name, email or country…" aria-label="Search users" />
          <button type="submit">Search</button>
        </form>
        {allUsers.length === 0 ? (
          <EmptyBox title="No users match." body="Try a different search, or clear it to see everyone." />
        ) : (
          <div className="ad-card ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Country</th>
                  <th>Exhibitions</th>
                  <th>Signed up</th>
                </tr>
              </thead>
              <tbody>
                {allUsers.map((account) => (
                  <tr key={account.id}>
                    <td>{account.name}</td>
                    <td>{account.email}</td>
                    <td>{account.role ?? "N/A"}</td>
                    <td>{account.country ?? "N/A"}</td>
                    <td>{account._count.exhibitions}</td>
                    <td>{account.createdAt.toLocaleDateString("en-GB")}</td>
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
