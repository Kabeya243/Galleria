import { redirect } from "next/navigation";
import Link from "next/link";
import AdminDenied from "@/components/admin-denied";
import { AdminHero } from "@/components/admin-shell";
import { EmptyBox } from "@/components/admin-ui";
import { getAdminContext, hasAdminPermission } from "@/lib/admin-data";
import { getAllMagazineArticles } from "@/lib/magazine";

export const metadata = {
  title: "Magazine: Lakisa",
  description: "Magazine articles: drafts and published stories, with views.",
};

export default async function AdminMagazineRoute() {
  const { user, access } = await getAdminContext();
  if (!access.isManager && !access.isSubAdmin) {
    return <AdminDenied user={user} />;
  }
  if (!hasAdminPermission(access, "magazine.manage")) redirect("/admin");
  const articles = await getAllMagazineArticles();
  return (
    <>
      <AdminHero
        eyebrow={access.isManager ? "ADMIN · FOR THE OWNER ONLY" : "ADMIN · SUB-ADMIN"}
        title="Magazine"
        description={`${articles.length} article${articles.length === 1 ? "" : "s"}, drafts and published stories, with views.`}
      />
      <div className="ad-section">
        <div style={{ marginBottom: 14 }}>
          <Link href="/admin/magazine/new" className="galleries-open-button">
            New article
          </Link>
        </div>
        {articles.length === 0 ? (
          <EmptyBox
            title="No articles yet."
            body="Write the first article: it appears on /magazine as soon as it is published."
          />
        ) : (
          <div className="ad-card ad-table-wrap">
            <table className="ad-table">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Status</th>
                  <th>Views</th>
                  <th>Published</th>
                  <th>Author</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {articles.map((article) => (
                  <tr key={article.id}>
                    <td>{article.title}</td>
                    <td>{article.status}</td>
                    <td>{article.views}</td>
                    <td>
                      {article.publishedAt
                        ? new Date(article.publishedAt).toLocaleDateString("en-GB")
                        : "—"}
                    </td>
                    <td>{article.authorName}</td>
                    <td>
                      <Link href={`/admin/magazine/${article.id}`}>Edit</Link>
                    </td>
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
