import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db, withDbRetry } from "@/lib/db";
import { PAYWALL_ENABLED, getPlanBySlug, getUserSubscription } from "@/lib/subscriptions";

// Change the signed-in account's own plan. While the paywall is off
// (free trial, no payment connected yet) any change is free and
// immediate, so users can try every plan. Once the paywall is on, a
// change has no way to be paid here, so the route answers 409 until
// billing (Flutterwave / Pesapal) is connected — the switch is safe to
// flip only with billing in place. A "single" change is a fixed
// one-month term with no renewal: it ends one month after the change
// and the plan returns to Discovery (see getUserSubscription).
const bodySchema = z.object({
  planSlug: z.enum(["discovery", "creator", "studio"]),
  billingCycle: z.enum(["monthly", "yearly", "single"]).optional().default("monthly"),
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
  const updated = await withDbRetry(() =>
    db.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: plan.id,
        billingCycle: parsed.data.billingCycle,
        status: "active",
        source: "trial",
        startedAt,
        endsAt: parsed.data.billingCycle === "single" ? addOneMonth(startedAt) : null,
      },
      include: { plan: true },
    }),
  );
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
