import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/admin";
import { loadAdminShellCounts } from "@/lib/admin-data";
import { getCurrentUser } from "@/lib/auth";

// Nav badge counts for the admin shell (users, exhibitions, artworks,
// tool uses). The shell is mounted once in the admin layout and stays
// mounted across client-side navigations, so it refreshes its badges
// from here on every route change instead of remounting.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const access = await getAdminAccess(user);
  if (!access.isManager && !access.isSubAdmin) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const counts = await loadAdminShellCounts();
  return NextResponse.json(counts);
}
