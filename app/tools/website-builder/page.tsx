import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";

// The simple website builder was removed on 8 Nov 2026 (Kabeya's
// decision: keep only the advanced builder). This route now redirects
// to the advanced editor so old links and bookmarks keep working.
// Published sites from the old builder are NOT affected: they are still
// served read-only at /sites/[id] (see app/sites/[id]/page.tsx).
export default async function WebsiteBuilderRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  redirect("/tools/website-builder/advanced");
}
