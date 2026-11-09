import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Unread badge for the sidebar: how many messages addressed to the
// signed-in user are still unread, across all their conversations.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your messages." }, { status: 401 });

  const unreadCount = await db.message.count({
    where: {
      senderId: { not: user.id },
      readAt: null,
      conversation: {
        OR: [{ participantAId: user.id }, { participantBId: user.id }],
      },
    },
  });
  return NextResponse.json({ unreadCount });
}
