import { redirect } from "next/navigation";
import Link from "next/link";
import ToolsShell from "@/components/tools-shell";
import DigitalTwin, { type TwinArtwork } from "@/components/digital-twin";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Digital Twin, VR & AR — SANAA Tools",
  description:
    "Build a measured digital twin of a physical room, compare planned vs measured values, plan the installation, walk the room in VR, and preview artworks in AR or on a photo of your own wall.",
};

export default async function DigitalTwinRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("digital-twin", user.id);
  const exhibitions = await db.exhibition.findMany({
    where: { ownerId: user.id },
    include: { artworks: { orderBy: { createdAt: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });
  const artworks: TwinArtwork[] = exhibitions.flatMap((exhibition) =>
    exhibition.artworks.map((artwork) => ({
      id: artwork.id,
      exhibitionId: exhibition.id,
      exhibitionTitle: exhibition.title,
      title: artwork.title,
      artist: artwork.artist,
      year: artwork.year,
      medium: artwork.medium,
      dimensions: artwork.dimensions,
      description: artwork.description,
      color: artwork.color,
      imageUrl: artwork.imageUrl,
      frame: artwork.frame,
    })),
  );

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitions.length}
      title="digitalTwin"
      eyebrow="digitalTwinEyebrow"
      description="digitalTwinDesc"
    >
      {artworks.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No artworks yet.</strong>
          <p>
            The twin builder works with your own artworks, so create an exhibition and add at least one work first — the
            builder reads its real dimensions and image for the 3D twin, the VR walk and the AR preview.
          </p>
          <Link href="/exhibitions" className="galleries-open-button">
            Go to your exhibitions
          </Link>
        </div>
      ) : (
        <DigitalTwin artworks={artworks} />
      )}
    </ToolsShell>
  );
}
