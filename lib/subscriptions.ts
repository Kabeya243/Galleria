import { redirect } from "next/navigation";
import { db, withDbRetry } from "@/lib/db";

// Subscriptions (Nov 2026): the three Lakisa plans from the budget and
// monetisation dossier (Lakisa_Budget_Monetisation.docx, section 3.2-3.3).
// Plans are database rows (SubscriptionPlan) so the manager can rename
// them, change prices and edit the included tools from the admin
// dashboard; the defaults below seed the three rows once and never
// overwrite an admin edit.
//
// FREE TRIAL MODE: the paywall is OFF by default. While it is off, every
// entitlement check passes and every tool stays open to everyone, so
// users can try everything for free. The plan structure (plans, tool
// mapping, limits, admin management) is fully in place underneath.
// To turn billing on later, set LAKISA_PAYWALL_ENABLED=true in Vercel
// (and connect a payment provider first, Flutterwave or Pesapal,
// otherwise plan changes have no way to be paid). No code change is
// needed to flip the switch, only the variable.

export type PlanSlug = "discovery" | "creator" | "studio";

export type PlanLimits = {
  exhibitions: number | null;
  artworks: number | null;
  storageGb: number | null;
  contacts: number | null;
  inventory: number | null;
  aiActionsPerMonth: number | null;
};

export type PlanDTO = {
  id: string;
  slug: PlanSlug;
  name: string;
  tagline: string;
  description: string;
  monthlyPriceUsd: number;
  yearlyPriceUsd: number;
  features: string[];
  limits: PlanLimits;
  isActive: boolean;
  sortOrder: number;
};

export type SubscriptionDTO = {
  id: string;
  userId: string;
  planId: string;
  status: string;
  billingCycle: string;
  source: string;
  startedAt: Date;
  endsAt: Date | null;
};

// The paywall switch. Off by default: free trial for everyone, no
// payment integrated yet. Set LAKISA_PAYWALL_ENABLED=true only once a
// payment provider is connected.
export const PAYWALL_ENABLED = process.env.LAKISA_PAYWALL_ENABLED === "true";

export const PLAN_SLUGS: PlanSlug[] = ["discovery", "creator", "studio"];

export function planRank(slug: PlanSlug): number {
  return slug === "discovery" ? 0 : slug === "creator" ? 1 : 2;
}

function isPlanSlug(value: unknown): value is PlanSlug {
  return value === "discovery" || value === "creator" || value === "studio";
}

