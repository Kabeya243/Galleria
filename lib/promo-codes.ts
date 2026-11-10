import { Prisma } from "@prisma/client";
import { db, withDbRetry } from "@/lib/db";
import type { BillingCycle, PlanDTO, PlanSlug } from "@/lib/subscriptions";

// Promo codes (Nov 2026): a code reduces the displayed price of a plan
// change (percent off) or grants free access for a number of days
// (free). The admin creates them in the Subscriptions section of
// /admin; a visitor applies one in the plan-change popup, and the
// admin can also grant a plan to a specific account with a code and an
// explicit end date. One use per account per code, enforced by the
// unique constraint on PromoCodeUse. No payment is integrated in this
// lot: a code reduces the price shown or grants free access, nothing
// is charged.

export type DiscountType = "percent" | "free";

export type PromoCodeDTO = {
  id: string;
  code: string;
  discountType: DiscountType;
  discountValue: number;
  applicablePlanSlugs: string[];
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date | null;
  accessDurationDays: number;
  isActive: boolean;
  createdByName: string;
  createdAt: Date;
};

type PromoCodeRow = {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  applicablePlanSlugs: unknown;
  maxUses: number | null;
  usedCount: number;
  expiresAt: Date | null;
  accessDurationDays: number;
  isActive: boolean;
  createdAt: Date;
  createdBy: { name: string };
};

export function normalizePromoCode(raw: string): string {
  return raw.trim().toUpperCase();
}

// A random code for the admin's "Generate" button: 8 uppercase
// letters and digits, no lookalikes (no 0, O, 1, I).
export function generatePromoCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function parsePromoSlugs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((v): v is string => typeof v === "string");
}

function toPromoDTO(row: PromoCodeRow): PromoCodeDTO {
  return {
    id: row.id,
    code: row.code,
    discountType: row.discountType === "free" ? "free" : "percent",
    discountValue: row.discountValue,
    applicablePlanSlugs: parsePromoSlugs(row.applicablePlanSlugs),
    maxUses: row.maxUses,
    usedCount: row.usedCount,
    expiresAt: row.expiresAt,
    accessDurationDays: row.accessDurationDays,
    isActive: row.isActive,
    createdByName: row.createdBy.name,
    createdAt: row.createdAt,
  };
}

export async function getAllPromoCodes(): Promise<PromoCodeDTO[]> {
  const rows = await withDbRetry(() =>
    db.promoCode.findMany({
      orderBy: { createdAt: "desc" },
      include: { createdBy: { select: { name: true } } },
    }),
  );
  return rows.map(toPromoDTO);
}

export async function getPromoCodeByCode(code: string): Promise<PromoCodeDTO | null> {
  const row = await withDbRetry(() =>
    db.promoCode.findUnique({
      where: { code: normalizePromoCode(code) },
      include: { createdBy: { select: { name: true } } },
    }),
  );
  return row ? toPromoDTO(row) : null;
}

export type PromoValidation =
  | { valid: true; promo: PromoCodeDTO; discountedPriceUsd: number }
  | { valid: false; reason: string };

// Why a code cannot be used: not_found, inactive, expired,
// no_uses_left, already_used, not_for_plan. The client maps each
// reason to a sentence in the visitor's language.
export async function validatePromoCode(
  rawCode: string,
  plan: PlanDTO,
  cycle: BillingCycle,
  userId: string,
): Promise<PromoValidation> {
  const code = normalizePromoCode(rawCode);
  if (!code) return { valid: false, reason: "not_found" };
  const promo = await getPromoCodeByCode(code);
  if (!promo) return { valid: false, reason: "not_found" };
  if (!promo.isActive) return { valid: false, reason: "inactive" };
  if (promo.expiresAt && promo.expiresAt.getTime() <= Date.now()) {
    return { valid: false, reason: "expired" };
  }
  if (promo.maxUses !== null && promo.usedCount >= promo.maxUses) {
    return { valid: false, reason: "no_uses_left" };
  }
  if (
    promo.applicablePlanSlugs.length > 0 &&
    !promo.applicablePlanSlugs.includes(plan.slug)
  ) {
    return { valid: false, reason: "not_for_plan" };
  }
  const alreadyUsed = await withDbRetry(() =>
    db.promoCodeUse.findUnique({
      where: { promoCodeId_userId: { promoCodeId: promo.id, userId } },
      select: { id: true },
    }),
  );
  if (alreadyUsed) return { valid: false, reason: "already_used" };
  return { valid: true, promo, discountedPriceUsd: discountedPrice(plan, cycle, promo) };
}

// The price after the code, for the chosen billing cycle. A "free"
// code makes it $0; a "percent" code takes the percentage off the
// cycle price. Discovery is $0 already, so a code changes nothing
// there (and the plan-change route refuses a code for Discovery).
export function discountedPrice(
  plan: PlanDTO,
  cycle: BillingCycle,
  promo: PromoCodeDTO,
): number {
  const base =
    cycle === "monthly"
      ? plan.monthlyPriceUsd
      : cycle === "yearly"
        ? plan.yearlyPriceUsd
        : plan.singleMonthPriceUsd;
  if (promo.discountType === "free") return 0;
  const percent = Math.min(Math.max(promo.discountValue, 0), 100);
  return Math.round(base * (1 - percent / 100) * 100) / 100;
}

export function addDays(from: Date, days: number): Date {
  const end = new Date(from);
  end.setDate(end.getDate() + days);
  return end;
}

// Record a use of a code by an account: one PromoCodeUse row and
// usedCount +1, in one transaction, so two simultaneous uses cannot
// both slip past the limit. Throws on a double use (unique
// constraint) — the caller turns that into "already_used".
export async function recordPromoUse(
  promoId: string,
  userId: string,
  planSlug: PlanSlug,
  discountValue: number,
): Promise<void> {
  await withDbRetry(() =>
    db.$transaction(async (tx) => {
      await tx.promoCodeUse.create({
        data: { promoCodeId: promoId, userId, planSlug, discountValue },
      });
      await tx.promoCode.update({
        where: { id: promoId },
        data: { usedCount: { increment: 1 } },
      });
    }),
  );
}

// Apply a validated code to a plan change: record the use and return
// the subscription fields the change should write. A "free" code
// grants the plan for accessDurationDays (a fixed term that returns
// to Discovery at the end, through the existing "single" logic); a
// "percent" code keeps the chosen cycle and only the price shown
// changes, since no payment exists yet.
export async function applyPromoToChange(
  promo: PromoCodeDTO,
  userId: string,
  plan: PlanDTO,
  cycle: BillingCycle,
): Promise<{ billingCycle: BillingCycle; endsAt: Date | null; source: string }> {
  try {
    await recordPromoUse(promo.id, userId, plan.slug, promo.discountValue);
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new Error("already_used");
    }
    throw error;
  }
  if (promo.discountType === "free") {
    return {
      billingCycle: "single",
      endsAt: addDays(new Date(), promo.accessDurationDays),
      source: "promo",
    };
  }
  return { billingCycle: cycle, endsAt: null, source: "promo" };
}
