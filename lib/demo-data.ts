export type Artwork = {
  id: string;
  title: string;
  artist?: string;
  year: string;
  medium: string;
  dimensions: string;
  description: string;
  color: string;
  accent: string;
  position: [number, number, number];
  rotation: number;
  scale: number;
  imageUrl?: string | null;
  // Video artwork (Nov 2026): same-origin serving URL
  // (/api/video/videos/<userId>/<uuid>.mp4). When set, the wall renders
  // a VideoTexture from it instead of the image; `imageUrl`, when also
  // set, is only the fallback poster. Null/absent for image artworks.
  videoUrl?: string | null;
  roomId: string;
  // Colour palette extracted from the artwork image (ColorThief, in the
  // browser, at upload/replace time): up to 8 hex colours, dominant
  // first. Null until extracted — the editor computes it lazily when an
  // artwork with an image is selected.
  palette?: string[] | null;
  // Alt-text for the artwork image (BLIP in the browser, or Gemini via
  // /api/describe when configured): a one-sentence description in
  // English, proposed at upload time and validated or corrected by the
  // artist before saving. Null until generated or written.
  altText?: string | null;
  // Curatorial wall text (the reference room's "Texte curatorial"):
  // when set, the artwork renders as a canvas text panel instead of an
  // image, in the chosen typeface ("d" Bold display, "s" Clean sans,
  // "g" Serif, "m" Typewriter — see lib/sunlight-elements.ts).
  // Null/absent for ordinary artworks.
  text?: string | null;
  textFont?: string | null;
  // Frame around the artwork in the 3D room ("wood" when absent). Either
  // a built-in variant key from FRAME_VARIANTS, or a custom Frame Studio
  // configuration encoded as "custom:<base64url JSON>" (see
  // encodeFrameConfig / resolveFrameSpec below). The encoded form is a
  // plain string, so it survives the existing `frame` column, the
  // exhibition save API and the public exhibition unchanged.
  frame?: string;
};

