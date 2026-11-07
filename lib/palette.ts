// Colour palettes for artworks (ColorThief, MIT) + the colour math behind
// hanging harmony. Everything runs in the browser: no key, no server, no
// image ever leaves the machine. ColorThief 3.5 is async and takes an
// ImageBitmap / HTMLImageElement — for a File we decode it locally with
// createImageBitmap, for a URL we load it with crossOrigin="anonymous"
// (SANAA serves artwork images same-origin via /api/r2/…, so the canvas
// is never tainted). Any failure returns null; a missing palette never
// blocks an upload or a save — the editor retries it lazily on selection.
import type { FrameVariant } from "@/lib/demo-data";

export const PALETTE_COUNT = 5;
export const PALETTE_MAX = 8;

export type HueFamily =
  | "red"
  | "orange"
  | "yellow"
  | "olive"
  | "green"
  | "teal"
  | "blue"
  | "violet"
  | "pink"
  | "brown"
  | "black"
  | "white"
  | "grey";

export const HUE_FAMILY_LABELS: Record<HueFamily, string> = {
  red: "Red",
  orange: "Orange",
  yellow: "Yellow",
  olive: "Olive",
  green: "Green",
  teal: "Teal",
  blue: "Blue",
  violet: "Violet",
  pink: "Pink",
  brown: "Brown",
  black: "Black",
  white: "White",
  grey: "Grey",
};

// --- hex / rgb / hsl -------------------------------------------------------

