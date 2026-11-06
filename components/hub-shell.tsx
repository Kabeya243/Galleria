import type { ReactNode } from "react";
import { ArrowUpRight, Bell, Search } from "lucide-react";
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
            <button className="icon-button" aria-label="Search">
              <Search size={17} />
            </button>
            <button className="icon-button notification-button" aria-label="Notifications">
              <Bell size={17} />
              <i />
            </button>
            <span className="topbar-divider" />
            <button className="help-button">
              Need a hand? <ArrowUpRight size={14} />
            </button>
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
