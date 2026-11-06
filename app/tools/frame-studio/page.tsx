import { redirect } from "next/navigation";
import Link from "next/link";
import ToolsShell from "@/components/tools-shell";
import FrameStudio from "@/components/frame-studio";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Frame Studio — SANAA Tools",
  description:
    "Frame your artworks — all 28 digitised styles with faithful previews, custom width, depth, material, matboard and glass, side-by-side comparison, and one-click save to the artwork.",
};

export default async function FrameStudioRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("frame-studio", user.id);
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
        frame: true,
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
      title="Frame Studio"
      eyebrow="TOOLS · FRAME STUDIO"
      description="Frame your artworks without opening the 3D editor. Pick a work, preview it in every frame style, fine-tune the frame to the millimetre, compare up to four side by side — then save the frame straight onto the artwork."
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
        <FrameStudio
          artworks={artworks.map((a) => ({
            id: a.id,
            title: a.title,
            medium: a.medium,
            dimensions: a.dimensions,
            year: a.year,
            color: a.color,
            accent: a.accent,
            imageUrl: a.imageUrl,
            exhibitionId: a.exhibitionId,
            exhibitionTitle: a.exhibition.title,
            frame: a.frame,
          }))}
        />
      )}
    </ToolsShell>
  );
}
