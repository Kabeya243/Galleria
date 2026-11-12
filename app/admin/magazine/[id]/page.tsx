import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import AdminDenied from "@/components/admin-denied";
import { AdminHero } from "@/components/admin-shell";
import MagazineEditor from "@/components/magazine-editor";
import { getAdminContext, hasAdminPermission } from "@/lib/admin-data";
import { getMagazineArticleById, serializeMagazineArticleForAdmin } from "@/lib/magazine";

export const metadata = {
  title: "Edit article: Lakisa",
  description: "Edit a magazine article.",
};

export default async function AdminMagazineEditRoute({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { user, access } = await getAdminContext();
  if (!access.isManager && !access.isSubAdmin) {
    return <AdminDenied user={user} />;
  }
  if (!hasAdminPermission(access, "magazine.manage")) redirect("/admin");
  const { id } = await params;
  const article = await getMagazineArticleById(id);
  if (!article) notFound();
  return (
    <>
      <AdminHero
        eyebrow={access.isManager ? "ADMIN · FOR THE OWNER ONLY" : "ADMIN · SUB-ADMIN"}
        title={`Edit: ${article.title}`}
        description={`${article.views} views · ${article.status}${article.publishedAt ? ` · published ${new Date(article.publishedAt).toLocaleDateString("en-GB")}` : ""}.`}
      />
      <MagazineEditor article={serializeMagazineArticleForAdmin(article)} />
    </>
  );
}
