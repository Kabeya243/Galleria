"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check, Image, MousePointerClick, Share2 } from "lucide-react";
import { useT } from "@/lib/i18n";
import styles from "./redesign-dashboard.module.css";

// Compact onboarding (Phase 1, Nov 2026): the prototype's three steps
// in a row, each one clickable, with a "Step X of 3" progress chip and
// a dismiss button. Progress comes from real data, never from a stored
// checklist, exactly like the old OnboardingCard: step 1 is done when
// the account has an exhibition, step 2 when it has artworks, step 3
// when it has a public exhibition. Dismissal shares the old card's
// localStorage key, so a dismissal carries over.

const DISMISSED_KEY = "lakisa-onboarding-dismissed";

export type RedesignOnboardingExhibition = {
  id: string;
  slug: string;
  status: string;
};

export default function RedesignOnboarding({
  exhibitionCount,
  artworksCount,
  publicExhibitionsCount,
  newestExhibition,
  onCreate,
}: {
  exhibitionCount: number;
  artworksCount: number;
  publicExhibitionsCount: number;
  newestExhibition: RedesignOnboardingExhibition | null;
  onCreate: () => void;
}) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const step1Done = exhibitionCount > 0;
  const step2Done = artworksCount > 0;
  const step3Done = publicExhibitionsCount > 0;
  const allDone = step1Done && step2Done && step3Done;

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(DISMISSED_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible || allDone) return null;

  const currentStep = !step1Done ? 1 : !step2Done ? 2 : 3;
  const editorHref = newestExhibition ? `/editor/${newestExhibition.id}` : null;
  const publicHref =
    newestExhibition && newestExhibition.status === "public"
      ? `/exhibition/${newestExhibition.slug}`
      : null;

  async function copyPublicLink() {
    if (!publicHref) return;
    const link = `${window.location.origin}${publicHref}`;
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

  function dismiss() {
    try {
      window.localStorage.setItem(DISMISSED_KEY, "1");
    } catch {
      // Private mode: the card just hides for this visit.
    }
    setVisible(false);
  }

  const steps = [
    {
      n: 1,
      done: step1Done,
      icon: <MousePointerClick size={20} />,
      title: t("dashboard", "onboardingStep1Title"),
      text: t("dashboard", "onboardingStep1Text"),
    },
    {
      n: 2,
      done: step2Done,
      icon: <Image size={20} />,
      title: t("dashboard", "onboardingStep2Title"),
      text: t("dashboard", "onboardingStep2Text"),
    },
    {
      n: 3,
      done: step3Done,
      icon: <Share2 size={20} />,
      title: t("dashboard", "onboardingStep3Title"),
      text: t("dashboard", "onboardingStep3Text"),
    },
  ];

  function stepBody(step: (typeof steps)[number]) {
    return (
      <>
        <span className={styles.stepNum} aria-label={step.done ? t("dashboard", "onboardingDone") : undefined}>
          {step.done ? <Check size={20} /> : step.icon}
        </span>
        <span className={styles.stepBody}>
          <span className={styles.stepTitle}>
            {step.title}
            {step.done && <span className={styles.stepDoneTag}>{t("dashboard", "onboardingDone")}</span>}
          </span>
          <span className={styles.stepText}>{step.text}</span>
          {step.n === 3 && step2Done && publicHref && (
            <span style={{ display: "flex", gap: 12, marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
              <Link
                href={publicHref}
                className={styles.cardLink}
                onClick={(e) => e.stopPropagation()}
              >
                {t("dashboard", "onboardingViewExhibition")}
              </Link>
              <button type="button" className={styles.cardLink} onClick={() => void copyPublicLink()}>
                {copied ? t("dashboard", "onboardingCopied") : t("dashboard", "onboardingCopyLink")}
              </button>
            </span>
          )}
        </span>
      </>
    );
  }

  function stepClass(step: (typeof steps)[number]) {
    return `${styles.step}${step.n === currentStep ? ` ${styles.stepCurrent}` : ""}${
      step.done ? ` ${styles.stepDone}` : ""
    }`;
  }

  return (
    <section className={styles.card} aria-label={t("redesign", "onboardingNextTitle")}>
      <div className={styles.cardHead}>
        <div>
          <span className={styles.eyebrow}>{t("dashboard", "creativeSpace")}</span>
          <h2>{t("redesign", "onboardingNextTitle")}</h2>
          <p className={styles.cardSub}>{t("redesign", "onboardingNextIntro")}</p>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className={styles.stepProgress}>
            {t("redesign", "step")} {currentStep} {t("redesign", "of")} 3
          </span>
          <button
            type="button"
            className={styles.dismissBtn}
            onClick={dismiss}
            aria-label={t("common", "dismiss")}
          >
            ×
          </button>
        </div>
      </div>

      <ol className={styles.onboardingSteps}>
        {steps.map((step) => {
          if (step.n === 1 && !step.done) {
            return (
              <li key={step.n}>
                <button type="button" className={stepClass(step)} onClick={onCreate}>
                  {stepBody(step)}
                </button>
              </li>
            );
          }
          if (step.n === 2 && step1Done && !step.done && editorHref) {
            return (
              <li key={step.n}>
                <Link href={editorHref} className={stepClass(step)}>
                  {stepBody(step)}
                </Link>
              </li>
            );
          }
          if (step.n === 3 && step2Done && !step.done && editorHref && !publicHref) {
            return (
              <li key={step.n}>
                <Link href={editorHref} className={stepClass(step)}>
                  {stepBody(step)}
                </Link>
              </li>
            );
          }
          return (
            <li key={step.n}>
              <div className={stepClass(step)}>{stepBody(step)}</div>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
