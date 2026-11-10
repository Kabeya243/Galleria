import { redirect } from "next/navigation";
import { getCurrentUser, isAdminEmail } from "@/lib/auth";
import { db } from "@/lib/db";

// The admin area (CRM) is for the platform owner (the manager, Kabeya)
// and the sub-admins he appoints. Access is decided server-side, on
// every page render and every admin API route — the interface only
// hides sections, it never grants access on its own.
//
// The manager is the account whose email is in ADMIN_EMAILS (see
// lib/auth.ts): full access, and the only one who can add, change or
// remove sub-admins. A sub-admin holds a SubAdmin grant (Prisma) with
// a list of permission keys below; each key opens one section of the
// admin dashboard, nothing more.

export { isAdminEmail } from "@/lib/auth";

// Permission keys, one per admin section. `subadmins.manage` is
// manager-only and is never grantable — it is not in GRANTABLE.
export const ADMIN_PERMISSIONS = {
  "stats.view": "Statistics",
  "users.view": "Users",
  "exhibitions.view": "Exhibitions",
  "artworks.view": "Artworks",
  "galleries.view": "Galleries",
  "galleries.manage": "Manage galleries",
  "subadmins.manage": "Manage sub-admins",
} as const;

export type AdminPermission = keyof typeof ADMIN_PERMISSIONS;

// What a sub-admin can be given (everything except subadmins.manage).
export const GRANTABLE_PERMISSIONS = (
  Object.keys(ADMIN_PERMISSIONS) as AdminPermission[]
).filter((key) => key !== "subadmins.manage");

// Every permission, for the manager.
export const ALL_ADMIN_PERMISSIONS = Object.keys(
  ADMIN_PERMISSIONS,
) as AdminPermission[];

export type AdminAccess = {
  isManager: boolean;
  isSubAdmin: boolean;
  permissions: AdminPermission[];
};

const NO_ACCESS: AdminAccess = { isManager: false, isSubAdmin: false, permissions: [] };

function parsePermissions(value: unknown): AdminPermission[] {
  if (!Array.isArray(value)) return [];
  const allowed = new Set<string>(GRANTABLE_PERMISSIONS);
  return value.filter(
    (item): item is AdminPermission => typeof item === "string" && allowed.has(item),
  );
}

// Server-side admin access for a signed-in user: manager (full access),
// sub-admin (the permissions on their grant), or no access. The grant
// is read from the database on every call, so revoking takes effect
// immediately — no cached role survives a revoke.
export async function getAdminAccess(
  user: { id: string; email: string } | null | undefined,
): Promise<AdminAccess> {
  if (!user) return NO_ACCESS;
  if (isAdminEmail(user.email)) {
    return { isManager: true, isSubAdmin: false, permissions: ALL_ADMIN_PERMISSIONS };
  }
  const grant = await db.subAdmin.findUnique({
    where: { userId: user.id },
    select: { permissions: true },
  });
  if (!grant) return NO_ACCESS;
  const permissions = parsePermissions(grant.permissions);
  if (permissions.length === 0) return NO_ACCESS;
  return { isManager: false, isSubAdmin: true, permissions };
}

export function hasAdminPermission(access: AdminAccess, permission: AdminPermission): boolean {
  return access.permissions.includes(permission);
}

export function isAdminUser(user: { email: string } | null | undefined): boolean {
  return Boolean(user) && isAdminEmail(user!.email);
}

// The admin page gate: manager or sub-admin (with at least one
// permission). Anyone else is sent to the dashboard, not to a page
// that reveals an admin area exists.
export async function requireAdminAccess(): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>;
  access: AdminAccess;
}> {
  const user = await getCurrentUser();
  if (!user) redirect("/");
  const access = await getAdminAccess(user);
  if (!access.isManager && !access.isSubAdmin) redirect("/");
  return { user, access };
}

// Kept for callers that only the manager may reach (the old gate).
export async function requireAdmin() {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) {
    // Not signed in as the owner: send them to the dashboard, not to a
    // page that reveals an admin area exists.
    redirect("/");
  }
  return user;
}

// For admin API routes: returns the access when the signed-in user
// holds `permission` (the manager holds them all), null otherwise.
// The route answers 403 on null — the check happens server-side, the
// client only decides what to show.
export async function requireAdminPermission(
  permission: AdminPermission,
): Promise<AdminAccess | null> {
  const user = await getCurrentUser();
  if (!user) return null;
  const access = await getAdminAccess(user);
  if (!hasAdminPermission(access, permission)) return null;
  return access;
}

// Manager only, for the sub-admins API routes.
export async function requireManager(): Promise<{ id: string; email: string } | null> {
  const user = await getCurrentUser();
  if (!user || !isAdminEmail(user.email)) return null;
  return user;
}
