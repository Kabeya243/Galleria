"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Avatar from "@/components/avatar";
import ExhibitionCreateDialog from "@/components/exhibition-create-dialog";
import NotificationBell from "@/components/notification-bell";
import RedesignCommandPalette, { type PaletteExhibition } from "@/components/redesign-command-palette";
import RedesignSidebar, { REDESIGN_SIDEBAR_COLLAPSED_KEY } from "@/components/redesign-sidebar";
import WelcomeTour, { hasSeenWelcomeTour } from "@/components/welcome-tour";
import { useT } from "@/lib/i18n";
import type { RoomModelId } from "@/lib/rooms";
import { applyTheme, getStoredTheme, resolveTheme } from "@/lib/theme";
import { Box, ChevronDown, LogOut, Moon, Plus, Route, Search, Settings2, Sun } from "lucide-react";
import styles from "./redesign-dashboard.module.css";

// Redesign shell v2 (Nov 2026): the screenshot's chrome — a topbar
// with the logo, a centred search pill, the theme toggle, the bell and
// the user chip with its dropdown; below it the tabs row (Dashboard,
// My Exhibitions, My Artworks, Resources, Insights) with the
// dark-green Create + pill at the right; the flat sidebar on the left.
// Shared by every redesigned page. The dashboard keeps its own
// content; every other page renders its content as the shell's
// children. Children may be a render function receiving { openCreate }
// when a page needs to open the create dialog from its own content
// (the dashboard onboarding does).
//
// The command palette needs the user's exhibitions. Pages that already
// load them server-side pass them in; the shell otherwise fetches
// GET /api/exhibitions (own exhibitions) once, client-side. A failed
// fetch just leaves the palette's exhibition section empty.

export type RedesignShellHelpers = {
  openCreate: () => void;
};

export type RedesignShellUser = {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  isAdmin?: boolean;
  isSubAdmin?: boolean;
};

// The five tabs. Pages whose active id is not one of these (explore,
// feed, messages, tools, …) leave every tab unselected; the sidebar
// shows their active item instead. "published" is a filter of My
// Exhibitions, so it lights that tab.
const TABS = [
  { id: "dashboard", href: "/", label: "dashboard" },
  { id: "exhibitions", href: "/exhibitions", label: "myExhibitions" },
  { id: "artworks", href: "/artworks", label: "myArtworks" },
  { id: "resources", href: "/tools", label: "resources" },
  { id: "insights", href: "/dashboard/analytics", label: "exhibitionInsights" },
] as const;

