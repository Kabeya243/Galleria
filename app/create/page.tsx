import { redirect } from "next/navigation";
import { Aperture, Boxes, Calculator, Frame, GalleryVerticalEnd, Image, Palette, Presentation, Route, Wrench } from "lucide-react";
import HubPage, { type HubCard } from "@/components/hub-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Create — Lakisa",
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
  {
    href: "/tools/frame-studio",
    icon: Frame,
    title: "frameStudio",
    description: "frameStudioDesc",
    status: "ready",
  },
  {
    href: "/tools/mockup-studio",
    icon: Image,
    title: "mockupStudio",
    description: "mockupStudioDesc",
    status: "ready",
  },
  {
    href: "/tools/photography-lab",
    icon: Aperture,
    title: "photographyLab",
    description: "photographyLabDesc",
    status: "ready",
  },
  {
    href: "/tools/color-intelligence",
    icon: Palette,
    title: "colorIntelligence",
    description: "colorIntelligenceDesc",
    status: "ready",
  },
  {
    href: "/tools/presentation-designer",
    icon: Presentation,
    title: "presentationDesigner",
    description: "presentationDesignerDesc",
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