// Frame finishes for artworks in the 3D room. Each style carries its
// profile, so the 3D render matches the real frame it was digitized
// from: border width and depth in metres, how far the artwork sits
// recessed behind the front face, the extra opening around a floated
// work (shadow boxes), the procedural texture kind, a beaded inner edge,
// and an optional mat / thin gold trim between frame and artwork.
// The first six are the original flat frames; the rest are digitized
// from Kabeya's reference photos (Nov 2026) or built-in Frame Studio
// styles (natural woods, metals, float and box frames, acrylic, wrap).
export type FrameTextureKind = "plain" | "wood" | "oak" | "walnut" | "mahogany" | "gold-brushed" | "gold-carved" | "yellow-gloss" | "black-gloss" | "black-matte" | "silver-brushed" | "aluminium-brushed" | "acrylic";
export type FrameMatKind = "velvet" | "paper" | "yellow";
// Edge profile of the frame bar: flat is a plain box; stepped drops a
// step down toward the artwork; rounded softens the inner front edge;
// bevelled cuts a 45° chamfer; scooped carves a dark channel.
export type FrameProfile = "flat" | "stepped" | "rounded" | "bevelled" | "scooped";
// Repeated 3D ornaments along the frame's bars: "rosettes" is a row of
// small carved rosettes; "carved" alternates rosettes and scrolls, the
// dense baroque carving. The ornaments are real instanced geometry, not
// a drawing — the drawn carving is gone.
export type FrameOrnament = "none" | "rosettes" | "carved";
export type FrameFinish = "matte" | "satin" | "gloss";
export type FrameGlass = "none" | "clear" | "non-reflective" | "museum";
export type FrameMaterial = "wood" | "metal" | "gold" | "silver" | "acrylic" | "plain";
export const FRAME_PROFILE_LABELS: Record<FrameProfile, string> = {
  flat: "Flat",
  stepped: "Stepped",
  rounded: "Rounded",
  bevelled: "Bevelled",
  scooped: "Scooped",
};
export const FRAME_FINISH_LABELS: Record<FrameFinish, string> = {
  matte: "Matte",
  satin: "Satin",
  gloss: "Gloss",
};
export const FRAME_GLASS_LABELS: Record<FrameGlass, string> = {
  none: "No glass",
  clear: "Clear glass",
  "non-reflective": "Non-reflective glass",
  museum: "Museum glass",
};
export const FRAME_MATERIAL_LABELS: Record<FrameMaterial, string> = {
  wood: "Wood",
  metal: "Metal",
  gold: "Gold",
  silver: "Silver",
  acrylic: "Acrylic",
  plain: "Painted",
};
export type FrameSpec = {
  label: string;
  color: string;
  metalness: number;
  roughness: number;
  // Border width and total depth of the frame, in metres.
  width: number;
  depth: number;
  // How far behind the front face the artwork sits (shadow boxes).
  recess: number;
  // Extra opening around the artwork: the work floats in the middle of
  // the tray instead of filling the frame (shadow boxes).
  floatGap: number;
  texture: FrameTextureKind;
  bead: boolean;
  // Real photo strip of the frame's moulding ("/frames/<id>.png"): the
  // front-face skin for the nine digitised frames. Only the built-ins
  // carry one; Frame Studio customs do not.
  photo?: string;
  // Edge profile of the bar (flat by default) and wood-grain strength
  // (0–1, wood textures only). Glass over the artwork, if any.
  profile?: FrameProfile;
  grain?: number;
  glass?: FrameGlass;
  // Repeated 3D ornaments along the bars (see FrameOrnament), and the
  // spacing between them in metres (default 0.16).
  ornament?: FrameOrnament;
  ornamentSpacing?: number;
  // Acrylic frames are see-through: the bars render semi-transparent.
  opacity?: number;
  // Mat between frame and artwork (a real border the artwork sits on).
  mat?: { color: string; width: number; texture: FrameMatKind };
  // Thin gold ring: around the artwork, between frame and mat, or both.
  trim?: { color: string; width: number; at: "artwork" | "mat" | "both" };
  // Back-panel colour inside the tray (shadow boxes): the dark wood or
  // black the floated work hangs against.
  trayColor?: string;
};
const flat = (spec: Omit<FrameSpec, "width" | "depth" | "recess" | "floatGap" | "texture" | "bead"> & Partial<Pick<FrameSpec, "width" | "depth" | "recess" | "floatGap" | "texture" | "bead">>): FrameSpec => ({
  width: 0.1,
  depth: 0.12,
  recess: 0,
  floatGap: 0,
  texture: "plain",
  bead: false,
  ...spec,
});
export const FRAME_VARIANTS = {
  none: flat({ label: "No frame", color: "#000000", metalness: 0, roughness: 1, width: 0, depth: 0 }),
  wood: flat({ label: "Wood", color: "#9c7c54", metalness: 0, roughness: 0.75, texture: "wood", photo: "/frames/wood-box.png" }),
  metal: flat({ label: "Metal", color: "#9a9a98", metalness: 0.85, roughness: 0.35 }),
  gold: flat({ label: "Gold", color: "#a67c37", metalness: 0.9, roughness: 0.3, texture: "gold-brushed" }),
  black: flat({ label: "Black", color: "#141414", metalness: 0.1, roughness: 0.6, texture: "black-matte" }),
  white: flat({ label: "White", color: "#f5f2eb", metalness: 0, roughness: 0.8 }),
  // Wood shadow box (photo-65): warm medium-brown natural wood, visible
  // grain, deep tray, artwork floated and recessed inside.
  "wood-box": flat({ label: "Wood shadow box", color: "#8a6242", metalness: 0, roughness: 0.7, width: 0.07, depth: 0.18, recess: 0.1, floatGap: 0.08, texture: "wood", trayColor: "#6b4a30", profile: "stepped", photo: "/frames/wood-box.png" }),
  // Gold ornate + red velvet (photo_1-16): bright gold frame, fine beaded
  // inner edge, wide deep-red velvet mat, thin gold frame around the work.
  "gold-velvet": flat({ label: "Gold ornate · red velvet", color: "#c9a227", metalness: 0.85, roughness: 0.35, width: 0.09, depth: 0.12, texture: "gold-brushed", bead: true, mat: { color: "#6e0f1a", width: 0.14, texture: "velvet" }, trim: { color: "#d4af37", width: 0.015, at: "artwork" }, profile: "stepped", ornament: "rosettes", ornamentSpacing: 0.22, photo: "/frames/gold-velvet.png" }),
  // Gold classic (photo_2-8): warm gold, smooth stepped profile, beaded
  // inner line, medium width, elegant.
  "gold-classic": flat({ label: "Gold classic", color: "#b08d3e", metalness: 0.85, roughness: 0.35, width: 0.09, depth: 0.12, texture: "gold-brushed", bead: true, profile: "stepped", photo: "/frames/gold-classic.png" }),
  // Gold baroque carved (photo_3-5): heavily carved floral/scroll relief,
  // wide, antique gold with dark recesses.
  "gold-baroque": flat({ label: "Gold baroque", color: "#a67c37", metalness: 0.8, roughness: 0.45, width: 0.16, depth: 0.13, texture: "gold-carved", profile: "stepped", ornament: "carved", ornamentSpacing: 0.15, photo: "/frames/gold-baroque.png" }),
  // Yellow lacquer (photo_4-4): vivid yellow, wide flat smooth profile,
  // high gloss; the work floats small on a wide yellow field.
  "yellow-lacquer": flat({ label: "Yellow lacquer", color: "#f5c400", metalness: 0.05, roughness: 0.15, width: 0.06, depth: 0.14, recess: 0.04, texture: "yellow-gloss", mat: { color: "#f5c400", width: 0.25, texture: "yellow" }, profile: "bevelled", photo: "/frames/yellow-lacquer.png" }),
  // Black + gold + cream mat (photo_5-4, lower frame): wide glossy black
  // frame, thin gold trim, wide cream passe-partout, thin gold frame
  // around the artwork.
  "black-gold-cream": flat({ label: "Black + gold · cream mat", color: "#141414", metalness: 0.2, roughness: 0.35, width: 0.11, depth: 0.12, texture: "black-gloss", mat: { color: "#f2ead8", width: 0.16, texture: "paper" }, trim: { color: "#c9a227", width: 0.02, at: "both" }, profile: "stepped", photo: "/frames/black-gold-cream.png" }),
  // Black + cream mat (photo_5-4, upper frame): thin black frame, wide
  // cream mat, no gold.
  "black-cream": flat({ label: "Black · cream mat", color: "#1a1a1a", metalness: 0.1, roughness: 0.6, width: 0.035, depth: 0.1, texture: "black-matte", mat: { color: "#f2ead8", width: 0.16, texture: "paper" }, profile: "bevelled", photo: "/frames/black-cream.png" }),
  // Gold museum wide (photo_6-3): very wide ornate gold museum frame,
  // beaded inner edge, warm gold, grand.
  "gold-museum": flat({ label: "Gold museum", color: "#c19a3d", metalness: 0.85, roughness: 0.3, width: 0.2, depth: 0.13, texture: "gold-brushed", bead: true, profile: "stepped", ornament: "rosettes", ornamentSpacing: 0.2, photo: "/frames/gold-museum.png" }),
  // Black shadow box (photo_7-2): deep matte black tray, wide, artwork
  // floated inside with a visible gap.
  "black-box": flat({ label: "Black shadow box", color: "#1c1c1c", metalness: 0.05, roughness: 0.9, width: 0.08, depth: 0.2, recess: 0.12, floatGap: 0.1, texture: "black-matte", trayColor: "#111111", profile: "bevelled", photo: "/frames/black-box.png" }),
  // --- Frame Studio built-ins (Nov 2026) ---
  // Natural wood: pale, barely stained, fine grain, slim.
  "natural-wood": flat({ label: "Natural wood", color: "#c2a878", metalness: 0, roughness: 0.8, width: 0.06, depth: 0.1, texture: "oak", grain: 0.35 }),
  // Oak: pale honey oak, fine straight grain, medium width.
  oak: flat({ label: "Oak", color: "#c8a06a", metalness: 0, roughness: 0.75, width: 0.08, depth: 0.11, texture: "oak", grain: 0.35 }),
  // Walnut: dark chocolate walnut, strong grain, wide.
  walnut: flat({ label: "Walnut", color: "#4a3226", metalness: 0, roughness: 0.7, width: 0.09, depth: 0.12, texture: "walnut", grain: 0.8 }),
  // Mahogany: deep reddish-brown, warm, medium width.
  mahogany: flat({ label: "Mahogany", color: "#6e2f24", metalness: 0, roughness: 0.65, width: 0.09, depth: 0.12, texture: "mahogany", grain: 0.6 }),
  // Silver: brushed silver, cool and bright, slim.
  silver: flat({ label: "Silver", color: "#c8c8c8", metalness: 0.9, roughness: 0.3, width: 0.05, depth: 0.1, texture: "silver-brushed" }),
  // Brushed aluminium: cooler and duller than silver, very slim.
  aluminium: flat({ label: "Brushed aluminium", color: "#9aa0a3", metalness: 0.85, roughness: 0.45, width: 0.04, depth: 0.1, texture: "aluminium-brushed" }),
  // Floating frame: thin black frame, the work floats on a white
  // backing with a visible gap all round.
  floating: flat({ label: "Floating frame", color: "#1a1a1a", metalness: 0.05, roughness: 0.9, width: 0.03, depth: 0.12, recess: 0.02, floatGap: 0.07, texture: "black-matte", trayColor: "#f5f2eb" }),
  // Shadow-gap frame: the work sits deep in a black tray with a dark
  // shadow line between frame and artwork.
  "shadow-gap": flat({ label: "Shadow-gap frame", color: "#141414", metalness: 0.05, roughness: 0.9, width: 0.06, depth: 0.16, recess: 0.08, floatGap: 0.05, texture: "black-matte", trayColor: "#0d0d0d" }),
  // Deep-box frame: a very deep natural-wood tray, the work floated
  // far inside — for thick or sculptural pieces.
  "deep-box": flat({ label: "Deep-box frame", color: "#7a5236", metalness: 0, roughness: 0.7, width: 0.08, depth: 0.28, recess: 0.18, floatGap: 0.12, texture: "wood", grain: 0.6, trayColor: "#5d3d26" }),
  // Ornamental classical: wide carved gold with a cream mat and a thin
  // gold ring around the artwork — the grand salon look.
  ornamental: flat({ label: "Ornamental classical", color: "#b08d3e", metalness: 0.85, roughness: 0.4, width: 0.18, depth: 0.14, texture: "gold-carved", bead: true, mat: { color: "#f2ead8", width: 0.12, texture: "paper" }, trim: { color: "#d4af37", width: 0.015, at: "artwork" }, profile: "stepped", ornament: "carved", ornamentSpacing: 0.16 }),
  // Archival frame: thin black frame, very wide cream museum board —
  // the conservation framing for works on paper.
  archival: flat({ label: "Archival frame", color: "#1a1a1a", metalness: 0.1, roughness: 0.6, width: 0.03, depth: 0.09, texture: "black-matte", mat: { color: "#f2ead8", width: 0.2, texture: "paper" } }),
  // Acrylic presentation: clear acrylic bars, the work presented
  // almost frameless behind a transparent edge.
  acrylic: flat({ label: "Acrylic presentation", color: "#e8e8e8", metalness: 0, roughness: 0.1, width: 0.04, depth: 0.08, texture: "acrylic", opacity: 0.4 }),
  // Canvas wrap: no visible frame — a slim stretcher edge, the image
  // carried around the sides.
  "canvas-wrap": flat({ label: "Canvas wrap", color: "#2a2a2a", metalness: 0, roughness: 0.85, width: 0.015, depth: 0.06, texture: "plain" }),
};

