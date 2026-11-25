"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import RedesignShell from "@/components/redesign-shell";
import page from "./redesign-pages.module.css";
import dash from "./redesign-dashboard.module.css";

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
  user: { id: string; name: string; email: string; avatarUrl?: string | null; isAdmin?: boolean };
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
    <RedesignShell user={user} active="messages" exhibitionCount={ownExhibitionCount}>
      <div className={page.pageHead}>
        <div>
          <Link href="/messages" style={{ color: "var(--rd-accent)", fontSize: 13.5, fontWeight: 600, textDecoration: "none" }}>
            ← Messages
          </Link>
          <h1 style={{ marginTop: 6 }}>New message</h1>
        </div>
      </div>
      {!recipient ? (
        <section className={`${dash.card} ${page.emptyState}`}>
          <h3>No recipient.</h3>
          <p>Open an exhibition or an artwork and use “Send a message” to write to its owner.</p>
        </section>
      ) : (
        <form className={dash.card} onSubmit={send}>
          <p style={{ margin: "0 0 16px", fontSize: 14, lineHeight: 1.6 }}>
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
          <div className={page.field}>
            <label htmlFor="new-message-body">Your message</label>
            <textarea
              id="new-message-body"
              className={page.textarea}
              value={body}
              maxLength={4000}
              onChange={(event) => setBody(event.target.value)}
              placeholder={`Write to ${recipient.name}…`}
            />
          </div>
          {error && <p style={{ color: "var(--rd-red)", fontSize: 13, margin: "12px 0 0" }}>{error}</p>}
          <div className={page.formActions}>
            <button type="submit" className={`${page.btn} ${page.btnCta}`} disabled={sending || !body.trim()}>
              {sending ? "Sending…" : "Send message"}
            </button>
          </div>
        </form>
      )}
    </RedesignShell>
  );
}
