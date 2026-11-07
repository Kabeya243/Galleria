// Atelier editor — the Atelier Kiggundu design editor (Fabric.js canvas
// + server-side PDF/JPG/PNG export) hosted inside SANAA, replacing the
// old 50-template print-based portfolio builder (deleted 8 Nov 2026 on
// Kabeya's decision). Owner-only: the user's own artworks are available
// inside the editor ("Mes œuvres" tab) as placeable images.

import { redirect } from "next/navigation";
import ToolsShell from "@/components/tools-shell";
import AtelierEditor from "@/components/atelier-editor";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";

export const metadata = {
  title: "Atelier — SANAA Tools",
  description:
    "Design posters, posts, CVs, invitations and presentations in the Atelier editor — 8 original templates, text, shapes, images and your own artworks — and export a real vector PDF, JPG or PNG.",
};

export default async function PortfolioPdfRoute({
  searchParams,
}: {
  searchParams: Promise<{ project?: string; template?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("portfolio-pdf", user.id);
  const params = await searchParams;
  const projectId = typeof params.project === "string" ? params.project : "";
  const [exhibitionCount, artworks] = await Promise.all([
    db.exhibition.count({ where: { ownerId: user.id } }),
    db.artwork.findMany({
      where: { exhibition: { ownerId: user.id } },
      select: { id: true, title: true, imageUrl: true },
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
      <AtelierEditor
        key={projectId}
        artworks={artworks
          .filter((a) => a.imageUrl !== null)
          .map((a) => ({ id: a.id, title: a.title, imageUrl: a.imageUrl as string }))}
      />
    </ToolsShell>
  );
}
