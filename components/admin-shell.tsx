"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClipboardCheck,
  CreditCard,
  Images,
  LayoutDashboard,
  LayoutGrid,
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  ShoppingBag,
  Users,
  Wrench,
  Image as ImageIcon,
} from "lucide-react";
import AdminThemeToggle from "@/components/admin-theme-toggle";
import AccountSwitchButton from "@/components/account-switch-button";
import BrandLogo from "@/components/brand-logo";

const COLLAPSED_KEY = "sanaa-admin-collapsed";

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
};

type ShellCounts = { users: number; exhibitions: number; artworks: number; tools?: number; orders?: number };

// Section routes, in nav order. The active section is derived from the
// current path, so the shell never needs an `active` prop from the page.
const SECTION_ROUTES: Record<string, string> = {
  overview: "/admin",
  users: "/admin/users",
  exhibitions: "/admin/exhibitions",
  artworks: "/admin/artworks",
  galleries: "/admin/galleries",
  tools: "/admin/tools",
  "test-reports": "/admin/test-reports",
  subscriptions: "/admin/subscriptions",
  orders: "/admin/orders",
  "sub-admins": "/admin/sub-admins",
};

// Page hero (eyebrow + title + description), rendered by each admin page
// at the top of its content. It used to live inside this shell; it moved
// out so the shell can live in the shared admin layout and stay mounted
// across navigations, while each page keeps its own heading.
export function AdminHero({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="ad-hero">
      <span className="ad-eyebrow">{eyebrow}</span>
      <h1>{title}</h1>
      <p>{description}</p>
    </div>
  );
}

