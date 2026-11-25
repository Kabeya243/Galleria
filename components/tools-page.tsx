"use client";

import Link from "next/link";
import {
  Aperture,
  Archive,
  ArrowRight,
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
import { ToolLockedDialog } from "@/components/subscription-dialogs";
import { useT } from "@/lib/i18n";
import type { PlanDTO, PlanSlug } from "@/lib/subscriptions";
import { useEffect, useState } from "react";
import page from "./redesign-pages.module.css";
import dash from "./redesign-dashboard.module.css";

// Plan badges on the hub cards (Nov 2026, subscriptions): each tool
// shows the plan it needs (nothing for Discovery), and a card above
// the account's plan opens the locked-tool dialog instead of
// navigating (in trial mode the dialog still lets the user through
// with "Try it free").
//
// Mirror of HUB_TOOLS in lib/subscriptions.ts (href and minimum plan),
// kept local on purpose: that module imports Prisma through lib/db,
// so a value import would pull the database client into this browser
// bundle. Keep the two lists in sync.
const HUB_TOOL_PLANS: Array<{ href: string; requiredPlan: PlanSlug }> = [
  { href: "/tools/art-in-context", requiredPlan: "studio" },
  { href: "/tools/price-your-work", requiredPlan: "creator" },
  { href: "/tools/inventory", requiredPlan: "discovery" },
  { href: "/tools/contacts", requiredPlan: "discovery" },
  { href: "/tools/documents", requiredPlan: "creator" },
  { href: "/tools/frames-walls", requiredPlan: "creator" },
  { href: "/tools/photography-lab", requiredPlan: "creator" },
  { href: "/tools/exhibition-planner", requiredPlan: "creator" },
  { href: "/tools/open-calls", requiredPlan: "creator" },
  { href: "/tools/video-generator", requiredPlan: "studio" },
  { href: "/tools/website-builder/advanced", requiredPlan: "studio" },
  { href: "/tools/portfolio-pdf", requiredPlan: "creator" },
  { href: "/marketplace", requiredPlan: "creator" },
];

function planRank(slug: PlanSlug): number {
  return slug === "discovery" ? 0 : slug === "creator" ? 1 : 2;
}

function planDisplayName(slug: PlanSlug): string {
  return slug === "creator" ? "Creator" : slug === "studio" ? "Studio" : "Discovery";
}

// Tools hub: the working tools for artists, curators, galleries and
// collectors, and the pages that say what SANAA does for each of them.
// Written in SANAA's own words: the tool ideas follow the same needs as
// the big art platforms, the copy and the design are ours.
//
// Nov 2026 cleanup: the hub only lists tools that exist and work.
// Removed (their routes redirect to /tools): Present & Sell, Color
// Intelligence, Presentation Designer, Accessibility Studio, Education
// Studio, AI Architect, Artwork Intelligence, AI Assistant, Marketing
// Studio, Print Studio, Teams, Digital Twin (hidden for now), Image to
// 3D (removed Nov 2026).
// Merged: Collection Manager into Inventory, Visitor Analytics into the
// dashboard (/dashboard/analytics), Frame Studio + Mockup Studio into
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
  planSlug,
  paywallEnabled,
}: {
  user: { id: string; name: string; email: string };
  exhibitionCount: number;
  planSlug?: PlanSlug;
  paywallEnabled?: boolean;
}) {
  const t = useT();
  const currentPlanSlug: PlanSlug = planSlug ?? "discovery";
  const [plans, setPlans] = useState<PlanDTO[]>([]);
  const [locked, setLocked] = useState<{
    tool: (typeof TOOLS)[number];
    requiredPlan: PlanDTO;
  } | null>(null);

  // Plans for the locked-tool dialog (public endpoint). If the fetch
  // fails, locked cards fall back to plain navigation: in trial mode
  // everything is free anyway.
  useEffect(() => {
    let cancelled = false;
    void fetch("/api/subscriptions/plans")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data) setPlans((data as { plans: PlanDTO[] }).plans ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  function requiredPlanFor(href: string): PlanSlug {
    return HUB_TOOL_PLANS.find((entry) => entry.href === href)?.requiredPlan ?? "discovery";
  }

  function openTool(tool: (typeof TOOLS)[number]) {
    const requiredPlan = requiredPlanFor(tool.href);
    if (planRank(requiredPlan) <= planRank(currentPlanSlug)) {
      if ("newWindow" in tool && tool.newWindow) {
        window.open(tool.href, "_blank", "noreferrer");
      } else {
        window.location.assign(tool.href);
      }
      return;
    }
    const requiredPlanDto = plans.find((plan) => plan.slug === requiredPlan);
    if (!requiredPlanDto) {
      // Plans not loaded: do not block, navigate as in trial mode.
      if ("newWindow" in tool && tool.newWindow) {
        window.open(tool.href, "_blank", "noreferrer");
      } else {
        window.location.assign(tool.href);
      }
      return;
    }
    setLocked({ tool, requiredPlan: requiredPlanDto });
  }
  // Local search (Nov 2026): this search only filters the cards on
  // this page, tools and audiences, by their title and description.
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
      redesign
      redesignActive="resources"
    >
      <label className={page.searchField}>
        <Search size={16} aria-hidden="true" />
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder={t("tools", "searchTools")}
          aria-label={t("tools", "searchTools")}
        />
      </label>

      {visibleTools.length === 0 && visibleAudiences.length === 0 ? (
        <p className={dash.empty}>{t("tools", "noToolsMatch")}</p>
      ) : (
        <>
          <div className={page.gridCards}>
            {visibleTools.map((tool) => {
              const label = `${t("tools", "open")}, ${t("tools", tool.title)}`;
              const requiredPlan = requiredPlanFor(tool.href);
              const locked = planRank(requiredPlan) > planRank(currentPlanSlug);
              const badge =
                requiredPlan === "discovery" ? null : (
                  <span className={`${page.pill} ${page.pillAmber}`}>
                    {planDisplayName(requiredPlan)}
                  </span>
                );
              const body = (
                <>
                  <span className={page.hubIcon}>
                    <tool.icon size={22} />
                  </span>
                  {badge}
                  <h3>{t("tools", tool.title)}</h3>
                  <p>{t("tools", tool.description)}</p>
                  <span className={page.hubOpen}>
                    {t("tools", "open")} <ArrowRight size={15} />
                  </span>
                </>
              );
              return (
                <article key={tool.href} className={page.hubCard}>
                  {locked ? (
                    <button
                      type="button"
                      onClick={() => openTool(tool)}
                      aria-label={`${label}, ${t("pricing", "requiresPlan")} ${planDisplayName(requiredPlan)}`}
                      style={{
                        border: "none",
                        background: "none",
                        font: "inherit",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "flex-start",
                        gap: 8,
                        padding: 0,
                        color: "inherit",
                        width: "100%",
                        height: "100%",
                      }}
                    >
                      {body}
                    </button>
                  ) : "newWindow" in tool && tool.newWindow ? (
                    <a
                      href={tool.href}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={label}
                      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, color: "inherit", textDecoration: "none", width: "100%", height: "100%" }}
                    >
                      {body}
                    </a>
                  ) : (
                    <Link href={tool.href} aria-label={label} style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, color: "inherit", textDecoration: "none", width: "100%", height: "100%" }}>
                      {body}
                    </Link>
                  )}
                </article>
              );
            })}
          </div>

          {visibleAudiences.length > 0 && (
            <section>
              <p className={page.eyebrow} style={{ margin: "4px 0 12px" }}>
                {t("tools", "whoItIsFor")}
              </p>
              <h2 style={{ margin: "0 0 16px", fontSize: 19, fontWeight: 700 }}>{t("tools", "onePlatform")}</h2>
              <div className={page.gridCards}>
                {visibleAudiences.map((audience) => (
                  <article key={audience.href} className={page.hubCard}>
                    <Link
                      href={audience.href}
                      aria-label={`Lakisa, ${t("tools", audience.title)}`}
                      style={{ display: "flex", flexDirection: "column", alignItems: "flex-start", gap: 8, color: "inherit", textDecoration: "none", width: "100%", height: "100%" }}
                    >
                      <span className={page.hubIcon}>
                        <audience.icon size={22} />
                      </span>
                      <h3>{t("tools", audience.title)}</h3>
                      <p>{t("tools", audience.description)}</p>
                      <span className={page.hubOpen}>
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

      {locked && (
        <ToolLockedDialog
          toolLabel={t("tools", locked.tool.title)}
          toolHref={locked.tool.href}
          requiredPlan={locked.requiredPlan}
          currentPlan={plans.find((plan) => plan.slug === currentPlanSlug) ?? null}
          paywallEnabled={paywallEnabled ?? false}
          onClose={() => setLocked(null)}
        />
      )}
    </ToolsShell>
  );
}
