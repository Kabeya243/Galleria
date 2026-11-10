import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { createMessageReport } from "@/app/api/messages/safety";

// Report a message or a whole conversation (Nov 2026): the report is
// stored in MessageReport for the admins to review at
// GET /api/admin/reports. Only a participant of the conversation can
// report it, and only the reported message's own conversation counts:
// reporting someone else's thread is a 404, the same as opening it.
const reportSchema = z.object({
  messageId: z.string().min(1).max(100).optional(),
  conversationId: z.string().min(1).max(100).optional(),
  reason: z.string().min(1).max(500),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to report a message." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = reportSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid report." }, { status: 400 });
  const { messageId, conversationId, reason } = parsed.data;
  if (!messageId && !conversationId) {
    return NextResponse.json({ error: "Report a message or a conversation." }, { status: 400 });
  }

  let targetConversationId: string | null = conversationId ?? null;
  if (messageId) {
    const message = await db.message.findUnique({
      where: { id: messageId },
      select: { id: true, conversationId: true },
    });
    if (!message) return NextResponse.json({ error: "That message does not exist." }, { status: 404 });
    targetConversationId = message.conversationId;
    if (conversationId && conversationId !== message.conversationId) {
      return NextResponse.json({ error: "That message is not in that conversation." }, { status: 400 });
    }
  }
  if (!targetConversationId) {
    return NextResponse.json({ error: "Report a message or a conversation." }, { status: 400 });
  }
  const conversation = await db.conversation.findUnique({
    where: { id: targetConversationId },
    select: { participantAId: true, participantBId: true },
  });
  if (
    !conversation ||
    (conversation.participantAId !== user.id && conversation.participantBId !== user.id)
  ) {
    return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
  }

  const report = await createMessageReport({
    reporterId: user.id,
    messageId: messageId ?? null,
    conversationId: targetConversationId,
    reason: reason.trim(),
  });
  return NextResponse.json({ ok: true, reportId: report.id, duplicate: report.duplicate });
}
