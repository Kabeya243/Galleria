import { redirect } from "next/navigation";
import Link from "next/link";
import ToolsShell from "@/components/tools-shell";
import MarketingStudio from "@/components/marketing-studio";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Marketing Studio — Lakisa Tools",
  description:
    "Generate exhibition marketing assets from your own artworks — posters, social graphics, invitation cards, press kits and announcements, with live preview and real-size PNG/JPEG export.",
};

export default async function MarketingStudioRoute({
  searchParams,
}: {
  searchParams: Promise<{ exhibitionId?: string; artworkId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("marketing-studio", user.id);
  const { exhibitionId, artworkId } = await searchParams;
  const [exhibitionCount, exhibitions, artworks] = await Promise.all([
    db.exhibition.count({ where: { ownerId: user.id } }),
    db.exhibition.findMany({
      where: { ownerId: user.id },
      select: { id: true, title: true, description: true, status: true },
      orderBy: { createdAt: "desc" },
    }),
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
        color: true,
        accent: true,
        imageUrl: true,
        exhibition: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="marketingStudio"
      eyebrow="marketingStudioEyebrow"
      description="marketingStudioDesc"
    >
      {artworks.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No artworks yet.</strong>
          <p>Marketing assets are built from your own work. Open an exhibition in the editor and add your first artwork — it will show up here as soon as it exists.</p>
          <Link href="/exhibitions" className="galleries-open-button">
            Go to your exhibitions
          </Link>
        </div>
      ) : (
        <MarketingStudio
          userName={user.name}
          initialExhibitionId={exhibitionId}
          initialArtworkId={artworkId}
          artworks={artworks.map((a) => ({ ...a, exhibitionTitle: a.exhibition.title }))}
          exhibitions={exhibitions}
        />
      )}
    </ToolsShell>
  );
}
