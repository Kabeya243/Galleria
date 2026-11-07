import { redirect } from "next/navigation";
import Link from "next/link";
import ToolsShell from "@/components/tools-shell";
import AccessibilityStudio from "@/components/accessibility-studio";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Accessibility & Audio Guide Studio — SANAA Tools",
  description:
    "Write audio descriptions, artist and curator narration, captions and transcripts for every artwork — in English and French — preview them with your browser's voices, and check the exhibition against a real accessibility checklist.",
};

export default async function AccessibilityStudioRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("accessibility-studio", user.id);
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
      title="accessibility"
      eyebrow="accessibilityEyebrow"
      description="accessibilityDesc"
    >
      {exhibitions.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No exhibitions yet.</strong>
          <p>Create an exhibition and add artworks first — the accessibility pack is written per exhibition, artwork by artwork.</p>
          <Link href="/exhibitions" className="galleries-open-button">
            Go to your exhibitions
          </Link>
        </div>
      ) : (
        <AccessibilityStudio
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
