import { redirect } from "next/navigation";
import ToolsShell from "@/components/tools-shell";
import AiAssistant from "@/components/ai-assistant";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import { getProviderStatus } from "@/lib/ai-providers";
import { roomLayouts } from "@/lib/rooms";
import { FRAME_VARIANTS } from "@/lib/demo-data";

export const metadata = {
  title: "AI Creative Assistant: Lakisa Tools",
  description:
    "Ask about your real project: which works are unframed, what fits a room, what is missing before publishing. Answers come from your exhibitions, artworks, rooms and frames (with their source shown) and the assistant says so plainly when it cannot answer.",
};

type ParsedRoom = { id: string; name: string; layout: string };

function parseRooms(raw: string): ParsedRoom[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((r): r is Record<string, unknown> => !!r && typeof r === "object")
      .map((r) => ({
        id: typeof r.id === "string" ? r.id : "room-main",
        name: typeof r.name === "string" ? r.name : "Room 1",
        layout: typeof r.layout === "string" ? r.layout : "sunlight",
      }));
  } catch {
    return [];
  }
}

export default async function AiAssistantRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("ai-assistant", user.id);
  const [exhibitionCount, artworks, exhibitions, savedKinds] = await Promise.all([
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
    db.exhibition.findMany({
      where: { ownerId: user.id },
      select: { id: true, title: true, status: true, rooms: true, _count: { select: { artworks: true } } },
      orderBy: { createdAt: "desc" },
    }),
    db.savedWork.findMany({
      where: { userId: user.id },
      select: { kind: true },
      distinct: ["kind"],
    }),
  ]);

  const templates = Object.entries(roomLayouts).map(([key, layout]) => ({
    key,
    label: layout.label,
    category: layout.category,
    description: layout.description,
    width: layout.width,
    depth: layout.depth,
    height: layout.height,
    wallColor: layout.wallColor,
    lightType: layout.lightType,
  }));

  const frames = Object.entries(FRAME_VARIANTS).map(([key, variant]) => ({
    key,
    label: variant.label,
    color: variant.color,
  }));

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="aiAssistant"
      eyebrow="aiAssistantEyebrow"
      description="aiAssistantDesc"
    >
      <AiAssistant
        exhibitions={exhibitions.map((e) => ({
          id: e.id,
          title: e.title,
          status: e.status,
          artworkCount: e._count.artworks,
          rooms: parseRooms(e.rooms),
        }))}
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
        templates={templates}
        frames={frames}
        savedKinds={savedKinds.map((row) => row.kind)}
        providerStatus={getProviderStatus()}
      />
    </ToolsShell>
  );
}
