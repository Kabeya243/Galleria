"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import RedesignShell from "@/components/redesign-shell";
import Avatar from "@/components/avatar";
import BrandLogo from "@/components/brand-logo";
import PublicNav from "@/components/public-nav";
import { LOCALE_TAGS, useLocale, useT, type Locale } from "@/lib/i18n";
import styles from "./feed-page.module.css";
import page from "./redesign-pages.module.css";
import dash from "./redesign-dashboard.module.css";
import { coverImageRef, handleCoverImageError } from "@/lib/image-fallback";
import { toServingImageUrl } from "@/lib/r2-urls";

// Publication feed (/feed) — adapted from the standalone scaffold
// (drive-homepage-explore/src/app/galleries/feed.tsx): same behaviour
// — cursor pagination, 12 per page, like/unlike, inline errors, no
// invented data — but inside the SANAA shell, with the site-wide
// language from lib/i18n.ts instead of the scaffold's own switch, and
// no scaffold header/footer of its own. The feed API is public; the
// like endpoints need a signed-in session (401 → inline sign-in note).
// The User model has no avatar field, so the artist-initial fallback
// from the scaffold is kept.
//
// Phase 2: the signed-in feed renders in the redesign shell with the
// prototype's post cards. The signed-out (public) feed keeps its own
// header and the original card styles — the redesign tokens only exist
// inside the shell.

type Post = {
  id: string;
  coverImageUrl: string;
  createdAt: string;
  title: string;
  artist: { name: string | null; avatarUrl: string | null };
  likeCount: number;
  likedByMe: boolean;
  visitUrl: string;
};

type FeedResponse = { posts: Post[]; nextCursor: string | null };

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(value));
}

