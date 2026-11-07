"use client";

import type { ReactNode } from "react";
import Sidebar, { type SidebarActive } from "@/components/sidebar";
import ThemeToggle from "@/components/theme-toggle";
import { useT, type DictionarySection } from "@/lib/i18n";

// Shared shell for the seven area hub pages (Discover, Create, Spatial
// Lab, Manage, Publish, Intelligence, My Studio). Same layout, topbar and
// visual language as the Tools shell — only the breadcrumb, the active
// nav group and the heading change. The hub name comes from the nav
// dictionary and the description from the hubs dictionary, so the whole
// shell switches language; the eyebrow is the hub name in capitals.
export default function HubShell({
  user,
  exhibitionCount,
  active,
  hubName,
  description,
  children,
}: {
  user: { id: string; name: string; email: string; isAdmin?: boolean };
  exhibitionCount: number;
  active: SidebarActive;
  hubName: DictionarySection<"nav">;
  description: DictionarySection<"hubs">;
  children: ReactNode;
}) {
  const t = useT();
  const hubTitle = t("nav", hubName);
  return (
    <main className="app-shell">
      <Sidebar user={user} active={active} exhibitionCount={exhibitionCount} />

      <section className="dashboard-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>{t("common", "workspace")}</span>
            <span className="crumb-slash">/</span>
            <strong>{hubTitle}</strong>
          </div>
          <div className="topbar-actions">
            <ThemeToggle />
            {/* Phase 8: the Search / Notifications / Help buttons were
                dead — no handler, no backend — so they were removed.
                The working exhibition search is on the dashboard. */}
          </div>
        </header>

        <div className="dashboard-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow">
                <span className="status-dot" /> {hubTitle.toUpperCase()}
              </p>
              <h1>
                {hubTitle}
                <span className="title-period">.</span>
              </h1>
              <p className="welcome-copy">{t("hubs", description)}</p>
            </div>
          </section>
          {children}
        </div>
      </section>
    </main>
  );
}
