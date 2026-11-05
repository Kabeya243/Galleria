import Link from "next/link";
import AdminShell from "@/components/admin-shell";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Admin — Overview",
  description: "Platform overview for the owner: users, exhibitions, artworks and visits.",
};

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default async function AdminOverviewRoute() {
  const user = await requireAdmin();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [
    userCount,
    newUsers,
    exhibitionCount,
    publicExhibitions,
    artworkCount,
    totalViews,
    topExhibitions,
    recentUsers,
    recentExhibitions,
    storage,
  ] = await Promise.all([
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
    db.exhibition.count(),
    db.exhibition.count({ where: { status: "public" } }),
    db.artwork.count(),
    db.exhibition.aggregate({ _sum: { views: true } }),
    db.exhibition.findMany({
      orderBy: { views: "desc" },
      take: 5,
      select: { id: true, title: true, slug: true, status: true, views: true, owner: { select: { name: true } } },
    }),
    db.user.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, name: true, email: true, role: true, country: true, createdAt: true } }),
    db.exhibition.findMany({ orderBy: { createdAt: "desc" }, take: 5, select: { id: true, title: true, status: true, createdAt: true, owner: { select: { name: true } } } }),
    db.$queryRaw<{ total: bigint }[]>`SELECT COALESCE(SUM(octet_length(data)), 0) AS total FROM "Upload"`,
  ]);
  const storageBytes = Number(storage[0]?.total ?? 0);

  const stats = [
    { label: "Registered users", value: userCount, note: `${newUsers} new this week` },
    { label: "Exhibitions", value: exhibitionCount, note: `${publicExhibitions} public` },
    { label: "Artworks", value: artworkCount, note: "across all exhibitions" },
    { label: "Total visits", value: totalViews._sum.views ?? 0, note: "all exhibitions, all time" },
    { label: "Images in the database", value: formatBytes(storageBytes), note: "legacy uploads (R2 is separate)" },
  ];

  return (
    <AdminShell
      user={user}
      title="Platform overview"
      eyebrow="ADMIN · FOR THE OWNER ONLY"
      description="Everything on SANAA in one place: who signed up, what they built, and what visitors looked at."
    >
      <div className={styles.summaryRow}>
        {stats.map((stat) => (
          <div key={stat.label}>
            <strong>{stat.value}</strong>
            <span>{stat.label}</span>
            <span>{stat.note}</span>
          </div>
        ))}
      </div>

      <h2 className="section-heading">Most visited exhibitions</h2>
      {topExhibitions.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No visits yet.</strong>
          <p>Visits appear here once a public exhibition is opened.</p>
        </div>
      ) : (
        <table className={styles.inventoryTable}>
          <thead>
            <tr>
              <th>Exhibition</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Visits</th>
            </tr>
          </thead>
          <tbody>
            {topExhibitions.map((exhibition) => (
              <tr key={exhibition.id}>
                <td>
                  <Link href={`/exhibition/${exhibition.slug}`}>{exhibition.title}</Link>
                </td>
                <td>{exhibition.owner.name}</td>
                <td>{exhibition.status}</td>
                <td>{exhibition.views}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <h2 className="section-heading">Latest signups</h2>
      {recentUsers.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No users yet.</strong>
          <p>New registrations will appear here.</p>
        </div>
      ) : (
        <table className={styles.inventoryTable}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Country</th>
              <th>Signed up</th>
            </tr>
          </thead>
          <tbody>
            {recentUsers.map((account) => (
              <tr key={account.id}>
                <td>{account.name}</td>
                <td>{account.email}</td>
                <td>{account.role ?? "—"}</td>
                <td>{account.country ?? "—"}</td>
                <td>{account.createdAt.toLocaleDateString("en-GB")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className={styles.resultNote}>
        <Link href="/admin/users">See all users</Link> · <Link href="/admin/exhibitions">See all exhibitions</Link> ·{" "}
        <Link href="/admin/artworks">See all artworks</Link>
      </p>

      <h2 className="section-heading">Latest exhibitions</h2>
      <table className={styles.inventoryTable}>
        <thead>
          <tr>
            <th>Exhibition</th>
            <th>Owner</th>
            <th>Status</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {recentExhibitions.map((exhibition) => (
            <tr key={exhibition.id}>
              <td>{exhibition.title}</td>
              <td>{exhibition.owner.name}</td>
              <td>{exhibition.status}</td>
              <td>{exhibition.createdAt.toLocaleDateString("en-GB")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </AdminShell>
  );
}
