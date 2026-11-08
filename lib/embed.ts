// Embed (iframe) for public exhibitions.
//
// An artist can show a public SANAA exhibition on their own site or a
// third-party site with a plain same-origin <iframe> — no third-party
// JavaScript to load. Only exhibitions that are published AND public
// are embeddable: a private-link show, a password-protected show or a
// draft never renders in an embed (the embed route answers with a
// generic error page that leaks no title or description).
//
// Pure helpers only (no database, no React), so the embed test harness
// (scripts/test-embed.mjs) can import this file directly.

export const DEFAULT_EMBED_WIDTH = "100%";
export const DEFAULT_EMBED_HEIGHT = 600;

/** The only exhibitions that may be embedded: published + public. */
export function isEmbeddableExhibition(exhibition: {
  status: string;
  visibility: string;
}): boolean {
  return exhibition.status === "public" && exhibition.visibility === "public";
}

/** Path of the chromeless embed page for an exhibition slug. */
export function embedPath(slug: string): string {
  return `/embed/exhibition/${encodeURIComponent(slug)}`;
}

/** Absolute URL of the embed page (the iframe src). */
export function buildEmbedUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/$/, "")}${embedPath(slug)}`;
}

export type EmbedSize = { width: string; height: number };

function sanitiseSize(size: Partial<EmbedSize>): EmbedSize {
  const width = size.width?.trim() || DEFAULT_EMBED_WIDTH;
  const height =
    typeof size.height === "number" && Number.isFinite(size.height) && size.height > 0
      ? Math.round(size.height)
      : DEFAULT_EMBED_HEIGHT;
  return { width, height };
}

/**
 * The copy-paste snippet: a plain iframe, same-origin src, no script.
 * The title is the exhibition title (or "SANAA exhibition" when the
 * caller has none) so the frame stays labelled for assistive tech.
 */
export function buildEmbedSnippet(
  embedUrl: string,
  size: Partial<EmbedSize> = {},
  title = "SANAA exhibition",
): string {
  const { width, height } = sanitiseSize(size);
  const safeTitle = title.replace(/"/g, "&quot;");
  return `<iframe src="${embedUrl}" width="${width}" height="${height}" style="border:0" loading="lazy" allowfullscreen title="${safeTitle}"></iframe>`;
}
