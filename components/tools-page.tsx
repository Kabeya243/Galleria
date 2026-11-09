"use client";

import Link from "next/link";
import {
  Accessibility,
  Aperture,
  Archive,
  ArrowRight,
  BarChart3,
  Bot,
  Box,
  Calculator,
  Clapperboard,
  ClipboardList,
  FileText,
  Frame,
  Gem,
  Globe,
  GraduationCap,
  Image,
  LayoutGrid,
  Library,
  Megaphone,
  Palette,
  Presentation,
  Printer,
  Route,
  Scan,
  ScanEye,
  Sparkles,
  Store,
  Users,
} from "lucide-react";
import ToolsShell from "@/components/tools-shell";
import { useT } from "@/lib/i18n";
import styles from "./tools.module.css";

// Tools hub: the working tools for artists, curators, galleries and
// collectors, and the pages that say what SANAA does for each of them.
// Written in SANAA's own words — the tool ideas follow the same needs as
// the big art platforms, the copy and the design are ours.
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
    href: "/tools/present-sell",
    icon: Presentation,
    title: "presentSell",
    description: "presentSellDesc",
  },
  {
    href: "/tools/documents",
    icon: FileText,
    title: "documents",
    description: "documentsDesc",
  },
  {
    href: "/tools/frame-studio",
    icon: Frame,
    title: "frameStudio",
    description: "frameStudioDesc",
  },
  {
    href: "/tools/mockup-studio",
    icon: Image,
    title: "mockupStudio",
    description: "mockupStudioDesc",
  },
  {
    href: "/tools/photography-lab",
    icon: Aperture,
    title: "photographyLab",
    description: "photographyLabDesc",
  },
  {
    href: "/tools/color-intelligence",
    icon: Palette,
    title: "colorIntelligence",
    description: "colorIntelligenceDesc",
  },
  {
    href: "/tools/presentation-designer",
    icon: Presentation,
    title: "presentationDesigner",
    description: "presentationDesignerDesc",
  },
  {
    href: "/tools/collection-manager",
    icon: Library,
    title: "collectionManager",
    description: "collectionManagerDesc",
  },
  {
    href: "/tools/exhibition-planner",
    icon: ClipboardList,
    title: "exhibitionPlanner",
    description: "exhibitionPlannerDesc",
  },
  {
    href: "/tools/visitor-analytics",
    icon: BarChart3,
    title: "visitorAnalytics",
    description: "visitorAnalyticsDesc",
  },
  {
    href: "/tools/accessibility-studio",
    icon: Accessibility,
    title: "accessibilityStudio",
    description: "accessibilityStudioDesc",
  },
  {
    href: "/tools/education-studio",
    icon: GraduationCap,
    title: "educationStudio",
    description: "educationStudioDesc",
  },
  {
    href: "/tools/ai-architect",
    icon: Sparkles,
    title: "aiArchitect",
    description: "aiArchitectDesc",
  },
  {
    href: "/tools/artwork-intelligence",
    icon: ScanEye,
    title: "artworkIntelligence",
    description: "artworkIntelligenceDesc",
  },
  {
    href: "/tools/ai-assistant",
    icon: Bot,
    title: "aiAssistant",
    description: "aiAssistantDesc",
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
  },
  {
    href: "/tools/marketing-studio",
    icon: Megaphone,
    title: "marketingStudio",
    description: "marketingStudioDesc",
  },
  {
    href: "/tools/print-studio",
    icon: Printer,
    title: "printStudio",
    description: "printStudioDesc",
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
  {
    href: "/tools/teams",
    icon: Users,
    title: "teams",
    description: "teamsDesc",
  },
  {
    href: "/tools/digital-twin",
    icon: Scan,
    title: "digitalTwin",
    description: "digitalTwinDesc",
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
  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="toolsHub"
      eyebrow="toolsHubEyebrow"
      description="toolsHubDesc"
    >
      <section className="galleries-grid">
        {TOOLS.map((tool) => (
          <article key={tool.href} className={`gallery-card ${styles.toolCard}`}>
            <Link href={tool.href} className={styles.toolCardLink} aria-label={`${t("tools", "open")} — ${t("tools", tool.title)}`}>
              <span className={styles.toolIcon}>
                <tool.icon size={22} />
              </span>
              <h3>{t("tools", tool.title)}</h3>
              <p>{t("tools", tool.description)}</p>
              <span className={styles.toolOpen}>
                {t("tools", "open")} <ArrowRight size={15} />
              </span>
            </Link>
          </article>
        ))}
      </section>

      <section className={styles.audienceSection}>
        <p className="eyebrow">
          <span className="status-dot" /> {t("tools", "whoItIsFor")}
        </p>
        <h2>{t("tools", "onePlatform")}</h2>
        <div className="galleries-grid">
          {AUDIENCES.map((audience) => (
            <article key={audience.href} className={`gallery-card ${styles.toolCard}`}>
              <Link
                href={audience.href}
                className={styles.toolCardLink}
                aria-label={`Lakisa — ${t("tools", audience.title)}`}
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
    </ToolsShell>
  );
}
