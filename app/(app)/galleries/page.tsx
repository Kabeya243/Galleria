import GalleriesPage, { type GalleryPresetCard } from "@/components/galleries-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { getGalleryNames } from "@/lib/gallery-names-server";
import { getHiddenRoomLayouts } from "@/lib/hidden-room-layouts";
import { roomLayouts, HIDDEN_LAYOUT_KEYS, type RoomLayout } from "@/lib/rooms";

export const metadata = {
  title: "Lakisa Galerie",
  description: "Twenty-one galleries, the Sunlight Gallery, nine more from six reference files, and eleven from Galeries_3D.html: Pavilion of Light, The Classical Gallery, The White Atrium, The Oval Patio, The Stair Hall, The Green Rooms, Elegant Gallery, The Golden Corridor, The Vaulted Ceiling, White Curves and The Slatted Atrium. Preview each in 3D and open it in the editor.",
};

export default async function GalleriesRoute() {
  const user = await getCurrentUser();
  const ownExhibitionCount = user ? await db.exhibition.count({ where: { ownerId: user.id } }) : 0;
  // Templates the owner hid in the admin never reach the catalogue.
  const hidden = new Set(await getHiddenRoomLayouts());
  // Gallery names (English + French, admin overrides included) — the
  // client picks the language; the server renders English by default.
  const galleryNames = await getGalleryNames();
  const rooms = (Object.keys(roomLayouts) as RoomLayout[])
    // Twenty-one templates: Sunlight plus the nine galleries added in
    // November 2026 plus the eleven from Galeries_3D.html, added the
    // same month. Templates the owner hid in the admin never reach
    // the catalogue.
    .filter((key) => !hidden.has(key) && !HIDDEN_LAYOUT_KEYS.has(key))
    .map((key): GalleryPresetCard => {
    const preset = roomLayouts[key];
    return {
      key,
      label: preset.label,
      category: preset.category,
      description: preset.description,
      descriptionFr: preset.descriptionFr,
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
      thumbnail: preset.thumbnail,
    };
  });
  return <GalleriesPage rooms={rooms} galleryNames={galleryNames} user={user} ownExhibitionCount={ownExhibitionCount} />;
}
