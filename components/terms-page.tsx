"use client";

import Link from "next/link";
import { ArrowLeft, Mail } from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import SiteFooter from "@/components/site-footer";
import { useT } from "@/lib/i18n";
import styles from "./legal-page.module.css";

// /terms — Terms of Use. Original Lakisa text, written for this
// platform (a 3D gallery where artists build virtual exhibitions).
// The body is in English: English is the language of Lakisa's legal
// documents, and the French translation is planned (see the note at
// the top of the page, translated through the dictionary). Contact is
// the founder's published studio address, contact@kabeyailunga.com —
// TODO: replace with a Lakisa address (e.g. legal@lakisa.art) once one
// exists. No fake address invented. Governing law is Uganda, where
// Lakisa is run from.
//
// Nothing here is copied from any other platform's terms.

type Section = { id: string; title: string; body: string[] };

const SECTIONS: Section[] = [
  {
    id: "acceptance",
    title: "1. Acceptance of these terms",
    body: [
      "These Terms of Use govern your use of Lakisa, the online platform at lakisa.art and its related services (the “Service”). By creating an account, or by using the Service in any way, you agree to these terms. If you do not agree, do not use the Service.",
      "Lakisa may update these terms from time to time. When a change matters (for example, a change to what we do with your work or your data), we will tell you in the product or by email before it takes effect. Continuing to use the Service after a change means you accept the updated terms.",
      "If you are under 18, you may use Lakisa only with the permission of a parent or legal guardian, who accepts these terms on your behalf.",
    ],
  },
  {
    id: "service",
    title: "2. What Lakisa is",
    body: [
      "Lakisa is a virtual gallery. It lets artists and curators create exhibitions in three-dimensional rooms, place artworks on the walls, and share those exhibitions with visitors, who walk through them in a web browser. Visitors can browse public exhibitions without an account; creating and publishing an exhibition requires one.",
      "Lakisa also provides supporting tools for artists (an artwork library, a portfolio builder, pricing and presentation helpers) as part of the same Service. Which tools are available may change as the platform grows.",
      "Lakisa does not sell artworks. When an artist chooses to show that a work is available, any sale is agreed directly between the artist and the buyer. Lakisa is not a party to that sale and takes no commission on it.",
    ],
  },
  {
    id: "accounts",
    title: "3. Your account",
    body: [
      "To create an account, give us an email address and choose a password, or sign in with Google. You are responsible for keeping your password secret and for everything done through your account.",
      "Give us accurate information and keep it up to date. One person, one account: do not create accounts for other people, and do not share your account with someone else.",
      "Tell us promptly at contact@kabeyailunga.com if you believe someone else is using your account. Lakisa is not liable for loss caused by unauthorised use of your account if you did not keep your credentials safe.",
      "You may delete your account at any time from Settings. Deleting your account deletes your exhibitions, your artworks and your profile with them. That deletion is permanent.",
    ],
  },
  {
    id: "content",
    title: "4. Your content and intellectual property",
    body: [
      "You keep every right in the work you upload: your images, your texts, your exhibition titles and descriptions, and any audio or video you add. Lakisa claims nothing over your artworks.",
      "By uploading content, you give Lakisa only the permission it needs to run the Service: to store your content, display it to the people you choose to share it with, and make the technical copies (such as resized images) needed for the 3D rooms to load. That permission ends when you delete the content or your account, except for copies kept in ordinary backups, which are removed as the backups rotate.",
      "You are responsible for what you upload. Only upload work you own or have the right to share, and do not upload work that infringes someone else's copyright, trademark or other rights. If you believe content on Lakisa infringes your rights, write to contact@kabeyailunga.com with a link to the content and a description of your claim, and we will look into it.",
      "Lakisa's own name, logo and the design of the platform belong to Lakisa. You may not copy them or use them to suggest an endorsement that does not exist.",
    ],
  },
  {
    id: "rules",
    title: "5. Rules of use",
    body: [
      "Use Lakisa for art, and for the conversations around it. Do not use it to break the law, to harass or threaten anyone, to publish hateful or discriminatory content, or to publish pornographic, violent or otherwise illegal material.",
      "Do not impersonate another person or gallery, and do not present someone else's work as your own. Do not upload content you do not have the right to share.",
      "Do not try to break the platform: no scraping of the Service at a scale that degrades it for others, no attempts to access other people's accounts or private exhibitions, no uploading of malware, and no use of the Service to send spam.",
      "If you break these rules, we may warn you, hide or remove the content concerned, limit what your account can do, or close your account, depending on the seriousness of the breach. Where the law requires it, we may report illegal activity to the authorities.",
    ],
  },
  {
    id: "sharing",
    title: "6. Public and private exhibitions",
    body: [
      "An exhibition is a draft until you publish it. Drafts are visible only to you.",
      "When you publish, you choose who can enter: “Public” means the exhibition is listed on Lakisa and open to everyone, and may also appear in the Lakisa Feed; “Private link” means it is published but never listed. Only people with the direct link can open it; “Password” means it is published, but visitors must enter a password you set before they can enter.",
      "You can change the visibility of a published exhibition at any time, or unpublish it. Unpublishing removes it from public listings, but it does not erase copies someone else may have made while it was public, such as screenshots or a shared link.",
      "A private link is not a secret you can fully control: anyone who receives the link can open the exhibition and pass the link on. If a private link spreads further than you intended, change the exhibition back to a draft or set a password.",
    ],
  },
  {
    id: "availability",
    title: "7. Availability of the Service",
    body: [
      "Lakisa is provided as it is, and we work to keep it available. But the Service may be interrupted for maintenance, or by problems outside our control: hosting outages, network failures, or a visitor's own device or browser. We do not guarantee uninterrupted access.",
      "We keep backups of the platform's data, but you remain responsible for your own originals. Keep a copy of every artwork and text you care about outside Lakisa.",
      "Features change. We may add, change or remove a feature, or stop the Service altogether, with reasonable notice where that is possible.",
    ],
  },
  {
    id: "liability",
    title: "8. Limitation of liability",
    body: [
      "To the extent the law allows, Lakisa is not liable for indirect losses (lost income, lost opportunity, or loss of data) arising from your use of the Service.",
      "Our total liability for any claim related to the Service is limited to the amount you paid us for the Service in the twelve months before the claim (which, while the Service is free, is zero).",
      "Nothing in these terms limits liability that cannot be limited by law, including liability for death or personal injury caused by negligence, or for fraud.",
    ],
  },
  {
    id: "termination",
    title: "9. Ending your use",
    body: [
      "You may stop using Lakisa at any time, and you may delete your account from Settings as described in section 3.",
      "We may suspend or close your account if you seriously or repeatedly break these terms, if you use the Service in a way that harms other users or the platform, or if we are required to do so by law. Where possible, we will tell you why before we do so.",
      "Sections 4 (your rights in your content), 8 (limitation of liability) and 10 (governing law) continue to apply after your account is closed.",
    ],
  },
  {
    id: "law",
    title: "10. Governing law and contact",
    body: [
      "These terms are governed by the laws of Uganda, where Lakisa is operated from. Any dispute about them will be settled in the courts of Uganda.",
      "If any part of these terms is found unenforceable, the rest of them still applies.",
      "For any question about these terms, or about Lakisa in general, write to us at contact@kabeyailunga.com.",
    ],
  },
];

export default function TermsPage() {
  const t = useT();
  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          <BrandLogo variant="horizontal" theme="dark" height={52} />
        </Link>
        <Link href="/" className={styles.backLink}>
          <ArrowLeft size={15} /> {t("legal", "backHome")}
        </Link>
      </header>

      <section className={styles.hero}>
        <p className={styles.eyebrow}>{t("legal", "termsEyebrow")}</p>
        <h1 className={styles.title}>{t("legal", "termsTitle")}</h1>
        <p className={styles.intro}>{t("legal", "termsIntro")}</p>
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
          </section>
        ))}

        <section className={styles.section}>
          <a className={styles.mailLink} href="mailto:contact@kabeyailunga.com">
            <Mail size={16} /> contact@kabeyailunga.com
          </a>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
