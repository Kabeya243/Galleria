"use client";

// Magazine editor (admin only): a focused writing tool. Title as a
// headline, cover with an immediate preview, Markdown body with a
// Write/Preview toggle whose preview renders the real article page
// styles (so Preview is the published article, not an approximation),
// slug, excerpt, draft/published status that is always visible, and
// save feedback the admin can trust (last-saved time, dirty state,
// word count). The page that mounts this component already checked
// the magazine.manage permission server-side; the API routes check
// it again on every call.
//
// The preview byline is always "Lakisa": the public byline never
// shows the internal author, whoever wrote the article.
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import type { SerializedMagazineArticle } from "@/lib/magazine";
import editorStyles from "./magazine-editor.module.css";
import articleStyles from "./magazine-page.module.css";

function slugify(title: string): string {
  const base = title
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return base || "article";
}

function wordCount(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

function readingMinutes(text: string): number {
  return Math.max(1, Math.round(wordCount(text) / 200));
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string | null): string {
  const d = iso ? new Date(iso) : new Date();
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

async function uploadImageFile(file: File): Promise<string> {
  const presign = await fetch("/api/uploads/presign", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      filename: file.name,
      contentType: file.type,
      size: file.size,
      kind: "image",
    }),
  });
  if (!presign.ok) {
    const data = (await presign.json().catch(() => null)) as { error?: string } | null;
    throw new Error(data?.error ?? "The upload could not be signed.");
  }
  const { uploadUrl, url } = (await presign.json()) as { uploadUrl: string; url: string };
  const put = await fetch(uploadUrl, {
    method: "PUT",
    headers: { "content-type": file.type },
    body: file,
  });
  if (!put.ok) throw new Error("The upload failed. Try again.");
  return url;
}

type Snapshot = {
  title: string;
  slug: string;
  excerpt: string;
  coverImageUrl: string;
  content: string;
  status: "draft" | "published";
};

