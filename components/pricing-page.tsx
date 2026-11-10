"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { ArrowLeft, Check, X } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import SiteFooter from "@/components/site-footer";
import { PlanChangeDialog, ToolLockedDialog, type PlanChangePayload } from "@/components/subscription-dialogs";
import { useLocale, useT, type DictionarySection } from "@/lib/i18n";
import type { PlanDTO, PlanSlug, SubscriptionDTO } from "@/lib/subscriptions";
import styles from "./pricing-page.module.css";

// /pricing: public pricing page. The three Lakisa plans come from
// GET /api/subscriptions/plans (never hardcoded), a monthly/yearly
// toggle, a full comparison table and a FAQ. The paywall is off, so
// everything is free to try and the page says so plainly.
// ?tool=<slug> opens the locked-tool dialog for that tool.

// Mirror of TOOL_PLAN / HUB_TOOLS in lib/subscriptions.ts (slug, hub
// href and minimum plan), kept local on purpose: that module imports
// Prisma through lib/db, so a value import would pull the database
// client into this browser bundle. Keep the two lists in sync.
const TOOL_INFO: Array<{ slug: string; href: string; titleKey: DictionarySection<"tools">; minPlan: PlanSlug }> = [
  { slug: "art-in-context", href: "/tools/art-in-context", titleKey: "artInContext", minPlan: "studio" },
  { slug: "price-your-work", href: "/tools/price-your-work", titleKey: "priceYourWork", minPlan: "creator" },
  { slug: "inventory", href: "/tools/inventory", titleKey: "inventory", minPlan: "discovery" },
  { slug: "contacts", href: "/tools/contacts", titleKey: "contacts", minPlan: "discovery" },
  { slug: "documents", href: "/tools/documents", titleKey: "documents", minPlan: "creator" },
  { slug: "frames-walls", href: "/tools/frames-walls", titleKey: "framesWalls", minPlan: "creator" },
  { slug: "photography-lab", href: "/tools/photography-lab", titleKey: "photographyLab", minPlan: "creator" },
  { slug: "exhibition-planner", href: "/tools/exhibition-planner", titleKey: "exhibitionPlanner", minPlan: "creator" },
  { slug: "open-calls", href: "/tools/open-calls", titleKey: "openCalls", minPlan: "creator" },
  { slug: "image-to-3d", href: "/tools/image-to-3d", titleKey: "imageTo3d", minPlan: "studio" },
  { slug: "video-generator", href: "/tools/video-generator", titleKey: "videoGenerator", minPlan: "studio" },
  { slug: "website-builder", href: "/tools/website-builder/advanced", titleKey: "websiteBuilder", minPlan: "studio" },
  { slug: "portfolio-pdf", href: "/tools/portfolio-pdf", titleKey: "portfolioPdf", minPlan: "creator" },
  { slug: "marketplace", href: "/marketplace", titleKey: "marketplace", minPlan: "creator" },
];

function planRank(slug: PlanSlug): number {
  return slug === "discovery" ? 0 : slug === "creator" ? 1 : 2;
}

type MeResponse = {
  paywallEnabled: boolean;
  plan: PlanDTO;
  subscription: SubscriptionDTO;
  usage: { exhibitions: number; artworks: number; contacts: number };
};

const UGX_PER_USD = 4100;

