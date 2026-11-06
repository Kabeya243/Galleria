import { redirect } from "next/navigation";
import { Boxes, Calculator, GalleryVerticalEnd, Wrench } from "lucide-react";
import HubPage, { type HubCard } from "@/components/hub-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Create — SANAA",
  description:
    "Everything for making an exhibition: your exhibitions, the 3D editor, and the tools that go with them.",
};

const CARDS: HubCard[] = [
  {
    href: "/exhibitions",
    icon: GalleryVerticalEnd,
    title: "My exhibitions",
    description: "All your exhibitions in one list — open one to keep building it, or start a new one.",
    status: "ready",
  },
  {
    href: "/exhibitions",
    icon: Boxes,
    title: "3D editor",
    description: "Place artworks on the walls, shape the rooms, set the light — from your exhibitions list.",
    status: "ready",
  },
  {
    href: "/tools",
    icon: Wrench,
    title: "Tools",
    description: "Price a work, keep your inventory, know your contacts, present and sell.",
    status: "ready",
  },
  {
    href: "/tools/price-your-work",
    icon: Calculator,
    title: "Price your work",
    description: "Work out a fair price for a piece, from your hours, your materials and its size.",
    status: "ready",
  },
];

export default async function CreateHub() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  return (
    <HubPage
      user={user}
      exhibitionCount={exhibitionCount}
      active="create"
      hubName="Create"
      title="Create"
      eyebrow="CREATE"
      description="Everything for making an exhibition: your exhibitions, the 3D editor, and the tools that go with them."
      cards={CARDS}
    />
  );
}
