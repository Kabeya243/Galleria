"use client";

import { useEffect } from "react";
import { useT } from "@/lib/i18n";

// Marketplace guides (Nov 2026): the two popups that explain how
// selling and buying work on Lakisa. The seller guide opens when the
// seller lists a work; the buyer guide opens when the buyer makes an
// offer or buys. Overlay click or Escape closes them; the text comes
// from the marketplaceGuides dictionary (English and French), in
// simple words, with no em dashes.

function GuideShell({
  title,
  intro,
  children,
  onClose,
}: {
  title: string;
  intro: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const t = useT();
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="mp-guide-overlay" role="dialog" aria-modal="true" aria-label={title} onClick={onClose}>
      <div className="mp-guide-card" onClick={(e) => e.stopPropagation()}>
        <h2>{title}</h2>
        <p className="mp-guide-intro">{intro}</p>
        {children}
        <button type="button" className="primary-button mp-guide-close" onClick={onClose}>
          {t("marketplaceGuides", "gotIt")}
        </button>
        <style>{`
          .mp-guide-overlay { position: fixed; inset: 0; z-index: 90; display: grid; place-items: center; padding: 20px; background: rgba(20, 16, 10, 0.55); }
          .mp-guide-card { width: min(560px, 100%); max-height: min(84vh, 720px); overflow-y: auto; padding: 28px; border: 1px solid var(--line); border-radius: 14px; background: var(--paper); color: var(--ink); box-shadow: 0 18px 50px rgba(20, 16, 10, 0.3); }
          .mp-guide-card h2 { margin: 0 0 8px; font: 450 24px/1.2 var(--font-display), Georgia, serif; }
          .mp-guide-intro { margin: 0 0 18px; font-size: 15px; font-weight: 600; line-height: 1.5; }
          .mp-guide-card h3 { margin: 18px 0 4px; font-size: 14px; }
          .mp-guide-card p { margin: 0; color: var(--muted); font-size: 13px; line-height: 1.65; }
          .mp-guide-close { margin-top: 22px; }
        `}</style>
      </div>
    </div>
  );
}

export function SellerGuide({ onClose }: { onClose: () => void }) {
  const t = useT();
  const steps: Array<[string, string]> = [
    [t("marketplaceGuides", "sellerPricesTitle"), t("marketplaceGuides", "sellerPricesText")],
    [t("marketplaceGuides", "sellerConditionsTitle"), t("marketplaceGuides", "sellerConditionsText")],
    [t("marketplaceGuides", "sellerNegotiationTitle"), t("marketplaceGuides", "sellerNegotiationText")],
    [t("marketplaceGuides", "sellerFeesTitle"), t("marketplaceGuides", "sellerFeesText")],
    [t("marketplaceGuides", "sellerPaymentTitle"), t("marketplaceGuides", "sellerPaymentText")],
    [t("marketplaceGuides", "sellerShippingTitle"), t("marketplaceGuides", "sellerShippingText")],
  ];
  return (
    <GuideShell
      title={t("marketplaceGuides", "sellerTitle")}
      intro={t("marketplaceGuides", "sellerIntro")}
      onClose={onClose}
    >
      {steps.map(([heading, text]) => (
        <div key={heading}>
          <h3>{heading}</h3>
          <p>{text}</p>
        </div>
      ))}
    </GuideShell>
  );
}

export function BuyerGuide({ onClose }: { onClose: () => void }) {
  const t = useT();
  const steps: Array<[string, string]> = [
    [t("marketplaceGuides", "buyerOfferTitle"), t("marketplaceGuides", "buyerOfferText")],
    [t("marketplaceGuides", "buyerProtectionTitle"), t("marketplaceGuides", "buyerProtectionText")],
    [t("marketplaceGuides", "buyerFeesTitle"), t("marketplaceGuides", "buyerFeesText")],
    [t("marketplaceGuides", "buyerAfterTitle"), t("marketplaceGuides", "buyerAfterText")],
    [t("marketplaceGuides", "buyerPendingTitle"), t("marketplaceGuides", "buyerPendingText")],
  ];
  return (
    <GuideShell
      title={t("marketplaceGuides", "buyerTitle")}
      intro={t("marketplaceGuides", "buyerIntro")}
      onClose={onClose}
    >
      {steps.map(([heading, text]) => (
        <div key={heading}>
          <h3>{heading}</h3>
          <p>{text}</p>
        </div>
      ))}
    </GuideShell>
  );
}
