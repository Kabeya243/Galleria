"use client";

import { setLocale, useLocale, type Locale } from "@/lib/i18n";

// Two-letter language switch (FR | EN). Pure black & white, editorial:
// the active language is filled black, the other is an outline.
export default function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale: change } = useLocale();
  const options: Locale[] = ["fr", "en"];
  return (
    <div
      className={className}
      role="group"
      aria-label="Language / Langue"
      style={{ display: "inline-flex", border: "1px solid currentColor", borderRadius: 999, overflow: "hidden" }}
    >
      {options.map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => change(option)}
          aria-pressed={locale === option}
          aria-label={option === "fr" ? "Français" : "English"}
          style={{
            padding: "5px 10px",
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: ".08em",
            textTransform: "uppercase",
            border: "none",
            cursor: "pointer",
            background: locale === option ? "#000" : "transparent",
            color: locale === option ? "#fff" : "inherit",
          }}
        >
          {option.toUpperCase()}
        </button>
      ))}
    </div>
  );
}
