"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, Bell, PenLine, Plus, Search, Trash2 } from "lucide-react";
import Sidebar from "@/components/sidebar";
import ThemeToggle from "@/components/theme-toggle";
import styles from "./public-home.module.css";

// Exhibitions: ONLY the signed-in artist's own exhibitions — nothing else.
// Each card links to the editor to keep building, to the public page when
// the exhibition is published, and to delete (with a confirmation).
export type OwnExhibition = {
  id: string;
  title: string;
  slug: string;
  status: "draft" | "public";
  roomCount: number;
  artworkCount: number;
  views: number;
  coverImageUrl: string | null;
  updatedAt: string;
};

export default function ExhibitionsPage({
  user,
  exhibitions: initialExhibitions,
}: {
  user: { id: string; name: string; email: string };
  exhibitions: OwnExhibition[];
}) {
  const [exhibitions, setExhibitions] = useState(initialExhibitions);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  async function createExhibition() {
    setCreating(true);
    try {
      const response = await fetch("/api/exhibitions", { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not create an exhibition.");
      window.location.assign(`/editor/${result.exhibition.id}`);
    } catch (error) {
      console.error("Could not create exhibition.", error);
      window.alert(error instanceof Error ? error.message : "Could not create an exhibition.");
      setCreating(false);
    }
  }

  async function deleteExhibition(exhibition: OwnExhibition) {
    if (!window.confirm(`Delete "${exhibition.title}"? This cannot be undone.`)) return;
    setDeletingId(exhibition.id);
    try {
      const response = await fetch(`/api/exhibitions/${exhibition.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? "Could not delete this exhibition.");
      setExhibitions((current) => current.filter((item) => item.id !== exhibition.id));
    } catch (error) {
      console.error("Could not delete exhibition.", error);
      window.alert(error instanceof Error ? error.message : "Could not delete this exhibition.");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="app-shell">
      <Sidebar user={user} active="exhibitions" exhibitionCount={exhibitions.length} />

      <section className="dashboard-main">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>Exhibitions</strong></div>
          <div className="topbar-actions">
            <ThemeToggle />
            <button className="icon-button" aria-label="Search"><Search size={17} /></button>
            <button className="icon-button notification-button" aria-label="Notifications"><Bell size={17} /><i /></button>
            <span className="topbar-divider" />
            <button className="help-button">Need a hand? <ArrowUpRight size={14} /></button>
          </div>
        </header>

        <div className="dashboard-content">
          <section className="welcome-row">
            <div>
              <p className="eyebrow"><span className="status-dot" /> YOUR EXHIBITIONS · {exhibitions.length}</p>
              <h1>Your exhibitions<span className="title-period">.</span></h1>
              <p className="welcome-copy">Everything you are building — drafts and published rooms, in one place.</p>
            </div>
            <button className="primary-button" onClick={createExhibition} disabled={creating}>
              <Plus size={17} /> {creating ? "Creating…" : "Create a new exhibition"}
            </button>
          </section>

          <section className="galleries-grid" id="exhibitions">
            {exhibitions.length === 0 ? (
              <div className={styles.emptyState}>
                <strong>No exhibitions yet.</strong>
                <p>Your first room starts here — pick a gallery, hang your work, publish it.</p>
                <button onClick={createExhibition} className="galleries-open-button" disabled={creating}>
                  Create a new exhibition <ArrowRight size={15} />
                </button>
              </div>
            ) : (
              exhibitions.map((exhibition) => (
                <article key={exhibition.id} className={`gallery-card ${styles.card}`}>
                  <Link
                    href={`/editor/${exhibition.id}`}
                    className={styles.coverLink}
                    aria-label={`Continue building ${exhibition.title}`}
                  >
                    {exhibition.coverImageUrl ? (
                      <img
                        src={exhibition.coverImageUrl}
                        alt={exhibition.title}
                        className={styles.cover}
                        loading="lazy"
                      />
                    ) : (
                      <span className={styles.coverFallback}>SANAA</span>
                    )}
                  </Link>
                  <div className="gallery-card-body">
                    <h3>
                      <Link href={`/editor/${exhibition.id}`}>{exhibition.title}</Link>
                    </h3>
                    <p>{exhibition.status === "public" ? "Published" : "Draft"}</p>
                    <p className="gallery-card-finishes">
                      {exhibition.roomCount} {exhibition.roomCount === 1 ? "room" : "rooms"} ·{" "}
                      {exhibition.artworkCount} {exhibition.artworkCount === 1 ? "artwork" : "artworks"} ·{" "}
                      {exhibition.views} {exhibition.views === 1 ? "visit" : "visits"}
                    </p>
                    <div className="gallery-card-actions">
                      <Link href={`/editor/${exhibition.id}`} className="galleries-open-button">
                        <PenLine size={14} /> Continue building
                      </Link>
                      {exhibition.status === "public" && (
                        <Link href={`/exhibition/${exhibition.slug}`} className="galleries-open-button">
                          Visit <ArrowUpRight size={14} />
                        </Link>
                      )}
                      <button
                        onClick={() => void deleteExhibition(exhibition)}
                        disabled={deletingId === exhibition.id}
                        aria-label={`Delete ${exhibition.title}`}
                      >
                        <Trash2 size={14} /> {deletingId === exhibition.id ? "Deleting…" : "Delete"}
                      </button>
                    </div>
                  </div>
                </article>
              ))
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