export type FrameVariant = keyof typeof FRAME_VARIANTS;

// A custom Frame Studio configuration: a built-in base style plus every
// control the inspector offers. Stored on the artwork as an encoded
// frame value (see below) and as saved-work data for named presets.
export type FrameConfig = {
  base: FrameVariant;
  // Outer border width and total depth, in metres.
  width: number;
  depth: number;
  // How far behind the front face the artwork sits, and the gap the
  // work floats in inside the frame, in metres.
  recess: number;
  floatGap: number;
  color: string;
  material: FrameMaterial;
  finish: FrameFinish;
  // Wood-grain strength, 0–1 (wood materials only).
  grain: number;
  profile: FrameProfile;
  // Thin inner border ring around the artwork, in metres (0 = none).
  innerBorder: number;
  // Matboard between frame and artwork, in metres (0 = none).
  matWidth: number;
  matColor: string;
  glass: FrameGlass;
};

export const DEFAULT_FRAME_CONFIG: FrameConfig = {
  base: "wood",
  width: 0.1,
  depth: 0.12,
  recess: 0,
  floatGap: 0,
  color: "#9c7c54",
  material: "wood",
  finish: "satin",
  grain: 0.6,
  profile: "flat",
  innerBorder: 0,
  matWidth: 0,
  matColor: "#f2ead8",
  glass: "none",
};

