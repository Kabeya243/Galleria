"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useLocale, useT, LOCALE_TAGS } from "@/lib/i18n";
import styles from "./messages.module.css";

// Notification bell (Nov 2026): for signed-in users, in the sidebar.
// It polls GET /api/messages/unread every 30 seconds (paused while
// the tab is hidden, resumed when visible again) and shows the unread
// count. Clicking opens a dropdown with the unread conversations
// (sender, excerpt, date); opening one marks it read (the thread GET
// does that), so the item is dropped from the list at once. The panel
// is positioned fixed from the button's rectangle, so the collapsed
// 64 px sidebar rail never clips it.
type UnreadConversation = {
  id: string;
  otherUser: { id: string; name: string };
  excerpt: string;
  createdAt: string;
  unreadCount: number;
};

const POLL_MS = 30_000;

export default function NotificationBell() {
  const t = useT();
  const { locale } = useLocale();
  const [unreadCount, setUnreadCount] = useState(0);
  const [conversations, setConversations] = useState<UnreadConversation[]>([]);
  const [open, setOpen] = useState(false);
  const [panelPos, setPanelPos] = useState<{ top: number; left: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load() {
      try {
        const response = await fetch("/api/messages/unread", {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!response.ok || cancelled) return;
        const result = (await response.json()) as {
          unreadCount?: number;
          conversations?: UnreadConversation[];
        };
        if (cancelled) return;
        if (typeof result.unreadCount === "number") setUnreadCount(result.unreadCount);
        if (Array.isArray(result.conversations)) setConversations(result.conversations);
      } catch {
        // A failed poll just leaves the last count in place.
      }
    }

    function start() {
      if (timer !== null) return;
      timer = setInterval(() => {
        if (document.visibilityState === "visible") void load();
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
        void load();
        start();
      } else {
        stop();
      }
    }

    void load();
    start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // Close the panel on Escape or on a click outside the bell and panel.
  useEffect(() => {
    if (!open) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    function onPointer(event: MouseEvent) {
      const target = event.target as Node | null;
      if (
        target &&
        !buttonRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointer);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointer);
    };
  }, [open ]);

  function toggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setPanelPos({
        top: Math.min(rect.bottom + 8, window.innerHeight - 120),
        left: Math.min(rect.right + 8, window.innerWidth - 336),
      });
    }
    setOpen((value) => !value);
  }

  // Opening a conversation marks its messages read (GET
  // /api/messages/[id] does that), so drop it from the list at once.
  function markOpened(conversationId: string, count: number) {
    setConversations((current) => current.filter((c) => c.id !== conversationId));
    setUnreadCount((current) => Math.max(0, current - count));
    setOpen(false);
  }

  const time = (value: string) =>
    new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));

  return (
    <div className={styles.bellWrap}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.bellButton}
        aria-label={t("messagesSafety", "notifications")}
        aria-expanded={open}
        onClick={toggle}
      >
        <Bell size={17} />
        {unreadCount > 0 && (
          <span className={styles.bellCount}>{unreadCount > 99 ? "99+" : unreadCount}</span>
        )}
      </button>
      {open && panelPos && (
        <div
          ref={panelRef}
          className={styles.bellPanel}
          style={{ top: panelPos.top, left: Math.max(8, panelPos.left) }}
          role="menu"
        >
          <div className={styles.bellPanelHead}>
            <span>{t("messagesSafety", "notifications")}</span>
            <button type="button" onClick={() => setOpen(false)}>
              {t("common", "close")}
            </button>
          </div>
          {conversations.length === 0 ? (
            <p className={styles.bellEmpty}>{t("messagesSafety", "noUnread")}</p>
          ) : (
            <ul className={styles.bellList}>
              {conversations.map((c) => (
                <li key={c.id}>
                  <Link
                    className={styles.bellItem}
                    href={`/messages/${c.id}`}
                    onClick={() => markOpened(c.id, c.unreadCount)}
                  >
                    <span className={styles.bellItemTop}>
                      <span className={styles.bellItemName}>{c.otherUser.name}</span>
                      <span className={styles.bellItemTime}>{time(c.createdAt)}</span>
                    </span>
                    <span className={styles.bellItemExcerpt}>{c.excerpt}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          <Link className={styles.bellFoot} href="/messages" onClick={() => setOpen(false)}>
            {t("messagesSafety", "viewAllMessages")}
          </Link>
        </div>
      )}
    </div>
  );
}
