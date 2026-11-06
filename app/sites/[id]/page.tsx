import type { Metadata } from "next";
import { notFound } from "next/navigation";
import SitePreview, { siteConfigFromSaved, type SiteExhibition } from "@/components/site-preview";
import { db } from "@/lib/db";

// Public artist site, published from the Website Builder. A SavedWork row
// of kind "website" holds the site config; this route renders it read-only
// for anyone with the link. Deleting the SavedWork row unpublishes the page
// (it 404s). No sign-in, no editing, no admin here.

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
  const site = await findSite(id);
  if (!site) return { title: "Site not found — SANAA" };
  return {
    title: site.config.siteTitle || site.title,
    description: site.config.siteDescription || undefined,
  };
}

export default async function PublicSitePage({ params }: RouteProps) {
  const { id } = await params;
  const site = await findSite(id);
  if (!site) notFound();
  return (
    <main style={{ background: "#ece9e3", minHeight: "100vh", padding: "24px 12px" }}>
      <SitePreview config={site.config} exhibitions={site.exhibitions} />
    </main>
  );
}
