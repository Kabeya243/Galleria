import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db, withDbRetry } from "@/lib/db";
import {
  applyPromoToChange,
  validatePromoCode,
} from "@/lib/promo-codes";
import { maybeRewardReferral } from "@/lib/referrals";
import { PAYWALL_ENABLED, getPlanBySlug, getUserSubscription } from "@/lib/subscriptions";

// Change the signed-in account's own plan. While the paywall is off
// (free trial, no payment connected yet) any change is free and
// immediate, so users can try every plan. Once the paywall is on, a
// change has no way to be paid here, so the route answers 409 until
// billing (Flutterwave / Pesapal) is connected — the switch is safe to
// flip only with billing in place. A "single" change is a fixed
// one-month term with no renewal: it ends one month after the change
// and the plan returns to Discovery (see getUserSubscription).
//
// Terms (Nov 2026): every change requires the visitor to tick "I
// accept the Terms of Use and the Privacy Policy" in the popup; the
// server rejects a call without termsAccepted, and records the
// acceptance date on the account.
//
// Promo codes (Nov 2026): an optional code is validated server-side
// (active, not expired, uses left, right plan, never used by this
// account) and recorded. A "free" code grants the plan for its access
// duration, then the account returns to Discovery; a "percent" code
// reduces the price shown (nothing is charged while billing is off).
// Taking a paid plan also settles a pending referral: the referrer
// earns 1 free month (see lib/referrals.ts).
const bodySchema = z.object({
  planSlug: z.enum(["discovery", "creator", "studio"]),
  billingCycle: z.enum(["monthly", "yearly", "single"]).optional().default("monthly"),
  promoCode: z.string().trim().max(20).optional(),
  termsAccepted: z.boolean(),
});

function addOneMonth(from: Date): Date {
  const end = new Date(from);
  end.setMonth(end.getMonth() + 1);
  return end;
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to change your plan." }, { status: 401 });
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
  if (!parsed.data.termsAccepted) {
    return NextResponse.json(
      { error: "terms_required", message: "Accept the Terms of Use and the Privacy Policy first." },
      { status: 400 },
    );
  }
  if (PAYWALL_ENABLED) {
    return NextResponse.json(
      { error: "billing_not_connected", message: "Payments are not connected yet, so plans cannot be changed to a paid plan right now." },
      { status: 409 },
    );
  }
  const plan = await getPlanBySlug(parsed.data.planSlug);
  if (!plan || !plan.isActive) {
    return NextResponse.json({ error: "That plan is not available." }, { status: 400 });
  }
  if (parsed.data.billingCycle === "single" && plan.singleMonthPriceUsd === 0) {
    return NextResponse.json({ error: "That plan has no one-month price." }, { status: 400 });
  }
  const { subscription } = await getUserSubscription(user.id);
  const startedAt = new Date();
  // Promo code, if one was entered: validated again server-side, never
  // trusted from the client. A code cannot be used for Discovery.
  let promoResult: Awaited<ReturnType<typeof applyPromoToChange>> | null = null;
  if (parsed.data.promoCode) {
    if (plan.slug === "discovery") {
      return NextResponse.json({ error: "A promo code cannot be used for the free plan." }, { status: 400 });
    }
    const validation = await validatePromoCode(
      parsed.data.promoCode,
      plan,
      parsed.data.billingCycle,
      user.id,
    );
    if (!validation.valid) {
      return NextResponse.json(
        { error: "promo_invalid", reason: validation.reason },
        { status: 400 },
      );
    }
    try {
      promoResult = await applyPromoToChange(
        validation.promo,
        user.id,
        plan,
        parsed.data.billingCycle,
      );
    } catch (error) {
      if (error instanceof Error && error.message === "already_used") {
        return NextResponse.json(
          { error: "promo_invalid", reason: "already_used" },
          { status: 400 },
        );
      }
      throw error;
    }
  }
  const billingCycle = promoResult ? promoResult.billingCycle : parsed.data.billingCycle;
  const endsAt = promoResult
    ? promoResult.endsAt ?? (promoResult.billingCycle === "single" ? addOneMonth(startedAt) : null)
    : parsed.data.billingCycle === "single"
      ? addOneMonth(startedAt)
      : null;
  const updated = await withDbRetry(() =>
    db.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: plan.id,
        billingCycle,
        status: "active",
        source: promoResult ? promoResult.source : "trial",
        startedAt,
        endsAt,
      },
      include: { plan: true },
    }),
  );
  // Terms acceptance is recorded on the account at every plan change.
  await withDbRetry(() =>
    db.user.update({ where: { id: user.id }, data: { termsAcceptedAt: new Date() } }),
  );
  // Referral: taking a paid plan settles a pending referral, if any.
  if (plan.slug !== "discovery") {
    try {
      await maybeRewardReferral(user.id);
    } catch (error) {
      console.error("Could not settle the referral reward.", error);
    }
  }
  return NextResponse.json({
    subscription: {
      id: updated.id,
      userId: updated.userId,
      planId: updated.planId,
      status: updated.status,
      billingCycle: updated.billingCycle,
      source: updated.source,
      startedAt: updated.startedAt.toISOString(),
      endsAt: updated.endsAt ? updated.endsAt.toISOString() : null,
    },
    plan,
  });
}
