import { redirect } from "next/navigation";
import AdminDenied from "@/components/admin-denied";
import { AdminHero } from "@/components/admin-shell";
import ArtDriveManager from "@/components/artdrive-manager";
import { getAdminContext } from "@/lib/admin-data";

export const metadata = {
  title: "ArtDrive: Lakisa",
  description: "Share files by link, like Drive. Upload a file and send its link to anyone.",
};

// ArtDrive — manager only for now. The manager uploads a file and gets
// a public link to send to anyone; the recipient opens the link and
// downloads the file, no account needed.
export default async function AdminArtDriveRoute() {
  const { user, access } = await getAdminContext();
  if (!access.isManager && !access.isSubAdmin) {
    return <AdminDenied user={user} />;
  }
  if (!access.isManager) redirect("/admin");
  return (
    <>
      <AdminHero
        eyebrow="ADMIN · FOR THE OWNER ONLY"
        title="ArtDrive"
        description="Share files by link, like Drive. Upload a file and send its link to anyone: they open it or download it, no account needed. Only you can upload, see and delete files here."
      />
      <div className="ad-section">
        <ArtDriveManager />
      </div>
    </>
  );
}
