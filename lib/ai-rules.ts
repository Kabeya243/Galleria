// ---------------------------------------------------------------------------
// Rules-based "AI" for SANAA — Phase 5.
//
// Everything in this file is computed from the user's OWN data (their
// artworks, colours, dimensions, rooms and templates) with plain rules.
// No model call happens here, and nothing here invents facts: every
// suggestion carries the rule and the data it came from, so the UI can
// show its sourcing. Genuinely model-shaped work (free-text generation,
// open-ended advice) lives behind the provider boundary in
// lib/ai-providers.ts and is labelled as such in the UI.
// ---------------------------------------------------------------------------

export type AiArtworkLike = {
  id: string;
  title: string;
  artist?: string;
  year?: string;
  medium?: string;
  dimensions?: string;
  description?: string;
  color?: string;
  accent?: string;
  imageUrl?: string | null;
  frame?: string;
  roomId?: string;
  exhibitionId?: string;
  exhibitionTitle?: string;
};

export type RoomTemplateLike = {
  key: string;
  label: string;
  category: string;
  description: string;
  width: number;
  depth: number;
  height: number;
  wallColor: string;
  lightType: string;
};

// --- dimensions ------------------------------------------------------------

export type ParsedDimensions = { width: number; height: number; unit: string };

/** Parses "120x89 cm", "120 × 89", "100x70cm" and similar. Returns null when unparseable. */
export function parseDimensions(dimensions: string | undefined | null): ParsedDimensions | null {
  if (!dimensions) return null;
  const match = /(\d+(?:[.,]\d+)?)\s*[x×]\s*(\d+(?:[.,]\d+)?)\s*(cm|mm|in|")?/i.exec(dimensions);
  if (!match) return null;
  const width = Number(match[1].replace(",", "."));
  const height = Number(match[2].replace(",", "."));
  if (!width || !height) return null;
  return { width, height, unit: (match[3] ?? "cm").toLowerCase() };
}

export function dimensionAreaCm2(dimensions: string | undefined | null): number | null {
  const parsed = parseDimensions(dimensions);
  if (!parsed) return null;
  const factor = parsed.unit === "mm" ? 0.1 : parsed.unit === "in" || parsed.unit === '"' ? 2.54 : 1;
  return parsed.width * factor * parsed.height * factor;
}

export function sizeClass(dimensions: string | undefined | null): "small" | "medium" | "large" | "very large" | "unknown" {
  const area = dimensionAreaCm2(dimensions);
  if (area === null) return "unknown";
  if (area < 2500) return "small";
  if (area < 8000) return "medium";
  if (area < 15000) return "large";
  return "very large";
}

export const SIZE_CLASS_LABELS: Record<ReturnType<typeof sizeClass>, string> = {
  small: "Small (under ~50 × 50 cm)",
  medium: "Medium",
  large: "Large",
  "very large": "Very large",
  unknown: "Size unknown",
};

// --- colour helpers (small HSL math, same approach as Color Intelligence) ---

export type RGB = [number, number, number];

export function hexToRgb(hex: string): RGB | null {
  const match = /^#([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(hex.trim());
  if (!match) return null;
  return [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)];
}

export function rgbToHex(r: number, g: number, b: number): string {
  const part = (value: number) =>
    Math.round(Math.min(255, Math.max(0, value))).toString(16).padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = (gn - bn) / d + (gn < bn ? 6 : 0);
  else if (max === gn) h = (bn - rn) / d + 2;
  else h = (rn - gn) / d + 4;
  return [((h * 60) % 360 + 360) % 360, s, l];
}

