import { redirect } from "next/navigation";
import ColorIntelligence from "@/components/color-intelligence";
import ToolsShell from "@/components/tools-shell";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";

export const metadata = {
  title: "Color Intelligence: Lakisa Tools",
  description:
    "Read the real colours in your artwork, dominant colours, harmonies, contrast and wall colours that let it shine.",
};

export default async function ColorIntelligenceRoute({
  searchParams,
}: {
  searchParams: Promise<{ artworkId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("color-intelligence", user.id);
  const { artworkId } = await searchParams;
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
        exhibition: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="colorIntelligence"
      eyebrow="colorIntelligenceEyebrow"
      description="colorIntelligenceDesc"
    >
      <ColorIntelligence
        initialArtworkId={artworkId}
        artworks={artworks.map((artwork) => ({
          id: artwork.id,
          title: artwork.title,
          medium: artwork.medium,
          year: artwork.year,
          imageUrl: artwork.imageUrl as string,
          exhibitionTitle: artwork.exhibition.title,
        }))}
      />
    </ToolsShell>
  );
}
