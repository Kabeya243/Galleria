"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/avatar";
import BrandLogo from "@/components/brand-logo";
import NotificationBell from "@/components/notification-bell";
import { useT, type DictionarySection } from "@/lib/i18n";
import {
  Archive,
  BarChart3,
  Boxes,
  Calculator,
  Compass,
  CreditCard,
  FileText,
  GalleryVerticalEnd,
  Grid2X2,
  Home,
  Image,
  Menu,
  MessageSquare,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  ShieldCheck,
  ShoppingBag,
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
// Labels are dictionary keys (lib/i18n.ts, section "nav") so the whole
// navigation switches language with the rest of the site.
type NavItem = {
  id: string;
  href: string;
  label: DictionarySection<"nav">;
  icon: LucideIcon;
  adminOnly?: boolean;
  count?: boolean;
  // Unread-messages badge: fetched client-side (see the effect below),
  // so no page has to thread the count through as a prop.
  unread?: boolean;
};

type NavGroup = {
  id: string;
  hub: string;
  label: DictionarySection<"nav">;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "discover",
    hub: "/discover",
    label: "discover",
    items: [
      { id: "explore", href: "/explore", label: "explore", icon: Compass },
      { id: "feed", href: "/feed", label: "feed", icon: Newspaper },
      { id: "messages", href: "/messages", label: "messages", icon: MessageSquare, unread: true },
      { id: "templates", href: "/galleries", label: "templates", icon: GalleryVerticalEnd },
      { id: "home", href: "/", label: "home", icon: Home },
    ],
  },
  {
    id: "create",
    hub: "/create",
    label: "create",
    items: [
      { id: "exhibitions", href: "/exhibitions", label: "exhibitions", icon: GalleryVerticalEnd, count: true },
      // The reusable artwork library: every work the artist has ever
      // uploaded, all exhibitions together — the place a new
      // exhibition's works are picked from, instead of re-uploading.
      { id: "my-artworks", href: "/artworks", label: "myArtworks", icon: Image },
      { id: "tools-hub", href: "/tools", label: "tools", icon: Wrench },
      { id: "price", href: "/tools/price-your-work", label: "price", icon: Calculator },
    ],
  },
  {
    id: "spatial-lab",
    hub: "/spatial-lab",
    label: "spatialLab",
    items: [
      { id: "templates-lab", href: "/galleries", label: "templates", icon: GalleryVerticalEnd },
      { id: "editor", href: "/exhibitions", label: "editor", icon: Boxes },
    ],
  },
  {
    id: "manage",
    hub: "/manage",
    label: "manage",
    items: [
      { id: "inventory", href: "/tools/inventory", label: "inventory", icon: Archive },
      { id: "contacts", href: "/tools/contacts", label: "contacts", icon: Users },
      { id: "certificates", href: "/tools/documents", label: "certificates", icon: FileText },
      { id: "admin-stats", href: "/admin", label: "adminStats", icon: ShieldCheck, adminOnly: true },
    ],
  },
  {
    id: "publish",
    hub: "/publish",
    label: "publish",
    items: [
      { id: "published", href: "/explore", label: "published", icon: Compass },
    ],
  },
  {
    id: "intelligence",
    hub: "/intelligence",
    label: "intelligence",
    items: [
      // Visitor analytics moved to their own page (Nov 2026): the
      // "insights" link goes to /dashboard/analytics. Admin analytics
      // stays owner-only.
      { id: "insights", href: "/dashboard/analytics", label: "insights", icon: BarChart3 },
      { id: "analytics", href: "/admin", label: "adminAnalytics", icon: ShieldCheck, adminOnly: true },
    ],
  },
  {
    id: "studio",
    hub: "/studio",
    label: "studio",
    items: [
      { id: "dashboard", href: "/", label: "dashboard", icon: Grid2X2 },
      { id: "my-plan", href: "/dashboard/plan", label: "myPlan", icon: CreditCard },
      // Marketplace orders (Nov 2026): what the user bought and sold,
      // with the fee split of each order.
      { id: "my-orders", href: "/dashboard/orders", label: "myOrders", icon: ShoppingBag },
      { id: "settings", href: "/settings", label: "settings", icon: Settings2 },
    ],
  },
];

// The `active` values the existing pages pass, mapped onto the nav item
// they highlight. Hub pages pass their group id and highlight the group
// header instead.
const LEGACY_ACTIVE: Record<string, string> = {
  overview: "dashboard",
  plan: "my-plan",
  orders: "my-orders",
  analytics: "insights",
  exhibitions: "exhibitions",
  artworks: "my-artworks",
  explore: "explore",
  feed: "feed",
  messages: "messages",
  galleries: "templates",
  tools: "tools-hub",
  settings: "settings",
  admin: "admin-stats",
};

