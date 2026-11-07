// Atelier template gallery — the 8 original Atelier Kiggundu templates,
// copied verbatim from the Atelier project (data/templates/*.json).
// The 50 SANAA PDF templates (lib/pdf-templates.ts) were deleted on
// Kabeya's decision (8 Nov 2026): he will create new ones himself.
// A user's own saved designs can also be saved as templates
// ("Mes modèles") — those live in R2, not here.

import a4Poster from "./atelier-templates/a4-poster.json";
import communityFlyer from "./atelier-templates/community-flyer.json";
import creativeResume from "./atelier-templates/creative-resume.json";
import gardenInvitation from "./atelier-templates/garden-invitation.json";
import instagramPost from "./atelier-templates/instagram-post.json";
import instagramStory from "./atelier-templates/instagram-story.json";
import makersBusinessCard from "./atelier-templates/makers-business-card.json";
import studioPresentation from "./atelier-templates/studio-presentation.json";

export type AtelierObject = Record<string, unknown>;

export type AtelierPage = {
  width: number;
  height: number;
  background?: string;
  objects?: AtelierObject[];
  name?: string;
  physicalWidthMm?: number;
  physicalHeightMm?: number;
};

export type AtelierDocument = {
  id: string;
  name: string;
  category?: string;
  width: number;
  height: number;
  background?: string;
  objects?: AtelierObject[];
  pages: AtelierPage[];
  version?: number;
  physicalWidthMm?: number;
  physicalHeightMm?: number;
};

export const ATELIER_TEMPLATES: AtelierDocument[] = [
  a4Poster,
  communityFlyer,
  creativeResume,
  gardenInvitation,
  instagramPost,
  instagramStory,
  makersBusinessCard,
  studioPresentation,
].map((t) => t as unknown as AtelierDocument);

export function atelierTemplateById(id: string): AtelierDocument | null {
  return ATELIER_TEMPLATES.find((t) => t.id === id) ?? null;
}