export function isValidHex(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

export function rgbToHex(r: number, g: number, b: number): string {
  const part = (value: number) =>
    Math.round(Math.min(255, Math.max(0, value)))
      .toString(16)
      .padStart(2, "0");
  return `#${part(r)}${part(g)}${part(b)}`.toUpperCase();
}

export function hexToRgb(hex: string): [number, number, number] | null {
  if (!isValidHex(hex)) return null;
  const clean = hex.slice(1);
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

/** [hue 0–360, saturation 0–1, lightness 0–1], or null for a bad hex. */
export function hexToHsl(hex: string): [number, number, number] | null {
  const rgb = hexToRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((v) => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return [h * 60, s, l];
}

function mixHex(a: string, b: string, amountOfB: number): string {
  const rgbA = hexToRgb(a);
  const rgbB = hexToRgb(b);
  if (!rgbA || !rgbB) return "#F5F2EB";
  return rgbToHex(
    rgbA[0] + (rgbB[0] - rgbA[0]) * amountOfB,
    rgbA[1] + (rgbB[1] - rgbA[1]) * amountOfB,
    rgbA[2] + (rgbB[2] - rgbA[2]) * amountOfB,
  );
}

// --- stored palette (DB column is a JSON string, like rooms) --------------

/** Parse a stored palette: a JSON string from the DB, a string array from
 * the client, or null. Invalid entries are dropped, never thrown. */
export function parsePalette(value: unknown): string[] | null {
  let raw: unknown = value;
  if (typeof value === "string") {
    try {
      raw = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!Array.isArray(raw)) return null;
  const hexes = raw
    .filter((entry): entry is string => isValidHex(entry))
    .map((entry) => entry.toUpperCase())
    .slice(0, PALETTE_MAX);
  return hexes.length > 0 ? hexes : null;
}

/** The dominant colour of a palette is its first swatch (ColorThief
 * orders by prominence). */
export function dominantHex(palette: string[] | null | undefined): string | null {
  if (!palette || palette.length === 0) return null;
  return palette[0];
}

// --- extraction ------------------------------------------------------------

/** Extract a palette from an artwork image: a File (decoded locally) or
 * a same-origin image URL. Returns null on any failure. */
export async function extractPalette(
  source: File | string,
  count: number = PALETTE_COUNT,
): Promise<string[] | null> {
  try {
    const { getPalette } = await import("colorthief");
    let image: ImageBitmap | HTMLImageElement | null = null;
    try {
      if (source instanceof File) {
        image = await createImageBitmap(source);
      } else {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.src = source;
        await img.decode();
        image = img;
      }
      const palette = await getPalette(image, {
        colorCount: Math.min(20, Math.max(2, count)),
      });
      if (!palette || palette.length === 0) return null;
      return palette.map((color) => color.hex().toUpperCase());
    } finally {
      if (image instanceof ImageBitmap) image.close();
    }
  } catch {
    return null;
  }
}

// --- hue families & harmony ------------------------------------------------

export function hueFamilyOf(hex: string): HueFamily {
  const hsl = hexToHsl(hex);
  if (!hsl) return "grey";
  const [h, s, l] = hsl;
  // Near-white and near-black read as white/black whatever their faint
  // tint (a warm off-white like #F5F2EB still has HSL saturation ~0.3).
  if (l > 0.92) return "white";
  if (l < 0.12) return "black";
  if (s < 0.08) return "grey";
  if (h < 12 || h >= 348) return "red";
  if (h < 38) return l < 0.4 && s > 0.15 ? "brown" : "orange";
  if (h < 65) return "yellow";
  if (h < 85) return "olive";
  if (h < 150) return "green";
  if (h < 175) return "teal";
  if (h < 245) return "blue";
  if (h < 285) return "violet";
  if (h < 330) return "pink";
  return "red";
}

/** Warm = reds, oranges, yellows, pinks (and browns); everything else
 * reads cool. Neutrals are neither. */
export function isWarmHex(hex: string): boolean {
  const hsl = hexToHsl(hex);
  if (!hsl) return false;
  const [h, s] = hsl;
  if (s < 0.15) return false;
  return h < 65 || h >= 300;
}

function hueDistance(aHex: string, bHex: string): number | null {
  const a = hexToHsl(aHex);
  const b = hexToHsl(bHex);
  if (!a || !b) return null;
  // A neutral has no hue to compare: low saturation, or so light/dark
  // that it reads as white/black whatever its faint tint.
  if (a[1] < 0.15 || b[1] < 0.15 || a[2] > 0.92 || b[2] > 0.92 || a[2] < 0.12 || b[2] < 0.12) return null;
  const diff = Math.abs(a[0] - b[0]) % 360;
  return diff > 180 ? 360 - diff : diff;
}

export type Harmony = "same" | "analogous" | "complementary" | "clash" | "neutral";

export function harmonyOf(aHex: string, bHex: string): Harmony {
  const distance = hueDistance(aHex, bHex);
  if (distance === null) return "neutral";
  if (distance < 25) return "same";
  if (distance <= 60) return "analogous";
  if (distance >= 150 && distance <= 210) return "complementary";
  return "clash";
}

export const HARMONY_LABELS: Record<Harmony, string> = {
  same: "Same family",
  analogous: "Analogous",
  complementary: "Complementary",
  clash: "Clashing",
  neutral: "Neutral",
};

/** Ranking for "goes well with": analogous and complementary first,
 * same family next, clashing and neutral last. */
export function harmonyScore(aHex: string, bHex: string): number {
  const harmony = harmonyOf(aHex, bHex);
  if (harmony === "analogous" || harmony === "complementary") return 2;
  if (harmony === "same") return 1;
  return 0;
}

// --- suggestions (never imposed — the curator always decides) -------------

/** A wall colour that lets the work breathe: a pale tint of its own
 * dominant colour for chromatic works, a light warm grey for very dark
 * or neutral ones, a slightly deeper grey when the work is very pale
 * (so it does not wash out). */
export function suggestedWallColor(dominant: string): { hex: string; reason: string } {
  const hsl = hexToHsl(dominant);
  if (!hsl) return { hex: "#F5F2EB", reason: "A warm off-white keeps any work calm." };
  const [, s, l] = hsl;
  if (l < 0.15) return { hex: "#ECE7DE", reason: "A light wall lets a very dark work breathe." };
  if (s < 0.12) return { hex: "#F5F2EB", reason: "A warm off-white keeps a neutral work calm." };
  if (l > 0.85) return { hex: "#E3DDD4", reason: "A slightly deeper wall keeps a pale work from washing out." };
  return {
    hex: mixHex(dominant, "#FFFFFF", 0.88),
    reason: "A pale tint of the work's own dominant colour ties the wall to the painting.",
  };
}

/** A frame finish that suits the dominant colour. Only built-in variants
 * are suggested; custom Frame Studio configurations are untouched. */
export function suggestedFrameVariant(dominant: string): { variant: FrameVariant; reason: string } {
  const hsl = hexToHsl(dominant);
  if (!hsl) return { variant: "wood", reason: "Warm wood suits most works." };
  const [h, s, l] = hsl;
  if (l < 0.2) return { variant: "white", reason: "A pale frame lifts a very dark work off the wall." };
  if (l > 0.8) return { variant: "black", reason: "A dark frame anchors a very pale work." };
  if (h >= 35 && h <= 55 && s > 0.45) return { variant: "gold", reason: "The work's golden tones suit a gold frame." };
  if (h >= 15 && h <= 45 && s > 0.25) return { variant: "wood-box", reason: "Warm wood echoes the work's warm tones." };
  if (h >= 180 && h <= 260) return { variant: "black", reason: "A black frame suits a cool work." };
  return { variant: "wood", reason: "Warm wood suits most works." };
}
