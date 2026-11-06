import { redirect } from "next/navigation";
import ToolsShell from "@/components/tools-shell";
import TeamsTool from "@/components/teams";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";

export const metadata = {
  title: "Teams & Collaboration — SANAA Tools",
  description: "Share exhibitions with a team, comment, run reviews and track activity together.",
};

export default async function TeamsRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("teams", user.id);

  const [exhibitionCount, teams, exhibitions] = await Promise.all([
    db.exhibition.count({ where: { ownerId: user.id } }),
    db.team.findMany({
      where: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true } } }, orderBy: { createdAt: "asc" } },
        _count: { select: { shares: true, comments: true } },
      },
      orderBy: { updatedAt: "desc" },
    }),
    db.exhibition.findMany({
      where: { ownerId: user.id },
      select: { id: true, title: true, slug: true, status: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="Teams & Collaboration"
      eyebrow={`TOOLS · WORKING TOGETHER · ${teams.length} ${teams.length === 1 ? "TEAM" : "TEAMS"}`}
      description="Share an exhibition with a team, talk about it in comments, ask for a review and approve it together. Owners invite, editors share and edit, viewers read — and every permission is checked on the server, not just in the buttons."
    >
      <TeamsTool
        teams={teams.map((team) => {
          const membership = team.members.find((m) => m.userId === user.id);
          return {
            id: team.id,
            name: team.name,
            ownerId: team.ownerId,
            myRole: membership?.role ?? "viewer",
            createdAt: team.createdAt.toISOString(),
            updatedAt: team.updatedAt.toISOString(),
            shareCount: team._count.shares,
            commentCount: team._count.comments,
            members: team.members.map((m) => ({ userId: m.userId, name: m.user.name, email: m.user.email, role: m.role })),
          };
        })}
        exhibitions={exhibitions}
        currentUserId={user.id}
      />
    </ToolsShell>
  );
}
