import { redirect } from "next/navigation";
import { BarChart3, ShieldCheck } from "lucide-react";
import HubPage, { type HubCard } from "@/components/hub-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Intelligence — SANAA",
  description:
    "What the numbers say: platform analytics for the owner, and — in a later phase — insights on your own exhibitions.",
};

export default async function IntelligenceHub() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  const cards: HubCard[] = [
    // Admin analytics exists and works, but only for the platform owner —
    // everyone else sees it as a plain card, not a link.
    user.isAdmin
      ? {
          href: "/admin",
          icon: ShieldCheck,
          title: "Admin analytics",
          description: "Users, exhibitions, artworks, visits and tool use across the platform.",
          status: "ready",
        }
      : {
          icon: ShieldCheck,
          title: "Admin analytics",
          description: "Users, exhibitions, artworks, visits and tool use across the platform.",
          status: "owner-only",
        },
    {
      icon: BarChart3,
      title: "Your exhibition insights",
      description: "Visits, popular rooms and artworks for your own exhibitions, in one place.",
      status: "development",
    },
  ];
  return (
    <HubPage
      user={user}
      exhibitionCount={exhibitionCount}
      active="intelligence"
      hubName="Intelligence"
      title="Intelligence"
      eyebrow="INTELLIGENCE"
      description="What the numbers say: platform analytics for the owner, and — in a later phase — insights on your own exhibitions."
      cards={cards}
    />
  );
}
