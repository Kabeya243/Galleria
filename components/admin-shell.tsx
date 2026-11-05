"use client";

import Link from "next/link";
import Sidebar from "@/components/sidebar";

// Shared shell for the admin area (CRM): the app sidebar with the Admin
// section active, a header, and a small sub-navigation between the admin
// pages. Every admin page is server-rendered and already checked the user
// is the owner before rendering, so this shell trusts its props.
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
  return (
    <div className="app-shell">
      <Sidebar user={user} active="admin" exhibitionCount={0} />
      <main className="dashboard-main">
        <div className="dashboard-content">
          <div className="welcome-row">
            <div>
              <span className="eyebrow">{eyebrow}</span>
              <h1>{title}</h1>
              <p className="welcome-copy">{description}</p>
            </div>
          </div>
          <nav className="admin-nav" aria-label="Admin sections">
            <Link href="/admin">Overview</Link>
            <Link href="/admin/users">Users</Link>
            <Link href="/admin/exhibitions">Exhibitions</Link>
            <Link href="/admin/artworks">Artworks</Link>
          </nav>
          {children}
        </div>
      </main>
    </div>
  );
}