export function hslToRgb(h: number, s: number, l: number): RGB {
  const hue = (((h % 360) + 360) % 360) / 360;
  const sat = Math.min(1, Math.max(0, s));
  const light = Math.min(1, Math.max(0, l));
  if (sat === 0) {
    const v = Math.round(light * 255);
    return [v, v, v];
  }
  const q = light < 0.5 ? light * (1 + sat) : light + sat - light * sat;
  const p = 2 * light - q;
  const channel = (t: number) => {
    let tt = t;
    if (tt < 0) tt += 1;
    if (tt > 1) tt -= 1;
    if (tt < 1 / 6) return p + (q - p) * 6 * tt;
    if (tt < 1 / 2) return q;
    if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6;
    return p;
  };
  return [
    Math.round(channel(hue + 1 / 3) * 255),
    Math.round(channel(hue) * 255),
    Math.round(channel(hue - 1 / 3) * 255),
  ];
}

export function relativeLuminance([r, g, b]: RGB): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Plain-language name for a hex colour, from hue + saturation + lightness. */
export function colourName(hex: string): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return "unknown colour";
  const [h, s, l] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  if (s < 0.08) {
    if (l < 0.12) return "black";
    if (l < 0.35) return "dark grey";
    if (l < 0.65) return "grey";
    if (l < 0.88) return "light grey";
    return "white";
  }
  if (l < 0.15) return "near-black";
  if (l > 0.88) return "pale";
  const hueName =
    h < 15 || h >= 345 ? "red"
    : h < 45 ? "orange"
    : h < 70 ? "yellow"
    : h < 160 ? "green"
    : h < 200 ? "teal"
    : h < 250 ? "blue"
    : h < 290 ? "purple"
    : h < 345 ? "pink"
    : "red";
  if (l < 0.3) return `deep ${hueName}`;
  if (s < 0.35) return `muted ${hueName}`;
  if (l > 0.75) return `pale ${hueName}`;
  return hueName;
}

/** Hue distance in degrees (0-180) between two hex colours. */
export function hueDistance(a: string, b: string): number | null {
  const ra = hexToRgb(a);
  const rb = hexToRgb(b);
  if (!ra || !rb) return null;
  const ha = rgbToHsl(ra[0], ra[1], ra[2])[0];
  const hb = rgbToHsl(rb[0], rb[1], rb[2])[0];
  const diff = Math.abs(ha - hb);
  return Math.min(diff, 360 - diff);
}

/** Wall colours drawn from a dominant colour: muted complement, deep tone, light neutral. */
export function wallColoursFrom(dominantHex: string): { name: string; hex: string; note: string }[] {
  const rgb = hexToRgb(dominantHex);
  if (!rgb) return [];
  const [h, s] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
  const muted = hslToRgb(h + 180, s * 0.35, 0.86);
  const deep = hslToRgb(h, Math.min(s, 0.45), 0.14);
  const neutral = hslToRgb(h, s * 0.14, 0.94);
  return [
    {
      name: "Muted complement",
      hex: rgbToHex(muted[0], muted[1], muted[2]),
      note: "Soft opposite of the dominant colour — the work stands out without fighting the wall.",
    },
    {
      name: "Deep tone",
      hex: rgbToHex(deep[0], deep[1], deep[2]),
      note: "A dark room pulled from the painting itself — bright colours glow against it.",
    },
    {
      name: "Light neutral",
      hex: rgbToHex(neutral[0], neutral[1], neutral[2]),
      note: "A near-white tinted with the painting's own hue — the classic gallery wall, warmed.",
    },
  ];
}

// --- tags ------------------------------------------------------------------

const TAG_STOPWORDS = new Set([
  "the", "and", "with", "from", "that", "this", "untitled", "sans", "titre", "work", "study",
  "series", "untitled", "of", "in", "on", "a", "an", "le", "la", "les", "de", "des", "du",
]);

const MEDIUM_TAGS: Record<string, string[]> = {
  charcoal: ["charcoal", "drawing", "black-and-white"],
  graphite: ["graphite", "drawing"],
  pastel: ["pastel", "drawing"],
  acrylic: ["acrylic", "painting"],
  oil: ["oil-painting", "painting"],
  collage: ["collage", "mixed-media"],
  "mixed media": ["mixed-media"],
  photography: ["photography"],
  print: ["print"],
  sculpture: ["sculpture"],
  textile: ["textile"],
  digital: ["digital"],
};

