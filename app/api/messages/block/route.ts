import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { blockUser, unblockUser } from "@/app/api/messages/safety";

// Block or unblock a user (Nov 2026): POST { blockedId } records a
// UserBlock row; the blocked user can then no longer send new messages
// to the blocker (checked server-side in POST /api/messages and
// POST /api/messages/[id], 403) and the conversation disappears from
// the blocker's inbox. POST { blockedId, action: "unblock" } removes
// the block and restores the thread to the inbox. Blocking is
// idempotent: blocking someone already blocked still reports success.
const blockSchema = z.object({
  blockedId: z.string().min(1).max(100),
  action: z.enum(["block", "unblock"]).optional(),
});

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to block a user." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = blockSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { blockedId, action } = parsed.data;
  if (blockedId === user.id) {
    return NextResponse.json({ error: "You cannot block yourself." }, { status: 400 });
  }
  const target = await db.user.findUnique({ where: { id: blockedId }, select: { id: true } });
  if (!target) return NextResponse.json({ error: "That user does not exist." }, { status: 404 });

  if (action === "unblock") {
    await unblockUser(user.id, blockedId);
    return NextResponse.json({ ok: true, blocked: false });
  }
  await blockUser(user.id, blockedId);
  return NextResponse.json({ ok: true, blocked: true });
}
