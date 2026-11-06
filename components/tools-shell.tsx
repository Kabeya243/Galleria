import type { ReactNode } from "react";
import Sidebar from "@/components/sidebar";
import ThemeToggle from "@/components/theme-toggle";

// Shared shell for every Tools page: the workspace sidebar (Tools active)
// and the topbar, then a page header and the tool itself. Keeps the nine
// tool pages from each repeating the same layout.
export default function ToolsShell({
  user,
  exhibitionCount,
  title,
  eyebrow,
  description,
  children,
}: {
  user: { id: string; name: string; email: string; isAdmin?: boolean };
  exhibitionCount: number;
  title: string;
  eyebrow: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="app-shell">
      <Sidebar user={user} active="tools" exhibitionCount={exhibitionCount} />

      <section className="dashboard-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span className="crumb-slash">/</span>
            <strong>Tools</strong>
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
                <span className="status-dot" /> {eyebrow}
              </p>
              <h1>
                {title}
                <span className="title-period">.</span>
              </h1>
              <p className="welcome-copy">{description}</p>
            </div>
          </section>
          {children}
        </div>
      </section>
    </main>
  );
}
