// Entrance captures for the galleries catalogue — a dev utility, not
// linked anywhere. Each URL renders one gallery in 3D from its
// entrance (the room's camera start, Sunlight light by default) with
// no UI chrome, and marks itself ready for the screenshot script
// (scripts/capture-galleries.mjs) once the scene has rendered.
// The captures are saved as public/gallery-thumbnails/<layout>.jpg
// and used as the cards' thumbnails on /galleries.
import { notFound } from "next/navigation";
import { roomLayouts, type RoomLayout } from "@/lib/rooms";
import CaptureView from "./capture-view";

export default async function CapturePage({ params }: { params: Promise<{ layout: string }> }) {
  const { layout } = await params;
  if (!(layout in roomLayouts)) notFound();
  return <CaptureView layout={layout as RoomLayout} />;
}
