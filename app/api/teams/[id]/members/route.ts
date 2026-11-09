import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTeamMembership, logTeamActivity } from "@/lib/teams";

// Team members. Invites are by email and only ever add an EXISTING
// SANAA account — if no account has that email the API says so plainly
// and nothing is invented or emailed. Only the owner invites or
// removes; a member may remove themselves (leave the team).

type RouteContext = { params: Promise<{ id: string }> };

const inviteSchema = z.object({
  email: z.string().min(3).max(200).email(),
  role: z.enum(["editor", "viewer"]),
});

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to invite members." }, { status: 401 });
  const { id } = await params;

  const membership = await getTeamMembership(user.id, id);
  if (!membership) return NextResponse.json({ error: "Team not found." }, { status: 404 });
  if (membership.role !== "owner") return NextResponse.json({ error: "Only the team owner can invite members." }, { status: 403 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = inviteSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Enter a valid email and a role (editor or viewer)." }, { status: 400 });

  const invited = await db.user.findUnique({
    where: { email: parsed.data.email.trim().toLowerCase() },
    select: { id: true, name: true, email: true },
  });
  if (!invited) {
    return NextResponse.json(
      { error: `No Lakisa account with the email ${parsed.data.email.trim()}. They need to create an account first — no invitation email is sent.` },
      { status: 404 },
    );
  }
  if (invited.id === user.id) return NextResponse.json({ error: "You are already on this team." }, { status: 409 });

  const existing = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId: id, userId: invited.id } },
  });
  if (existing) return NextResponse.json({ error: `${invited.name} is already a member of this team.` }, { status: 409 });

  const row = await db.teamMember.create({
    data: { teamId: id, userId: invited.id, role: parsed.data.role },
  });
  await logTeamActivity(id, user.id, `invited ${invited.name} as ${parsed.data.role}`, invited.email);
  return NextResponse.json(
    { member: { userId: invited.id, name: invited.name, email: invited.email, role: row.role } },
    { status: 201 },
  );
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to remove members." }, { status: 401 });
  const { id } = await params;

  const membership = await getTeamMembership(user.id, id);
  if (!membership) return NextResponse.json({ error: "Team not found." }, { status: 404 });

  const targetUserId = new URL(request.url).searchParams.get("userId") ?? "";
  if (!targetUserId) return NextResponse.json({ error: "Missing member." }, { status: 400 });

  const target = await db.teamMember.findUnique({
    where: { teamId_userId: { teamId: id, userId: targetUserId } },
    include: { user: { select: { name: true } } },
  });
  if (!target) return NextResponse.json({ error: "Member not found." }, { status: 404 });
  if (target.role === "owner") return NextResponse.json({ error: "The team owner cannot be removed." }, { status: 403 });
  // Owner removes anyone; anyone else may only remove themselves.
  if (membership.role !== "owner" && targetUserId !== user.id) {
    return NextResponse.json({ error: "Only the team owner can remove other members." }, { status: 403 });
  }

  await db.teamMember.delete({ where: { id: target.id } });
  await logTeamActivity(id, user.id, targetUserId === user.id ? `left the team` : `removed ${target.user.name} from the team`, target.user.name);
  return NextResponse.json({ ok: true });
}
