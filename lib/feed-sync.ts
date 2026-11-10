// Publication feed sync (chantier 3/5): after an exhibition is published or
// unpublished, the FastAPI feed API (/api/social/*, served on this same
// deployment through the vercel.json rewrite) must learn about it, so the
// /feed page stays in sync with what is actually public.
//
// Fail-soft by design: every webhook call is wrapped in try/catch with a
// short timeout, and a failure is only logged server-side (console.error).
// Publishing an exhibition must never fail because the feed is down, slow,
// or misconfigured — the webhook is a notification, not part of the publish.
//
// The webhook runs server-side only, never from the browser: the internal
// key (SOCIAL_INTERNAL_API_KEY) must never reach the client.

export type FeedSyncInput = {
  exhibitionId: string;
  authorId: string;
  /** Final status after the publish update ("public" or "draft"). */
  status: string;
  /** Final visibility after the publish update. */
  visibility: string;
  /** Whether the author wants the exhibition in the feed (default true). */
  publishToFeed: boolean;
  /** Absolute HTTPS cover URL, or null when the exhibition has no image. */
  coverImageUrl: string | null;
  /** Same-origin base URL, or the SOCIAL_API_URL override when set. */
  baseUrl: string;
  /** Value of SOCIAL_INTERNAL_API_KEY (undefined when not configured). */
  internalKey: string | undefined;
};

export type FeedSyncResult =
  | "published"
  | "unpublished"
  | "skipped-no-cover"
  | "skipped-no-key";

/** Webhook base URL: the SOCIAL_API_URL override wins, otherwise the origin
 * of the incoming request — the route runs on the same deployment as the
 * FastAPI function behind the /api/social/* rewrite. */
export function resolveFeedBaseUrl(requestUrl: string): string {
  const override = (process.env.SOCIAL_API_URL ?? "").replace(/\/+$/, "");
  if (override) return override;
  return new URL(requestUrl).origin;
}

/** Artwork image URLs are stored same-origin and relative (/api/r2/<key>,
 * legacy /api/uploads/...) or already absolute (direct R2 public URL). The
 * feed API requires an absolute HTTPS URL, so relative URLs are resolved
 * against the deployment origin. Anything that is not https (or not a URL
 * at all) resolves to null — the caller then skips the webhook instead of
 * sending a cover the API would reject. */
export function absoluteCoverUrl(raw: string | null | undefined, origin: string): string | null {
  if (!raw) return null;
  if (raw.startsWith("https://")) return raw;
  if (raw.startsWith("/")) return `${origin}${raw}`;
  return null;
}

async function postWebhook(
  fetchFn: typeof fetch,
  baseUrl: string,
  internalKey: string,
  path: "exhibition-published" | "exhibition-unpublished",
  body: unknown,
  timeoutMs: number,
): Promise<void> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchFn(`${baseUrl}/api/social/internal/${path}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Sanaa-Internal-Key": internalKey,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    if (!response.ok) {
      let detail = "";
      try {
        detail = await response.text();
      } catch {
        // The error body is best-effort logging only.
      }
      console.error(`[feed] ${path} failed (${response.status}): ${detail.slice(0, 300)}`);
    }
  } catch (error) {
    console.error(`[feed] ${path} failed:`, error);
  } finally {
    clearTimeout(timer);
  }
}

/** Notify the feed of a publish/unpublish outcome. Never throws: any
 * failure is logged and the publication result stands. */
export async function syncPublicationFeed(
  input: FeedSyncInput,
  fetchFn: typeof fetch = fetch,
  options: { timeoutMs?: number } = {},
): Promise<FeedSyncResult> {
  // 15 s: the Python feed function cold-starts on Vercel and a 5 s
  // timeout aborted the webhook before it could answer, so a publish
  // silently never reached the feed. The webhook is fail-soft, so a
  // slow call only delays the publish response a little.
  const timeoutMs = options.timeoutMs ?? 15000;
  const { exhibitionId, authorId, status, visibility, publishToFeed, coverImageUrl, baseUrl } = input;
  if (!input.internalKey) {
    console.warn("[feed] SOCIAL_INTERNAL_API_KEY is not set — skipping feed sync.");
    return "skipped-no-key";
  }

  const isPublicFeed = status === "public" && visibility === "public";
  if (!isPublicFeed) {
    // Private-link, password-protected, or back to draft: remove any
    // existing post (the endpoint is idempotent — a no-op when there is
    // none).
    await postWebhook(fetchFn, baseUrl, input.internalKey, "exhibition-unpublished", { exhibitionId }, timeoutMs);
    return "unpublished";
  }

  if (!publishToFeed) {
    // Public, but the author unchecked the feed: the endpoint deletes any
    // existing post for this exhibition.
    await postWebhook(
      fetchFn,
      baseUrl,
      input.internalKey,
      "exhibition-published",
      { exhibitionId, authorId, coverImageUrl: null, publishToFeed: false },
      timeoutMs,
    );
    return "unpublished";
  }

  if (!coverImageUrl) {
    // The feed requires a cover image: without one there is nothing to
    // publish, so skip — and never block the publication itself.
    console.warn(`[feed] Exhibition ${exhibitionId} has no artwork image — skipping feed publication.`);
    return "skipped-no-cover";
  }

  await postWebhook(
    fetchFn,
    baseUrl,
    input.internalKey,
    "exhibition-published",
    { exhibitionId, authorId, coverImageUrl, publishToFeed: true },
    timeoutMs,
  );
  return "published";
}