export type SidebarActive =
  | "overview"
  | "plan"
  | "orders"
  | "analytics"
  | "settings"
  | "galleries"
  | "exhibitions"
  | "artworks"
  | "explore"
  | "feed"
  | "messages"
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
  collapsible = true,
}: {
  // isAdmin / isSubAdmin are carried on the user object by
  // getCurrentUser (lib/auth.ts); the Admin links render when either
  // is true — the admin page itself checks the permissions server-side.
  user: { name: string; email: string; avatarUrl?: string | null; isAdmin?: boolean; isSubAdmin?: boolean };
  active: SidebarActive;
  exhibitionCount: number;
  // Collapsible mode is the platform-wide default: a narrow icon-only
  // rail, the full menu when unfolded — as an overlay floating above
  // the page, never pushing the content. Hovering the rail unfolds the
  // menu and moving the mouse away folds it back (short delay so a
  // brief slip does not flicker it shut); the toggle button stays as
  // the click fallback, and clicking a nav icon while collapsed
  // unfolds the menu. Pass collapsible={false} for the rare page that
  // needs the full-width sidebar as a fixed layout element instead.
  collapsible?: boolean;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(collapsible ?? false);
  // Unread-messages badge (Nov 2026): fetched once per sidebar mount
  // so the inbox count stays live without threading a prop through
  // every page that renders the sidebar. A failed fetch just hides
  // the badge; the inbox itself always shows the true counts.
  const [unreadMessages, setUnreadMessages] = useState(0);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/messages/unread", { credentials: "same-origin", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (!cancelled && result && typeof result.unreadCount === "number") {
          setUnreadMessages(result.unreadCount);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  // Hover open/close (collapsible mode, desktop only): the rail unfolds
  // while the mouse is over it and folds back shortly after the mouse
  // leaves. The close is delayed (~180 ms) so a brief slip out of the
  // area does not flicker the menu shut, and it never folds while
  // keyboard focus is inside the menu. Touch devices have no hover —
  // the pointer guard keeps this a desktop-only behaviour and the click
  // toggle remains the fallback there.
  const asideRef = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  function clearCloseTimer() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function hoverCanUse() {
    return collapsible && typeof window !== "undefined" && window.matchMedia("(pointer: fine)").matches;
  }

  function hoverOpen() {
    if (!hoverCanUse()) return;
    clearCloseTimer();
    setCollapsed(false);
  }

  function hoverClose() {
    if (!hoverCanUse()) return;
    clearCloseTimer();
    closeTimer.current = setTimeout(() => {
      if (asideRef.current?.contains(document.activeElement)) return;
      setCollapsed(true);
    }, 180);
  }

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
        aria-label={open ? t("nav", "closeNav") : t("nav", "openNav")}
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
          aria-label={t("nav", "closeNav")}
          onClick={() => setOpen(false)}
        />
      )}

      <aside
        id="sanaa-sidebar"
        ref={asideRef}
        className={`sidebar${open ? " open" : ""}${collapsed ? " collapsed" : ""}${collapsible ? " sidebar-collapsible" : ""}`}
        onMouseEnter={hoverOpen}
        onMouseLeave={hoverClose}
      >
        <div className="sidebar-top-row">
          <Link className="brand-lockup" href="/" aria-label={t("nav", "sanaaHome")} onClick={() => setOpen(false)}>
            <BrandLogo variant="horizontal" height={52} />
            <BrandLogo variant="icon" height={44} />
          </Link>
          {/* Notification bell (Nov 2026): unread messages, for every
              signed-in user — the sidebar only renders for them. */}
          <NotificationBell />
          {collapsible ? (
            <button
              type="button"
              className="sidebar-collapse-toggle"
              aria-label={collapsed ? t("nav", "expandNav") : t("nav", "collapseNav")}
              aria-expanded={!collapsed}
              onClick={() => setCollapsed((value) => !value)}
            >
              {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
            </button>
          ) : null}
        </div>

        {/* The workspace box used to sit here ("Workspace" + the owner's
            name with a chevron), but it did nothing: a single workspace,
            no menu, no switch. The name still shows in the profile chip
            at the bottom of the sidebar. Removed 2026-11-07. */}
        <div className="side-nav-groups">
          <nav aria-label={t("nav", "mainNav")}>
            {NAV_GROUPS.map((group) => {
              const items = group.items.filter((item) => !item.adminOnly || user.isAdmin || user.isSubAdmin);
              if (items.length === 0) return null;
              return (
                <div key={group.id}>
                  <Link
                    href={group.hub}
                    className={`nav-section-label nav-group-link${activeGroupId === group.id ? " active" : ""}`}
                    onClick={() => setOpen(false)}
                  >
                    {t("nav", group.label)}
                  </Link>
                  <div className="side-nav">
                    {items.map((item) =>
                      collapsed ? (
                        // Collapsed rail: the icon unfolds the full menu
                        // (it does not navigate — the label navigates
                        // once the menu is open).
                        <button
                          key={item.id}
                          type="button"
                          className={activeItemId === item.id ? "nav-item active" : "nav-item"}
                          title={t("nav", item.label)}
                          aria-label={t("nav", item.label)}
                          onClick={() => setCollapsed(false)}
                        >
                          <item.icon size={17} />
                          <span className="nav-item-label">{t("nav", item.label)}</span>
                          {item.count && <span className="nav-count">{exhibitionCount}</span>}
                          {item.unread && unreadMessages > 0 && (
                            <span className="nav-count">{unreadMessages}</span>
                          )}
                        </button>
                      ) : (
                        <Link
                          key={item.id}
                          className={activeItemId === item.id ? "nav-item active" : "nav-item"}
                          href={item.href}
                          onClick={() => setOpen(false)}
                        >
                          <item.icon size={17} /> <span className="nav-item-label">{t("nav", item.label)}</span>
                          {item.count && <span className="nav-count">{exhibitionCount}</span>}
                          {item.unread && unreadMessages > 0 && (
                            <span className="nav-count">{unreadMessages}</span>
                          )}
                        </Link>
                      ),
                    )}
                  </div>
                </div>
              );
            })}
          </nav>
        </div>

        <div className="sidebar-bottom">
          <div className="profile-chip">
            <Avatar name={user.name} avatarUrl={user.avatarUrl} className="profile-avatar" />
            <div className="profile-copy">
              <strong>{user.name}</strong>
              <span>{user.email}</span>
            </div>
            <button className="sign-out-button" onClick={signOut}>
              {t("nav", "signOut")}
            </button>
          </div>
        </div>
      </aside>
    </>
  );
}
