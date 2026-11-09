"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Boxes,
  Eye,
  Frame,
  Globe,
  Mail,
  PlusCircle,
  Send,
} from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import SiteFooter from "@/components/site-footer";
import { useT } from "@/lib/i18n";
import styles from "./about-page.module.css";

// /about — "Ce que nous faisons". Original Lakisa copy (lib/i18n.ts,
// section "about"), same black & white editorial design as the public
// homepage. Sections carry the anchors the footer links to: #what-we-do,
// #guide, #help, #contact.
//
// Contact: Lakisa has no dedicated inbox yet, so the contact section
// points at the founder's published studio address,
// contact@kabeyailunga.com — TODO: replace with a Lakisa address
// (e.g. bonjour@lakisa.art) once one exists. No fake address invented.
export default function AboutPage() {
  const t = useT();
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          <BrandLogo variant="horizontal" theme="dark" height={34} />
        </Link>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={15} /> {t("about", "backHome")}
        </Link>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>{t("about", "eyebrow")}</p>
        <h1 className={styles.title}>{t("about", "title")}</h1>
        <p className={styles.intro}>{t("about", "intro")}</p>
      </section>

      <section className={styles.section} id="what-we-do">
        <h2>{t("about", "whatWeDoTitle")}</h2>
        <p className={styles.sectionIntro}>{t("about", "whatWeDoIntro")}</p>
        <div className={styles.cards}>
          <article className={styles.card}>
            <Boxes size={22} />
            <h3>{t("about", "buildTitle")}</h3>
            <p>{t("about", "buildText")}</p>
          </article>
          <article className={styles.card}>
            <Frame size={22} />
            <h3>{t("about", "hangTitle")}</h3>
            <p>{t("about", "hangText")}</p>
          </article>
          <article className={styles.card}>
            <Globe size={22} />
            <h3>{t("about", "inviteTitle")}</h3>
            <p>{t("about", "inviteText")}</p>
          </article>
        </div>
      </section>

      <section className={styles.section} id="guide">
        <h2>{t("about", "guideTitle")}</h2>
        <ol className={styles.steps}>
          <li>
            <Eye size={20} />
            <div>
              <h3>{t("about", "guideVisitTitle")}</h3>
              <p>{t("about", "guideVisitText")}</p>
            </div>
          </li>
          <li>
            <PlusCircle size={20} />
            <div>
              <h3>{t("about", "guideCreateTitle")}</h3>
              <p>{t("about", "guideCreateText")}</p>
            </div>
          </li>
          <li>
            <Send size={20} />
            <div>
              <h3>{t("about", "guidePublishTitle")}</h3>
              <p>{t("about", "guidePublishText")}</p>
            </div>
          </li>
        </ol>
      </section>

      <section className={styles.section} id="help">
        <h2>{t("about", "helpTitle")}</h2>
        <div className={styles.faq}>
          <article>
            <h3>{t("about", "faq1q")}</h3>
            <p>{t("about", "faq1a")}</p>
          </article>
          <article>
            <h3>{t("about", "faq2q")}</h3>
            <p>{t("about", "faq2a")}</p>
          </article>
          <article>
            <h3>{t("about", "faq3q")}</h3>
            <p>{t("about", "faq3a")}</p>
          </article>
        </div>
      </section>

      <section className={styles.section} id="contact">
        <h2>{t("about", "contactTitle")}</h2>
        <p className={styles.sectionIntro}>{t("about", "contactText")}</p>
        <a className={styles.mailLink} href="mailto:contact@kabeyailunga.com">
          <Mail size={16} /> contact@kabeyailunga.com
        </a>
      </section>

      <SiteFooter />
    </main>
  );
}
