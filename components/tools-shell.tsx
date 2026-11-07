"use client";

import type { ReactNode } from "react";
import Sidebar from "@/components/sidebar";
import ThemeToggle from "@/components/theme-toggle";
import { useT, type DictionarySection } from "@/lib/i18n";

// Shared shell for every Tools page: the workspace sidebar (Tools active)
// and the topbar, then a page header and the tool itself. Keeps the nine
// tool pages from each repeating the same layout. Title, eyebrow and
// description are dictionary keys (lib/i18n.ts, section "toolpages") so
// every tool page switches language; the four pages with a live count in
// the eyebrow (inventory, marketplace, present-sell, teams) pass their
// eyebrow as a plain string instead (eyebrowOverride).
export default function ToolsShell({
  user,
  exhibitionCount,
  title,
  eyebrow,
  description,
  eyebrowOverride,
  children,
}: {
  user: { id: string; name: string; email: string; avatarUrl?: string | null; isAdmin?: boolean };
  exhibitionCount: number;
  title: DictionarySection<"toolpages">;
  eyebrow?: DictionarySection<"toolpages">;
  description: DictionarySection<"toolpages">;
  eyebrowOverride?: string;
  children: ReactNode;
}) {
  const t = useT();
  return (
    <main className="app-shell">
      <Sidebar user={user} active="tools" exhibitionCount={exhibitionCount} />

      <section className="dashboard-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>{t("common", "workspace")}</span>
            <span className="crumb-slash">/</span>
            <strong>{t("tools", "title")}</strong>
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
                <span className="status-dot" /> {eyebrowOverride ?? (eyebrow ? t("toolpages", eyebrow) : "")}
              </p>
              <h1>
                {t("toolpages", title)}
                <span className="title-period">.</span>
              </h1>
              <p className="welcome-copy">{t("toolpages", description)}</p>
            </div>
          </section>
          {children}
        </div>
      </section>
    </main>
  );
}
