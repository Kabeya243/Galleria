import { redirect } from "next/navigation";
import { Accessibility, Archive, ClipboardList, FileText, GraduationCap, Library, ShieldCheck, Users } from "lucide-react";import HubPage, { type HubCard } from "@/components/hub-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Manage — SANAA",
  description:
    "The running of your practice: inventory, collections, exhibition planning, accessibility, education, contacts, certificates, and — for the owner — platform stats.",
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
      href: "/tools/collection-manager",
      icon: Library,
      title: "Collection Manager",
      description: "Your whole collection in one place — provenance, inventory numbers, condition and availability, with search and bulk actions.",
      status: "ready",
    },
    {
      href: "/tools/exhibition-planner",
      icon: ClipboardList,
      title: "Exhibition Planner",
      description: "Plan an exhibition end to end — concept, works, rooms, wall labels, checklist, team and a printable plan.",
      status: "ready",
    },
    {
      href: "/tools/accessibility-studio",
      icon: Accessibility,
      title: "Accessibility & Audio Guide Studio",
      description: "Audio descriptions, narration and transcripts in English and French, so everyone can experience your work.",
      status: "ready",
    },
    {
      href: "/tools/education-studio",
      icon: GraduationCap,
      title: "Art Education Studio",
      description: "Learning guides, questions and quizzes for your exhibitions — built for schools, families and curious visitors.",
      status: "ready",
    },
    {
      href: "/tools/teams",
      icon: Users,
      title: "Teams & Collaboration",
      description: "Work on exhibitions together — shared projects, comments, reviews and an activity log.",
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
      description="The running of your practice: inventory, collections, exhibition planning, accessibility, education, contacts, certificates, and — for the owner — platform stats."
      cards={cards}
    />
  );
}
