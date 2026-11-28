"use client";

import { useMemo, useRef, useState, type FormEvent } from "react";
import { Check, Copy, Plus, Search, Sparkles, Trash2 } from "lucide-react";
import { useLocale, useT } from "@/lib/i18n";
import { buildArtworkTextsPrompt, buildTagsPrompt, parseAiJson } from "@/lib/ai-tools-prompts";
import { coverImageRef, handleCoverImageError } from "@/lib/image-fallback";
import type { LibraryWorkItem } from "@/lib/library";
import {
  DirectUploadFailedError,
  DirectUploadNotConfiguredError,
  uploadFileToR2,
} from "@/lib/direct-upload";
import page from "./redesign-pages.module.css";
import dash from "./redesign-dashboard.module.css";

// AI tools 1 and 4 (library form): the prompt builders take the
// language as a plain English name ("English", "French", ...), not a
// locale code — the interface locale is mapped here.
const AI_LANGUAGE_NAMES: Record<string, string> = {
  en: "English",
  fr: "French",
  de: "German",
  it: "Italian",
  es: "Spanish",
  pt: "Portuguese",
  zh: "Chinese",
  ja: "Japanese",
  ko: "Korean",
  sw: "Swahili",
  ln: "Lingala",
};

// The generate route only accepts same-origin artwork URLs in these
// shapes (see app/api/ai/generate/route.ts). The upload returns one of
// them, except for SVG files — an SVG is simply sent without the photo
// instead of failing the whole generation with a 400.
const GENERATABLE_IMAGE_URL =
  /^\/(?:api\/(?:uploads\/[a-f0-9-]+\.webp|portfolio-artworks\/[a-z0-9-]+\.(?:jpg|jpeg|webp)|r2\/uploads\/[A-Za-z0-9_-]+\/[a-f0-9-]{36}\.(?:png|jpe?g|webp|avif|heic|heif)))$/i;