/** Rule-based tag suggestions from the artwork's own record + measured colours. Never invents subject matter. */
export function suggestTags(artwork: AiArtworkLike, dominantHexes: string[] = []): { tag: string; reason: string }[] {
  const out: { tag: string; reason: string }[] = [];
  const seen = new Set<string>();
  const add = (tag: string, reason: string) => {
    const clean = tag.toLowerCase().replace(/[^a-z0-9-]/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "");
    if (!clean || clean.length < 2 || seen.has(clean)) return;
    seen.add(clean);
    out.push({ tag: clean, reason });
  };

  const medium = (artwork.medium ?? "").toLowerCase();
  for (const [key, tags] of Object.entries(MEDIUM_TAGS)) {
    if (medium.includes(key)) tags.forEach((tag) => add(tag, `Medium: ${artwork.medium}`));
  }
  const cls = sizeClass(artwork.dimensions);
  if (cls === "large" || cls === "very large") add("large-scale", `Dimensions ${artwork.dimensions ?? ""}`);
  if (cls === "small") add("small-scale", `Dimensions ${artwork.dimensions ?? ""}`);
  if (artwork.year) {
    const yearNum = Number(artwork.year);
    if (Number.isFinite(yearNum)) add(`${Math.floor(yearNum / 10) * 10}s`, `Dated ${artwork.year}`);
  }
  for (const hex of dominantHexes.slice(0, 3)) {
    add(colourName(hex), `Dominant colour ${hex} measured from the image`);
  }
  const words = (artwork.title ?? "").toLowerCase().replace(/[^a-zà-ÿ0-9\s-]/g, " ").split(/\s+/);
  for (const word of words) {
    if (word.length > 3 && !TAG_STOPWORDS.has(word)) add(word, `From the title “${artwork.title}”`);
  }
  return out.slice(0, 12);
}

// --- description drafts (template-based, from the artwork's own data) ------

export function descriptionDraft(artwork: AiArtworkLike, dominantHexes: string[] = []): string {
  const parts: string[] = [];
  const title = artwork.title || "Untitled";
  const artist = artwork.artist?.trim();
  parts.push(`${title}${artist ? ` by ${artist}` : ""}${artwork.year ? ` (${artwork.year})` : ""}.`);
  if (artwork.medium) parts.push(`Made in ${artwork.medium.toLowerCase()}.`);
  if (artwork.dimensions) parts.push(`Measures ${artwork.dimensions}.`);
  if (dominantHexes.length > 0) {
    const names = [...new Set(dominantHexes.slice(0, 3).map(colourName))];
    parts.push(`Its dominant colours are ${names.join(", ")}.`);
  }
  return parts.join(" ");
}

export function accessibilityDraft(artwork: AiArtworkLike, dominantHexes: string[] = []): string {
  const title = artwork.title || "Untitled";
  const medium = artwork.medium ? ` in ${artwork.medium.toLowerCase()}` : "";
  const size = artwork.dimensions ? `, measuring ${artwork.dimensions}` : "";
  const colours =
    dominantHexes.length > 0
      ? ` The main colours are ${[...new Set(dominantHexes.slice(0, 3).map(colourName))].join(", ")}.`
      : "";
  return (
    `Artwork titled “${title}”${medium}${size}.${colours} ` +
    `The image itself is not described here — add one or two sentences about what the work shows ` +
    `(subject, composition, mood) so a listener can picture it.`
  );
}

// --- arrangement -----------------------------------------------------------

export type ArrangementGroup = {
  id: string;
  label: string;
  reason: string;
  artworkIds: string[];
};

export type ArrangementSuggestion = {
  sequence: string[];
  sequenceReason: string;
  groups: ArrangementGroup[];
  anchors: string[];
};

/**
 * Arrangement from real data only:
 * - sequence: largest first (anchor works), then by colour flow (hue steps)
 * - groups: works whose dominant colour hue is within 30° of each other
 * - anchors: the largest work in each group
 */
