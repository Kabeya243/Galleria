// Pure R2 URL helpers (no AWS SDK here, so client components can use
// them too). The key is always under uploads/<userId>/<uuid>.<ext>.

// The public URL of an artwork stored in R2. The key is always under
// uploads/<userId>/<uuid>.<ext>, so a stored image URL is easy to recognise.
export function isR2ImageUrl(url: string): boolean {
  const base = (process.env.R2_PUBLIC_URL ?? "").replace(/\/$/, "");
  if (!base) return false;
  return url.startsWith(`${base}/uploads/`);
}

// The key inside any R2 public URL, whatever host it was stored under.
// The public host (R2_PUBLIC_URL) has changed over the life of the
// platform, so older stored URLs can point at a host that no longer
// serves the object — the cover then 404s and the card shows a black
// box. Returns null when the URL is not an R2 uploads URL.
export function r2KeyFromUrl(url: string): string | null {
  const match = /\/uploads\/([A-Za-z0-9_-]+)\/([a-f0-9-]{36}\.(?:png|jpe?g|webp|avif|heic|heif))(?:[?#].*)?$/i.exec(
    url,
  );
  if (!match) return null;
  return `uploads/${match[1]}/${match[2]}`;
}

// Normalize a stored image URL for serving: any R2 public URL (any
// host, current or stale) becomes the same-origin /api/r2/<key> URL,
// which serves the object from the bucket with the current
// credentials. Already-serving URLs and non-R2 URLs pass through
// unchanged. Apply it wherever a cover image is listed.
export function toServingImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  if (url.startsWith("/api/r2/")) return url;
  const key = r2KeyFromUrl(url);
  if (key) return `/api/r2/${key}`;
  return url;
}
