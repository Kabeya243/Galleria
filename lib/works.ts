// "Mes travaux / designs / créations" — work kinds, stored WITHOUT a
// database migration: the production database cannot be migrated from
// this repo, so per-work kind overrides live in one SavedWork row of kind
// "work-kinds" per user, data = { [artworkId]: "oeuvre" | "design" |
// "creation" }. Works without an override are classified from their
// medium: design-ish media (design, digital, graphique, illustration,
// poster, logo, branding…) are Designs, everything else is an Œuvre.
// "Création" is only ever an explicit owner tag (objects, textiles,
// installations, experimental pieces) — never guessed.

import { db } from "@/lib/db";

export type WorkKind = "oeuvre" | "design" | "creation";

export const WORK_KINDS: WorkKind[] = ["oeuvre", "design", "creation"];

const DESIGN_MEDIUM_WORDS = [
  "design",
  "digital",
  "graphique",
  "graphic",
  "illustration",
  "poster",
  "affiche",
  "logo",
  "brand",
  "typograph",
  "ui",
  "ux",
  "web",
  "motion",
  "3d render",
  "rendu 3d",
];

export function classifyWorkKind(
  artwork: { medium?: string | null; title?: string | null },
  overrides: Record<string, WorkKind>,
  artworkId: string,
): WorkKind {
  const override = overrides[artworkId];
  if (override && WORK_KINDS.includes(override)) return override;
  const haystack = `${artwork.medium ?? ""} ${artwork.title ?? ""}`.toLowerCase();
  if (DESIGN_MEDIUM_WORDS.some((word) => haystack.includes(word))) return "design";
  return "oeuvre";
}

export function parseWorkKinds(data: unknown): Record<string, WorkKind> {
  if (!data || typeof data !== "object") return {};
  const out: Record<string, WorkKind> = {};
  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    if (typeof value === "string" && (WORK_KINDS as string[]).includes(value)) {
      out[key] = value as WorkKind;
    }
  }
  return out;
}

export async function getWorkKindOverrides(userId: string): Promise<Record<string, WorkKind>> {
  const row = await db.savedWork.findFirst({
    where: { userId, kind: "work-kinds" },
    select: { data: true },
  });
  if (!row) return {};
  try {
    return parseWorkKinds(JSON.parse(row.data) as unknown);
  } catch {
    return {};
  }
}

export async function setWorkKind(
  userId: string,
  artworkId: string,
  kind: WorkKind | null,
): Promise<Record<string, WorkKind>> {
  const existing = await db.savedWork.findFirst({
    where: { userId, kind: "work-kinds" },
    select: { id: true, data: true },
  });
  const current = existing ? parseWorkKinds(safeJson(existing.data)) : {};
  if (kind === null) {
    delete current[artworkId];
  } else {
    current[artworkId] = kind;
  }
  const data = JSON.stringify(current);
  if (existing) {
    await db.savedWork.update({ where: { id: existing.id }, data: { data } });
  } else {
    await db.savedWork.create({ data: { userId, kind: "work-kinds", title: "Work kinds", data } });
  }
  return current;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
