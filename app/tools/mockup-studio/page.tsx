import { redirect } from "next/navigation";
import Link from "next/link";
import ToolsShell from "@/components/tools-shell";
import MockupStudio from "@/components/mockup-studio";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Mockup Studio — SANAA Tools",
  description: "See your artwork on a real wall before you hang it — eight interiors, frames, lighting and print-ready exports.",
};

export default async function MockupStudioRoute({
  searchParams,
}: {
  searchParams: Promise<{ artworkId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("mockup-studio", user.id);
  const { artworkId } = await searchParams;
  const [exhibitionCount, artworks] = await Promise.all([
    db.exhibition.count({ where: { ownerId: user.id } }),
    db.artwork.findMany({
      where: { exhibition: { ownerId: user.id } },
      select: {
        id: true,
        title: true,
        medium: true,
        dimensions: true,
        year: true,
        color: true,
        accent: true,
        imageUrl: true,
        exhibition: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="mockupStudio"
      eyebrow="mockupStudioEyebrow"
      description="mockupStudioDesc"
    >
      {artworks.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No artworks yet.</strong>
          <p>Open an exhibition in the editor and add your first work — it will show up here as soon as it exists.</p>
          <Link href="/exhibitions" className="galleries-open-button">
            Go to your exhibitions
          </Link>
        </div>
      ) : (
        <MockupStudio
          initialArtworkId={artworkId}
          artworks={artworks.map((a) => ({
            id: a.id,
            title: a.title,
            medium: a.medium,
            dimensions: a.dimensions,
            year: a.year,
            color: a.color,
            accent: a.accent,
            imageUrl: a.imageUrl,
            exhibitionTitle: a.exhibition.title,
          }))}
        />
      )}
    </ToolsShell>
  );
}
