import { redirect } from "next/navigation";
import { Compass, Presentation } from "lucide-react";
import HubPage, { type HubCard } from "@/components/hub-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Publish — SANAA",
  description:
    "Put your work in front of people: present your published rooms as viewing rooms, and see them live.",
};

const CARDS: HubCard[] = [
  {
    href: "/tools/present-sell",
    icon: Presentation,
    title: "Present & Sell",
    description: "Your published rooms as viewing rooms — share them, track visits, follow up.",
    status: "ready",
  },
  {
    href: "/explore",
    icon: Compass,
    title: "Published exhibitions",
    description: "See published exhibitions live, the way visitors see them — including your own.",
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
      hubName="Publish"
      title="Publish"
      eyebrow="PUBLISH"
      description="Put your work in front of people: present your published rooms as viewing rooms, and see them live."
      cards={CARDS}
    />
  );
}
