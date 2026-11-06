import { redirect } from "next/navigation";
import { Archive, FileText, ShieldCheck, Users } from "lucide-react";
import HubPage, { type HubCard } from "@/components/hub-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Manage — SANAA",
  description:
    "The running of your practice: inventory, contacts, certificates, and — for the owner — platform stats.",
};

export default async function ManageHub() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  const cards: HubCard[] = [
    {
      href: "/tools/inventory",
      icon: Archive,
      title: "Inventory & Collections",
      description: "Your artworks in one list — what you made, where it is, and what it is worth.",
      status: "ready",
    },
    {
      href: "/tools/contacts",
      icon: Users,
      title: "Contacts",
      description: "Collectors, curators, galleries and advisors — who they are and how to reach them.",
      status: "ready",
    },
    {
      href: "/tools/documents",
      icon: FileText,
      title: "Certificates",
      description: "Certificates of authenticity, labels and artwork sheets, ready to print.",
      status: "ready",
    },
    // Admin stats exists and works, but only for the platform owner —
    // everyone else sees it as a plain card, not a link.
    user.isAdmin
      ? {
          href: "/admin",
          icon: ShieldCheck,
          title: "Admin stats",
          description: "Users, exhibitions, artworks, visits and tool use across the platform.",
          status: "ready",
        }
      : {
          icon: ShieldCheck,
          title: "Admin stats",
          description: "Users, exhibitions, artworks, visits and tool use across the platform.",
          status: "owner-only",
        },
  ];
  return (
    <HubPage
      user={user}
      exhibitionCount={exhibitionCount}
      active="manage"
      hubName="Manage"
      title="Manage"
      eyebrow="MANAGE"
      description="The running of your practice: inventory, contacts, certificates, and — for the owner — platform stats."
      cards={cards}
    />
  );
}
