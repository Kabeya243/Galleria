import { redirect } from "next/navigation";
import { Boxes, GalleryVerticalEnd, Scan } from "lucide-react";
import HubPage, { type HubCard } from "@/components/hub-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Spatial Lab — SANAA",
  description:
    "The 3D side of the studio: gallery room templates, the editor where exhibitions take shape, and digital twins with VR and AR.",
};

const CARDS: HubCard[] = [
  {
    href: "/galleries",
    icon: GalleryVerticalEnd,
    title: "galleryTemplates",
    description: "galleryTemplatesDesc",
    status: "ready",
  },
  {
    href: "/exhibitions",
    icon: Boxes,
    title: "editor3d",
    description: "editor3dDesc",
    status: "ready",
  },
  {
    href: "/tools/digital-twin",
    icon: Scan,
    title: "digitalTwin",
    description: "digitalTwinDesc",
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
      hubName="spatialLab"

      description="spatialLabDesc"
      cards={CARDS}
    />
  );
}
