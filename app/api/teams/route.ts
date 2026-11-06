import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTeamMembership, logTeamActivity } from "@/lib/teams";

// Teams (Phase 6). GET lists the teams the signed-in user owns or is a
// member of. POST creates a team; the creator is recorded as a member
// with role "owner".

const createSchema = z.object({
  name: z.string().min(1).max(120),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your teams." }, { status: 401 });

  const teams = await db.team.findMany({
    where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
    include: {
      members: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } },
      _count: { select: { shares: true, comments: true } },
    },
    orderBy: { updatedAt: "desc" },
  });

  return NextResponse.json({
    teams: teams.map((team) => {
      const membership = team.members.find((m) => m.userId === user.id);
      return {
        id: team.id,
        name: team.name,
        ownerId: team.ownerId,
        myRole: membership?.role ?? "viewer",
        createdAt: team.createdAt,
        updatedAt: team.updatedAt,
        shareCount: team._count.shares,
        commentCount: team._count.comments,
        members: team.members.map((m) => ({ userId: m.userId, name: m.user.name, email: m.user.email, role: m.role })),
      };
    }),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to create a team." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Give the team a name." }, { status: 400 });

  const team = await db.team.create({
    data: {
      name: parsed.data.name.trim(),
      ownerId: user.id,
      members: { create: { userId: user.id, role: "owner" } },
    },
  });
  await logTeamActivity(team.id, user.id, "created the team", team.name);
  return NextResponse.json(
    { team: { id: team.id, name: team.name, ownerId: team.ownerId, myRole: "owner", createdAt: team.createdAt, updatedAt: team.updatedAt, shareCount: 0, commentCount: 0, members: [{ userId: user.id, name: user.name, email: user.email, role: "owner" }] } },
    { status: 201 },
  );
}
