import { redirect } from "next/navigation";
import CertificateTool from "@/components/certificate-tool";
import ToolsShell from "@/components/tools-shell";
import { getCurrentUser } from "@/lib/auth";
import { listLibraryWorks } from "@/lib/library";
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
  const [exhibitionCount, artworks, libraryWorks] = await Promise.all([
    db.exhibition.count({ where: { ownerId: user.id } }),
    db.artwork.findMany({
      where: { exhibition: { ownerId: user.id } },
      select: {
        id: true,
        title: true,
        medium: true,
        dimensions: true,
        year: true,
        artist: true,
        imageUrl: true,
        videoUrl: true,
        sculptureUrl: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    listLibraryWorks(user.id),
  ]);
  // The certificate picker is fed by the central library first ("Mes
  // oeuvres"), then by exhibition artworks whose media is not already
  // in the library, so no work appears twice. A work's identity is its
  // media URL (image, video or sculpture), the same rule the library
  // itself uses.
  const libraryMedia = new Set<string>();
  for (const work of libraryWorks) {
    for (const url of [work.imageUrl, work.videoUrl, work.sculptureUrl]) {
      if (url) libraryMedia.add(url);
    }
  }
  const pickerArtworks = [
    ...libraryWorks.map((work) => ({
      id: work.id,
      title: work.title,
      medium: work.medium,
      dimensions: work.dimensions,
      year: work.year,
      artist: work.artist,
      imageUrl: work.imageUrl,
    })),
    ...artworks
      .filter((artwork) => {
        const media = artwork.imageUrl ?? artwork.videoUrl ?? artwork.sculptureUrl ?? null;
        return !media || !libraryMedia.has(media);
      })
      .map((artwork) => ({
        id: artwork.id,
        title: artwork.title,
        medium: artwork.medium,
        dimensions: artwork.dimensions,
        year: artwork.year,
        artist: artwork.artist,
        imageUrl: artwork.imageUrl,
      })),
  ];
  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="documents"
      eyebrow="documentsEyebrow"
      description="documentsDesc"
    >
      <CertificateTool artistName={user.name} artworks={pickerArtworks} />
    </ToolsShell>
  );
}