export default function RedesignShell({
  user,
  active,
  exhibitionCount,
  exhibitions: exhibitionsProp,
  openTourOnMount = false,
  children,
}: {
  user: RedesignShellUser;
  active: string;
  exhibitionCount: number;
  exhibitions?: PaletteExhibition[];
  openTourOnMount?: boolean;
  children: ReactNode | ((helpers: RedesignShellHelpers) => ReactNode);
}) {
  const t = useT();
  const router = useRouter();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showTour, setShowTour] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [exhibitions, setExhibitions] = useState<PaletteExhibition[]>(exhibitionsProp ?? []);

  // Sidebar collapse preference (per browser), read after mount.
  useEffect(() => {
    try {
      setSidebarCollapsed(window.localStorage.getItem(REDESIGN_SIDEBAR_COLLAPSED_KEY) === "1");
    } catch {
      setSidebarCollapsed(false);
    }
  }, []);

  function handleSidebarCollapsed(value: boolean) {
    setSidebarCollapsed(value);
    try {
      window.localStorage.setItem(REDESIGN_SIDEBAR_COLLAPSED_KEY, value ? "1" : "0");
    } catch {
      // Private mode: the preference just does not stick.
    }
  }

  // Welcome tour: the dashboard opens it once, on the first visit
  // after the account was created. Other pages only open it on demand.
  useEffect(() => {
    if (openTourOnMount && !hasSeenWelcomeTour(user.id)) {
      setShowTour(true);
    }
  }, [openTourOnMount, user.id]);

  // Theme toggle (same mechanism as components/theme-toggle.tsx and
  // lib/theme.ts: localStorage + cookie, data-theme on <html>).
  const [effectiveTheme, setEffectiveTheme] = useState<"light" | "dark">("light");
  useEffect(() => {
    const sync = () => setEffectiveTheme(resolveTheme(getStoredTheme()));
    sync();
    window.addEventListener("sanaa-theme-change", sync);
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    media.addEventListener("change", sync);
    return () => {
      window.removeEventListener("sanaa-theme-change", sync);
      media.removeEventListener("change", sync);
    };
  }, []);

  function toggleTheme() {
    applyTheme(effectiveTheme === "dark" ? "light" : "dark");
  }

  // Palette exhibitions, only when the page did not provide them.
  useEffect(() => {
    if (exhibitionsProp) return;
    let cancelled = false;
    fetch("/api/exhibitions", { credentials: "same-origin", cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((result) => {
        if (cancelled || !result || !Array.isArray(result.exhibitions)) return;
        setExhibitions(
          result.exhibitions.map((item: { id: string; title: string; slug: string; status: string }) => ({
            id: item.id,
            title: item.title,
            slug: item.slug,
            status: item.status,
          })),
        );
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [exhibitionsProp]);

  function openCreate() {
    setShowCreateDialog(true);
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  async function createExhibition(title: string, model: RoomModelId) {
    setCreating(true);
    try {
      const response = await fetch("/api/exhibitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, model }),
      });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? t("dashboard", "couldNotCreate"));
      window.location.assign(`/editor/${result.exhibition.id}`);
    } catch (error) {
      console.error("Could not create exhibition.", error);
      setCreateError(error instanceof Error ? error.message : t("dashboard", "couldNotCreate"));
      setCreating(false);
      throw error;
    }
  }

  const activeTab = active === "published" ? "exhibitions" : active;
  const createLabel = creating ? t("dashboard", "creating") : t("nav", "create");

  return (
    <div className={`${styles.shell}${sidebarCollapsed ? ` ${styles.shellCollapsed}` : ""}`}>
      <header className={styles.topbar}>
        <Link className={styles.brandTop} href="/" aria-label="Lakisa">
          <Box size={22} aria-hidden="true" />
          Lakisa
        </Link>

        <div className={styles.topSearch}>
          <button
            type="button"
            className={styles.searchBtn}
            onClick={() => setPaletteOpen(true)}
            aria-haspopup="dialog"
            aria-label={t("redesign", "searchAria")}
          >
            <Search size={16} />
            <span>{t("redesign", "searchPlaceholderTop")}</span>
            <kbd className={styles.searchKbd}>⌘K</kbd>
          </button>
        </div>

        <div className={styles.topActions}>
          <button
            type="button"
            className={styles.iconBtn}
            onClick={toggleTheme}
            aria-label={effectiveTheme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
            title={effectiveTheme === "dark" ? "Light mode" : "Dark mode"}
          >
            {effectiveTheme === "dark" ? <Sun size={17} /> : <Moon size={17} />}
          </button>
          <span className={styles.bellSlot}>
            <NotificationBell />
          </span>
          <button
            type="button"
            className={`${styles.createBtn} ${styles.topbarCreate}`}
            onClick={openCreate}
            disabled={creating}
          >
            <span>{createLabel}</span> <Plus size={16} />
          </button>
          <div className={styles.userMenuWrap}>
            <button
              type="button"
              className={styles.userChip}
              onClick={() => setUserMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={userMenuOpen}
            >
              <Avatar name={user.name} avatarUrl={user.avatarUrl} className={styles.userChipAvatar} />
              <span className={styles.userChipName}>{user.name}</span>
              <ChevronDown size={15} />
            </button>
            {userMenuOpen && (
              <>
                <button
                  type="button"
                  className={styles.userMenuScrim}
                  aria-label={t("common", "dismiss")}
                  onClick={() => setUserMenuOpen(false)}
                />
                <div className={styles.userMenu} role="menu">
                  <div className={styles.userMenuHead}>
                    <strong>{user.name}</strong>
                    <span>{user.email}</span>
                  </div>
                  <Link
                    className={styles.userMenuItem}
                    href="/settings"
                    role="menuitem"
                    onClick={() => setUserMenuOpen(false)}
                  >
                    <Settings2 size={16} /> {t("redesign", "settings")}
                  </Link>
                  <button
                    type="button"
                    className={styles.userMenuItem}
                    role="menuitem"
                    onClick={() => {
                      setUserMenuOpen(false);
                      setShowTour(true);
                    }}
                  >
                    <Route size={16} /> {t("redesign", "takeTour")}
                  </button>
                  <button
                    type="button"
                    className={styles.userMenuItem}
                    role="menuitem"
                    onClick={() => void signOut()}
                  >
                    <LogOut size={16} /> {t("nav", "signOut")}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </header>

      <RedesignSidebar
        user={user}
        active={active}
        exhibitionCount={exhibitionCount}
        collapsed={sidebarCollapsed}
        onCollapsedChange={handleSidebarCollapsed}
      />

      <div className={styles.main}>
        <nav className={styles.tabs} aria-label="Lakisa sections">
          {TABS.map((tab) => (
            <Link
              key={tab.id}
              href={tab.href}
              className={`${styles.tab}${activeTab === tab.id ? ` ${styles.tabActive}` : ""}`}
              aria-current={activeTab === tab.id ? "page" : undefined}
            >
              {t("redesign", tab.label)}
            </Link>
          ))}
          <button
            type="button"
            className={`${styles.createBtn} ${styles.tabsCreate}`}
            onClick={openCreate}
            disabled={creating}
          >
            <span>{createLabel}</span> <Plus size={16} />
          </button>
        </nav>

        <RedesignCommandPalette
          open={paletteOpen}
          onOpenChange={setPaletteOpen}
          exhibitions={exhibitions}
          onCreate={openCreate}
          onTour={() => setShowTour(true)}
        />

        <main className={styles.content}>
          {typeof children === "function" ? children({ openCreate }) : children}
        </main>

        {showCreateDialog && (
          <ExhibitionCreateDialog onClose={() => setShowCreateDialog(false)} onCreate={createExhibition} />
        )}

        <WelcomeTour
          userId={user.id}
          open={showTour}
          onClose={() => setShowTour(false)}
          onStartCreating={openCreate}
        />

        {createError && (
          <div className="editor-error-banner" role="alert">
            <span>{createError}</span>
            <button type="button" aria-label={t("common", "dismiss")} onClick={() => setCreateError(null)}>
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
