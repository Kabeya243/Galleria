// Gallery names — one canonical name per room template, admin-overridable.
//
// The twenty-one room templates live in code (lib/rooms.ts) and their
// `label` is the name. This module carries the canonical name: gallery
// names are proper names and are NEVER translated — the same name shows
// in every language (see lib/i18n.ts). The owner can rename any gallery
// in the admin dashboard; renames are stored in the database (model
// GalleryName, see lib/gallery-names-server.ts) and win over these
// defaults. (The stored French name is kept for compatibility but no
// longer displayed anywhere.)
//
// Pure data + a pure helper — no database import, so client components
// can import this file safely.

import type { Locale } from "@/lib/i18n";
import { roomLayouts, type RoomLayout } from "@/lib/rooms";

export type GalleryNameEntry = { en: string; fr: string };
export type GalleryNamesMap = Record<RoomLayout, GalleryNameEntry>;

export const GALLERY_NAME_DEFAULTS: GalleryNamesMap = {
  sunlight: { en: "Sunlight Gallery", fr: "Sunlight Gallery" },
  serpentine: { en: "The Serpentine", fr: "The Serpentine" },
  vitrine: { en: "The Vitrine", fr: "The Vitrine" },
  loft: { en: "The Concrete Loft", fr: "The Concrete Loft" },
  halle: { en: "The Design Hall", fr: "The Design Hall" },
  arche: { en: "The Arch", fr: "The Arch" },
  musee: { en: "The Blue Museum", fr: "The Blue Museum" },
  "claire-voie": { en: "The Clerestory", fr: "The Clerestory" },
  parquet: { en: "The Parquet", fr: "The Parquet" },
  verriere: { en: "The Glass Roof", fr: "The Glass Roof" },
  pavillon: { en: "Pavilion of Light", fr: "Pavilion of Light" },
  classique: { en: "The Classical Gallery", fr: "The Classical Gallery" },
  "atrium-blanc": { en: "The White Atrium", fr: "The White Atrium" },
  patio: { en: "The Oval Patio", fr: "The Oval Patio" },
  escalier: { en: "The Stair Hall", fr: "The Stair Hall" },
  "salles-vertes": { en: "The Green Rooms", fr: "The Green Rooms" },
  "couloir-sombre": { en: "Elegant Gallery", fr: "Elegant Gallery" },
  "couloir-dore": { en: "The Golden Corridor", fr: "The Golden Corridor" },
  voutes: { en: "The Vaulted Ceiling", fr: "The Vaulted Ceiling" },
  courbes: { en: "White Curves", fr: "White Curves" },
  "atrium-lattes": { en: "The Slatted Atrium", fr: "The Slatted Atrium" },
};

/**
 * Display name for a gallery: admin override → default → room label.
 * The name is a proper name: it is identical in every language, so
 * `locale` is accepted for call-site compatibility but intentionally
 * ignored — the canonical (English) name is always returned.
 */
export function galleryLabel(
  layout: RoomLayout,
  _locale: Locale,
  overrides?: Partial<GalleryNamesMap> | null,
): string {
  return (
    overrides?.[layout]?.en ??
    GALLERY_NAME_DEFAULTS[layout]?.en ??
    roomLayouts[layout]?.label ??
    layout
  );
}
