"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import AccountSwitchButton from "@/components/account-switch-button";
import Avatar from "@/components/avatar";
import { useT } from "@/lib/i18n";
import type { DictionarySection } from "@/lib/i18n";
import {
  Archive,
  BarChart3,
  Box,
  Boxes,
  Calculator,
  ChevronsUpDown,
  Compass,
  CreditCard,
  FileText,
  GalleryVerticalEnd,
  Home,
  Image,
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

// Redesign sidebar (Phase 1, Nov 2026): the prototype's grouped
// navigation — Discovery & Social, Studio & Creation, Catalog &
// Business, Growth & System — with labels, a workspace switcher, a
// compact plan card and a profile chip. Collapsible to an icon rail
// (labels hidden, tooltips via title). Used ONLY by the redesigned
// dashboard; every other page keeps the existing sidebar.

type NavItem = {
  id: string;
  href: string;
  label: DictionarySection<"redesign">;
  icon: LucideIcon;
  count?: boolean;
  unread?: boolean;
};

type NavGroup = {
  id: string;
  label: DictionarySection<"redesign">;
  items: NavItem[];
};

const NAV_GROUPS: NavGroup[] = [
  {
    id: "discover",
    label: "groupDiscover",
    items: [
      { id: "explore", href: "/explore", label: "exploreExhibitions", icon: Compass },
      { id: "feed", href: "/feed", label: "feed", icon: Newspaper },
      { id: "messages", href: "/messages", label: "messages", icon: MessageSquare, unread: true },
      { id: "galleries", href: "/galleries", label: "lakisaGalerie", icon: GalleryVerticalEnd },
    ],
  },
  {
    id: "studio",
    label: "groupStudio",
    items: [
      { id: "dashboard", href: "/", label: "dashboard", icon: Home },
      { id: "exhibitions", href: "/exhibitions", label: "myExhibitions", icon: GalleryVerticalEnd, count: true },
      { id: "published", href: "/exhibitions?status=published", label: "publishedExhibitions", icon: Compass },
      { id: "artworks", href: "/artworks", label: "myArtworks", icon: Image },
      { id: "editor", href: "/exhibitions", label: "editor3d", icon: Boxes },
    ],
  },
  {
    id: "catalog",
    label: "groupCatalog",
    items: [
      { id: "inventory", href: "/tools/inventory", label: "inventory", icon: Archive },
      { id: "price", href: "/tools/price-your-work", label: "priceYourWork", icon: Calculator },
      { id: "certificates", href: "/tools/documents", label: "certificates", icon: FileText },
      { id: "orders", href: "/dashboard/orders", label: "myOrders", icon: ShoppingBag },
      { id: "plan", href: "/dashboard/plan", label: "myPlan", icon: CreditCard },
    ],
  },
  {
    id: "growth",
    label: "groupGrowth",
    items: [
      { id: "insights", href: "/dashboard/analytics", label: "exhibitionInsights", icon: BarChart3 },
      { id: "contacts", href: "/tools/contacts", label: "contacts", icon: Users },
      { id: "resources", href: "/tools", label: "resources", icon: Wrench },
      { id: "settings", href: "/settings", label: "settings", icon: Settings2 },
    ],
  },
];

export const REDESIGN_SIDEBAR_COLLAPSED_KEY = "lakisa-redesign-sidebar-collapsed";

type PlanMe = {
  plan: { name: string; slug: string; limits: { exhibitions: number | null; artworks: number | null } };
  usage: { exhibitions: number; artworks: number };
};

export default function RedesignSidebar({
  user,
  active = "dashboard",
  exhibitionCount,
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
  const [plan, setPlan] = useState<PlanMe | null>(null);

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

  // Plan usage for the compact plan card, same source as PlanCard
  // (/api/subscriptions/me). A failed fetch just hides the card.
  useEffect(() => {
    let cancelled = false;
    fetch("/api/subscriptions/me", { credentials: "same-origin", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (!cancelled && result && result.plan && result.usage) {
          setPlan(result as PlanMe);
        }
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();

  // Usage bars: artworks first (the tighter limit for most accounts),
  // then exhibitions. A null limit means unlimited.
  const usageRows = plan
    ? [
        { noun: t("redesign", "artworksWord"), used: plan.usage.artworks, limit: plan.plan.limits.artworks },
        { noun: t("redesign", "exhibitionsWord"), used: plan.usage.exhibitions, limit: plan.plan.limits.exhibitions },
      ]
    : [];

  return (
    <aside
      className={`${styles.sidebar}${collapsed ? ` ${styles.sidebarCollapsed}` : ""}`}
      aria-label="Main navigation"
    >
      <Link className={styles.brand} href="/" aria-label="Lakisa">
        <span className={styles.brandMark} aria-hidden="true">
          <Box size={17} />
        </span>
        <span className={styles.brandName}>
          Lakisa
          <span className={styles.brandTag}>Your art, in another space</span>
        </span>
      </Link>

      <Link className={styles.ws} href="/settings" title={user.name}>
        <span className={styles.wsAvatar} aria-hidden="true">
          {initials}
        </span>
        <span className={styles.wsMeta}>
          <span className={styles.wsName}>{user.name}</span>
          <span className={styles.wsSub}>
            {plan ? `${plan.plan.name} ${t("redesign", "planWord")}` : user.email}
          </span>
        </span>
        <ChevronsUpDown size={15} />
      </Link>

      <nav className={styles.nav} aria-label="Lakisa sections">
        {NAV_GROUPS.map((group) => (
          <div key={group.id}>
            <p className={styles.navLabel}>{t("redesign", group.label)}</p>
            <div className={styles.navItems}>
              {group.items.map((item) => (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`${styles.navLink}${active === item.id ? ` ${styles.navLinkActive}` : ""}`}
                  aria-current={active === item.id ? "page" : undefined}
                  title={t("redesign", item.label)}
                >
                  <item.icon size={17} />
                  <span>{t("redesign", item.label)}</span>
                  {item.count && <span className={styles.navBadge}>{exhibitionCount}</span>}
                  {item.unread && unreadMessages > 0 && (
                    <span className={styles.navBadge}>{unreadMessages}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className={styles.sidebarBottom}>
        {plan && (
          <div className={styles.planCard}>
            <p className={styles.planName}>{plan.plan.name}</p>
            {usageRows.map((row) => (
              <div key={row.noun}>
                <div className={styles.planBar}>
                  <div
                    className={styles.planBarFill}
                    style={{
                      width: row.limit ? `${Math.min(100, (row.used / row.limit) * 100)}%` : "100%",
                    }}
                  />
                </div>
                <p className={styles.planUsage}>
                  {row.used} {t("redesign", "of")}{" "}
                  {row.limit ?? t("redesign", "unlimited")} {row.noun}
                </p>
              </div>
            ))}
            <Link className={styles.planManage} href="/dashboard/plan">
              {t("redesign", "managePlan")} →
            </Link>
          </div>
        )}

        <AccountSwitchButton email={user.email} variant="sidebar" />

        <div className={styles.profileChip}>
          <Avatar name={user.name} avatarUrl={user.avatarUrl} className={styles.profileAvatar} />
          <div className={styles.profileCopy}>
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button type="button" className={styles.signOut} onClick={signOut}>
            {t("nav", "signOut")}
          </button>
        </div>

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
