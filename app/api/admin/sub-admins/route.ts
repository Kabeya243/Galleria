import { NextResponse } from "next/server";
import { z } from "zod";
import {
  ADMIN_PERMISSIONS,
  GRANTABLE_PERMISSIONS,
  requireManager,
  type AdminPermission,
} from "@/lib/admin";
import { isAdminEmail } from "@/lib/auth";
import { db } from "@/lib/db";

// Sub-admins (Nov 2026): the manager (platform owner) gives another
// signed-up account limited access to the admin dashboard. Manager
// only, enforced server-side on every route — the interface only
// decides what to show, it never grants access.
//
// GET  /api/admin/sub-admins        -> the grants, newest first.
// POST /api/admin/sub-admins { email, permissions[] } -> create or
//      replace the grant for that account (one grant per user).

const bodySchema = z.object({
  email: z.string().trim().toLowerCase().min(3).max(200),
  permissions: z
    .array(z.string())
    .min(1, "Pick at least one permission.")
    .max(GRANTABLE_PERMISSIONS.length),
});

export async function GET() {
  const manager = await requireManager();
  if (!manager) {
    return NextResponse.json({ error: "Manager only." }, { status: 403 });
  }
  const grants = await db.subAdmin.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      user: { select: { id: true, name: true, email: true, role: true } },
      grantedBy: { select: { name: true, email: true } },
    },
  });
  return NextResponse.json({
    subAdmins: grants.map((grant) => ({
      id: grant.id,
      user: grant.user,
      grantedBy: grant.grantedBy,
      permissions: (Array.isArray(grant.permissions) ? grant.permissions : []) as AdminPermission[],
      createdAt: grant.createdAt.toISOString(),
    })),
    permissions: GRANTABLE_PERMISSIONS.map((key) => ({
      key,
      label: ADMIN_PERMISSIONS[key],
    })),
  });
}

export async function POST(request: Request) {
  const manager = await requireManager();
  if (!manager) {
    return NextResponse.json({ error: "Manager only." }, { status: 403 });
  }
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Empty body — the schema below reports what is missing.
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "An email and at least one permission are required." },
      { status: 400 },
    );
  }
  const { email, permissions } = parsed.data;
  const allowed = new Set<string>(GRANTABLE_PERMISSIONS);
  const clean = [...new Set(permissions)].filter((key) => allowed.has(key));
  if (clean.length === 0) {
    return NextResponse.json(
      { error: "Pick at least one permission." },
      { status: 400 },
    );
  }
  // The manager already has full access — granting them is a mistake.
  if (isAdminEmail(email)) {
    return NextResponse.json(
      { error: "That account already has full access as the manager." },
      { status: 400 },
    );
  }
  const target = await db.user.findUnique({
    where: { email },
    select: { id: true, name: true, email: true },
  });
  if (!target) {
    return NextResponse.json(
      { error: "No account with that email. Ask them to sign up first." },
      { status: 404 },
    );
  }
  const grant = await db.subAdmin.upsert({
    where: { userId: target.id },
    create: { userId: target.id, grantedById: manager.id, permissions: clean },
    update: { grantedById: manager.id, permissions: clean },
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
  });
  return NextResponse.json({
    subAdmin: {
      id: grant.id,
      user: grant.user,
      permissions: clean as AdminPermission[],
      createdAt: grant.createdAt.toISOString(),
    },
  });
}
