import { redirect } from "next/navigation";
import { Compass, Globe, Megaphone, Presentation, Printer, Store } from "lucide-react";
import HubPage, { type HubCard } from "@/components/hub-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Publish — SANAA",
  description:
    "Put your work in front of people: viewing rooms, portfolio sites, marketing, print and the marketplace.",
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
  {
    href: "/tools/website-builder",
    icon: Globe,
    title: "Artist Website Builder",
    description: "A portfolio site from your own works — themes, bio, CV, exhibitions, live preview and a public page.",
    status: "ready",
  },
  {
    href: "/tools/marketing-studio",
    icon: Megaphone,
    title: "Marketing Studio",
    description: "Posters, social graphics, invitations and press kits from your exhibitions, ready to export.",
    status: "ready",
  },
  {
    href: "/tools/print-studio",
    icon: Printer,
    title: "Print Production Studio",
    description: "Production-ready print: dimensions, bleed, margins and honest resolution checks, with PDFs.",
    status: "ready",
  },
  {
    href: "/marketplace",
    icon: Store,
    title: "Marketplace",
    description: "List originals, editions and prints for sale — browse listings and answer buyer inquiries.",
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
      description="Put your work in front of people: viewing rooms, portfolio sites, marketing, print and the marketplace."
      cards={CARDS}
    />
  );
}
