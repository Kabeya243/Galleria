"use client";

import Link from "next/link";
import {
  Accessibility,
  Aperture,
  Archive,
  ArrowRight,
  BarChart3,
  Bot,
  Box,
  Calculator,
  Clapperboard,
  ClipboardList,
  FileText,
  Frame,
  Gem,
  Globe,
  GraduationCap,
  Image,
  LayoutGrid,
  Library,
  Megaphone,
  Palette,
  Presentation,
  Printer,
  Route,
  Scan,
  ScanEye,
  Sparkles,
  Store,
  Users,
} from "lucide-react";
import ToolsShell from "@/components/tools-shell";
import styles from "./tools.module.css";

// Tools hub: the working tools for artists, curators, galleries and
// collectors, and the pages that say what SANAA does for each of them.
// Written in SANAA's own words — the tool ideas follow the same needs as
// the big art platforms, the copy and the design are ours.
const TOOLS = [
  {
    href: "/tools/art-in-context",
    icon: Route,
    title: "Art in Context",
    description: "One guided path from upload to promotion — photography, colour, frames, mockups, the 3D gallery, publication and export, all on the same artworks.",
  },
  {
    href: "/tools/price-your-work",
    icon: Calculator,
    title: "Price your work",
    description: "Work out a fair price for a piece, from your hours, your materials and its size.",
  },
  {
    href: "/tools/inventory",
    icon: Archive,
    title: "Inventory & Collections",
    description: "Your artworks in one list — what you made, where it is, and what it is worth.",
  },
  {
    href: "/tools/contacts",
    icon: Users,
    title: "Contacts",
    description: "Collectors, curators, galleries and advisors — who they are and how to reach them.",
  },
  {
    href: "/tools/present-sell",
    icon: Presentation,
    title: "Present & Sell",
    description: "Your published rooms as viewing rooms — share them, track visits, follow up.",
  },
  {
    href: "/tools/documents",
    icon: FileText,
    title: "Documents",
    description: "Certificates of authenticity, labels and artwork sheets, ready to print.",
  },
  {
    href: "/tools/frame-studio",
    icon: Frame,
    title: "Frame Studio",
    description: "Frame your artworks — 28 digitised styles, custom width, depth, material and glass, and side-by-side comparison.",
  },
  {
    href: "/tools/mockup-studio",
    icon: Image,
    title: "Mockup Studio",
    description: "See your work on a real wall before you hang it — interiors, frames, lighting and print-ready exports.",
  },
  {
    href: "/tools/photography-lab",
    icon: Aperture,
    title: "Photography Lab",
    description: "Clean up artwork photos — crop, straighten, correct light and colour, and export print-ready files.",
  },
  {
    href: "/tools/color-intelligence",
    icon: Palette,
    title: "Color Intelligence",
    description: "Read the colours in a work — palettes, harmonies and contrast — and find the right wall for it.",
  },
  {
    href: "/tools/presentation-designer",
    icon: Presentation,
    title: "Presentation Designer",
    description: "Build a presentation for a buyer, a gallery or a jury — slides from your own artworks, ready to share.",
  },
  {
    href: "/tools/collection-manager",
    icon: Library,
    title: "Collection Manager",
    description: "Your whole collection in one place — provenance, inventory numbers, condition and availability, with search and bulk actions.",
  },
  {
    href: "/tools/exhibition-planner",
    icon: ClipboardList,
    title: "Exhibition Planner",
    description: "Plan an exhibition end to end — concept, works, rooms, wall labels, checklist, team and a printable plan.",
  },
  {
    href: "/tools/visitor-analytics",
    icon: BarChart3,
    title: "Visitor Analytics",
    description: "See who visits your exhibitions, day by day — most viewed works, devices, sources, all anonymous.",
  },
  {
    href: "/tools/accessibility-studio",
    icon: Accessibility,
    title: "Accessibility & Audio Guide Studio",
    description: "Audio descriptions, narration and transcripts in English and French, so everyone can experience your work.",
  },
  {
    href: "/tools/education-studio",
    icon: GraduationCap,
    title: "Art Education Studio",
    description: "Learning guides, questions and quizzes for your exhibitions — built for schools, families and curious visitors.",
  },
  {
    href: "/tools/ai-architect",
    icon: Sparkles,
    title: "AI Exhibition Architect",
    description: "Concepts, arrangements, templates, lighting and visitor journeys — suggestions from your own works, editable throughout.",
  },
  {
    href: "/tools/artwork-intelligence",
    icon: ScanEye,
    title: "Artwork Intelligence",
    description: "Draft metadata, tags, colours and descriptions for your artworks — always a draft you check before use.",
  },
  {
    href: "/tools/ai-assistant",
    icon: Bot,
    title: "AI Creative Assistant",
    description: "Ask about your own projects — what fits, what is missing, what to frame next — answered from your real data.",
  },
  {
    href: "/tools/image-to-3d",
    icon: Box,
    title: "Image-to-3D & Asset Library",
    description: "Import GLB models, preview them in 3D, and keep a library of licensed assets and references.",
  },
  {
    href: "/tools/video-generator",
    icon: Clapperboard,
    title: "Exhibition Video Generator",
    description: "Turn an exhibition into a walkthrough video — shots, titles and formats, recorded from your real 3D room.",
  },
  {
    href: "/tools/website-builder",
    icon: Globe,
    title: "Artist Website Builder",
    description: "A portfolio site from your own works — themes, bio, CV, exhibitions, live preview and a public page.",
  },
  {
    href: "/tools/marketing-studio",
    icon: Megaphone,
    title: "Marketing Studio",
    description: "Posters, social graphics, invitations and press kits from your exhibitions, ready to export.",
  },
  {
    href: "/tools/print-studio",
    icon: Printer,
    title: "Print Production Studio",
    description: "Production-ready print: dimensions, bleed, margins and honest resolution checks, with PDFs.",
  },
  {
    href: "/marketplace",
    icon: Store,
    title: "Marketplace",
    description: "List originals, editions and prints for sale — browse listings and answer buyer inquiries.",
  },
  {
    href: "/tools/teams",
    icon: Users,
    title: "Teams & Collaboration",
    description: "Work on exhibitions together — shared projects, comments, reviews and an activity log.",
  },
  {
    href: "/tools/digital-twin",
    icon: Scan,
    title: "Digital Twin, VR & AR",
    description: "A measured twin of a real room, VR walkthroughs and AR previews of your work on a real wall.",
  },
] as const;

