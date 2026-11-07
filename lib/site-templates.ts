// Artist-site template registry — 50+ ORIGINAL templates, data-driven.
// Each template is one data object (colours, fonts, hero style, gallery
// columns, image radius); the renderer (components/site-preview.tsx)
// reads it, so adding a template means adding one object here, never a
// new page. The designs are original SANAA creations in the spirit of
// real artist sites and free Dribbble/Pinterest styles — they are NOT
// copies of any Dribbble/Pinterest design or real website (those are
// protected by their authors).
//
// Families: gallery (white-gallery luxury), dark (night editorial),
// minimal (stark mono), editorial (magazine serif), earth (warm
// terracotta/ochre), botanical (green), ocean (blue), sunset (warm
// dusk), bold (strong accent, big type), pastel (soft). 51 templates.
//
// Count is verifiable: SITE_TEMPLATE_COUNT = SITE_THEMES.length, and the
// builder shows the count. Batches land as separate commits.

export type SiteTheme = {
  id: string;
  label: string;
  family: string;
  blurb: string;
  bg: string;
  surface: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  headingFont: string;
  bodyFont: string;
  heroAlign: "center" | "left";
  heroStyle: "classic" | "split" | "banner";
  galleryCols: number;
  imageRadius: number;
  uppercaseHeadings: boolean;
};

export type SiteThemeId = string;

export const SITE_TEMPLATE_FAMILIES = [
  { id: "gallery", label: "Gallery" },
  { id: "dark", label: "Dark" },
  { id: "minimal", label: "Minimal" },
  { id: "editorial", label: "Editorial" },
  { id: "earth", label: "Warm Earth" },
  { id: "botanical", label: "Botanical" },
  { id: "ocean", label: "Ocean" },
  { id: "sunset", label: "Sunset" },
  { id: "bold", label: "Bold" },
  { id: "pastel", label: "Pastel" },
] as const;

const F_SERIF = "Fraunces, Georgia, serif";
const F_SANS = "'DM Sans', system-ui, sans-serif";
const F_GEO = "Georgia, serif";

