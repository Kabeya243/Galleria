import { redirect } from "next/navigation";
import { Bell, CircleHelp, Grid2X2, Settings2 } from "lucide-react";
import HubPage, { type HubCard } from "@/components/hub-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "studioHome",
    description: "studioHomeDesc",
};

const CARDS: HubCard[] = [
  {
    href: "/",
    icon: Grid2X2,
    title: "dashboardCard",
    description: "dashboardCardDesc",
    status: "ready",
  },
  {
    href: "/settings",
    icon: Settings2,
    title: "settingsCard",
    description: "settingsCardDesc",
    status: "ready",
  },
  {
    icon: Bell,
    title: "notifications",
    description: "notificationsDesc",
    status: "development",
  },
  {
    icon: CircleHelp,
    title: "helpCentre",
    description: "helpCentreDesc",
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
      hubName="studio"

      description="studioDesc"
      cards={CARDS}
    />
  );
}
