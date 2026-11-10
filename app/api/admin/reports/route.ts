import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getAdminAccess } from "@/lib/admin";
import { listMessageReports } from "@/app/api/messages/safety";

// Message reports for the admins (Nov 2026): every MessageReport,
// newest first, with the reporter, the reported message (when one was
// reported) and the conversation's two participants. Manager or any
// sub-admin may read them; everyone else gets a 403. This is the admin
// visibility for reports: the admin dashboard page itself is not
// touched by this lot, so the API is the read surface.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view reports." }, { status: 401 });
  const access = await getAdminAccess(user);
  if (!access.isManager && !access.isSubAdmin) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }

  const reports = await listMessageReports(100);
  return NextResponse.json({ reports });
}
