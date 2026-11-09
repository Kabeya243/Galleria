import { redirect } from "next/navigation";
import Link from "next/link";
import ToolsShell from "@/components/tools-shell";
import PrintStudio from "@/components/print-studio";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Print Production Studio — Lakisa Tools",
  description:
    "Production-ready print materials from your own artworks — posters, wall labels, catalogue pages and certificates, with real dimensions, bleed, a DPI check from the image's actual pixel size, and a production PDF with crop marks.",
};

export default async function PrintStudioRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("print-studio", user.id);
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
      title="printStudio"
      eyebrow="printStudioEyebrow"
      description="printStudioDesc"
    >
      {artworks.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No artworks yet.</strong>
          <p>Print jobs are built from your own work. Open an exhibition in the editor and add your first artwork — it will show up here as soon as it exists.</p>
          <Link href="/exhibitions" className="galleries-open-button">
            Go to your exhibitions
          </Link>
        </div>
      ) : (
        <PrintStudio
          userName={user.name}
          artworks={artworks.map((a) => ({ ...a, exhibitionTitle: a.exhibition.title }))}
        />
      )}
    </ToolsShell>
  );
}
