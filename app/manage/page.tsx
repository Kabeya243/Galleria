import { redirect } from "next/navigation";
import { Archive, ClipboardList, FileText, ShieldCheck, Users } from "lucide-react";import HubPage, { type HubCard } from "@/components/hub-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Manage: Lakisa",
  description:
    "The running of your practice: inventory, exhibition planning, contacts, certificates, and (for the owner) platform stats.",
};

export default async function ManageHub() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  const cards: HubCard[] = [
    {
      href: "/tools/inventory",
      icon: Archive,
      title: "inventory",
    description: "inventoryDesc",
      status: "ready",
    },
    {
      href: "/tools/exhibition-planner",
      icon: ClipboardList,
      title: "exhibitionPlanner",
    description: "exhibitionPlannerDesc",
      status: "ready",
    },
    {
      href: "/tools/contacts",
      icon: Users,
      title: "contacts",
    description: "contactsDesc",
      status: "ready",
    },
    {
      href: "/tools/documents",
      icon: FileText,
      title: "certificates",
    description: "certificatesDesc",
      status: "ready",
    },
    // Admin stats exists and works, but only for the platform owner —
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
  ];
  return (
    <HubPage
      user={user}
      exhibitionCount={exhibitionCount}
      active="manage"
      hubName="manage"

      description="manageDesc"
      cards={cards}
    />
  );
}
