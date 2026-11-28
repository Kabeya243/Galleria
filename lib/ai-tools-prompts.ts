// Prompt builders for the five Lakisa AI tools (Phase 5).
//
// These are the ONLY prompts the tools send. They are built here, on the
// client, from the artwork/exhibition data the user already entered, and
// sent to /api/ai/generate (which adds the model call server-side).
// Every prompt asks for the same voice, because that is Kabeya's rule:
//
//   * simple, plain, human words; short sentences
//   * no art jargon, no AI-sounding phrases ("delve", "tapestry",
//     "captivating", "masterpiece", "testament", "profound")
//   * never the em dash character — commas or periods instead
//   * valid JSON only when a JSON reply is asked for, no other text,
//     no markdown fences
//
// Every generation is on demand (the user clicks a button), and the
// result is always shown for review and editing before anything is
// saved. Nothing here is automatic and nothing invents facts: the
// prompts only use the data the artist provided, and the price tool is
// told not to invent sales data.

export type AiToolLanguage = string;

/** Parse a model reply that was asked to be JSON only. Strips markdown
 * fences if the model added them anyway; returns null when unparseable,
 * so the UI can show the raw text or a clear error instead of crashing. */
export function parseAiJson<T>(text: string): T | null {
  const cleaned = text
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    return null;
  }
}

const STYLE_RULES = [
  "Write in simple, plain, human words. Short sentences.",
  "No art jargon and no AI-sounding phrases. Do not use words like 'delve', 'tapestry', 'captivating', 'masterpiece', 'testament' or 'profound'.",
  "Never use the em dash character. Use commas or periods instead.",
].join(" ");

const SYSTEM_BASE =
  "You are a helpful writing assistant for visual artists. " +
  STYLE_RULES +
  " When a JSON reply is asked for, reply with valid JSON only, no other text, no markdown fences.";

function languageLine(language: AiToolLanguage): string {
  return `Write in ${language}.`;
}

export type ArtworkTextsInput = {
  title: string;
  medium: string;
  year: string;
  dimensions?: string;
  language?: AiToolLanguage;
};

/** Tool 1 — artwork texts. The photo goes through imageUrl; this prompt
 * describes the work the artist entered. */
export function buildArtworkTextsPrompt(input: ArtworkTextsInput): { system: string; prompt: string } {
  const language = input.language ?? "English";
  const facts = [
    `Title: ${input.title || "(untitled)"}`,
    `Medium: ${input.medium || "(not given)"}`,
    `Year: ${input.year || "(not given)"}`,
    ...(input.dimensions ? [`Dimensions: ${input.dimensions}`] : []),
  ].join("\n");
  return {
    system: SYSTEM_BASE,
    prompt:
      `Look at the artwork in the photo and write about it, using only what you can see in the photo and these facts:\n${facts}\n\n` +
      `${languageLine(language)}\n\n` +
      `Reply with JSON only: {"description": "2 to 3 sentences about what the work shows", ` +
      `"artistStatement": "2 to 3 sentences in the first person, as the artist, about what this work means", ` +
      `"curatorialText": "2 to 3 sentences for a gallery wall, placing the work in context"}. ` +
      `Do not invent a backstory, a place, or a meaning you cannot see. If something is unclear, say so plainly in the text.`,
  };
}

export type PriceSuggestionInput = {
  medium: string;
  widthCm: number;
  heightCm: number;
  year: string;
  costLow: number;
  costRecommended: number;
  costHigh: number;
  existingPrices: number[];
  language?: AiToolLanguage;
};

/** Tool 2 — price suggestion. The cost-based range is the anchor; the
 * artist's own listing prices (when they have any) are the market the
 * model may use. It must not invent sales data. */
export function buildPriceSuggestionPrompt(input: PriceSuggestionInput): {
  system: string;
  prompt: string;
} {
  const language = input.language ?? "English";
  const existing =
    input.existingPrices.length > 0
      ? `The artist's own listed prices for other works (USD): ${input.existingPrices.join(", ")}.`
      : "The artist has no other works listed with a price yet.";
  return {
    system: SYSTEM_BASE,
    prompt:
      `Suggest a selling price range in USD for this artwork.\n` +
      `Medium: ${input.medium}. Size: ${input.widthCm} x ${input.heightCm} cm. Year: ${input.year || "(not given)"}.\n` +
      `The artist's cost-based range for this work is $${Math.round(input.costLow)} to $${Math.round(input.costHigh)}, recommended $${Math.round(input.costRecommended)} (cost doubled, so a gallery share still leaves the cost covered).\n` +
      `${existing}\n\n` +
      `Give a sensible range that sits near the cost-based range and the artist's own prices. Do not invent sales, collectors, or market data. ` +
      `${languageLine(language)}\n\n` +
      `Reply with JSON only: {"low": 0, "recommended": 0, "high": 0, "justification": "one or two short sentences explaining the range in plain words"}. ` +
      `All three numbers are whole USD amounts, low < recommended < high.`,
  };
}