export function arrangementSuggestions(artworks: AiArtworkLike[]): ArrangementSuggestion {
  if (artworks.length === 0) return { sequence: [], sequenceReason: "", groups: [], anchors: [] };
  const withArea = artworks.map((a) => ({ a, area: dimensionAreaCm2(a.dimensions) ?? 0 }));
  const sorted = [...withArea].sort((x, y) => y.area - x.area);
  const sequence = sorted.map((x) => x.a.id);
  const sequenceReason =
    artworks.some((a) => parseDimensions(a.dimensions))
      ? "Largest works first — they anchor each wall, smaller works fill the rhythm between them."
      : "No dimensions recorded, so the order follows your list. Add dimensions to sort by size.";

  // Group by dominant colour hue (artwork.color is the recorded main colour).
  const groups: ArrangementGroup[] = [];
  const ungrouped = [...artworks];
  let groupIndex = 0;
  while (ungrouped.length > 0) {
    const seed = ungrouped.shift()!;
    const seedHex = seed.color ?? "#b8a184";
    const members = [seed];
    for (let i = ungrouped.length - 1; i >= 0; i--) {
      const candidate = ungrouped[i];
      const distance = hueDistance(seedHex, candidate.color ?? "#b8a184");
      if (distance !== null && distance <= 35) {
        members.push(candidate);
        ungrouped.splice(i, 1);
      }
    }
    groupIndex += 1;
    const anchor = [...members].sort(
      (x, y) => (dimensionAreaCm2(y.dimensions) ?? 0) - (dimensionAreaCm2(x.dimensions) ?? 0),
    )[0];
    groups.push({
      id: `group-${groupIndex}`,
      label:
        members.length > 1
          ? `${colourName(seedHex)} family — ${members.length} works`
          : `${seed.title} — stands alone`,
      reason:
        members.length > 1
          ? `These works share a ${colourName(seedHex)} dominant colour (hue within 35°), so they hang as one visual family.`
          : `Its dominant colour (${colourName(seedHex)}) sits apart from the others, so it holds a wall on its own.`,
      artworkIds: members.map((m) => m.id),
    });
    void anchor;
  }
  const anchors = groups.map((g) => {
    const members = g.artworkIds
      .map((id) => artworks.find((a) => a.id === id)!)
      .filter(Boolean);
    return [...members].sort(
      (x, y) => (dimensionAreaCm2(y.dimensions) ?? 0) - (dimensionAreaCm2(x.dimensions) ?? 0),
    )[0]?.id;
  }).filter(Boolean) as string[];
  return { sequence, sequenceReason, groups, anchors };
}

// --- template recommendations ----------------------------------------------

export type TemplateRecommendation = {
  key: string;
  label: string;
  category: string;
  score: number;
  reasons: string[];
};

/**
 * Matches the 40 gallery templates to the selected works:
 * - wall fit: the widest work (plus 1 m breathing room each side) must fit the room width
 * - count fit: enough wall length for every work at ~1.2 m each
 * - mood: dark rooms score higher when most works are dark
 */
