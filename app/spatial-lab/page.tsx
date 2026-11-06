import { redirect } from "next/navigation";
import { Boxes, GalleryVerticalEnd } from "lucide-react";
import HubPage, { type HubCard } from "@/components/hub-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Spatial Lab — SANAA",
  description:
    "The 3D side of the studio: gallery room templates and the editor where exhibitions take shape.",
};

const CARDS: HubCard[] = [
  {
    href: "/galleries",
    icon: GalleryVerticalEnd,
    title: "Gallery templates",
    description: "Forty rooms to start from — pick one, open it in the editor, make it yours.",
    status: "ready",
  },
  {
    href: "/exhibitions",
    icon: Boxes,
    title: "3D editor",
    description: "Place artworks on the walls, shape the rooms, set the light — from your exhibitions list.",
    status: "ready",
  },
];

export default async function SpatialLabHub() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  return (
    <HubPage
      user={user}
      exhibitionCount={exhibitionCount}
      active="spatial-lab"
      hubName="Spatial Lab"
      title="Spatial Lab"
      eyebrow="SPATIAL LAB"
      description="The 3D side of the studio: gallery room templates and the editor where exhibitions take shape."
      cards={CARDS}
    />
  );
}
