import { redirect } from "next/navigation";
import { Compass, Globe, Store } from "lucide-react";
import HubPage, { type HubCard } from "@/components/hub-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Publish: Lakisa",
  description:
    "Put your work in front of people: published exhibitions, portfolio sites and the marketplace.",
};

const CARDS: HubCard[] = [
  {
    href: "/explore",
    icon: Compass,
    title: "publishedExhibitions",
    description: "publishedExhibitionsDesc",
    status: "ready",
  },
  {
    href: "/tools/website-builder/advanced",
    icon: Globe,
    title: "websiteBuilder",
    description: "websiteBuilderDesc",
    status: "ready",
  },
  {
    href: "/marketplace",
    icon: Store,
    title: "marketplace",
    description: "marketplaceDesc",
    status: "ready",
  },
];

export default async function PublishHub() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  return (
    <HubPage
      user={user}
      exhibitionCount={exhibitionCount}
      active="publish"
      hubName="publish"

      description="publishDesc"
      cards={CARDS}
    />
  );
}