type AiArtworkTexts = {
  description: string;
  artistStatement: string;
  curatorialText: string;
};
// library: every work they have ever uploaded, all exhibitions
// together. From here a work can be added to any exhibition (a COPY
// with the same image — never a re-upload) or deleted outright
// (two-step confirm: that delete removes the library row AND every
// copy hanging in their exhibitions, so the library read cannot
// backfill it straight back). Deleting a single copy from an
// exhibition is a different act and lives in the editor / DELETE
// /api/artworks/[id]: it only ever removes that copy.
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
  // Removing a work from one exhibition (the reverse of "Add to an
  // exhibition"): the key is work + exhibition, since a work can hang
  // in several shows at once.
  const [removingKey, setRemovingKey] = useState<string | null>(null);
  const [removedNote, setRemovedNote] = useState<{ workId: string; exhibitionTitle: string } | null>(null);
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
  const { locale } = useLocale();
  // AI tools 1 and 4 (on demand, never automatic): the photo is
  // uploaded once and the returned URL is cached, so the AI buttons
  // and the save share one upload instead of uploading twice.
  const [uploadedImageUrl, setUploadedImageUrl] = useState<string | null>(null);
  // Tool 1 — artwork texts: three drafts the artist reads and edits
  // before saving. Only the description has a field in the form; the
  // statement and the curatorial text are editable and copyable here.
  const [aiTextsBusy, setAiTextsBusy] = useState(false);
  const [aiTextsError, setAiTextsError] = useState<string | null>(null);
  const [aiTexts, setAiTexts] = useState<AiArtworkTexts | null>(null);
  const [aiTextsRaw, setAiTextsRaw] = useState<string | null>(null);
  const [aiAppliedNote, setAiAppliedNote] = useState(false);
  // Tool 4 — tags: the suggested tags, and which of them the artist
  // kept (all start kept). Only the kept tags are saved with the work.
  const [tagsBusy, setTagsBusy] = useState(false);
  const [tagsError, setTagsError] = useState<string | null>(null);
  const [suggestedTags, setSuggestedTags] = useState<string[]>([]);
  const [chosenTags, setChosenTags] = useState<string[]>([]);
  const [tagsRaw, setTagsRaw] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const proxyUpload = async (): Promise<string> => {
    if (!addFile) throw new Error(t("library", "chooseImageFirst"));
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

  async function ensureImageUrl(): Promise<string | null> {
    if (uploadedImageUrl) return uploadedImageUrl;
    if (!addFile) return null;
    const url = await uploadFileToR2(addFile, "image", proxyUpload, setAddProgress);
    setUploadedImageUrl(url);
    return url;
  }

  // One call to /api/ai/generate, with the route's error statuses
  // mapped to plain words: 503 means no provider is connected (never
  // a made-up reply), 429 means the hourly limit is hit.
  async function callAiGenerate(input: { system: string; prompt: string; imageUrl?: string }): Promise<string> {
    const response = await fetch("/api/ai/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        system: input.system,
        prompt: input.prompt,
        ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
      }),
    });
    const result = (await response.json().catch(() => ({}))) as { text?: string; error?: string };
    if (response.status === 503) throw new Error(t("library", "aiNotConnected"));
    if (response.status === 429) throw new Error(t("library", "aiTooMany"));
    if (!response.ok) throw new Error(result.error ?? t("library", "aiFailed"));
    if (!result.text) throw new Error(t("library", "aiFailed"));
    return result.text;
  }

  function aiLanguage(): string {
    return AI_LANGUAGE_NAMES[locale] ?? "English";
  }

  // The photo is the main input for both tools: without a chosen
  // image there is nothing for the model to look at.
  function requireImage(): boolean {
    if (addFile || uploadedImageUrl) return true;
    return false;
  }

  async function generateTexts() {
    if (aiTextsBusy || tagsBusy) return;
    if (!requireImage()) {
      setAiTextsError(t("library", "chooseImageFirst"));
      return;
    }
    setAiTextsBusy(true);
    setAiTextsError(null);
    setAiTextsRaw(null);
    try {
      const imageUrl = await ensureImageUrl();
      const { system, prompt } = buildArtworkTextsPrompt({
        title: addTitle.trim(),
        medium: addMedium.trim(),
        year: addYear.trim(),
        dimensions: addDimensions.trim() || undefined,
        language: aiLanguage(),
      });
      const text = await callAiGenerate({
        system,
        prompt,
        imageUrl: imageUrl && GENERATABLE_IMAGE_URL.test(imageUrl) ? imageUrl : undefined,
      });
      const parsed = parseAiJson<Partial<AiArtworkTexts>>(text);
      if (!parsed || (!parsed.description && !parsed.artistStatement && !parsed.curatorialText)) {
        // The model answered, but not in the JSON shape asked for:
        // show the raw text instead of failing silently or inventing
        // a parse.
        setAiTextsRaw(text);
        setAiTextsError(t("library", "aiUnclear"));
        return;
      }
      setAiTexts({
        description: parsed.description ?? "",
        artistStatement: parsed.artistStatement ?? "",
        curatorialText: parsed.curatorialText ?? "",
      });
    } catch (error) {
      setAiTextsError(error instanceof Error ? error.message : t("library", "aiFailed"));
    } finally {
      setAiTextsBusy(false);
    }
  }

  async function generateTags() {
    if (tagsBusy || aiTextsBusy) return;
    if (!requireImage()) {
      setTagsError(t("library", "chooseImageFirst"));
      return;
    }
    setTagsBusy(true);
    setTagsError(null);
    setTagsRaw(null);
    try {
      const imageUrl = await ensureImageUrl();
      const { system, prompt } = buildTagsPrompt({
        title: addTitle.trim(),
        medium: addMedium.trim(),
        year: addYear.trim(),
        language: aiLanguage(),
      });
      const text = await callAiGenerate({
        system,
        prompt,
        imageUrl: imageUrl && GENERATABLE_IMAGE_URL.test(imageUrl) ? imageUrl : undefined,
      });
      const parsed = parseAiJson<{ tags?: unknown }>(text);
      const tags = Array.isArray(parsed?.tags)
        ? [...new Set(
            parsed.tags
              .filter((tag): tag is string => typeof tag === "string")
              .map((tag) => tag.trim().toLowerCase())
              .filter((tag) => tag.length > 0 && tag.length <= 40),
          )].slice(0, 12)
        : [];
      if (tags.length === 0) {
        setTagsRaw(text);
        setTagsError(t("library", "aiUnclear"));
        return;
      }
      setSuggestedTags(tags);
      setChosenTags(tags);
    } catch (error) {
      setTagsError(error instanceof Error ? error.message : t("library", "aiFailed"));
    } finally {
      setTagsBusy(false);
    }
  }

  function toggleSuggestedTag(tag: string) {
    setChosenTags((current) =>
      current.includes(tag) ? current.filter((item) => item !== tag) : [...current, tag],
    );
  }

  async function copyAiText(key: string, text: string) {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      window.setTimeout(() => setCopiedKey((current) => (current === key ? null : current)), 2000);
    } catch {
      // Clipboard unavailable: the text stays editable and selectable
      // in its field, so nothing is lost.
      setCopiedKey(null);
    }
  }

  function applyDescription() {
    if (!aiTexts) return;
    setAddDescription(aiTexts.description);
    setAiAppliedNote(true);
    window.setTimeout(() => setAiAppliedNote(false), 4000);
  }

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
      const imageUrl = await ensureImageUrl();
      if (!imageUrl) throw new Error(t("library", "couldNotUpload"));
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
          tags: chosenTags,
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
      setUploadedImageUrl(null);
      setAiTexts(null);
      setAiTextsRaw(null);
      setSuggestedTags([]);
      setChosenTags([]);
      setTagsRaw(null);
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

  // Remove a work from one exhibition (the reverse of "Add to an
  // exhibition", which was not reversible before): only the copies in
  // that show go — the library row and copies elsewhere stay.
  async function removeWorkFromExhibition(work: LibraryWorkItem, exhibitionId: string) {
    const exhibition = exhibitions.find((item) => item.id === exhibitionId);
    if (!exhibition) return;
    const key = `${work.id}:${exhibitionId}`;
    setRemovingKey(key);
    setPageError(null);
    try {
      const response = await fetch(`/api/library/${work.id}/reuse?exhibitionId=${encodeURIComponent(exhibitionId)}`, {
        method: "DELETE",
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? t("library", "couldNotRemove"));
      setRemovedNote({ workId: work.id, exhibitionTitle: exhibition.title });
      window.setTimeout(
        () => setRemovedNote((current) => (current?.workId === work.id ? null : current)),
        6000,
      );
      setWorks((current) =>
        current.map((item) =>
          item.id === work.id
            ? { ...item, exhibitionIds: item.exhibitionIds.filter((id) => id !== exhibitionId) }
            : item,
        ),
      );
    } catch (error) {
      console.error("Could not remove artwork from exhibition.", error);
      setPageError(error instanceof Error ? error.message : t("library", "couldNotRemove"));
    } finally {
      setRemovingKey(null);
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
    <>
    <div className={page.pageHead}>
      <div>
        <span className={dash.eyebrow}>
          {t("library", "yourLibrary")} {works.length}
        </span>
        <h1>{t("library", "title")}</h1>
        <p className={page.pageSub}>{t("library", "copy")}</p>
      </div>
      <div className={page.pageActions}>
        <button
          type="button"
          className={`${page.btn} ${page.btnCta}`}
          onClick={() => setShowAddForm((current) => !current)}
          aria-expanded={showAddForm}
        >
          <Plus size={16} /> {t("library", "addArtwork")}
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

    <label className={page.searchField}>
      <Search size={15} />
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("library", "searchPlaceholder")}
        aria-label={t("library", "searchAria")}
      />
    </label>

    {showAddForm && (
      <section className={dash.card} aria-label={t("library", "addArtwork")}>
        <div className={dash.cardHead}>
          <div>
            <span className={dash.eyebrow}>{t("library", "addArtwork")}</span>
            <h2>{t("library", "addArtwork")}</h2>
            <p className={dash.cardSub}>{t("library", "addArtworkCopy")}</p>
          </div>
        </div>
        <form onSubmit={addArtwork} className={page.form} style={{ marginTop: 16 }}>
          <div className={page.formGrid}>
            <label className={page.field}>
              <span>{t("library", "artworkImage")}</span>
              <input
                ref={addFileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/svg+xml,.jpg,.jpeg,.png,.webp,.svg"
                onChange={(event) => {
                  setAddFile(event.target.files?.[0] ?? null);
                  // A new photo makes the cached upload and the drafts
                  // from the old photo stale: drop them.
                  setUploadedImageUrl(null);
                  setAiTexts(null);
                  setAiTextsRaw(null);
                  setSuggestedTags([]);
                  setChosenTags([]);
                  setTagsRaw(null);
                }}
                required
                className={page.input}
              />
              {addFile && <span className={page.fieldHint}>{addFile.name}</span>}
            </label>
            <label className={page.field}>
              <span>{t("library", "artworkTitle")}</span>
              <input
                value={addTitle}
                onChange={(event) => setAddTitle(event.target.value)}
                placeholder={t("library", "artworkTitlePlaceholder")}
                required
                className={page.input}
              />
            </label>
            <label className={page.field}>
              <span>{t("library", "artworkArtist")}</span>
              <input value={addArtist} onChange={(event) => setAddArtist(event.target.value)} className={page.input} />
            </label>
            <label className={page.field}>
              <span>{t("library", "artworkYear")}</span>
              <input value={addYear} onChange={(event) => setAddYear(event.target.value)} className={page.input} />
            </label>
            <label className={page.field}>
              <span>{t("library", "artworkMedium")}</span>
              <input value={addMedium} onChange={(event) => setAddMedium(event.target.value)} className={page.input} />
            </label>
            <label className={page.field}>
              <span>{t("library", "artworkDimensions")}</span>
              <input
                value={addDimensions}
                onChange={(event) => setAddDimensions(event.target.value)}
                placeholder="80 × 100 cm"
                className={page.input}
              />
            </label>
            <label className={page.field} style={{ gridColumn: "1 / -1" }}>
              <span>{t("library", "artworkDescription")}</span>
              <input value={addDescription} onChange={(event) => setAddDescription(event.target.value)} className={page.input} />
            </label>
          </div>
          <div className={page.formActions}>
            <button type="button" className={page.btn} onClick={() => void generateTexts()} disabled={aiTextsBusy || tagsBusy || addBusy}>
              <Sparkles size={14} /> {aiTextsBusy ? t("library", "aiGenerating") : t("library", "aiGenerateTexts")}
            </button>
            <button type="button" className={page.btn} onClick={() => void generateTags()} disabled={tagsBusy || aiTextsBusy || addBusy}>
              <Sparkles size={14} /> {tagsBusy ? t("library", "aiSuggestingTags") : t("library", "aiSuggestTags")}
            </button>
          </div>
          {aiTextsError && (
            <p role="alert" style={{ color: "var(--rd-red)", fontSize: 13, margin: "12px 0 0" }}>
              {aiTextsError}
            </p>
          )}
          {aiTextsRaw && (
            <p style={{ fontSize: 13, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{aiTextsRaw}</p>
          )}
          {aiTexts && (
            <div style={{ marginTop: 16, borderTop: "1px solid var(--rd-line, #e8e6e1)", paddingTop: 16 }}>
              <span className={dash.eyebrow}>{t("library", "aiTextsTitle")}</span>
              <p className={dash.cardSub}>{t("library", "aiTextsHint")}</p>
              <div className={page.formGrid} style={{ marginTop: 12 }}>
                <label className={page.field} style={{ gridColumn: "1 / -1" }}>
                  <span>{t("library", "aiDescription")}</span>
                  <textarea
                    rows={3}
                    value={aiTexts.description}
                    onChange={(event) => setAiTexts((current) => (current ? { ...current, description: event.target.value } : current))}
                    className={page.textarea}
                  />
                </label>
                <div style={{ gridColumn: "1 / -1", display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button type="button" className={page.btn} onClick={applyDescription}>
                    <Check size={14} /> {t("library", "aiApplyDescription")}
                  </button>
                  {aiAppliedNote && (
                    <span role="status" style={{ color: "var(--rd-live)", fontSize: 13, alignSelf: "center" }}>
                      {t("library", "aiApplied")}
                    </span>
                  )}
                </div>
                <label className={page.field} style={{ gridColumn: "1 / -1" }}>
                  <span>{t("library", "aiArtistStatement")}</span>
                  <textarea
                    rows={3}
                    value={aiTexts.artistStatement}
                    onChange={(event) => setAiTexts((current) => (current ? { ...current, artistStatement: event.target.value } : current))}
                    className={page.textarea}
                  />
                </label>
                <div style={{ gridColumn: "1 / -1" }}>
                  <button type="button" className={page.btn} onClick={() => void copyAiText("statement", aiTexts.artistStatement)}>
                    <Copy size={14} /> {copiedKey === "statement" ? t("library", "aiCopied") : t("library", "aiCopy")}
                  </button>
                </div>
                <label className={page.field} style={{ gridColumn: "1 / -1" }}>
                  <span>{t("library", "aiCuratorialText")}</span>
                  <textarea
                    rows={3}
                    value={aiTexts.curatorialText}
                    onChange={(event) => setAiTexts((current) => (current ? { ...current, curatorialText: event.target.value } : current))}
                    className={page.textarea}
                  />
                </label>
                <div style={{ gridColumn: "1 / -1" }}>
                  <button type="button" className={page.btn} onClick={() => void copyAiText("curatorial", aiTexts.curatorialText)}>
                    <Copy size={14} /> {copiedKey === "curatorial" ? t("library", "aiCopied") : t("library", "aiCopy")}
                  </button>
                </div>
              </div>
            </div>
          )}
          {tagsError && (
            <p role="alert" style={{ color: "var(--rd-red)", fontSize: 13, margin: "12px 0 0" }}>
              {tagsError}
            </p>
          )}
          {tagsRaw && (
            <p style={{ fontSize: 13, margin: "8px 0 0", whiteSpace: "pre-wrap" }}>{tagsRaw}</p>
          )}
          {suggestedTags.length > 0 && (
            <div style={{ marginTop: 16, borderTop: "1px solid var(--rd-line, #e8e6e1)", paddingTop: 16 }}>
              <span className={dash.eyebrow}>{t("library", "aiTagsTitle")}</span>
              <p className={dash.cardSub}>{t("library", "aiTagsHint")}</p>
              <div className={page.chips} role="group" aria-label={t("library", "aiTagsTitle")}>
                {suggestedTags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={`${page.chip}${chosenTags.includes(tag) ? ` ${page.chipOn}` : ""}`}
                    aria-pressed={chosenTags.includes(tag)}
                    onClick={() => toggleSuggestedTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={page.formActions}>
            <button type="submit" className={`${page.btn} ${page.btnCta}`} disabled={addBusy}>
              {addBusy
                ? addProgress != null
                  ? `${t("library", "uploading")} ${addProgress}%`
                  : t("library", "savingArtwork")
                : t("library", "addArtwork")}
            </button>
          </div>
        </form>
        {addError && (
          <p role="alert" style={{ color: "var(--rd-red)", fontSize: 13, margin: "12px 0 0" }}>
            {addError}
          </p>
        )}
        {addSuccess && (
          <p role="status" style={{ color: "var(--rd-live)", fontSize: 13, margin: "12px 0 0" }}>
            <Check size={13} /> {t("library", "artworkAdded")}
          </p>
        )}
      </section>
    )}

    {works.length === 0 ? (
      <section className={`${dash.card} ${page.emptyState}`}>
        <h3>{t("library", "noWorks")}</h3>
        <p>{t("library", "noWorksDesc")}</p>
      </section>
    ) : visibleWorks.length === 0 ? (
      <p className={dash.empty}>{t("library", "noMatch")}</p>
    ) : (
      <div className={page.workGrid}>
        {visibleWorks.map((work) => (
          <article key={work.id} className={page.workCard}>
            <span className={page.workThumb} aria-label={work.title}>
              {work.videoUrl ? (
                <video src={work.videoUrl} muted loop playsInline preload="metadata" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
              ) : work.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={work.imageUrl}
                  alt={work.altText ?? work.title}
                  loading="lazy"
                  onError={handleCoverImageError} ref={coverImageRef}
                />
              ) : work.sculptureUrl ? (
                <span
                  style={{ background: "linear-gradient(135deg, #b8a184, #343e36)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, letterSpacing: "0.2em", width: "100%", height: "100%" }}
                  role="img"
                  aria-label={work.title}
                >
                  3D
                </span>
              ) : null}
            </span>
            <div className={page.workBody}>
              <h3 className={page.workTitle}>{work.title}</h3>
              <p className={page.workMeta}>
                {[work.year, work.medium].filter(Boolean).join(" · ") || work.artist}
              </p>
              <p className={page.workMeta}>
                {work.exhibitionIds.length === 0
                  ? t("library", "notInExhibition")
                  : `${t("library", "inExhibitions")} ${work.exhibitionIds.length} ${work.exhibitionIds.length === 1 ? t("library", "exhibition") : t("library", "exhibitions")}`}
              </p>
              {work.exhibitionIds.length > 0 && (
                <div className={page.tagRow}>
                  {work.exhibitionIds.map((exhibitionId) => {
                    const exhibition = exhibitions.find((item) => item.id === exhibitionId);
                    if (!exhibition) return null;
                    const key = `${work.id}:${exhibitionId}`;
                    return (
                      <span key={exhibitionId} className={page.tag}>
                        {exhibition.title}
                        <button
                          type="button"
                          onClick={() => void removeWorkFromExhibition(work, exhibitionId)}
                          disabled={removingKey === key}
                          aria-label={`${t("library", "removeFromExhibition")}: ${exhibition.title}`}
                          title={t("library", "removeFromExhibition")}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                </div>
              )}
              {confirmingDeleteId === work.id && (
                <p role="alert" style={{ color: "var(--rd-red)", fontSize: 13, margin: "8px 0 0" }}>
                  {t("library", "deleteWarning")}
                </p>
              )}
              {addedNote?.workId === work.id && (
                <p role="status" style={{ color: "var(--rd-live)", fontSize: 13, margin: "8px 0 0" }}>
                  <Check size={13} /> {t("library", "addedTo")} {addedNote.exhibitionTitle}
                </p>
              )}
              {removedNote?.workId === work.id && (
                <p role="status" style={{ color: "var(--rd-live)", fontSize: 13, margin: "8px 0 0" }}>
                  <Check size={13} /> {t("library", "removedFrom")} {removedNote.exhibitionTitle}
                </p>
              )}
              <div className={page.expoActions}>
                <select
                  className={page.select}
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
                  type="button"
                  onClick={() => void reuseWork(work)}
                  disabled={addingId === work.id || !reuseTarget[work.id] || work.exhibitionIds.includes(reuseTarget[work.id] ?? "")}
                  className={page.btn}
                  title={reuseTarget[work.id] && work.exhibitionIds.includes(reuseTarget[work.id]) ? t("library", "alreadyInExhibition") : undefined}
                >
                  <Plus size={14} /> {addingId === work.id ? t("library", "adding") : t("library", "addToExhibition")}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteWork(work)}
                  disabled={deletingId === work.id}
                  className={`${page.btn} ${page.btnDanger}`}
                  aria-label={confirmingDeleteId === work.id ? `${t("library", "clickAgainDelete")}, ${work.title}` : `${t("library", "delete")}, ${work.title}`}
                >
                  <Trash2 size={14} />{" "}
                  {deletingId === work.id
                    ? t("library", "deleting")
                    : confirmingDeleteId === work.id
                      ? t("library", "clickAgainDelete")
                      : t("library", "delete")}
                </button>
              </div>
              {reuseTarget[work.id] && work.exhibitionIds.includes(reuseTarget[work.id]) && (
                <p role="status" style={{ color: "var(--rd-live)", fontSize: 13, margin: "8px 0 0" }}>
                  {t("library", "alreadyInExhibition")}
                </p>
              )}
            </div>
          </article>
        ))}
      </div>
    )}

    <section className={`${dash.card} ${page.noteCard}`}>
      <p>
        <strong>{t("library", "inventoryHintTitle")}</strong> {t("library", "inventoryHint")}
      </p>
      <a className={page.btn} href="/tools/inventory">
        {t("library", "openInventory")}
      </a>
    </section>
    </>
  );
}
