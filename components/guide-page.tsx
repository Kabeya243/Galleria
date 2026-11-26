"use client";

import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import SiteFooter from "@/components/site-footer";
import { useT, type DictionarySection } from "@/lib/i18n";
import styles from "./legal-page.module.css";

// /guide — the complete user guide. Every step describes
// a feature that really exists in the code — the names used are the
// ones the product itself uses:
//
// - Account: /register (email + password, or "Continue with Google"),
//   /login to sign in again.
// - Create: /create opens the "Create exhibition" dialog — the title
//   is mandatory, the visitor picks a room model for the first room
//   (Sunlight Gallery by default); more rooms can be added in the
//   editor. Rooms: lib/rooms.ts (Sunlight Gallery, Elegant Gallery,
//   The Serpentine, The Vitrine, The Concrete Loft, …).
// - Editor: double-click to select, drag a selected artwork along its
//   wall, click a wall to paint it, "Compose wall" auto-hang (one row
//   at eye level, 1.50 m, 12 cm apart, largest in the centre, undone
//   in a single step — lib/compose-wall.ts), Ctrl+Z to undo, Save,
//   then Publish.
// - Sharing: status draft/published, visibility public (listed, may
//   appear in the Feed), private link (published, never listed, direct
//   URL only) or password (password asked before entering) —
//   prisma/schema.prisma, Exhibition.visibility.
// - Visit: entry screen with "Enter the room", a list view, and a
//   guided tour when the artist made one; WASD or arrow keys to walk,
//   drag to look, click the floor to walk to a spot, the floor plan
//   (mini-plan) to change rooms or jump to an artwork, click an
//   artwork for its details. No account needed to visit a public
//   exhibition.
// - Profile and works: Settings (display name, biography, photo,
//   password, delete account — which deletes exhibitions and artworks
//   with it), My artworks (/artworks, a reusable library), My
//   exhibitions (/exhibitions).
//
// Nothing is described here that the product does not do.

type GuideStep = { title: string; text: string };
type GuideSection = { id: string; title: string; intro: string; steps: GuideStep[] };

type GuideSectionKeys = {
  id: string;
  titleKey: DictionarySection<"guide">;
  introKey: DictionarySection<"guide">;
  steps: Array<{ titleKey: DictionarySection<"guide">; textKey: DictionarySection<"guide"> }>;
};

