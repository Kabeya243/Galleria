import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin";
import { db, withDbRetry } from "@/lib/db";
import { getAllPlans } from "@/lib/subscriptions";

// Admin: every subscription, newest first, with the account and the
// plan, plus the subscriber count per plan. Readers need
// subscriptions.view; the dashboard page itself is not touched by this
// route, so the API is the read surface for the admin section.
export async function GET() {
  const access = await requireAdminPermission("subscriptions.view");
  if (!access) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const [subscriptions, plans, byPlan] = await Promise.all([
    withDbRetry(() =>
      db.subscription.findMany({
        orderBy: { createdAt: "desc" },
        take: 500,
        include: {
          user: { select: { id: true, name: true, email: true, createdAt: true } },
          plan: true,
        },
      }),
    ),
    getAllPlans(),
    withDbRetry(() => db.subscription.groupBy({ by: ["planId"], _count: { _all: true } })),
  ]);
  const planById = new Map(plans.map((p) => [p.id, p]));
  const stats = byPlan.map((row) => ({
    planId: row.planId,
    planSlug: planById.get(row.planId)?.slug ?? "unknown",
    planName: planById.get(row.planId)?.name ?? "Unknown plan",
    count: row._count._all,
  }));
  return NextResponse.json({
    stats,
    subscriptions: subscriptions.map((s) => ({
      userId: s.user.id,
      name: s.user.name,
      email: s.user.email,
      joinedAt: s.user.createdAt.toISOString(),
      planId: s.plan.id,
      planSlug: s.plan.slug,
      planName: s.plan.name,
      status: s.status,
      billingCycle: s.billingCycle,
      source: s.source,
      startedAt: s.startedAt.toISOString(),
      endsAt: s.endsAt ? s.endsAt.toISOString() : null,
    })),
  });
}
