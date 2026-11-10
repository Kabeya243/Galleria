"use client";

import Link from "next/link";
import {
  Aperture,
  Archive,
  ArrowRight,
  Box,
  Calculator,
  Clapperboard,
  ClipboardCheck,
  ClipboardList,
  FileText,
  Frame,
  Gem,
  Globe,
  LayoutGrid,
  Palette,
  Route,
  Search,
  Store,
  Users,
} from "lucide-react";
import ToolsShell from "@/components/tools-shell";
import { useT } from "@/lib/i18n";
import { useState } from "react";
import styles from "./tools.module.css";

// Tools hub: the working tools for artists, curators, galleries and
// collectors, and the pages that say what SANAA does for each of them.
// Written in SANAA's own words — the tool ideas follow the same needs as
// the big art platforms, the copy and the design are ours.
//
// Nov 2026 cleanup: the hub only lists tools that exist and work.
// Removed (their routes redirect to /tools): Present & Sell, Color
// Intelligence, Presentation Designer, Accessibility Studio, Education
// Studio, AI Architect, Artwork Intelligence, AI Assistant, Marketing
// Studio, Print Studio, Teams, Digital Twin (hidden for now).
// Merged: Collection Manager into Inventory, Visitor Analytics into the
// dashboard (/#visitor-analytics), Frame Studio + Mockup Studio into
// Frames & Art on Walls. The Website Builder opens in a new window,
// fullscreen, as a standalone platform.
const TOOLS = [
  {
    href: "/tools/art-in-context",
    icon: Route,
    title: "artInContext",
    description: "artInContextDesc",
  },
  {
    href: "/tools/price-your-work",
    icon: Calculator,
    title: "priceYourWork",
    description: "priceYourWorkDesc",
  },
  {
    href: "/tools/inventory",
    icon: Archive,
    title: "inventory",
    description: "inventoryDesc",
  },
  {
    href: "/tools/contacts",
    icon: Users,
    title: "contacts",
    description: "contactsDesc",
  },
  {
    href: "/tools/documents",
    icon: FileText,
    title: "documents",
    description: "documentsDesc",
  },
  {
    href: "/tools/frames-walls",
    icon: Frame,
    title: "framesWalls",
    description: "framesWallsDesc",
  },
  {
    href: "/tools/photography-lab",
    icon: Aperture,
    title: "photographyLab",
    description: "photographyLabDesc",
  },
  {
    href: "/tools/exhibition-planner",
    icon: ClipboardList,
    title: "exhibitionPlanner",
    description: "exhibitionPlannerDesc",
  },
  {
    href: "/tools/open-calls",
    icon: ClipboardCheck,
    title: "openCalls",
    description: "openCallsDesc",
  },
  {
    href: "/tools/image-to-3d",
    icon: Box,
    title: "imageTo3d",
    description: "imageTo3dDesc",
  },
  {
    href: "/tools/video-generator",
    icon: Clapperboard,
    title: "videoGenerator",
    description: "videoGeneratorDesc",
  },
  {
    href: "/tools/website-builder/advanced",
    icon: Globe,
    title: "websiteBuilder",
    description: "websiteBuilderDesc",
    // Opens in a new window, fullscreen, like a standalone platform.
    newWindow: true,
  },
  {
    href: "/tools/portfolio-pdf",
    icon: FileText,
    title: "portfolioPdf",
    description: "portfolioPdfDesc",
  },
  {
    href: "/marketplace",
    icon: Store,
    title: "marketplace",
    description: "marketplaceDesc",
  },
] as const;

const AUDIENCES = [
  {
    href: "/tools/for-artists",
    icon: Palette,
    title: "forArtists",
    description: "forArtistsDesc",
  },
  {
    href: "/tools/for-curators",
    icon: LayoutGrid,
    title: "forCurators",
    description: "forCuratorsDesc",
  },
  {
    href: "/tools/for-galleries",
    icon: Store,
    title: "forGalleries",
    description: "forGalleriesDesc",
  },
  {
    href: "/tools/for-collectors",
    icon: Gem,
    title: "forCollectors",
    description: "forCollectorsDesc",
  },
] as const;

