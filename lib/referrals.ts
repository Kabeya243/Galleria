import { Prisma } from "@prisma/client";
import { db, withDbRetry } from "@/lib/db";
import { getPlanBySlug, getUserSubscription } from "@/lib/subscriptions";

// Referrals (Nov 2026): every account has a unique referral code
// (letters from the name plus random characters, uppercase), shown on
// the "My plan" card with a shareable link. A new account can enter a
// code at signup (or the link prefills it); the referral stays pending
// until the invited account takes a paid plan, and then the referrer
// earns 1 free month: 1 free month of Creator when the referrer is on
// Discovery, or 1 free month credited on the referrer's current paid
// plan (freeMonths on the subscription, applied when billing starts).
// All numbers in the admin come from these rows, never invented.

const REFERRAL_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function randomSuffix(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) {
    out += REFERRAL_ALPHABET[Math.floor(Math.random() * REFERRAL_ALPHABET.length)];
  }
  return out;
}

export function normalizeReferralCode(raw: string): string {
  return raw.trim().toUpperCase();
}

// Code from the name: up to 5 letters of the name, a dash, 4 random
// characters. "Kabeya Ilunga" becomes KABEY-XXXX, "A B" becomes AB-XXXX.
export function buildReferralCode(name: string): string {
  const letters = name.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 5) || "LAKISA";
  return `${letters}-${randomSuffix(4)}`;
}

function addOneMonth(from: Date): Date {
  const end = new Date(from);
  end.setMonth(end.getMonth() + 1);
  return end;
}

// Give an account its referral code if it has none (accounts created
// before referrals shipped, or through Google sign-in, have none).
// Retries with a fresh random suffix on a collision.
export async function ensureReferralCode(userId: string): Promise<string> {
  const existing = await withDbRetry(() =>
    db.user.findUnique({ where: { id: userId }, select: { referralCode: true, name: true } }),
  );
  if (!existing) throw new Error("Account not found.");
  if (existing.referralCode) return existing.referralCode;
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = buildReferralCode(existing.name);
    try {
      const updated = await withDbRetry(() =>
        db.user.update({ where: { id: userId }, data: { referralCode: code }, select: { referralCode: true } }),
      );
      if (updated.referralCode) return updated.referralCode;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        continue;
      }
      throw error;
    }
  }
  throw new Error("Could not create a referral code.");
}

// Record that a new account signed up with a referrer's code. Returns
// the referrer's id, or null when the code is missing, unknown, or the
// account's own. An invalid code never fails the signup.
export async function recordReferral(rawCode: string, newUserId: string): Promise<string | null> {
  const code = normalizeReferralCode(rawCode);
  if (!code) return null;
  const referrer = await withDbRetry(() =>
    db.user.findUnique({ where: { referralCode: code }, select: { id: true } }),
  );
  if (!referrer || referrer.id === newUserId) return null;
  try {
    await withDbRetry(() =>
      db.$transaction(async (tx) => {
        await tx.referral.create({
          data: { referrerId: referrer.id, referredUserId: newUserId, status: "pending" },
        });
        await tx.user.update({
          where: { id: newUserId },
          data: { referredById: referrer.id },
        });
      }),
    );
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return null;
    }
    throw error;
  }
  return referrer.id;
}

export type ReferralReward =
  | { rewarded: false }
  | { rewarded: true; kind: "creator-month" | "free-month"; referrerId: string };

// When an account takes a paid plan, check whether it was referred:
// a pending referral becomes rewarded and the referrer earns 1 free
// month. On Discovery the referrer gets 1 free month of Creator (a
// fixed term that returns to Discovery at the end); on a paid plan the
// month is credited on the subscription (freeMonths). Only pending
// referrals are processed, so the reward is paid once.
export async function maybeRewardReferral(userId: string): Promise<ReferralReward> {
  const referral = await withDbRetry(() =>
    db.referral.findUnique({
      where: { referredUserId: userId },
      select: { id: true, referrerId: true, status: true },
    }),
  );
  if (!referral || referral.status !== "pending") return { rewarded: false };
  const { plan } = await getUserSubscription(userId);
  if (plan.slug === "discovery") return { rewarded: false };
  const referrerSub = await getUserSubscription(referral.referrerId);
  const now = new Date();
  if (referrerSub.plan.slug === "discovery") {
    const creator = await getPlanBySlug("creator");
    if (!creator) return { rewarded: false };
    await withDbRetry(() =>
      db.subscription.update({
        where: { id: referrerSub.subscription.id },
        data: {
          planId: creator.id,
          billingCycle: "single",
          status: "active",
          source: "referral",
          startedAt: now,
          endsAt: addOneMonth(now),
        },
      }),
    );
    await withDbRetry(() =>
      db.referral.update({ where: { id: referral.id }, data: { status: "rewarded" } }),
    );
    return { rewarded: true, kind: "creator-month", referrerId: referral.referrerId };
  }
  await withDbRetry(() =>
    db.subscription.update({
      where: { id: referrerSub.subscription.id },
      data: { freeMonths: { increment: 1 } },
    }),
  );
  await withDbRetry(() =>
    db.referral.update({ where: { id: referral.id }, data: { status: "rewarded" } }),
  );
  return { rewarded: true, kind: "free-month", referrerId: referral.referrerId };
}

export type ReferralStats = {
  byReferrer: Array<{
    referrerId: string;
    referrerName: string;
    referrerEmail: string;
    referralCode: string | null;
    signups: number;
    paidConversions: number;
    rewarded: number;
  }>;
  referrals: Array<{
    id: string;
    referrerName: string;
    referredName: string;
    referredEmail: string;
    referredPlanSlug: string | null;
    status: string;
    createdAt: string;
  }>;
};

// Referral numbers for the admin: per referrer code, how many people
// signed up with it, how many of them took a paid plan, and how many
// rewards were paid; plus the full referral list with each referred
// account's current plan. Everything is counted from the database.
export async function getReferralStats(): Promise<ReferralStats> {
  const [referrals, subscriptions] = await Promise.all([
    withDbRetry(() =>
      db.referral.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          referrer: { select: { id: true, name: true, email: true, referralCode: true } },
          referredUser: { select: { id: true, name: true, email: true } },
        },
      }),
    ),
    withDbRetry(() =>
      db.subscription.findMany({
        select: { userId: true, plan: { select: { slug: true } } },
      }),
    ),
  ]);
  const planByUser = new Map(subscriptions.map((s) => [s.userId, s.plan.slug]));
  const byReferrerMap = new Map<string, ReferralStats["byReferrer"][number]>();
  for (const r of referrals) {
    const entry = byReferrerMap.get(r.referrerId) ?? {
      referrerId: r.referrerId,
      referrerName: r.referrer.name,
      referrerEmail: r.referrer.email,
      referralCode: r.referrer.referralCode,
      signups: 0,
      paidConversions: 0,
      rewarded: 0,
    };
    entry.signups += 1;
    const referredPlan = planByUser.get(r.referredUserId);
    if (referredPlan && referredPlan !== "discovery") entry.paidConversions += 1;
    if (r.status === "rewarded") entry.rewarded += 1;
    byReferrerMap.set(r.referrerId, entry);
  }
  return {
    byReferrer: [...byReferrerMap.values()].sort((a, b) => b.signups - a.signups),
    referrals: referrals.map((r) => ({
      id: r.id,
      referrerName: r.referrer.name,
      referredName: r.referredUser.name,
      referredEmail: r.referredUser.email,
      referredPlanSlug: planByUser.get(r.referredUserId) ?? null,
      status: r.status,
      createdAt: r.createdAt.toISOString(),
    })),
  };
}