// Built-in Frame Studio presets: one click applies a complete custom
// configuration to the selected artwork.
export const FRAME_PRESETS: { name: string; description: string; config: FrameConfig }[] = [
  {
    name: "Gallery standard",
    description: "Thin matte black, no mat — the white-cube default.",
    config: { ...DEFAULT_FRAME_CONFIG, base: "black", width: 0.05, depth: 0.1, color: "#141414", material: "plain", finish: "matte", grain: 0 },
  },
  {
    name: "Museum classic",
    description: "Warm gold, stepped edge, cream mat, museum glass.",
    config: { ...DEFAULT_FRAME_CONFIG, base: "gold-classic", width: 0.09, depth: 0.12, color: "#b08d3e", material: "gold", finish: "satin", grain: 0, profile: "stepped", innerBorder: 0.01, matWidth: 0.12, matColor: "#f2ead8", glass: "museum" },
  },
  {
    name: "Modern float",
    description: "Thin black frame, the work floating on white.",
    config: { ...DEFAULT_FRAME_CONFIG, base: "floating", width: 0.03, depth: 0.12, recess: 0.02, floatGap: 0.07, color: "#1a1a1a", material: "plain", finish: "matte", grain: 0 },
  },
  {
    name: "Warm wood",
    description: "Dark walnut, strong grain, bevelled edge, clear glass.",
    config: { ...DEFAULT_FRAME_CONFIG, base: "walnut", width: 0.09, depth: 0.12, color: "#4a3226", material: "wood", finish: "satin", grain: 0.8, profile: "bevelled", glass: "clear" },
  },
];

