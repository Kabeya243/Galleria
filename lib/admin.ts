import { redirect } from "next/navigation";
import { getCurrentUser, isAdminEmail } from "@/lib/auth";

// The admin area (CRM) is for the platform owner only — Kabeya. Access is
// decided by email (ADMIN_EMAILS, see lib/auth.ts). No one else can open
// /admin, and the Admin link in the sidebar only appears for an admin.
export { isAdminEmail } from "@/lib/auth";

export function isAdminUser(user: { email: string } | null | undefined): boolean {
  return Boolean(user) && isAdminEmail(user!.email);
}

export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    // Not signed in as the owner: send them to the dashboard, not to a
    // page that reveals an admin area exists.
    redirect("/");
  }
  return user;
}
