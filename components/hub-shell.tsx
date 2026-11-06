import type { ReactNode } from "react";
import Sidebar, { type SidebarActive } from "@/components/sidebar";
import ThemeToggle from "@/components/theme-toggle";

// Shared shell for the seven area hub pages (Discover, Create, Spatial
// Lab, Manage, Publish, Intelligence, My Studio). Same layout, topbar and
// visual language as the Tools shell — only the breadcrumb, the active
// nav group and the heading change.
export default function HubShell({
  user,
  exhibitionCount,
  active,
  hubName,
  title,
  eyebrow,
  description,
  children,
}: {
  user: { id: string; name: string; email: string; isAdmin?: boolean };
  exhibitionCount: number;
  active: SidebarActive;
  hubName: string;
  title: string;
  eyebrow: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="app-shell">
      <Sidebar user={user} active={active} exhibitionCount={exhibitionCount} />

      <section className="dashboard-main">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <span className="crumb-slash">/</span>
            <strong>{hubName}</strong>
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
