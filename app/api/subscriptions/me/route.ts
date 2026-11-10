import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureReferralCode } from "@/lib/referrals";
import { PAYWALL_ENABLED, getUserSubscription, getUserUsage } from "@/lib/subscriptions";

// The signed-in account's subscription: its plan, its status and its
// usage against the plan limits, plus whether the paywall is on, and
// the account's referral code (created here for accounts that predate
// referrals, so every account can share its link from the "My plan"
// card). The pricing page and the "My plan" card read this. Signed-out
// visitors get 200 with { signedIn: false } instead of a 401, so the
// public pricing page loads without a console error for anonymous
// visitors; the callers treat that shape as "no subscription".
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ signedIn: false });
  const [{ subscription, plan }, usage, referralCode] = await Promise.all([
    getUserSubscription(user.id),
    getUserUsage(user.id),
    ensureReferralCode(user.id).catch(() => null),
  ]);
  return NextResponse.json({
    paywallEnabled: PAYWALL_ENABLED,
    plan,
    subscription: {
      ...subscription,
      startedAt: subscription.startedAt.toISOString(),
      endsAt: subscription.endsAt ? subscription.endsAt.toISOString() : null,
    },
    usage,
    referralCode,
  });
}
