import { db } from "@/lib/db";
import {
  GALLERY_NAME_DEFAULTS,
  type GalleryNamesMap,
} from "@/lib/gallery-names";
import type { RoomLayout } from "@/lib/rooms";

// Gallery names, admin-overridable: the database rows win, the code
// defaults fill the gaps. Returns the full map (all twenty-one
// layouts) so callers never need a fallback.
export async function getGalleryNames(): Promise<GalleryNamesMap> {
  const names: GalleryNamesMap = { ...GALLERY_NAME_DEFAULTS };
  try {
    const rows = await db.galleryName.findMany();
    for (const row of rows) {
      if (row.layout in names) {
        names[row.layout as RoomLayout] = { en: row.nameEn, fr: row.nameFr };
      }
    }
  } catch {
    // The table does not exist yet (first deploy before `prisma db push`
    // creates it): fall back to the code defaults instead of breaking
    // the page.
  }
  return names;
}
