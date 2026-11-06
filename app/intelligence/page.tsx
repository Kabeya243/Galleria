import { redirect } from "next/navigation";
import { BarChart3, Bot, Box, Clapperboard, ScanEye, ShieldCheck, Sparkles } from "lucide-react";
import HubPage, { type HubCard } from "@/components/hub-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Intelligence — SANAA",
  description:
    "What the numbers say, and help thinking: visitor analytics, AI-assisted exhibition planning, artwork analysis, 3D assets and video.",
};

export default async function IntelligenceHub() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  const cards: HubCard[] = [
    // Admin analytics exists and works, but only for the platform owner —
    // everyone else sees it as a plain card, not a link.
    user.isAdmin
      ? {
          href: "/admin",
          icon: ShieldCheck,
          title: "Admin analytics",
          description: "Users, exhibitions, artworks, visits and tool use across the platform.",
          status: "ready",
        }
      : {
          icon: ShieldCheck,
          title: "Admin analytics",
          description: "Users, exhibitions, artworks, visits and tool use across the platform.",
          status: "owner-only",
        },
    {
      href: "/tools/visitor-analytics",
      icon: BarChart3,
      title: "Your exhibition insights",
      description: "Visits, popular rooms and artworks for your own exhibitions, in one place.",
      status: "ready",
    },
    {
      href: "/tools/ai-architect",
      icon: Sparkles,
      title: "AI Exhibition Architect",
      description: "Concepts, arrangements, templates, lighting and visitor journeys — suggestions from your own works, editable throughout.",
      status: "ready",
    },
    {
      href: "/tools/artwork-intelligence",
      icon: ScanEye,
      title: "Artwork Intelligence",
      description: "Draft metadata, tags, colours and descriptions for your artworks — always a draft you check before use.",
      status: "ready",
    },
    {
      href: "/tools/ai-assistant",
      icon: Bot,
      title: "AI Creative Assistant",
      description: "Ask about your own projects — what fits, what is missing, what to frame next — answered from your real data.",
      status: "ready",
    },
    {
      href: "/tools/image-to-3d",
      icon: Box,
      title: "Image-to-3D & Asset Library",
      description: "Import GLB models, preview them in 3D, and keep a library of licensed assets and references.",
      status: "ready",
    },
    {
      href: "/tools/video-generator",
      icon: Clapperboard,
      title: "Exhibition Video Generator",
      description: "Turn an exhibition into a walkthrough video — shots, titles and formats, recorded from your real 3D room.",
      status: "ready",
    },
  ];
  return (
    <HubPage
      user={user}
      exhibitionCount={exhibitionCount}
      active="intelligence"
      hubName="Intelligence"
      title="Intelligence"
      eyebrow="INTELLIGENCE"
      description="What the numbers say, and help thinking: visitor analytics, AI-assisted exhibition planning, artwork analysis, 3D assets and video."
      cards={cards}
    />
  );
}
