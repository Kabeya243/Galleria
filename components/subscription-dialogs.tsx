"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import type { PlanDTO } from "@/lib/subscriptions";

// Subscription dialogs (Nov 2026): plan change, locked tool and admin
// plan change. Same dressing as the publish dialog
// (app/globals.css: .publish-dialog-overlay, .publish-dialog,
// .publish-dialog-actions, ...): overlay click and Escape close, Cancel
// / Confirm buttons, loading state and an error line.

function useEscape(onClose: () => void) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
}

function DialogShell({
  label,
  onClose,
  children,
}: {
  label: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEscape(onClose);
  return (
    <div className="publish-dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="publish-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onClick={(event) => event.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

function DialogBody({ text }: { text: string }) {
  return (
    <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: 14, lineHeight: 1.6 }}>
      {text}
    </p>
  );
}

export function PlanChangeDialog({
  currentPlan,
  targetPlan,
  billingCycle,
  paywallEnabled,
  onClose,
  onConfirm,
}: {
  currentPlan: PlanDTO;
  targetPlan: PlanDTO;
  billingCycle: "monthly" | "yearly";
  paywallEnabled: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pricing", "changeFailed"));
      setSaving(false);
    }
  }

  const price =
    billingCycle === "monthly"
      ? targetPlan.monthlyPriceUsd === 0
        ? t("pricing", "free")
        : `$${targetPlan.monthlyPriceUsd} ${t("pricing", "perMonth")}`
      : targetPlan.yearlyPriceUsd === 0
        ? t("pricing", "free")
        : `$${targetPlan.yearlyPriceUsd} ${t("pricing", "perYear")}`;

  return (
    <DialogShell label={t("pricing", "changePlanTitle")} onClose={onClose}>
      <form onSubmit={submit}>
        <h2 className="publish-dialog-title">{t("pricing", "changePlanTitle")}</h2>
        <DialogBody
          text={`${t("pricing", "changePlanFrom")}: ${currentPlan.name}. ${t("pricing", "changePlanTo")}: ${targetPlan.name}.`}
        />
        <p style={{ margin: "0 0 14px", fontSize: 14 }}>
          {t("pricing", "changePlanPrice")}: <strong>{price}</strong>
        </p>
        <DialogBody
          text={
            paywallEnabled
              ? t("pricing", "changePlanPaywallNote")
              : t("pricing", "freeTrialNote")
          }
        />
        {error && (
          <p className="publish-dialog-error" role="alert">
            {error}
          </p>
        )}
        <div className="publish-dialog-actions">
          <button type="button" className="publish-dialog-cancel" onClick={onClose} disabled={saving}>
            {t("common", "cancel")}
          </button>
          <button type="submit" className="publish-dialog-submit" disabled={saving}>
            {saving ? t("common", "loading") : t("pricing", "confirm")}
          </button>
        </div>
      </form>
    </DialogShell>
  );
}

export function ToolLockedDialog({
  toolLabel,
  toolHref,
  requiredPlan,
  currentPlan,
  paywallEnabled,
  onClose,
}: {
  toolLabel: string;
  toolHref: string;
  requiredPlan: PlanDTO;
  currentPlan: PlanDTO | null;
  paywallEnabled: boolean;
  onClose: () => void;
}) {
  const t = useT();
  return (
    <DialogShell label={t("pricing", "lockedTitle")} onClose={onClose}>
      <h2 className="publish-dialog-title">{t("pricing", "lockedTitle")}</h2>
      <DialogBody
        text={`${toolLabel} ${t("pricing", "lockedIsPartOf")} ${requiredPlan.name}.`}
      />
      {currentPlan && (
        <DialogBody text={`${t("pricing", "yourPlan")}: ${currentPlan.name}.`} />
      )}
      {!paywallEnabled && <DialogBody text={t("pricing", "freeTrialNote")} />}
      <div className="publish-dialog-actions">
        {!paywallEnabled && (
          <a href={toolHref} className="publish-dialog-submit" style={{ textDecoration: "none" }}>
            {t("pricing", "tryItFree")}
          </a>
        )}
        <Link
          href="/pricing"
          className={paywallEnabled ? "publish-dialog-submit" : "publish-dialog-cancel"}
          style={{ textDecoration: "none" }}
          onClick={onClose}
        >
          {t("pricing", "seePlans")}
        </Link>
      </div>
    </DialogShell>
  );
}

export function AdminChangePlanDialog({
  userName,
  userEmail,
  currentPlanName,
  targetPlanName,
  onClose,
  onConfirm,
}: {
  userName: string;
  userEmail: string;
  currentPlanName: string;
  targetPlanName: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}) {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onConfirm();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pricing", "adminChangeFailed"));
      setSaving(false);
    }
  }

  return (
    <DialogShell label={t("pricing", "adminChangeTitle")} onClose={onClose}>
      <form onSubmit={submit}>
        <h2 className="publish-dialog-title">{t("pricing", "adminChangeTitle")}</h2>
        <DialogBody text={`${userName} (${userEmail})`} />
        <DialogBody
          text={`${t("pricing", "changePlanFrom")}: ${currentPlanName}. ${t("pricing", "changePlanTo")}: ${targetPlanName}.`}
        />
        <DialogBody text={t("pricing", "adminChangeWarning")} />
        {error && (
          <p className="publish-dialog-error" role="alert">
            {error}
          </p>
        )}
        <div className="publish-dialog-actions">
          <button type="button" className="publish-dialog-cancel" onClick={onClose} disabled={saving}>
            {t("common", "cancel")}
          </button>
          <button type="submit" className="publish-dialog-submit" disabled={saving}>
            {saving ? t("common", "loading") : t("pricing", "confirm")}
          </button>
        </div>
      </form>
    </DialogShell>
  );
}
