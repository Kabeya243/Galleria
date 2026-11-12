import { redirect } from "next/navigation";
import Link from "next/link";
import { Eye } from "lucide-react";
import AdminDenied from "@/components/admin-denied";
import { AdminHero } from "@/components/admin-shell";
import { EmptyBox } from "@/components/admin-ui";
import editorStyles from "@/components/magazine-editor.module.css";
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
                    <td>
                      <Link href={`/admin/magazine/${article.id}`}>
                        <strong>{article.title}</strong>
                      </Link>
                      {article.excerpt && (
                        <div
                          style={{
                            color: "var(--ad-muted)",
                            fontSize: 12,
                            marginTop: 2,
                            maxWidth: 420,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {article.excerpt}
                        </div>
                      )}
                    </td>
                    <td>
                      <span
                        className={`${editorStyles.statusPill} ${
                          article.status === "published"
                            ? editorStyles.statusPublished
                            : editorStyles.statusDraft
                        }`}
                      >
                        {article.status}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                        }}
                      >
                        <Eye size={13} /> {article.views}
                      </span>
                    </td>
                    <td>
                      {article.publishedAt
                        ? new Date(article.publishedAt).toLocaleDateString("en-GB")
                        : "—"}
                    </td>
                    <td>{article.authorName}</td>
                    <td>
                      <Link href={`/admin/magazine/${article.id}`}>Edit</Link>
                      {article.status === "published" && (
                        <>
                          {" · "}
                          <a
                            href={`/magazine/${article.slug}`}
                            target="_blank"
                            rel="noreferrer"
                          >
                            View
                          </a>
                        </>
                      )}
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
