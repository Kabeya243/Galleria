import Link from "next/link";
import { Compass, GalleryVerticalEnd, Home, Search } from "lucide-react";
import HubPage, { HubCards, type HubCard } from "@/components/hub-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export const metadata = {
  title: "Discover — SANAA",
  description:
    "Find exhibitions to walk through, gallery rooms to build in, and the public home of the platform.",
};

const CARDS: HubCard[] = [
  {
    href: "/explore",
    icon: Compass,
    title: "Explore exhibitions",
    description: "Walk through public exhibitions by other artists, curators and galleries.",
    status: "ready",
  },
  {
    href: "/galleries",
    icon: GalleryVerticalEnd,
    title: "Gallery templates",
    description: "Forty rooms to start from — pick one, open it in the editor, make it yours.",
    status: "ready",
  },
  {
    href: "/",
    icon: Home,
    title: "Public home",
    description: "The front door of SANAA — the newest public exhibitions, open to everyone.",
    status: "ready",
  },
  {
    icon: Search,
    title: "Search all exhibitions",
    description: "Search every public exhibition on the platform by title, artist or work.",
    status: "development",
  },
];

// Discover is the one public hub: its content is public, so visitors
// without an account see it with the public header instead of the
// workspace sidebar.
export default async function DiscoverHub() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <main className="galleries-page">
        <header className="galleries-header">
          <Link className="brand-lockup" href="/">
            <span className="brand-mark">s.</span>
            <span className="brand-name">SANAA</span>
          </Link>
          <nav className="galleries-nav">
            <Link href="/">Workspace</Link>
            <Link href="/login" className="galleries-signin">
              Sign in
            </Link>
          </nav>
        </header>
        <div className="galleries-intro">
          <p className="eyebrow">
            <span className="status-dot" /> DISCOVER
          </p>
          <h1>Discover.</h1>
          <p>
            Find exhibitions to walk through, gallery rooms to build in, and the public home of
            the platform.
          </p>
        </div>
        <HubCards cards={CARDS} />
      </main>
    );
  }

  const exhibitionCount = await db.exhibition.count({ where: { ownerId: user.id } });
  return (
    <HubPage
      user={user}
      exhibitionCount={exhibitionCount}
      active="discover"
      hubName="Discover"
      title="Discover"
      eyebrow="DISCOVER"
      description="Find exhibitions to walk through, gallery rooms to build in, and the public home of the platform."
      cards={CARDS}
    />
  );
}
