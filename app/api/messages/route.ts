import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  checkMessageRateLimit,
  findOrCreateConversation,
  notifyRecipient,
  toClientConversation,
} from "@/lib/messages";

// Private messaging (Nov 2026): GET lists the signed-in user's
// conversations (newest first, with the other participant, the last
// message, the unread count and the inquiry context). POST sends a
// message: it finds or creates the conversation for the pair plus
// context, stores the message, and emails the recipient (best effort).
// Messages are private: only the two participants ever see them.

const sendSchema = z.object({
  recipientId: z.string().min(1).max(100),
  body: z.string().min(1).max(4000),
  exhibitionId: z.string().min(1).max(100).optional(),
  artworkId: z.string().min(1).max(100).optional(),
});

const conversationInclude = (userId: string) => ({
  participantA: { select: { id: true, name: true } },
  participantB: { select: { id: true, name: true } },
  exhibition: { select: { title: true } },
  artwork: { select: { title: true } },
  messages: {
    orderBy: { createdAt: "desc" as const },
    take: 1,
    select: { body: true, senderId: true, createdAt: true },
  },
  _count: {
    select: {
      messages: { where: { senderId: { not: userId }, readAt: null } },
    },
  },
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your messages." }, { status: 401 });

  const rows = await db.conversation.findMany({
    where: { OR: [{ participantAId: user.id }, { participantBId: user.id }] },
    include: conversationInclude(user.id),
    orderBy: { updatedAt: "desc" },
    take: 100,
  });
  return NextResponse.json({ conversations: rows.map((row) => toClientConversation(row, user.id)) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to send a message." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = sendSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid message." }, { status: 400 });

  const { recipientId, body: text, exhibitionId, artworkId } = parsed.data;
  if (recipientId === user.id) {
    return NextResponse.json({ error: "You cannot send a message to yourself." }, { status: 400 });
  }
  const recipient = await db.user.findUnique({
    where: { id: recipientId },
    select: { id: true, email: true, name: true },
  });
  if (!recipient) return NextResponse.json({ error: "That user does not exist." }, { status: 404 });

  // An inquiry must point at a real exhibition or artwork, and the
  // artwork must belong to that exhibition when both are given.
  let exhibition: { id: string; title: string } | null = null;
  let artwork: { id: string; title: string; exhibitionId: string } | null = null;
  if (exhibitionId) {
    exhibition = await db.exhibition.findUnique({ where: { id: exhibitionId }, select: { id: true, title: true } });
    if (!exhibition) return NextResponse.json({ error: "That exhibition does not exist." }, { status: 404 });
  }
  if (artworkId) {
    artwork = await db.artwork.findUnique({
      where: { id: artworkId },
      select: { id: true, title: true, exhibitionId: true },
    });
    if (!artwork) return NextResponse.json({ error: "That artwork does not exist." }, { status: 404 });
    if (exhibitionId && artwork.exhibitionId !== exhibitionId) {
      return NextResponse.json({ error: "That artwork does not belong to that exhibition." }, { status: 400 });
    }
  }

  const rateError = await checkMessageRateLimit(user.id);
  if (rateError) return NextResponse.json({ error: rateError }, { status: 429 });

  const conversation = await findOrCreateConversation(user.id, recipientId, {
    exhibitionId: exhibition?.id ?? null,
    artworkId: artwork?.id ?? null,
  });
  const message = await db.message.create({
    data: { conversationId: conversation.id, senderId: user.id, body: text.trim() },
  });
  await db.conversation.update({ where: { id: conversation.id }, data: { updatedAt: new Date() } });

  const origin = new URL(request.url).origin;
  await notifyRecipient(recipient.email, user.name, text.trim(), conversation.id, origin);

  return NextResponse.json({
    conversationId: conversation.id,
    message: { id: message.id, body: message.body, senderId: message.senderId, createdAt: message.createdAt },
  });
}
