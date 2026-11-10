"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import Sidebar from "@/components/sidebar";
import { useLocale, useT, LOCALE_TAGS } from "@/lib/i18n";
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
  blockedByMe?: boolean;
};

// Polling interval for new messages: no WebSocket, a plain GET every
// few seconds, paused while the tab is hidden (see the effect below).
const POLL_MS = 4000;

const REPORT_REASONS = ["spam", "harassment", "scam", "inappropriate", "other"] as const;
type ReportReason = (typeof REPORT_REASONS)[number];

function reportReasonKey(reason: ReportReason) {
  return (
    {
      spam: "reasonSpam",
      harassment: "reasonHarassment",
      scam: "reasonScam",
      inappropriate: "reasonInappropriate",
      other: "reasonOther",
    } as const
  )[reason];
}

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
  const t = useT();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reply, setReply] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");
  const [blockedByMe, setBlockedByMe] = useState(false);
  // Reporting: which message (or the whole conversation) is being
  // reported, the chosen reason, and the outcome notice.
  const [reportingMessageId, setReportingMessageId] = useState<string | null>(null);
  const [reportingConversation, setReportingConversation] = useState(false);
  const [reportReason, setReportReason] = useState<ReportReason>("spam");
  const [reportBusy, setReportBusy] = useState(false);
  const [reportNotice, setReportNotice] = useState("");
  // Blocking: two-step confirm, then the block state for this thread.
  const [blockConfirm, setBlockConfirm] = useState(false);
  const [blockBusy, setBlockBusy] = useState(false);
  const [blockNotice, setBlockNotice] = useState("");
  const bottomRef = useRef<HTMLDivElement | null>(null);
  // Signature of the last message list applied, so a poll that returns
  // the same messages does not rewrite state (and does not re-scroll).
  const messagesSignature = useRef("");

  // Live thread: the first load opens the conversation, then a poll
  // every few seconds fetches GET /api/messages/[id] again so new
  // messages appear without reloading the page. Polling stops while
  // the tab is hidden and resumes (with an immediate fetch) when it
  // becomes visible again. No WebSocket.
  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | null = null;

    async function load(initial: boolean) {
      try {
        const response = await fetch(`/api/messages/${conversationId}`, {
          credentials: "same-origin",
          cache: "no-store",
        });
        if (!response.ok) throw new Error("Could not open this conversation.");
        const result = (await response.json()) as {
          conversation: Conversation;
          messages: Message[];
        };
        if (cancelled) return;
        const next = result.messages ?? [];
        const signature = next.map((m) => m.id).join(",");
        if (signature !== messagesSignature.current) {
          messagesSignature.current = signature;
          setMessages(next);
        }
        setConversation(result.conversation);
        setBlockedByMe(result.conversation.blockedByMe ?? false);
      } catch {
        if (!cancelled && initial) setError("Could not open this conversation.");
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

  async function sendReport() {
    if (reportBusy) return;
    setReportBusy(true);
    setReportNotice("");
    try {
      const response = await fetch("/api/messages/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(reportingMessageId ? { messageId: reportingMessageId } : {}),
          conversationId,
          reason: reportReason,
        }),
      });
      if (!response.ok) throw new Error("report failed");
      setReportNotice(t("messagesSafety", "reportSent"));
      setReportingMessageId(null);
      setReportingConversation(false);
    } catch {
      setReportNotice(t("messagesSafety", "reportFailed"));
    } finally {
      setReportBusy(false);
    }
  }

  async function toggleBlock() {
    if (!conversation || blockBusy) return;
    if (!blockedByMe && !blockConfirm) {
      setBlockConfirm(true);
      return;
    }
    setBlockBusy(true);
    setBlockNotice("");
    try {
      const response = await fetch("/api/messages/block", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          blockedId: conversation.otherUser.id,
          action: blockedByMe ? "unblock" : "block",
        }),
      });
      if (!response.ok) throw new Error("block failed");
      setBlockedByMe(!blockedByMe);
      setBlockConfirm(false);
      if (!blockedByMe) {
        setBlockNotice(t("messagesSafety", "blockedNotice"));
      }
    } catch {
      setBlockNotice(t("messagesSafety", "reportFailed"));
    } finally {
      setBlockBusy(false);
    }
  }

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
              <div className={styles.threadHeadRow}>
                <span className={styles.avatar} aria-hidden="true">
                  {initial(conversation.otherUser.name)}
                </span>
                <div>
                  <div className={styles.name}>{conversation.otherUser.name}</div>
                  {context && <div className={styles.context}>{context}</div>}
                </div>
              </div>
              <div className={styles.threadActions}>
                <button
                  type="button"
                  className={styles.actionButton}
                  onClick={() => {
                    setReportingConversation(true);
                    setReportingMessageId(null);
                    setReportNotice("");
                  }}
                >
                  {t("messagesSafety", "reportConversation")}
                </button>
                <button
                  type="button"
                  className={`${styles.actionButton} ${styles.actionDanger}`}
                  disabled={blockBusy}
                  onClick={toggleBlock}
                >
                  {blockedByMe
                    ? t("messagesSafety", "unblockUser")
                    : blockConfirm
                      ? t("messagesSafety", "confirm")
                      : t("messagesSafety", "blockUser")}
                </button>
              </div>
            </div>
            {blockConfirm && !blockedByMe && (
              <p className={styles.notice}>{t("messagesSafety", "blockConfirm")}</p>
            )}
            {blockNotice && <p className={styles.notice}>{blockNotice}</p>}
            {reportNotice && <p className={styles.notice}>{reportNotice}</p>}
            {(reportingMessageId || reportingConversation) && (
              <div className={styles.reportBox}>
                <label htmlFor="report-reason">{t("messagesSafety", "reportReason")}</label>
                <select
                  id="report-reason"
                  value={reportReason}
                  onChange={(event) => setReportReason(event.target.value as ReportReason)}
                >
                  {REPORT_REASONS.map((reason) => (
                    <option key={reason} value={reason}>
                      {t("messagesSafety", reportReasonKey(reason))}
                    </option>
                  ))}
                </select>
                <div className={styles.reportRow}>
                  <button
                    type="button"
                    className={styles.send}
                    disabled={reportBusy}
                    onClick={sendReport}
                  >
                    {reportBusy ? "…" : t("messagesSafety", "sendReport")}
                  </button>
                  <button
                    type="button"
                    className={styles.actionButton}
                    onClick={() => {
                      setReportingMessageId(null);
                      setReportingConversation(false);
                    }}
                  >
                    {t("common", "cancel")}
                  </button>
                </div>
              </div>
            )}
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
                    {m.senderId !== user.id && (
                      <span className={styles.msgActions}>
                        <button
                          type="button"
                          className={styles.msgReport}
                          onClick={() => {
                            setReportingMessageId(m.id);
                            setReportingConversation(false);
                            setReportNotice("");
                          }}
                        >
                          {t("messagesSafety", "report")}
                        </button>
                      </span>
                    )}
                  </div>
                ))
              )}
              <div ref={bottomRef} />
            </div>
            {blockedByMe && <p className={styles.notice}>{t("messagesSafety", "blockedNotice")}</p>}
            <form className={styles.reply} onSubmit={sendReply}>
              <textarea
                aria-label="Write a reply"
                value={reply}
                maxLength={4000}
                disabled={blockedByMe}
                onChange={(event) => setReply(event.target.value)}
                placeholder={`Write to ${conversation.otherUser.name}…`}
              />
              <button
                type="submit"
                className={styles.send}
                disabled={sending || blockedByMe || !reply.trim()}
              >
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