const CUSTOM_PREFIX = "custom:";

function toBase64Url(text: string): string {
  const bin = unescape(encodeURIComponent(text));
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(encoded: string): string {
  const padded = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(padded);
  return decodeURIComponent(escape(bin));
}

function isHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9a-f]{6}$/i.test(value);
}

function clampNumber(value: unknown, fallback: number, min: number, max: number): number {
  const next = typeof value === "number" && Number.isFinite(value) ? value : fallback;
  return Math.min(max, Math.max(min, next));
}

// A darker (factor < 1) or lighter (factor > 1) shade of a hex colour.
export function shadeHex(hex: string, factor: number): string {
  const match = /^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex);
  if (!match) return hex;
  const channel = (part: string) => Math.min(255, Math.max(0, Math.round(parseInt(part, 16) * factor)));
  return `#${[1, 2, 3].map((index) => channel(match[index]).toString(16).padStart(2, "0")).join("")}`;
}

// Encode a custom frame configuration into the artwork's `frame` value.
// Returns null when the config cannot be encoded.
export function encodeFrameConfig(config: FrameConfig): string | null {
  try {
    return `${CUSTOM_PREFIX}${toBase64Url(JSON.stringify(config))}`;
  } catch {
    return null;
  }
}

export function isCustomFrame(frame?: string): frame is string {
  return typeof frame === "string" && frame.startsWith(CUSTOM_PREFIX);
}

