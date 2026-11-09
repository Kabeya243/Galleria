"use client";

import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import SiteFooter from "@/components/site-footer";
import { useT } from "@/lib/i18n";
import styles from "./legal-page.module.css";

// /privacy — Privacy Policy. Original Lakisa text, written for this
// platform. The body is in English: English is the language of
// Lakisa's legal documents, and the French translation is planned
// (see the note at the top of the page). The facts stated here are
// grounded in the code: accounts (email + password hash, or Google
// sign-in), profile fields, artworks and exhibitions stored in the
// Cloudflare R2 bucket "sanaa", hosting on Vercel, transactional mail
// sent with nodemailer, a session cookie, the language choice in
// localStorage, and server-side visit counts. Lakisa runs no
// third-party advertising tracker. Contact is the founder's published
// studio address, contact@kabeyailunga.com — TODO: replace with a
// Lakisa address once one exists. No fake address invented.
//
// Nothing here is copied from any other platform's privacy policy.

type Section = { id: string; title: string; body: string[]; list?: string[] };

const SECTIONS: Section[] = [
  {
    id: "collected",
    title: "1. Data we collect",
    body: [
      "Lakisa collects only what it needs to run a virtual gallery. That is:",
    ],
    list: [
      "Account data — your email address and, if you register with a password, a one-way hash of that password (we never store your password itself). If you sign in with Google, Google gives us your email address and your name; we do not receive your Google password.",
      "Profile data — the display name, biography and profile photo you choose to add in Settings.",
      "Your work — the artworks you upload (images, and where supported, video or 3D files), their titles, descriptions and dimensions, and the exhibitions you build: their titles, descriptions, room choices, wall colours, artwork placement and visibility settings.",
      "Usage data — how the Service is used: which public exhibitions are visited and how often, so that artists can see how many people visited their work. A visit is counted per exhibition, per day; we do not build a browsing profile of individual visitors.",
      "Messages you send us — the content of emails you write to Lakisa, for example when you report a problem or ask a question.",
    ],
  },
  {
    id: "purposes",
    title: "2. Why we collect it",
    body: [
      "We use your data only to run Lakisa and to make it better:",
    ],
    list: [
      "To let you sign in, keep your account secure, and show you your own exhibitions and artworks.",
      "To display the exhibitions you publish to the visitors you choose — everyone, people with the link, or people with the password.",
      "To show artists how their exhibitions are received (visit counts), and to keep the platform working (for example, to find out which pages fail).",
      "To answer your messages, and to send you the emails the Service needs — such as a password reset. We do not send marketing emails, and we do not sell your data.",
    ],
  },
  {
    id: "cookies",
    title: "3. Cookies and local storage",
    body: [
      "Lakisa uses one session cookie to keep you signed in. It contains a session token, it is set when you sign in, and it is removed when you sign out. Without it, the Service cannot tell that it is you.",
      "Your language choice (English or French) is stored in your browser's local storage, on your device, so the site opens in the language you picked. Your saved favourite rooms are stored the same way — in your browser only, and not synced to your account.",
      "Lakisa runs no third-party advertising cookies and no advertising trackers.",
    ],
  },
  {
    id: "third-parties",
    title: "4. Who else handles your data",
    body: [
      "Lakisa does not sell your personal data to anyone. A small number of service providers handle data on our behalf, only to run the platform:",
    ],
    list: [
      "Hosting — the website and its database are hosted by Vercel. When you visit Lakisa, your request passes through Vercel's servers.",
      "File storage — the images and files you upload are stored in a Cloudflare R2 storage bucket. Public exhibition images are served from there to visitors.",
      "Email — transactional emails (such as password resets) are sent through our email provider using standard SMTP. Your email address is shared with that provider only to deliver the message.",
      "Google sign-in — if you choose “Continue with Google”, Google handles your sign-in and shares your email address and name with Lakisa, as described in section 1. Google's own privacy policy governs what Google does with your data on its side.",
    ],
  },
  {
    id: "retention",
    title: "5. How long we keep it",
    body: [
      "We keep your account, your profile and your work for as long as your account exists. When you delete an artwork or an exhibition, it is removed from the live platform; copies may remain in ordinary backups for a limited time while those backups rotate, and are then gone.",
      "When you delete your account in Settings, your exhibitions, your artworks and your profile are deleted with it. Visit counts are aggregate numbers attached to an exhibition, so they disappear with the exhibition. Emails you sent us may be kept for as long as needed to answer them and to keep a record of the exchange.",
    ],
  },
  {
    id: "rights",
    title: "6. Your rights",
    body: [
      "Your work and your data are yours. You can, at any time:",
    ],
    list: [
      "Access your data — your profile, your artworks and your exhibitions are visible to you in your workspace, and you can download the files you uploaded.",
      "Correct it — change your display name, biography and profile photo in Settings, and edit any artwork or exhibition you own.",
      "Delete it — delete individual artworks and exhibitions, or delete your whole account in Settings, which deletes everything attached to it (see section 5).",
      "Ask us about it — write to contact@kabeyailunga.com if you want a copy of the personal data we hold about you, or if you want something corrected or deleted that you cannot change yourself. We will answer within a reasonable time.",
    ],
  },
  {
    id: "security",
    title: "7. Security",
    body: [
      "We protect your data with the measures a small platform can reasonably provide: passwords are stored as one-way hashes, never in plain text; sign-in sessions use a secure cookie; and access to the database and file storage is limited to the people who run the platform.",
      "No system is perfectly secure. If you believe your account has been compromised, change your password and write to contact@kabeyailunga.com. If we discover a breach that affects your personal data, we will tell you what happened and what we are doing about it.",
    ],
  },
  {
    id: "children",
    title: "8. Children",
    body: [
      "Lakisa is not aimed at children under 13, and we do not knowingly collect personal data from them. If you are under 18, use Lakisa only with a parent or guardian's permission, as the Terms of Use explain.",
    ],
  },
  {
    id: "changes",
    title: "9. Changes to this policy",
    body: [
      "We may update this policy when Lakisa changes — for example, if we add a new feature that collects a new kind of data. When a change matters, we will tell you in the product or by email before it takes effect. The date at the top of this page shows when it was last updated.",
    ],
  },
  {
    id: "contact",
    title: "10. Contact",
    body: [
      "Lakisa is operated from Uganda. For any question about this policy, or about your personal data, write to contact@kabeyailunga.com.",
    ],
  },
];

