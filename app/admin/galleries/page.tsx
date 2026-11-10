import { redirect } from "next/navigation";
import AdminDenied from "@/components/admin-denied";
import AdminGalleries from "@/components/admin-galleries";
import AdminGalleryNames from "@/components/admin-gallery-names";
import AdminShell from "@/components/admin-shell";
import {
  adminSections,
  getAdminContext,
  hasAdminPermission,
  loadAdminGalleries,
  loadAdminShellCounts,
} from "@/lib/admin-data";

export const metadata = {
  title: "Galleries: Lakisa",
  description: "The room templates visitors can pick, and their names in English and in French.",
};

export default async function AdminGalleriesRoute() {
  const { user, access } = await getAdminContext();
  if (!access.isManager && !access.isSubAdmin) {
    return <AdminDenied user={user} />;
  }
  if (!hasAdminPermission(access, "galleries.view")) redirect("/admin");
  const canManageGalleries = hasAdminPermission(access, "galleries.manage");
  const [{ galleryTemplates, hiddenRoomLayouts, galleryNames }, counts] = await Promise.all([
    loadAdminGalleries(),
    loadAdminShellCounts(),
  ]);
  return (
    <AdminShell
      user={user}
      title="Galleries"
      eyebrow={access.isManager ? "ADMIN · FOR THE OWNER ONLY" : "ADMIN · SUB-ADMIN"}
      description={`${galleryTemplates.length} room templates, the models visitors can pick. Deleting one hides it from the catalogue, the creation dialog and the editor; exhibitions already built with it keep working.`}
      counts={counts}
      sections={adminSections(access)}
      active="galleries"
    >
      <div className="ad-section">
        <AdminGalleries templates={galleryTemplates} hidden={hiddenRoomLayouts} canManage={canManageGalleries} />
        <div className="ad-section-head" style={{ marginTop: 28 }}>
          <h3>Gallery names</h3>
          <p>
            Rename any gallery in English and in French. The new name shows on the catalogue, in the
            creation dialog and in the editor, in the matching language.
          </p>
        </div>
        <AdminGalleryNames names={galleryNames} canManage={canManageGalleries} />
      </div>
    </AdminShell>
  );
}