export default function PricingPage() {
  const t = useT();
  const { locale } = useLocale();
  const [plans, setPlans] = useState<PlanDTO[] | null>(null);
  const [plansError, setPlansError] = useState(false);
  const [me, setMe] = useState<MeResponse | null>(null);
  const [meLoaded, setMeLoaded] = useState(false);
  const [cycle, setCycle] = useState<"monthly" | "yearly" | "single">("monthly");
  const [changeTarget, setChangeTarget] = useState<PlanDTO | null>(null);

  const loadPlans = useCallback(async () => {
    setPlansError(false);
    try {
      const res = await fetch("/api/subscriptions/plans");
      if (!res.ok) throw new Error("plans failed");
      const data = (await res.json()) as { plans: PlanDTO[] };
      setPlans(data.plans ?? []);
    } catch {
      setPlansError(true);
    }
  }, []);

  const loadMe = useCallback(async () => {
    try {
      const res = await fetch("/api/subscriptions/me");
      if (!res.ok) {
        setMe(null);
        return;
      }
      setMe((await res.json()) as MeResponse);
    } catch {
      setMe(null);
    } finally {
      setMeLoaded(true);
    }
  }, []);

  useEffect(() => {
    void loadPlans();
    void loadMe();
  }, [loadPlans, loadMe]);

  const formatUgx = (usd: number) =>
    new Intl.NumberFormat(locale).format(usd * UGX_PER_USD);

  async function confirmChange(payload: PlanChangePayload) {
    if (!changeTarget) return;
    const res = await fetch("/api/subscriptions/change", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        planSlug: changeTarget.slug,
        billingCycle: cycle,
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
    setChangeTarget(null);
    await loadMe();
  }

  const priceText = (plan: PlanDTO) => {
    if (cycle === "monthly") {
      return plan.monthlyPriceUsd === 0
        ? t("pricing", "free")
        : `$${plan.monthlyPriceUsd}`;
    }
    if (cycle === "yearly") {
      return plan.yearlyPriceUsd === 0 ? t("pricing", "free") : `$${plan.yearlyPriceUsd}`;
    }
    return plan.singleMonthPriceUsd === 0
      ? t("pricing", "free")
      : `$${plan.singleMonthPriceUsd}`;
  };

  const priceSuffix = (plan: PlanDTO) => {
    const usd =
      cycle === "monthly"
        ? plan.monthlyPriceUsd
        : cycle === "yearly"
          ? plan.yearlyPriceUsd
          : plan.singleMonthPriceUsd;
    if (usd === 0) return null;
    return t(
      "pricing",
      cycle === "monthly" ? "perMonth" : cycle === "yearly" ? "perYear" : "perOneMonth",
    );
  };

  const ugxText = (plan: PlanDTO) => {
    const usd =
      cycle === "monthly"
        ? plan.monthlyPriceUsd
        : cycle === "yearly"
          ? plan.yearlyPriceUsd
          : plan.singleMonthPriceUsd;
    if (usd === 0) return null;
    return `≈ ${formatUgx(usd)} ${t(
      "pricing",
      cycle === "monthly" ? "ugxPerMonth" : cycle === "yearly" ? "ugxPerYear" : "ugxOneMonth",
    )}`;
  };

  const limitText = (limit: number | null) =>
    limit === null ? t("pricing", "unlimited") : String(limit);

  const included = (plan: PlanDTO, minPlan: PlanSlug) =>
    planRank(plan.slug) >= planRank(minPlan);

  type Cell = { kind: "yes" } | { kind: "no" } | { kind: "text"; text: string };
  const yes: Cell = { kind: "yes" };
  const no: Cell = { kind: "no" };
  const text = (value: string): Cell => ({ kind: "text", text: value });

  const rows: Array<{ label: string; value: (plan: PlanDTO) => Cell }> = [
    {
      label: t("pricing", "rowPrice"),
      value: (p) => {
        const usd =
          cycle === "monthly"
            ? p.monthlyPriceUsd
            : cycle === "yearly"
              ? p.yearlyPriceUsd
              : p.singleMonthPriceUsd;
        if (usd === 0) return text(t("pricing", "free"));
        const suffix = t(
          "pricing",
          cycle === "monthly" ? "perMonth" : cycle === "yearly" ? "perYear" : "perOneMonth",
        );
        return text(`$${usd} ${suffix}`);
      },
    },
    { label: t("pricing", "rowGallery"), value: (p) => text(p.slug === "discovery" ? t("pricing", "galleryBase") : t("pricing", "galleryAll")) },
    { label: t("pricing", "rowExhibitions"), value: (p) => text(limitText(p.limits.exhibitions)) },
    { label: t("pricing", "rowArtworks"), value: (p) => text(limitText(p.limits.artworks)) },
    { label: t("pricing", "rowStorage"), value: (p) => text(p.limits.storageGb === null ? t("pricing", "unlimited") : `${p.limits.storageGb} GB`) },
    { label: t("pricing", "rowFeedMessaging"), value: () => yes },
    { label: t("pricing", "rowSearch"), value: () => yes },
    { label: t("pricing", "rowContacts"), value: (p) => text(limitText(p.limits.contacts)) },
    { label: t("pricing", "rowInventory"), value: (p) => text(limitText(p.limits.inventory)) },
    { label: t("pricing", "rowPriceYourWork"), value: (p) => (included(p, "creator") ? yes : no) },
    { label: t("pricing", "rowDocuments"), value: (p) => (included(p, "creator") ? yes : no) },
    { label: t("pricing", "rowPortfolioPdf"), value: (p) => (included(p, "creator") ? yes : no) },
    { label: t("pricing", "rowFramesWalls"), value: (p) => (included(p, "creator") ? yes : no) },
    { label: t("pricing", "rowPhotographyLab"), value: (p) => (included(p, "creator") ? yes : no) },
    { label: t("pricing", "rowExhibitionPlanner"), value: (p) => (included(p, "creator") ? yes : no) },
    { label: t("pricing", "rowOpenCalls"), value: (p) => (included(p, "creator") ? yes : no) },
    { label: t("pricing", "rowSubdomain"), value: (p) => (included(p, "creator") ? yes : no) },
    { label: t("pricing", "rowBasicStats"), value: (p) => (included(p, "creator") ? yes : no) },
    { label: t("pricing", "rowWebsiteBuilder"), value: (p) => (included(p, "studio") ? yes : no) },
    { label: t("pricing", "rowImageTo3d"), value: (p) => (included(p, "studio") ? yes : no) },
    { label: t("pricing", "rowArtInContext"), value: (p) => (included(p, "studio") ? yes : no) },
    { label: t("pricing", "rowAdvancedAnalytics"), value: (p) => (included(p, "studio") ? yes : no) },
    { label: t("pricing", "rowSubAdmins"), value: (p) => (included(p, "studio") ? yes : no) },
    { label: t("pricing", "rowWhiteLabel"), value: (p) => (included(p, "studio") ? yes : no) },
    { label: t("pricing", "rowPrioritySupport"), value: (p) => (included(p, "studio") ? yes : no) },
    {
      label: t("pricing", "rowAiQuota"),
      value: (p) =>
        p.limits.aiActionsPerMonth === null
          ? text(t("pricing", "unlimited"))
          : p.limits.aiActionsPerMonth === 0
            ? no
            : text(`${p.limits.aiActionsPerMonth} ${t("pricing", "perMonth")}`),
    },
    { label: t("pricing", "rowCommission"), value: (p) => text(p.slug === "studio" ? "5%" : "10%") },
    {
      label: t("pricing", "rowVideoGenerator"),
      value: (p) =>
        included(p, "studio")
          ? text(`${t("pricing", "included")} ${t("pricing", "whenActive")}`)
          : no,
    },
  ];

  const faqs = [
    { q: t("pricing", "faq1q"), a: t("pricing", "faq1a") },
    { q: t("pricing", "faq2q"), a: t("pricing", "faq2a") },
    { q: t("pricing", "faq3q"), a: t("pricing", "faq3a") },
    { q: t("pricing", "faq4q"), a: t("pricing", "faq4a") },
    { q: t("pricing", "faq5q"), a: t("pricing", "faq5a") },
  ];

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          <BrandLogo variant="horizontal" theme="dark" height={52} />
        </Link>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={15} /> {t("pricing", "backHome")}
        </Link>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>{t("pricing", "eyebrow")}</p>
        <h1 className={styles.title}>{t("pricing", "title")}</h1>
        <p className={styles.intro}>{t("pricing", "intro")}</p>
        <div className={styles.toggle} role="group" aria-label={t("pricing", "eyebrow")}>
          <button type="button" aria-pressed={cycle === "monthly"} onClick={() => setCycle("monthly")}>
            {t("pricing", "monthly")}
          </button>
          <button type="button" aria-pressed={cycle === "yearly"} onClick={() => setCycle("yearly")}>
            {t("pricing", "yearly")}{" "}
            <span className={styles.toggleSave}>({t("pricing", "yearlySave")})</span>
          </button>
          <button type="button" aria-pressed={cycle === "single"} onClick={() => setCycle("single")}>
            {t("pricing", "single")}{" "}
            <span className={styles.toggleSave}>({t("pricing", "singleNote")})</span>
          </button>
        </div>
      </section>

      <div className={styles.trialNote}>
        <p>{t("pricing", "freeTrialNote")}</p>
      </div>

      <section className={styles.section} aria-label={t("pricing", "eyebrow")}>
        {plans === null && !plansError && (
          <p className={styles.status}>{t("pricing", "loadingPlans")}</p>
        )}
        {plansError && (
          <p className={`${styles.status} ${styles.statusError}`}>
            {t("pricing", "plansError")}
            <button type="button" className={styles.retryButton} onClick={() => void loadPlans()}>
              {t("pricing", "tryAgain")}
            </button>
          </p>
        )}
        {plans !== null && (
          <>
            <div className={styles.plans}>
              {plans.map((plan) => {
                const isCurrent = me?.plan.slug === plan.slug;
                const suffix = priceSuffix(plan);
                const ugx = ugxText(plan);
                return (
                  <article
                    key={plan.slug}
                    className={`${styles.planCard} ${plan.slug === "creator" ? styles.planCardPopular : ""}`}
                  >
                    {isCurrent && (
                      <span className={styles.planBadge}>{t("pricing", "yourPlan")}</span>
                    )}
                    <h3 className={styles.planName}>{plan.name}</h3>
                    <p className={styles.planTagline}>{plan.tagline}</p>
                    <p className={styles.planPrice}>
                      {priceText(plan)}
                      {suffix && <span>{suffix}</span>}
                    </p>
                    {ugx && <p className={styles.planUgx}>{ugx}</p>}
                    <p className={styles.planDescription}>{plan.description}</p>
                    <ul className={styles.planFeatures}>
                      {plan.features.map((feature) => (
                        <li key={feature}>
                          <Check size={15} aria-hidden="true" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <div className={styles.planAction}>
                      {meLoaded && me && !isCurrent && (
                        <button
                          type="button"
                          className={styles.planButton}
                          onClick={() => setChangeTarget(plan)}
                        >
                          {t("pricing", "choose")} {plan.name}
                        </button>
                      )}
                      {meLoaded && !me && (
                        <Link href="/register" className={styles.planButton}>
                          {t("pricing", "createAccount")}
                        </Link>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
            {meLoaded && !me && (
              <p className={styles.signInLine}>
                {t("pricing", "alreadyHaveAccount")}{" "}
                <Link href="/login">{t("pricing", "signIn")}</Link>
              </p>
            )}
          </>
        )}
      </section>

      {plans !== null && (
        <section className={styles.section} id="compare">
          <h2>{t("pricing", "compareTitle")}</h2>
          <p className={styles.sectionIntro}>{t("pricing", "compareIntro")}</p>
          <div className={styles.tableScroll}>
            <table className={styles.compareTable}>
              <thead>
                <tr>
                  <th scope="col" aria-label={t("pricing", "compareTitle")} />
                  {plans.map((plan) => (
                    <th key={plan.slug} scope="col">
                      {plan.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label}>
                    <th scope="row">{row.label}</th>
                    {plans.map((plan) => {
                      const cell = row.value(plan);
                      return (
                        <td key={plan.slug}>
                          {cell.kind === "yes" && (
                            <span aria-label={t("pricing", "included")}>
                              <Check size={16} aria-hidden="true" />
                            </span>
                          )}
                          {cell.kind === "no" && (
                            <span className={styles.cellMuted} aria-label={t("pricing", "notIncluded")}>
                              <X size={16} aria-hidden="true" />
                            </span>
                          )}
                          {cell.kind === "text" && cell.text}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      <section className={styles.section} id="faq">
        <h2>{t("pricing", "faqTitle")}</h2>
        <div className={styles.faq}>
          {faqs.map((faq) => (
            <article key={faq.q}>
              <h3>{faq.q}</h3>
              <p>{faq.a}</p>
            </article>
          ))}
        </div>
      </section>

      <Suspense fallback={null}>
        <PricingToolGate plans={plans} me={me} />
      </Suspense>

      {changeTarget && me && (
        <PlanChangeDialog
          currentPlan={me.plan}
          targetPlan={changeTarget}
          billingCycle={cycle}
          paywallEnabled={me.paywallEnabled}
          onClose={() => setChangeTarget(null)}
          onConfirm={confirmChange}
        />
      )}

      <SiteFooter />
    </main>
  );
}

// ?tool=<slug>: open the locked-tool dialog for that tool once the
// plans (and, when signed in, the current plan) are loaded. Wrapped in
// Suspense because useSearchParams needs it.
function PricingToolGate({ plans, me }: { plans: PlanDTO[] | null; me: MeResponse | null }) {
  const t = useT();
  const searchParams = useSearchParams();
  const toolSlug = searchParams.get("tool");
  const [open, setOpen] = useState(true);

  const tool = toolSlug ? TOOL_INFO.find((entry) => entry.slug === toolSlug) : undefined;
  const requiredPlan = tool && plans ? plans.find((p) => p.slug === tool.minPlan) : undefined;

  if (!open || !tool || !requiredPlan) return null;

  return (
    <ToolLockedDialog
      toolLabel={t("tools", tool.titleKey)}
      toolHref={tool.href}
      requiredPlan={requiredPlan}
      currentPlan={me?.plan ?? null}
      paywallEnabled={me?.paywallEnabled ?? false}
      onClose={() => setOpen(false)}
    />
  );
}
