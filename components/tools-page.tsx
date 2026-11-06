"use client";

import Link from "next/link";
import {
  Aperture,
  Archive,
  ArrowRight,
  Calculator,
  FileText,
  Gem,
  Image,
  LayoutGrid,
  Palette,
  Presentation,
  Store,
  Users,
} from "lucide-react";
import ToolsShell from "@/components/tools-shell";
import styles from "./tools.module.css";

// Tools hub: the working tools for artists, curators, galleries and
// collectors, and the pages that say what SANAA does for each of them.
// Written in SANAA's own words — the tool ideas follow the same needs as
// the big art platforms, the copy and the design are ours.
const TOOLS = [
  {
    href: "/tools/price-your-work",
    icon: Calculator,
    title: "Price your work",
    description: "Work out a fair price for a piece, from your hours, your materials and its size.",
  },
  {
    href: "/tools/inventory",
    icon: Archive,
    title: "Inventory & Collections",
    description: "Your artworks in one list — what you made, where it is, and what it is worth.",
  },
  {
    href: "/tools/contacts",
    icon: Users,
    title: "Contacts",
    description: "Collectors, curators, galleries and advisors — who they are and how to reach them.",
  },
  {
    href: "/tools/present-sell",
    icon: Presentation,
    title: "Present & Sell",
    description: "Your published rooms as viewing rooms — share them, track visits, follow up.",
  },
  {
    href: "/tools/documents",
    icon: FileText,
    title: "Documents",
    description: "Certificates of authenticity, labels and artwork sheets, ready to print.",
  },
  {
    href: "/tools/mockup-studio",
    icon: Image,
    title: "Mockup Studio",
    description: "See your work on a real wall before you hang it — interiors, frames, lighting and print-ready exports.",
  },
  {
    href: "/tools/photography-lab",
    icon: Aperture,
    title: "Photography Lab",
    description: "Clean up artwork photos — crop, straighten, correct light and colour, and export print-ready files.",
  },
  {
    href: "/tools/color-intelligence",
    icon: Palette,
    title: "Color Intelligence",
    description: "Read the colours in a work — palettes, harmonies and contrast — and find the right wall for it.",
  },
  {
    href: "/tools/presentation-designer",
    icon: Presentation,
    title: "Presentation Designer",
    description: "Build a presentation for a buyer, a gallery or a jury — slides from your own artworks, ready to share.",
  },
] as const;

const AUDIENCES = [
  {
    href: "/tools/for-artists",
    icon: Palette,
    title: "For Artists",
    description: "Run your studio from one place: inventory, pricing, sales and documents.",
  },
  {
    href: "/tools/for-curators",
    icon: LayoutGrid,
    title: "For Curators",
    description: "Build exhibitions, and keep the works and the people around them in order.",
  },
  {
    href: "/tools/for-galleries",
    icon: Store,
    title: "For Galleries",
    description: "Artworks, collectors, exhibitions and sales in one platform.",
  },
  {
    href: "/tools/for-collectors",
    icon: Gem,
    title: "For Collectors",
    description: "Keep track of what you own, what it is worth, and where it came from.",
  },
] as const;

export default function ToolsPage({
  user,
  exhibitionCount,
}: {
  user: { id: string; name: string; email: string };
  exhibitionCount: number;
}) {
  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="Tools"
      eyebrow="TOOLS FOR ARTISTS, CURATORS, GALLERIES & COLLECTORS"
      description="The everyday tools of the art world, inside your workspace — price a work, keep your inventory, know your contacts, present and sell, and print the documents that go with a sale."
    >
      <section className="galleries-grid">
        {TOOLS.map((tool) => (
          <article key={tool.href} className={`gallery-card ${styles.toolCard}`}>
            <Link href={tool.href} className={styles.toolCardLink} aria-label={`Open ${tool.title}`}>
              <span className={styles.toolIcon}>
                <tool.icon size={22} />
              </span>
              <h3>{tool.title}</h3>
              <p>{tool.description}</p>
              <span className={styles.toolOpen}>
                Open <ArrowRight size={15} />
              </span>
            </Link>
          </article>
        ))}
      </section>

      <section className={styles.audienceSection}>
        <p className="eyebrow">
          <span className="status-dot" /> WHO IT IS FOR
        </p>
        <h2>One platform, shaped to how you work.</h2>
        <div className="galleries-grid">
          {AUDIENCES.map((audience) => (
            <article key={audience.href} className={`gallery-card ${styles.toolCard}`}>
              <Link
                href={audience.href}
                className={styles.toolCardLink}
                aria-label={`SANAA ${audience.title}`}
              >
                <span className={styles.toolIcon}>
                  <audience.icon size={22} />
                </span>
                <h3>{audience.title}</h3>
                <p>{audience.description}</p>
                <span className={styles.toolOpen}>
                  Read more <ArrowRight size={15} />
                </span>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </ToolsShell>
  );
}
