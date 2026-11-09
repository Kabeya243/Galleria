// Cookie notice (information only). Every cookie on Lakisa is essential
// to the platform (session, security, anonymous visitor, language and
// theme preferences, detailed statistics), so there is no choice to
// make and nothing to consent to: this bar only informs the visitor
// and can be closed. It shows on the first visit, at the bottom of the
// screen, without blocking access to the site. Closing it remembers the
// dismissal in local storage ("sanaa-cookie-notice" = "seen") so the
// notice does not show again. It never renders inside the admin
// (owner-only pages). Mounted once in app/layout.tsx.
"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { useT } from "@/lib/i18n";
import "./cookie-banner.css";

const DISMISS_KEY = "sanaa-cookie-notice";

export default function CookieBanner() {
  const t = useT();
  const pathname = usePathname();
  // null = not checked yet (renders nothing until the client check runs,
  // so there is no server/client mismatch).
  const [visible, setVisible] = useState<boolean | null>(null);

  useEffect(() => {
    try {
      setVisible(window.localStorage.getItem(DISMISS_KEY) !== "seen");
    } catch {
      // storage unavailable, show the notice; closing it hides it for
      // this visit only.
      setVisible(true);
    }
  }, []);

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, "seen");
    } catch {
      // storage unavailable, the notice just hides for this visit.
    }
    setVisible(false);
  };

  if (!visible || pathname?.startsWith("/admin")) return null;

  return (
    <div className="cookie-banner" role="region" aria-label={t("cookies", "learnMore")}>
      <p className="cookie-banner-text">{t("cookies", "notice")}</p>
      <div className="cookie-banner-actions">
        <Link href="/privacy" className="cookie-banner-link">
          {t("cookies", "learnMore")}
        </Link>
        <button type="button" className="cookie-banner-close" onClick={dismiss}>
          {t("cookies", "close")}
        </button>
      </div>
    </div>
  );
}
