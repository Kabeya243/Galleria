"use client";

import { useEffect, useState } from "react";
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
  Users,
  Wrench,
  Image as ImageIcon,
} from "lucide-react";
import AdminThemeToggle from "@/components/admin-theme-toggle";
import BrandLogo from "@/components/brand-logo";

const COLLAPSED_KEY = "sanaa-admin-collapsed";

type NavItem = {
  id: string;
  label: string;
  href: string;
  icon: React.ReactNode;
  badge?: number;
};

// Standalone shell for the Admin area (CRM): ONE single page, no SANAA app
// sidebar and no SANAA navigation at all. The Admin has its own collapsible
// sidebar menu (style: dark minimal dashboard sidebar — logo + title on
// top, search field, grouped nav items with icons, active item highlighted,
// account section at the bottom). A hamburger collapses it to a narrow
// icon-only rail; the collapsed state persists in localStorage. Every admin
// page is server-rendered and already checked the user's permissions before
// rendering, so this shell trusts its props — `sections` lists the nav
// items the viewer may open (a sub-admin only sees their own sections).
export default function AdminShell({
  user,
  title,
  eyebrow,
  description,
  counts,
  sections,
  children,
}: {
  user: { id: string; name: string; email: string };
  title: string;
  eyebrow: string;
  description: string;
  counts?: { users: number; exhibitions: number; artworks: number; tools?: number };
  // Nav ids the viewer may open; omitted = all (the manager).
  sections?: string[];
  children: React.ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [active, setActive] = useState("overview");
  const [query, setQuery] = useState("");

  // Read the pre-paint collapsed state (set by the inline script in
  // app/admin/layout.tsx, so the sidebar never flashes the wrong width).
  useEffect(() => {
    setCollapsed(document.documentElement.getAttribute("data-admin-collapsed") === "true");
  }, []);

  // Track which section is on screen, so the matching menu item is
  // highlighted (like the reference's active Dashboard row).
  useEffect(() => {
    const ids = ["overview", "users", "exhibitions", "artworks", "galleries", "tools", "test-reports", "subscriptions", "sub-admins"];
    const elements = ids
      .map((id) => document.getElementById(id))
      .filter((el): el is HTMLElement => el !== null);
    if (elements.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    for (const el of elements) observer.observe(el);
    return () => observer.disconnect();
  }, []);

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
    { id: "overview", label: "Dashboard", href: "#overview", icon: <LayoutDashboard size={18} /> },
    { id: "users", label: "All users", href: "#users", icon: <Users size={18} />, badge: counts?.users },
    {
      id: "exhibitions",
      label: "All exhibitions",
      href: "#exhibitions",
      icon: <Images size={18} />,
      badge: counts?.exhibitions,
    },
    {
      id: "artworks",
      label: "All artworks",
      href: "#artworks",
      icon: <ImageIcon size={18} />,
      badge: counts?.artworks,
    },
    {
      id: "galleries",
      label: "Galleries",
      href: "#galleries",
      icon: <LayoutGrid size={18} />,
    },
    {
      id: "tools",
      label: "Tools used",
      href: "#tools",
      icon: <Wrench size={18} />,
      badge: counts?.tools,
    },
    {
      id: "test-reports",
      label: "Test reports",
      href: "#test-reports",
      icon: <ClipboardCheck size={18} />,
    },
    {
      id: "subscriptions",
      label: "Subscriptions",
      href: "#subscriptions",
      icon: <CreditCard size={18} />,
    },
    {
      id: "sub-admins",
      label: "Sub-admins",
      href: "#sub-admins",
      icon: <ShieldCheck size={18} />,
    },
  ].filter((item) => !sections || sections.includes(item.id));
  const needle = query.trim().toLowerCase();
  const visibleItems = needle
    ? items.filter((item) => item.label.toLowerCase().includes(needle))
    : items;
  const activeItem = items.find((item) => item.id === active);

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
              <a
                key={item.id}
                href={item.href}
                className={`ad-nav-item${active === item.id ? " ad-nav-active" : ""}`}
                onClick={() => {
                  setActive(item.id);
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
              </a>
            ))
          )}
        </nav>

        <div className="ad-sidebar-bottom">
          <span className="ad-sidebar-group">Account</span>
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
          <div className="ad-container">
            <div className="ad-hero">
              <span className="ad-eyebrow">{eyebrow}</span>
              <h1>{title}</h1>
              <p>{description}</p>
            </div>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
