import AdminShell from "@/components/admin-shell";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Admin — Users",
  description: "Every registered account on SANAA: name, email, role, country and signup date.",
};

export default async function AdminUsersRoute({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const user = await requireAdmin();
  const { q } = await searchParams;
  const query = (q ?? "").trim();
  const users = await db.user.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { email: { contains: query, mode: "insensitive" } },
            { country: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      country: true,
      createdAt: true,
      _count: { select: { exhibitions: true } },
    },
  });

  return (
    <AdminShell
      user={user}
      title="Users"
      eyebrow={`ADMIN · ${users.length} REGISTERED`}
      description="Every account on SANAA — who they are, what they do, where they are based, and when they signed up."
    >
      <form className={styles.contactForm} method="get">
        <label className={styles.field}>
          <span>Search by name, email or country</span>
          <input name="q" defaultValue={query} placeholder="Search…" />
        </label>
        <button type="submit" className="primary-button">
          Search
        </button>
      </form>
      {users.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No users match.</strong>
          <p>Try a different search, or clear it to see everyone.</p>
        </div>
      ) : (
        <table className={styles.inventoryTable}>
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
            {users.map((account) => (
              <tr key={account.id}>
                <td>{account.name}</td>
                <td>{account.email}</td>
                <td>{account.role ?? "—"}</td>
                <td>{account.country ?? "—"}</td>
                <td>{account._count.exhibitions}</td>
                <td>{account.createdAt.toLocaleDateString("en-GB")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </AdminShell>
  );
}
