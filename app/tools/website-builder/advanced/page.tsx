import { redirect } from "next/navigation";
import ToolsShell from "@/components/tools-shell";
import AdvancedSiteEditor from "@/components/advanced-site-editor";
import { getCurrentUser } from "@/lib/auth";
import { logToolUse } from "@/lib/tool-use";
import { db } from "@/lib/db";
import { getSiteTemplates, listAdvancedSites } from "@/lib/advanced-sites";
import { templates as bundledTemplates } from "@/lib/advanced-site-templates";
import type { SiteDocument, TemplateSummary } from "@/lib/advanced-site-types";

export const metadata = {
  title: "Advanced Website Builder: Lakisa Tools",
  description:
    "Visual drag-and-drop website editor: 11 original templates, multi-page sites, 18 block types, theme and SEO controls, responsive preview, publish to /sites/[slug]. Drafts are saved in PostgreSQL; media goes to R2.",
};

// Advanced editor (Claude « atelier-sites »). Since 8 Nov 2026 this is
// the ONLY website builder: the simple builder was removed and
// /tools/website-builder redirects here.
export default async function AdvancedWebsiteBuilderRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  await logToolUse("website-builder-advanced", user.id);
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });

  // Templates come from the Template table (seeded on first call);
  // sites are the user's own Site rows. If the database is unreachable
  // the editor still renders with the bundled template definitions and
  // an empty site list — saves will then surface the API error inline.
  let templates: TemplateSummary[] = bundledTemplates;
  let sites: SiteDocument[] = [];
  try {
    [templates, sites] = await Promise.all([getSiteTemplates(), listAdvancedSites(user.id)]);
  } catch (error) {
    console.error("Advanced website builder: database unavailable, using bundled templates.", error);
  }

  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="websiteBuilder"
      eyebrowOverride="TOOLS · ADVANCED EDITOR: ÉDITEUR AVANCÉ"
      description="websiteBuilderDesc"
    >
      <p style={{ margin: "0 0 12px", fontSize: 13, opacity: 0.75 }}>
        Éditeur visuel : 11 modèles, plusieurs pages, 18 blocs, thème et SEO, aperçu
        ordinateur / tablette / mobile. Les brouillons sont enregistrés dans votre compte.
      </p>
      <AdvancedSiteEditor initialSites={sites} templates={templates} />
    </ToolsShell>
  );
}
