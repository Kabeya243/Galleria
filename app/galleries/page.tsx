import GalleriesPage, { type GalleryPresetCard } from "@/components/galleries-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getHiddenRoomLayouts } from "@/lib/hidden-room-layouts";
import { roomLayouts, HIDDEN_LAYOUT_KEYS, type RoomLayout } from "@/lib/rooms";

export const metadata = {
  title: "Galleries — SANAA",
  description: "Six gallery rooms, each with its own light, walls and floor. Preview them in 3D and open one in the editor.",
};

export default async function GalleriesRoute() {
  const user = await getCurrentUser();
  const ownExhibitionCount = user ? await db.exhibition.count({ where: { ownerId: user.id } }) : 0;
  // Templates the owner hid in the admin never reach the catalogue.
  const hidden = new Set(await getHiddenRoomLayouts());
  const rooms = (Object.keys(roomLayouts) as RoomLayout[])
    // The Stone Gallery front/back halves are not standalone templates:
    // the catalogue keeps its six models, Stone Gallery among them.
    .filter((key) => !hidden.has(key) && !HIDDEN_LAYOUT_KEYS.has(key))
    .map((key): GalleryPresetCard => {
    const preset = roomLayouts[key];
    return {
      key,
      label: preset.label,
      category: preset.category,
      description: preset.description,
      width: preset.width,
      depth: preset.depth,
      height: preset.height,
      wallColor: preset.wallColor,
      sideWallColor: preset.sideWallColor,
      floorColor: preset.floorColor,
      ceilingColor: preset.ceilingColor,
      wallTexture: preset.wallTexture,
      floorTexture: preset.floorTexture,
      ceilingTexture: preset.ceilingTexture,
    };
  });
  return <GalleriesPage rooms={rooms} user={user} ownExhibitionCount={ownExhibitionCount} />;
}
