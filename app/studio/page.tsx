import { redirect } from "next/navigation";
import { Bell, CircleHelp, Grid2X2, Settings2 } from "lucide-react";
import HubPage, { type HubCard } from "@/components/hub-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "My Studio — SANAA",
  description: "Your space on SANAA: the dashboard, your exhibitions, and your settings.",
};

const CARDS: HubCard[] = [
  {
    href: "/",
    icon: Grid2X2,
    title: "Dashboard",
    description: "Your exhibitions, artworks and views at a glance — your creative space.",
    status: "ready",
  },
  {
    href: "/settings",
    icon: Settings2,
    title: "Settings",
    description: "Your profile, your theme, your password, your account.",
    status: "ready",
  },
  {
    icon: Bell,
    title: "Notifications",
    description: "New visits, new followers and exhibition activity, as they happen.",
    status: "development",
  },
  {
    icon: CircleHelp,
    title: "Help centre",
    description: "Guides and answers for building, publishing and selling on SANAA.",
    status: "development",
  },
];

export default async function StudioHub() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  return (
    <HubPage
      user={user}
      exhibitionCount={exhibitionCount}
      active="studio"
      hubName="My Studio"
      title="My Studio"
      eyebrow="MY STUDIO"
      description="Your space on SANAA: the dashboard, your exhibitions, and your settings."
      cards={CARDS}
    />
  );
}
