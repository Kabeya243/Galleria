import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SitePreview, { siteConfigFromSaved, type SiteExhibition } from "@/components/site-preview";
import { getPublishedSite, PublishedSite } from "@/components/advanced-site-view";
import { db } from "@/lib/db";

// Public artist site. Advanced-builder sites are served by slug;
// LEGACY fallback (read-only): sites published with the old simple
// builder live as a SavedWork row of kind "website" and are rendered
// here by components/site-preview.tsx. The simple editor was removed
// on 8 Nov 2026, so no new legacy sites can be created — but existing
// ones keep working: deleting the SavedWork row unpublishes the page
// (it 404s). No sign-in, no editing, no admin here.
//
// Route conflict, resolved slug-first (8 Nov 2026): the same /sites/[id]
// path also serves advanced-builder sites, whose public URL is
// /sites/[slug]. An advanced site is looked up by slug FIRST (published
// only); only if no published advanced site matches does the SavedWork
// lookup by id run — so every site published by the old builder keeps
// working unchanged, and a slug can never shadow a SavedWork id unless a
// published advanced site actually owns that slug. Advanced sub-pages
// live at /sites/[id]/[pageSlug].

type RouteProps = { params: Promise<{ id: string }> };

async function findSite(id: string) {
  const row = await db.savedWork.findFirst({ where: { id, kind: "website" } });
  if (!row) return null;
  let data: Record<string, unknown> = {};
  try {
    data = JSON.parse(row.data) as Record<string, unknown>;
  } catch {
    data = {};
  }
  const owner = await db.user.findUnique({ where: { id: row.userId }, select: { name: true, email: true } });
  if (!owner) return null;
  const exhibitions = await db.exhibition.findMany({
    where: { ownerId: row.userId },
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      artworks: {
        select: {
          id: true,
          title: true,
          artist: true,
          year: true,
          medium: true,
          dimensions: true,
          description: true,
          color: true,
          accent: true,
          imageUrl: true,
        },
        orderBy: { createdAt: "asc" },
      },
    },
    orderBy: { createdAt: "desc" },
  });
  const siteExhibitions: SiteExhibition[] = exhibitions.map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    status: e.status,
    artworks: e.artworks.map((a) => ({ ...a, exhibitionTitle: e.title })),
  }));
  const config = siteConfigFromSaved(data, owner.name, owner.email, siteExhibitions);
  return { config, exhibitions: siteExhibitions, title: row.title };
}

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { id } = await params;
  const advanced = await getPublishedSite(id);
  if (advanced) {
    const home = advanced.pages[0];
    return {
      title: home?.seoTitle || advanced.title,
      description: home?.seoDescription || `Découvrez le travail de ${advanced.title}.`,
    };
  }
  const site = await findSite(id);
  if (!site) return { title: "Site not found: Lakisa" };
  return {
    title: site.config.siteTitle || site.title,
    description: site.config.siteDescription || undefined,
  };
}

export default async function PublicSitePage({ params }: RouteProps) {
  const { id } = await params;
  const advanced = await getPublishedSite(id);
  if (advanced) return <PublishedSite slug={id} />;
  const site = await findSite(id);
  if (!site) notFound();
  return (
    <main className="legacy-site-page" style={{ background: "#ece9e3", minHeight: "100vh", padding: "24px 12px" }}>
      <SitePreview config={site.config} exhibitions={site.exhibitions} />
    </main>
  );
}
