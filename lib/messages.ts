// Private messaging (Nov 2026): two-way conversations between users,
// plus inquiries to the owner of an exhibition or artwork. A
// conversation is keyed by its two participants (stored in id order so
// the pair is unique) plus the context, so asking about two different
// works opens two threads. Messages are private: only the two
// participants can read them.

import { db } from "@/lib/db";
import { sendNewMessageEmail } from "@/lib/email";

export type MessageContext = {
  exhibitionId?: string | null;
  artworkId?: string | null;
};

// The two participants in a fixed order, so the same pair always maps
// to the same conversation row regardless of who wrote first.
export function sortedParticipants(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a];
}

// Simple abuse protection: no more than 10 messages a minute and 60
// an hour from one account. Counted from the Message table, so no
// extra store is needed.
export async function checkMessageRateLimit(senderId: string): Promise<string | null> {
  const now = new Date();
  const minuteAgo = new Date(now.getTime() - 60_000);
  const hourAgo = new Date(now.getTime() - 3_600_000);
  const [lastMinute, lastHour] = await Promise.all([
    db.message.count({ where: { senderId, createdAt: { gte: minuteAgo } } }),
    db.message.count({ where: { senderId, createdAt: { gte: hourAgo } } }),
  ]);
  if (lastMinute >= 10) return "You are sending messages too quickly. Wait a minute and try again.";
  if (lastHour >= 60) return "You have sent too many messages in the last hour. Try again later.";
  return null;
}

export async function findOrCreateConversation(
  senderId: string,
  recipientId: string,
  context: MessageContext,
) {
  const [participantAId, participantBId] = sortedParticipants(senderId, recipientId);
  const exhibitionId = context.exhibitionId ?? null;
  const artworkId = context.artworkId ?? null;
  const existing = await db.conversation.findFirst({
    where: { participantAId, participantBId, exhibitionId, artworkId },
  });
  if (existing) return existing;
  return db.conversation.create({
    data: { participantAId, participantBId, exhibitionId, artworkId },
  });
}

// The other side of a conversation, from the reader's point of view.
export function otherParticipant(
  conversation: { participantAId: string; participantBId: string },
  userId: string,
) {
  return conversation.participantAId === userId
    ? conversation.participantBId
    : conversation.participantAId;
}

export type ClientConversation = {
  id: string;
  otherUser: { id: string; name: string };
  exhibitionId: string | null;
  exhibitionTitle: string | null;
  artworkId: string | null;
  artworkTitle: string | null;
  lastMessage: { body: string; senderId: string; createdAt: Date } | null;
  unreadCount: number;
  updatedAt: Date;
  createdAt: Date;
};

export function toClientConversation(
  row: {
    id: string;
    participantAId: string;
    participantBId: string;
    exhibitionId: string | null;
    artworkId: string | null;
    createdAt: Date;
    updatedAt: Date;
    participantA: { id: string; name: string };
    participantB: { id: string; name: string };
    exhibition: { title: string } | null;
    artwork: { title: string } | null;
    messages: { body: string; senderId: string; createdAt: Date }[];
    _count: { messages: number };
  },
  userId: string,
): ClientConversation {
  const otherId = otherParticipant(row, userId);
  const other = otherId === row.participantA.id ? row.participantA : row.participantB;
  return {
    id: row.id,
    otherUser: { id: other.id, name: other.name },
    exhibitionId: row.exhibitionId,
    exhibitionTitle: row.exhibition?.title ?? null,
    artworkId: row.artworkId,
    artworkTitle: row.artwork?.title ?? null,
    lastMessage: row.messages[0] ?? null,
    unreadCount: row._count.messages,
    updatedAt: row.updatedAt,
    createdAt: row.createdAt,
  };
}

// Email the recipient about a new message (best effort: a missing SMTP
// setup never blocks the message itself — it is already stored and
// visible in the inbox either way).
export async function notifyRecipient(
  recipientEmail: string,
  senderName: string,
  body: string,
  conversationId: string,
  origin: string,
) {
  try {
    await sendNewMessageEmail(
      recipientEmail,
      senderName,
      body,
      `${origin}/messages/${conversationId}`,
    );
  } catch {
    // Notification only; the message itself is already saved.
  }
}
