import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { db } from "@/lib/db";

// Email verification (Nov 2026): confirms the link sent at signup.
// GET /api/auth/verify-email?token=… — the raw token is hashed and
// looked up; only its hash is ever stored. Claimed atomically (see the
// updateMany below), so two concurrent clicks on the same link verify
// exactly once. On success the account's emailVerifiedAt is set and
// the visitor can sign in; the page at /verify-email renders the
// result. No session is created here — signing in stays the login
// form's job.
export async function GET(request: Request) {
  const token = new URL(request.url).searchParams.get("token") ?? "";
  if (token.length < 10 || token.length > 128) {
    return NextResponse.json(
      { error: "This verification link is invalid or has expired. Please request a new one." },
      { status: 400 },
    );
  }
  try {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const record = await db.emailVerificationToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This verification link is invalid or has expired. Please request a new one." },
        { status: 400 },
      );
    }
    // Claim the token atomically: the usedAt check above and the
    // update below were two steps, so two concurrent requests with
    // the same token could both pass the check before either marked
    // it used. updateMany with usedAt: null in the filter claims it
    // exactly once — the loser sees count 0 and gets the expired
    // answer instead of a second verification.
    const claimed = await db.$transaction(async (tx) => {
      const result = await tx.emailVerificationToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (result.count !== 1) return false;
      await tx.user.update({
        where: { id: record.userId },
        data: { emailVerifiedAt: new Date() },
      });
      return true;
    });
    if (!claimed) {
      return NextResponse.json(
        { error: "This verification link is invalid or has expired. Please request a new one." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Email verification failed.", error);
    return NextResponse.json({ error: "Could not verify your email right now." }, { status: 500 });
  }
}
