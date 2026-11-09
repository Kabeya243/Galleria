import { redirect } from "next/navigation";
import CertificateTool from "@/components/certificate-tool";
import ToolsShell from "@/components/tools-shell";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";

export const metadata = {
  title: "Documents: Lakisa Tools",
  description: "Certificates of authenticity, labels and artwork sheets, ready to print.",
};

export default async function DocumentsRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("documents", user.id);
  const [exhibitionCount, artworks] = await Promise.all([
    db.exhibition.count({ where: { ownerId: user.id } }),
    db.artwork.findMany({
      where: { exhibition: { ownerId: user.id } },
      select: { id: true, title: true, medium: true, dimensions: true, year: true, artist: true, imageUrl: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="documents"
      eyebrow="documentsEyebrow"
      description="documentsDesc"
    >
      <CertificateTool artistName={user.name} artworks={artworks} />
    </ToolsShell>
  );
}
