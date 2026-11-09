"use client";

import { LOCALES, LOCALE_NAMES, setLocale, useLocale, type Locale } from "@/lib/i18n";

// Language dropdown (11 languages: the Artsy languages + Swahili and
// Lingala). Pure black & white, editorial; the choice persists in
// localStorage ("sanaa-locale") exactly as before. Used in Settings,
// in the site footer, and on the public exhibition page.
export default function LanguageSwitcher({ className }: { className?: string }) {
  const { locale, setLocale: change } = useLocale();
  return (
    <select
      className={className}
      value={locale}
      onChange={(e) => change(e.target.value as Locale)}
      aria-label="Language"
      style={{
        padding: "5px 8px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: ".08em",
        border: "1px solid currentColor",
        borderRadius: 999,
        background: "transparent",
        color: "inherit",
        cursor: "pointer",
      }}
    >
      {LOCALES.map((option) => (
        <option key={option} value={option}>
          {LOCALE_NAMES[option]}
        </option>
      ))}
    </select>
  );
}