export const SITE_THEMES: SiteTheme[] = [
  // ---- Gallery (white-gallery luxury) ----
  {
    id: "gallery-white", label: "Gallery White", family: "gallery",
    blurb: "The SANAA white-gallery look — warm paper, near-black ink, gold accent.",
    bg: "#fdfdfc", surface: "#ffffff", ink: "#141414", muted: "#6f6a61", line: "#e6e1d8",
    accent: "#a68b4b", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "classic", galleryCols: 3, imageRadius: 0, uppercaseHeadings: false,
  },
  {
    id: "gallery-ivory", label: "Gallery Ivory", family: "gallery",
    blurb: "Warm ivory paper, soft ink, quiet gold — a calmer white gallery.",
    bg: "#faf7f0", surface: "#fffdf8", ink: "#1c1a17", muted: "#7a7264", line: "#e8e0d2",
    accent: "#a68b4b", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "classic", galleryCols: 3, imageRadius: 2, uppercaseHeadings: false,
  },
  {
    id: "gallery-sand", label: "Gallery Sand", family: "gallery",
    blurb: "Pale sand walls, deep brown ink — desert light on the work.",
    bg: "#f3ede1", surface: "#faf6ec", ink: "#2b241c", muted: "#857a68", line: "#ddd2bd",
    accent: "#8a6d3b", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "split", galleryCols: 2, imageRadius: 4, uppercaseHeadings: false,
  },
  {
    id: "gallery-linen", label: "Gallery Linen", family: "gallery",
    blurb: "Linen white, charcoal ink, hairline rules — crisp and quiet.",
    bg: "#f7f5f1", surface: "#ffffff", ink: "#1a1a1a", muted: "#6e6a60", line: "#e3ded4",
    accent: "#3f3d3a", headingFont: F_SANS, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "classic", galleryCols: 3, imageRadius: 0, uppercaseHeadings: true,
  },
  {
    id: "gallery-paper", label: "Gallery Paper", family: "gallery",
    blurb: "Bright paper, one ink, generous white space — the work does the talking.",
    bg: "#ffffff", surface: "#fbfaf7", ink: "#191919", muted: "#717171", line: "#e5e5e5",
    accent: "#000000", headingFont: F_GEO, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "banner", galleryCols: 2, imageRadius: 0, uppercaseHeadings: false,
  },
  // ---- Dark (night editorial) ----
  {
    id: "dark-editorial", label: "Dark Editorial", family: "dark",
    blurb: "Ink-black pages, warm paper text — the work glows against the dark.",
    bg: "#141414", surface: "#1d1c1a", ink: "#f5f1e8", muted: "#a9a294", line: "#3a3835",
    accent: "#d9a441", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "classic", galleryCols: 2, imageRadius: 0, uppercaseHeadings: false,
  },
  {
    id: "dark-ink", label: "Dark Ink", family: "dark",
    blurb: "Pure ink black, paper white, a single warm accent.",
    bg: "#0e0e0e", surface: "#171717", ink: "#f2f2f2", muted: "#9a9a9a", line: "#2c2c2c",
    accent: "#c8a24a", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "banner", galleryCols: 3, imageRadius: 0, uppercaseHeadings: false,
  },
  {
    id: "dark-charcoal", label: "Dark Charcoal", family: "dark",
    blurb: "Soft charcoal, warm grey text — a dark room with the lights low.",
    bg: "#1e1d1b", surface: "#2a2825", ink: "#ece7dd", muted: "#a39a8a", line: "#3d3a36",
    accent: "#b98a3e", headingFont: F_GEO, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "split", galleryCols: 2, imageRadius: 6, uppercaseHeadings: false,
  },
  {
    id: "dark-plum", label: "Dark Plum", family: "dark",
    blurb: "Deep plum black with a wine accent — night, but warm.",
    bg: "#1a1216", surface: "#241a20", ink: "#f3e9ee", muted: "#a8949d", line: "#3d2f36",
    accent: "#c96f4a", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "classic", galleryCols: 2, imageRadius: 4, uppercaseHeadings: false,
  },
  {
    id: "dark-forest", label: "Dark Forest", family: "dark",
    blurb: "Forest dark, moss accent — the work lit like a clearing at dusk.",
    bg: "#12160f", surface: "#1b2115", ink: "#edf0e4", muted: "#9aa38b", line: "#2e3626",
    accent: "#8fae6a", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "classic", galleryCols: 3, imageRadius: 0, uppercaseHeadings: false,
  },
  // ---- Minimal (stark mono) ----
  {
    id: "minimal-mono", label: "Minimal Mono", family: "minimal",
    blurb: "Stark white, one ink, uppercase labels and hairline rules. Nothing extra.",
    bg: "#ffffff", surface: "#ffffff", ink: "#111111", muted: "#777777", line: "#dddddd",
    accent: "#111111", headingFont: F_SANS, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "classic", galleryCols: 1, imageRadius: 0, uppercaseHeadings: true,
  },
  {
    id: "minimal-grid", label: "Minimal Grid", family: "minimal",
    blurb: "A strict grid, one column of works, numbers instead of decoration.",
    bg: "#fbfbfb", surface: "#ffffff", ink: "#161616", muted: "#8a8a8a", line: "#e2e2e2",
    accent: "#161616", headingFont: F_SANS, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "classic", galleryCols: 1, imageRadius: 0, uppercaseHeadings: true,
  },
  {
    id: "minimal-type", label: "Minimal Type", family: "minimal",
    blurb: "Type is the design — oversized serif headings, tiny grey captions.",
    bg: "#ffffff", surface: "#ffffff", ink: "#0f0f0f", muted: "#8c8c8c", line: "#e8e8e8",
    accent: "#0f0f0f", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "split", galleryCols: 2, imageRadius: 0, uppercaseHeadings: false,
  },
  {
    id: "minimal-line", label: "Minimal Line", family: "minimal",
    blurb: "Hairlines only — every section divided by a single ruled line.",
    bg: "#fdfdfd", surface: "#ffffff", ink: "#1a1a1a", muted: "#7d7d7d", line: "#d9d9d9",
    accent: "#1a1a1a", headingFont: F_GEO, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "classic", galleryCols: 3, imageRadius: 0, uppercaseHeadings: true,
  },
  {
    id: "minimal-soft", label: "Minimal Soft", family: "minimal",
    blurb: "Minimal with rounded corners and a warm off-white — gentle, not stark.",
    bg: "#faf9f6", surface: "#ffffff", ink: "#232323", muted: "#8a857a", line: "#e9e5dc",
    accent: "#6b5d4f", headingFont: F_SANS, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "classic", galleryCols: 2, imageRadius: 12, uppercaseHeadings: false,
  },
  // ---- Editorial (magazine serif) ----
  {
    id: "editorial-classic", label: "Editorial Classic", family: "editorial",
    blurb: "Magazine serif, generous leading, the artist's name set large.",
    bg: "#fbf8f3", surface: "#ffffff", ink: "#1f1c19", muted: "#6f6a61", line: "#e4ddd2",
    accent: "#8c2f2f", headingFont: F_SERIF, bodyFont: F_GEO,
    heroAlign: "left", heroStyle: "classic", galleryCols: 2, imageRadius: 0, uppercaseHeadings: false,
  },
  {
    id: "editorial-serif", label: "Editorial Serif", family: "editorial",
    blurb: "All serif — headings and body in Georgia, like a printed catalogue.",
    bg: "#fdfcfa", surface: "#ffffff", ink: "#222222", muted: "#6e6e6e", line: "#e6e2dc",
    accent: "#5b4a68", headingFont: F_GEO, bodyFont: F_GEO,
    heroAlign: "center", heroStyle: "banner", galleryCols: 2, imageRadius: 0, uppercaseHeadings: false,
  },
  {
    id: "editorial-column", label: "Editorial Column", family: "editorial",
    blurb: "One narrow column of text and works — a long essay, not a grid.",
    bg: "#faf8f4", surface: "#ffffff", ink: "#201d1a", muted: "#756e63", line: "#e7dfd3",
    accent: "#a3542f", headingFont: F_SERIF, bodyFont: F_GEO,
    heroAlign: "left", heroStyle: "classic", galleryCols: 1, imageRadius: 0, uppercaseHeadings: false,
  },
  {
    id: "editorial-ink", label: "Editorial Ink", family: "editorial",
    blurb: "Ink-black editorial on cream — bold serif, red accent, ruled sections.",
    bg: "#f6f1e7", surface: "#fffdf7", ink: "#181512", muted: "#6d6558", line: "#ddd5c3",
    accent: "#9c2b1e", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "split", galleryCols: 3, imageRadius: 0, uppercaseHeadings: true,
  },
  {
    id: "editorial-cream", label: "Editorial Cream", family: "editorial",
    blurb: "Cream pages, walnut ink, gold rules — a catalogue you want to keep.",
    bg: "#f8f3e8", surface: "#fffdf6", ink: "#2a2118", muted: "#7d7261", line: "#e3d8c2",
    accent: "#a5873c", headingFont: F_SERIF, bodyFont: F_GEO,
    heroAlign: "center", heroStyle: "classic", galleryCols: 2, imageRadius: 2, uppercaseHeadings: false,
  },
  // ---- Warm Earth (terracotta / ochre) ----
  {
    id: "earth-terracotta", label: "Earth Terracotta", family: "earth",
    blurb: "Warm terracotta walls, cream ink — the clay studio, open to visitors.",
    bg: "#c96f4a", surface: "#d98a68", ink: "#fff5ec", muted: "#f0d3c4", line: "#b25a38",
    accent: "#3a2318", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "split", galleryCols: 2, imageRadius: 4, uppercaseHeadings: false,
  },
  {
    id: "earth-ochre", label: "Earth Ochre", family: "earth",
    blurb: "Golden ochre paper, deep brown ink — late afternoon light, all day.",
    bg: "#e8c97a", surface: "#f2dcab", ink: "#3a2a12", muted: "#6d5a33", line: "#d4b36a",
    accent: "#8a4a1e", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "banner", galleryCols: 3, imageRadius: 0, uppercaseHeadings: false,
  },
  {
    id: "earth-clay", label: "Earth Clay", family: "earth",
    blurb: "Soft clay pink, walnut ink — gentle earth, quiet rooms.",
    bg: "#e8d5c4", surface: "#f6ece2", ink: "#33241c", muted: "#7d6a5c", line: "#dcc8b4",
    accent: "#9c4a2f", headingFont: F_GEO, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "classic", galleryCols: 2, imageRadius: 8, uppercaseHeadings: false,
  },
  {
    id: "earth-sahara", label: "Earth Sahara", family: "earth",
    blurb: "Pale sand, rust accent — a desert gallery at noon.",
    bg: "#f0e6d2", surface: "#fbf7ec", ink: "#2e241a", muted: "#7f7261", line: "#ddd0b4",
    accent: "#b4551f", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "classic", galleryCols: 2, imageRadius: 0, uppercaseHeadings: true,
  },
  {
    id: "earth-brick", label: "Earth Brick", family: "earth",
    blurb: "Deep brick red, warm cream — bold earth, museum-quiet text.",
    bg: "#8a3b26", surface: "#9c4a30", ink: "#fbeee4", muted: "#e3bda6", line: "#6e2c1c",
    accent: "#e8c97a", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "classic", galleryCols: 3, imageRadius: 0, uppercaseHeadings: false,
  },
  // ---- Botanical (green) ----
  {
    id: "botanical-leaf", label: "Botanical Leaf", family: "botanical",
    blurb: "Fresh leaf green, cream ink — a garden room for the work.",
    bg: "#2e5d3a", surface: "#3a6e47", ink: "#f0f5e9", muted: "#b8c9a8", line: "#24492d",
    accent: "#d9c25a", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "split", galleryCols: 2, imageRadius: 6, uppercaseHeadings: false,
  },
  {
    id: "botanical-moss", label: "Botanical Moss", family: "botanical",
    blurb: "Soft moss green on paper white — calm, organic, unhurried.",
    bg: "#eef1e6", surface: "#ffffff", ink: "#2c3324", muted: "#757e68", line: "#d8ddca",
    accent: "#4a6b3a", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "classic", galleryCols: 3, imageRadius: 4, uppercaseHeadings: false,
  },
  {
    id: "botanical-sage", label: "Botanical Sage", family: "botanical",
    blurb: "Sage grey-green, charcoal ink — a quiet conservatory.",
    bg: "#e6e9e0", surface: "#f4f6ef", ink: "#262b20", muted: "#6d7563", line: "#d2d7c5",
    accent: "#5d7052", headingFont: F_GEO, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "classic", galleryCols: 2, imageRadius: 0, uppercaseHeadings: true,
  },
  {
    id: "botanical-fern", label: "Botanical Fern", family: "botanical",
    blurb: "Deep fern green, pale paper — a shaded room, works in soft light.",
    bg: "#1d2b1f", surface: "#28382a", ink: "#eef2e6", muted: "#a3b098", line: "#3a4a3c",
    accent: "#b5c96a", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "banner", galleryCols: 2, imageRadius: 0, uppercaseHeadings: false,
  },
  {
    id: "botanical-olive", label: "Botanical Olive", family: "botanical",
    blurb: "Warm olive, cream ink — Mediterranean light on the walls.",
    bg: "#5c6136", surface: "#6b7042", ink: "#f6f3e4", muted: "#c9c4a4", line: "#4a4f2b",
    accent: "#e0b64f", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "classic", galleryCols: 3, imageRadius: 2, uppercaseHeadings: false,
  },
  // ---- Ocean (blue) ----
  {
    id: "ocean-deep", label: "Ocean Deep", family: "ocean",
    blurb: "Deep sea blue, foam white — the work floats on dark water.",
    bg: "#0f2a3d", surface: "#16394f", ink: "#eef5f8", muted: "#9db8c6", line: "#22455c",
    accent: "#5ab0c9", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "classic", galleryCols: 2, imageRadius: 0, uppercaseHeadings: false,
  },
  {
    id: "ocean-mist", label: "Ocean Mist", family: "ocean",
    blurb: "Pale mist blue, slate ink — morning fog over the harbour.",
    bg: "#e9f0f3", surface: "#ffffff", ink: "#22303a", muted: "#6e828d", line: "#d5dfe4",
    accent: "#2f6b84", headingFont: F_SANS, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "split", galleryCols: 2, imageRadius: 8, uppercaseHeadings: false,
  },
  {
    id: "ocean-sky", label: "Ocean Sky", family: "ocean",
    blurb: "Bright sky blue, white ink — open air, open gallery.",
    bg: "#7fb3d5", surface: "#95c3de", ink: "#ffffff", muted: "#dcebf4", line: "#6a9ec2",
    accent: "#0f2a3d", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "banner", galleryCols: 3, imageRadius: 6, uppercaseHeadings: false,
  },
  {
    id: "ocean-navy", label: "Ocean Navy", family: "ocean",
    blurb: "Classic navy, gold accent — a formal room, evening light.",
    bg: "#16233d", surface: "#1e2e4d", ink: "#f0ece2", muted: "#a5adc0", line: "#2c3d5c",
    accent: "#c9a227", headingFont: F_SERIF, bodyFont: F_GEO,
    heroAlign: "left", heroStyle: "classic", galleryCols: 2, imageRadius: 0, uppercaseHeadings: true,
  },
  {
    id: "ocean-teal", label: "Ocean Teal", family: "ocean",
    blurb: "Teal water, sand ink — the coast, indoors.",
    bg: "#14655f", surface: "#1a766e", ink: "#f2f7f5", muted: "#a9cec7", line: "#0e4f4a",
    accent: "#e8c97a", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "split", galleryCols: 3, imageRadius: 4, uppercaseHeadings: false,
  },
  // ---- Sunset (warm dusk) ----
  {
    id: "sunset-ember", label: "Sunset Ember", family: "sunset",
    blurb: "Ember orange, cream ink — the last light of the day, held.",
    bg: "#c2511f", surface: "#d2683a", ink: "#fff3e8", muted: "#f0c9ae", line: "#9e3e15",
    accent: "#2b1a12", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "banner", galleryCols: 2, imageRadius: 0, uppercaseHeadings: false,
  },
  {
    id: "sunset-coral", label: "Sunset Coral", family: "sunset",
    blurb: "Soft coral, warm white — a gentle evening room.",
    bg: "#f6ddd0", surface: "#fdf3ec", ink: "#3a231a", muted: "#8a6a58", line: "#e8c8b4",
    accent: "#c2511f", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "split", galleryCols: 2, imageRadius: 10, uppercaseHeadings: false,
  },
  {
    id: "sunset-rose", label: "Sunset Rose", family: "sunset",
    blurb: "Dusty rose, deep plum ink — romantic, but the work stays the star.",
    bg: "#e8c5c0", surface: "#f6e4e0", ink: "#33201f", muted: "#7d6059", line: "#d9b0a8",
    accent: "#8a2f3a", headingFont: F_GEO, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "classic", galleryCols: 3, imageRadius: 4, uppercaseHeadings: false,
  },
  {
    id: "sunset-amber", label: "Sunset Amber", family: "sunset",
    blurb: "Golden amber paper, brown ink — honey light, all day long.",
    bg: "#f2d492", surface: "#f9e6b8", ink: "#3d2c10", muted: "#75643c", line: "#e0bf6e",
    accent: "#9c4a1e", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "classic", galleryCols: 2, imageRadius: 0, uppercaseHeadings: true,
  },
  {
    id: "sunset-dusk", label: "Sunset Dusk", family: "sunset",
    blurb: "Dusk purple, pale peach ink — the gallery after closing time.",
    bg: "#2e2233", surface: "#3c2d42", ink: "#f3e4dc", muted: "#b09aa8", line: "#4a3a50",
    accent: "#e8956a", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "classic", galleryCols: 2, imageRadius: 0, uppercaseHeadings: false,
  },
  // ---- Bold (strong accent, big type) ----
  {
    id: "bold-red", label: "Bold Red", family: "bold",
    blurb: "Signal red, black ink, oversized type — impossible to walk past.",
    bg: "#d92323", surface: "#e84040", ink: "#ffffff", muted: "#f6c9c9", line: "#a81a1a",
    accent: "#111111", headingFont: F_SANS, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "split", galleryCols: 2, imageRadius: 0, uppercaseHeadings: true,
  },
  {
    id: "bold-cobalt", label: "Bold Cobalt", family: "bold",
    blurb: "Cobalt blue, white type — a poster that happens to be a website.",
    bg: "#1e3fae", surface: "#2a4fc4", ink: "#ffffff", muted: "#b9c6f2", line: "#162f82",
    accent: "#ffcf3f", headingFont: F_SANS, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "classic", galleryCols: 3, imageRadius: 0, uppercaseHeadings: true,
  },
  {
    id: "bold-gold", label: "Bold Gold", family: "bold",
    blurb: "Gold on black, huge serif — a gala invitation for the work.",
    bg: "#111111", surface: "#1c1c1c", ink: "#f5f1e8", muted: "#a89f8d", line: "#333333",
    accent: "#d4af37", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "banner", galleryCols: 2, imageRadius: 0, uppercaseHeadings: false,
  },
  {
    id: "bold-violet", label: "Bold Violet", family: "bold",
    blurb: "Electric violet, lime accent — a young, loud, joyful room.",
    bg: "#5b2d8e", surface: "#6c38a5", ink: "#ffffff", muted: "#cdb8e6", line: "#452270",
    accent: "#c8e64a", headingFont: F_SANS, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "split", galleryCols: 3, imageRadius: 8, uppercaseHeadings: true,
  },
  {
    id: "bold-lime", label: "Bold Lime", family: "bold",
    blurb: "Lime on ink black — high contrast, high energy, all type.",
    bg: "#c8e64a", surface: "#d6f06a", ink: "#141414", muted: "#4a5a1a", line: "#a8c23a",
    accent: "#141414", headingFont: F_SANS, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "classic", galleryCols: 2, imageRadius: 0, uppercaseHeadings: true,
  },
  // ---- Pastel (soft) ----
  {
    id: "pastel-blush", label: "Pastel Blush", family: "pastel",
    blurb: "Blush pink, grey ink — soft, warm, welcoming.",
    bg: "#f9e3e0", surface: "#fff5f3", ink: "#33292a", muted: "#8a7574", line: "#eed0cb",
    accent: "#b76e6e", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "classic", galleryCols: 2, imageRadius: 12, uppercaseHeadings: false,
  },
  {
    id: "pastel-mint", label: "Pastel Mint", family: "pastel",
    blurb: "Mint green, charcoal ink — fresh, light, easy on the eyes.",
    bg: "#e2f2e6", surface: "#f4fbf5", ink: "#22302a", muted: "#6d8074", line: "#c9e2d0",
    accent: "#3a7d5d", headingFont: F_SANS, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "split", galleryCols: 3, imageRadius: 10, uppercaseHeadings: false,
  },
  {
    id: "pastel-lavender", label: "Pastel Lavender", family: "pastel",
    blurb: "Lavender mist, plum ink — dreamy, quiet, a little strange.",
    bg: "#e8e2f2", surface: "#f6f2fb", ink: "#2e2438", muted: "#7a6d8c", line: "#d3cbe4",
    accent: "#6b4a9c", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "classic", galleryCols: 2, imageRadius: 8, uppercaseHeadings: false,
  },
  {
    id: "pastel-peach", label: "Pastel Peach", family: "pastel",
    blurb: "Peach cream, walnut ink — a sunny morning room.",
    bg: "#fdebd7", surface: "#fff7ec", ink: "#33261a", muted: "#8a7460", line: "#f0d9bc",
    accent: "#c96f3a", headingFont: F_GEO, bodyFont: F_SANS,
    heroAlign: "left", heroStyle: "classic", galleryCols: 2, imageRadius: 6, uppercaseHeadings: false,
  },
  {
    id: "pastel-sky", label: "Pastel Sky", family: "pastel",
    blurb: "Pale sky blue, navy ink — clear, calm, open.",
    bg: "#dcebf5", surface: "#f2f8fc", ink: "#1e2e3d", muted: "#6b7d8c", line: "#c2d8e8",
    accent: "#2f6b84", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "banner", galleryCols: 3, imageRadius: 0, uppercaseHeadings: false,
  },
  // ---- The 51st: a black-and-gold gallery ----
  {
    id: "gallery-noir", label: "Galerie Noire", family: "gallery",
    blurb: "Black walls, gold serif, white work — the evening opening, every night.",
    bg: "#0c0c0c", surface: "#161616", ink: "#f2ead8", muted: "#9a917e", line: "#2c2a26",
    accent: "#c9a227", headingFont: F_SERIF, bodyFont: F_SANS,
    heroAlign: "center", heroStyle: "banner", galleryCols: 2, imageRadius: 0, uppercaseHeadings: false,
  },
];

export const SITE_TEMPLATE_COUNT = SITE_THEMES.length;

export function siteTemplateById(id: string): SiteTheme {
  return SITE_THEMES.find((t) => t.id === id) ?? SITE_THEMES[0];
}

export function siteTemplatesByFamily(family: string): SiteTheme[] {
  return SITE_THEMES.filter((t) => t.family === family);
}
