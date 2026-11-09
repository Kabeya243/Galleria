import { createHash, randomBytes } from "node:crypto";
import { db } from "@/lib/db";
import { sendVerificationEmail } from "@/lib/email";

// Email verification (Nov 2026).
//
// When an account counts as verified — three ways, checked in order:
//   1. emailVerifiedAt is set (the visitor confirmed the link sent at
//      signup, or an admin marked it — the normal path for new
//      accounts).
//   2. googleId is set (Google sign-in: Google already verified the
//      address before handing it to us, so there is nothing to check).
//   3. The account predates verification itself (createdAt before the
//      cutoff below): those accounts signed up when no verification
//      step existed, and locking them out now would break working
//      accounts — including the test account that owns the solo expo
//      "Already Enough As We Are". They keep signing in as before.
//
// The cutoff is the date this feature was written (9 Nov 2026). The
// next deploy after that date ships verification, so every account
// created before the cutoff used the old flow. If that deploy slips
// past the cutoff, move the cutoff forward to the deploy date BEFORE
// deploying — otherwise accounts created in between, under the old
// flow, would be asked to verify an email they were never sent a link
// for. Once the feature is live, NEVER move the cutoff forward again:
// new accounts must verify, and moving it would silently verify
// accounts that never confirmed their address.
export const EMAIL_VERIFICATION_CUTOFF = new Date("2026-11-09T00:00:00Z");

export const VERIFICATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000; // 24 h

export type VerifiableUser = {
  emailVerifiedAt: Date | null;
  googleId: string | null;
  createdAt: Date;
};

export function isEmailVerified(user: VerifiableUser): boolean {
  if (user.emailVerifiedAt) return true;
  if (user.googleId) return true;
  return user.createdAt < EMAIL_VERIFICATION_CUTOFF;
}

// Issues a fresh verification token for the user (deleting any unused
// ones first, so only the latest link works) and emails the link.
// Returns true when the email was accepted for sending, false when
// SMTP is not configured — the token is still stored, so the visitor
// can use the resend link once SMTP is set up. The raw token is
// returned to NO caller: it only ever travels inside the email.
export async function issueVerificationEmail(
  user: { id: string; email: string },
  origin: string,
): Promise<boolean> {
  await db.emailVerificationToken.deleteMany({
    where: { userId: user.id, usedAt: null },
  });
  const token = randomBytes(32).toString("hex");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await db.emailVerificationToken.create({
    data: {
      userId: user.id,
      tokenHash,
      expiresAt: new Date(Date.now() + VERIFICATION_TOKEN_TTL_MS),
    },
  });
  const verifyUrl = `${origin}/verify-email?token=${token}`;
  return sendVerificationEmail(user.email, verifyUrl);
}
