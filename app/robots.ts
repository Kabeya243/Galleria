import type { MetadataRoute } from "next";
import { SITE_URL } from "@/components/seo-jsonld";

// robots.txt (November 2026): public pages are crawlable; the
// logged-in areas, the auth pages and the API stay out of the index.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/api", "/login", "/register", "/messages", "/settings"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
