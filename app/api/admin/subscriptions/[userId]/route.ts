import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin";
import { db, withDbRetry } from "@/lib/db";
import {
  applyPromoToChange,
  validatePromoCode,
} from "@/lib/promo-codes";
import { maybeRewardReferral } from "@/lib/referrals";
import { getPlanBySlug } from "@/lib/subscriptions";

// Admin: change one account's plan (and optionally its status). Needs
// subscriptions.manage. The change is immediate and free while the
// paywall is off; it is how the manager moves an account between plans
// during the free trial. The manager cannot change the plan of an
// account that does not exist, and the target plan must exist and be
// active.
//
// Direct grant (Nov 2026): the manager can give a specific account a
// plan with a promo code and an explicit end date. A code is validated
// like a visitor's code (active, not expired, uses left, right plan,
// never used by this account) and its use is recorded; a "free" code
// grants the plan for its access duration when no end date is given.
// An explicit end date makes the term fixed: it ends on that date and
// the account returns to Discovery. Granting a paid plan also settles
// a pending referral for that account, if any.
const bodySchema = z.object({
  planSlug: z.enum(["discovery", "creator", "studio"]),
  status: z.enum(["active", "cancelled", "past_due"]).optional(),
  billingCycle: z.enum(["monthly", "yearly", "single"]).optional(),
  endsAt: z.string().datetime({ offset: true }).nullable().optional(),
  promoCode: z.string().trim().max(20).optional(),
});

function addOneMonth(from: Date): Date {
  const end = new Date(from);
  end.setMonth(end.getMonth() + 1);
  return end;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ userId: string }> },
) {
  const access = await requireAdminPermission("subscriptions.manage");
  if (!access) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const { userId } = await params;
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Pick a valid plan." }, { status: 400 });
  }
  const [account, plan] = await Promise.all([
    withDbRetry(() => db.user.findUnique({ where: { id: userId }, select: { id: true } })),
    getPlanBySlug(parsed.data.planSlug),
  ]);
  if (!account) {
    return NextResponse.json({ error: "That account does not exist." }, { status: 404 });
  }
  if (!plan || !plan.isActive) {
    return NextResponse.json({ error: "That plan is not available." }, { status: 400 });
  }
  const now = new Date();
  let billingCycle = parsed.data.billingCycle ?? "monthly";
  let endsAt: Date | null = parsed.data.endsAt ? new Date(parsed.data.endsAt) : null;
  let source = "admin";
  // Promo code, if one was given: validated and recorded like a
  // visitor's code. A code cannot be used for Discovery.
  if (parsed.data.promoCode) {
    if (plan.slug === "discovery") {
      return NextResponse.json(
        { error: "A promo code cannot be used for the free plan." },
        { status: 400 },
      );
    }
    const validation = await validatePromoCode(
      parsed.data.promoCode,
      plan,
      billingCycle,
      userId,
    );
    if (!validation.valid) {
      return NextResponse.json(
        { error: "That promo code cannot be used here.", reason: validation.reason },
        { status: 400 },
      );
    }
    try {
      const promoResult = await applyPromoToChange(
        validation.promo,
        userId,
        plan,
        billingCycle,
      );
      billingCycle = promoResult.billingCycle;
      if (!endsAt) endsAt = promoResult.endsAt;
      source = "promo";
    } catch (error) {
      if (error instanceof Error && error.message === "already_used") {
        return NextResponse.json(
          { error: "That account already used this promo code." },
          { status: 400 },
        );
      }
      throw error;
    }
  }
  // An explicit end date makes the term fixed: it ends on that date
  // and the account returns to Discovery (the existing "single" logic
  // in getUserSubscription). A "single" term without a date ends one
  // month after the grant.
  if (endsAt) {
    billingCycle = "single";
  } else if (billingCycle === "single") {
    endsAt = addOneMonth(now);
  }
  const updated = await withDbRetry(() =>
    db.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planId: plan.id,
        status: parsed.data.status ?? "active",
        billingCycle,
        source,
        startedAt: now,
        endsAt,
      },
      update: {
        planId: plan.id,
        status: parsed.data.status ?? "active",
        billingCycle,
        source,
        startedAt: now,
        endsAt,
      },
      include: { plan: true, user: { select: { id: true, name: true, email: true } } },
    }),
  );
  // Referral: granting a paid plan settles a pending referral for
  // this account, if any.
  if (plan.slug !== "discovery") {
    try {
      await maybeRewardReferral(userId);
    } catch (error) {
      console.error("Could not settle the referral reward.", error);
    }
  }
  return NextResponse.json({
    userId: updated.user.id,
    name: updated.user.name,
    email: updated.user.email,
    planId: updated.plan.id,
    planSlug: updated.plan.slug,
    planName: updated.plan.name,
    status: updated.status,
    billingCycle: updated.billingCycle,
    source: updated.source,
    startedAt: updated.startedAt.toISOString(),
    endsAt: updated.endsAt ? updated.endsAt.toISOString() : null,
  });
}
