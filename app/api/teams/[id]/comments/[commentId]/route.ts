import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTeamMembership, roleAtLeast } from "@/lib/teams";

// Resolve / reopen a team comment. The author may resolve their own
// comment; owners and editors may resolve any comment on the team.

type RouteContext = { params: Promise<{ id: string; commentId: string }> };

const updateSchema = z.object({ status: z.enum(["open", "resolved"]) });

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to update comments." }, { status: 401 });
  const { id, commentId } = await params;

  const membership = await getTeamMembership(user.id, id);
  if (!membership) return NextResponse.json({ error: "Team not found." }, { status: 404 });

  const comment = await db.teamComment.findFirst({ where: { id: commentId, teamId: id } });
  if (!comment) return NextResponse.json({ error: "Comment not found." }, { status: 404 });
  if (comment.authorId !== user.id && !roleAtLeast(membership.role, "editor")) {
    return NextResponse.json({ error: "Only the author, an editor or the owner can resolve this comment." }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid status." }, { status: 400 });

  const row = await db.teamComment.update({ where: { id: comment.id }, data: { status: parsed.data.status } });
  return NextResponse.json({ comment: { id: row.id, status: row.status } });
}
