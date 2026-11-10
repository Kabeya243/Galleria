"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useT } from "@/lib/i18n";
import { SHOW_PAID_PLANS } from "@/lib/plan-visibility";
import type { PlanDTO } from "@/lib/subscriptions";

// Subscription dialogs (Nov 2026): plan change, locked tool and admin
// plan change. Same dressing as the publish dialog
// (app/globals.css: .publish-dialog-overlay, .publish-dialog,
// .publish-dialog-actions, ...): overlay click and Escape close, Cancel
// / Confirm buttons, loading state and an error line.
//
// The plan-change popup also takes a promo code (validated live, the
// discount is shown before confirming) and a mandatory terms checkbox:
// the Confirm button stays disabled until the visitor ticks "I accept
// the Terms of Use and the Privacy Policy". The admin popup grants a
// plan to a specific account with a billing cycle, an explicit end
// date and an optional promo code.

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

type PromoCheck =
  | {
      valid: true;
      code: string;
      discountType: "percent" | "free";
      discountValue: number;
      accessDurationDays: number;
      discountedPriceUsd: number;
    }
  | { valid: false; reason: string };

function promoReasonKey(reason: string): string {
  switch (reason) {
    case "inactive":
      return "promoInactive";
    case "expired":
      return "promoExpired";
    case "no_uses_left":
      return "promoNoUsesLeft";
    case "already_used":
      return "promoAlreadyUsed";
    case "not_for_plan":
      return "promoNotForPlan";
    default:
      return "promoInvalid";
  }
}

export type PlanChangePayload = {
  promoCode?: string;
  termsAccepted: boolean;
};

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
  billingCycle: "monthly" | "yearly" | "single";
  paywallEnabled: boolean;
  onClose: () => void;
  onConfirm: (payload: PlanChangePayload) => Promise<void>;
}) {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [promoInput, setPromoInput] = useState("");
  const [promo, setPromo] = useState<PromoCheck | null>(null);
  const [promoChecking, setPromoChecking] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!termsAccepted) {
      setError(t("pricing", "termsRequired"));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onConfirm({
        promoCode: promo?.valid ? promo.code : undefined,
        termsAccepted,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("pricing", "changeFailed"));
      setSaving(false);
    }
  }

  async function checkPromo() {
    const code = promoInput.trim();
    if (!code) return;
    setPromoChecking(true);
    setPromo(null);
    try {
      const res = await fetch(
        `/api/promo-codes/validate?code=${encodeURIComponent(code)}&planSlug=${targetPlan.slug}&cycle=${billingCycle}`,
      );
      const data = (await res.json()) as PromoCheck;
      setPromo(data);
    } catch {
      setPromo({ valid: false, reason: "not_found" });
    } finally {
      setPromoChecking(false);
    }
  }

  const basePrice =
    billingCycle === "monthly"
      ? targetPlan.monthlyPriceUsd
      : billingCycle === "yearly"
        ? targetPlan.yearlyPriceUsd
        : targetPlan.singleMonthPriceUsd;
  const priceSuffix =
    billingCycle === "monthly"
      ? t("pricing", "perMonth")
      : billingCycle === "yearly"
        ? t("pricing", "perYear")
        : t("pricing", "perOneMonth");
  const price =
    basePrice === 0
      ? t("pricing", "free")
      : `$${basePrice} ${priceSuffix}`;

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
        {billingCycle === "single" && <DialogBody text={t("pricing", "singleNoRenewal")} />}
        {targetPlan.slug !== "discovery" && (
          <div style={{ margin: "0 0 14px" }}>
            <label
              htmlFor="promo-code"
              style={{ display: "block", fontSize: 13, color: "var(--muted)", marginBottom: 6 }}
            >
              {t("pricing", "promoCodeLabel")}
            </label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                id="promo-code"
                type="text"
                value={promoInput}
                onChange={(event) => {
                  setPromoInput(event.target.value.toUpperCase());
                  setPromo(null);
                }}
                placeholder={t("pricing", "promoCodePlaceholder")}
                autoComplete="off"
                style={{
                  flex: 1,
                  height: 40,
                  padding: "0 10px",
                  border: "1px solid var(--line)",
                  borderRadius: 8,
                  background: "var(--paper)",
                  color: "var(--ink)",
                  font: "inherit",
                  fontSize: 14,
                  textTransform: "uppercase",
                }}
              />
              <button
                type="button"
                className="publish-dialog-cancel"
                onClick={() => void checkPromo()}
                disabled={promoChecking || promoInput.trim() === ""}
              >
                {promoChecking ? t("common", "loading") : t("pricing", "promoApply")}
              </button>
            </div>
            {promo && !promo.valid && (
              <p role="alert" style={{ margin: "8px 0 0", fontSize: 13, color: "#9a2b2b" }}>
                {t("pricing", promoReasonKey(promo.reason) as "promoInvalid")}
              </p>
            )}
            {promo && promo.valid && (
              <div style={{ marginTop: 8, fontSize: 14, lineHeight: 1.6 }}>
                {promo.discountType === "free" ? (
                  <p style={{ margin: 0 }}>
                    {t("pricing", "promoFreeFor")} {promo.accessDurationDays}{" "}
                    {t("pricing", "promoDays")}.
                  </p>
                ) : (
                  <p style={{ margin: 0 }}>
                    {t("pricing", "promoDiscount")}: {promo.discountValue}%.{" "}
                    {t("pricing", "promoPriceAfter")}:{" "}
                    <strong>
                      ${promo.discountedPriceUsd} {priceSuffix}
                    </strong>
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setPromo(null);
                    setPromoInput("");
                  }}
                  style={{
                    background: "none",
                    border: "none",
                    padding: 0,
                    color: "var(--muted)",
                    fontSize: 13,
                    textDecoration: "underline",
                    cursor: "pointer",
                  }}
                >
                  {t("pricing", "promoRemove")}
                </button>
              </div>
            )}
          </div>
        )}
        <DialogBody
          text={
            paywallEnabled
              ? t("pricing", "changePlanPaywallNote")
              : t("pricing", "freeTrialNote")
          }
        />
        <label
          style={{
            display: "flex",
            gap: 8,
            alignItems: "flex-start",
            fontSize: 14,
            lineHeight: 1.5,
            margin: "0 0 14px",
          }}
        >
          <input
            type="checkbox"
            checked={termsAccepted}
            onChange={(event) => setTermsAccepted(event.target.checked)}
            required
            style={{ marginTop: 3 }}
          />
          <span>
            {t("auth", "agreeTermsPrefix")}
            <Link href="/terms">{t("footer", "terms")}</Link>
            {t("auth", "agreeTermsAnd")}
            <Link href="/privacy">{t("footer", "privacy")}</Link>
            {t("auth", "agreeTermsSuffix")}
          </span>
        </label>
        {error && (
          <p className="publish-dialog-error" role="alert">
            {error}
          </p>
        )}
        <div className="publish-dialog-actions">
          <button type="button" className="publish-dialog-cancel" onClick={onClose} disabled={saving}>
            {t("common", "cancel")}
          </button>
          <button type="submit" className="publish-dialog-submit" disabled={saving || !termsAccepted}>
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
      {!SHOW_PAID_PLANS && <DialogBody text={t("pricing", "paidPlansSoon")} />}
      <div className="publish-dialog-actions">
        {!paywallEnabled && (
          <a href={toolHref} className="publish-dialog-submit" style={{ textDecoration: "none" }}>
            {t("pricing", "tryItFree")}
          </a>
        )}
        {SHOW_PAID_PLANS ? (
          <Link
            href="/pricing"
            className={paywallEnabled ? "publish-dialog-submit" : "publish-dialog-cancel"}
            style={{ textDecoration: "none" }}
            onClick={onClose}
          >
            {t("pricing", "seePlans")}
          </Link>
        ) : (
          <button type="button" className="publish-dialog-cancel" onClick={onClose}>
            {t("common", "close")}
          </button>
        )}
      </div>
    </DialogShell>
  );
}

