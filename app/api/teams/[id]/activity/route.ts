import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTeamMembership } from "@/lib/teams";

// Team activity log, newest first. Members only.

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view activity." }, { status: 401 });
  const { id } = await params;

  const membership = await getTeamMembership(user.id, id);
  if (!membership) return NextResponse.json({ error: "Team not found." }, { status: 404 });

  const rows = await db.teamActivity.findMany({
    where: { teamId: id },
    include: { actor: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return NextResponse.json({
    activity: rows.map((a) => ({
      id: a.id,
      actorId: a.actorId,
      actorName: a.actor.name,
      action: a.action,
      target: a.target,
      createdAt: a.createdAt,
    })),
  });
}
