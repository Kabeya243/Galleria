import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";

// The signed-in user's admin access (GET /api/admin/access):
// whether they are the manager or a sub-admin, and which permission
// keys they hold. Read from the database on every call, so a revoke
// takes effect immediately. Signed-out visitors get no access.
export async function GET() {
  const user = await getCurrentUser();
  const access = await getAdminAccess(user);
  return NextResponse.json(access);
}
