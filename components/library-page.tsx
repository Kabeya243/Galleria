"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { Check, Plus, Search, Trash2 } from "lucide-react";
import Sidebar from "@/components/sidebar";
import ThemeToggle from "@/components/theme-toggle";
import { useT } from "@/lib/i18n";
import type { LibraryWorkItem } from "@/lib/library";
import {
  DirectUploadFailedError,
  DirectUploadNotConfiguredError,
  uploadFileToR2,
} from "@/lib/direct-upload";
import styles from "./public-home.module.css";

// "Mes œuvres" — the artist's reusable artwork library: every work
// they have ever uploaded, all exhibitions together. From here a work
// can be added to any exhibition (a COPY with the same image — never
// a re-upload) or deleted outright (two-step confirm: that delete
// removes the library row AND every copy hanging in their
// exhibitions, so the library read cannot backfill it straight back).
// Deleting a single copy from an exhibition is a different act and
// lives in the editor / DELETE /api/artworks/[id]: it only ever
// removes that copy.
export default function LibraryPage({
  user,
  works: initialWorks,
  exhibitions,
}: {
  user: { id: string; name: string; email: string; isAdmin?: boolean };
  works: LibraryWorkItem[];
  exhibitions: { id: string; title: string }[];
}) {
  const t = useT();
  const [works, setWorks] = useState(initialWorks);
  const [query, setQuery] = useState("");
  const [pageError, setPageError] = useState<string | null>(null);
  const [reuseTarget, setReuseTarget] = useState<Record<string, string>>({});
  const [addingId, setAddingId] = useState<string | null>(null);
  const [addedNote, setAddedNote] = useState<{ workId: string; exhibitionTitle: string } | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  // Two-step inline confirm for deleting a work from the library
  // (same pattern as the exhibitions page): first click arms, second
  // confirms, and the armed state clears after a few seconds.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  // Add artwork straight into the library (Nov 2026): the work is
  // uploaded once here and is then available everywhere that reads
  // the library — editor, certificates, PDF editor.
  const [showAddForm, setShowAddForm] = useState(false);
  const [addFile, setAddFile] = useState<File | null>(null);
  const [addTitle, setAddTitle] = useState("");
  const [addArtist, setAddArtist] = useState(user.name);
  const [addYear, setAddYear] = useState(String(new Date().getFullYear()));
  const [addMedium, setAddMedium] = useState("");
  const [addDimensions, setAddDimensions] = useState("");
  const [addDescription, setAddDescription] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addProgress, setAddProgress] = useState<number | null>(null);
  const [addError, setAddError] = useState<string | null>(null);
  const [addSuccess, setAddSuccess] = useState(false);
  const addFileRef = useRef<HTMLInputElement | null>(null);

  async function addArtwork(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (addBusy) return;
    const title = addTitle.trim();
    if (!title) {
      setAddError(t("library", "artworkTitlePlaceholder"));
      return;
    }
    if (!addFile) {
      setAddError(t("library", "chooseImageFirst"));
      return;
    }
    setAddBusy(true);
    setAddError(null);
    setAddSuccess(false);
    try {
      const proxyUpload = async (): Promise<string> => {
        const body = new FormData();
        body.set("file", addFile);
        const response = await fetch("/api/uploads/r2", { method: "POST", body });
        const text = await response.text();
        let result: { error?: string; url?: string } = {};
        try {
          result = text ? (JSON.parse(text) as typeof result) : {};
        } catch {
          result = {};
        }
        if (!response.ok) throw new Error(result.error ?? t("library", "couldNotUpload"));
        if (!result.url) throw new Error(t("library", "couldNotUpload"));
        return result.url;
      };
      const imageUrl = await uploadFileToR2(addFile, "image", proxyUpload, setAddProgress);
      const res = await fetch("/api/library", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          artist: addArtist.trim(),
          year: addYear.trim(),
          medium: addMedium.trim(),
          dimensions: addDimensions.trim(),
          description: addDescription.trim(),
          imageUrl,
        }),
      });
      const json = (await res.json()) as { work?: LibraryWorkItem; error?: string };
      if (!res.ok) throw new Error(json.error ?? t("library", "couldNotSaveArtwork"));
      if (json.work) setWorks((current) => [json.work as LibraryWorkItem, ...current]);
      setAddFile(null);
      setAddTitle("");
      setAddMedium("");
      setAddDimensions("");
      setAddDescription("");
      if (addFileRef.current) addFileRef.current.value = "";
      setAddSuccess(true);
      window.setTimeout(() => setAddSuccess(false), 6000);
    } catch (error) {
      if (error instanceof DirectUploadNotConfiguredError) {
        setAddError(t("library", "couldNotUpload"));
      } else if (error instanceof DirectUploadFailedError) {
        setAddError(t("library", "couldNotUpload"));
      } else {
        setAddError(error instanceof Error ? error.message : t("library", "couldNotSaveArtwork"));
      }
    } finally {
      setAddBusy(false);
      setAddProgress(null);
    }
  }

  const visibleWorks = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return works;
    return works.filter((work) =>
      [work.title, work.artist, work.year, work.medium].some((field) => field.toLowerCase().includes(needle)),
    );
  }, [works, query]);

  async function reuseWork(work: LibraryWorkItem) {
    const exhibitionId = reuseTarget[work.id];
    const exhibition = exhibitions.find((item) => item.id === exhibitionId);
    if (!exhibition) {
      setPageError(t("library", "chooseExhibition"));
      return;
    }
    setAddingId(work.id);
    setPageError(null);
    try {
      const response = await fetch(`/api/library/${work.id}/reuse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ exhibitionId }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? t("library", "couldNotAdd"));
      setAddedNote({ workId: work.id, exhibitionTitle: exhibition.title });
      window.setTimeout(
        () => setAddedNote((current) => (current?.workId === work.id ? null : current)),
        6000,
      );
      // The work now hangs in one more exhibition: refresh its count
      // locally instead of refetching the whole library.
      setWorks((current) =>
        current.map((item) =>
          item.id === work.id && !item.exhibitionIds.includes(exhibitionId)
            ? { ...item, exhibitionIds: [...item.exhibitionIds, exhibitionId] }
            : item,
        ),
      );
    } catch (error) {
      console.error("Could not reuse artwork.", error);
      setPageError(error instanceof Error ? error.message : t("library", "couldNotAdd"));
    } finally {
      setAddingId(null);
    }
  }

  async function deleteWork(work: LibraryWorkItem) {
    if (confirmingDeleteId !== work.id) {
      setConfirmingDeleteId(work.id);
      window.setTimeout(() => setConfirmingDeleteId((current) => (current === work.id ? null : current)), 10000);
      return;
    }
    setConfirmingDeleteId(null);
    setDeletingId(work.id);
    setPageError(null);
    try {
      const response = await fetch(`/api/library/${work.id}`, { method: "DELETE" });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? t("library", "couldNotDelete"));
      setWorks((current) => current.filter((item) => item.id !== work.id));
    } catch (error) {
      console.error("Could not delete artwork from library.", error);
      setPageError(error instanceof Error ? error.message : t("library", "couldNotDelete"));
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <main className="app-shell">
      <Sidebar user={user} active="artworks" exhibitionCount={exhibitions.length} />

      <section className="dashboard-main">
        <header className="topbar">
          <div className="breadcrumbs"><span>{t("common", "workspace")}</span><span className="crumb-slash">/</span><strong>{t("library", "library")}</strong></div>
          <div className="topbar-actions">
            <ThemeToggle />
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
              <p className="eyebrow"><span className="status-dot" /> {t("library", "yourLibrary")} {works.length}</p>
              <h1>{t("library", "title")}<span className="title-period">.</span></h1>
              <p className="welcome-copy">{t("library", "copy")}</p>
            </div>
            <label className="library-search">
              <Search size={15} />
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t("library", "searchPlaceholder")}
                aria-label={t("library", "searchAria")}
              />
            </label>
            <button
              type="button"
              className="primary-button"
              onClick={() => setShowAddForm((current) => !current)}
              aria-expanded={showAddForm}
            >
              <Plus size={14} /> {t("library", "addArtwork")}
            </button>
          </section>

          {showAddForm && (
            <section className="library-add-form" aria-label={t("library", "addArtwork")}>
              <p>{t("library", "addArtworkCopy")}</p>
              <form onSubmit={addArtwork}>
                <label>
                  <span>{t("library", "artworkImage")}</span>
                  <input
                    ref={addFileRef}
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/svg+xml,.jpg,.jpeg,.png,.webp,.svg"
                    onChange={(event) => setAddFile(event.target.files?.[0] ?? null)}
                    required
                  />
                  {addFile && <small>{addFile.name}</small>}
                </label>
                <label>
                  <span>{t("library", "artworkTitle")}</span>
                  <input
                    value={addTitle}
                    onChange={(event) => setAddTitle(event.target.value)}
                    placeholder={t("library", "artworkTitlePlaceholder")}
                    required
                  />
                </label>
                <label>
                  <span>{t("library", "artworkArtist")}</span>
                  <input value={addArtist} onChange={(event) => setAddArtist(event.target.value)} />
                </label>
                <label>
                  <span>{t("library", "artworkYear")}</span>
                  <input value={addYear} onChange={(event) => setAddYear(event.target.value)} />
                </label>
                <label>
                  <span>{t("library", "artworkMedium")}</span>
                  <input value={addMedium} onChange={(event) => setAddMedium(event.target.value)} />
                </label>
                <label>
                  <span>{t("library", "artworkDimensions")}</span>
                  <input value={addDimensions} onChange={(event) => setAddDimensions(event.target.value)} placeholder="80 × 100 cm" />
                </label>
                <label>
                  <span>{t("library", "artworkDescription")}</span>
                  <input value={addDescription} onChange={(event) => setAddDescription(event.target.value)} />
                </label>
                <button type="submit" className="primary-button" disabled={addBusy}>
                  {addBusy
                    ? addProgress != null
                      ? `${t("library", "uploading")} ${addProgress}%`
                      : t("library", "savingArtwork")
                    : t("library", "addArtwork")}
                </button>
              </form>
              {addError && (
                <p role="alert" className="asset-upload-error">
                  {addError}
                </p>
              )}
              {addSuccess && (
                <p role="status" className="library-added-note">
                  <Check size={13} /> {t("library", "artworkAdded")}
                </p>
              )}
            </section>
          )}

          <section className="galleries-grid" id="artworks">
            {works.length === 0 ? (
              <div className={styles.emptyState}>
                <strong>{t("library", "noWorks")}</strong>
                <p>{t("library", "noWorksDesc")}</p>
              </div>
            ) : visibleWorks.length === 0 ? (
              <div className={styles.emptyState}>
                <strong>{t("library", "noMatch")}</strong>
              </div>
            ) : (
              visibleWorks.map((work) => (
                <article key={work.id} className={`gallery-card ${styles.card}`}>
                  <span className={styles.coverLink} aria-label={work.title}>
                    {work.videoUrl ? (
                      <video
                        src={work.videoUrl}
                        muted
                        loop
                        playsInline
                        preload="metadata"
                        className={styles.cover}
                      />
                    ) : work.imageUrl ? (
                      <img
                        src={work.imageUrl}
                        alt={work.altText ?? work.title}
                        className={styles.cover}
                        loading="lazy"
                      />
                    ) : work.sculptureUrl ? (
                      <span
                        className={styles.cover}
                        style={{ background: `linear-gradient(135deg, #b8a184, #343e36)`, display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, letterSpacing: "0.2em" }}
                        role="img"
                        aria-label={work.title}
                      >
                        3D
                      </span>
                    ) : null}
                  </span>
                  <div className="gallery-card-body">
                    <h3>{work.title}</h3>
                    <p>
                      {[work.year, work.medium].filter(Boolean).join(" · ") || work.artist}
                    </p>
                    <p className="gallery-card-finishes">
                      {work.exhibitionIds.length === 0
                        ? t("library", "notInExhibition")
                        : `${t("library", "inExhibitions")} ${work.exhibitionIds.length} ${work.exhibitionIds.length === 1 ? t("library", "exhibition") : t("library", "exhibitions")}`}
                    </p>
                    {confirmingDeleteId === work.id && (
                      <p className="asset-upload-error" role="alert">{t("library", "deleteWarning")}</p>
                    )}
                    {addedNote?.workId === work.id && (
                      <p className="library-added-note" role="status">
                        <Check size={13} /> {t("library", "addedTo")} {addedNote.exhibitionTitle}
                      </p>
                    )}
                    <div className="gallery-card-actions library-card-actions">
                      <select
                        className="library-exhibition-select"
                        value={reuseTarget[work.id] ?? ""}
                        onChange={(event) => setReuseTarget((current) => ({ ...current, [work.id]: event.target.value }))}
                        aria-label={t("library", "chooseExhibition")}
                      >
                        <option value="">{t("library", "chooseExhibition")}</option>
                        {exhibitions.map((exhibition) => (
                          <option key={exhibition.id} value={exhibition.id}>{exhibition.title}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => void reuseWork(work)}
                        disabled={addingId === work.id || !reuseTarget[work.id]}
                        className="galleries-open-button"
                      >
                        <Plus size={14} /> {addingId === work.id ? t("library", "adding") : t("library", "addToExhibition")}
                      </button>
                      <button
                        onClick={() => void deleteWork(work)}
                        disabled={deletingId === work.id}
                        aria-label={confirmingDeleteId === work.id ? `${t("library", "clickAgainDelete")}, ${work.title}` : `${t("library", "delete")}, ${work.title}`}
                      >
                        <Trash2 size={14} /> {deletingId === work.id ? t("library", "deleting") : confirmingDeleteId === work.id ? t("library", "clickAgainDelete") : t("library", "delete")}
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
