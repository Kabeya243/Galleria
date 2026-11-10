import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { validatePromoCode } from "@/lib/promo-codes";
import { getPlanBySlug } from "@/lib/subscriptions";

// Validate a promo code for a plan change, before the visitor
// confirms: is the code active, not expired, with uses left, for the
// right plan, and never used by this account? Answers the discount
// (percent off, or free access for a number of days) and the price
// after the code, so the popup can show the discount before the
// visitor confirms. Signed-in only; the plan change itself validates
// again server-side, never trusting this check.
export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to check a promo code." }, { status: 401 });
  const url = new URL(request.url);
  const code = url.searchParams.get("code") ?? "";
  const planSlug = url.searchParams.get("planSlug") ?? "";
  const cycleParam = url.searchParams.get("cycle") ?? "monthly";
  const billingCycle =
    cycleParam === "yearly" ? ("yearly" as const) : cycleParam === "single" ? ("single" as const) : ("monthly" as const);
  const plan = await getPlanBySlug(planSlug);
  if (!plan) {
    return NextResponse.json({ valid: false, reason: "not_found" });
  }
  const validation = await validatePromoCode(code, plan, billingCycle, user.id);
  if (!validation.valid) {
    return NextResponse.json({ valid: false, reason: validation.reason });
  }
  return NextResponse.json({
    valid: true,
    code: validation.promo.code,
    discountType: validation.promo.discountType,
    discountValue: validation.promo.discountValue,
    accessDurationDays: validation.promo.accessDurationDays,
    discountedPriceUsd: validation.discountedPriceUsd,
  });
}
