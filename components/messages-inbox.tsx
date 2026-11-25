"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import RedesignShell from "@/components/redesign-shell";
import { useLocale, LOCALE_TAGS } from "@/lib/i18n";
import page from "./redesign-pages.module.css";
import dash from "./redesign-dashboard.module.css";

// Polling interval for the conversation list: no WebSocket, a plain
// GET every few seconds, paused while the tab is hidden (see the
// effect below).
const POLL_MS = 5000;

// Inbox (/messages, Phase 2, Nov 2026): the signed-in user's
// conversations, newest first. Each row shows the other person, the
// inquiry context when there is one, the last message and the unread
// count. Messages are private: the API only ever returns
// conversations the reader belongs to.

type Conversation = {
  id: string;
  otherUser: { id: string; name: string };
  exhibitionId: string | null;
  exhibitionTitle: string | null;
  artworkId: string | null;
  artworkTitle: string | null;
  lastMessage: { body: string; senderId: string; createdAt: string } | null;
  unreadCount: number;
  updatedAt: string;
};

function initial(name: string) {
  return (name.trim().charAt(0) || "?").toUpperCase();
}

function contextLabel(c: Conversation) {
  if (c.artworkTitle) return `About “${c.artworkTitle}”${c.exhibitionTitle ? ` in ${c.exhibitionTitle}` : ""}`;
  if (c.exhibitionTitle) return `About “${c.exhibitionTitle}”`;
  return null;
}

export default function MessagesInbox({
  user,
  ownExhibitionCount,
}: {
  user: { id: string; name: string; email: string; avatarUrl?: string | null; isAdmin?: boolean };
  ownExhibitionCount: number;
}) {
  const { locale } = useLocale();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Signature of the last list applied, so a poll that returns the
  // same conversations does not rewrite state.
  const listSignature = useRef("");

  // Live inbox: the first load lists the conversations, then a poll
  // every few seconds fetches GET /api/messages again so new
  // conversations and unread counts appear without reloading the page.
  // Polling stops while the tab is hidden and resumes (with an
  // immediate fetch) when it becomes visible again. No WebSocket.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load(initial: boolean) {
      try {
        const response = await fetch("/api/messages", { credentials: "same-origin", cache: "no-store" });
        if (!response.ok) throw new Error("Could not load your messages.");
        const result = (await response.json()) as { conversations: Conversation[] };
        if (cancelled) return;
        const next = result.conversations ?? [];
        const signature = next
          .map((c) => `${c.id}:${c.updatedAt}:${c.unreadCount}`)
          .join("|");
        if (signature !== listSignature.current) {
          listSignature.current = signature;
          setConversations(next);
        }
      } catch {
        if (!cancelled && initial) setError("Could not load your messages. Try again.");
      } finally {
        if (!cancelled && initial) setLoading(false);
      }
    }

    function start() {
      if (timer !== null) return;
      timer = setInterval(() => {
        if (document.visibilityState === "visible") void load(false);
      }, POLL_MS);
    }
    function stop() {
      if (timer !== null) {
        clearInterval(timer);
        timer = null;
      }
    }
    function onVisibility() {
      if (document.visibilityState === "visible") {
        void load(false);
        start();
      } else {
        stop();
      }
    }

    void load(true);
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  const time = (value: string) =>
    new Intl.DateTimeFormat(LOCALE_TAGS[locale], { day: "numeric", month: "short" }).format(new Date(value));

  return (
    <RedesignShell user={user} active="messages" exhibitionCount={ownExhibitionCount}>
      <div className={page.pageHead}>
        <div>
          <h1>Messages</h1>
          <p className={page.pageSub}>
            Private conversations with other people on Lakisa, and inquiries about exhibitions and artworks.
          </p>
        </div>
      </div>

      {error && (
        <p role="alert" style={{ color: "var(--rd-red)", fontSize: 13, margin: 0 }}>
          {error}
        </p>
      )}

      {loading ? (
        <p className={dash.empty}>Loading your messages…</p>
      ) : conversations.length === 0 ? (
        <section className={`${dash.card} ${page.emptyState}`}>
          <h3>No messages yet</h3>
          <p>
            When someone writes to you, or you write to an exhibitor, the conversation
            shows up here.
          </p>
        </section>
      ) : (
        <section className={dash.card} aria-label="Conversations">
          <ul className={page.rows}>
            {conversations.map((c) => {
              const context = contextLabel(c);
              return (
                <li key={c.id} className={page.row}>
                  <span className={page.rowAvatar} aria-hidden="true">
                    {initial(c.otherUser.name)}
                  </span>
                  <span className={page.rowMain}>
                    <span className={page.rowTitle}>
                      <Link href={`/messages/${c.id}`}>{c.otherUser.name}</Link>
                    </span>
                    {context && <span className={page.rowSub}>{context}</span>}
                    {c.lastMessage && (
                      <span className={page.rowSub} style={c.unreadCount > 0 ? { color: "var(--rd-text)", fontWeight: 700 } : undefined}>
                        {c.lastMessage.body}
                      </span>
                    )}
                  </span>
                  <span className={page.rowSide}>
                    <span className={page.rowValue}>
                      <span>{time(c.updatedAt)}</span>
                    </span>
                    {c.unreadCount > 0 && <span className={page.msgUnread}>{c.unreadCount}</span>}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </RedesignShell>
  );
}
