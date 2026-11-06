import { redirect } from "next/navigation";
import { Aperture, Boxes, Calculator, Frame, GalleryVerticalEnd, Image, Palette, Presentation, Route, Wrench } from "lucide-react";
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
    href: "/tools/art-in-context",
    icon: Route,
    title: "Art in Context",
    description: "One guided path from upload to promotion — photography, colour, frames, mockups, the 3D gallery, publication and export, all on the same artworks.",
    status: "ready",
  },
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
  {
    href: "/tools/frame-studio",
    icon: Frame,
    title: "Frame Studio",
    description: "Frames for your artworks — 28 digitised styles, custom controls and presets, and side-by-side comparison.",
    status: "ready",
  },
  {
    href: "/tools/mockup-studio",
    icon: Image,
    title: "Mockup Studio",
    description: "See your work on a real wall before you hang it — interiors, frames, lighting and print-ready exports.",
    status: "ready",
  },
  {
    href: "/tools/photography-lab",
    icon: Aperture,
    title: "Photography Lab",
    description: "Clean up artwork photos — crop, straighten, correct light and colour, and export print-ready files.",
    status: "ready",
  },
  {
    href: "/tools/color-intelligence",
    icon: Palette,
    title: "Color Intelligence",
    description: "Read the colours in a work — palettes, harmonies and contrast — and find the right wall for it.",
    status: "ready",
  },
  {
    href: "/tools/presentation-designer",
    icon: Presentation,
    title: "Presentation Designer",
    description: "Build a presentation for a buyer, a gallery or a jury — slides from your own artworks, ready to share.",
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
