import { redirect } from "next/navigation";
import { Aperture, Boxes, Calculator, Frame, GalleryVerticalEnd, Route, Wrench } from "lucide-react";
import HubPage, { type HubCard } from "@/components/hub-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Create: Lakisa",
  description:
    "Everything for making an exhibition: your exhibitions, the 3D editor, and the tools that go with them.",
};

const CARDS: HubCard[] = [
  {
    href: "/tools/art-in-context",
    icon: Route,
    title: "artInContext",
    description: "artInContextDesc",
    status: "ready",
  },
  {
    href: "/exhibitions",
    icon: GalleryVerticalEnd,
    title: "myExhibitions",
    description: "myExhibitionsDesc",
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
    href: "/tools",
    icon: Wrench,
    title: "toolsShort",
    description: "toolsShortDesc",
    status: "ready",
  },
  {
    href: "/tools/price-your-work",
    icon: Calculator,
    title: "priceYourWork",
    description: "priceYourWorkDesc",
    status: "ready",
  },
  // Frames & Art on Walls is the merged Frame Studio + Mockup Studio
  // (Nov 2026): one tool, realistic frames on 10 real wall photos.
  {
    href: "/tools/frames-walls",
    icon: Frame,
    title: "framesWalls",
    description: "framesWallsDesc",
    status: "ready",
  },
  {
    href: "/tools/photography-lab",
    icon: Aperture,
    title: "photographyLab",
    description: "photographyLabDesc",
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
      hubName="create"

      description="createDesc"
      cards={CARDS}
    />
  );
}
