"use client";

import AdminThemeToggle from "@/components/admin-theme-toggle";

// Standalone shell for the Admin area (CRM): ONE single page, no SANAA app
// sidebar and no SANAA navigation at all. Only a minimal top bar: the
// SANAA Admin title, the light/dark theme toggle, and sign out. Every admin
// page is server-rendered and already checked the user is the owner before
// rendering, so this shell trusts its props.
export default function AdminShell({
  user,
  title,
  eyebrow,
  description,
  children,
}: {
  user: { id: string; name: string; email: string };
  title: string;
  eyebrow: string;
  description: string;
  children: React.ReactNode;
}) {
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <div className="ad-root">
      <header className="ad-topbar">
        <div className="ad-topbar-brand">
          <span className="ad-topbar-mark">s.</span>
          <span className="ad-topbar-name">SANAA Admin</span>
        </div>
        <div className="ad-topbar-right">
          <span className="ad-topbar-user">{user.name}</span>
          <AdminThemeToggle />
          <button type="button" className="ad-topbar-signout" onClick={signOut}>
            Sign out
          </button>
        </div>
      </header>
      <main className="ad-main">
        <div className="ad-container">
          <div className="ad-hero">
            <span className="ad-eyebrow">{eyebrow}</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
          <nav className="ad-anchor-nav" aria-label="Admin sections">
            <a href="#overview">Overview</a>
            <a href="#users">Users</a>
            <a href="#exhibitions">Exhibitions</a>
            <a href="#artworks">Artworks</a>
          </nav>
          {children}
        </div>
      </main>
    </div>
  );
}
