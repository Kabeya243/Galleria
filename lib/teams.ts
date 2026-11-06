// Shared server-side helpers for Teams & Collaboration (Phase 6).
// Every team mutation goes through these checks — membership and role
// are enforced here, never only by hiding buttons in the UI.

import { db } from "@/lib/db";

export type TeamRole = "owner" | "editor" | "viewer";

const ROLE_RANK: Record<TeamRole, number> = { viewer: 1, editor: 2, owner: 3 };

export function roleAtLeast(role: string, minimum: TeamRole): boolean {
  const rank = ROLE_RANK[role as TeamRole] ?? 0;
  return rank >= ROLE_RANK[minimum];
}

// The membership row for a user in a team, or null. Team owners are
// stored as a member row with role "owner" when the team is created,
// so one lookup covers both cases.
export async function getTeamMembership(userId: string, teamId: string) {
  return db.teamMember.findUnique({
    where: { teamId_userId: { teamId, userId } },
    include: { team: { select: { id: true, name: true, ownerId: true } } },
  });
}

export async function logTeamActivity(
  teamId: string,
  actorId: string,
  action: string,
  target = "",
) {
  try {
    await db.teamActivity.create({ data: { teamId, actorId, action, target } });
  } catch {
    // The activity log is a record, never a reason to fail the action.
  }
}

// Can this user edit this exhibition? Either they own it, or a team
// they belong to (as owner or editor) has an edit share on it. Used by
// the team APIs and by the editor save path in /api/exhibitions/[id].
export async function canEditExhibition(userId: string, exhibitionId: string): Promise<boolean> {
  const exhibition = await db.exhibition.findUnique({
    where: { id: exhibitionId },
    select: { ownerId: true },
  });
  if (!exhibition) return false;
  if (exhibition.ownerId === userId) return true;
  const share = await db.projectShare.findFirst({
    where: {
      exhibitionId,
      permission: "edit",
      team: { members: { some: { userId, role: { in: ["owner", "editor"] } } } },
    },
    select: { id: true },
  });
  return share !== null;
}

// Can this user at least view this exhibition through a team share?
export async function canViewExhibition(userId: string, exhibitionId: string): Promise<boolean> {
  const exhibition = await db.exhibition.findUnique({
    where: { id: exhibitionId },
    select: { ownerId: true },
  });
  if (!exhibition) return false;
  if (exhibition.ownerId === userId) return true;
  const share = await db.projectShare.findFirst({
    where: {
      exhibitionId,
      team: { members: { some: { userId } } },
    },
    select: { id: true },
  });
  return share !== null;
}
