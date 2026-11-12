"use client";

import OpenCallForm from "@/components/open-call-form";
import { DICTIONARY, LOCALE_TAGS, useLocale, useT } from "@/lib/i18n";

// The launch open call content (/open-call): hero, announcement
// sections and the application form. A client component, because the
// copy is translated (lib/i18n.ts is client-only) and the server
// renders English first, then the client corrects after hydration,
// like the rest of the site.
//
// Field labels are translated by field id (the launch fields have
// stable ids, set when the call is seeded; the stored labels are
// English). The terms checkbox stores both language versions, and the
// page shows only the one matching the visitor's language, so the
// submitted value always matches a stored option and the server
// validation accepts it.
type OpenCallKey = keyof typeof DICTIONARY.openCall;

const LAUNCH_FIELD_LABELS: Record<string, OpenCallKey> = {
  "launch-name": "fieldName",
  "launch-email": "fieldEmail",
  "launch-presentation": "fieldPresentation",
  "launch-work1": "fieldWork1",
  "launch-work1-title": "fieldWork1Title",
  "launch-work1-medium": "fieldWork1Medium",
  "launch-work1-dimensions": "fieldWork1Dimensions",
  "launch-work2": "fieldWork2",
  "launch-work2-title": "fieldWork2Title",
  "launch-work2-medium": "fieldWork2Medium",
  "launch-work2-dimensions": "fieldWork2Dimensions",
  "launch-work3": "fieldWork3",
  "launch-work3-title": "fieldWork3Title",
  "launch-work3-medium": "fieldWork3Medium",
  "launch-work3-dimensions": "fieldWork3Dimensions",
  "launch-link": "fieldLink",
  "launch-terms": "fieldTerms",
};

const TERMS_OPTION_EN = "I have read and accept the terms of this open call.";
const TERMS_OPTION_FR = "J'ai lu et j'accepte les conditions de cet appel.";

export type LaunchCallField = {
  id: string;
  label: string;
  type: string;
  required: boolean;
  options: string[];
};

