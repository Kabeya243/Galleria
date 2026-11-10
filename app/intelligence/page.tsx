import { redirect } from "next/navigation";
import { BarChart3, Box, Clapperboard, ShieldCheck } from "lucide-react";
import HubPage, { type HubCard } from "@/components/hub-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Intelligence: Lakisa",
  description:
    "What the numbers say, and help thinking: visitor analytics on the dashboard, 3D assets and video.",
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
          title: "adminStats",
    description: "adminStatsDesc",
          status: "ready",
        }
      : {
          icon: ShieldCheck,
          title: "adminStats",
    description: "adminStatsDesc",
          status: "owner-only",
        },
    // Visitor analytics moved to the dashboard (Nov 2026): the full
    // analytics live there under #visitor-analytics.
    {
      href: "/#visitor-analytics",
      icon: BarChart3,
      title: "insights",
    description: "insightsDesc",
      status: "ready",
    },
    {
      href: "/tools/image-to-3d",
      icon: Box,
      title: "imageTo3d",
    description: "imageTo3dDesc",
      status: "ready",
    },
    {
      href: "/tools/video-generator",
      icon: Clapperboard,
      title: "videoGenerator",
    description: "videoGeneratorDesc",
      status: "ready",
    },
  ];
  return (
    <HubPage
      user={user}
      exhibitionCount={exhibitionCount}
      active="intelligence"
      hubName="intelligence"

      description="intelligenceDesc"
      cards={cards}
    />
  );
}