// The three plans, exactly as in the monetisation dossier (Table 4 for
// prices, Table 5 for tools and limits). Feature lines are the plan data
// shown on the pricing page, in display order. Limits use null for
// unlimited and 0 for not included.
const PLAN_DEFAULTS: Array<{
  slug: PlanSlug;
  name: string;
  tagline: string;
  description: string;
  monthlyPriceUsd: number;
  yearlyPriceUsd: number;
  features: string[];
  limits: PlanLimits;
  sortOrder: number;
}> = [
  {
    slug: "discovery",
    name: "Discovery",
    tagline: "Discover the platform",
    description: "For artists discovering Lakisa: a 3D gallery, one exhibition and room to try the tools.",
    monthlyPriceUsd: 0,
    yearlyPriceUsd: 0,
    features: [
      "3D gallery with base room models",
      "1 public exhibition",
      "5 artworks",
      "1 GB storage",
      "Public feed and messaging",
      "Search",
      "20 contacts",
      "Inventory up to 20 artworks",
    ],
    limits: { exhibitions: 1, artworks: 5, storageGb: 1, contacts: 20, inventory: 20, aiActionsPerMonth: 0 },
    sortOrder: 0,
  },
  {
    slug: "creator",
    name: "Creator",
    tagline: "For artists who exhibit and sell",
    description: "For active artists who exhibit and sell their work: every creative tool, more room, and your own subdomain.",
    monthlyPriceUsd: 8,
    yearlyPriceUsd: 80,
    features: [
      "Everything in Discovery",
      "All 3D room models",
      "10 exhibitions",
      "100 artworks",
      "20 GB storage",
      "Unlimited contacts and inventory",
      "Price Your Work",
      "Documents and certificates",
      "Portfolio PDF (Atelier)",
      "Frames & Art on Walls",
      "Photography Lab",
      "Exhibition Planner",
      "Open Calls",
      "Your subdomain (you.lakisa.art)",
      "Basic statistics",
      "200 AI actions per month",
    ],
    limits: { exhibitions: 10, artworks: 100, storageGb: 20, contacts: null, inventory: null, aiActionsPerMonth: 200 },
    sortOrder: 1,
  },
  {
    slug: "studio",
    name: "Studio",
    tagline: "For galleries, collectives and full sites",
    description: "For galleries, collectives and artists who want their own site: everything in Creator, plus the Website Builder and advanced tools.",
    monthlyPriceUsd: 25,
    yearlyPriceUsd: 250,
    features: [
      "Everything in Creator",
      "Unlimited exhibitions and artworks",
      "100 GB storage",
      "Website Builder (full site)",
      "Image to 3D",
      "Art in Context",
      "Advanced visitor analytics",
      "Sub-admins",
      "White label (no Lakisa logo)",
      "Priority support",
      "1,000 AI actions per month",
      "Marketplace commission 5% instead of 10%",
    ],
    limits: { exhibitions: null, artworks: null, storageGb: 100, contacts: null, inventory: null, aiActionsPerMonth: 1000 },
    sortOrder: 2,
  },
];

// Minimum plan for each tool, from the dossier Table 5. Tools not listed
// here are free for every plan (feed, messaging, search, the 3D gallery
// itself). The marketplace is a selling surface, not a tool page: it is
// listed here for the pricing page, but the public marketplace route is
// not gated (commission applies when selling starts, later).
export const TOOL_PLAN: Record<string, PlanSlug> = {
  "art-in-context": "studio",
  "price-your-work": "creator",
  inventory: "discovery",
  contacts: "discovery",
  documents: "creator",
  "frames-walls": "creator",
  "photography-lab": "creator",
  "exhibition-planner": "creator",
  "open-calls": "creator",
  "image-to-3d": "studio",
  "video-generator": "studio",
  "website-builder": "studio",
  "website-builder-advanced": "studio",
  "portfolio-pdf": "creator",
  marketplace: "creator",
};

// The hub tools in display order, with the plan each one needs. Used by
// the tools hub for the plan badges.
export const HUB_TOOLS: Array<{ slug: string; href: string; requiredPlan: PlanSlug }> = [
  { slug: "art-in-context", href: "/tools/art-in-context", requiredPlan: "studio" },
  { slug: "price-your-work", href: "/tools/price-your-work", requiredPlan: "creator" },
  { slug: "inventory", href: "/tools/inventory", requiredPlan: "discovery" },
  { slug: "contacts", href: "/tools/contacts", requiredPlan: "discovery" },
  { slug: "documents", href: "/tools/documents", requiredPlan: "creator" },
  { slug: "frames-walls", href: "/tools/frames-walls", requiredPlan: "creator" },
  { slug: "photography-lab", href: "/tools/photography-lab", requiredPlan: "creator" },
  { slug: "exhibition-planner", href: "/tools/exhibition-planner", requiredPlan: "creator" },
  { slug: "open-calls", href: "/tools/open-calls", requiredPlan: "creator" },
  { slug: "image-to-3d", href: "/tools/image-to-3d", requiredPlan: "studio" },
  { slug: "video-generator", href: "/tools/video-generator", requiredPlan: "studio" },
  { slug: "website-builder", href: "/tools/website-builder/advanced", requiredPlan: "studio" },
  { slug: "portfolio-pdf", href: "/tools/portfolio-pdf", requiredPlan: "creator" },
  { slug: "marketplace", href: "/marketplace", requiredPlan: "creator" },
];