export default function MagazineEditor({
  article,
}: {
  article: SerializedMagazineArticle | null;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(article?.title ?? "");
  const [slug, setSlug] = useState(article?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(article));
  const [excerpt, setExcerpt] = useState(article?.excerpt ?? "");
  const [coverImageUrl, setCoverImageUrl] = useState(article?.coverImageUrl ?? "");
  const [content, setContent] = useState(article?.content ?? "");
  const [status, setStatus] = useState<"draft" | "published">(
    article?.status === "published" ? "published" : "draft",
  );
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [previewHtml, setPreviewHtml] = useState("");
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [savedSnapshot, setSavedSnapshot] = useState<Snapshot | null>(
    article
      ? {
          title: article.title,
          slug: article.slug,
          excerpt: article.excerpt ?? "",
          coverImageUrl: article.coverImageUrl ?? "",
          content: article.content,
          status: article.status === "published" ? "published" : "draft",
        }
      : null,
  );
  const contentRef = useRef<HTMLTextAreaElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const bodyInputRef = useRef<HTMLInputElement>(null);

  const snapshot: Snapshot = { title, slug, excerpt, coverImageUrl, content, status };
  const isDirty = useMemo(
    () =>
      !savedSnapshot ||
      JSON.stringify(savedSnapshot) !== JSON.stringify(snapshot),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [title, slug, excerpt, coverImageUrl, content, status, savedSnapshot],
  );

  const words = wordCount(content);
  const minutes = readingMinutes(content);

  // Live preview: render the Markdown exactly as the public page will.
  useEffect(() => {
    if (tab !== "preview") return;
    setPreviewError(null);
    const timer = setTimeout(() => {
      fetch("/api/admin/magazine/preview", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ markdown: content }),
      })
        .then((res) => (res.ok ? res.json() : Promise.reject(new Error("Preview failed."))))
        .then((data) => setPreviewHtml((data as { html: string }).html))
        .catch(() => setPreviewError("The preview could not be rendered."));
    }, 400);
    return () => clearTimeout(timer);
  }, [tab, content]);

  function onTitleChange(value: string) {
    setTitle(value);
    if (!slugTouched) setSlug(slugify(value));
  }

  async function onCoverFile(file: File | undefined) {
    if (!file) return;
    setUploading("cover");
    setError(null);
    try {
      const url = await uploadImageFile(file);
      setCoverImageUrl(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "The cover upload failed.");
    } finally {
      setUploading(null);
    }
  }

  async function onBodyImageFile(file: File | undefined) {
    if (!file) return;
    setUploading("body");
    setError(null);
    try {
      const url = await uploadImageFile(file);
      const textarea = contentRef.current;
      const insert = `\n\n![${file.name.replace(/\.[^.]+$/, "")}](${url})\n`;
      if (textarea) {
        const start = textarea.selectionStart ?? content.length;
        const end = textarea.selectionEnd ?? content.length;
        const next = content.slice(0, start) + insert + content.slice(end);
        setContent(next);
        requestAnimationFrame(() => {
          textarea.focus();
          textarea.setSelectionRange(start + insert.length, start + insert.length);
        });
      } else {
        setContent((value) => value + insert);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The image upload failed.");
    } finally {
      setUploading(null);
    }
  }

  async function save(event?: React.FormEvent) {
    event?.preventDefault();
    setError(null);
    if (!title.trim()) {
      setError("Give the article a title.");
      return;
    }
    if (!coverImageUrl.trim()) {
      setError("Add a cover image.");
      return;
    }
    if (!content.trim()) {
      setError("Write the article body.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        slug: slug.trim() || undefined,
        excerpt: excerpt.trim() || null,
        coverImageUrl: coverImageUrl.trim(),
        content,
        status,
      };
      const res = await fetch(
        article ? `/api/admin/magazine/${article.id}` : "/api/admin/magazine",
        {
          method: article ? "PUT" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(payload),
        },
      );
      const data = (await res.json().catch(() => null)) as
        | { article?: SerializedMagazineArticle; error?: string }
        | null;
      if (!res.ok || !data?.article) {
        throw new Error(data?.error ?? "The article could not be saved.");
      }
      setSavedAt(new Date());
      setSavedSnapshot({ ...snapshot, title: payload.title, slug: data.article.slug });
      if (!article) {
        router.push(`/admin/magazine/${data.article.id}`);
      } else {
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "The article could not be saved.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!article) return;
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/magazine/${article.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("The article could not be deleted.");
      router.push("/admin/magazine");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "The article could not be deleted.");
    } finally {
      setDeleting(false);
    }
  }

  return (
    <form className={editorStyles.editor} onSubmit={save}>
      <div className={editorStyles.actionBar}>
        <span
          className={`${editorStyles.statusPill} ${
            status === "published"
              ? editorStyles.statusPublished
              : editorStyles.statusDraft
          }`}
        >
          {status === "published" ? "Published" : "Draft"}
        </span>
        <span
          className={`${editorStyles.saveState} ${
            !isDirty && savedAt ? editorStyles.saveStateSaved : ""
          } ${isDirty ? editorStyles.saveStateDirty : ""}`}
        >
          {saving
            ? "Saving…"
            : isDirty
              ? "Unsaved changes"
              : savedAt
                ? `Saved at ${formatTime(savedAt)}`
                : article
                  ? "No changes"
                  : "Not saved yet"}
        </span>
        <button
          type="submit"
          className={editorStyles.primaryButton}
          disabled={saving}
        >
          {saving ? "Saving…" : article ? "Save changes" : "Create article"}
        </button>
        {article && status === "published" && (
          <a
            href={`/magazine/${article.slug}`}
            target="_blank"
            rel="noreferrer"
            className={editorStyles.secondaryButton}
          >
            View public page
          </a>
        )}
      </div>

      <input
        className={editorStyles.titleInput}
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Article title"
        aria-label="Article title"
        required
      />

      <label className={editorStyles.field}>
        Address
        <span className={editorStyles.fieldHint}>
          The public page lives at this address. Edit it with care: changing
          it breaks the old link.
        </span>
        <span className={editorStyles.slugRow}>
          <span>lakisa.art/magazine/</span>
          <input
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            placeholder="auto-generated from the title"
            aria-label="Article slug"
          />
        </span>
      </label>

      <label className={editorStyles.field}>
        Excerpt
        <span className={editorStyles.fieldHint}>
          One or two lines. Shown on the magazine front page and under the
          headline.
        </span>
        <textarea
          value={excerpt}
          onChange={(e) => setExcerpt(e.target.value)}
          rows={2}
          placeholder="A short standfirst for the article."
        />
      </label>

      <div className={editorStyles.field}>
        <span>Cover image</span>
        <span className={editorStyles.fieldHint}>
          The large image at the top of the article and on the front page.
          Wide images work best (16:9).
        </span>
        {coverImageUrl ? (
          <img
            src={coverImageUrl}
            alt="Cover preview"
            className={editorStyles.coverPreview}
          />
        ) : (
          <button
            type="button"
            className={editorStyles.coverEmpty}
            onClick={() => coverInputRef.current?.click()}
          >
            {uploading === "cover" ? "Uploading…" : "Click to upload a cover image"}
          </button>
        )}
        <div className={editorStyles.coverActions}>
          <label className={editorStyles.fileButton}>
            {coverImageUrl ? "Change cover" : "Upload cover"}
            <input
              ref={coverInputRef}
              type="file"
              accept="image/*"
              disabled={uploading === "cover"}
              onChange={(e) => {
                void onCoverFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {coverImageUrl && (
            <button
              type="button"
              className={editorStyles.secondaryButton}
              onClick={() => setCoverImageUrl("")}
            >
              Remove
            </button>
          )}
          {uploading === "cover" && <span>Uploading…</span>}
        </div>
        <input
          type="text"
          value={coverImageUrl}
          onChange={(e) => setCoverImageUrl(e.target.value)}
          placeholder="Or paste an image URL"
          aria-label="Cover image URL"
        />
      </div>

      <div className={editorStyles.field}>
        <span>Body</span>
        <span className={editorStyles.fieldHint}>
          Markdown: # headings, **bold**, *italic*, [links](url),
          ![images](url). A lone image line becomes a captioned figure.
        </span>
        <div className={editorStyles.bodyToolbar}>
          <div className={editorStyles.segmented} role="tablist" aria-label="Body view">
            <button
              type="button"
              role="tab"
              aria-selected={tab === "write"}
              className={tab === "write" ? editorStyles.active : ""}
              onClick={() => setTab("write")}
            >
              Write
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === "preview"}
              className={tab === "preview" ? editorStyles.active : ""}
              onClick={() => setTab("preview")}
            >
              Preview
            </button>
          </div>
          <label className={editorStyles.fileButton}>
            Insert image
            <input
              ref={bodyInputRef}
              type="file"
              accept="image/*"
              disabled={uploading === "body"}
              onChange={(e) => {
                void onBodyImageFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
          {uploading === "body" && <span>Uploading…</span>}
          <span className={editorStyles.wordCount}>
            {words} words · {minutes} min read
          </span>
        </div>
        {tab === "write" ? (
          <textarea
            ref={contentRef}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            className={editorStyles.bodyTextarea}
            placeholder="Write the article here…"
            aria-label="Article body"
            required
          />
        ) : (
          <div className={editorStyles.previewPane}>
            <div className={articleStyles.magazineRoot}>
              <div className={editorStyles.previewInner}>
                <header className={articleStyles.articleHeader}>
                  <p className={articleStyles.articleEyebrow}>
                    Lakisa · Magazine
                  </p>
                  <h1 className={articleStyles.articleTitle}>
                    {title.trim() || "Untitled"}
                  </h1>
                  {excerpt.trim() && (
                    <p className={articleStyles.articleExcerpt}>{excerpt.trim()}</p>
                  )}
                  <p className={articleStyles.articleMeta}>
                    <span>
                      By <strong>Lakisa</strong>
                    </span>
                    <span aria-hidden="true" className={articleStyles.metaDot}>
                      ·
                    </span>
                    <span>
                      {formatDate(
                        article?.publishedAt ?? article?.createdAt ?? null,
                      )}
                    </span>
                    <span aria-hidden="true" className={articleStyles.metaDot}>
                      ·
                    </span>
                    <span>
                      <Eye size={13} /> {article?.views ?? 0} views
                    </span>
                    <span aria-hidden="true" className={articleStyles.metaDot}>
                      ·
                    </span>
                    <span>
                      {minutes} min read
                    </span>
                  </p>
                </header>
                {coverImageUrl && (
                  <div className={articleStyles.articleHero}>
                    <img
                      src={coverImageUrl}
                      alt={title.trim() || "Cover"}
                      className={articleStyles.articleCover}
                    />
                  </div>
                )}
                {previewError ? (
                  <p className={editorStyles.errorText}>{previewError}</p>
                ) : (
                  <div
                    className={articleStyles.articleBody}
                    dangerouslySetInnerHTML={{ __html: previewHtml }}
                  />
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      <label className={editorStyles.field} style={{ maxWidth: 320 }}>
        Status
        <span className={editorStyles.fieldHint}>
          Draft is visible only to admins. Published appears on /magazine at
          once.
        </span>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "draft" | "published")}
        >
          <option value="draft">Draft (only admins see it)</option>
          <option value="published">Published (public on /magazine)</option>
        </select>
      </label>

      {error && (
        <p role="alert" className={editorStyles.errorText}>
          {error}
        </p>
      )}

      <div className={editorStyles.footerActions}>
        <button
          type="submit"
          className={editorStyles.primaryButton}
          disabled={saving}
        >
          {saving ? "Saving…" : article ? "Save changes" : "Create article"}
        </button>
        {article && (
          <>
            <button
              type="button"
              className={editorStyles.dangerButton}
              disabled={deleting}
              onClick={() => {
                if (confirmDelete) void remove();
                else setConfirmDelete(true);
              }}
            >
              {deleting
                ? "Deleting…"
                : confirmDelete
                  ? "Click again to delete"
                  : "Delete article"}
            </button>
            {confirmDelete && !deleting && (
              <button type="button" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
            )}
            {status === "published" && (
              <a href={`/magazine/${article.slug}`} target="_blank" rel="noreferrer">
                View public page
              </a>
            )}
          </>
        )}
      </div>
    </form>
  );
}
