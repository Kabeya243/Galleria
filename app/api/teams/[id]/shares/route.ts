import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTeamMembership, logTeamActivity, roleAtLeast } from "@/lib/teams";

// Share an exhibition with a team. Only a member with role owner or
// editor can share, and only an exhibition they own — sharing someone
// else's work is not possible from here. Permission "view" is read-only;
// "edit" lets team owners/editors open and save the exhibition in the
// editor (enforced again in /api/exhibitions/[id]).

type RouteContext = { params: Promise<{ id: string }> };

const shareSchema = z.object({
  exhibitionId: z.string().min(1).max(100),
  permission: z.enum(["view", "edit"]),
});

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to share exhibitions." }, { status: 401 });
  const { id } = await params;

  const membership = await getTeamMembership(user.id, id);
  if (!membership) return NextResponse.json({ error: "Team not found." }, { status: 404 });
  if (!roleAtLeast(membership.role, "editor")) {
    return NextResponse.json({ error: "Viewers cannot share exhibitions with the team." }, { status: 403 });
  }

  const body: unknown = await request.json().catch(() => null);
  const parsed = shareSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Choose an exhibition and a permission." }, { status: 400 });

  const exhibition = await db.exhibition.findFirst({
    where: { id: parsed.data.exhibitionId, ownerId: user.id },
    select: { id: true, title: true },
  });
  if (!exhibition) return NextResponse.json({ error: "That exhibition is not yours to share." }, { status: 403 });

  const existing = await db.projectShare.findUnique({
    where: { teamId_exhibitionId: { teamId: id, exhibitionId: exhibition.id } },
  });
  if (existing) {
    const updated = await db.projectShare.update({
      where: { id: existing.id },
      data: { permission: parsed.data.permission },
    });
    await logTeamActivity(id, user.id, `changed the share permission on “${exhibition.title}” to ${parsed.data.permission}`, exhibition.title);
    return NextResponse.json({ share: { id: updated.id, exhibitionId: updated.exhibitionId, permission: updated.permission } });
  }

  const share = await db.projectShare.create({
    data: { teamId: id, exhibitionId: exhibition.id, permission: parsed.data.permission },
  });
  await logTeamActivity(id, user.id, `shared “${exhibition.title}” with the team (${parsed.data.permission})`, exhibition.title);
  return NextResponse.json(
    { share: { id: share.id, exhibitionId: share.exhibitionId, permission: share.permission } },
    { status: 201 },
  );
}

export async function DELETE(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to remove shares." }, { status: 401 });
  const { id } = await params;

  const membership = await getTeamMembership(user.id, id);
  if (!membership) return NextResponse.json({ error: "Team not found." }, { status: 404 });
  if (!roleAtLeast(membership.role, "editor")) {
    return NextResponse.json({ error: "Viewers cannot remove shares." }, { status: 403 });
  }

  const exhibitionId = new URL(request.url).searchParams.get("exhibitionId") ?? "";
  if (!exhibitionId) return NextResponse.json({ error: "Missing exhibition." }, { status: 400 });

  const share = await db.projectShare.findUnique({
    where: { teamId_exhibitionId: { teamId: id, exhibitionId } },
    include: { team: { select: { id: true } } },
  });
  if (!share) return NextResponse.json({ error: "Share not found." }, { status: 404 });

  // Only the exhibition owner or the team owner may unshare it.
  const exhibition = await db.exhibition.findUnique({ where: { id: exhibitionId }, select: { ownerId: true, title: true } });
  const team = await db.team.findUnique({ where: { id }, select: { ownerId: true } });
  if (exhibition?.ownerId !== user.id && team?.ownerId !== user.id) {
    return NextResponse.json({ error: "Only the exhibition owner or the team owner can remove this share." }, { status: 403 });
  }

  await db.projectShare.delete({ where: { id: share.id } });
  await logTeamActivity(id, user.id, `removed the share on “${exhibition?.title ?? exhibitionId}”`, exhibition?.title ?? "");
  return NextResponse.json({ ok: true });
}
