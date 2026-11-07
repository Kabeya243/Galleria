import { redirect } from "next/navigation";
import ToolsShell from "@/components/tools-shell";
import AiArchitect from "@/components/ai-architect";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import { getProviderStatus } from "@/lib/ai-providers";
import { roomLayouts } from "@/lib/rooms";

export const metadata = {
  title: "AI Exhibition Architect — SANAA Tools",
  description:
    "Plan an exhibition from your own works: concept drafts, arrangement, room matches, lighting and wall colours — computed from your artworks, dimensions, colours and the 40 gallery templates. Model features stay off until an AI provider is connected.",
};

type ParsedRoom = {
  id: string;
  name: string;
  layout: string;
  lightType: string;
  wallColor: string;
};

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
        lightType: typeof r.lightType === "string" ? r.lightType : "spot-warm",
        wallColor: typeof r.wallColor === "string" ? r.wallColor : "#f5f2eb",
      }));
  } catch {
    return [];
  }
}

export default async function AiArchitectRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("ai-architect", user.id);
  const [exhibitionCount, artworks, exhibitions] = await Promise.all([
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
      select: { id: true, title: true, rooms: true },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const rooms = exhibitions.flatMap((exhibition) =>
    parseRooms(exhibition.rooms).map((room) => ({ ...room, exhibitionTitle: exhibition.title })),
  );

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

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="aiArchitect"
      eyebrow="aiArchitectEyebrow"
      description="aiArchitectDesc"
    >
      <AiArchitect
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
        rooms={rooms}
        providerStatus={getProviderStatus()}
      />
    </ToolsShell>
  );
}
