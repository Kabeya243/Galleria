"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { useT } from "@/lib/i18n";
import styles from "./user-dashboard.module.css";

// Guided start (Nov 2026): "Create your first exhibition in 3 steps".
// Shown on the dashboard until the three steps are done, or until the
// user dismisses it (remembered in localStorage, like the cookie
// notice). The steps reuse the existing flows: the dashboard's create
// dialog for step 1, the editor for steps 2 and 3 (add works, publish).
// Progress comes from real data, never from a stored checklist:
// step 1 is done when the account has an exhibition, step 2 when it
// has artworks, step 3 when it has a public exhibition.

const DISMISSED_KEY = "lakisa-onboarding-dismissed";

export type OnboardingExhibition = {
  id: string;
  slug: string;
  status: string;
};

const stepCircle: React.CSSProperties = {
  flexShrink: 0,
  width: 30,
  height: 30,
  borderRadius: "50%",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: 13,
  fontWeight: 700,
};

const stepAction: React.CSSProperties = {
  display: "inline-block",
  marginTop: 10,
  padding: "8px 16px",
  borderRadius: 999,
  background: "var(--ink)",
  color: "var(--paper)",
  fontSize: 13,
  fontWeight: 600,
  textDecoration: "none",
  border: "none",
  cursor: "pointer",
};

export default function OnboardingCard({
  exhibitionCount,
  artworksCount,
  publicExhibitionsCount,
  newestExhibition,
  onCreate,
}: {
  exhibitionCount: number;
  artworksCount: number;
  publicExhibitionsCount: number;
  newestExhibition: OnboardingExhibition | null;
  onCreate: () => void;
}) {
  const t = useT();
  const [visible, setVisible] = useState(false);
  const [copied, setCopied] = useState(false);

  const step1Done = exhibitionCount > 0;
  const step2Done = artworksCount > 0;
  const step3Done = publicExhibitionsCount > 0;
  const allDone = step1Done && step2Done && step3Done;

  // localStorage is read after mount (never during render): this is a
  // client component but still server-rendered, and reading it during
  // render would split the server and client output.
  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(DISMISSED_KEY) !== "1");
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible || allDone) return null;

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

  const steps: Array<{
    n: number;
    done: boolean;
    reachable: boolean;
    title: string;
    text: string;
    action: React.ReactNode;
  }> = [
    {
      n: 1,
      done: step1Done,
      reachable: true,
      title: t("dashboard", "onboardingStep1Title"),
      text: t("dashboard", "onboardingStep1Text"),
      action: !step1Done ? (
        <button type="button" style={stepAction} onClick={onCreate}>
          {t("dashboard", "onboardingStep1Action")}
        </button>
      ) : null,
    },
    {
      n: 2,
      done: step2Done,
      reachable: step1Done,
      title: t("dashboard", "onboardingStep2Title"),
      text: t("dashboard", "onboardingStep2Text"),
      action:
        step1Done && !step2Done && editorHref ? (
          <Link href={editorHref} style={stepAction}>
            {t("dashboard", "onboardingStep2Action")}
          </Link>
        ) : null,
    },
    {
      n: 3,
      done: step3Done,
      reachable: step2Done,
      title: t("dashboard", "onboardingStep3Title"),
      text: t("dashboard", "onboardingStep3Text"),
      action: step2Done ? (
        publicHref ? (
          <span style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
            <Link href={publicHref} style={stepAction}>
              {t("dashboard", "onboardingViewExhibition")}
            </Link>
            <button type="button" style={stepAction} onClick={() => void copyPublicLink()}>
              {copied ? t("dashboard", "onboardingCopied") : t("dashboard", "onboardingCopyLink")}
            </button>
          </span>
        ) : editorHref ? (
          <Link href={editorHref} style={stepAction}>
            {t("dashboard", "onboardingStep3Action")}
          </Link>
        ) : null
      ) : null,
    },
  ];

  return (
    <section className={styles.card} aria-label={t("dashboard", "onboardingTitle")}>
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 12,
        }}
      >
        <div>
          <span className="eyebrow">{t("dashboard", "creativeSpace")}</span>
          <h2 style={{ margin: "6px 0 0", fontSize: 20, fontWeight: 600 }}>
            {t("dashboard", "onboardingTitle")}
          </h2>
          <p className={styles.cardSub} style={{ fontSize: 14 }}>
            {t("dashboard", "onboardingIntro")}
          </p>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={t("common", "dismiss")}
          style={{
            flexShrink: 0,
            background: "none",
            border: "none",
            padding: 4,
            fontSize: 20,
            lineHeight: 1,
            color: "var(--muted)",
            cursor: "pointer",
          }}
        >
          ×
        </button>
      </div>

      <ol style={{ listStyle: "none", margin: "18px 0 0", padding: 0, display: "grid", gap: 16 }}>
        {steps.map((step) => (
          <li
            key={step.n}
            style={{
              display: "flex",
              gap: 12,
              opacity: step.reachable || step.done ? 1 : 0.55,
            }}
          >
            <span
              style={{
                ...stepCircle,
                background: step.done ? "var(--accent)" : "var(--surface)",
                color: step.done ? "#fff" : "var(--ink)",
                border: step.done ? "none" : "1px solid var(--line)",
              }}
              aria-label={step.done ? t("dashboard", "onboardingDone") : undefined}
            >
              {step.done ? <Check size={15} /> : step.n}
            </span>
            <div style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>
                {step.title}
                {step.done && (
                  <span style={{ marginLeft: 8, fontSize: 12, fontWeight: 600, color: "var(--muted)" }}>
                    {t("dashboard", "onboardingDone")}
                  </span>
                )}
              </p>
              <p style={{ margin: "3px 0 0", fontSize: 14, lineHeight: 1.5, color: "var(--muted)" }}>
                {step.text}
              </p>
              {step.action}
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}
