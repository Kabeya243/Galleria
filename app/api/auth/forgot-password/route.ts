import { NextResponse } from "next/server";
import { createHash, randomBytes } from "node:crypto";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email";

const requestSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
});

export async function POST(request: Request) {
  try {
    const input = requestSchema.parse(await request.json());
    const user = await db.user.findUnique({ where: { email: input.email } });
    if (user) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentCount = await db.passwordResetToken.count({
        where: { userId: user.id, createdAt: { gte: oneHourAgo } },
      });
      if (recentCount < 5) {
        await db.passwordResetToken.deleteMany({
          where: { userId: user.id, usedAt: null },
        });
        const token = randomBytes(32).toString("hex");
        const tokenHash = createHash("sha256").update(token).digest("hex");
        await db.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash,
            expiresAt: new Date(Date.now() + 60 * 60 * 1000),
          },
        });
        const origin = new URL(request.url).origin;
        const resetUrl = `${origin}/reset-password?token=${token}`;
        await sendPasswordResetEmail(user.email, resetUrl);
      }
    }
    // Always the same answer, whether or not the account exists.
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid email." }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid details." }, { status: 400 });
    }
    console.error("Forgot-password request failed.", error);
    return NextResponse.json({ error: "Could not process the request right now." }, { status: 500 });
  }
}
