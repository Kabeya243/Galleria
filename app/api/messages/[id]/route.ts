import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  checkMessageRateLimit,
  notifyRecipient,
  otherParticipant,
} from "@/lib/messages";

// One conversation: GET returns the thread (only for a participant)
// and marks the reader's received messages as read. POST sends a
// reply in the thread and emails the other participant (best effort).

const replySchema = z.object({
  body: z.string().min(1).max(4000),
});

async function loadConversation(id: string, userId: string) {
  const conversation = await db.conversation.findUnique({
    where: { id },
    include: {
      participantA: { select: { id: true, name: true } },
      participantB: { select: { id: true, name: true } },
      exhibition: { select: { id: true, title: true } },
      artwork: { select: { id: true, title: true } },
    },
  });
  if (!conversation) return null;
  if (conversation.participantAId !== userId && conversation.participantBId !== userId) return null;
  return conversation;
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your messages." }, { status: 401 });
  const { id } = await params;

  const conversation = await loadConversation(id, user.id);
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const messages = await db.message.findMany({
    where: { conversationId: id },
    include: { sender: { select: { id: true, name: true } } },
    orderBy: { createdAt: "asc" },
    take: 200,
  });
  // Opening the thread reads it: mark the reader's received messages.
  await db.message.updateMany({
    where: { conversationId: id, senderId: { not: user.id }, readAt: null },
    data: { readAt: new Date() },
  });

  const otherId = otherParticipant(conversation, user.id);
  const other = otherId === conversation.participantA.id ? conversation.participantA : conversation.participantB;
  return NextResponse.json({
    conversation: {
      id: conversation.id,
      otherUser: { id: other.id, name: other.name },
      exhibitionId: conversation.exhibitionId,
      exhibitionTitle: conversation.exhibition?.title ?? null,
      artworkId: conversation.artworkId,
      artworkTitle: conversation.artwork?.title ?? null,
      createdAt: conversation.createdAt,
      updatedAt: conversation.updatedAt,
    },
    messages: messages.map((m) => ({
      id: m.id,
      body: m.body,
      senderId: m.senderId,
      senderName: m.sender.name,
      createdAt: m.createdAt,
      readAt: m.readAt,
    })),
  });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to send a message." }, { status: 401 });
  const { id } = await params;

  const body: unknown = await request.json().catch(() => null);
  const parsed = replySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid message." }, { status: 400 });

  const conversation = await loadConversation(id, user.id);
  if (!conversation) return NextResponse.json({ error: "Conversation not found." }, { status: 404 });

  const rateError = await checkMessageRateLimit(user.id);
  if (rateError) return NextResponse.json({ error: rateError }, { status: 429 });

  const text = parsed.data.body.trim();
  const message = await db.message.create({
    data: { conversationId: id, senderId: user.id, body: text },
  });
  await db.conversation.update({ where: { id }, data: { updatedAt: new Date() } });

  const otherId = otherParticipant(conversation, user.id);
  const other = await db.user.findUnique({ where: { id: otherId }, select: { email: true } });
  if (other) {
    const origin = new URL(request.url).origin;
    await notifyRecipient(other.email, user.name, text, id, origin);
  }

  return NextResponse.json({
    message: { id: message.id, body: message.body, senderId: message.senderId, createdAt: message.createdAt },
  });
}
