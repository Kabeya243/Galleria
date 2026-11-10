import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { blockedIdsFor } from "@/app/api/messages/safety";

// Unread badge for the sidebar and the notification bell: how many
// messages addressed to the signed-in user are still unread, across
// all their conversations, plus the unread conversations themselves
// (other participant, excerpt of the latest unread message, date,
// unread count) so the bell can list them without a second round
// trip. Conversations with a user the reader blocked are excluded:
// the blocked user cannot send new messages, and the thread is hidden
// from the inbox.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your messages." }, { status: 401 });

  const blocked = await blockedIdsFor(user.id);
  const unreadWhere = {
    senderId: { not: user.id },
    readAt: null,
    conversation: {
      OR: [
        { participantAId: user.id, participantBId: { notIn: blocked } },
        { participantBId: user.id, participantAId: { notIn: blocked } },
      ],
    },
  };

  const [unreadCount, rows] = await Promise.all([
    db.message.count({ where: unreadWhere }),
    db.conversation.findMany({
      where: {
        OR: [{ participantAId: user.id }, { participantBId: user.id }],
        messages: { some: { senderId: { not: user.id }, readAt: null } },
      },
      include: {
        participantA: { select: { id: true, name: true } },
        participantB: { select: { id: true, name: true } },
        messages: {
          where: { senderId: { not: user.id }, readAt: null },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { body: true, createdAt: true },
        },
        _count: {
          select: {
            messages: { where: { senderId: { not: user.id }, readAt: null } },
          },
        },
      },
      orderBy: { updatedAt: "desc" },
      take: 20,
    }),
  ]);

  const blockedSet = new Set(blocked);
  const conversations = rows
    .map((row) => {
      const other = row.participantAId === user.id ? row.participantB : row.participantA;
      const latest = row.messages[0] ?? null;
      return {
        id: row.id,
        otherUser: { id: other.id, name: other.name },
        excerpt: latest?.body ?? "",
        createdAt: latest?.createdAt ?? row.updatedAt,
        unreadCount: row._count.messages,
      };
    })
    .filter((conversation) => !blockedSet.has(conversation.otherUser.id));

  return NextResponse.json({ unreadCount, conversations });
}