export function recommendTemplates(
  templates: RoomTemplateLike[],
  artworks: AiArtworkLike[],
): TemplateRecommendation[] {
  if (artworks.length === 0) return [];
  const widths = artworks.map((a) => {
    const parsed = parseDimensions(a.dimensions);
    return parsed ? Math.max(parsed.width, parsed.height) / 100 : 1;
  });
  const widest = Math.max(...widths);
  const neededWall = artworks.length * 1.2 + 1;
  const darkWorks = artworks.filter((a) => {
    const rgb = hexToRgb(a.color ?? "");
    return rgb ? relativeLuminance(rgb) < 0.25 : false;
  }).length;
  const mostlyDark = darkWorks > artworks.length / 2;

  return templates
    .map((t) => {
      const reasons: string[] = [];
      let score = 0;
      if (t.width >= widest + 2) {
        score += 3;
        reasons.push(`Room is ${t.width} m wide — fits your widest work (${widest.toFixed(1)} m) with breathing room.`);
      } else if (t.width >= widest + 0.5) {
        score += 1;
        reasons.push(`Room is ${t.width} m wide — fits your widest work, tightly.`);
      } else {
        score -= 3;
        reasons.push(`Room is only ${t.width} m wide — your widest work (${widest.toFixed(1)} m) would dominate it.`);
      }
      const wallLength = t.width * 2 + t.depth;
      if (wallLength >= neededWall) {
        score += 2;
        reasons.push(`About ${wallLength.toFixed(0)} m of wall — room for all ${artworks.length} works at a comfortable spacing.`);
      } else {
        reasons.push(`About ${wallLength.toFixed(0)} m of wall — tight for ${artworks.length} works; consider two rooms.`);
      }
      const wallRgb = hexToRgb(t.wallColor);
      const wallDark = wallRgb ? relativeLuminance(wallRgb) < 0.25 : false;
      if (mostlyDark && wallDark) {
        score += 2;
        reasons.push("Dark walls suit your mostly dark works — the contrast makes them glow.");
      }
      if (!mostlyDark && !wallDark) {
        score += 1;
        reasons.push("Light walls suit your mostly light works.");
      }
      if (t.height >= 5 && widest >= 1.2) {
        score += 1;
        reasons.push(`${t.height} m ceilings give your large works headroom.`);
      }
      return { key: t.key, label: t.label, category: t.category, score, reasons };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
}

// --- lighting ----------------------------------------------------------------

export type LightingSuggestion = { title: string; detail: string };

export function lightingSuggestions(
  lightType: string,
  artworks: AiArtworkLike[],
  dominantHexes: string[] = [],
): LightingSuggestion[] {
  const out: LightingSuggestion[] = [];
  const darkCount = artworks.filter((a) => {
    const rgb = hexToRgb(a.color ?? "");
    return rgb ? relativeLuminance(rgb) < 0.25 : false;
  }).length;
  const mostlyDark = artworks.length > 0 && darkCount > artworks.length / 2;
  if (lightType === "spot-warm") {
    out.push({
      title: "Warm spots — keep them",
      detail:
        "The room already uses warm spotlights. Warm light flatters charcoal, wood frames and warm palettes; keep spots at roughly 30° to the wall so glare stays off the glass.",
    });
  } else if (lightType === "spot-cool") {
    out.push({
      title: "Cool spots — check the whites",
      detail:
        "Cool spots sharpen blues and whites but can make warm skin tones and wood frames look grey. If the work is warm, switch the room to warm spots.",
    });
  } else {
    out.push({
      title: "Soft ambient light — add spots for the anchors",
      detail:
        "Ambient light is even and gentle, but large or dark works lose presence without a focused beam. Add one warm spot per anchor work.",
    });
  }
  if (mostlyDark) {
    out.push({
      title: "Dark works need focused light",
      detail: `${darkCount} of ${artworks.length} selected works are dark. Light each one individually — a shared wash will flatten them into the wall.`,
    });
  }
  const hasGlossy = artworks.some((a) => /oil|acrylic|varnish|gloss/i.test(a.medium ?? ""));
  if (hasGlossy) {
    out.push({
      title: "Mind reflections on glossy surfaces",
      detail:
        "At least one work is oil or acrylic. Angle spots at 30° and keep visitors' sightlines off the direct reflection path.",
    });
  }
  const avgLight =
    dominantHexes.length > 0
      ? dominantHexes.reduce((sum, hex) => {
          const rgb = hexToRgb(hex);
          return sum + (rgb ? relativeLuminance(rgb) : 0.5);
        }, 0) / dominantHexes.length
      : null;
  if (avgLight !== null && avgLight > 0.6) {
    out.push({
      title: "Bright palette — dim slightly",
      detail:
        "The measured palette is very bright. Slightly lower intensity avoids washing the pale tones out against a white wall.",
    });
  }
  return out;
}

// --- concept draft -----------------------------------------------------------

export const CONCEPT_THEMES = [
  "Memory & identity",
  "Black pride",
  "Home & belonging",
  "Light & shadow",
  "The body",
  "Land & place",
  "Family",
  "Resistance",
] as const;

export type ConceptTheme = (typeof CONCEPT_THEMES)[number];

/** Template-based concept draft — assembled from the theme and the selected works, never from a model. */
export function conceptDraft(theme: string, artworks: AiArtworkLike[], templateLabel?: string): string {
  const count = artworks.length;
  const titles = artworks.slice(0, 4).map((a) => `“${a.title}”`).join(", ");
  const media = [...new Set(artworks.map((a) => (a.medium ?? "").toLowerCase()).filter(Boolean))];
  const mediumPhrase = media.length > 0 ? ` in ${media.slice(0, 3).join(", ")}` : "";
  const roomPhrase = templateLabel ? `, shown in the ${templateLabel} room` : "";
  const lines = [
    `${theme}: ${count} work${count === 1 ? "" : "s"}${mediumPhrase}${roomPhrase}.`,
    count > 0
      ? `The hang opens with ${titles}${count > 4 ? ` and ${count - 4} more` : ""} — each work carrying the theme in its own register.`
      : "Select works below and the draft will name them here.",
    "Edit this draft freely: add what the theme means to you, why these works belong together, and what you want a visitor to carry out of the room.",
  ];
  return lines.join("\n\n");
}

// --- installation checklist --------------------------------------------------

export type ChecklistItem = { label: string; detail: string; done: boolean };

export function installationChecklist(artworks: AiArtworkLike[], roomNames: string[]): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  const large = artworks.filter((a) => sizeClass(a.dimensions) === "large" || sizeClass(a.dimensions) === "very large");
  items.push({
    label: `Hang ${artworks.length} work${artworks.length === 1 ? "" : "s"}${roomNames.length > 0 ? ` across ${roomNames.join(", ")}` : ""}`,
    detail: "Centre each work at 145 cm eye level unless the hang says otherwise.",
    done: false,
  });
  if (large.length > 0) {
    items.push({
      label: `Two-person lift for ${large.length} large work${large.length === 1 ? "" : "s"}`,
      detail: large.map((a) => a.title).join(", "),
      done: false,
    });
  }
  const unframed = artworks.filter((a) => (a.frame ?? "wood") === "none");
  if (unframed.length > 0) {
    items.push({
      label: `Frame or mount ${unframed.length} unframed work${unframed.length === 1 ? "" : "s"}`,
      detail: unframed.map((a) => a.title).join(", "),
      done: false,
    });
  }
  const noDims = artworks.filter((a) => !parseDimensions(a.dimensions));
  if (noDims.length > 0) {
    items.push({
      label: `Measure ${noDims.length} work${noDims.length === 1 ? "" : "s"} with no dimensions recorded`,
      detail: noDims.map((a) => a.title).join(", "),
      done: false,
    });
  }
  items.push(
    { label: "Check lighting angles — 30° spots, no glare on glass", detail: "", done: false },
    { label: "Print and place wall labels", detail: "", done: false },
    { label: "Photograph the finished hang for the record", detail: "", done: false },
  );
  return items;
}

// --- frame suggestion ----------------------------------------------------------

export type FrameOptionLike = { key: string; label: string; color: string };

/** Rule-based frame suggestion from the work's medium, colours and size. */
export function suggestFrame(
  artwork: AiArtworkLike,
  dominantHexes: string[],
  frames: FrameOptionLike[],
): { key: string; label: string; reason: string } | null {
  const find = (key: string) => frames.find((f) => f.key === key) ?? null;
  const medium = (artwork.medium ?? "").toLowerCase();
  const isPaper = /paper|charcoal|graphite|pastel|collage|drawing/.test(medium);
  const dark = (() => {
    const rgb = hexToRgb(artwork.color ?? "");
    return rgb ? relativeLuminance(rgb) < 0.25 : false;
  })();
  const warm = (() => {
    if (dominantHexes.length === 0) return false;
    const rgb = hexToRgb(dominantHexes[0]);
    if (!rgb) return false;
    const [h, s] = rgbToHsl(rgb[0], rgb[1], rgb[2]);
    return s > 0.2 && ((h >= 0 && h < 60) || h >= 300);
  })();
  const cls = sizeClass(artwork.dimensions);

  if (isPaper) {
    const frame = find("archival") ?? find("black-cream") ?? find("black");
    if (frame)
      return {
        key: frame.key,
        label: frame.label,
        reason: "Work on paper — a conservation frame with a wide cream mat keeps the sheet safe and breathing.",
      };
  }
  if (dark) {
    const frame = find("white") ?? find("natural-wood");
    if (frame)
      return {
        key: frame.key,
        label: frame.label,
        reason: "A dark work — a light frame separates it from the wall instead of disappearing into it.",
      };
  }
  if (warm) {
    const frame = find("walnut") ?? find("wood");
    if (frame)
      return {
        key: frame.key,
        label: frame.label,
        reason: "Warm dominant colours — dark walnut picks up the warmth without competing.",
      };
  }
  if (cls === "very large" || cls === "large") {
    const frame = find("gold-museum") ?? find("black-box") ?? find("wood");
    if (frame)
      return {
        key: frame.key,
        label: frame.label,
        reason: "A large work — a wider, deeper frame holds its scale on the wall.",
      };
  }
  const fallback = find("black") ?? find("wood") ?? frames[0] ?? null;
  if (!fallback) return null;
  return {
    key: fallback.key,
    label: fallback.label,
    reason: "The gallery default — a thin matte frame that lets the work speak first.",
  };
}

// --- publish readiness ---------------------------------------------------------

export type ReadinessIssue = { label: string; detail: string };

export function publishReadiness(
  exhibitions: { id: string; title: string; status: string; artworkCount: number }[],
  artworks: AiArtworkLike[],
  savedKinds: string[],
): ReadinessIssue[] {
  const issues: ReadinessIssue[] = [];
  const drafts = exhibitions.filter((e) => e.status === "draft");
  const published = exhibitions.filter((e) => e.status === "published");
  if (exhibitions.length === 0) {
    issues.push({ label: "No exhibitions yet", detail: "Create your first exhibition in the editor." });
    return issues;
  }
  if (published.length === 0) {
    issues.push({
      label: `${drafts.length} draft${drafts.length === 1 ? "" : "s"}, none published`,
      detail: drafts.map((e) => e.title).join(", "),
    });
  }
  const empty = exhibitions.filter((e) => e.artworkCount === 0);
  for (const e of empty) {
    issues.push({ label: `“${e.title}” has no artworks`, detail: "Add works in the editor before publishing." });
  }
  const noImage = artworks.filter((a) => !a.imageUrl);
  if (noImage.length > 0) {
    issues.push({
      label: `${noImage.length} work${noImage.length === 1 ? "" : "s"} without an image`,
      detail: noImage.slice(0, 5).map((a) => a.title).join(", ") + (noImage.length > 5 ? ` and ${noImage.length - 5} more` : ""),
    });
  }
  const noDims = artworks.filter((a) => !a.dimensions);
  if (noDims.length > 0) {
    issues.push({
      label: `${noDims.length} work${noDims.length === 1 ? "" : "s"} without dimensions`,
      detail: "Dimensions feed the catalogue, the price calculator and the hang plan.",
    });
  }
  const noDescription = artworks.filter((a) => !(a.description ?? "").trim());
  if (noDescription.length > 0) {
    issues.push({
      label: `${noDescription.length} work${noDescription.length === 1 ? "" : "s"} without a description`,
      detail: "A short description helps visitors and buyers. Artwork Intelligence can draft one from your data.",
    });
  }
  if (!savedKinds.includes("ai-concept")) {
    issues.push({
      label: "No saved exhibition concept",
      detail: "Draft one in AI Exhibition Architect — it becomes the curatorial statement.",
    });
  }
  return issues;
}
