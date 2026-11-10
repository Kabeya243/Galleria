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
// flip only with billing in place.
const bodySchema = z.object({
  planSlug: z.enum(["discovery", "creator", "studio"]),
  billingCycle: z.enum(["monthly", "yearly"]).optional().default("monthly"),
});

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
  const { subscription } = await getUserSubscription(user.id);
  const updated = await withDbRetry(() =>
    db.subscription.update({
      where: { id: subscription.id },
      data: {
        planId: plan.id,
        billingCycle: parsed.data.billingCycle,
        status: "active",
        source: "trial",
        startedAt: new Date(),
        endsAt: null,
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
