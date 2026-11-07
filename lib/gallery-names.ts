// Gallery names — English + French defaults, admin-overridable.
//
// The twenty-one room templates live in code (lib/rooms.ts) and their
// `label` is the English name. This module carries both languages:
// the English name is what visitors see by default, the French name
// is used when the visitor switches the site to French (see
// lib/i18n.ts). The owner can rename any gallery in the admin
// dashboard; renames are stored in the database (model GalleryName,
// see lib/gallery-names-server.ts) and win over these defaults.
//
// Pure data + a pure helper — no database import, so client components
// can import this file safely.

import type { Locale } from "@/lib/i18n";
import { roomLayouts, type RoomLayout } from "@/lib/rooms";

export type GalleryNameEntry = { en: string; fr: string };
export type GalleryNamesMap = Record<RoomLayout, GalleryNameEntry>;

export const GALLERY_NAME_DEFAULTS: GalleryNamesMap = {
  sunlight: { en: "Sunlight Gallery", fr: "Sunlight Gallery" },
  serpentine: { en: "The Serpentine", fr: "La Serpentine" },
  vitrine: { en: "The Vitrine", fr: "La Vitrine" },
  loft: { en: "The Concrete Loft", fr: "Le Loft Béton" },
  halle: { en: "The Design Hall", fr: "La Halle Design" },
  arche: { en: "The Arch", fr: "L'Arche" },
  musee: { en: "The Blue Museum", fr: "Le Musée Bleu" },
  "claire-voie": { en: "The Clerestory", fr: "La Claire-Voie" },
  parquet: { en: "The Parquet", fr: "Le Parquet" },
  verriere: { en: "The Glass Roof", fr: "La Verrière" },
  pavillon: { en: "Pavilion of Light", fr: "Pavillon de lumière" },
  classique: { en: "The Classical Gallery", fr: "Galerie classique" },
  "atrium-blanc": { en: "The White Atrium", fr: "Atrium blanc" },
  patio: { en: "The Oval Patio", fr: "Patio ovale" },
  escalier: { en: "The Stair Hall", fr: "Hall à escalier" },
  "salles-vertes": { en: "The Green Rooms", fr: "Salles vertes" },
  "couloir-sombre": { en: "Elegant Gallery", fr: "Galerie élégante" },
  "couloir-dore": { en: "The Golden Corridor", fr: "Couloir doré" },
  voutes: { en: "The Vaulted Ceiling", fr: "Plafond à voûtes" },
  courbes: { en: "White Curves", fr: "Courbes blanches" },
  "atrium-lattes": { en: "The Slatted Atrium", fr: "Atrium à lattes" },
};

/** Display name for a gallery: admin override → default → room label. */
export function galleryLabel(
  layout: RoomLayout,
  locale: Locale,
  overrides?: Partial<GalleryNamesMap> | null,
): string {
  return (
    overrides?.[layout]?.[locale] ??
    GALLERY_NAME_DEFAULTS[layout]?.[locale] ??
    roomLayouts[layout]?.label ??
    layout
  );
}
