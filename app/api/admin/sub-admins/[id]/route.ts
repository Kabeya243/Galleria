import { NextResponse } from "next/server";
import { requireManager } from "@/lib/admin";
import { db } from "@/lib/db";

// Revoke a sub-admin grant (DELETE /api/admin/sub-admins/[id]).
// Manager only, enforced server-side. The account itself is untouched
// — only its admin access is removed, and it takes effect immediately
// because getAdminAccess reads the grant from the database on every call.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const manager = await requireManager();
  if (!manager) {
    return NextResponse.json({ error: "Manager only." }, { status: 403 });
  }
  const { id } = await params;
  const grant = await db.subAdmin.findUnique({ where: { id }, select: { id: true } });
  if (!grant) {
    return NextResponse.json({ error: "Sub-admin not found." }, { status: 404 });
  }
  await db.subAdmin.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