export default function PrivacyPage() {
  const t = useT();
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          <BrandLogo variant="horizontal" theme="dark" height={34} />
        </Link>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={15} /> {t("legal", "backHome")}
        </Link>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>{t("legal", "privacyEyebrow")}</p>
        <h1 className={styles.title}>{t("legal", "privacyTitle")}</h1>
        <p className={styles.intro}>{t("legal", "privacyIntro")}</p>
        <p className={styles.meta}>{t("legal", "lastUpdated")}</p>
        <p className={styles.note}>{t("legal", "translationNote")}</p>
      </section>

      <div className={styles.body}>
        <ol className={styles.toc}>
          {SECTIONS.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`}>{section.title}</a>
            </li>
          ))}
        </ol>

        {SECTIONS.map((section) => (
          <section key={section.id} className={styles.section} id={section.id}>
            <h2>{section.title}</h2>
            {section.body.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
            {section.list && (
              <ul>
                {section.list.map((item, index) => (
                  <li key={index}>{item}</li>
                ))}
              </ul>
            )}
          </section>
        ))}

        <section className={styles.section}>
          <p>{t("legal", "contactLine")}</p>
          <a className={styles.mailLink} href="mailto:contact@kabeyailunga.com">
            <Mail size={16} /> contact@kabeyailunga.com
          </a>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
