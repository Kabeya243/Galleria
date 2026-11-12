"use client";

// Magazine editor (admin only): title, slug, excerpt, cover image,
// Markdown body with a live preview, draft/published status. The page
// that mounts this component already checked the magazine.manage
// permission server-side; the API routes check it again on every call.
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { SerializedMagazineArticle } from "@/lib/magazine";

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
  const [saved, setSaved] = useState(false);
  const contentRef = useRef<HTMLTextAreaElement>(null);

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
    }, 500);
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
    setSaved(false);
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
      setSaved(true);
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
    <form
      className="ad-card"
      onSubmit={save}
      style={{ marginTop: 16, display: "grid", gap: 16, maxWidth: 860 }}
    >
      <div style={{ display: "grid", gap: 12 }}>
        <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
          Title
          <input value={title} onChange={(e) => onTitleChange(e.target.value)} required />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
          Slug (the address: lakisa.art/magazine/{slug || "slug"})
          <input
            value={slug}
            onChange={(e) => {
              setSlug(e.target.value);
              setSlugTouched(true);
            }}
            placeholder="auto-generated from the title"
          />
        </label>
        <label style={{ display: "grid", gap: 4, fontSize: 14 }}>
          Excerpt (one or two lines, shown on the list)
          <textarea value={excerpt} onChange={(e) => setExcerpt(e.target.value)} rows={2} />
        </label>
        <div style={{ display: "grid", gap: 4, fontSize: 14 }}>
          <span>Cover image</span>
          {coverImageUrl && (
            <img
              src={coverImageUrl}
              alt="Cover preview"
              style={{ maxWidth: 480, borderRadius: 8, border: "1px solid var(--ad-border)" }}
            />
          )}
          <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13 }}>
            <input
              type="file"
              accept="image/*"
              disabled={uploading === "cover"}
              onChange={(e) => {
                void onCoverFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            {uploading === "cover" && <span>Uploading…</span>}
          </label>
          <input
            value={coverImageUrl}
            onChange={(e) => setCoverImageUrl(e.target.value)}
            placeholder="Or paste an image URL"
          />
        </div>
        <div style={{ display: "grid", gap: 4, fontSize: 14 }}>
          <span>
            Body (Markdown: # headings, **bold**, *italic*, [links](url), ![images](url))
          </span>
          <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setTab("write")}
              disabled={tab === "write"}
              style={{ fontWeight: tab === "write" ? 700 : 400 }}
            >
              Write
            </button>
            <button
              type="button"
              onClick={() => setTab("preview")}
              disabled={tab === "preview"}
              style={{ fontWeight: tab === "preview" ? 700 : 400 }}
            >
              Preview
            </button>
            <label style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13 }}>
              Insert image
              <input
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
          </div>
          {tab === "write" ? (
            <textarea
              ref={contentRef}
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={18}
              style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace" }}
              required
            />
          ) : (
            <div
              style={{
                border: "1px solid var(--ad-border)",
                borderRadius: 8,
                padding: 16,
                minHeight: 320,
                lineHeight: 1.7,
              }}
            >
              {previewError ? (
                <p>{previewError}</p>
              ) : (
                <div dangerouslySetInnerHTML={{ __html: previewHtml }} />
              )}
            </div>
          )}
        </div>
        <label style={{ display: "grid", gap: 4, fontSize: 14, maxWidth: 240 }}>
          Status
          <select value={status} onChange={(e) => setStatus(e.target.value as "draft" | "published")}>
            <option value="draft">Draft (only admins see it)</option>
            <option value="published">Published (public on /magazine)</option>
          </select>
        </label>
      </div>

      {error && (
        <p role="alert" style={{ color: "var(--ad-danger, #b3261e)", margin: 0 }}>
          {error}
        </p>
      )}
      {saved && <p style={{ margin: 0 }}>Saved.</p>}

      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <button type="submit" disabled={saving}>
          {saving ? "Saving…" : article ? "Save changes" : "Create article"}
        </button>
        {article && (
          <>
            <button
              type="button"
              disabled={deleting}
              onClick={() => {
                if (confirmDelete) void remove();
                else setConfirmDelete(true);
              }}
              style={{ color: "var(--ad-danger, #b3261e)" }}
            >
              {deleting ? "Deleting…" : confirmDelete ? "Click again to delete" : "Delete article"}
            </button>
            {confirmDelete && !deleting && (
              <button type="button" onClick={() => setConfirmDelete(false)}>
                Keep it
              </button>
            )}
            <a href={`/magazine/${article.slug}`} target="_blank" rel="noreferrer">
              View public page
            </a>
          </>
        )}
      </div>
    </form>
  );
}