const AUDIENCES = [
  {
    href: "/tools/for-artists",
    icon: Palette,
    title: "For Artists",
    description: "Run your studio from one place: inventory, pricing, sales and documents.",
  },
  {
    href: "/tools/for-curators",
    icon: LayoutGrid,
    title: "For Curators",
    description: "Build exhibitions, and keep the works and the people around them in order.",
  },
  {
    href: "/tools/for-galleries",
    icon: Store,
    title: "For Galleries",
    description: "Artworks, collectors, exhibitions and sales in one platform.",
  },
  {
    href: "/tools/for-collectors",
    icon: Gem,
    title: "For Collectors",
    description: "Keep track of what you own, what it is worth, and where it came from.",
  },
] as const;

export default function ToolsPage({
  user,
  exhibitionCount,
}: {
  user: { id: string; name: string; email: string };
  exhibitionCount: number;
}) {
  return (
    <ToolsShell
      user={user}
      exhibitionCount={exhibitionCount}
      title="Tools"
      eyebrow="TOOLS FOR ARTISTS, CURATORS, GALLERIES & COLLECTORS"
      description="The everyday tools of the art world, inside your workspace — price a work, keep your inventory, know your contacts, present and sell, and print the documents that go with a sale."
    >
      <section className="galleries-grid">
        {TOOLS.map((tool) => (
          <article key={tool.href} className={`gallery-card ${styles.toolCard}`}>
            <Link href={tool.href} className={styles.toolCardLink} aria-label={`Open ${tool.title}`}>
              <span className={styles.toolIcon}>
                <tool.icon size={22} />
              </span>
              <h3>{tool.title}</h3>
              <p>{tool.description}</p>
              <span className={styles.toolOpen}>
                Open <ArrowRight size={15} />
              </span>
            </Link>
          </article>
        ))}
      </section>

      <section className={styles.audienceSection}>
        <p className="eyebrow">
          <span className="status-dot" /> WHO IT IS FOR
        </p>
        <h2>One platform, shaped to how you work.</h2>
        <div className="galleries-grid">
          {AUDIENCES.map((audience) => (
            <article key={audience.href} className={`gallery-card ${styles.toolCard}`}>
              <Link
                href={audience.href}
                className={styles.toolCardLink}
                aria-label={`SANAA ${audience.title}`}
              >
                <span className={styles.toolIcon}>
                  <audience.icon size={22} />
                </span>
                <h3>{audience.title}</h3>
                <p>{audience.description}</p>
                <span className={styles.toolOpen}>
                  Read more <ArrowRight size={15} />
                </span>
              </Link>
            </article>
          ))}
        </div>
      </section>
    </ToolsShell>
  );
}
