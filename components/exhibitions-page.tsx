"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, PenLine, Plus, Trash2 } from "lucide-react";
import Sidebar from "@/components/sidebar";
import ExhibitionCreateDialog from "@/components/exhibition-create-dialog";
import ThemeToggle from "@/components/theme-toggle";
import { useT } from "@/lib/i18n";
import type { RoomModelId } from "@/lib/rooms";
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
  user: { id: string; name: string; email: string; isAdmin?: boolean };
  exhibitions: OwnExhibition[];
}) {
  const t = useT();
  const [exhibitions, setExhibitions] = useState(initialExhibitions);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  // Two-step inline confirm for deleting an exhibition (same pattern as
  // the editor's remove-room): first click arms, second confirms, and the
  // armed state clears after a few seconds.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  // Feature 7: the title is mandatory and a room model is picked in the
  // dialog — the POST no longer creates an "Untitled exhibition".
  async function createExhibition(title: string, model: RoomModelId) {
    setCreating(true);
    setPageError(null);
    try {
      const response = await fetch("/api/exhibitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, model }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? t("exhibitions", "couldNotCreate"));
      window.location.assign(`/editor/${result.exhibition.id}`);
    } catch (error) {
      console.error("Could not create exhibition.", error);
      setPageError(error instanceof Error ? error.message : t("exhibitions", "couldNotCreate"));
      setCreating(false);
      throw error;
    }
  }

  async function deleteExhibition(exhibition: OwnExhibition) {
    if (confirmingDeleteId !== exhibition.id) {
      setConfirmingDeleteId(exhibition.id);
      window.setTimeout(() => setConfirmingDeleteId((current) => (current === exhibition.id ? null : current)), 10000);
      return;
    }
    setConfirmingDeleteId(null);
    setDeletingId(exhibition.id);
    try {
      const response = await fetch(`/api/exhibitions/${exhibition.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? t("exhibitions", "couldNotDelete"));
      setExhibitions((current) => current.filter((item) => item.id !== exhibition.id));
    } catch (error) {
      console.error("Could not delete exhibition.", error);
      setPageError(error instanceof Error ? error.message : t("exhibitions", "couldNotDelete"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="app-shell">
      <Sidebar user={user} active="exhibitions" exhibitionCount={exhibitions.length} />

      <section className="dashboard-main">
        <header className="topbar">
          <div className="breadcrumbs"><span>{t("common", "workspace")}</span><span className="crumb-slash">/</span><strong>{t("exhibitions", "exhibitions")}</strong></div>
          <div className="topbar-actions">
            <ThemeToggle />
            {/* Phase 8: the Search / Notifications / Help buttons were
                dead — no handler, no backend — so they were removed.
                The working exhibition search is on the dashboard. */}
          </div>
        </header>

        <div className="dashboard-content">
          {pageError && (
            <div className="editor-error-banner" role="alert">
              <span>{pageError}</span>
              <button type="button" aria-label={t("common", "dismiss")} onClick={() => setPageError(null)}>
                ×
              </button>
            </div>
          )}
          <section className="welcome-row">
            <div>
              <p className="eyebrow"><span className="status-dot" /> {t("exhibitions", "yourExhibitions")} {exhibitions.length}</p>
              <h1>{t("exhibitions", "title")}<span className="title-period">.</span></h1>
              <p className="welcome-copy">{t("exhibitions", "copy")}</p>
            </div>
            <button className="primary-button" onClick={() => setShowCreateDialog(true)} disabled={creating}>
              <Plus size={17} /> {creating ? t("exhibitions", "creating") : t("exhibitions", "createNew")}
            </button>
          </section>

          {showCreateDialog && (
            <ExhibitionCreateDialog
              onClose={() => setShowCreateDialog(false)}
              onCreate={createExhibition}
            />
          )}

          <section className="galleries-grid" id="exhibitions">
            {exhibitions.length === 0 ? (
              <div className={styles.emptyState}>
                <strong>{t("exhibitions", "noExhibitions")}</strong>
                <p>{t("exhibitions", "firstRoom")}</p>
                <button onClick={() => setShowCreateDialog(true)} className="galleries-open-button" disabled={creating}>
                  {t("exhibitions", "createNew")} <ArrowRight size={15} />
                </button>
              </div>
            ) : (
              exhibitions.map((exhibition) => (
                <article key={exhibition.id} className={`gallery-card ${styles.card}`}>
                  <Link
                    href={`/editor/${exhibition.id}`}
                    className={styles.coverLink}
                    aria-label={`${t("exhibitions", "continueBuilding")} — ${exhibition.title}`}
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
                    <p>{exhibition.status === "public" ? t("exhibitions", "published") : t("exhibitions", "draft")}</p>
                    <p className="gallery-card-finishes">
                      {exhibition.roomCount} {exhibition.roomCount === 1 ? t("exhibitions", "room") : t("exhibitions", "rooms")} ·{" "}
                      {exhibition.artworkCount} {exhibition.artworkCount === 1 ? t("exhibitions", "artwork") : t("exhibitions", "artworks")} ·{" "}
                      {exhibition.views} {exhibition.views === 1 ? t("exhibitions", "visitSingular") : t("exhibitions", "visits")}
                    </p>
                    <div className="gallery-card-actions">
                      <Link href={`/editor/${exhibition.id}`} className="galleries-open-button">
                        <PenLine size={14} /> {t("exhibitions", "continueBuilding")}
                      </Link>
                      {exhibition.status === "public" && (
                        <Link href={`/exhibition/${exhibition.slug}`} className="galleries-open-button">
                          {t("exhibitions", "visit")} <ArrowUpRight size={14} />
                        </Link>
                      )}
                      <button
                        onClick={() => void deleteExhibition(exhibition)}
                        disabled={deletingId === exhibition.id}
                        aria-label={confirmingDeleteId === exhibition.id ? `${t("exhibitions", "clickAgainDelete")} — ${exhibition.title}` : `${t("exhibitions", "delete")} — ${exhibition.title}`}
                      >
                        <Trash2 size={14} /> {deletingId === exhibition.id ? t("exhibitions", "deleting") : confirmingDeleteId === exhibition.id ? t("exhibitions", "clickAgainDelete") : t("exhibitions", "delete")}
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
