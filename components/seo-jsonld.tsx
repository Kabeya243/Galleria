// SEO helpers for Lakisa (November 2026).
//
// Single source of truth for the canonical site URL and for the
// structured-data (JSON-LD) and hreflang helpers. The canonical base is
// https://galleria-bice.vercel.app until lakisa.art is connected: change
// SITE_URL below in this one place and the sitemap, robots.txt, JSON-LD
// and every canonical / hreflang built from these helpers follow.
//
// Note on languages: the site serves all 11 locales from the same URL
// (the visitor switches language client-side, stored in a cookie, see
// lib/i18n.ts). There are no localized URL paths such as /fr/..., so the
// hreflang entries built by languageAlternates() all point at the same
// URL, one per locale, plus x-default. That is the honest shape for this
// site; if localized paths ever appear, this helper is the place to
// change the URL shape.

// The 11 supported locales, listed here (not imported from lib/i18n.ts,
// which is a client module using useSyncExternalStore and cannot be
// imported by server components such as app/layout.tsx).
const LOCALES = ["en", "fr", "de", "it", "es", "pt", "zh", "ja", "ko", "sw", "ln"] as const;

/** Canonical base URL of the deployed site. Change to https://lakisa.art once the domain is connected. */
export const SITE_URL = "https://galleria-bice.vercel.app";

/** Absolute URL for a site path (path must start with "/"). */
export function canonicalUrl(path: string): string {
  return `${SITE_URL}${path}`;
}

/**
 * hreflang map for one page path, for Next.js metadata
 * (alternates.languages). One entry per supported locale from
 * lib/i18n.ts, plus x-default pointing at the English version.
 */
export function languageAlternates(path: string): Record<string, string> {
  const url = canonicalUrl(path);
  const alternates: Record<string, string> = { "x-default": url };
  for (const locale of LOCALES) {
    alternates[locale] = url;
  }
  return alternates;
}

/** Renders a <script type="application/ld+json"> block. Pass a plain JSON-able object. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(data) }}
    />
  );
}

/** Organization structured data for the homepage. */
export function organizationJsonLd(): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "Lakisa",
    url: SITE_URL,
    logo: `${SITE_URL}/brand/lakisa-principal-noir.png`,
    description:
      "Lakisa is a platform where artists create, curate and share immersive virtual art exhibitions, free to visit from anywhere.",
  };
}

export type ExhibitionJsonLdArtwork = {
  title: string;
  artist?: string | null;
  year?: string | null;
  medium?: string | null;
  dimensions?: string | null;
  description?: string | null;
  imageUrl?: string | null;
  altText?: string | null;
};

export type ExhibitionJsonLdInput = {
  slug: string;
  title: string;
  description?: string | null;
  ownerName: string;
  artworks: ExhibitionJsonLdArtwork[];
};

/**
 * Exhibition structured data for a public exhibition page.
 * Schema.org has no "Exhibition" type: the event type is
 * ExhibitionEvent, with each hanging work as a VisualArtwork.
 */
export function exhibitionJsonLd(
  exhibition: ExhibitionJsonLdInput,
): Record<string, unknown> {
  const toAbsoluteImage = (url: string | null | undefined): string | undefined => {
    if (!url) return undefined;
    if (url.startsWith("http://") || url.startsWith("https://")) return url;
    if (url.startsWith("/")) return `${SITE_URL}${url}`;
    return url;
  };
  return {
    "@context": "https://schema.org",
    "@type": "ExhibitionEvent",
    name: exhibition.title,
    description:
      exhibition.description?.trim() ||
      `A virtual exhibition curated by ${exhibition.ownerName}.`,
    url: canonicalUrl(`/exhibition/${exhibition.slug}`),
    organizer: {
      "@type": "Person",
      name: exhibition.ownerName,
    },
    workFeatured: exhibition.artworks
      .filter((artwork) => artwork.title?.trim())
      .map((artwork) => {
        const visualArtwork: Record<string, unknown> = {
          "@type": "VisualArtwork",
          name: artwork.title,
        };
        if (artwork.artist?.trim()) {
          visualArtwork.creator = { "@type": "Person", name: artwork.artist.trim() };
        }
        if (artwork.year?.trim()) visualArtwork.dateCreated = artwork.year.trim();
        if (artwork.medium?.trim()) visualArtwork.artMedium = artwork.medium.trim();
        if (artwork.dimensions?.trim()) visualArtwork.size = artwork.dimensions.trim();
        if (artwork.description?.trim()) {
          visualArtwork.description = artwork.description.trim();
        }
        const image = toAbsoluteImage(artwork.imageUrl);
        if (image) visualArtwork.image = image;
        return visualArtwork;
      }),
  };
}