function parsePlan(row: {
  id: string;
  slug: string;
  name: string;
  tagline: string;
  description: string;
  monthlyPriceUsd: number;
  yearlyPriceUsd: number;
  features: unknown;
  limits: unknown;
  isActive: boolean;
  sortOrder: number;
}): PlanDTO | null {
  if (!isPlanSlug(row.slug)) return null;
  const features = Array.isArray(row.features)
    ? row.features.filter((f): f is string => typeof f === "string")
    : [];
  const rawLimits = (row.limits ?? {}) as Record<string, unknown>;
  const numOrNull = (value: unknown): number | null =>
    typeof value === "number" && Number.isFinite(value) ? value : null;
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    description: row.description,
    monthlyPriceUsd: row.monthlyPriceUsd,
    yearlyPriceUsd: row.yearlyPriceUsd,
    features,
    limits: {
      exhibitions: numOrNull(rawLimits.exhibitions),
      artworks: numOrNull(rawLimits.artworks),
      storageGb: numOrNull(rawLimits.storageGb),
      contacts: numOrNull(rawLimits.contacts),
      inventory: numOrNull(rawLimits.inventory),
      aiActionsPerMonth: numOrNull(rawLimits.aiActionsPerMonth),
    },
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

function toPlanDTO(row: Parameters<typeof parsePlan>[0]): PlanDTO {
  const parsed = parsePlan(row);
  if (!parsed) throw new Error(`Unknown plan slug in database: ${row.slug}`);
  return parsed;
}

// Seed the three plans if they are missing. Only creates missing rows;
// it never overwrites a plan the manager edited in the admin.
export async function ensurePlansSeeded(): Promise<void> {
  await withDbRetry(async () => {
    const existing = await db.subscriptionPlan.findMany({ select: { slug: true } });
    const have = new Set(existing.map((p) => p.slug));
    for (const def of PLAN_DEFAULTS) {
      if (have.has(def.slug)) continue;
      await db.subscriptionPlan.create({
        data: {
          slug: def.slug,
          name: def.name,
          tagline: def.tagline,
          description: def.description,
          monthlyPriceUsd: def.monthlyPriceUsd,
          yearlyPriceUsd: def.yearlyPriceUsd,
          features: def.features,
          limits: def.limits,
          sortOrder: def.sortOrder,
        },
      });
    }
  });
}

export async function getAllPlans(): Promise<PlanDTO[]> {
  await ensurePlansSeeded();
  const rows = await withDbRetry(() =>
    db.subscriptionPlan.findMany({ orderBy: { sortOrder: "asc" } }),
  );
  return rows.map(toPlanDTO);
}

export async function getActivePlans(): Promise<PlanDTO[]> {
  const plans = await getAllPlans();
  return plans.filter((p) => p.isActive);
}

export async function getPlanBySlug(slug: string): Promise<PlanDTO | null> {
  if (!isPlanSlug(slug)) return null;
  await ensurePlansSeeded();
  const row = await withDbRetry(() =>
    db.subscriptionPlan.findUnique({ where: { slug } }),
  );
  return row ? toPlanDTO(row) : null;
}

function toSubscriptionDTO(row: {
  id: string;
  userId: string;
  planId: string;
  status: string;
  billingCycle: string;
  source: string;
  startedAt: Date;
  endsAt: Date | null;
}): SubscriptionDTO {
  return {
    id: row.id,
    userId: row.userId,
    planId: row.planId,
    status: row.status,
    billingCycle: row.billingCycle,
    source: row.source,
    startedAt: row.startedAt,
    endsAt: row.endsAt,
  };
}

// The account's subscription and plan. Creates the Discovery row lazily
// on first read, so every account (including old ones) has one.
export async function getUserSubscription(
  userId: string,
): Promise<{ subscription: SubscriptionDTO; plan: PlanDTO }> {
  await ensurePlansSeeded();
  const existing = await withDbRetry(() =>
    db.subscription.findUnique({
      where: { userId },
      include: { plan: true },
    }),
  );
  if (existing) {
    return { subscription: toSubscriptionDTO(existing), plan: toPlanDTO(existing.plan) };
  }
  const discovery = await getPlanBySlug("discovery");
  if (!discovery) throw new Error("Discovery plan is missing");
  const created = await withDbRetry(() =>
    db.subscription.create({
      data: { userId, planId: discovery.id, status: "active", billingCycle: "monthly", source: "trial" },
      include: { plan: true },
    }),
  );
  return { subscription: toSubscriptionDTO(created), plan: toPlanDTO(created.plan) };
}

export async function getUserPlanSlug(userId: string): Promise<PlanSlug> {
  const { plan } = await getUserSubscription(userId);
  return plan.slug;
}

export type ToolAccess = {
  allowed: boolean;
  planSlug: PlanSlug;
  requiredPlanSlug: PlanSlug;
  paywallEnabled: boolean;
};

// Can this account open this tool? While the paywall is off, everything
// is allowed (free trial). When it is on, the account needs at least the
// tool's minimum plan.
export async function getToolAccess(userId: string, toolSlug: string): Promise<ToolAccess> {
  const requiredPlanSlug = TOOL_PLAN[toolSlug] ?? "discovery";
  const planSlug = await getUserPlanSlug(userId);
  const allowed = !PAYWALL_ENABLED || planRank(planSlug) >= planRank(requiredPlanSlug);
  return { allowed, planSlug, requiredPlanSlug, paywallEnabled: PAYWALL_ENABLED };
}

// Server-side gate for tool pages: when the paywall is on and the
// account's plan is below the tool's minimum, send the visitor to the
// pricing page with the tool named, so the page can open the info popup
// for that tool. While the paywall is off this is a no-op (and skips the
// database read entirely), so tool pages stay as fast as before.
export async function requireToolAccess(
  user: { id: string } | null | undefined,
  toolSlug: string,
): Promise<void> {
  if (!PAYWALL_ENABLED) return;
  if (!user) return;
  const access = await getToolAccess(user.id, toolSlug);
  if (!access.allowed) redirect(`/pricing?tool=${encodeURIComponent(toolSlug)}`);
}

export type UsageCounts = {
  exhibitions: number;
  artworks: number;
  contacts: number;
};

// What the account has used against its plan limits: public exhibitions,
// library artworks and contacts. Storage is not counted here (files live
// in R2, not in the database). The storage limit is shown on the
// pricing page and enforced when billing lands.
export async function getUserUsage(userId: string): Promise<UsageCounts> {
  const [exhibitions, artworks, contacts] = await withDbRetry(() =>
    Promise.all([
      db.exhibition.count({ where: { ownerId: userId, status: "public" } }),
      db.libraryWork.count({ where: { ownerId: userId } }),
      db.contact.count({ where: { userId } }),
    ]),
  );
  return { exhibitions, artworks, contacts };
}

export type LimitCheck = {
  allowed: boolean;
  used: number;
  limit: number | null;
  paywallEnabled: boolean;
};

// Is there room left under the plan limit for one more of `key`? While
// the paywall is off, everything is allowed (free trial) but the counts
// are still reported, so the pricing page can show real usage.
export async function checkLimit(
  userId: string,
  key: "exhibitions" | "artworks" | "contacts",
): Promise<LimitCheck> {
  const [{ plan }, usage] = await Promise.all([
    getUserSubscription(userId),
    getUserUsage(userId),
  ]);
  const limit = plan.limits[key];
  const used = usage[key];
  const allowed = !PAYWALL_ENABLED || limit === null || used < limit;
  return { allowed, used, limit, paywallEnabled: PAYWALL_ENABLED };
}
