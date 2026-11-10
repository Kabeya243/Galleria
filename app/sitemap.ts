import type { MetadataRoute } from "next";
import { db } from "@/lib/db";
import { SITE_URL } from "@/components/seo-jsonld";

// Dynamic sitemap (November 2026): static public pages plus every
// listed public exhibition (status "public", visibility "public").
// Private-link and password-protected shows are never listed here, and
// drafts neither. There is no per-artwork public route (an artwork is
// only seen inside its exhibition, and /works/[id] is a creator wall),
// so artworks are covered through their exhibition URL.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${SITE_URL}/explore`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/feed`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${SITE_URL}/galleries`, lastModified: now, changeFrequency: "weekly", priority: 0.8 },
    { url: `${SITE_URL}/discover`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/marketplace`, lastModified: now, changeFrequency: "weekly", priority: 0.7 },
    { url: `${SITE_URL}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/guide`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  // A database failure must not take the whole sitemap down: the
  // static pages still answer, the exhibitions just drop out until
  // the next request.
  try {
    const exhibitions = await db.exhibition.findMany({
      where: { status: "public", visibility: "public" },
      select: { slug: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5000,
    });
    const exhibitionPages: MetadataRoute.Sitemap = exhibitions.map((exhibition) => ({
      url: `${SITE_URL}/exhibition/${exhibition.slug}`,
      lastModified: exhibition.updatedAt,
      changeFrequency: "weekly",
      priority: 0.8,
    }));
    return [...staticPages, ...exhibitionPages];
  } catch {
    return staticPages;
  }
}
