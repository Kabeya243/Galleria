import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTeamMembership, logTeamActivity } from "@/lib/teams";

// Single team: full detail for members (members, shares, comments,
// activity, version history of the shared exhibitions), rename and
// delete for the owner only. Non-members get 404 — a team id alone
// reveals nothing.

type RouteContext = { params: Promise<{ id: string }> };

const renameSchema = z.object({ name: z.string().min(1).max(120) });

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view this team." }, { status: 401 });
  const { id } = await params;

  const membership = await getTeamMembership(user.id, id);
  if (!membership) return NextResponse.json({ error: "Team not found." }, { status: 404 });

  const team = await db.team.findUniqueOrThrow({
    where: { id },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } },
      shares: { include: { team: { select: { id: true } } }, orderBy: { createdAt: "desc" } },
      comments: { include: { author: { select: { id: true, name: true } } }, orderBy: { createdAt: "asc" }, take: 300 },
      activity: { include: { actor: { select: { id: true, name: true } } }, orderBy: { createdAt: "desc" }, take: 100 },
    },
  });

  // Exhibition details for the shares (title, slug, owner).
  const exhibitionIds = team.shares.map((s) => s.exhibitionId);
  const exhibitions = exhibitionIds.length
    ? await db.exhibition.findMany({
        where: { id: { in: exhibitionIds } },
        select: { id: true, title: true, slug: true, status: true, ownerId: true, owner: { select: { name: true } } },
      })
    : [];
  const exhibitionById = new Map(exhibitions.map((e) => [e.id, e]));

  // Version history: the editor records one SavedWork snapshot
  // (kind "exhibition-version") per save, owned by the exhibition
  // owner. Surface them here for shared exhibitions only — title and
  // time, so the team can see what changed and when, and open the
  // editor to restore.
  const versions: { id: string; exhibitionId: string; title: string; createdAt: string }[] = [];
  if (exhibitionIds.length) {
    const owners = [...new Set(exhibitions.map((e) => e.ownerId))];
    const rows = await db.savedWork.findMany({
      where: { kind: "exhibition-version", userId: { in: owners } },
      select: { id: true, title: true, data: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    for (const row of rows) {
      try {
        const data = JSON.parse(row.data) as { exhibitionId?: string };
        if (data.exhibitionId && exhibitionIds.includes(data.exhibitionId)) {
          versions.push({ id: row.id, exhibitionId: data.exhibitionId, title: row.title, createdAt: row.createdAt.toISOString() });
        }
      } catch {
        // A malformed snapshot row is skipped, never fatal.
      }
    }
  }

  return NextResponse.json({
    team: {
      id: team.id,
      name: team.name,
      ownerId: team.ownerId,
      myRole: membership.role,
      createdAt: team.createdAt,
      updatedAt: team.updatedAt,
      members: team.members.map((m) => ({ userId: m.userId, name: m.user.name, email: m.user.email, role: m.role })),
      shares: team.shares.map((s) => {
        const ex = exhibitionById.get(s.exhibitionId);
        return {
          id: s.id,
          exhibitionId: s.exhibitionId,
          permission: s.permission,
          createdAt: s.createdAt,
          exhibitionTitle: ex?.title ?? "Deleted exhibition",
          exhibitionSlug: ex?.slug ?? "",
          exhibitionStatus: ex?.status ?? "",
          exhibitionOwnerName: ex?.owner.name ?? "",
        };
      }),
      comments: team.comments.map((c) => ({
        id: c.id,
        exhibitionId: c.exhibitionId,
        authorId: c.authorId,
        authorName: c.author.name,
        body: c.body,
        status: c.status,
        createdAt: c.createdAt,
      })),
      activity: team.activity.map((a) => ({
        id: a.id,
        actorId: a.actorId,
        actorName: a.actor.name,
        action: a.action,
        target: a.target,
        createdAt: a.createdAt,
      })),
      versions: versions.slice(0, 30),
    },
  });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to rename this team." }, { status: 401 });
  const { id } = await params;

  const membership = await getTeamMembership(user.id, id);
  if (!membership) return NextResponse.json({ error: "Team not found." }, { status: 404 });
  if (membership.role !== "owner") return NextResponse.json({ error: "Only the team owner can rename the team." }, { status: 403 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = renameSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Give the team a name." }, { status: 400 });

  const team = await db.team.update({ where: { id }, data: { name: parsed.data.name.trim() } });
  await logTeamActivity(id, user.id, "renamed the team", team.name);
  return NextResponse.json({ team: { id: team.id, name: team.name } });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete this team." }, { status: 401 });
  const { id } = await params;

  const membership = await getTeamMembership(user.id, id);
  if (!membership) return NextResponse.json({ error: "Team not found." }, { status: 404 });
  if (membership.role !== "owner") return NextResponse.json({ error: "Only the team owner can delete the team." }, { status: 403 });

  await db.team.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
