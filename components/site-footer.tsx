"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Download, Facebook, Instagram, Linkedin, Twitter, Youtube } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import LanguageSwitcher from "@/components/language-switcher";
import { useT } from "@/lib/i18n";
import styles from "./site-footer.module.css";

// Shared Lakisa footer: public homepage and /about. Original copy and
// design: four link columns (About, Resources, Partnerships, Help), a
// brand block with social icons, and a legal bar with the language
// switcher. /terms, /privacy and /guide exist (phase C created them);
// the links point straight at them.
//
// Social accounts: Lakisa has no public accounts yet. The icons link to
// "#" on purpose: TODO: replace each href with the real Lakisa account
// URL once the accounts exist. No fake account URL is invented here.

// Minimal shape of the browser's install prompt event (not in the DOM
// lib): prompt() shows the browser's own install dialog.
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}

const SOCIALS = [
  { key: "socialInstagram", label: "socialInstagram", icon: Instagram },
  { key: "socialFacebook", label: "socialFacebook", icon: Facebook },
  { key: "socialLinkedin", label: "socialLinkedin", icon: Linkedin },
  { key: "socialYoutube", label: "socialYoutube", icon: Youtube },
  { key: "socialX", label: "socialX", icon: Twitter },
] as const;

export default function SiteFooter() {
  const t = useT();
  // PWA install: the button only appears when the browser fires
  // beforeinstallprompt (desktop Chrome/Edge, once the manifest and
  // service worker are in place). On click it shows the browser's own
  // install dialog; afterwards the prompt is gone for good.
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);
  const onInstallClick = async () => {
    if (!installPrompt) return;
    await installPrompt.prompt();
    setInstallPrompt(null);
  };
  return (
    <footer className={styles.footer}>
      <div className={styles.inner}>
        <div className={styles.brandBlock}>
          <Link href="/" aria-label="Lakisa: home">
            <BrandLogo variant="horizontal" theme="dark" height={52} />
          </Link>
          <p>{t("common", "footerTagline")}</p>
          <div className={styles.socials}>
            <span className={styles.socialLabel}>{t("footer", "follow")}</span>
            <div className={styles.socialIcons}>
              {SOCIALS.map((social) => (
                <a
                  key={social.key}
                  href="#"
                  aria-label={t("footer", social.label)}
                  title={t("footer", "socialPending")}
                >
                  <social.icon size={17} />
                </a>
              ))}
            </div>
          </div>
          {installPrompt && (
            <button
              type="button"
              onClick={onInstallClick}
              className={styles.installButton}
            >
              <Download size={16} />
              {t("footer", "installApp")}
            </button>
          )}
        </div>

        <nav className={styles.columns} aria-label="Footer">
          <div className={styles.column}>
            <h3>{t("footer", "about")}</h3>
            <Link href="/about">{t("footer", "aboutLakisa")}</Link>
            <Link href="/about#what-we-do">{t("footer", "whatWeDo")}</Link>
            <Link href="/magazine">{t("nav", "magazine")}</Link>
            <Link href="/about#contact">{t("footer", "contact")}</Link>
          </div>

          <div className={styles.column}>
            <h3>{t("footer", "resources")}</h3>
            <Link href="/guide">{t("footer", "userGuide")}</Link>
            <Link href="/tools">{t("footer", "allTools")}</Link>
            <Link href="/pricing">{t("footer", "pricing")}</Link>
            <Link href="/tools/price-your-work">{t("tools", "priceYourWork")}</Link>
            <Link href="/tools/portfolio-pdf">{t("tools", "portfolioPdf")}</Link>
          </div>

          <div className={styles.column}>
            <h3>{t("footer", "partnerships")}</h3>
            <Link href="/tools/for-galleries">{t("tools", "forGalleries")}</Link>
            <Link href="/tools/for-artists">{t("tools", "forArtists")}</Link>
            <Link href="/tools/for-curators">{t("tools", "forCurators")}</Link>
            <Link href="/tools/for-collectors">{t("tools", "forCollectors")}</Link>
          </div>

          <div className={styles.column}>
            <h3>{t("footer", "help")}</h3>
            <Link href="/about#help">{t("footer", "helpCentre")}</Link>
            <Link href="/about#contact">{t("footer", "contactUs")}</Link>
            <Link href="/terms">{t("footer", "terms")}</Link>
            <Link href="/privacy">{t("footer", "privacy")}</Link>
          </div>
        </nav>
      </div>

      <div className={styles.legal}>
        <span>{t("footer", "copyright")}</span>
        <span className={styles.legalLinks}>
          <Link href="/terms">{t("footer", "terms")}</Link>
          <Link href="/privacy">{t("footer", "privacy")}</Link>
        </span>
        <LanguageSwitcher />
      </div>
    </footer>
  );
}
