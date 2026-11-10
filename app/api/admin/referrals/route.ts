import { NextResponse } from "next/server";
import { requireAdminPermission } from "@/lib/admin";
import { getReferralStats } from "@/lib/referrals";

// Admin: referral numbers, all counted from the database. Per
// referrer code: how many people signed up with it, how many of them
// took a paid plan, and how many rewards were paid; plus the full
// referral list with each referred account's current plan. Readers
// need subscriptions.view.
export async function GET() {
  const access = await requireAdminPermission("subscriptions.view");
  if (!access) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  const stats = await getReferralStats();
  return NextResponse.json(stats);
}
