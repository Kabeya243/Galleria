import { db } from "@/lib/db";

// Usage tracking for the SANAA Tools (app/tools/*). Every tool page load
// records ONE row: the tool slug, the user id (null when not signed in —
// in practice every tool page requires a sign-in) and the time. Nothing
// else is logged: never input values, form contents or calculator numbers.
// The Admin dashboard reads this table for its "Tools used" section.

// The tools, in the order they appear in the Tools hub. Every tool is
// listed here even when it has zero recorded uses.
export const TOOL_SLUGS = [
  "price-your-work",
  "inventory",
  "contacts",
  "present-sell",
  "documents",
  "mockup-studio",
  "frame-studio",
  "photography-lab",
  "color-intelligence",
  "presentation-designer",
  "for-artists",
  "for-curators",
  "for-galleries",
  "for-collectors",
  // Phase 4 — Exhibition Management
  "collection-manager",
  "exhibition-planner",
  "visitor-analytics",
  "accessibility-studio",
  "education-studio",
  // Phase 5 — Intelligence and Automation
  "ai-architect",
  "artwork-intelligence",
  "ai-assistant",
  "image-to-3d",
  "video-generator",
  // Phase 6 — Professional Ecosystem
  "website-builder",
  "website-builder-advanced",
  "marketing-studio",
  "print-studio",
  "portfolio-pdf",
  "marketplace",
  "teams",
  "digital-twin",
  // Phase 7 — Art in Context
  "art-in-context",
] as const;

export type ToolSlug = (typeof TOOL_SLUGS)[number];

export const TOOL_LABELS: Record<ToolSlug, string> = {
  "price-your-work": "Price your work",
  inventory: "Inventory & Collections",
  contacts: "Contacts",
  "present-sell": "Present & Sell",
  documents: "Documents",
  "mockup-studio": "Mockup Studio",
  "frame-studio": "Frame Studio",
  "photography-lab": "Photography Lab",
  "color-intelligence": "Color Intelligence",
  "presentation-designer": "Presentation Designer",
  "for-artists": "For Artists",
  "for-curators": "For Curators",
  "for-galleries": "For Galleries",
  "for-collectors": "For Collectors",
  // Phase 4 — Exhibition Management
  "collection-manager": "Collection Manager",
  "exhibition-planner": "Exhibition Planner",
  "visitor-analytics": "Visitor Analytics",
  "accessibility-studio": "Accessibility & Audio Guide Studio",
  "education-studio": "Art Education Studio",
  // Phase 5 — Intelligence and Automation
  "ai-architect": "AI Exhibition Architect",
  "artwork-intelligence": "Artwork Intelligence",
  "ai-assistant": "AI Creative Assistant",
  "image-to-3d": "Image-to-3D & Asset Library",
  "video-generator": "Exhibition Video Generator",
  // Phase 6 — Professional Ecosystem
  "website-builder": "Artist Website Builder",
  "website-builder-advanced": "Advanced Website Builder",
  "marketing-studio": "Marketing Studio",
  "print-studio": "Print Production Studio",
  "portfolio-pdf": "Portfolio PDF Builder",
  marketplace: "Marketplace",
  teams: "Teams & Collaboration",
  "digital-twin": "Digital Twin, VR & AR",
  // Phase 7 — Art in Context
  "art-in-context": "Art in Context",
};

// Record one tool page load. Logging must never break the tool page, so a
// failed write is swallowed — the page still renders.
export async function logToolUse(tool: ToolSlug, userId: string | null): Promise<void> {
  try {
    await db.toolUse.create({ data: { tool, userId } });
  } catch {
    // Usage stats are best-effort; the tool itself must keep working.
  }
}