export default function ToolsPage({
  user,
  exhibitionCount,
}: {
  user: { id: string; name: string; email: string };
  exhibitionCount: number;
}) {
  const t = useT();
  // Local search (Nov 2026): this search only filters the cards on
  // this page — tools and audiences — by their title and description.
  // Every page has its own search; there is no global search yet.
  const [query, setQuery] = useState("");
  const needle = query.trim().toLowerCase();
  const matches = (title: string, description: string) =>
    needle === "" ||
    title.toLowerCase().includes(needle) ||
    description.toLowerCase().includes(needle);
  const visibleTools = TOOLS.filter((tool) =>
    matches(t("tools", tool.title), t("tools", tool.description)),
  );
  const visibleAudiences = AUDIENCES.filter((audience) =>
    matches(t("tools", audience.title), t("tools", audience.description)),
  );

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="toolsHub"
      eyebrow="toolsHubEyebrow"
      description="toolsHubDesc"
    >
      <label
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          maxWidth: 420,
          marginBottom: 20,
          padding: "9px 12px",
          border: "1px solid var(--line)",
          borderRadius: 8,
          background: "var(--card, transparent)",
        }}
      >
        <Search size={16} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("tools", "searchTools")}
          aria-label={t("tools", "searchTools")}
          style={{
            border: "none",
            outline: "none",
            background: "transparent",
            color: "inherit",
            fontSize: 14,
            width: "100%",
          }}
        />
      </label>

      {visibleTools.length === 0 && visibleAudiences.length === 0 ? (
        <p style={{ color: "var(--muted)", fontSize: 14 }}>{t("tools", "noToolsMatch")}</p>
      ) : (
        <>
          <section className="galleries-grid">
            {visibleTools.map((tool) => {
              const label = `${t("tools", "open")}, ${t("tools", tool.title)}`;
              const body = (
                <>
                  <span className={styles.toolIcon}>
                    <tool.icon size={22} />
                  </span>
                  <h3>{t("tools", tool.title)}</h3>
                  <p>{t("tools", tool.description)}</p>
                  <span className={styles.toolOpen}>
                    {t("tools", "open")} <ArrowRight size={15} />
                  </span>
                </>
              );
              return (
                <article key={tool.href} className={`gallery-card ${styles.toolCard}`}>
                  {"newWindow" in tool && tool.newWindow ? (
                    <a
                      href={tool.href}
                      target="_blank"
                      rel="noreferrer"
                      className={styles.toolCardLink}
                      aria-label={label}
                    >
                      {body}
                    </a>
                  ) : (
                    <Link href={tool.href} className={styles.toolCardLink} aria-label={label}>
                      {body}
                    </Link>
                  )}
                </article>
              );
            })}
          </section>

          {visibleAudiences.length > 0 && (
            <section className={styles.audienceSection}>
              <p className="eyebrow">
                <span className="status-dot" /> {t("tools", "whoItIsFor")}
              </p>
              <h2>{t("tools", "onePlatform")}</h2>
              <div className="galleries-grid">
                {visibleAudiences.map((audience) => (
                  <article key={audience.href} className={`gallery-card ${styles.toolCard}`}>
                    <Link
                      href={audience.href}
                      className={styles.toolCardLink}
                      aria-label={`Lakisa, ${t("tools", audience.title)}`}
                    >
                      <span className={styles.toolIcon}>
                        <audience.icon size={22} />
                      </span>
                      <h3>{t("tools", audience.title)}</h3>
                      <p>{t("tools", audience.description)}</p>
                      <span className={styles.toolOpen}>
                        Read more <ArrowRight size={15} />
                      </span>
                    </Link>
                  </article>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </ToolsShell>
  );
}
