"use client";

import Link from "next/link";
import {
  ChevronDown,
  CircleHelp,
  Compass,
  GalleryVerticalEnd,
  Grid2X2,
  Image,
  Settings2,
} from "lucide-react";

export default function Sidebar({
  user,
  active,
  exhibitionCount,
}: {
  user: { name: string; email: string };
  active: "overview" | "settings";
  exhibitionCount: number;
}) {
  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <aside className="sidebar">
      <Link className="brand-lockup" href="/" aria-label="SANAA home">
        <span className="brand-mark">s.</span>
        <span className="brand-name">SANAA</span>
      </Link>

      <div className="workspace-switcher">
        <div className="workspace-avatar">S</div>
        <div className="workspace-copy">
          <span>Workspace</span>
          <strong>{user.name}</strong>
        </div>
        <ChevronDown size={15} />
      </div>

      <div className="nav-section-label">Workspace</div>
      <nav className="side-nav" aria-label="Main navigation">
        <Link className={active === "overview" ? "nav-item active" : "nav-item"} href="/">
          <Grid2X2 size={17} /> Overview
        </Link>
        <Link className="nav-item" href="/editor">
          <GalleryVerticalEnd size={17} /> Exhibitions
          <span className="nav-count">{exhibitionCount}</span>
        </Link>
        <a className="nav-item" href="/#artworks">
          <Image size={17} /> Artworks
        </a>
        <a className="nav-item" href="/#library">
          <Compass size={17} /> Explore
        </a>
      </nav>

      <div className="sidebar-spacer" />
      <div className="sidebar-bottom">
        <a className="nav-item" href="#help">
          <CircleHelp size={17} /> Help center
        </a>
        <Link className={active === "settings" ? "nav-item active" : "nav-item"} href="/settings">
          <Settings2 size={17} /> Settings
        </Link>
        <div className="profile-chip">
          <div className="profile-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
          <div className="profile-copy">
            <strong>{user.name}</strong>
            <span>{user.email}</span>
          </div>
          <button className="sign-out-button" onClick={signOut}>
            Sign out
          </button>
        </div>
      </div>
    </aside>
  );
}
