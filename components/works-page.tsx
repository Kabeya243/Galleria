"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import Avatar from "@/components/avatar";
import { useT } from "@/lib/i18n";
import type { WorkKind } from "@/lib/works";

export type WorksPageWork = {
  id: string;
  title: string;
  year: string;
  medium: string;
  dimensions: string;
  description: string;
  color: string;
  accent: string;
  imageUrl: string | null;
  exhibitionTitle: string;
  kind: WorkKind;
};

type Filter = "all" | WorkKind;
const FILTERS: Filter[] = ["all", "oeuvre", "design", "creation"];

// Public creator wall ("Mes travaux / designs / créations"): header with
// the creator's photo, name and bio, then a filterable wall of their
// works. The owner, signed in, can tag each work's kind right here; the
// change saves through /api/work-kinds and the counts update at once.
export default function WorksPage({
  creator,
  works,
  isOwner,
}: {
  creator: { id: string; name: string; avatarUrl: string | null; bio: string | null };
  works: WorksPageWork[];
  isOwner: boolean;
}) {
  const t = useT();
  const [filter, setFilter] = useState<Filter>("all");
  const [kinds, setKinds] = useState<Record<string, WorkKind>>(
    () => Object.fromEntries(works.map((w) => [w.id, w.kind])),
  );
  const [kindError, setKindError] = useState<string | null>(null);
  const [savingKindId, setSavingKindId] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: works.length, oeuvre: 0, design: 0, creation: 0 };
    for (const w of works) c[kinds[w.id] ?? w.kind] += 1;
    return c;
  }, [works, kinds]);

  const shown = useMemo(
    () => (filter === "all" ? works : works.filter((w) => (kinds[w.id] ?? w.kind) === filter)),
    [works, kinds, filter],
  );

  async function changeKind(workId: string, kind: WorkKind) {
    const previous = kinds[workId];
    setKinds((k) => ({ ...k, [workId]: kind }));
    setKindError(null);
    setSavingKindId(workId);
    try {
      const res = await fetch("/api/work-kinds", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ artworkId: workId, kind }),
      });
      if (!res.ok) throw new Error(t("works", "couldNotSaveKind"));
    } catch (error) {
      setKinds((k) => ({ ...k, [workId]: previous }));
      setKindError(error instanceof Error ? error.message : t("works", "couldNotSaveKind"));
    } finally {
      setSavingKindId(null);
    }
  }

  return (
    <main className="works-page">
      <header className="works-head">
        <Avatar name={creator.name} avatarUrl={creator.avatarUrl} className="works-avatar" />
        <div>
          <p className="eyebrow">{t("works", "eyebrow")}</p>
          <h1>{creator.name}</h1>
          {creator.bio && <p className="works-bio">{creator.bio}</p>}
          <p className="works-counts">
            {works.length} {works.length === 1 ? t("works", "work") : t("works", "works")}
            {isOwner && (
              <>
                {" · "}
                <Link href="/exhibitions">{t("works", "manageExhibitions")}</Link>
              </>
            )}
          </p>
        </div>
      </header>

      <div className="works-filters" role="group" aria-label={t("works", "filterByType")}>
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            className={filter === f ? "active" : ""}
            aria-pressed={filter === f}
            onClick={() => setFilter(f)}
          >
            {t("works", f === "all" ? "all" : f)} <span>({counts[f]})</span>
          </button>
        ))}
      </div>
      {kindError && (
        <p className="works-error" role="alert">
          {kindError}
        </p>
      )}

      {shown.length === 0 ? (
        <div className="works-empty">
          <strong>{filter === "all" ? t("works", "noWorksYet") : t("works", "noWorksInKind")}</strong>
          <p>{filter === "all" ? t("works", "noWorksYetDesc") : t("works", "noWorksInKindDesc")}</p>
          {isOwner && (
            <Link href="/exhibitions" className="galleries-open-button">
              {t("works", "goToExhibitions")}
            </Link>
          )}
        </div>
      ) : (
        <div className="works-grid">
          {shown.map((work) => (
            <article key={work.id} className="works-card">
              {work.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={work.imageUrl} alt={work.title} loading="lazy" />
              ) : (
                <div
                  className="works-card-blank"
                  style={{ background: `linear-gradient(135deg, ${work.color}, ${work.accent})` }}
                  aria-label={work.title}
                />
              )}
              <div className="works-card-body">
                <h2>{work.title}</h2>
                <p className="works-card-meta">
                  {[work.year, work.medium, work.dimensions].filter(Boolean).join(" · ")}
                </p>
                <p className="works-card-exhibition">{work.exhibitionTitle}</p>
                {isOwner && (
                  <label className="works-kind">
                    {t("works", "type")}
                    <select
                      value={kinds[work.id] ?? work.kind}
                      disabled={savingKindId === work.id}
                      onChange={(e) => void changeKind(work.id, e.target.value as WorkKind)}
                      aria-label={`${t("works", "type")} — ${work.title}`}
                    >
                      <option value="oeuvre">{t("works", "oeuvre")}</option>
                      <option value="design">{t("works", "design")}</option>
                      <option value="creation">{t("works", "creation")}</option>
                    </select>
                  </label>
                )}
              </div>
            </article>
          ))}
        </div>
      )}

      <footer className="works-footer">
        <Link href="/">← SANAA</Link>
      </footer>

      <style>{`
        .works-page { max-width: 1100px; margin: 0 auto; padding: 32px 20px 64px; color: var(--ink); }
        .works-head { display: flex; gap: 20px; align-items: flex-start; margin-bottom: 28px; }
        .works-avatar { width: 84px; height: 84px; border-radius: 50%; background: var(--ink); color: var(--paper); display: grid; place-items: center; font: 700 28px "DM Sans", sans-serif; flex: none; }
        .works-head h1 { margin: 4px 0 8px; font: 600 clamp(26px, 4vw, 38px)/1.1 Fraunces, Georgia, serif; }
        .works-bio { margin: 0 0 10px; font-size: 15px; line-height: 1.65; color: var(--muted); max-width: 640px; white-space: pre-wrap; }
        .works-counts { margin: 0; font-size: 13px; color: var(--muted); }
        .works-counts a { color: var(--ink); }
        .works-filters { display: flex; gap: 8px; flex-wrap: wrap; margin-bottom: 20px; }
        .works-filters button { border: 1px solid var(--line); background: var(--paper); color: var(--ink); border-radius: 999px; padding: 8px 14px; font: inherit; font-size: 13px; cursor: pointer; }
        .works-filters button span { color: var(--muted); }
        .works-filters button.active { background: var(--ink); color: var(--paper); border-color: var(--ink); }
        .works-filters button.active span { color: var(--paper); opacity: .7; }
        .works-error { color: #9a2b2b; font-size: 13px; margin: 0 0 12px; }
        .works-empty { border: 1px solid var(--line); border-radius: 10px; padding: 28px; text-align: center; background: var(--paper); }
        .works-empty p { color: var(--muted); font-size: 14px; }
        .works-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(240px, 1fr)); gap: 20px; }
        .works-card { border: 1px solid var(--line); border-radius: 10px; overflow: hidden; background: var(--paper); }
        .works-card img, .works-card-blank { width: 100%; aspect-ratio: 4 / 3; object-fit: cover; display: block; }
        .works-card-body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 6px; }
        .works-card-body h2 { margin: 0; font: 600 16px Fraunces, Georgia, serif; }
        .works-card-meta { margin: 0; font-size: 12px; color: var(--muted); line-height: 1.5; }
        .works-card-exhibition { margin: 0; font-size: 12px; color: var(--muted); }
        .works-kind { display: flex; align-items: center; gap: 8px; font-size: 12px; color: var(--muted); margin-top: 4px; }
        .works-kind select { flex: 1; height: 32px; border: 1px solid var(--line); border-radius: 5px; background: var(--paper); color: var(--ink); font: inherit; font-size: 13px; padding: 0 6px; }
        .works-footer { margin-top: 32px; font-size: 13px; }
        .works-footer a { color: var(--muted); }
      `}</style>
    </main>
  );
}