// Standalone shell for the Admin area (CRM): one page per section, no
// SANAA app sidebar and no SANAA navigation at all. The Admin has its
// own collapsible sidebar menu (style: dark minimal dashboard sidebar
// — logo + title on top, search field, grouped nav items with icons,
// active item highlighted, account section at the bottom). A hamburger
// collapses it to a narrow icon-only rail; the collapsed state persists
// in localStorage.
//
// This shell is mounted ONCE, in app/admin/layout.tsx, so it stays
// mounted while the visitor moves between admin pages: the sidebar
// never unmounts, never flashes, and its state (collapsed, menu
// search) survives navigation. Only the page content below swaps.
// The nav uses next/link, so moving between sections is a client-side
// navigation, never a full page reload. The badge counts come from the
// layout on first paint and are refreshed from the API whenever the
// route changes, so they stay true without remounting the shell.
// Every admin page is server-rendered and already checked the user's
// permissions before rendering, so this shell trusts its props —
// `sections` lists the nav items the viewer may open (a sub-admin only
// sees their own sections).
export default function AdminShell({
  user,
  counts,
  sections,
  children,
}: {
  user: { id: string; name: string; email: string };
  // Badge counts at first paint (from the layout); refreshed from the
  // API on every navigation.
  counts?: ShellCounts;
  // Nav ids the viewer may open; omitted = all (the manager).
  sections?: string[];
  children: React.ReactNode;
}) {
  const pathname = usePathname() ?? "/admin";
  const [collapsed, setCollapsed] = useState(false);
  const [query, setQuery] = useState("");
  const [liveCounts, setLiveCounts] = useState<ShellCounts | undefined>(counts);

  // Read the pre-paint collapsed state (set by the inline script in
  // app/admin/layout.tsx, so the sidebar never flashes the wrong width).
  useEffect(() => {
    setCollapsed(document.documentElement.getAttribute("data-admin-collapsed") === "true");
  }, []);

  // Keep the nav badge counts true across client-side navigations: the
  // layout (and its props) is not re-run when only the page segment
  // changes, so refresh the counts from the API on every route change.
  // A failed fetch just keeps the last known counts.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/admin/shell-counts", { credentials: "same-origin" })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (!cancelled && data && typeof data.users === "number") setLiveCounts(data);
      })
      .catch(() => {
        // Offline or denied: keep the counts from first paint.
      });
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  function toggleCollapsed() {
    const next = !collapsed;
    setCollapsed(next);
    document.documentElement.setAttribute("data-admin-collapsed", next ? "true" : "false");
    try {
      localStorage.setItem(COLLAPSED_KEY, next ? "true" : "false");
    } catch {
      // Private mode or blocked storage: the collapse still works for this visit.
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  const items: NavItem[] = [
    { id: "overview", label: "Dashboard", href: "/admin", icon: <LayoutDashboard size={18} /> },
    { id: "users", label: "All users", href: "/admin/users", icon: <Users size={18} />, badge: liveCounts?.users },
    {
      id: "exhibitions",
      label: "All exhibitions",
      href: "/admin/exhibitions",
      icon: <Images size={18} />,
      badge: liveCounts?.exhibitions,
    },
    {
      id: "artworks",
      label: "All artworks",
      href: "/admin/artworks",
      icon: <ImageIcon size={18} />,
      badge: liveCounts?.artworks,
    },
    {
      id: "galleries",
      label: "Galleries",
      href: "/admin/galleries",
      icon: <LayoutGrid size={18} />,
    },
    {
      id: "tools",
      label: "Tools used",
      href: "/admin/tools",
      icon: <Wrench size={18} />,
      badge: liveCounts?.tools,
    },
    {
      id: "test-reports",
      label: "Test reports",
      href: "/admin/test-reports",
      icon: <ClipboardCheck size={18} />,
    },
    {
      id: "subscriptions",
      label: "Subscriptions",
      href: "/admin/subscriptions",
      icon: <CreditCard size={18} />,
    },
    {
      id: "orders",
      label: "Orders",
      href: "/admin/orders",
      icon: <ShoppingBag size={18} />,
      badge: liveCounts?.orders,
    },
    {
      id: "sub-admins",
      label: "Sub-admins",
      href: "/admin/sub-admins",
      icon: <ShieldCheck size={18} />,
    },
  ].filter((item) => !sections || sections.includes(item.id));

  // Active section from the current path: exact match, else the longest
  // href that is a parent of the path (so a nested admin route still
  // highlights its section). Falls back to the overview.
  const activeItem =
    items.find((item) => pathname === item.href) ??
    items
      .filter((item) => item.href !== "/admin" && pathname.startsWith(item.href + "/"))
      .sort((a, b) => b.href.length - a.href.length)[0] ??
    items.find((item) => item.id === "overview");
  const active = activeItem?.id ?? "overview";

  const needle = query.trim().toLowerCase();
  const visibleItems = needle
    ? items.filter((item) => item.label.toLowerCase().includes(needle))
    : items;

  return (
    <div className="ad-root">
      {/* Backdrop for the mobile drawer (only visible on small screens). */}
      <button
        type="button"
        className="ad-sidebar-backdrop"
        aria-label="Close menu"
        onClick={toggleCollapsed}
        tabIndex={-1}
      />
      <aside className="ad-sidebar" aria-label="Admin menu">
        <div className="ad-sidebar-brand">
          <BrandLogo variant="icon" themeScope="admin" height={52} />
          <span className="ad-sidebar-titles">
            <strong>LAKISA</strong>
            <span>Admin Panel</span>
          </span>
        </div>

        <div className="ad-sidebar-search">
          <Search size={15} />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search"
            aria-label="Search menu"
          />
        </div>

        <nav className="ad-sidebar-nav">
          <span className="ad-sidebar-group">General</span>
          {visibleItems.length === 0 ? (
            <span className="ad-sidebar-empty">No matching section.</span>
          ) : (
            visibleItems.map((item) => (
              <Link
                key={item.id}
                href={item.href}
                className={`ad-nav-item${active === item.id ? " ad-nav-active" : ""}`}
                onClick={() => {
                  // On a small screen the sidebar is a drawer: close it after jumping.
                  if (window.innerWidth < 760) toggleCollapsed();
                }}
                title={item.label}
              >
                <span className="ad-nav-icon">{item.icon}</span>
                <span className="ad-nav-label">{item.label}</span>
                {item.badge !== undefined && (
                  <span className="ad-nav-badge">{item.badge}</span>
                )}
              </Link>
            ))
          )}
        </nav>

        <div className="ad-sidebar-bottom">
          <span className="ad-sidebar-group">Account</span>
          {/* One-click switch to Lakisa Official (Nov 2026): only
              renders for kabeyailunga243@gmail.com, so Kabeya can move
              from the admin account to the Official account without a
              password. The return button lives in the sidebar for the
              Official account. */}
          <AccountSwitchButton email={user.email} variant="admin" />
          <button type="button" className="ad-nav-item" onClick={signOut} title="Sign out">
            <span className="ad-nav-icon">
              <LogOut size={18} />
            </span>
            <span className="ad-nav-label">Sign out</span>
          </button>
        </div>
      </aside>

      <div className="ad-body">
        <header className="ad-topbar">
          <div className="ad-topbar-left">
            <button
              type="button"
              className="ad-hamburger"
              onClick={toggleCollapsed}
              aria-label={collapsed ? "Expand menu" : "Collapse menu"}
              title={collapsed ? "Expand menu" : "Collapse menu"}
            >
              <Menu size={18} />
            </button>
            <span className="ad-topbar-section">{activeItem?.label ?? "Dashboard"}</span>
          </div>
          <div className="ad-topbar-right">
            <span className="ad-topbar-user">{user.name}</span>
            <AdminThemeToggle />
          </div>
        </header>
        <main className="ad-main">
          <div className="ad-container">{children}</div>
        </main>
      </div>
    </div>
  );
}
