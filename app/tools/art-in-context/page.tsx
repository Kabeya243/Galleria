import { redirect } from "next/navigation";
import Link from "next/link";
import ToolsShell from "@/components/tools-shell";
import ArtInContext from "@/components/art-in-context";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import { parseGalleryRooms } from "@/lib/rooms";
import styles from "@/components/tools.module.css";

export const metadata = {
  title: "Art in Context — SANAA Tools",
  description:
    "One guided journey for an artwork — from upload and photography through colour, framing, mockups, arrangement and the 3D gallery, to a published exhibition and its promotion. The same artwork record carries through every step.",
};

export default async function ArtInContextRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("art-in-context", user.id);

  const [exhibitionCount, artworks, exhibitions, projects] = await Promise.all([
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
        frame: true,
        exhibitionId: true,
        exhibition: { select: { title: true } },
      },
      orderBy: { createdAt: "desc" },
    }),
    db.exhibition.findMany({
      where: { ownerId: user.id },
      include: { artworks: { select: { id: true, title: true, imageUrl: true }, orderBy: { createdAt: "asc" } } },
      orderBy: { updatedAt: "desc" },
    }),
    db.savedWork.findMany({
      where: { userId: user.id, kind: "context-project" },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="Art in Context"
      eyebrow="TOOLS · ART IN CONTEXT"
      description="One artwork, one journey: upload it, photograph it, read its colours, frame it, hang it in a room, arrange it with its companions, place it in the 3D gallery, publish the show — and promote it. Every step works on the same record, so nothing is uploaded twice and nothing drifts out of sync."
    >
      {artworks.length === 0 && exhibitions.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>No artworks yet.</strong>
          <p>Create an exhibition first, or start a project below and upload your first artwork — it will show up here as soon as it exists.</p>
          <Link href="/exhibitions" className="galleries-open-button">
            Go to your exhibitions
          </Link>
        </div>
      ) : null}
      <ArtInContext
        userName={user.name}
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
          imageUrl: a.imageUrl,
          frame: a.frame,
          exhibitionId: a.exhibitionId,
          exhibitionTitle: a.exhibition.title,
        }))}
        exhibitions={exhibitions.map((e) => {
          let rooms: { id: string; name: string }[] = [];
          try {
            rooms = parseGalleryRooms(e.rooms).map((r) => ({ id: r.id, name: r.name }));
          } catch {
            rooms = [];
          }
          return {
            id: e.id,
            title: e.title,
            slug: e.slug,
            status: e.status,
            description: e.description,
            roomNames: rooms.map((r) => r.name),
            artworks: e.artworks.map((a) => ({ id: a.id, title: a.title, imageUrl: a.imageUrl })),
          };
        })}
        initialProjects={projects.map((p) => {
          let data: Record<string, unknown> = {};
          try {
            data = JSON.parse(p.data) as Record<string, unknown>;
          } catch {
            data = {};
          }
          return { id: p.id, title: p.title, data, updatedAt: p.updatedAt.toISOString() };
        })}
      />
    </ToolsShell>
  );
}
