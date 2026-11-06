import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getTeamMembership, logTeamActivity } from "@/lib/teams";

// Comments on exhibitions shared with a team. Any member can comment.
// The approval workflow is comments with a kind, stored as a visible
// prefix on the body so the thread stays readable in the database too:
//   [REVIEW] — a review request on a shared exhibition
//   [APPROVED] — an approval of the latest review
//   [CHANGES REQUESTED] — a request for changes on the latest review
// Each workflow action also writes a TeamActivity row. No schema
// changes, no hidden flags.

type RouteContext = { params: Promise<{ id: string }> };

const KIND_PREFIX: Record<string, string> = {
  review: "[REVIEW] ",
  approve: "[APPROVED] ",
  changes: "[CHANGES REQUESTED] ",
};

const commentSchema = z.object({
  exhibitionId: z.string().min(1).max(100).optional(),
  body: z.string().min(1).max(4000),
  kind: z.enum(["comment", "review", "approve", "changes"]).optional(),
});

export async function GET(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to read comments." }, { status: 401 });
  const { id } = await params;

  const membership = await getTeamMembership(user.id, id);
  if (!membership) return NextResponse.json({ error: "Team not found." }, { status: 404 });

  const comments = await db.teamComment.findMany({
    where: { teamId: id },
    include: { author: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
    take: 300,
  });
  return NextResponse.json({
    comments: comments.map((c) => ({
      id: c.id,
      exhibitionId: c.exhibitionId,
      authorId: c.authorId,
      authorName: c.author.name,
      body: c.body,
      status: c.status,
      createdAt: c.createdAt,
    })),
  });
}

export async function POST(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to comment." }, { status: 401 });
  const { id } = await params;

  const membership = await getTeamMembership(user.id, id);
  if (!membership) return NextResponse.json({ error: "Team not found." }, { status: 404 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = commentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Write a comment first." }, { status: 400 });
  const data = parsed.data;
  const kind = data.kind ?? "comment";

  // A comment targets a shared exhibition, or the team as a whole
  // (no exhibitionId). Review workflow actions must target a shared
  // exhibition.
  let exhibitionTitle = "";
  if (data.exhibitionId) {
    const share = await db.projectShare.findUnique({
      where: { teamId_exhibitionId: { teamId: id, exhibitionId: data.exhibitionId } },
    });
    if (!share) return NextResponse.json({ error: "That exhibition is not shared with this team." }, { status: 403 });
    const exhibition = await db.exhibition.findUnique({ where: { id: data.exhibitionId }, select: { title: true } });
    exhibitionTitle = exhibition?.title ?? "";
  } else if (kind !== "comment") {
    return NextResponse.json({ error: "A review action needs a shared exhibition." }, { status: 400 });
  }

  const storedBody = kind === "comment" ? data.body.trim() : `${KIND_PREFIX[kind]}${data.body.trim()}`;
  const comment = await db.teamComment.create({
    data: {
      teamId: id,
      exhibitionId: data.exhibitionId ?? null,
      authorId: user.id,
      body: storedBody,
      status: "open",
    },
    include: { author: { select: { id: true, name: true } } },
  });

  const action =
    kind === "review"
      ? `requested a review on “${exhibitionTitle}”`
      : kind === "approve"
        ? `approved “${exhibitionTitle}”`
        : kind === "changes"
          ? `requested changes on “${exhibitionTitle}”`
          : exhibitionTitle
            ? `commented on “${exhibitionTitle}”`
            : "commented on the team";
  await logTeamActivity(id, user.id, action, exhibitionTitle);

  return NextResponse.json(
    {
      comment: {
        id: comment.id,
        exhibitionId: comment.exhibitionId,
        authorId: comment.authorId,
        authorName: comment.author.name,
        body: comment.body,
        status: comment.status,
        createdAt: comment.createdAt,
      },
    },
    { status: 201 },
  );
}
