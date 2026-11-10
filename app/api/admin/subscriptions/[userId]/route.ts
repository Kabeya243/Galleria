import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin";
import { db, withDbRetry } from "@/lib/db";
import { getPlanBySlug } from "@/lib/subscriptions";

// Admin: change one account's plan (and optionally its status). Needs
// subscriptions.manage. The change is immediate and free while the
// paywall is off; it is how the manager moves an account between plans
// during the free trial. The manager cannot change the plan of an
// account that does not exist, and the target plan must exist and be
// active.
const bodySchema = z.object({
  planSlug: z.enum(["discovery", "creator", "studio"]),
  status: z.enum(["active", "cancelled", "past_due"]).optional(),
});

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
  const updated = await withDbRetry(() =>
    db.subscription.upsert({
      where: { userId },
      create: {
        userId,
        planId: plan.id,
        status: parsed.data.status ?? "active",
        billingCycle: "monthly",
        source: "admin",
      },
      update: {
        planId: plan.id,
        status: parsed.data.status ?? "active",
        source: "admin",
        startedAt: new Date(),
        endsAt: null,
      },
      include: { plan: true, user: { select: { id: true, name: true, email: true } } },
    }),
  );
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
