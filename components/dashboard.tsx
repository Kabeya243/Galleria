"use client";

import Link from "next/link";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  ChevronDown,
  CircleHelp,
  Compass,
  GalleryVerticalEnd,
  Grid2X2,
  Image,
  Plus,
  Search,
  Settings2,
  Sparkles,
} from "lucide-react";
import { useState } from "react";

type DashboardExhibition = {
  id: string;
  title: string;
  slug: string;
  status: string;
  views: number;
  artworkCount: number;
};

type DashboardArtwork = {
  id: string;
  title: string;
  artist: string;
  year: string;
  color: string;
  accent: string;
  imageUrl: string | null;
};

export default function Dashboard({
  user,
  exhibitions,
  artworks,
  artworkCount,
  viewCount,
}: {
  user: { name: string; email: string };
  exhibitions: DashboardExhibition[];
  artworks: DashboardArtwork[];
  artworkCount: number;
  viewCount: number;
}) {
  const [creating, setCreating] = useState(false);
  const featured = exhibitions[0];

  async function createExhibition() {
    setCreating(true);
    try {
      const response = await fetch("/api/exhibitions", { method: "POST" });
      if (response.status === 401) {
        window.location.assign("/login");
        return;
      }
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not create an exhibition.");
      window.location.assign(`/editor/${result.exhibition.id}`);
    } catch (error) {
      console.error("Could not create exhibition.", error);
      window.alert(error instanceof Error ? error.message : "Could not create an exhibition.");
      setCreating(false);
    }
  }

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  return (
    <main className="app-shell">
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
          <Link className="nav-item active" href="/">
            <Grid2X2 size={17} /> Overview
          </Link>
          <Link className="nav-item" href="/editor">
            <GalleryVerticalEnd size={17} /> Exhibitions
            <span className="nav-count">{exhibitions.length}</span>
          </Link>
          <a className="nav-item" href="#artworks">
            <Image size={17} /> Artworks
          </a>
          <a className="nav-item" href="#library">
            <Compass size={17} /> Explore
          </a>
        </nav>

        <div className="sidebar-spacer" />
        <div className="sidebar-bottom">
          <a className="nav-item" href="#help"><CircleHelp size={17} /> Help center</a>
          <a className="nav-item" href="#settings"><Settings2 size={17} /> Settings</a>
          <div className="profile-chip">
            <div className="profile-avatar">{user.name.slice(0, 2).toUpperCase()}</div>
            <div className="profile-copy"><strong>{user.name}</strong><span>{user.email}</span></div>
            <button className="sign-out-button" onClick={signOut}>Sign out</button>
          </div>
        </div>
      </aside>

      <section className="dashboard-main">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>Overview</strong></div>
          <div className="topbar-actions">
            <button className="icon-button" aria-label="Search"><Search size={17} /></button>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={17} /><i /></button>
            <span className="topbar-divider" />
            <button className="help-button">Need a hand? <ArrowUpRight size={14} /></button>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow"><span className="status-dot" /> YOUR CREATIVE SPACE</p>
              <h1>Welcome, {user.name}<span className="title-period">.</span></h1>
              <p className="welcome-copy">A little space to bring your next big idea to life.</p>
            </div>
            <button className="primary-button" onClick={createExhibition} disabled={creating}><Plus size={17} /> {creating ? "Creating…" : "Create an exhibition"}</button>
          </section>

          <section className="featured-exhibition">
            <div className="featured-copy">
              <div className="featured-kicker"><span className="live-dot" /> {featured?.status === "public" ? "PUBLISHED EXHIBITION" : "YOUR SPACE, IN PROGRESS"}</div>
              <h2>{featured ? <>{featured.title}</> : <>Every room holds<br />a new perspective.</>}</h2>
              <p>{featured ? `${featured.artworkCount} artworks · ${featured.views} visitors. Keep curating your room and make it your own.` : "Shape a space around your work. Place your art, find your rhythm, and invite the world in."}</p>
              <div className="featured-actions">
                {featured
                  ? <Link href={`/editor/${featured.id}`} className="light-button">Continue building <ArrowRight size={15} /></Link>
                  : <button onClick={createExhibition} className="light-button">Create your first exhibition <ArrowRight size={15} /></button>}
                {featured?.status === "public" && <Link href={`/exhibition/${featured.slug}`} className="text-button">Visit exhibition <ArrowUpRight size={14} /></Link>}
              </div>
              <div className="featured-meta"><span><i className="meta-dot" /> {featured?.status === "public" ? "Published" : "Draft"}</span><span>·</span><span>{featured ? `${featured.artworkCount} artworks` : "Your first exhibition starts here"}</span></div>
            </div>
            <button onClick={() => featured ? window.location.assign(`/editor/${featured.id}`) : void createExhibition()} className="featured-visual" aria-label="Open exhibition editor">
              <div className="visual-orbit orbit-one" /><div className="visual-orbit orbit-two" />
              <div className="visual-sun" />
              <div className="visual-frame frame-left"><div className="mini-art mini-one" /></div>
              <div className="visual-frame frame-center"><div className="mini-art mini-two" /></div>
              <div className="visual-frame frame-right"><div className="mini-art mini-three" /></div>
              <span className="visual-room-tag">ROOM 01 — THE BEGINNING</span>
              <span className="visual-open"><ArrowUpRight size={16} /></span>
            </button>
          </section>

          <section className="stats-row" aria-label="Workspace statistics">
            <article className="stat-card">
              <div className="stat-label">Exhibitions <span className="stat-icon"><GalleryVerticalEnd size={15} /></span></div>
              <div className="stat-value">{String(exhibitions.length).padStart(2, "0")} <span className="stat-trend"><ArrowUpRight size={13} /> Your spaces</span></div>
              <div className="stat-foot"><span className="stat-bar"><i style={{ width: exhibitions.length ? "43%" : "0%" }} /></span><span>{exhibitions.filter((exhibition) => exhibition.status === "public").length} published</span></div>
            </article>
            <article className="stat-card">
              <div className="stat-label">Artworks <span className="stat-icon"><Image size={15} /></span></div>
              <div className="stat-value">{String(artworkCount).padStart(2, "0")} <span className="stat-trend"><ArrowUpRight size={13} /> Your collection</span></div>
              <div className="stat-foot"><span className="stat-bar"><i style={{ width: artworkCount ? "68%" : "0%" }} /></span><span>Across your exhibitions</span></div>
            </article>
            <article className="stat-card">
              <div className="stat-label">Visitors <span className="stat-icon"><Compass size={15} /></span></div>
              <div className="stat-value">{viewCount} <span className="stat-trend"><ArrowUpRight size={13} /> All time</span></div>
              <div className="stat-foot"><span className="stat-bar"><i style={{ width: viewCount ? "76%" : "0%" }} /></span><span>Exhibition visits</span></div>
            </article>
          </section>

          <section className="artworks-section" id="artworks">
            <div className="section-heading">
              <div><p className="eyebrow">YOUR COLLECTION</p><h2>Recently added <span className="section-counter">{artworkCount}</span></h2></div>
              <button onClick={createExhibition} className="view-all">Create an exhibition <ArrowRight size={14} /></button>
            </div>
            <div className="artwork-grid">
              {artworks.map((artwork) => (
                <article className="artwork-card" key={artwork.id}>
                  <div className="artwork-image" style={{ backgroundColor: `${artwork.color}22` }}>
                    <div className="artwork-image-inner" style={artwork.imageUrl ? { backgroundImage: `url(${artwork.imageUrl})`, backgroundPosition: "center", backgroundSize: "cover" } : undefined}>{!artwork.imageUrl && <><span /><i /><b /></>}</div>
                    <button className="artwork-open" aria-label={`Open ${artwork.title}`}><ArrowUpRight size={15} /></button>
                  </div>
                  <div className="artwork-details"><div><h3>{artwork.title}</h3><p>{artwork.artist}</p></div><span className="artwork-year">{artwork.year}</span></div>
                </article>
              ))}
              <button onClick={createExhibition} className="add-artwork-card">
                <span className="add-artwork-icon"><Plus size={19} /></span>
                <strong>Add an artwork</strong>
                <span>Grow your collection</span>
              </button>
            </div>
          </section>

          <section className="bottom-note" id="library">
            <div className="note-icon"><Sparkles size={16} /></div>
            <div><strong>Made for the way you see.</strong><span>Your gallery is a work in progress. Take your time with it.</span></div>
            <span className="note-arrow"><ArrowDownRight size={17} /></span>
          </section>
          <footer className="dashboard-footer"><span>© 2026 SANAA Studio</span><span>Made for art, made for everyone.</span><span className="demo-label">YOUR WORKSPACE</span></footer>
        </div>
      </section>
    </main>
  );
}
