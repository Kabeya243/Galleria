import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { hash } from "bcryptjs";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";

const resetSchema = z.object({
  token: z.string().min(10).max(128),
  newPassword: z
    .string()
    .min(10)
    .max(72)
    .regex(/[a-z]/, "Password must include a lowercase letter.")
    .regex(/[A-Z]/, "Password must include an uppercase letter.")
    .regex(/[0-9]/, "Password must include a number."),
});

export async function POST(request: Request) {
  try {
    const input = resetSchema.parse(await request.json());
    const tokenHash = createHash("sha256").update(input.token).digest("hex");
    const record = await db.passwordResetToken.findUnique({ where: { tokenHash } });
    if (!record || record.usedAt || record.expiresAt < new Date()) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Please request a new one." },
        { status: 400 },
      );
    }
    // Claim the token atomically: the usedAt check above and the
    // update below were two steps, so two concurrent requests with
    // the same token could both pass the check before either marked
    // it used. updateMany with usedAt: null in the filter claims it
    // exactly once — the loser sees count 0 and gets the expired
    // answer instead of a second password change.
    const claimed = await db.$transaction(async (tx) => {
      const result = await tx.passwordResetToken.updateMany({
        where: { id: record.id, usedAt: null, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (result.count !== 1) return false;
      await tx.user.update({
        where: { id: record.userId },
        data: { passwordHash: await hash(input.newPassword, 12) },
      });
      return true;
    });
    if (!claimed) {
      return NextResponse.json(
        { error: "This reset link is invalid or has expired. Please request a new one." },
        { status: 400 },
      );
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid details." },
        { status: 400 },
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid details." }, { status: 400 });
    }
    console.error("Password reset failed.", error);
    return NextResponse.json({ error: "Could not reset your password right now." }, { status: 500 });
  }
}
