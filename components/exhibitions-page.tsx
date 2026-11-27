"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowRight, ArrowUpRight, PenLine, Plus, Search, Trash2 } from "lucide-react";
import { requestOpenCreate } from "@/components/redesign-shell";
import { useT } from "@/lib/i18n";
import { coverImageRef, handleCoverImageError } from "@/lib/image-fallback";
import styles from "./redesign-pages.module.css";
import dash from "./redesign-dashboard.module.css";

// Exhibitions (Phase 2, Nov 2026): ONLY the signed-in artist's own
// exhibitions — nothing else. The prototype's filter chips
// (All / Published / Draft) and card grid, on the real data. The
// "Published exhibitions" nav entry lands here with
// ?status=published, pre-filtering to the live rooms. Each card links
// to the editor to keep building, to the public page when published,
// and to delete (with a confirmation). Creation lives in the shared
// shell (the header Create button / the ⌘K palette).

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

type Filter = "all" | "published" | "draft";

export default function ExhibitionsPage({
  exhibitions: initialExhibitions,
  initialStatus = "all",
}: {
  exhibitions: OwnExhibition[];
  initialStatus?: Filter;
}) {
  const t = useT();
  const [exhibitions, setExhibitions] = useState(initialExhibitions);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pageError, setPageError] = useState<string | null>(null);
  // Two-step inline confirm for deleting an exhibition (same pattern as
  // the editor's remove-room): first click arms, second confirms, and the
  // armed state clears after a few seconds.
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  // Local search: only filters the exhibitions on this page, by title —
  // never the rest of the site.
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>(initialStatus);

  const counts = {
    all: exhibitions.length,
    published: exhibitions.filter((item) => item.status === "public").length,
    draft: exhibitions.filter((item) => item.status !== "public").length,
  };

  const needle = query.trim().toLowerCase();
  const visibleExhibitions = exhibitions.filter(
    (exhibition) =>
      (filter === "all" ||
        (filter === "published" ? exhibition.status === "public" : exhibition.status !== "public")) &&
      (needle === "" || exhibition.title.toLowerCase().includes(needle)),
  );

  async function deleteExhibition(exhibition: OwnExhibition) {
    if (confirmingDeleteId !== exhibition.id) {
      setConfirmingDeleteId(exhibition.id);
      window.setTimeout(() => setConfirmingDeleteId((current) => (current === exhibition.id ? null : exhibition.id)), 10000);
      return;
    }
    setConfirmingDeleteId(null);
    setDeletingId(exhibition.id);
    setPageError(null);
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

  const chips: Array<{ id: Filter; label: string; count: number }> = [
    { id: "all", label: t("exhibitions", "filterAll"), count: counts.all },
    { id: "published", label: t("exhibitions", "filterPublished"), count: counts.published },
    { id: "draft", label: t("exhibitions", "filterDraft"), count: counts.draft },
  ];

  // The shell is owned by the shared (app) layout now; this file renders
  // the exhibitions list only. The create buttons open the shell's
  // dialog by dispatching a "lakisa:open-create" event.
  return (
    <>
      <div className={styles.pageHead}>
        <div>
          <h1>{t("exhibitions", "title")}</h1>
          <p className={styles.pageSub}>{t("exhibitions", "copy")}</p>
        </div>
        <div className={styles.pageActions}>
          <button type="button" className={`${styles.btn} ${styles.btnCta}`} onClick={requestOpenCreate}>
            <Plus size={16} /> {t("exhibitions", "createNew")}
          </button>
        </div>
      </div>

      {pageError && (
        <div className="editor-error-banner" role="alert">
          <span>{pageError}</span>
          <button type="button" aria-label={t("common", "dismiss")} onClick={() => setPageError(null)}>
            ×
          </button>
        </div>
      )}

      {exhibitions.length === 0 ? (
        <section className={`${dash.card} ${styles.emptyState}`} aria-label={t("exhibitions", "noExhibitions")}>
          <h3>{t("exhibitions", "noExhibitions")}</h3>
          <p>{t("exhibitions", "firstRoom")}</p>
          <button type="button" className={`${styles.btn} ${styles.btnCta}`} onClick={requestOpenCreate}>
            {t("exhibitions", "createNew")} <ArrowRight size={15} />
          </button>
        </section>
      ) : (
        <>
          <div className={styles.chips} role="group" aria-label={t("exhibitions", "filterLabel")}>
            {chips.map((chip) => (
              <button
                key={chip.id}
                type="button"
                className={`${styles.chip}${filter === chip.id ? ` ${styles.chipOn}` : ""}`}
                aria-pressed={filter === chip.id}
                onClick={() => setFilter(chip.id)}
              >
                {chip.label} · {chip.count}
              </button>
            ))}
          </div>

          <label className={styles.searchField}>
            <Search size={16} aria-hidden="true" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("exhibitions", "searchPlaceholder")}
              aria-label={t("exhibitions", "searchAria")}
            />
          </label>

          {visibleExhibitions.length === 0 ? (
            <p className={dash.empty}>{t("exhibitions", "noMatch")}</p>
          ) : (
            <div className={styles.gridCards}>
              {visibleExhibitions.map((exhibition) => (
                <article key={exhibition.id} className={styles.expoCard}>
                  <Link
                    href={`/editor/${exhibition.id}`}
                    className={styles.expoCover}
                    aria-label={`${t("exhibitions", "continueBuilding")}, ${exhibition.title}`}
                  >
                    {exhibition.coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={exhibition.coverImageUrl}
                        alt={exhibition.title}
                        loading="lazy"
                        onError={handleCoverImageError} ref={coverImageRef}
                      />
                    ) : (
                      <span className={styles.expoCoverFallback}>LAKISA</span>
                    )}
                    <span className={`${styles.pill} ${exhibition.status === "public" ? styles.pillLive : styles.pillDraft} ${styles.pillOnCover}`}>
                      <span className={styles.pillDot} aria-hidden="true" />
                      {exhibition.status === "public" ? t("exhibitions", "published") : t("exhibitions", "draft")}
                    </span>
                  </Link>
                  <div className={styles.expoBody}>
                    <h3 className={styles.expoTitle}>
                      <Link href={`/editor/${exhibition.id}`} style={{ color: "inherit", textDecoration: "none" }}>
                        {exhibition.title}
                      </Link>
                    </h3>
                    <p className={styles.expoMeta}>
                      {exhibition.roomCount} {exhibition.roomCount === 1 ? t("exhibitions", "room") : t("exhibitions", "rooms")} ·{" "}
                      {exhibition.artworkCount} {exhibition.artworkCount === 1 ? t("exhibitions", "artwork") : t("exhibitions", "artworks")}
                    </p>
                    <div className={styles.expoFoot}>
                      <span>
                        <b className={dash.tnum}>{exhibition.views}</b>{" "}
                        {exhibition.views === 1 ? t("exhibitions", "visitSingular") : t("exhibitions", "visits")}
                      </span>
                      <span>{new Date(exhibition.updatedAt).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })}</span>
                    </div>
                    <div className={styles.expoActions}>
                      <Link href={`/editor/${exhibition.id}`} className={styles.btn}>
                        <PenLine size={14} /> {t("exhibitions", "continueBuilding")}
                      </Link>
                      {exhibition.status === "public" && (
                        <Link href={`/exhibition/${exhibition.slug}`} className={styles.btn}>
                          {t("exhibitions", "visit")} <ArrowUpRight size={14} />
                        </Link>
                      )}
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnDanger}`}
                        onClick={() => void deleteExhibition(exhibition)}
                        disabled={deletingId === exhibition.id}
                        aria-label={confirmingDeleteId === exhibition.id ? `${t("exhibitions", "clickAgainDelete")}, ${exhibition.title}` : `${t("exhibitions", "delete")}, ${exhibition.title}`}
                      >
                        <Trash2 size={14} />{" "}
                        {deletingId === exhibition.id
                          ? t("exhibitions", "deleting")
                          : confirmingDeleteId === exhibition.id
                            ? t("exhibitions", "clickAgainDelete")
                            : t("exhibitions", "delete")}
                      </button>
                    </div>
                  </div>
                </article>
              ))}

              <button type="button" className={styles.createCard} onClick={requestOpenCreate}>
                <Plus size={20} />
                {t("exhibitions", "createNew")}
                <span>{t("exhibitions", "createHint")}</span>
              </button>
            </div>
          )}
        </>
      )}
    </>
  );
}
