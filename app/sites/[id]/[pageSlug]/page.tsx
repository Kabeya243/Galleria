import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getPublishedSite, PublishedSite } from "@/components/advanced-site-view";

// Sub-page of a published advanced-builder site: /sites/[slug]/[pageSlug].
// Only advanced sites have sub-pages (the old simple builder published a
// single page at /sites/[id]), so anything else 404s here.

type RouteProps = { params: Promise<{ id: string; pageSlug: string }> };

export async function generateMetadata({ params }: RouteProps): Promise<Metadata> {
  const { id, pageSlug } = await params;
  const site = await getPublishedSite(id);
  const page = site?.pages.find((item) => item.slug === pageSlug);
  if (!site || !page) return { title: "Page introuvable: Lakisa" };
  return { title: page.seoTitle || `${page.title}: ${site.title}`, description: page.seoDescription || undefined };
}

export default async function PublicSiteSubpage({ params }: RouteProps) {
  const { id, pageSlug } = await params;
  const site = await getPublishedSite(id);
  if (!site?.pages.some((page) => page.slug === pageSlug)) notFound();
  return <PublishedSite slug={id} pageSlug={pageSlug} />;
}
