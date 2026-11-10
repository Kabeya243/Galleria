"use client";

import { useCallback, useEffect, useState } from "react";
import { PlanChangeDialog } from "@/components/subscription-dialogs";
import { useLocale, useT } from "@/lib/i18n";
import type { PlanDTO, SubscriptionDTO } from "@/lib/subscriptions";

// "My plan" card (Nov 2026): the account's current plan and its usage
// against the plan limits, with a plan change flow. The parent decides
// where to mount it. Logged out, or any load error, it renders nothing.

type MeResponse = {
  paywallEnabled: boolean;
  plan: PlanDTO;
  subscription: SubscriptionDTO;
  usage: { exhibitions: number; artworks: number; contacts: number };
};

export default function PlanCard() {
  const t = useT();
  const { locale } = useLocale();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [plans, setPlans] = useState<PlanDTO[]>([]);
  const [targetSlug, setTargetSlug] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

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
      const meData = (await meRes.json()) as MeResponse;
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

  const others = plans.filter((p) => p.slug !== me.plan.slug && p.isActive);
  const target = others.find((p) => p.slug === targetSlug) ?? others[0] ?? null;
  const billingCycle =
    me.subscription.billingCycle === "yearly"
      ? ("yearly" as const)
      : me.subscription.billingCycle === "single"
        ? ("single" as const)
        : ("monthly" as const);

  async function confirmChange() {
    const res = await fetch("/api/subscriptions/change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ planSlug: target?.slug, billingCycle }),
    });
    if (!res.ok) {
      if (res.status === 409) throw new Error(t("pricing", "billingNotConnected"));
      throw new Error(t("pricing", "changeFailed"));
    }
    setDialogOpen(false);
    await load();
  }

  const usageRows: Array<{ label: string; used: number; limit: number | null }> = [
    { label: t("pricing", "usageExhibitions"), used: me.usage.exhibitions, limit: me.plan.limits.exhibitions },
    { label: t("pricing", "usageArtworks"), used: me.usage.artworks, limit: me.plan.limits.artworks },
    { label: t("pricing", "usageContacts"), used: me.usage.contacts, limit: me.plan.limits.contacts },
  ];

  return (
    <section
      style={{
        padding: 20,
        border: "1px solid var(--line)",
        borderRadius: 12,
        background: "var(--surface)",
      }}
    >
      <h2 style={{ margin: "0 0 4px", fontSize: 17 }}>{t("pricing", "myPlan")}</h2>
      <p style={{ margin: "0 0 16px", fontSize: 15, fontWeight: 700 }}>{me.plan.name}</p>
      {me.subscription.billingCycle === "single" && me.subscription.endsAt && (
        <p style={{ margin: "0 0 16px", fontSize: 13, color: "var(--muted)" }}>
          {t("pricing", "singleEnds")}{" "}
          {new Date(me.subscription.endsAt).toLocaleDateString(locale)}
        </p>
      )}
      <dl style={{ margin: "0 0 16px", display: "grid", gap: 8 }}>
        {usageRows.map((row) => (
          <div
            key={row.label}
            style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 13 }}
          >
            <dt style={{ color: "var(--muted)" }}>{row.label}</dt>
            <dd style={{ margin: 0, fontWeight: 600 }}>
              {row.used} / {row.limit === null ? t("pricing", "unlimited") : row.limit}
            </dd>
          </div>
        ))}
      </dl>
      {target && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={target.slug}
            onChange={(event) => setTargetSlug(event.target.value)}
            aria-label={t("pricing", "changePlan")}
            style={{
              height: 40,
              padding: "0 10px",
              border: "1px solid var(--line)",
              borderRadius: 999,
              background: "var(--paper)",
              color: "var(--ink)",
              font: "inherit",
              fontSize: 13,
            }}
          >
            {others.map((plan) => (
              <option key={plan.slug} value={plan.slug}>
                {plan.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            className="publish-dialog-submit"
            onClick={() => setDialogOpen(true)}
          >
            {t("pricing", "changePlan")}
          </button>
        </div>
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
    </section>
  );
}
