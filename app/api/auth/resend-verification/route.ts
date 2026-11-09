import { NextResponse } from "next/server";
import { z, ZodError } from "zod";
import { db } from "@/lib/db";
import { isEmailVerified, issueVerificationEmail } from "@/lib/email-verification";

const resendSchema = z.object({
  email: z.string().trim().email().max(254).transform((email) => email.toLowerCase()),
});

// Resend the signup verification email. Used from the "check your
// inbox" screen after signup and from the sign-in form when an
// unverified account tries to log in. At most 5 emails per hour per
// account (same guard as forgot-password), so the endpoint cannot be
// used to spam an inbox. The response never reveals whether the
// account exists: unknown addresses and already-verified accounts get
// the same shape, with emailSent false.
export async function POST(request: Request) {
  try {
    const input = resendSchema.parse(await request.json());
    const user = await db.user.findUnique({ where: { email: input.email } });
    if (user && !isEmailVerified(user)) {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
      const recentCount = await db.emailVerificationToken.count({
        where: { userId: user.id, createdAt: { gte: oneHourAgo } },
      });
      if (recentCount < 5) {
        const origin = new URL(request.url).origin;
        const emailSent = await issueVerificationEmail(user, origin);
        return NextResponse.json({ ok: true, emailSent });
      }
    }
    // Unknown address, already verified, or rate-limited: same answer.
    return NextResponse.json({ ok: true, emailSent: false });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid email." }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid details." }, { status: 400 });
    }
    console.error("Verification resend failed.", error);
    return NextResponse.json({ error: "Could not send the email right now." }, { status: 500 });
  }
}
