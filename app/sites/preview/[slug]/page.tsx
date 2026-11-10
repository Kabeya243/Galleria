import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getSiteForOwnerPreview, PublishedSiteView } from "@/components/advanced-site-view";
import { getCurrentUser } from "@/lib/auth";

// Owner-only preview of an unpublished (draft) site, opened in a new
// tab by the website builder's "Aperçu" button. A draft has no public
// URL yet (/sites/[slug] only serves published sites), so the preview
// renders the same public view here, but only for the signed-in owner:
// anyone else, signed in or not, gets a 404, and the banner above the
// page says it is a draft preview.
type RouteProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) return { title: "Aperçu du site : Lakisa" };
  const site = await getSiteForOwnerPreview(slug, user.id);
  if (!site) return { title: "Site not found: Lakisa" };
  return {
    title: `${site.title} (aperçu) : Lakisa`,
    description: `Aperçu du brouillon ${site.title}.`,
  };
}

export default async function SitePreviewPage({ params }: RouteProps) {
  const { slug } = await params;
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const site = await getSiteForOwnerPreview(slug, user.id);
  if (!site) notFound();
  return (
    <>
      <div
        style={{
          background: "#171717",
          color: "#fff",
          fontSize: 12,
          padding: "8px 16px",
          textAlign: "center",
        }}
      >
        Aperçu du brouillon « {site.title} » : seul vous pouvez voir cette page. Publiez le site pour le partager.
      </div>
      <PublishedSiteView site={site} />
    </>
  );
}