export type HangArtworkInput = {
  id: string;
  title: string;
  medium: string;
  dimensions: string;
  dominantHue?: string | null;
  description?: string;
};

export type HangSuggestionInput = {
  artworks: HangArtworkInput[];
  language?: AiToolLanguage;
};

/** Tool 3 — auto-hang. Groups the works and orders them for a wall.
 * The wall itself is placed by the existing compose-wall packer; this
 * only decides the grouping and the order. */
export function buildHangSuggestionPrompt(input: HangSuggestionInput): { system: string; prompt: string } {
  const language = input.language ?? "English";
  const lines = input.artworks
    .map(
      (a) =>
        `- id ${a.id}: "${a.title}" (${a.medium}, ${a.dimensions}` +
        `${a.dominantHue ? `, dominant colour ${a.dominantHue}` : ""}` +
        `${a.description ? `, ${a.description}` : ""})`,
    )
    .join("\n");
  return {
    system: SYSTEM_BASE,
    prompt:
      `You are hanging these artworks on one gallery wall. Group them and order them.\n${lines}\n\n` +
      `Group the works by colour, theme, or size, two to four groups. Then give one wall order: the strongest or largest work first as the anchor, then the works that sit well next to it, alternating sizes and colours so no two neighbours look the same. ` +
      `Use only the artwork ids given above, each id once. ${languageLine(language)}\n\n` +
      `Reply with JSON only: {"groups": [{"name": "short group name", "artworkIds": ["id"], "note": "one short sentence saying why these works go together"}], "order": ["id", "id"]}.`,
  };
}

export type TagsInput = {
  title: string;
  medium: string;
  year: string;
  language?: AiToolLanguage;
};

/** Tool 4 — tags. The photo goes through imageUrl; this prompt reads
 * the work the artist entered. */
export function buildTagsPrompt(input: TagsInput): { system: string; prompt: string } {
  const language = input.language ?? "English";
  return {
    system: SYSTEM_BASE,
    prompt:
      `Look at the artwork in the photo and suggest tags for it, so visitors can find it by search.\n` +
      `Title: ${input.title || "(untitled)"}. Medium: ${input.medium || "(not given)"}. Year: ${input.year || "(not given)"}.\n\n` +
      `Suggest up to 12 tags, lowercase, single words or short phrases, covering medium, style, colours, subject, and mood. ` +
      `Use only what you can see in the photo and the facts above. Do not invent a subject that is not there. ` +
      `${languageLine(language)}\n\n` +
      `Reply with JSON only: {"tags": ["tag", "tag"]}.`,
  };
}

export type SocialInput = {
  kind: "exhibition" | "artwork";
  title: string;
  artist?: string;
  description?: string;
  medium?: string;
  year?: string;
  venue?: string;
  dates?: string;
  language?: AiToolLanguage;
};

/** Tool 5 — social and magazine. One call returns the Instagram
 * caption, the press paragraph, and the open-call announcement. */
export function buildSocialPrompt(input: SocialInput): { system: string; prompt: string } {
  const language = input.language ?? "English";
  const facts = [
    `Type: ${input.kind}`,
    `Title: ${input.title}`,
    ...(input.artist ? [`Artist: ${input.artist}`] : []),
    ...(input.description ? [`About: ${input.description}`] : []),
    ...(input.medium ? [`Medium: ${input.medium}`] : []),
    ...(input.year ? [`Year: ${input.year}`] : []),
    ...(input.venue ? [`Venue: ${input.venue}`] : []),
    ...(input.dates ? [`Dates: ${input.dates}`] : []),
  ].join("\n");
  return {
    system: SYSTEM_BASE,
    prompt:
      `Write three short pieces about this ${input.kind}, using only these facts:\n${facts}\n\n` +
      `${languageLine(language)}\n\n` +
      `Reply with JSON only: {"instagramCaption": "a short caption, warm and plain, with three to five hashtags at the end", ` +
      `"pressParagraph": "three to four sentences for a press release, plain and factual", ` +
      `"openCallAnnouncement": "two to three sentences inviting artists to apply to an open call for a show like this one"}. ` +
      `Do not invent dates, places, or quotes.`,
  };
}
