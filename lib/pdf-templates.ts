// Portfolio-PDF template registry — 50 ORIGINAL templates, data-driven.
// Each template is one compact data object (page colours, fonts, header
// alignment, works layout, cover style); the renderer
// (components/portfolio-print.tsx) reads it, so adding a template means
// adding one object here, never a new page. The designs are original
// SANAA creations in the spirit of real artist portfolios — they are NOT
// copies of any Dribbble/Pinterest design or real portfolio (those are
// protected by their authors).
//
// Families: classic, minimal, dark, editorial, earth, botanical, ocean,
// sunset, bold, pastel — 5 each, 50 total.
//
// Export is print-based (window.print() + a print stylesheet, no new
// dependency): the browser's "Save as PDF" produces the PDF file.
// Count is verifiable: PDF_TEMPLATE_COUNT = PDF_TEMPLATES.length.

export type PdfTemplate = {
  id: string;
  label: string;
  family: string;
  blurb: string;
  pageBg: string;
  ink: string;
  muted: string;
  line: string;
  accent: string;
  headingFont: string;
  bodyFont: string;
  headerAlign: "left" | "center";
  worksLayout: "grid" | "list" | "large";
  coverStyle: "plain" | "image" | "split";
};

export const PDF_TEMPLATE_FAMILIES = [
  { id: "classic", label: "Classic" },
  { id: "minimal", label: "Minimal" },
  { id: "dark", label: "Dark" },
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

export const PDF_TEMPLATES: PdfTemplate[] = [
  // ---- Classic ----
  {
    id: "classic-white", label: "Classic White", family: "classic",
    blurb: "The gallery catalogue — white pages, black serif, gold rule.",
    pageBg: "#ffffff", ink: "#141414", muted: "#6f6a61", line: "#e6e1d8", accent: "#a68b4b",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "center", worksLayout: "grid", coverStyle: "plain",
  },
  {
    id: "classic-ivory", label: "Classic Ivory", family: "classic",
    blurb: "Warm ivory paper, walnut ink — a keepsake catalogue.",
    pageBg: "#faf7f0", ink: "#1c1a17", muted: "#7a7264", line: "#e8e0d2", accent: "#8a6d3b",
    headingFont: F_SERIF, bodyFont: F_GEO, headerAlign: "center", worksLayout: "grid", coverStyle: "plain",
  },
  {
    id: "classic-frame", label: "Classic Frame", family: "classic",
    blurb: "A thin ruled frame on every page — the museum wall label, as a book.",
    pageBg: "#fdfdfc", ink: "#191919", muted: "#717171", line: "#c9c2b4", accent: "#000000",
    headingFont: F_GEO, bodyFont: F_SANS, headerAlign: "left", worksLayout: "list", coverStyle: "plain",
  },
  {
    id: "classic-cover", label: "Classic Cover", family: "classic",
    blurb: "Full-bleed cover image, then quiet white pages inside.",
    pageBg: "#ffffff", ink: "#141414", muted: "#6f6a61", line: "#e6e1d8", accent: "#a68b4b",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "center", worksLayout: "large", coverStyle: "image",
  },
  {
    id: "classic-split", label: "Classic Split", family: "classic",
    blurb: "Split cover — title left, first work right — then a two-column grid.",
    pageBg: "#fbfaf7", ink: "#1a1a1a", muted: "#6e6a60", line: "#e3ded4", accent: "#3f3d3a",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "left", worksLayout: "grid", coverStyle: "split",
  },
  // ---- Minimal ----
  {
    id: "minimal-mono", label: "Minimal Mono", family: "minimal",
    blurb: "One ink, one weight, uppercase labels — nothing extra on the page.",
    pageBg: "#ffffff", ink: "#111111", muted: "#777777", line: "#dddddd", accent: "#111111",
    headingFont: F_SANS, bodyFont: F_SANS, headerAlign: "left", worksLayout: "list", coverStyle: "plain",
  },
  {
    id: "minimal-grid", label: "Minimal Grid", family: "minimal",
    blurb: "A strict two-column grid, numbers instead of decoration.",
    pageBg: "#fbfbfb", ink: "#161616", muted: "#8a8a8a", line: "#e2e2e2", accent: "#161616",
    headingFont: F_SANS, bodyFont: F_SANS, headerAlign: "left", worksLayout: "grid", coverStyle: "plain",
  },
  {
    id: "minimal-large", label: "Minimal Large", family: "minimal",
    blurb: "One work per page, full width — the portfolio as a slow walk.",
    pageBg: "#ffffff", ink: "#0f0f0f", muted: "#8c8c8c", line: "#e8e8e8", accent: "#0f0f0f",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "center", worksLayout: "large", coverStyle: "image",
  },
  {
    id: "minimal-soft", label: "Minimal Soft", family: "minimal",
    blurb: "Minimal with a warm off-white and soft corners — gentle, not stark.",
    pageBg: "#faf9f6", ink: "#232323", muted: "#8a857a", line: "#e9e5dc", accent: "#6b5d4f",
    headingFont: F_SANS, bodyFont: F_SANS, headerAlign: "center", worksLayout: "grid", coverStyle: "split",
  },
  {
    id: "minimal-line", label: "Minimal Line", family: "minimal",
    blurb: "Hairlines only — every work divided by a single ruled line.",
    pageBg: "#fdfdfd", ink: "#1a1a1a", muted: "#7d7d7d", line: "#d9d9d9", accent: "#1a1a1a",
    headingFont: F_GEO, bodyFont: F_SANS, headerAlign: "left", worksLayout: "list", coverStyle: "plain",
  },
  // ---- Dark ----
  {
    id: "dark-ink", label: "Dark Ink", family: "dark",
    blurb: "Ink-black pages, warm paper text — the work glows on the page.",
    pageBg: "#141414", ink: "#f5f1e8", muted: "#a9a294", line: "#3a3835", accent: "#d9a441",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "left", worksLayout: "grid", coverStyle: "plain",
  },
  {
    id: "dark-cover", label: "Dark Cover", family: "dark",
    blurb: "Black cover with a full-bleed image, dark pages inside.",
    pageBg: "#0e0e0e", ink: "#f2f2f2", muted: "#9a9a9a", line: "#2c2c2c", accent: "#c8a24a",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "center", worksLayout: "large", coverStyle: "image",
  },
  {
    id: "dark-charcoal", label: "Dark Charcoal", family: "dark",
    blurb: "Soft charcoal, warm grey text — a dark room with the lights low.",
    pageBg: "#1e1d1b", ink: "#ece7dd", muted: "#a39a8a", line: "#3d3a36", accent: "#b98a3e",
    headingFont: F_GEO, bodyFont: F_SANS, headerAlign: "left", worksLayout: "list", coverStyle: "split",
  },
  {
    id: "dark-gold", label: "Dark Gold", family: "dark",
    blurb: "Black and gold — a gala catalogue, one work per page.",
    pageBg: "#111111", ink: "#f5f1e8", muted: "#a89f8d", line: "#333333", accent: "#d4af37",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "center", worksLayout: "large", coverStyle: "plain",
  },
  {
    id: "dark-plum", label: "Dark Plum", family: "dark",
    blurb: "Deep plum black with a warm accent — night, but warm.",
    pageBg: "#1a1216", ink: "#f3e9ee", muted: "#a8949d", line: "#3d2f36", accent: "#c96f4a",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "center", worksLayout: "grid", coverStyle: "split",
  },
  // ---- Editorial ----
  {
    id: "editorial-classic", label: "Editorial Classic", family: "editorial",
    blurb: "Magazine serif, generous leading — a printed catalogue essay.",
    pageBg: "#fbf8f3", ink: "#1f1c19", muted: "#6f6a61", line: "#e4ddd2", accent: "#8c2f2f",
    headingFont: F_SERIF, bodyFont: F_GEO, headerAlign: "left", worksLayout: "list", coverStyle: "plain",
  },
  {
    id: "editorial-serif", label: "Editorial Serif", family: "editorial",
    blurb: "All serif — headings and body in Georgia, like a museum book.",
    pageBg: "#fdfcfa", ink: "#222222", muted: "#6e6e6e", line: "#e6e2dc", accent: "#5b4a68",
    headingFont: F_GEO, bodyFont: F_GEO, headerAlign: "center", worksLayout: "grid", coverStyle: "image",
  },
  {
    id: "editorial-column", label: "Editorial Column", family: "editorial",
    blurb: "One narrow column — a long essay with works woven through it.",
    pageBg: "#faf8f4", ink: "#201d1a", muted: "#756e63", line: "#e7dfd3", accent: "#a3542f",
    headingFont: F_SERIF, bodyFont: F_GEO, headerAlign: "left", worksLayout: "large", coverStyle: "plain",
  },
  {
    id: "editorial-ink", label: "Editorial Ink", family: "editorial",
    blurb: "Ink-black editorial on cream, red accent, ruled sections.",
    pageBg: "#f6f1e7", ink: "#181512", muted: "#6d6558", line: "#ddd5c3", accent: "#9c2b1e",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "left", worksLayout: "grid", coverStyle: "split",
  },
  {
    id: "editorial-cream", label: "Editorial Cream", family: "editorial",
    blurb: "Cream pages, walnut ink, gold rules — a catalogue to keep.",
    pageBg: "#f8f3e8", ink: "#2a2118", muted: "#7d7261", line: "#e3d8c2", accent: "#a5873c",
    headingFont: F_SERIF, bodyFont: F_GEO, headerAlign: "center", worksLayout: "list", coverStyle: "plain",
  },
  // ---- Warm Earth ----
  {
    id: "earth-sand", label: "Earth Sand", family: "earth",
    blurb: "Pale sand pages, rust accent — a desert catalogue.",
    pageBg: "#f0e6d2", ink: "#2e241a", muted: "#7f7261", line: "#ddd0b4", accent: "#b4551f",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "left", worksLayout: "grid", coverStyle: "plain",
  },
  {
    id: "earth-clay", label: "Earth Clay", family: "earth",
    blurb: "Soft clay pink, walnut ink — gentle earth, quiet pages.",
    pageBg: "#e8d5c4", ink: "#33241c", muted: "#7d6a5c", line: "#dcc8b4", accent: "#9c4a2f",
    headingFont: F_GEO, bodyFont: F_SANS, headerAlign: "center", worksLayout: "grid", coverStyle: "split",
  },
  {
    id: "earth-ochre", label: "Earth Ochre", family: "earth",
    blurb: "Golden ochre pages, deep brown ink — late afternoon light.",
    pageBg: "#e8c97a", ink: "#3a2a12", muted: "#6d5a33", line: "#d4b36a", accent: "#8a4a1e",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "center", worksLayout: "large", coverStyle: "image",
  },
  {
    id: "earth-terracotta", label: "Earth Terracotta", family: "earth",
    blurb: "Warm terracotta pages, cream ink — the clay studio, bound.",
    pageBg: "#c96f4a", ink: "#fff5ec", muted: "#f0d3c4", line: "#b25a38", accent: "#3a2318",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "left", worksLayout: "list", coverStyle: "plain",
  },
  {
    id: "earth-brick", label: "Earth Brick", family: "earth",
    blurb: "Deep brick red, warm cream — bold earth, quiet text.",
    pageBg: "#8a3b26", ink: "#fbeee4", muted: "#e3bda6", line: "#6e2c1c", accent: "#e8c97a",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "left", worksLayout: "grid", coverStyle: "split",
  },
  // ---- Botanical ----
  {
    id: "botanical-moss", label: "Botanical Moss", family: "botanical",
    blurb: "Soft moss green on paper white — calm, organic, unhurried.",
    pageBg: "#eef1e6", ink: "#2c3324", muted: "#757e68", line: "#d8ddca", accent: "#4a6b3a",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "center", worksLayout: "grid", coverStyle: "plain",
  },
  {
    id: "botanical-leaf", label: "Botanical Leaf", family: "botanical",
    blurb: "Fresh leaf green, cream ink — a garden room, bound.",
    pageBg: "#2e5d3a", ink: "#f0f5e9", muted: "#b8c9a8", line: "#24492d", accent: "#d9c25a",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "left", worksLayout: "list", coverStyle: "split",
  },
  {
    id: "botanical-sage", label: "Botanical Sage", family: "botanical",
    blurb: "Sage grey-green, charcoal ink — a quiet conservatory.",
    pageBg: "#e6e9e0", ink: "#262b20", muted: "#6d7563", line: "#d2d7c5", accent: "#5d7052",
    headingFont: F_GEO, bodyFont: F_SANS, headerAlign: "left", worksLayout: "large", coverStyle: "image",
  },
  {
    id: "botanical-fern", label: "Botanical Fern", family: "botanical",
    blurb: "Deep fern green, pale paper — a shaded room in print.",
    pageBg: "#1d2b1f", ink: "#eef2e6", muted: "#a3b098", line: "#3a4a3c", accent: "#b5c96a",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "center", worksLayout: "grid", coverStyle: "plain",
  },
  {
    id: "botanical-olive", label: "Botanical Olive", family: "botanical",
    blurb: "Warm olive, cream ink — Mediterranean light on the page.",
    pageBg: "#5c6136", ink: "#f6f3e4", muted: "#c9c4a4", line: "#4a4f2b", accent: "#e0b64f",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "left", worksLayout: "grid", coverStyle: "split",
  },
  // ---- Ocean ----
  {
    id: "ocean-mist", label: "Ocean Mist", family: "ocean",
    blurb: "Pale mist blue, slate ink — morning fog over the harbour.",
    pageBg: "#e9f0f3", ink: "#22303a", muted: "#6e828d", line: "#d5dfe4", accent: "#2f6b84",
    headingFont: F_SANS, bodyFont: F_SANS, headerAlign: "left", worksLayout: "grid", coverStyle: "plain",
  },
  {
    id: "ocean-deep", label: "Ocean Deep", family: "ocean",
    blurb: "Deep sea blue, foam white — the work floats on dark water.",
    pageBg: "#0f2a3d", ink: "#eef5f8", muted: "#9db8c6", line: "#22455c", accent: "#5ab0c9",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "center", worksLayout: "large", coverStyle: "image",
  },
  {
    id: "ocean-navy", label: "Ocean Navy", family: "ocean",
    blurb: "Classic navy, gold accent — a formal room, in print.",
    pageBg: "#16233d", ink: "#f0ece2", muted: "#a5adc0", line: "#2c3d5c", accent: "#c9a227",
    headingFont: F_SERIF, bodyFont: F_GEO, headerAlign: "left", worksLayout: "list", coverStyle: "split",
  },
  {
    id: "ocean-sky", label: "Ocean Sky", family: "ocean",
    blurb: "Bright sky blue, white ink — open air, open book.",
    pageBg: "#7fb3d5", ink: "#ffffff", muted: "#dcebf4", line: "#6a9ec2", accent: "#0f2a3d",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "center", worksLayout: "grid", coverStyle: "image",
  },
  {
    id: "ocean-teal", label: "Ocean Teal", family: "ocean",
    blurb: "Teal water, sand ink — the coast, indoors.",
    pageBg: "#14655f", ink: "#f2f7f5", muted: "#a9cec7", line: "#0e4f4a", accent: "#e8c97a",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "left", worksLayout: "grid", coverStyle: "split",
  },
  // ---- Sunset ----
  {
    id: "sunset-coral", label: "Sunset Coral", family: "sunset",
    blurb: "Soft coral, warm white — a gentle evening room.",
    pageBg: "#f6ddd0", ink: "#3a231a", muted: "#8a6a58", line: "#e8c8b4", accent: "#c2511f",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "left", worksLayout: "grid", coverStyle: "split",
  },
  {
    id: "sunset-ember", label: "Sunset Ember", family: "sunset",
    blurb: "Ember orange, cream ink — the last light of the day, held.",
    pageBg: "#c2511f", ink: "#fff3e8", muted: "#f0c9ae", line: "#9e3e15", accent: "#2b1a12",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "center", worksLayout: "large", coverStyle: "image",
  },
  {
    id: "sunset-rose", label: "Sunset Rose", family: "sunset",
    blurb: "Dusty rose, deep plum ink — romantic, but the work stays the star.",
    pageBg: "#e8c5c0", ink: "#33201f", muted: "#7d6059", line: "#d9b0a8", accent: "#8a2f3a",
    headingFont: F_GEO, bodyFont: F_SANS, headerAlign: "center", worksLayout: "grid", coverStyle: "plain",
  },
  {
    id: "sunset-amber", label: "Sunset Amber", family: "sunset",
    blurb: "Golden amber paper, brown ink — honey light, all day.",
    pageBg: "#f2d492", ink: "#3d2c10", muted: "#75643c", line: "#e0bf6e", accent: "#9c4a1e",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "left", worksLayout: "list", coverStyle: "plain",
  },
  {
    id: "sunset-dusk", label: "Sunset Dusk", family: "sunset",
    blurb: "Dusk purple, pale peach ink — the gallery after closing time.",
    pageBg: "#2e2233", ink: "#f3e4dc", muted: "#b09aa8", line: "#4a3a50", accent: "#e8956a",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "center", worksLayout: "grid", coverStyle: "split",
  },
  // ---- Bold ----
  {
    id: "bold-red", label: "Bold Red", family: "bold",
    blurb: "Signal red, black ink, oversized type — impossible to ignore.",
    pageBg: "#d92323", ink: "#ffffff", muted: "#f6c9c9", line: "#a81a1a", accent: "#111111",
    headingFont: F_SANS, bodyFont: F_SANS, headerAlign: "left", worksLayout: "grid", coverStyle: "split",
  },
  {
    id: "bold-cobalt", label: "Bold Cobalt", family: "bold",
    blurb: "Cobalt blue, white type — a poster that happens to be a book.",
    pageBg: "#1e3fae", ink: "#ffffff", muted: "#b9c6f2", line: "#162f82", accent: "#ffcf3f",
    headingFont: F_SANS, bodyFont: F_SANS, headerAlign: "left", worksLayout: "grid", coverStyle: "plain",
  },
  {
    id: "bold-gold", label: "Bold Gold", family: "bold",
    blurb: "Gold on black, huge serif — a gala invitation for the work.",
    pageBg: "#111111", ink: "#f5f1e8", muted: "#a89f8d", line: "#333333", accent: "#d4af37",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "center", worksLayout: "large", coverStyle: "image",
  },
  {
    id: "bold-violet", label: "Bold Violet", family: "bold",
    blurb: "Electric violet, lime accent — a young, loud, joyful book.",
    pageBg: "#5b2d8e", ink: "#ffffff", muted: "#cdb8e6", line: "#452270", accent: "#c8e64a",
    headingFont: F_SANS, bodyFont: F_SANS, headerAlign: "left", worksLayout: "grid", coverStyle: "split",
  },
  {
    id: "bold-lime", label: "Bold Lime", family: "bold",
    blurb: "Lime on ink black — high contrast, high energy, all type.",
    pageBg: "#c8e64a", ink: "#141414", muted: "#4a5a1a", line: "#a8c23a", accent: "#141414",
    headingFont: F_SANS, bodyFont: F_SANS, headerAlign: "left", worksLayout: "list", coverStyle: "plain",
  },
  // ---- Pastel ----
  {
    id: "pastel-blush", label: "Pastel Blush", family: "pastel",
    blurb: "Blush pink, grey ink — soft, warm, welcoming.",
    pageBg: "#f9e3e0", ink: "#33292a", muted: "#8a7574", line: "#eed0cb", accent: "#b76e6e",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "center", worksLayout: "grid", coverStyle: "plain",
  },
  {
    id: "pastel-mint", label: "Pastel Mint", family: "pastel",
    blurb: "Mint green, charcoal ink — fresh, light, easy on the eyes.",
    pageBg: "#e2f2e6", ink: "#22302a", muted: "#6d8074", line: "#c9e2d0", accent: "#3a7d5d",
    headingFont: F_SANS, bodyFont: F_SANS, headerAlign: "left", worksLayout: "grid", coverStyle: "split",
  },
  {
    id: "pastel-lavender", label: "Pastel Lavender", family: "pastel",
    blurb: "Lavender mist, plum ink — dreamy, quiet, a little strange.",
    pageBg: "#e8e2f2", ink: "#2e2438", muted: "#7a6d8c", line: "#d3cbe4", accent: "#6b4a9c",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "center", worksLayout: "large", coverStyle: "image",
  },
  {
    id: "pastel-peach", label: "Pastel Peach", family: "pastel",
    blurb: "Peach cream, walnut ink — a sunny morning room.",
    pageBg: "#fdebd7", ink: "#33261a", muted: "#8a7460", line: "#f0d9bc", accent: "#c96f3a",
    headingFont: F_GEO, bodyFont: F_SANS, headerAlign: "left", worksLayout: "list", coverStyle: "plain",
  },
  {
    id: "pastel-sky", label: "Pastel Sky", family: "pastel",
    blurb: "Pale sky blue, navy ink — clear, calm, open.",
    pageBg: "#dcebf5", ink: "#1e2e3d", muted: "#6b7d8c", line: "#c2d8e8", accent: "#2f6b84",
    headingFont: F_SERIF, bodyFont: F_SANS, headerAlign: "center", worksLayout: "grid", coverStyle: "split",
  },
];

export const PDF_TEMPLATE_COUNT = PDF_TEMPLATES.length;

export function pdfTemplateById(id: string): PdfTemplate {
  return PDF_TEMPLATES.find((t) => t.id === id) ?? PDF_TEMPLATES[0];
}
