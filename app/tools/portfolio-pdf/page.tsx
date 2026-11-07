import { redirect } from "next/navigation";
import Link from "next/link";
import ToolsShell from "@/components/tools-shell";
import PortfolioPdfBuilder from "@/components/portfolio-pdf-builder";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Portfolio PDF Builder — SANAA Tools",
  description:
    "Build a printable artist portfolio PDF from your own artworks — cover, bio, works with captions and contact — from 50 original templates, and export it as a PDF.",
};

export default async function PortfolioPdfRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("portfolio-pdf", user.id);
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
      title="portfolioPdf"
      eyebrow="portfolioPdfEyebrow"
      description="portfolioPdfDesc"
    >
      {artworks.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No artworks yet.</strong>
          <p>Portfolios are built from your own work. Open an exhibition in the editor and add your first artwork — it will show up here as soon as it exists.</p>
          <Link href="/exhibitions" className="galleries-open-button">
            Go to your exhibitions
          </Link>
        </div>
      ) : (
        <PortfolioPdfBuilder
          userName={user.name}
          userEmail={user.email}
          userBio={user.bio ?? null}
          artworks={artworks.map((a) => ({ ...a, exhibitionTitle: a.exhibition.title }))}
        />
      )}
    </ToolsShell>
  );
}
