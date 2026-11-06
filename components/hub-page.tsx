import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";
import HubShell from "@/components/hub-shell";
import type { SidebarActive } from "@/components/sidebar";
import styles from "./tools.module.css";

// One card on a hub page. `href` set means the tool exists and works —
// the card links to its real page. `href` absent means the card is a
// plain, non-clickable block, honestly marked with its status: either
// "In development" (not built yet, arriving in a later phase) or
// "Owner only" (built, but restricted to the platform owner). No card
// ever pretends to work, and there are no dead links.
export type HubCard = {
  href?: string;
  icon: LucideIcon;
  title: string;
  description: string;
  status: "ready" | "development" | "owner-only";
};

export function HubCards({ cards }: { cards: HubCard[] }) {
  return (
    <section className="galleries-grid">
      {cards.map((card) => (
        <article key={card.title} className={`gallery-card ${styles.toolCard}`}>
          {card.status === "ready" && card.href ? (
            <Link href={card.href} className={styles.toolCardLink} aria-label={`Open ${card.title}`}>
              <span className={styles.toolIcon}>
                <card.icon size={22} />
              </span>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <span className={styles.toolOpen}>
                Open <ArrowRight size={15} />
              </span>
            </Link>
          ) : (
            <div
              className={styles.toolCardLink}
              aria-label={`${card.title} — ${card.status === "development" ? "in development" : "owner only"}`}
            >
              <span className={styles.toolIcon}>
                <card.icon size={22} />
              </span>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
              <span className="hub-dev-badge">
                {card.status === "development" ? "In development" : "Owner only"}
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
  title,
  eyebrow,
  description,
  cards,
}: {
  user: { id: string; name: string; email: string; isAdmin?: boolean };
  exhibitionCount: number;
  active: SidebarActive;
  hubName: string;
  title: string;
  eyebrow: string;
  description: string;
  cards: HubCard[];
}) {
  return (
    <HubShell
      user={user}
      exhibitionCount={exhibitionCount}
      active={active}
      hubName={hubName}
      title={title}
      eyebrow={eyebrow}
      description={description}
    >
      <HubCards cards={cards} />
    </HubShell>
  );
}
