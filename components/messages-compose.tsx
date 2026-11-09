"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import Sidebar from "@/components/sidebar";
import styles from "./messages.module.css";

// Start a conversation (/messages/new): the recipient and the inquiry
// context come from the link that brought the visitor here (a "Send a
// message" button on an exhibition or an artwork). Sending creates the
// thread and opens it. You cannot message yourself.

export default function MessagesCompose({
  recipient,
  exhibition,
  artwork,
  user,
  ownExhibitionCount,
}: {
  recipient: { id: string; name: string } | null;
  exhibition: { id: string; title: string } | null;
  artwork: { id: string; title: string } | null;
  user: { name: string; email: string; avatarUrl?: string | null; isAdmin?: boolean };
  ownExhibitionCount: number;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function send(event: FormEvent) {
    event.preventDefault();
    const text = body.trim();
    if (!recipient || !text || sending) return;
    setSending(true);
    setError("");
    try {
      const response = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recipientId: recipient.id,
          body: text,
          ...(exhibition ? { exhibitionId: exhibition.id } : {}),
          ...(artwork ? { artworkId: artwork.id } : {}),
        }),
      });
      const result = (await response.json().catch(() => null)) as { error?: string; conversationId?: string } | null;
      if (!response.ok || !result?.conversationId) {
        throw new Error(result?.error ?? "Could not send your message.");
      }
      router.push(`/messages/${result.conversationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your message.");
      setSending(false);
    }
  }

  return (
    <div className={styles.page}>
      <Sidebar user={user} active="messages" exhibitionCount={ownExhibitionCount} />
      <main className={styles.main}>
        <div className={styles.head}>
          <Link className={styles.back} href="/messages">
            ← Messages
          </Link>
        </div>
        <h1 className={styles.title}>New message</h1>
        {!recipient ? (
          <p className={styles.empty}>
            No recipient. Open an exhibition or an artwork and use “Send a message” to write to its owner.
          </p>
        ) : (
          <form className={styles.card} onSubmit={send}>
            <p className={styles.meta}>
              To <strong>{recipient.name}</strong>
              {artwork && (
                <>
                  {" "}about <strong>“{artwork.title}”</strong>
                  {exhibition && (
                    <>
                      {" "}in <strong>{exhibition.title}</strong>
                    </>
                  )}
                </>
              )}
              {!artwork && exhibition && (
                <>
                  {" "}about the exhibition <strong>{exhibition.title}</strong>
                </>
              )}
            </p>
            <div className={styles.field}>
              <label htmlFor="new-message-body">Your message</label>
              <textarea
                id="new-message-body"
                value={body}
                maxLength={4000}
                onChange={(event) => setBody(event.target.value)}
                placeholder={`Write to ${recipient.name}…`}
              />
            </div>
            {error && <p className={styles.error}>{error}</p>}
            <div>
              <button type="submit" className={styles.send} disabled={sending || !body.trim()}>
                {sending ? "Sending…" : "Send message"}
              </button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}
