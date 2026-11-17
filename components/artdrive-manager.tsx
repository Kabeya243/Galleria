"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ArtDrive manager, manager only (the admin page renders this section
// only for the manager; the API routes check again server-side). A
// Drive-style file list: upload files, copy the share link to send to
// anyone, open the share page, download, delete. Files up to 4.5 MB go
// through the server proxy; heavier files go straight to R2 with a
// presigned PUT URL (the same split the artwork uploader uses), with a
// real progress bar on the direct path.

type ArtDriveFileRow = {
  id: string;
  token: string;
  fileName: string;
  mimeType: string;
  size: number;
  downloads: number;
  createdAt: string;
  shareLink: string;
};

type UploadState = {
  name: string;
  progress: number;
  error?: string;
};

const PROXY_LIMIT = 4_500_000;

const btnBase: React.CSSProperties = {
  padding: "6px 12px",
  borderRadius: 6,
  fontSize: 12,
  fontWeight: 600,
  cursor: "pointer",
  border: "1px solid var(--ad-border)",
  background: "transparent",
  color: "var(--ad-ink)",
};

const btnPrimary: React.CSSProperties = {
  ...btnBase,
  background: "var(--ad-btn-bg)",
  borderColor: "transparent",
  color: "var(--ad-btn-ink)",
};

