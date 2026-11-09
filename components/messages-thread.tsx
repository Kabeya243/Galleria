"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Sidebar from "@/components/sidebar";
import { useLocale, LOCALE_TAGS } from "@/lib/i18n";
import styles from "./messages.module.css";

// One conversation (/messages/[id]): the thread with the other person,
// the inquiry context when there is one, and a reply box. Opening the
// thread marks the reader's received messages as read (the API does
// that on GET). Only the two participants can open it.

type Message = {
  id: string;
  body: string;
  senderId: string;
  senderName: string;
  createdAt: string;
  readAt: string | null;
};

type Conversation = {
  id: string;
  otherUser: { id: string; name: string };
  exhibitionId: string | null;
  exhibitionTitle: string | null;
  artworkId: string | null;
  artworkTitle: string | null;
  createdAt: string;
  updatedAt: string;
};

function initial(name: string) {
  return (name.trim().charAt(0) || "?").toUpperCase();
}

export default function MessagesThread({
  conversationId,
  user,
  ownExhibitionCount,
}: {
  conversationId: string;
  user: { id: string; name: string; email: string; avatarUrl?: string | null; isAdmin?: boolean };
  ownExhibitionCount: number;
}) {
  const { locale } = useLocale();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const response = await fetch(`/api/messages/${conversationId}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Could not open this conversation.");
        const result = (await response.json()) as { conversation: Conversation; messages: Message[] };
        if (!cancelled) {
          setConversation(result.conversation);
          setMessages(result.messages ?? []);
        }
      } catch {
        if (!cancelled) setError("Could not open this conversation.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function sendReply(event: FormEvent) {
    event.preventDefault();
    const text = reply.trim();
    if (!text || sending) return;
    setSending(true);
    setSendError("");
    try {
      const response = await fetch(`/api/messages/${conversationId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: text }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string; message?: Message } | null;
      if (!response.ok) throw new Error(result?.error ?? "Could not send your message.");
      const sentMessage: Message | undefined = result?.message;
      if (sentMessage) {
        setMessages((current) => [
          ...current,
          { ...sentMessage, senderName: user.name, readAt: null },
        ]);
      }
      setReply("");
    } catch (err) {
      setSendError(err instanceof Error ? err.message : "Could not send your message.");
    } finally {
      setSending(false);
    }
  }

  const time = (value: string) =>
    new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(value));

  const context =
    conversation?.artworkTitle
      ? `About “${conversation.artworkTitle}”${conversation.exhibitionTitle ? ` in ${conversation.exhibitionTitle}` : ""}`
      : conversation?.exhibitionTitle
        ? `About “${conversation.exhibitionTitle}”`
        : null;

  return (
    <div className={styles.page}>
      <Sidebar user={user} active="messages" exhibitionCount={ownExhibitionCount} />
      <main className={styles.main}>
        <div className={styles.head}>
          <Link className={styles.back} href="/messages">
            ← Messages
          </Link>
        </div>
        {error && <p className={styles.error}>{error}</p>}
        {loading ? (
          <p className={styles.empty}>Opening the conversation…</p>
        ) : !conversation ? (
          <p className={styles.empty}>This conversation does not exist, or it is not yours.</p>
        ) : (
          <>
            <div className={styles.threadHead}>
              <span className={styles.avatar} aria-hidden="true">
                {initial(conversation.otherUser.name)}
              </span>
              <div>
                <div className={styles.name}>{conversation.otherUser.name}</div>
                {context && <div className={styles.context}>{context}</div>}
              </div>
            </div>
            <div className={styles.thread}>
              {messages.length === 0 ? (
                <p className={styles.empty}>No messages yet.</p>
              ) : (
                messages.map((m) => (
                  <div
                    key={m.id}
                    className={`${styles.msg} ${m.senderId === user.id ? styles.mine : styles.theirs}`}
                  >
                    {m.body}
                    <span className={styles.msgTime}>{time(m.createdAt)}</span>
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
            <form className={styles.reply} onSubmit={sendReply}>
              <textarea
                aria-label="Write a reply"
                value={reply}
                maxLength={4000}
                onChange={(event) => setReply(event.target.value)}
                placeholder={`Write to ${conversation.otherUser.name}…`}
              />
              <button type="submit" className={styles.send} disabled={sending || !reply.trim()}>
                {sending ? "Sending…" : "Send"}
              </button>
            </form>
            {sendError && <p className={styles.error}>{sendError}</p>}
          </>
        )}
      </main>
    </div>
  );
}
