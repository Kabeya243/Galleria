import { redirect } from "next/navigation";
import Link from "next/link";
import ToolsShell from "@/components/tools-shell";
import VideoGenerator, { type VideoExhibition } from "@/components/video-generator";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import { parseGalleryRooms } from "@/lib/rooms";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Exhibition Video Generator — Lakisa Tools",
  description:
    "Turn an exhibition into a shareable video: build a shot list of camera walks, artwork close-ups and title cards, then record the real 3D room in your browser to a .webm file — vertical, square or landscape.",
};

export default async function VideoGeneratorRoute({
  searchParams,
}: {
  searchParams: Promise<{ exhibitionId?: string }>;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("video-generator", user.id);
  const { exhibitionId } = await searchParams;
  const exhibitions = await db.exhibition.findMany({
    where: { ownerId: user.id },
    include: { artworks: { orderBy: { createdAt: "asc" } } },
    orderBy: { updatedAt: "desc" },
  });

  const serialised: VideoExhibition[] = exhibitions.map((exhibition) => {
    let rooms: VideoExhibition["rooms"] = [];
    try {
      rooms = parseGalleryRooms(exhibition.rooms);
    } catch {
      rooms = [];
    }
    return {
      id: exhibition.id,
      title: exhibition.title,
      status: exhibition.status,
      rooms,
      artworks: exhibition.artworks.map((artwork) => ({
        id: artwork.id,
        title: artwork.title,
        artist: artwork.artist,
        year: artwork.year,
        medium: artwork.medium,
        dimensions: artwork.dimensions,
        description: artwork.description,
        positionX: artwork.positionX,
        positionY: artwork.positionY,
        positionZ: artwork.positionZ,
        rotation: artwork.rotation,
        scale: artwork.scale,
        imageUrl: artwork.imageUrl,
        roomId: artwork.roomId,
      })),
    };
  });

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitions.length}
      title="videoGenerator"
      eyebrow="videoGeneratorEyebrow"
      description="videoGeneratorDesc"
    >
      {exhibitions.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No exhibitions yet.</strong>
          <p>Create an exhibition in the editor first — the video generator walks a camera through your real rooms and artworks.</p>
          <Link href="/exhibitions" className="galleries-open-button">
            Go to your exhibitions
          </Link>
        </div>
      ) : (
        <VideoGenerator exhibitions={serialised} initialExhibitionId={exhibitionId} />
      )}
    </ToolsShell>
  );
}