const btnDanger: React.CSSProperties = {
  ...btnBase,
  background: "var(--ad-down)",
  borderColor: "transparent",
  color: "#ffffff",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

function fileIcon(mimeType: string, fileName: string): string {
  if (mimeType.startsWith("image/")) return "🖼️";
  if (mimeType === "application/pdf") return "📕";
  if (mimeType.includes("word") || fileName.endsWith(".docx") || fileName.endsWith(".doc")) return "📝";
  if (mimeType.startsWith("video/")) return "🎬";
  if (mimeType.startsWith("audio/")) return "🎵";
  if (mimeType.includes("zip") || mimeType.includes("archive")) return "🗜️";
  return "📄";
}

export default function ArtDriveManager() {
  const [files, setFiles] = useState<ArtDriveFileRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadState[]>([]);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/artdrive");
      if (!res.ok) return;
      const data = await res.json();
      setFiles(data.files ?? []);
    } catch {
      // The list stays empty on a transient failure; the upload path
      // still works and the next load retries.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  function setUploadProgress(name: string, progress: number, error?: string) {
    setUploads((prev) => {
      const next = prev.filter((u) => u.name !== name);
      if (progress >= 100 && !error) return next;
      return [...next, { name, progress, error }];
    });
  }

  async function uploadSmall(file: File) {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/admin/artdrive", { method: "POST", body: form });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error ?? "Could not upload this file.");
    return data.file as ArtDriveFileRow;
  }

  function uploadLarge(file: File): Promise<ArtDriveFileRow> {
    return new Promise(async (resolve, reject) => {
      try {
        const presignRes = await fetch("/api/admin/artdrive/presign", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileName: file.name, size: file.size, mimeType: file.type }),
        });
        const presign = await presignRes.json().catch(() => ({}));
        if (!presignRes.ok) throw new Error(presign.error ?? "Could not prepare this upload.");

        await new Promise<void>((resolvePut, rejectPut) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", presign.uploadUrl);
          xhr.setRequestHeader("Content-Type", file.type || "application/octet-stream");
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              setUploadProgress(file.name, Math.round((event.loaded / event.total) * 100));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolvePut();
            else rejectPut(new Error("The direct upload could not reach storage."));
          };
          xhr.onerror = () => rejectPut(new Error("The direct upload could not reach storage."));
          xhr.send(file);
        });

        const confirmRes = await fetch("/api/admin/artdrive/confirm", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            token: presign.token,
            key: presign.key,
            fileName: file.name,
            size: file.size,
            mimeType: file.type,
          }),
        });
        const confirm = await confirmRes.json().catch(() => ({}));
        if (!confirmRes.ok) throw new Error(confirm.error ?? "Could not finish this upload.");
        resolve(confirm.file as ArtDriveFileRow);
      } catch (err) {
        reject(err instanceof Error ? err : new Error("Could not upload this file."));
      }
    });
  }

  async function uploadFiles(list: FileList | File[]) {
    const picked = Array.from(list);
    if (picked.length === 0) return;
    setError(null);
    setNotice(null);
    for (const file of picked) {
      setUploadProgress(file.name, 0);
      try {
        const row = file.size <= PROXY_LIMIT ? await uploadSmall(file) : await uploadLarge(file);
        setUploadProgress(file.name, 100);
        setFiles((prev) => [row, ...prev]);
        setNotice(`“${file.name}” is shared: ${row.shareLink}`);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Could not upload this file.";
        setUploadProgress(file.name, 0, message);
        setError(message);
      }
    }
  }

  async function copyLink(file: ArtDriveFileRow) {
    try {
      await navigator.clipboard.writeText(file.shareLink);
      setCopied(file.id);
      setTimeout(() => setCopied((c) => (c === file.id ? null : c)), 2000);
    } catch {
      setError("Could not copy the link. Copy it from the address bar of the share page instead.");
    }
  }

  async function deleteFile(file: ArtDriveFileRow) {
    setDeleting(file.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/artdrive/${file.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Could not delete this file.");
      }
      setFiles((prev) => prev.filter((f) => f.id !== file.id));
      setConfirming(null);
      setNotice(`“${file.fileName}” deleted. Its share link no longer works.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete this file.");
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={(e) => {
          if (e.target.files) void uploadFiles(e.target.files);
          e.target.value = "";
        }}
      />

      {/* Upload zone, Drive-style: a New button plus drag and drop. */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (e.dataTransfer.files.length > 0) void uploadFiles(e.dataTransfer.files);
        }}
        style={{
          border: `2px dashed ${dragging ? "var(--ad-gold, #c9a227)" : "var(--ad-border)"}`,
          borderRadius: 12,
          padding: "28px 20px",
          textAlign: "center",
          marginBottom: 24,
          background: dragging ? "var(--ad-hover, rgba(201,162,39,0.08))" : "transparent",
        }}
      >
        <p style={{ margin: "0 0 4px", fontSize: 15, fontWeight: 600 }}>
          Drop files here, or upload from your computer
        </p>
        <p style={{ margin: "0 0 16px", fontSize: 13, opacity: 0.7 }}>
          Anyone with the share link can open or download the file. No account needed. 100 MB maximum per file.
        </p>
        <button type="button" style={btnPrimary} onClick={() => inputRef.current?.click()}>
          ＋ New upload
        </button>
      </div>

      {uploads.length > 0 && (
        <div style={{ marginBottom: 16 }}>
          {uploads.map((u) => (
            <div key={u.name} style={{ marginBottom: 8, fontSize: 13 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                <span>{u.name}</span>
                <span>{u.error ? u.error : `${u.progress}%`}</span>
              </div>
              <div style={{ height: 6, borderRadius: 3, background: "var(--ad-border)" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${u.error ? 100 : u.progress}%`,
                    borderRadius: 3,
                    background: u.error ? "var(--ad-down)" : "var(--ad-gold, #c9a227)",
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      {error && (
        <p style={{ color: "var(--ad-down)", fontSize: 13, margin: "0 0 16px" }}>{error}</p>
      )}
      {notice && (
        <p style={{ fontSize: 13, margin: "0 0 16px", overflowWrap: "anywhere" }}>{notice}</p>
      )}

      {loading ? (
        <p style={{ fontSize: 14, opacity: 0.7 }}>Loading your files…</p>
      ) : files.length === 0 ? (
        <p style={{ fontSize: 14, opacity: 0.7 }}>
          No files shared yet. Upload your first file and send its link to anyone.
        </p>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
            <thead>
              <tr style={{ textAlign: "left", opacity: 0.7, fontSize: 12 }}>
                <th style={{ padding: "8px 8px 8px 0" }}>Name</th>
                <th style={{ padding: 8 }}>Size</th>
                <th style={{ padding: 8 }}>Shared</th>
                <th style={{ padding: 8 }}>Downloads</th>
                <th style={{ padding: "8px 0 8px 8px", textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {files.map((file) => (
                <tr key={file.id} style={{ borderTop: "1px solid var(--ad-border)" }}>
                  <td style={{ padding: "10px 8px 10px 0" }}>
                    <a
                      href={file.shareLink}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: "inherit", textDecoration: "none", overflowWrap: "anywhere" }}
                    >
                      {fileIcon(file.mimeType, file.fileName)} {file.fileName}
                    </a>
                  </td>
                  <td style={{ padding: 10, whiteSpace: "nowrap" }}>{formatSize(file.size)}</td>
                  <td style={{ padding: 10, whiteSpace: "nowrap" }}>{formatDate(file.createdAt)}</td>
                  <td style={{ padding: 10 }}>{file.downloads}</td>
                  <td style={{ padding: "10px 0 10px 8px", textAlign: "right", whiteSpace: "nowrap" }}>
                    <button type="button" style={btnBase} onClick={() => void copyLink(file)}>
                      {copied === file.id ? "Copied ✓" : "Copy link"}
                    </button>{" "}
                    <a
                      href={`/api/artdrive/${file.token}/download`}
                      download={file.fileName}
                      style={{ ...btnBase, textDecoration: "none", display: "inline-block" }}
                    >
                      Download
                    </a>{" "}
                    {confirming === file.id ? (
                      <>
                        <button
                          type="button"
                          style={btnDanger}
                          disabled={deleting === file.id}
                          onClick={() => void deleteFile(file)}
                        >
                          {deleting === file.id ? "Deleting…" : "Confirm delete"}
                        </button>{" "}
                        <button type="button" style={btnBase} onClick={() => setConfirming(null)}>
                          Cancel
                        </button>
                      </>
                    ) : (
                      <button type="button" style={btnBase} onClick={() => setConfirming(file.id)}>
                        Delete
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