export default function OpenCallPageContent({
  slug,
  deadline,
  closed,
  fields,
}: {
  slug: string;
  deadline: string | null;
  closed: boolean;
  fields: LaunchCallField[];
}) {
  const t = useT();
  const { locale } = useLocale();

  const deadlineText = deadline
    ? `${t("openCall", "deadlineLabel")}: ${new Date(deadline).toLocaleDateString(
        LOCALE_TAGS[locale],
        { day: "numeric", month: "long", year: "numeric" },
      )}`
    : t("openCall", "deadlineTba");

  // Translate the field labels (and the terms option) for the visitor's
  // language; anything unmapped falls back to the stored label.
  const localizedTerms = locale === "fr" ? TERMS_OPTION_FR : TERMS_OPTION_EN;
  const translatedFields = fields.map((f) => {
    const labelKey = LAUNCH_FIELD_LABELS[f.id];
    const options =
      f.id === "launch-terms" && f.options.includes(localizedTerms)
        ? [localizedTerms]
        : f.options;
    return {
      id: f.id,
      label: labelKey ? t("openCall", labelKey) : f.label,
      type: f.type,
      required: f.required,
      options,
    };
  });

  return (
    <>
      {/* Hero: black, huge serif type, the poster line. */}
      <section
        style={{
          padding: "72px 44px 56px",
          borderBottom: "1px solid var(--line)",
        }}
      >
        <div style={{ maxWidth: 1100, margin: "0 auto" }}>
          <p className="eyebrow">
            <span className="status-dot" /> {t("openCall", "eyebrow")}
          </p>
          <h1
            style={{
              margin: "0 0 10px",
              font: "450 clamp(64px, 11vw, 132px)/0.92 var(--font-display), Georgia, serif",
              letterSpacing: "-0.015em",
            }}
          >
            {t("openCall", "heroTitle")}
          </h1>
          <p
            style={{
              margin: "0 0 18px",
              font: "450 clamp(20px, 2.6vw, 28px)/1.3 var(--font-display), Georgia, serif",
            }}
          >
            {t("openCall", "heroSub")}
          </p>
          <p
            style={{
              maxWidth: 640,
              margin: 0,
              fontSize: 16,
              lineHeight: 1.65,
              color: "var(--muted)",
            }}
          >
            {t("openCall", "intro")}
          </p>
          <p
            style={{
              maxWidth: 640,
              margin: "20px 0 0",
              fontSize: 17,
              fontWeight: 700,
              lineHeight: 1.5,
            }}
          >
            {t("openCall", "curatedLine")}
          </p>
          <p style={{ margin: "22px 0 0", fontSize: 14, fontWeight: 700, letterSpacing: ".02em" }}>
            {deadlineText}
          </p>
        </div>
      </section>

      {closed ? (
        <section style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 44px 80px" }}>
          <p style={{ fontSize: 16, lineHeight: 1.6 }}>{t("openCall", "closedText")}</p>
        </section>
      ) : (
        <>
          {/* The offer, who can apply, how to apply. */}
          <section
            style={{
              maxWidth: 1100,
              margin: "0 auto",
              padding: "48px 44px 8px",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
              gap: 36,
            }}
          >
            <div>
              <h2
                style={{
                  margin: "0 0 12px",
                  font: "450 22px/1.25 var(--font-display), Georgia, serif",
                }}
              >
                {t("openCall", "whatYouGetTitle")}
              </h2>
              <ul style={{ margin: 0, paddingLeft: 18, display: "grid", gap: 8, fontSize: 15, lineHeight: 1.6 }}>
                <li>{t("openCall", "whatYouGet1")}</li>
                <li>{t("openCall", "whatYouGet2")}</li>
                <li>{t("openCall", "whatYouGet3")}</li>
              </ul>
              <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>
                {t("openCall", "offerNote")}
              </p>
            </div>
            <div>
              <h2
                style={{
                  margin: "0 0 12px",
                  font: "450 22px/1.25 var(--font-display), Georgia, serif",
                }}
              >
                {t("openCall", "whoTitle")}
              </h2>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65 }}>{t("openCall", "whoText")}</p>
              <p style={{ margin: "12px 0 0", fontSize: 15, lineHeight: 1.65, fontWeight: 700 }}>
                {t("openCall", "curatedNote")}
              </p>
              <p style={{ margin: "12px 0 0", fontSize: 13, lineHeight: 1.6, color: "var(--muted)" }}>
                {t("openCall", "scopeNote")}
              </p>
            </div>
            <div>
              <h2
                style={{
                  margin: "0 0 12px",
                  font: "450 22px/1.25 var(--font-display), Georgia, serif",
                }}
              >
                {t("openCall", "howTitle")}
              </h2>
              <p style={{ margin: 0, fontSize: 15, lineHeight: 1.65 }}>{t("openCall", "howText")}</p>
            </div>
          </section>

          {/* The application form. */}
          <section style={{ maxWidth: 640, margin: "0 auto", padding: "36px 20px 40px" }}>
            <h2
              style={{
                margin: "0 0 20px",
                font: "450 26px/1.2 var(--font-display), Georgia, serif",
              }}
            >
              {t("openCall", "formTitle")}
            </h2>
            <OpenCallForm slug={slug} fields={translatedFields} />
          </section>

          {/* Founder note. */}
          <section
            style={{
              maxWidth: 640,
              margin: "0 auto",
              padding: "32px 20px 80px",
              borderTop: "1px solid var(--line)",
            }}
          >
            <p style={{ margin: 0, fontSize: 15, lineHeight: 1.7 }}>{t("openCall", "founderNote")}</p>
            <p style={{ margin: "14px 0 0", fontSize: 13, fontWeight: 700, letterSpacing: ".04em" }}>
              {t("openCall", "founderSign")}
            </p>
          </section>
        </>
      )}
    </>
  );
}
