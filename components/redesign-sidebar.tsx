"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AccountSwitchButton from "@/components/account-switch-button";
import { useT } from "@/lib/i18n";
import type { DictionarySection } from "@/lib/i18n";
import {
  Archive,
  BarChart3,
  BookOpen,
  Boxes,
  Calculator,
  Compass,
  CreditCard,
  FileText,
  GalleryVerticalEnd,
  Globe,
  Image,
  LayoutDashboard,
  Layers,
  Mail,
  MessageSquare,
  Newspaper,
  PanelLeftClose,
  PanelLeftOpen,
  Settings2,
  ShoppingBag,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import styles from "./redesign-dashboard.module.css";

// Redesign sidebar (Nov 2026, reordered Dec 2026): the menu starts with
// the public/discovery sections by order of importance — Explore,
// Exhibitions (published), Feed, Magazine — then the artist's own
// workspace (Dashboard, My Exhibitions, My Artworks, Resources) and
// the rest (Messages, Lakisa Galerie, Inventory, Contacts, Price Your
// Work, Certificates, Analytics, My Orders, My Plan, 3D Editor).
// Settings stays at the bottom, with Feedback and the account switch.
// The logo and the profile moved to the topbar; the plan card and the
// workspace switcher are gone (My plan is a nav item, the account
// switch sits at the bottom). Collapsible to an icon rail (labels
// hidden, tooltips via title).

type NavItem = {
  id: string;
  href: string;
  label: DictionarySection<"redesign">;
  icon: LucideIcon;
  unread?: boolean;
  external?: boolean;
};

// Top of the menu, by order of importance: discovery first. "Exhibitions"
// is the published exhibitions (the public view); the artist's own list
// is "My Exhibitions" further down.
const NAV_MAIN: NavItem[] = [
  { id: "explore", href: "/explore", label: "exploreExhibitions", icon: Compass },
  { id: "published", href: "/exhibitions?status=published", label: "exhibitions", icon: Globe },
  { id: "feed", href: "/feed", label: "feed", icon: Newspaper },
  { id: "magazine", href: "/magazine", label: "magazine", icon: BookOpen },
];

const NAV_MORE: NavItem[] = [
  { id: "dashboard", href: "/", label: "dashboard", icon: LayoutDashboard },
  { id: "exhibitions", href: "/exhibitions", label: "myExhibitions", icon: Layers },
  { id: "artworks", href: "/artworks", label: "myArtworks", icon: Image },
  { id: "resources", href: "/tools", label: "resources", icon: Wrench },
  { id: "messages", href: "/messages", label: "messages", icon: MessageSquare, unread: true },
  { id: "galleries", href: "/galleries", label: "lakisaGalerie", icon: GalleryVerticalEnd },
  { id: "inventory", href: "/tools/inventory", label: "inventory", icon: Archive },
  { id: "contacts", href: "/tools/contacts", label: "contacts", icon: Users },
  { id: "price", href: "/tools/price-your-work", label: "priceYourWork", icon: Calculator },
  { id: "certificates", href: "/tools/documents", label: "certificates", icon: FileText },
  { id: "insights", href: "/dashboard/analytics", label: "analytics", icon: BarChart3 },
  { id: "orders", href: "/dashboard/orders", label: "myOrders", icon: ShoppingBag },
  { id: "plan", href: "/dashboard/plan", label: "myPlan", icon: CreditCard },
  { id: "editor", href: "/exhibitions", label: "editor3d", icon: Boxes },
];

export const REDESIGN_SIDEBAR_COLLAPSED_KEY = "lakisa-redesign-sidebar-collapsed";

export default function RedesignSidebar({
  user,
  active = "dashboard",
  exhibitionCount: _exhibitionCount,
  collapsed,
  onCollapsedChange,
}: {
  user: { name: string; email: string; avatarUrl?: string | null; isAdmin?: boolean; isSubAdmin?: boolean };
  active?: string;
  exhibitionCount: number;
  // Controlled by the dashboard shell: the grid column of the shell
  // follows the same value, so the rail and the content stay in sync.
  collapsed: boolean;
  onCollapsedChange: (collapsed: boolean) => void;
}) {
  const t = useT();
  const [unreadMessages, setUnreadMessages] = useState(0);

  function toggleCollapsed() {
    onCollapsedChange(!collapsed);
  }

  // Unread-messages badge, same source as the old sidebar
  // (/api/messages/unread). A failed fetch just hides the badge.
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

  function navLink(item: NavItem) {
    const isActive = active === item.id;
    const inner = (
      <>
        <item.icon size={17} />
        <span>{t("redesign", item.label)}</span>
        {item.unread && unreadMessages > 0 && <span className={styles.navBadge}>{unreadMessages}</span>}
      </>
    );
    const className = `${styles.navLink}${isActive ? ` ${styles.navLinkActive}` : ""}`;
    if (item.external) {
      return (
        <a
          key={item.id}
          href={item.href}
          className={className}
          title={t("redesign", item.label)}
        >
          {inner}
        </a>
      );
    }
    return (
      <Link
        key={item.id}
        href={item.href}
        className={className}
        aria-current={isActive ? "page" : undefined}
        title={t("redesign", item.label)}
      >
        {inner}
      </Link>
    );
  }

  return (
    <aside
      className={`${styles.sidebar}${collapsed ? ` ${styles.sidebarCollapsed}` : ""}`}
      aria-label="Main navigation"
    >
      <nav className={styles.nav} aria-label="Lakisa sections">
        <div className={styles.navItems}>{NAV_MAIN.map((item) => navLink(item))}</div>
        <div className={styles.navDivider} aria-hidden="true" />
        <div className={styles.navItems}>{NAV_MORE.map((item) => navLink(item))}</div>
      </nav>

      <div className={styles.sidebarBottom}>
        <Link
          href="/settings"
          className={`${styles.navLink}${active === "settings" ? ` ${styles.navLinkActive}` : ""}`}
          aria-current={active === "settings" ? "page" : undefined}
          title={t("redesign", "settings")}
        >
          <Settings2 size={17} />
          <span>{t("redesign", "settings")}</span>
        </Link>
        <a
          href="mailto:hello@lakisa.art"
          className={styles.navLink}
          title={t("redesign", "feedback")}
        >
          <Mail size={17} />
          <span>{t("redesign", "feedback")}</span>
        </a>

        <AccountSwitchButton email={user.email} variant="sidebar" />

        <button
          type="button"
          className={styles.collapseBtn}
          onClick={toggleCollapsed}
          aria-expanded={!collapsed}
          title={collapsed ? t("redesign", "expandNav") : t("redesign", "collapseNav")}
        >
          {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          <span>{collapsed ? t("redesign", "expandNav") : t("redesign", "collapseNav")}</span>
        </button>
      </div>
    </aside>
  );
}