// Decode an encoded frame value back into its configuration. Returns
// null for built-in variants and for anything malformed — callers fall
// back to the built-in spec, so a bad value never breaks the render.
export function parseFrameConfig(frame?: string): FrameConfig | null {
  if (!isCustomFrame(frame)) return null;
  try {
    const parsed: unknown = JSON.parse(fromBase64Url(frame.slice(CUSTOM_PREFIX.length)));
    if (!parsed || typeof parsed !== "object") return null;
    const raw = parsed as Record<string, unknown>;
    const base = typeof raw.base === "string" && raw.base in FRAME_VARIANTS ? (raw.base as FrameVariant) : null;
    if (!base) return null;
    const material: FrameMaterial = ["wood", "metal", "gold", "silver", "acrylic", "plain"].includes(raw.material as string)
      ? (raw.material as FrameMaterial)
      : "plain";
    const finish: FrameFinish = ["matte", "satin", "gloss"].includes(raw.finish as string) ? (raw.finish as FrameFinish) : "satin";
    const profile: FrameProfile = ["flat", "stepped", "rounded", "bevelled", "scooped"].includes(raw.profile as string)
      ? (raw.profile as FrameProfile)
      : "flat";
    const glass: FrameGlass = ["none", "clear", "non-reflective", "museum"].includes(raw.glass as string)
      ? (raw.glass as FrameGlass)
      : "none";
    return {
      base,
      width: clampNumber(raw.width, 0.1, 0.01, 0.3),
      depth: clampNumber(raw.depth, 0.12, 0.03, 0.35),
      recess: clampNumber(raw.recess, 0, 0, 0.2),
      floatGap: clampNumber(raw.floatGap, 0, 0, 0.25),
      color: isHexColor(raw.color) ? raw.color : "#9c7c54",
      material,
      finish,
      grain: clampNumber(raw.grain, 0.5, 0, 1),
      profile,
      innerBorder: clampNumber(raw.innerBorder, 0, 0, 0.05),
      matWidth: clampNumber(raw.matWidth, 0, 0, 0.35),
      matColor: isHexColor(raw.matColor) ? raw.matColor : "#f2ead8",
      glass,
    };
  } catch {
    return null;
  }
}

// A saved preset's data is the same shape as a FrameConfig; merge it over
// the defaults so older or partial saves still apply cleanly.
export function parseSavedFrameConfig(data: Record<string, unknown>): FrameConfig {
  const encoded = encodeFrameConfig({ ...DEFAULT_FRAME_CONFIG, ...(data as Partial<FrameConfig>) });
  return (encoded ? parseFrameConfig(encoded) : null) ?? { ...DEFAULT_FRAME_CONFIG };
}

const FINISH_ROUGHNESS: Record<FrameFinish, number> = { matte: 0.85, satin: 0.45, gloss: 0.15 };

