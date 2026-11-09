import { redirect } from "next/navigation";
import ToolsShell from "@/components/tools-shell";
import ArtworkIntelligence from "@/components/artwork-intelligence";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import { getProviderStatus } from "@/lib/ai-providers";

export const metadata = {
  title: "Artwork Intelligence — Lakisa Tools",
  description:
    "Read what is already in your artwork: metadata pre-filled from your record, rule-based tags, dominant colours measured from the real pixels, and template description and accessibility drafts — all labelled as drafts to check. Model enrichment stays off until an AI provider is connected.",
};

export default async function ArtworkIntelligenceRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("artwork-intelligence", user.id);
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
        frame: true,
        imageUrl: true,
        roomId: true,
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
      title="artworkIntelligence"
      eyebrow="artworkIntelligenceEyebrow"
      description="artworkIntelligenceDesc"
    >
      <ArtworkIntelligence
        artworks={artworks.map((a) => ({
          id: a.id,
          title: a.title,
          artist: a.artist,
          year: a.year,
          medium: a.medium,
          dimensions: a.dimensions,
          description: a.description,
          color: a.color,
          accent: a.accent,
          frame: a.frame,
          imageUrl: a.imageUrl,
          roomId: a.roomId,
          exhibitionId: a.exhibitionId,
          exhibitionTitle: a.exhibition.title,
        }))}
        providerStatus={getProviderStatus()}
      />
    </ToolsShell>
  );
}
