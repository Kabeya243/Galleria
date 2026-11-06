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
  "photography-lab",
  "color-intelligence",
  "presentation-designer",
  "for-artists",
  "for-curators",
  "for-galleries",
  "for-collectors",
] as const;

export type ToolSlug = (typeof TOOL_SLUGS)[number];

export const TOOL_LABELS: Record<ToolSlug, string> = {
  "price-your-work": "Price your work",
  inventory: "Inventory & Collections",
  contacts: "Contacts",
  "present-sell": "Present & Sell",
  documents: "Documents",
  "mockup-studio": "Mockup Studio",
  "photography-lab": "Photography Lab",
  "color-intelligence": "Color Intelligence",
  "presentation-designer": "Presentation Designer",
  "for-artists": "For Artists",
  "for-curators": "For Curators",
  "for-galleries": "For Galleries",
  "for-collectors": "For Collectors",
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