export type AdminChangePayload = {
  billingCycle: "monthly" | "yearly" | "single";
  endsAt: string | null;
  promoCode?: string;
};

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
  onConfirm: (payload: AdminChangePayload) => Promise<void>;
}) {
  const t = useT();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly" | "single">("monthly");
  const [endsAt, setEndsAt] = useState("");
  const [promoCode, setPromoCode] = useState("");

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await onConfirm({
        billingCycle,
        endsAt: endsAt ? new Date(`${endsAt}T00:00:00`).toISOString() : null,
        promoCode: promoCode.trim() ? promoCode.trim().toUpperCase() : undefined,
      });
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
        <div style={{ display: "grid", gap: 12, margin: "0 0 14px" }}>
          <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
            Billing cycle
            <select
              value={billingCycle}
              onChange={(event) =>
                setBillingCycle(event.target.value as "monthly" | "yearly" | "single")
              }
              style={{
                height: 40,
                padding: "0 10px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                background: "var(--paper)",
                color: "var(--ink)",
                font: "inherit",
                fontSize: 14,
              }}
            >
              <option value="monthly">Monthly</option>
              <option value="yearly">Yearly</option>
              <option value="single">One month only</option>
            </select>
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
            Access ends on (optional, explicit end date)
            <input
              type="date"
              value={endsAt}
              onChange={(event) => setEndsAt(event.target.value)}
              style={{
                height: 40,
                padding: "0 10px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                background: "var(--paper)",
                color: "var(--ink)",
                font: "inherit",
                fontSize: 14,
              }}
            />
          </label>
          <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
            Promo code (optional)
            <input
              type="text"
              value={promoCode}
              onChange={(event) => setPromoCode(event.target.value.toUpperCase())}
              placeholder="e.g. LAKISA10"
              autoComplete="off"
              style={{
                height: 40,
                padding: "0 10px",
                border: "1px solid var(--line)",
                borderRadius: 8,
                background: "var(--paper)",
                color: "var(--ink)",
                font: "inherit",
                fontSize: 14,
                textTransform: "uppercase",
              }}
            />
          </label>
        </div>
        <p style={{ margin: "0 0 14px", color: "var(--muted)", fontSize: 13, lineHeight: 1.6 }}>
          With an end date, the access is fixed: it ends on that date and the account returns to
          Discovery. With a free promo code and no end date, the access lasts the code&apos;s
          duration.
        </p>
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
