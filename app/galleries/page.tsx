import GalleriesPage, { type GalleryPresetCard } from "@/components/galleries-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { roomLayouts, type RoomLayout } from "@/lib/rooms";

export const metadata = {
  title: "Galleries — SANAA",
  description: "Ten gallery rooms, each with its own light, walls and floor. Preview them in 3D and open one in the editor.",
};

export default async function GalleriesRoute() {
  const user = await getCurrentUser();
  const ownExhibitionCount = user ? await db.exhibition.count({ where: { ownerId: user.id } }) : 0;
  const rooms = (Object.keys(roomLayouts) as RoomLayout[]).map((key): GalleryPresetCard => {
    const preset = roomLayouts[key];
    return {
      key,
      label: preset.label,
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
