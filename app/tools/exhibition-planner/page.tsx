import { redirect } from "next/navigation";
import Link from "next/link";
import ToolsShell from "@/components/tools-shell";
import ExhibitionPlanner from "@/components/exhibition-planner";
import { getCurrentUser } from "@/lib/auth";
import { requireToolAccess } from "@/lib/subscriptions";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Exhibition Planner: Lakisa Tools",
  description:
    "Plan an exhibition end to end, concept and curatorial statement, dates, artwork selection, room assignment and sequence, wall labels, installation checklist, team assignments and a printable plan.",
};

export default async function ExhibitionPlannerRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await requireToolAccess(user, "exhibition-planner");
  await logToolUse("exhibition-planner", user.id);
  const [exhibitionCount, artworks] = await Promise.all([
    db.exhibition.count({ where: { ownerId: user.id } }),
    db.artwork.findMany({
      where: { exhibition: { ownerId: user.id } },
      select: {
        id: true,
        title: true,
        artist: true,
        year: true,
        medium: true,
        dimensions: true,
        description: true,
        imageUrl: true,
        exhibitionId: true,
        exhibition: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="exhibitionPlanner"
      eyebrow="exhibitionPlannerEyebrow"
      description="exhibitionPlannerDesc"
    >
      {artworks.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No artworks yet.</strong>
          <p>Open an exhibition in the editor and add your first work, it will show up here as soon as it exists.</p>
          <Link href="/exhibitions" className="galleries-open-button">
            Go to your exhibitions
          </Link>
        </div>
      ) : (
        <ExhibitionPlanner
          artworks={artworks.map((a) => ({
            id: a.id,
            title: a.title,
            artist: a.artist,
            year: a.year,
            medium: a.medium,
            dimensions: a.dimensions,
            description: a.description,
            imageUrl: a.imageUrl,
            exhibitionId: a.exhibitionId,
            exhibitionTitle: a.exhibition.title,
          }))}
        />
      )}
    </ToolsShell>
  );
}
