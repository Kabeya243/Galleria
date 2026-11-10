import { redirect } from "next/navigation";
import { isAdminEmail } from "@/lib/auth";
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

// Billing cycles: monthly and yearly subscriptions renew; "single" is
// a fixed one-month term with no renewal (Creator $5.99, Studio $29).
// When a single term ends, the plan returns to Discovery.
export type BillingCycle = "monthly" | "yearly" | "single";

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
  singleMonthPriceUsd: number;
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
// prices, Table 5 for tools and limits), with the November 2026 price
// decision applied: Creator is $4.99/month and $49.90/year (2 months
// free) with a 100 AI actions/month quota, and every paid plan offers a
// one-month-only price (Creator $5.99, Studio $29, no renewal).
// Feature lines are the plan data shown on the pricing page, in display
// order. Limits use null for unlimited and 0 for not included.
const PLAN_DEFAULTS: Array<{
  slug: PlanSlug;
  name: string;
  tagline: string;
  description: string;
  monthlyPriceUsd: number;
  yearlyPriceUsd: number;
  singleMonthPriceUsd: number;
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
    singleMonthPriceUsd: 0,
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
    monthlyPriceUsd: 4.99,
    yearlyPriceUsd: 49.9,
    singleMonthPriceUsd: 5.99,
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
      "100 AI actions per month",
    ],
    limits: { exhibitions: 10, artworks: 100, storageGb: 20, contacts: null, inventory: null, aiActionsPerMonth: 100 },
    sortOrder: 1,
  },
  {
    slug: "studio",
    name: "Studio",
    tagline: "For galleries, collectives and full sites",
    description: "For galleries, collectives and artists who want their own site: everything in Creator, plus the Website Builder and advanced tools.",
    monthlyPriceUsd: 25,
    yearlyPriceUsd: 250,
    singleMonthPriceUsd: 29,
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
  singleMonthPriceUsd: number;
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
    singleMonthPriceUsd: row.singleMonthPriceUsd,
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
// it never overwrites a plan the manager edited in the admin. After
// seeding, syncCreatorPricing applies the November 2026 price decision
// to rows that still hold the old defaults (see below).
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
          singleMonthPriceUsd: def.singleMonthPriceUsd,
          features: def.features,
          limits: def.limits,
          sortOrder: def.sortOrder,
        },
      });
    }
  });
  await syncCreatorPricing();
}

// One-time price update (Nov 2026): Kabeya cut the Creator price from
// $8/$80 to $4.99/$49.90 and the Creator AI quota from 200 to 100
// actions/month, and added a one-month-only price ($5.99 Creator, $29
// Studio, no renewal). Rows already in the database still carry the old
// values, and the seed above never overwrites an admin edit, so this
// applies the decided prices to rows that still hold the old defaults
// only. A row the manager already edited to other prices is left alone;
// the one-month price is only filled when it is still unset (0) on a
// paid plan, never overwritten once set.
async function syncCreatorPricing(): Promise<void> {
  await withDbRetry(async () => {
    const creator = await db.subscriptionPlan.findUnique({ where: { slug: "creator" } });
    if (creator) {
      const limits = (creator.limits ?? {}) as Record<string, unknown>;
      const holdsOldPrices =
        creator.monthlyPriceUsd === 8 &&
        creator.yearlyPriceUsd === 80 &&
        limits.aiActionsPerMonth === 200;
      if (holdsOldPrices) {
        const features: string[] = Array.isArray(creator.features)
          ? creator.features
              .filter((f): f is string => typeof f === "string")
              .map((f) => f.replace("200 AI actions per month", "100 AI actions per month"))
          : [];
        await db.subscriptionPlan.update({
          where: { slug: "creator" },
          data: {
            monthlyPriceUsd: 4.99,
            yearlyPriceUsd: 49.9,
            singleMonthPriceUsd: 5.99,
            features,
            limits: { ...limits, aiActionsPerMonth: 100 },
          },
        });
      } else if (creator.singleMonthPriceUsd === 0) {
        await db.subscriptionPlan.update({
          where: { slug: "creator" },
          data: { singleMonthPriceUsd: 5.99 },
        });
      }
    }
    const studio = await db.subscriptionPlan.findUnique({ where: { slug: "studio" } });
    if (studio && studio.singleMonthPriceUsd === 0) {
      await db.subscriptionPlan.update({
        where: { slug: "studio" },
        data: { singleMonthPriceUsd: 29 },
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
    // A one-month-only term that ended returns the account to
    // Discovery: no renewal, no charge, no lock.
    if (
      existing.billingCycle === "single" &&
      existing.endsAt &&
      existing.endsAt.getTime() <= Date.now()
    ) {
      const discovery = await getPlanBySlug("discovery");
      if (!discovery) throw new Error("Discovery plan is missing");
      const downgraded = await withDbRetry(() =>
        db.subscription.update({
          where: { id: existing.id },
          data: {
            planId: discovery.id,
            status: "active",
            billingCycle: "monthly",
            source: "trial",
            startedAt: new Date(),
            endsAt: null,
          },
          include: { plan: true },
        }),
      );
      return { subscription: toSubscriptionDTO(downgraded), plan: toPlanDTO(downgraded.plan) };
    }
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
  // The manager (platform owner) and sub-admins never pay and always
  // have every tool, whatever plan their account shows (Nov 2026).
  isAdmin: boolean;
};

// Is this account the platform owner or a sub-admin? The owner is the
// account whose email is in ADMIN_EMAILS; a sub-admin holds a SubAdmin
// grant. Checked on every call, so revoking a grant takes effect
// immediately. Admin accounts never pay: their plan is only a label,
// the access check below always lets them through.
export async function isAdminAccount(userId: string): Promise<boolean> {
  const user = await withDbRetry(() =>
    db.user.findUnique({
      where: { id: userId },
      select: { email: true, subAdminGrant: { select: { id: true } } },
    }),
  );
  if (!user) return false;
  if (isAdminEmail(user.email)) return true;
  return Boolean(user.subAdminGrant);
}

// Can this account open this tool? While the paywall is off, everything
// is allowed (free trial). When it is on, the account needs at least the
// tool's minimum plan, except admin accounts, which always pass.
export async function getToolAccess(userId: string, toolSlug: string): Promise<ToolAccess> {
  const requiredPlanSlug = TOOL_PLAN[toolSlug] ?? "discovery";
  const [planSlug, isAdmin] = await Promise.all([
    getUserPlanSlug(userId),
    isAdminAccount(userId),
  ]);
  const allowed =
    isAdmin || !PAYWALL_ENABLED || planRank(planSlug) >= planRank(requiredPlanSlug);
  return { allowed, planSlug, requiredPlanSlug, paywallEnabled: PAYWALL_ENABLED, isAdmin };
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
// are still reported, so the pricing page can show real usage. Admin
// accounts are never blocked by a plan limit.
export async function checkLimit(
  userId: string,
  key: "exhibitions" | "artworks" | "contacts",
): Promise<LimitCheck> {
  const [{ plan }, usage, isAdmin] = await Promise.all([
    getUserSubscription(userId),
    getUserUsage(userId),
    isAdminAccount(userId),
  ]);
  const limit = plan.limits[key];
  const used = usage[key];
  const allowed = isAdmin || !PAYWALL_ENABLED || limit === null || used < limit;
  return { allowed, used, limit, paywallEnabled: PAYWALL_ENABLED };
}