// Turn a custom configuration into the render spec the 3D scene and the
// thumbnails draw from: the base style, overridden by every control.
export function specFromFrameConfig(config: FrameConfig): FrameSpec {
  const base = FRAME_VARIANTS[config.base] ?? FRAME_VARIANTS.wood;
  let texture: FrameTextureKind = base.texture;
  let metalness = 0;
  let opacity: number | undefined;
  if (config.material === "wood") {
    texture = base.texture === "wood" || base.texture === "oak" || base.texture === "walnut" || base.texture === "mahogany" ? base.texture : "wood";
  } else if (config.material === "metal") {
    texture = "plain";
    metalness = 0.85;
  } else if (config.material === "gold") {
    texture = "gold-brushed";
    metalness = 0.9;
  } else if (config.material === "silver") {
    texture = "silver-brushed";
    metalness = 0.9;
  } else if (config.material === "acrylic") {
    texture = "acrylic";
    opacity = 0.45;
  } else {
    texture = "plain";
  }
  return {
    label: `${base.label} · custom`,
    color: config.color,
    metalness,
    roughness: FINISH_ROUGHNESS[config.finish],
    width: config.width,
    depth: config.depth,
    recess: config.recess,
    floatGap: config.floatGap,
    texture,
    bead: base.bead,
    profile: config.profile,
    grain: config.grain,
    glass: config.glass,
    opacity,
    ornament: base.ornament,
    ornamentSpacing: base.ornamentSpacing,
    mat: config.matWidth > 0 ? { color: config.matColor, width: config.matWidth, texture: "paper" } : undefined,
    trim:
      config.innerBorder > 0
        ? { color: config.material === "gold" ? "#d4af37" : shadeHex(config.color, 0.55), width: config.innerBorder, at: "artwork" }
        : undefined,
    trayColor: base.trayColor,
  };
}

// The editable configuration behind any frame value: the decoded custom
// config, or the built-in spec translated into controls.
export function configFromFrameSpec(variant: FrameVariant): FrameConfig {
  const spec = FRAME_VARIANTS[variant] ?? FRAME_VARIANTS.wood;
  const material: FrameMaterial =
    spec.texture === "wood" || spec.texture === "oak" || spec.texture === "walnut" || spec.texture === "mahogany"
      ? "wood"
      : spec.texture === "gold-brushed" || spec.texture === "gold-carved"
        ? "gold"
        : spec.texture === "silver-brushed"
          ? "silver"
          : spec.texture === "aluminium-brushed"
            ? "metal"
            : spec.texture === "acrylic"
              ? "acrylic"
              : "plain";
  const finish: FrameFinish = spec.roughness <= 0.25 ? "gloss" : spec.roughness <= 0.6 ? "satin" : "matte";
  return {
    base: variant,
    width: spec.width,
    depth: spec.depth,
    recess: spec.recess,
    floatGap: spec.floatGap,
    color: spec.color,
    material,
    finish,
    grain: spec.grain ?? (material === "wood" ? 0.6 : 0),
    profile: spec.profile ?? "flat",
    innerBorder: spec.trim?.width ?? 0,
    matWidth: spec.mat?.width ?? 0,
    matColor: spec.mat?.color ?? "#f2ead8",
    glass: spec.glass ?? "none",
  };
}

export function effectiveFrameConfig(frame?: string): FrameConfig {
  return parseFrameConfig(frame) ?? configFromFrameSpec((frame as FrameVariant) in FRAME_VARIANTS ? (frame as FrameVariant) : "wood");
}

// The render spec for any frame value — built-in, custom, or unknown
// (unknown falls back to wood, so old or mistyped values keep hanging).
export function resolveFrameSpec(frame?: string): FrameSpec {
  const custom = parseFrameConfig(frame);
  if (custom) return specFromFrameConfig(custom);
  if (typeof frame === "string" && frame in FRAME_VARIANTS) return FRAME_VARIANTS[frame as FrameVariant];
  return FRAME_VARIANTS.wood;
}
