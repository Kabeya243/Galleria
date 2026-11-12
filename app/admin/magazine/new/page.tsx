import { redirect } from "next/navigation";
import AdminDenied from "@/components/admin-denied";
import { AdminHero } from "@/components/admin-shell";
import MagazineEditor from "@/components/magazine-editor";
import { getAdminContext, hasAdminPermission } from "@/lib/admin-data";

export const metadata = {
  title: "New article: Lakisa",
  description: "Write a magazine article for Lakisa.",
};

export default async function AdminMagazineNewRoute() {
  const { user, access } = await getAdminContext();
  if (!access.isManager && !access.isSubAdmin) {
    return <AdminDenied user={user} />;
  }
  if (!hasAdminPermission(access, "magazine.manage")) redirect("/admin");
  return (
    <>
      <AdminHero
        eyebrow={access.isManager ? "ADMIN · FOR THE OWNER ONLY" : "ADMIN · SUB-ADMIN"}
        title="New article"
        description="Write the article in Markdown, add a cover image, then publish it to /magazine."
      />
      <MagazineEditor article={null} />
    </>
  );
}
