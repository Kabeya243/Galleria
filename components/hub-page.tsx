"use client";

import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import HubShell from "@/components/hub-shell";
import type { SidebarActive } from "@/components/sidebar";
import { useT, type DictionarySection } from "@/lib/i18n";
import styles from "./tools.module.css";

// One card on a hub page. `href` set means the tool exists and works —
// the card links to its real page. `href` absent means the card is a
// plain, non-clickable block, honestly marked with its status: either
// "In development" (not built yet, arriving in a later phase) or
// "Owner only" (built, but restricted to the platform owner). No card
// ever pretends to work, and there are no dead links.
// Title and description are dictionary keys (lib/i18n.ts, section
// "hubs") so the hub pages switch language with the rest of the site.
export type HubCard = {
  href?: string;
  icon: LucideIcon;
  title: DictionarySection<"hubs">;
  description: DictionarySection<"hubs">;
  status: "ready" | "development" | "owner-only";
};

export function HubCards({ cards }: { cards: HubCard[] }) {
  const t = useT();
  return (
    <section className="galleries-grid">
      {cards.map((card) => (
        <article key={card.title} className={`gallery-card ${styles.toolCard}`}>
          {card.status === "ready" && card.href ? (
            <Link href={card.href} className={styles.toolCardLink} aria-label={`${t("hubs", "open")}, ${t("hubs", card.title)}`}>
              <span className={styles.toolIcon}>
                <card.icon size={22} />
              </span>
              <h3>{t("hubs", card.title)}</h3>
              <p>{t("hubs", card.description)}</p>
              <span className={styles.toolOpen}>
                {t("hubs", "open")} <ArrowRight size={15} />
              </span>
            </Link>
          ) : (
            <div
              className={styles.toolCardLink}
              aria-label={`${t("hubs", card.title)}, ${card.status === "development" ? t("hubs", "inDevelopment") : t("hubs", "ownerOnly")}`}
            >
              <span className={styles.toolIcon}>
                <card.icon size={22} />
              </span>
              <h3>{t("hubs", card.title)}</h3>
              <p>{t("hubs", card.description)}</p>
              <span className="hub-dev-badge">
                {card.status === "development" ? t("hubs", "inDevelopment") : t("hubs", "ownerOnly")}
              </span>
            </div>
          )}
        </article>
      ))}
    </section>
  );
}

export default function HubPage({
  user,
  exhibitionCount,
  active,
  hubName,
  description,
  cards,
}: {
  user: { id: string; name: string; email: string; isAdmin?: boolean };
  exhibitionCount: number;
  active: SidebarActive;
  hubName: DictionarySection<"nav">;
  description: DictionarySection<"hubs">;
  cards: HubCard[];
}) {
  return (
    <HubShell
      user={user}
      exhibitionCount={exhibitionCount}
      active={active}
      hubName={hubName}
      description={description}
    >
      <HubCards cards={cards} />
    </HubShell>
  );
}
