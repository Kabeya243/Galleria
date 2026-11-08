import { redirect } from "next/navigation";
import Link from "next/link";
import ToolsShell from "@/components/tools-shell";
import WebsiteBuilder from "@/components/website-builder";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Artist Website Builder — SANAA Tools",
  description:
    "Build a portfolio site from your own SANAA artworks and exhibitions — three real themes, editable sections, SEO fields, live responsive preview, and a real public page at /sites/[id].",
};

export default async function WebsiteBuilderRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("website-builder", user.id);
  const [exhibitionCount, exhibitions] = await Promise.all([
    db.exhibition.count({ where: { ownerId: user.id } }),
    db.exhibition.findMany({
      where: { ownerId: user.id },
      select: {
        id: true,
        title: true,
        description: true,
        status: true,
        artworks: {
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
          },
          orderBy: { createdAt: "asc" },
        },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const siteExhibitions = exhibitions.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    status: e.status,
    artworks: e.artworks.map((a) => ({ ...a, exhibitionTitle: e.title })),
  }));

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="websiteBuilder"
      eyebrow="websiteBuilderEyebrow"
      description="websiteBuilderDesc"
    >
      <p style={{ margin: "0 0 16px", fontSize: 13, opacity: 0.75 }}>
        Ce créateur simple construit votre site à partir de vos œuvres et expositions SANAA
        (51 thèmes). Pour un éditeur visuel avancé — 11 modèles, plusieurs pages, 18 blocs,
        glisser-déposer —{" "}
        <Link href="/tools/website-builder/advanced">ouvrez l’éditeur avancé →</Link>
      </p>
      {exhibitions.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No exhibitions yet.</strong>
          <p>Your site is built from your own SANAA data. Create an exhibition and add artworks first — they will show up here as soon as they exist.</p>
          <Link href="/exhibitions" className="galleries-open-button">
            Go to your exhibitions
          </Link>
        </div>
      ) : (
        <WebsiteBuilder userName={user.name} userEmail={user.email} exhibitions={siteExhibitions} />
      )}
    </ToolsShell>
  );
}
