import { redirect } from "next/navigation";
import Link from "next/link";
import ToolsShell from "@/components/tools-shell";
import EducationStudio from "@/components/education-studio";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Art Education Studio — SANAA Tools",
  description:
    "Build educational packs for your exhibitions: learner labels, learning guides, curatorial questions, interactive quizzes, analysis prompts and guided learning paths — printable and exportable.",
};

export default async function EducationStudioRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("education-studio", user.id);
  const [exhibitionCount, exhibitions] = await Promise.all([
    db.exhibition.count({ where: { ownerId: user.id } }),
    db.exhibition.findMany({
      where: { ownerId: user.id },
      select: {
        id: true,
        title: true,
        status: true,
        artworks: {
          select: {
            id: true,
            title: true,
            medium: true,
            year: true,
            dimensions: true,
            description: true,
            imageUrl: true,
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="educationStudio"
      eyebrow="educationStudioEyebrow"
      description="educationStudioDesc"
    >
      {exhibitions.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No exhibitions yet.</strong>
          <p>Create an exhibition and add artworks first — the education pack is built per exhibition, artwork by artwork.</p>
          <Link href="/exhibitions" className="galleries-open-button">
            Go to your exhibitions
          </Link>
        </div>
      ) : (
        <EducationStudio
          exhibitions={exhibitions.map((e) => ({
            id: e.id,
            title: e.title,
            status: e.status,
            artworks: e.artworks.map((a) => ({
              id: a.id,
              title: a.title,
              medium: a.medium,
              year: a.year,
              dimensions: a.dimensions,
              description: a.description,
              imageUrl: a.imageUrl,
            })),
          }))}
        />
      )}
    </ToolsShell>
  );
}