// The feed API is a Python serverless function: a cold start can be
// slow or fail once (timeout, 5xx) while the next call succeeds, so a
// single failed fetch must not become the error screen. Retry transient
// failures (network error, abort, 5xx) up to 3 attempts with a growing
// delay; a 4xx will not heal on retry, so it stops immediately.
const FEED_ATTEMPTS = 3;
const FEED_RETRY_DELAY_MS = [800, 2000];
const FEED_TIMEOUT_MS = 15000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchFeedPage(nextCursor: string | null): Promise<FeedResponse> {
  let lastError: unknown = new Error("Feed request failed.");
  for (let attempt = 0; attempt < FEED_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await sleep(FEED_RETRY_DELAY_MS[attempt - 1] ?? 2000);
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);
    let retryable = true;
    try {
      const url = new URL("/api/social/feed", window.location.origin);
      if (nextCursor) url.searchParams.set("cursor", nextCursor);
      const response = await fetch(url, {
        credentials: "same-origin",
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        retryable = response.status >= 500 || response.status === 429;
        throw new Error("Feed request failed.");
      }
      return (await response.json()) as FeedResponse;
    } catch (error) {
      lastError = error;
      if (!retryable) break;
    } finally {
      window.clearTimeout(timer);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Feed request failed.");
}

function FeedList({ redesign = false }: { redesign?: boolean }) {
  const t = useT();
  const { locale } = useLocale();
  const [posts, setPosts] = useState<Post[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [actionError, setActionError] = useState("");
  const [busyPosts, setBusyPosts] = useState<Set<string>>(() => new Set());

  const loadPage = useCallback(async (nextCursor: string | null, append: boolean) => {
    setError(false);
    setActionError("");
    append ? setLoadingMore(true) : setLoading(true);
    try {
      const result = await fetchFeedPage(nextCursor);
      setPosts((current) => {
        const merged = append ? [...current, ...result.posts] : result.posts;
        return [...new Map(merged.map((post) => [post.id, post])).values()];
      });
      setCursor(result.nextCursor);
      setHasMore(Boolean(result.nextCursor));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  useEffect(() => {
    void loadPage(null, false);
  }, [loadPage]);

  const toggleLike = async (post: Post) => {
    setActionError("");
    setBusyPosts((current) => new Set(current).add(post.id));
    try {
      const response = await fetch(
        `/api/social/posts/${encodeURIComponent(post.id)}/like`,
        { method: post.likedByMe ? "DELETE" : "POST", credentials: "same-origin" },
      );
      if (response.status === 401) {
        setActionError(t("feed", "signIn"));
        return;
      }
      if (!response.ok) throw new Error("Like request failed.");
      const updated = response.status === 204 ? null : (await response.json()) as { likeCount: number };
      setPosts((current) =>
        current.map((item) =>
          item.id === post.id
            ? {
                ...item,
                likedByMe: !post.likedByMe,
                likeCount: updated?.likeCount ?? Math.max(0, item.likeCount - 1),
              }
            : item,
        ),
      );
    } catch {
      setActionError(t("feed", "likeError"));
    } finally {
      setBusyPosts((current) => {
        const next = new Set(current);
        next.delete(post.id);
        return next;
      });
    }
  };

  if (redesign) {
    return (
      <div className={page.sectionStack}>
        {actionError && (
          <p role="status" style={{ color: "var(--rd-red)", fontSize: 13, margin: 0 }}>
            {actionError}
          </p>
        )}

        {loading && <p className={dash.empty}>{t("feed", "loading")}</p>}

        {!loading && error && (
          <div className={dash.card}>
            <p role="alert" style={{ margin: "0 0 12px" }}>{t("feed", "error")}</p>
            <button type="button" onClick={() => void loadPage(null, false)} className={page.btn}>
              {t("feed", "retry")}
            </button>
          </div>
        )}

        {!loading && !error && posts.length === 0 && <p className={dash.empty}>{t("feed", "empty")}</p>}

        {posts.map((post) => {
          const artistName = post.artist.name ?? "";
          return (
            <article key={post.id} className={`${dash.card} ${page.post}`}>
              <Avatar name={artistName} avatarUrl={post.artist.avatarUrl} className={page.postAvatar} />
              <div className={page.postBody}>
                <div className={page.postHead}>
                  <strong>{artistName}</strong>
                  <time dateTime={post.createdAt}>{formatDate(post.createdAt, locale)}</time>
                </div>
                <h2 style={{ margin: "6px 0 0", fontSize: 16, fontWeight: 700 }}>{post.title}</h2>
                <div className={page.postImage}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={toServingImageUrl(post.coverImageUrl) ?? post.coverImageUrl}
                    alt={post.title}
                    loading="lazy"
                    onError={handleCoverImageError} ref={coverImageRef}
                  />
                </div>
                <div className={page.postActions}>
                  <Link href={post.visitUrl} className={`${page.btn} ${page.btnCta}`}>
                    {t("feed", "visit")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void toggleLike(post)}
                    disabled={busyPosts.has(post.id)}
                    aria-label={`${post.likedByMe ? t("feed", "unlike") : t("feed", "like")}, ${post.likeCount}`}
                    aria-pressed={post.likedByMe}
                    className={`${page.postAction}${post.likedByMe ? ` ${page.postActionActive}` : ""}`}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      width="15"
                      height="15"
                      fill={post.likedByMe ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M20.8 8.7c0 4.1-8.8 10-8.8 10s-8.8-5.9-8.8-10a4.7 4.7 0 0 1 8.8-2.3 4.7 4.7 0 0 1 8.8 2.3Z"
                      />
                    </svg>
                    <span className={dash.tnum}>{post.likeCount}</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}

        {!loading && !error && hasMore && (
          <div>
            <button
              type="button"
              disabled={loadingMore}
              onClick={() => void loadPage(cursor, true)}
              className={page.btn}
            >
              {loadingMore ? t("feed", "loadingMore") : t("feed", "loadMore")}
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={styles.feedColumn}>
      {actionError && (
        <p role="status" className={styles.actionError}>
          {actionError}
        </p>
      )}

      {loading && <p className={styles.statusText}>{t("feed", "loading")}</p>}

      {!loading && error && (
        <div className={styles.errorBox}>
          <p role="alert">{t("feed", "error")}</p>
          <button type="button" onClick={() => void loadPage(null, false)} className={styles.retryButton}>
            {t("feed", "retry")}
          </button>
        </div>
      )}

      {!loading && !error && posts.length === 0 && <p className={styles.emptyBox}>{t("feed", "empty")}</p>}

      <div className={styles.postList}>
        {posts.map((post) => {
          const artistName = post.artist.name ?? "";
          return (
            <article key={post.id} className={styles.post}>
              <img src={toServingImageUrl(post.coverImageUrl) ?? post.coverImageUrl} alt={post.title} className={styles.cover} loading="lazy" onError={handleCoverImageError} ref={coverImageRef} />
              <div className={styles.postBody}>
                <div className={styles.artistRow}>
                  <Avatar name={artistName} avatarUrl={post.artist.avatarUrl} className={styles.avatar} />
                  <div className={styles.artistMeta}>
                    <p className={styles.artistName}>{artistName}</p>
                    <time dateTime={post.createdAt} className={styles.postDate}>
                      {formatDate(post.createdAt, locale)}
                    </time>
                  </div>
                </div>

                <h2 className={styles.postTitle}>{post.title}</h2>
                <div className={styles.postActions}>
                  <Link href={post.visitUrl} className={styles.visitButton}>
                    {t("feed", "visit")}
                  </Link>
                  <button
                    type="button"
                    onClick={() => void toggleLike(post)}
                    disabled={busyPosts.has(post.id)}
                    aria-label={`${post.likedByMe ? t("feed", "unlike") : t("feed", "like")}, ${post.likeCount}`}
                    aria-pressed={post.likedByMe}
                    className={styles.likeButton}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill={post.likedByMe ? "currentColor" : "none"}
                      stroke="currentColor"
                      strokeWidth="1.7"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M20.8 8.7c0 4.1-8.8 10-8.8 10s-8.8-5.9-8.8-10a4.7 4.7 0 0 1 8.8-2.3 4.7 4.7 0 0 1 8.8 2.3Z"
                      />
                    </svg>
                    <span>{post.likeCount}</span>
                  </button>
                </div>
              </div>
            </article>
          );
        })}
      </div>

      {!loading && !error && hasMore && (
        <div className={styles.loadMoreWrap}>
          <button
            type="button"
            disabled={loadingMore}
            onClick={() => void loadPage(cursor, true)}
            className={styles.loadMoreButton}
          >
            {loadingMore ? t("feed", "loadingMore") : t("feed", "loadMore")}
          </button>
        </div>
      )}
    </div>
  );
}

export default function FeedPage({
  user,
  ownExhibitionCount,
}: {
  user: { id: string; name: string; email: string; isAdmin?: boolean } | null;
  ownExhibitionCount: number;
}) {
  const t = useT();

  // Visitors see the public header, like /explore — no account needed
  // to read the feed; liking asks them to sign in, inline.
  if (!user) {
    return (
      <main className="galleries-page">
        <header className="galleries-header">
          <Link className="brand-lockup" href="/">
            <BrandLogo variant="horizontal" height={52} />
          </Link>
          <PublicNav
            links={[
              { href: "/galleries", label: t("explore", "galleries") },
              { href: "/register", label: t("explore", "createAccount") },
              { href: "/login", label: t("explore", "signIn"), primary: true },
            ]}
          />
        </header>

        <section className="galleries-intro">
          <p className="eyebrow">{t("feed", "eyebrow")}</p>
          <h1>{t("feed", "title")}</h1>
          <p>{t("feed", "copy")}</p>
        </section>

        <section aria-label={t("feed", "feedLabel")}>
          <FeedList />
        </section>

        <footer className={styles.pageFooter}>
          <span>{t("common", "footerRights")}</span>
        </footer>
      </main>
    );
  }

  return (
    <RedesignShell user={user} active="feed" exhibitionCount={ownExhibitionCount}>
      <div className={page.pageHead}>
        <div>
          <h1>{t("feed", "title")}</h1>
          <p className={page.pageSub}>{t("feed", "copy")}</p>
        </div>
      </div>
      <section aria-label={t("feed", "feedLabel")}>
        <FeedList redesign />
      </section>
    </RedesignShell>
  );
}
