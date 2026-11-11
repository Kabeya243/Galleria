"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Footprints,
  Image,
  LayoutDashboard,
  Plus,
  Share2,
  Sparkles,
  Store,
} from "lucide-react";
import { useT } from "@/lib/i18n";

// Welcome tour (Nov 2026): animated pop-up that walks a new user
// through the platform after signup, Photoshop-style. Centered card
// on the dim backdrop, Next / Previous / Skip, closable at any time
// (button, backdrop click, Escape). Shown once, on the first dashboard
// visit after the account was created (see Dashboard); a "Take the
// tour" button reopens it any time. The "seen" flag lives in
// localStorage per user, like the onboarding card dismissal, so the
// tour never nags and no database field is needed.

const SEEN_KEY_PREFIX = "lakisa-welcome-tour-done-";

export function welcomeTourSeenKey(userId: string): string {
  return `${SEEN_KEY_PREFIX}${userId}`;
}

export function hasSeenWelcomeTour(userId: string): boolean {
  try {
    return window.localStorage.getItem(welcomeTourSeenKey(userId)) === "1";
  } catch {
    return false;
  }
}

function markWelcomeTourSeen(userId: string): void {
  try {
    window.localStorage.setItem(welcomeTourSeenKey(userId), "1");
  } catch {
    // Private mode: the tour just hides for this visit.
  }
}

type TourStep = {
  icon: React.ReactNode;
  title: string;
  text: string;
  where: string;
};

export default function WelcomeTour({
  userId,
  open,
  onClose,
  onStartCreating,
}: {
  userId: string;
  open: boolean;
  onClose: () => void;
  onStartCreating?: () => void;
}) {
  const t = useT();
  const [step, setStep] = useState(0);

  // Always start from the first step when the tour opens.
  useEffect(() => {
    if (open) setStep(0);
  }, [open ]);

  const close = useCallback(() => {
    markWelcomeTourSeen(userId);
    onClose();
  }, [userId, onClose]);

  // Escape closes the tour, like the other dialogs.
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") close();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  const steps: TourStep[] = [
    {
      icon: <Sparkles size={22} />,
      title: t("welcomeTour", "step1Title"),
      text: t("welcomeTour", "step1Text"),
      where: t("welcomeTour", "step1Where"),
    },
    {
      icon: <LayoutDashboard size={22} />,
      title: t("welcomeTour", "step2Title"),
      text: t("welcomeTour", "step2Text"),
      where: t("welcomeTour", "step2Where"),
    },
    {
      icon: <Plus size={22} />,
      title: t("welcomeTour", "step3Title"),
      text: t("welcomeTour", "step3Text"),
      where: t("welcomeTour", "step3Where"),
    },
    {
      icon: <Image size={22} />,
      title: t("welcomeTour", "step4Title"),
      text: t("welcomeTour", "step4Text"),
      where: t("welcomeTour", "step4Where"),
    },
    {
      icon: <Footprints size={22} />,
      title: t("welcomeTour", "step5Title"),
      text: t("welcomeTour", "step5Text"),
      where: t("welcomeTour", "step5Where"),
    },
    {
      icon: <Share2 size={22} />,
      title: t("welcomeTour", "step6Title"),
      text: t("welcomeTour", "step6Text"),
      where: t("welcomeTour", "step6Where"),
    },
    {
      icon: <Store size={22} />,
      title: t("welcomeTour", "step7Title"),
      text: t("welcomeTour", "step7Text"),
      where: t("welcomeTour", "step7Where"),
    },
  ];

  if (!open) return null;
  const current = steps[step];
  const isFirst = step === 0;
  const isLast = step === steps.length - 1;

  function goTo(next: number) {
    setStep(Math.max(0, Math.min(steps.length - 1, next)));
  }

  function startCreating() {
    markWelcomeTourSeen(userId);
    onClose();
    onStartCreating?.();
  }

  return (
    <div className="create-dialog-overlay" role="presentation" onClick={close}>
      <div
        className="welcome-tour-card"
        role="dialog"
        aria-modal="true"
        aria-label={t("welcomeTour", "title")}
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          className="welcome-tour-close"
          onClick={close}
          aria-label={t("common", "close")}
        >
          ×
        </button>

        <div key={step} className="welcome-tour-step">
          <span className="welcome-tour-icon">{current.icon}</span>
          <p className="welcome-tour-count">
            {step + 1} / {steps.length}
          </p>
          <h2 className="welcome-tour-title">{current.title}</h2>
          <p className="welcome-tour-text">{current.text}</p>
          <p className="welcome-tour-where">{current.where}</p>
          {isLast && onStartCreating && (
            <button type="button" className="welcome-tour-cta" onClick={startCreating}>
              {t("dashboard", "createExhibition")}
            </button>
          )}
        </div>

        <div className="welcome-tour-dots" role="tablist" aria-label={t("welcomeTour", "title")}>
          {steps.map((_, index) => (
            <button
              key={index}
              type="button"
              role="tab"
              aria-selected={index === step}
              aria-label={`${index + 1} / ${steps.length}`}
              className={`welcome-tour-dot${index === step ? " welcome-tour-dot-active" : ""}`}
              onClick={() => goTo(index)}
            />
          ))}
        </div>

        <div className="welcome-tour-actions">
          <button type="button" className="welcome-tour-skip" onClick={close}>
            {t("welcomeTour", "skip")}
          </button>
          <span style={{ flex: 1 }} />
          <button
            type="button"
            className="welcome-tour-prev"
            onClick={() => goTo(step - 1)}
            disabled={isFirst}
          >
            {t("welcomeTour", "previous")}
          </button>
          <button
            type="button"
            className="welcome-tour-next"
            onClick={() => (isLast ? close() : goTo(step + 1))}
          >
            {isLast ? t("welcomeTour", "finish") : t("welcomeTour", "next")}
          </button>
        </div>
      </div>
    </div>
  );
}
