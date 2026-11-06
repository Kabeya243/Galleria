"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Archive,
  BarChart3,
  Boxes,
  Calculator,
  Compass,
  FileText,
  GalleryVerticalEnd,
  Grid2X2,
  Home,
  Menu,
  Presentation,
  Settings2,
  ShieldCheck,
  Users,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";

// Navigation is organised around seven areas. Each group header links to
// that area's hub page; the items beneath link to the real pages. A page
// appears in at most two groups, where it genuinely belongs:
//   /            Discover + My Studio
//   /explore     Discover + Publish
//   /galleries   Discover + Spatial Lab
//   /exhibitions Create + Spatial Lab
//   /admin       Manage + Intelligence (owner only)
// The old flat list is gone, including its two dead links: "Artworks"
// pointed at a /#artworks anchor that no longer exists on the dashboard,
// and "Help center" pointed at a #help anchor that was never a page.
type NavItem = {
  id: string;
  href: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  count?: boolean;
};

type NavGroup = {
  id: string;
  hub: string;
  label: string;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "discover",
    hub: "/discover",
    label: "Discover",
    items: [
      { id: "explore", href: "/explore", label: "Explore exhibitions", icon: Compass },
      { id: "templates", href: "/galleries", label: "Gallery templates", icon: GalleryVerticalEnd },
      { id: "home", href: "/", label: "Home", icon: Home },
    ],
  },
  {
    id: "create",
    hub: "/create",
    label: "Create",
    items: [
      { id: "exhibitions", href: "/exhibitions", label: "My exhibitions", icon: GalleryVerticalEnd, count: true },
      { id: "tools-hub", href: "/tools", label: "Tools", icon: Wrench },
      { id: "price", href: "/tools/price-your-work", label: "Price your work", icon: Calculator },
    ],
  },
  {
    id: "spatial-lab",
    hub: "/spatial-lab",
    label: "Spatial Lab",
    items: [
      { id: "templates-lab", href: "/galleries", label: "Gallery templates", icon: GalleryVerticalEnd },
      { id: "editor", href: "/exhibitions", label: "3D editor", icon: Boxes },
    ],
  },
  {
    id: "manage",
    hub: "/manage",
    label: "Manage",
    items: [
      { id: "inventory", href: "/tools/inventory", label: "Inventory", icon: Archive },
      { id: "contacts", href: "/tools/contacts", label: "Contacts", icon: Users },
      { id: "certificates", href: "/tools/documents", label: "Certificates", icon: FileText },
      { id: "admin-stats", href: "/admin", label: "Admin stats", icon: ShieldCheck, adminOnly: true },
    ],
  },
  {
    id: "publish",
    hub: "/publish",
    label: "Publish",
    items: [
      { id: "present-sell", href: "/tools/present-sell", label: "Present & Sell", icon: Presentation },
      { id: "published", href: "/explore", label: "Published exhibitions", icon: Compass },
    ],
  },
  {
    id: "intelligence",
    hub: "/intelligence",
    label: "Intelligence",
    items: [
      // The hub itself is the entry point for everyone; Admin analytics
      // stays owner-only, and "Your exhibition insights" lives on the hub.
      { id: "insights", href: "/intelligence", label: "Exhibition insights", icon: BarChart3 },
      { id: "analytics", href: "/admin", label: "Admin analytics", icon: ShieldCheck, adminOnly: true },
    ],
  },
  {
    id: "studio",
    hub: "/studio",
    label: "My Studio",
    items: [
      { id: "dashboard", href: "/", label: "Dashboard", icon: Grid2X2 },
      { id: "settings", href: "/settings", label: "Settings", icon: Settings2 },
    ],
  },
];

// The `active` values the existing pages pass, mapped onto the nav item
// they highlight. Hub pages pass their group id and highlight the group
// header instead.
const LEGACY_ACTIVE: Record<string, string> = {
  overview: "dashboard",
  exhibitions: "exhibitions",
  explore: "explore",
  galleries: "templates",
  tools: "tools-hub",
  settings: "settings",
  admin: "admin-stats",
};

export type SidebarActive =
  | "overview"
  | "settings"
  | "galleries"
  | "exhibitions"
  | "explore"
  | "tools"
  | "admin"
  | "discover"
  | "create"
  | "spatial-lab"
  | "manage"
  | "publish"
  | "intelligence"
  | "studio";

export default function Sidebar({
  user,
  active,
  exhibitionCount,
}: {
  // isAdmin is carried on the user object by getCurrentUser (lib/auth.ts);
  // the Admin links only render when it is true.
  user: { name: string; email: string; isAdmin?: boolean };
  active: SidebarActive;
  exhibitionCount: number;
}) {
  const [open, setOpen] = useState(false);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  // Close the mobile slide-over with Escape, and lock body scroll while
  // it is open so the page behind it does not move.
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = previousOverflow;
    };
  }, [open ]);

  const activeItemId = LEGACY_ACTIVE[active] ?? null;
  const activeGroupId = NAV_GROUPS.some((group) => group.id === active) ? active : null;

  return (
    <>
      {/* Mobile only (see globals.css): a floating button that opens the
          nav as a slide-over. On desktop the sidebar is always visible
          and this button is hidden. */}
      <button
        type="button"
        className="mobile-nav-toggle"
        aria-label={open ? "Close navigation" : "Open navigation"}
        aria-expanded={open}
        aria-controls="sanaa-sidebar"
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && (
        <button
          type="button"
          className="sidebar-backdrop"
          aria-label="Close navigation"
          onClick={() => setOpen(false)}
        />
      )}

      <aside id="sanaa-sidebar" className={`sidebar${open ? " open" : ""}`}>
        <Link className="brand-lockup" href="/" aria-label="SANAA home" onClick={() => setOpen(false)}>
          <span className="brand-mark">s.</span>
          <span className="brand-name">SANAA</span>
        </Link>

        {/* The workspace box used to sit here ("Workspace" + the owner's
            name with a chevron), but it did nothing: a single workspace,
            no menu, no switch. The name still shows in the profile chip
            at the bottom of the sidebar. Removed 2026-11-07. */}
        <div className="side-nav-groups">
          <nav aria-label="Main navigation">
            {NAV_GROUPS.map((group) => {
              const items = group.items.filter((item) => !item.adminOnly || user.isAdmin);
              if (items.length === 0) return null;
              return (
                <div key={group.id}>
                  <Link
                    href={group.hub}
                    className={`nav-section-label nav-group-link${activeGroupId === group.id ? " active" : ""}`}
                    onClick={() => setOpen(false)}
                  >
                    {group.label}
                  </Link>
                  <div className="side-nav">
                    {items.map((item) => (
                      <Link
                        key={item.id}
                        className={activeItemId === item.id ? "nav-item active" : "nav-item"}
                        href={item.href}
                        onClick={() => setOpen(false)}
                      >
                        <item.icon size={17} /> {item.label}
                        {item.count && <span className="nav-count">{exhibitionCount}</span>}
                      </Link>
                    ))}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-spacer" />
        <div className="sidebar-bottom">
          <div className="profile-chip">
            <div className="profile-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
            <div className="profile-copy">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <button className="sign-out-button" onClick={signOut}>
              Sign out
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
