// Direct upload to Cloudflare R2 via presigned PUT URLs, with a
// same-origin proxy fallback for small files.
//
// How it works: the browser asks /api/uploads/presign for a signed PUT
// URL, then PUTs the file straight to R2 — the bytes never pass through
// Vercel, so the 4.5 MB request-body cap does not apply. The upload
// uses XMLHttpRequest (fetch has no upload progress), so the caller
// gets a real percent for the progress bar. The returned URL is the
// same-origin serving URL (/api/r2/…, /api/video/…), so the file loads
// as a texture, video or GLB without CORS, exactly as if it had come
// through the proxy.
//
// Routing rule: files up to 4.5 MB keep using the server proxy
// (same-origin, no CORS involved, no extra moving parts); heavier
// files go direct. When the direct PUT fails — the usual cause is a
// missing CORS policy on the bucket, which makes the preflight fail
// and XHR report status 0 — the caller gets a typed error and shows a
// clear message instead of the raw browser "Failed to fetch". Heavy
// files are never sent to the proxy: Vercel would reject them with a
// plain-text 413 after a wasted upload.
export type DirectUploadKind = "image" | "video" | "sculpture" | "audio";

// Vercel's request-body cap: files up to this size go through the
// proxy; heavier files go direct to R2.
export const PROXY_SIZE_LIMIT = 4_500_000;

// The presign route answered 501: no bucket is configured, so there
// is no direct upload at all. Callers that have a legacy fallback
// (artwork images) return null; the others surface a plain error.
export class DirectUploadNotConfiguredError extends Error {
  constructor() {
    super("Direct upload is not configured.");
    this.name = "DirectUploadNotConfiguredError";
  }
}

// The PUT itself failed (network error, CORS preflight rejected, or a
// non-2xx answer from R2). The file never reached storage.
export class DirectUploadFailedError extends Error {
  constructor() {
    super("The direct upload could not reach storage.");
    this.name = "DirectUploadFailedError";
  }
}

type PresignResponse = {
  uploadUrl: string;
  url: string;
  publicUrl?: string;
  key: string;
  contentType: string;
};

async function requestPresignedUrl(file: File, kind: DirectUploadKind): Promise<PresignResponse> {
  let response: Response;
  try {
    response = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size, kind }),
    });
  } catch {
    throw new DirectUploadFailedError();
  }
  if (response.status === 501) throw new DirectUploadNotConfiguredError();
  const text = await response.text();
  let result: { error?: string } & Partial<PresignResponse> = {};
  try {
    result = text ? (JSON.parse(text) as typeof result) : {};
  } catch {
    result = {};
  }
  if (!response.ok || !result.uploadUrl || !result.url || !result.contentType) {
    throw new Error(result.error ?? "Could not prepare this upload.");
  }
  return result as PresignResponse;
}

// PUT the file to R2. The Content-Type header must match the type the
// presign route signed, or R2 rejects the signature — so the signed
// type from the response is used, not file.type.
function putToR2(
  uploadUrl: string,
  file: File,
  contentType: string,
  onProgress?: (percent: number) => void,
): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("PUT", uploadUrl);
    xhr.setRequestHeader("Content-Type", contentType);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new DirectUploadFailedError());
    };
    xhr.onerror = () => reject(new DirectUploadFailedError());
    xhr.ontimeout = () => reject(new DirectUploadFailedError());
    // No timeout: a 200 MB upload on a slow connection takes a while,
    // and the presigned URL itself is valid for an hour.
    xhr.timeout = 0;
    xhr.send(file);
  });
}

// Upload one file straight to R2 and return its same-origin serving
// URL. The caller keeps the returned URL exactly as the proxy would
// have returned it, so nothing downstream changes.
export async function uploadDirectToR2(
  file: File,
  kind: DirectUploadKind,
  onProgress?: (percent: number) => void,
): Promise<string> {
  const presigned = await requestPresignedUrl(file, kind);
  if (onProgress) onProgress(0);
  await putToR2(presigned.uploadUrl, file, presigned.contentType, onProgress);
  if (onProgress) onProgress(100);
  return presigned.url;
}

// Upload with automatic routing: small files go through the server
// proxy (the proxyUpload callback does the existing FormData POST and
// returns the serving URL); heavy files go direct to R2. Typed errors
// from the direct path propagate so the caller can map them to a
// readable message.
export async function uploadFileToR2(
  file: File,
  kind: DirectUploadKind,
  proxyUpload: () => Promise<string>,
  onProgress?: (percent: number) => void,
): Promise<string> {
  if (file.size <= PROXY_SIZE_LIMIT) return proxyUpload();
  return uploadDirectToR2(file, kind, onProgress);
}
