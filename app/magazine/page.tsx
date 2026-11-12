import type { Metadata } from "next";
import MagazineListPage from "@/components/magazine-list-page";
import { getPublishedArticles } from "@/lib/magazine";

// Public magazine list: published articles, newest first. No sign-in.
// Rendered on demand so a newly published article appears at once.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Magazine · Lakisa",
  description:
    "Essays, interviews and news from Lakisa and the artists showing here.",
};

export default async function MagazineListRoute() {
  const articles = await getPublishedArticles();
  return <MagazineListPage articles={articles} />;
}
