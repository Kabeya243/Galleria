import { redirect } from "next/navigation";
import AdminDenied from "@/components/admin-denied";
import { AdminHero } from "@/components/admin-shell";
import SubAdmins from "@/components/sub-admins";
import { getAdminContext } from "@/lib/admin-data";

export const metadata = {
  title: "Sub-admins: Lakisa",
  description: "Give a signed-up account limited access to this dashboard.",
};

// Sub-admins — manager only. The manager adds accounts with limited
// access to this dashboard and picks their sections.
export default async function AdminSubAdminsRoute() {
  const { user, access } = await getAdminContext();
  if (!access.isManager && !access.isSubAdmin) {
    return <AdminDenied user={user} />;
  }
  if (!access.isManager) redirect("/admin");
  return (
    <>
      <AdminHero
        eyebrow="ADMIN · FOR THE OWNER ONLY"
        title="Sub-admins"
        description="Give a signed-up account limited access to this dashboard. A sub-admin signs in with their own account and only sees the sections you pick. Only you, the manager, can add or remove sub-admins, and you keep full access."
      />
      <div className="ad-section">
        <SubAdmins />
      </div>
    </>
  );
}