// The guide body lives in the dictionary (section `guide`: one
// title + intro per section, one title + text per step). Every
// language without a translation falls back to English, as the
// translate() rule says. The section ids double as the page
// anchors (#account, #create-exhibition, …).
const SECTION_KEYS: GuideSectionKeys[] = [
  { id: "account", titleKey: "sectionAccountTitle", introKey: "sectionAccountIntro", steps: [
    { titleKey: "sectionAccountStep1Title", textKey: "sectionAccountStep1Text" },
    { titleKey: "sectionAccountStep2Title", textKey: "sectionAccountStep2Text" },
    { titleKey: "sectionAccountStep3Title", textKey: "sectionAccountStep3Text" },
    { titleKey: "sectionAccountStep4Title", textKey: "sectionAccountStep4Text" },
  ] },
  { id: "create-exhibition", titleKey: "sectionCreateExhibitionTitle", introKey: "sectionCreateExhibitionIntro", steps: [
    { titleKey: "sectionCreateExhibitionStep1Title", textKey: "sectionCreateExhibitionStep1Text" },
    { titleKey: "sectionCreateExhibitionStep2Title", textKey: "sectionCreateExhibitionStep2Text" },
    { titleKey: "sectionCreateExhibitionStep3Title", textKey: "sectionCreateExhibitionStep3Text" },
    { titleKey: "sectionCreateExhibitionStep4Title", textKey: "sectionCreateExhibitionStep4Text" },
  ] },
  { id: "artworks", titleKey: "sectionArtworksTitle", introKey: "sectionArtworksIntro", steps: [
    { titleKey: "sectionArtworksStep1Title", textKey: "sectionArtworksStep1Text" },
    { titleKey: "sectionArtworksStep2Title", textKey: "sectionArtworksStep2Text" },
    { titleKey: "sectionArtworksStep3Title", textKey: "sectionArtworksStep3Text" },
    { titleKey: "sectionArtworksStep4Title", textKey: "sectionArtworksStep4Text" },
    { titleKey: "sectionArtworksStep5Title", textKey: "sectionArtworksStep5Text" },
  ] },
  { id: "rooms", titleKey: "sectionRoomsTitle", introKey: "sectionRoomsIntro", steps: [
    { titleKey: "sectionRoomsStep1Title", textKey: "sectionRoomsStep1Text" },
    { titleKey: "sectionRoomsStep2Title", textKey: "sectionRoomsStep2Text" },
    { titleKey: "sectionRoomsStep3Title", textKey: "sectionRoomsStep3Text" },
  ] },
  { id: "share", titleKey: "sectionShareTitle", introKey: "sectionShareIntro", steps: [
    { titleKey: "sectionShareStep1Title", textKey: "sectionShareStep1Text" },
    { titleKey: "sectionShareStep2Title", textKey: "sectionShareStep2Text" },
    { titleKey: "sectionShareStep3Title", textKey: "sectionShareStep3Text" },
    { titleKey: "sectionShareStep4Title", textKey: "sectionShareStep4Text" },
    { titleKey: "sectionShareStep5Title", textKey: "sectionShareStep5Text" },
  ] },
  { id: "visit", titleKey: "sectionVisitTitle", introKey: "sectionVisitIntro", steps: [
    { titleKey: "sectionVisitStep1Title", textKey: "sectionVisitStep1Text" },
    { titleKey: "sectionVisitStep2Title", textKey: "sectionVisitStep2Text" },
    { titleKey: "sectionVisitStep3Title", textKey: "sectionVisitStep3Text" },
    { titleKey: "sectionVisitStep4Title", textKey: "sectionVisitStep4Text" },
    { titleKey: "sectionVisitStep5Title", textKey: "sectionVisitStep5Text" },
  ] },
  { id: "profile", titleKey: "sectionProfileTitle", introKey: "sectionProfileIntro", steps: [
    { titleKey: "sectionProfileStep1Title", textKey: "sectionProfileStep1Text" },
    { titleKey: "sectionProfileStep2Title", textKey: "sectionProfileStep2Text" },
    { titleKey: "sectionProfileStep3Title", textKey: "sectionProfileStep3Text" },
    { titleKey: "sectionProfileStep4Title", textKey: "sectionProfileStep4Text" },
    { titleKey: "sectionProfileStep5Title", textKey: "sectionProfileStep5Text" },
  ] },
];

export default function GuidePage() {
  const t = useT();
  const sections: GuideSection[] = SECTION_KEYS.map((section) => ({
    id: section.id,
    title: t("guide", section.titleKey),
    intro: t("guide", section.introKey),
    steps: section.steps.map((step) => ({
      title: t("guide", step.titleKey),
      text: t("guide", step.textKey),
    })),
  }));
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          <BrandLogo variant="horizontal" theme="dark" height={52} />
        </Link>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={15} /> {t("guide", "backHome")}
        </Link>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>{t("guide", "eyebrow")}</p>
        <h1 className={styles.title}>{t("guide", "title")}</h1>
        <p className={styles.intro}>{t("guide", "intro")}</p>
      </section>

      <div className={styles.body}>
        <ol className={styles.toc}>
          {sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.title}</a>
            </li>
          ))}
        </ol>

        {sections.map((section) => (
          <section key={section.id} className={styles.section} id={section.id}>
            <h2>{section.title}</h2>
            <p>{section.intro}</p>
            <ol>
              {section.steps.map((step, index) => (
                <li key={index}>
                  <strong>{step.title}</strong>: {step.text}
                </li>
              ))}
            </ol>
          </section>
        ))}

        <section className={styles.section}>
          <h2>{t("guide", "needHelp")}</h2>
          <p>{t("guide", "needHelpText")}</p>
          <a className={styles.mailLink} href="mailto:hello@lakisa.art">
            <Mail size={16} /> hello@lakisa.art
          </a>
          <a className={styles.mailLink} href="mailto:team@lakisa.art">
            <Mail size={16} /> team@lakisa.art
          </a>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
