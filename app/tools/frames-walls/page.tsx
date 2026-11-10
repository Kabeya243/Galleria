import { redirect } from "next/navigation";
import Link from "next/link";
import ToolsShell from "@/components/tools-shell";
import FramesWallsTool from "@/components/frames-walls-tool";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Frames & Art on Walls: Lakisa Tools",
  description:
    "Frame your artworks in realistic frames, save the frame to the work, then hang it on one of 10 real wall photos and export a print-ready mockup.",
};

// Frames & Art on Walls: the merged Frames + Mockup Studio tool.
export default async function FramesWallsRoute({
  searchParams,
}: {
  searchParams: Promise<{ artworkId?: string; view?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("frames-walls", user.id);
  const { artworkId, view } = await searchParams;
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

  // One entry per work, not per placement: the same image can sit in
  // several exhibitions, and the selector used to list it twice (the
  // first row wins, most recently created first).
  const seen = new Set<string>();
  const distinctArtworks = artworks.filter((a) => {
    const key = a.imageUrl ?? `title:${a.title}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="framesWalls"
      eyebrow="framesWallsEyebrow"
      description="framesWallsDesc"
    >
      {distinctArtworks.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No artworks yet.</strong>
          <p>Open an exhibition in the editor and add your first work, it will show up here as soon as it exists.</p>
          <Link href="/exhibitions" className="galleries-open-button">
            Go to your exhibitions
          </Link>
        </div>
      ) : (
        <FramesWallsTool
          initialArtworkId={artworkId}
          initialView={view === "walls" ? "walls" : "frames"}
          artworks={distinctArtworks.map((a) => ({
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
