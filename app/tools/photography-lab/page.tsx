import { redirect } from "next/navigation";
import PhotographyLab from "@/components/photography-lab";
import ToolsShell from "@/components/tools-shell";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";

export const metadata = {
  title: "Photography Lab — SANAA Tools",
  description:
    "Clean up photos of your artworks — straighten, crop, fix the light and export a print-ready file. Your original is never changed.",
};

export default async function PhotographyLabRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("photography-lab", user.id);
  const [exhibitionCount, artworks] = await Promise.all([
    db.exhibition.count({ where: { ownerId: user.id } }),
    db.artwork.findMany({
      where: { exhibition: { ownerId: user.id }, imageUrl: { not: null } },
      select: {
        id: true,
        title: true,
        medium: true,
        year: true,
        imageUrl: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);
  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="Photography Lab"
      eyebrow="TOOLS · PHOTOGRAPHY LAB"
      description="Straighten a crooked shot, crop to the paper's edge, fix the light — and export a clean file for your catalogue or a jury. Nothing here touches your original photo: every edit is a setting, applied only when you export."
    >
      <PhotographyLab
        artworks={artworks.map((a) => ({
          id: a.id,
          title: a.title,
          medium: a.medium,
          year: a.year,
          imageUrl: a.imageUrl as string,
        }))}
      />
    </ToolsShell>
  );
}
