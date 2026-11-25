"use client";

import { useCallback, useEffect, useState } from "react";
import { PlanChangeDialog, type PlanChangePayload } from "@/components/subscription-dialogs";
import { useLocale, useT } from "@/lib/i18n";
import { SHOW_PAID_PLANS } from "@/lib/plan-visibility";
import type { PlanDTO, SubscriptionDTO } from "@/lib/subscriptions";
import page from "./redesign-pages.module.css";
import dash from "./redesign-dashboard.module.css";

// "My plan" card (Nov 2026): the account's current plan and its usage
// against the plan limits, with a plan change flow, and the account's
// referral code with a shareable link. The parent decides where to
// mount it. Logged out, or any load error, it renders nothing.

type MeResponse = {
  paywallEnabled: boolean;
  plan: PlanDTO;
  subscription: SubscriptionDTO;
  usage: { exhibitions: number; artworks: number; contacts: number };
  referralCode: string | null;
};

export default function PlanCard() {
  const t = useT();
  const { locale } = useLocale();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [plans, setPlans] = useState<PlanDTO[]>([]);
  const [targetSlug, setTargetSlug] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const [meRes, plansRes] = await Promise.all([
        fetch("/api/subscriptions/me"),
        fetch("/api/subscriptions/plans"),
      ]);
      if (!meRes.ok) {
        setMe(null);
        return;
      }
      const meData = (await meRes.json()) as MeResponse & { signedIn?: boolean };
      // Anonymous visitors get { signedIn: false } (200, no console error).
      if (meData.signedIn === false) {
        setMe(null);
        return;
      }
      setMe(meData);
      if (plansRes.ok) {
        const plansData = (await plansRes.json()) as { plans: PlanDTO[] };
        setPlans(plansData.plans ?? []);
      }
    } catch {
      setMe(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (!me) return null;

  // Paid plans are hidden for now (Nov 2026, lib/plan-visibility.ts):
  // no plan change is offered from "My plan" either. Admin assignment
  // still works (it does not go through this card).
  const others = SHOW_PAID_PLANS
    ? plans.filter((p) => p.slug !== me.plan.slug && p.isActive)
    : [];
  const target = others.find((p) => p.slug === targetSlug) ?? others[0] ?? null;
  const billingCycle =
    me.subscription.billingCycle === "yearly"
      ? ("yearly" as const)
      : me.subscription.billingCycle === "single"
        ? ("single" as const)
        : ("monthly" as const);

  async function confirmChange(payload: PlanChangePayload) {
    const res = await fetch("/api/subscriptions/change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planSlug: target?.slug,
        billingCycle,
        promoCode: payload.promoCode,
        termsAccepted: payload.termsAccepted,
      }),
    });
    if (!res.ok) {
      if (res.status === 409) throw new Error(t("pricing", "billingNotConnected"));
      const data = (await res.json().catch(() => null)) as { error?: string; reason?: string } | null;
      if (data?.error === "promo_invalid") {
        const reason = data.reason ?? "not_found";
        const key =
          reason === "expired"
            ? "promoExpired"
            : reason === "already_used"
              ? "promoAlreadyUsed"
              : reason === "not_for_plan"
                ? "promoNotForPlan"
                : reason === "no_uses_left"
                  ? "promoNoUsesLeft"
                  : reason === "inactive"
                    ? "promoInactive"
                    : "promoInvalid";
        throw new Error(t("pricing", key));
      }
      if (data?.error === "terms_required") throw new Error(t("pricing", "termsRequired"));
      throw new Error(t("pricing", "changeFailed"));
    }
    setDialogOpen(false);
    await load();
  }

  async function copyReferralLink() {
    if (!me?.referralCode) return;
    const link = `${window.location.origin}/register?ref=${me.referralCode}`;
    try {
      await navigator.clipboard.writeText(link);
    } catch {
      const input = document.createElement("input");
      input.value = link;
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      document.body.removeChild(input);
    }
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2500);
  }

  const usageRows: Array<{ label: string; used: number; limit: number | null }> = [
    { label: t("pricing", "usageExhibitions"), used: me.usage.exhibitions, limit: me.plan.limits.exhibitions },
    { label: t("pricing", "usageArtworks"), used: me.usage.artworks, limit: me.plan.limits.artworks },
    { label: t("pricing", "usageContacts"), used: me.usage.contacts, limit: me.plan.limits.contacts },
  ];

  return (
    <div className={page.sectionStack}>
      <section className={dash.card} aria-label={t("pricing", "myPlan")}>
        <div className={dash.cardHead}>
          <div>
            <span className={dash.eyebrow}>{t("pricing", "myPlan")}</span>
            <h2>{me.plan.name}</h2>
            {me.subscription.billingCycle === "single" && me.subscription.endsAt && (
              <p className={dash.cardSub}>
                {t("pricing", "singleEnds")}{" "}
                {new Date(me.subscription.endsAt).toLocaleDateString(locale)}
              </p>
            )}
          </div>
          <span className={`${page.pill} ${page.pillLive}`}>
            {t("pricing", "currentPlan")}
          </span>
        </div>
        <div style={{ marginTop: 16 }}>
          {usageRows.map((row) => (
            <div key={row.label} className={page.barRow}>
              <span>{row.label}</span>
              <span className={page.barTrack}>
                <span
                  className={page.barFill}
                  style={{
                    width: row.limit ? `${Math.min(100, (row.used / row.limit) * 100)}%` : "100%",
                    display: "block",
                  }}
                />
              </span>
              <span className={`${page.barValue} ${dash.tnum}`}>
                {row.used} / {row.limit === null ? t("pricing", "unlimited") : row.limit}
              </span>
            </div>
          ))}
        </div>
      </section>

      {me.referralCode && (
        <section className={dash.card} aria-label={t("pricing", "referralTitle")}>
          <div className={dash.cardHead}>
            <div>
              <span className={dash.eyebrow}>{t("pricing", "referralTitle")}</span>
              <h2>{t("pricing", "referralTitle")}</h2>
              <p className={dash.cardSub}>{t("pricing", "referralShare")}</p>
            </div>
          </div>
          <div className={page.formActions} style={{ marginTop: 12 }}>
            <code
              style={{
                fontSize: 15,
                fontWeight: 700,
                letterSpacing: 1,
                padding: "8px 12px",
                border: "1px solid var(--rd-border)",
                borderRadius: 9,
                background: "var(--rd-surface-2)",
                color: "var(--rd-text)",
              }}
            >
              {me.referralCode}
            </code>
            <button type="button" className={page.btn} onClick={() => void copyReferralLink()}>
              {copied ? t("pricing", "referralCopied") : t("pricing", "referralCopyLink")}
            </button>
          </div>
        </section>
      )}

      {!SHOW_PAID_PLANS && me.plan.slug === "discovery" && (
        <p className={dash.cardSub}>{t("pricing", "paidPlansSoon")}</p>
      )}

      {target && (
        <section className={dash.card} aria-label={t("pricing", "changePlan")}>
          <div className={page.formActions}>
            <select
              value={target.slug}
              onChange={(event) => setTargetSlug(event.target.value)}
              aria-label={t("pricing", "changePlan")}
              className={page.select}
              style={{ maxWidth: 220 }}
            >
              {others.map((plan) => (
                <option key={plan.slug} value={plan.slug}>
                  {plan.name}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`${page.btn} ${page.btnCta}`}
              onClick={() => setDialogOpen(true)}
            >
              {t("pricing", "changePlan")}
            </button>
          </div>
        </section>
      )}

      {dialogOpen && target && (
        <PlanChangeDialog
          currentPlan={me.plan}
          targetPlan={target}
          billingCycle={billingCycle}
          paywallEnabled={me.paywallEnabled}
          onClose={() => setDialogOpen(false)}
          onConfirm={confirmChange}
        />
      )}
    </div>
  );
}
