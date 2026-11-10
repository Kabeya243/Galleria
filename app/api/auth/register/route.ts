import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { issueVerificationEmail } from "@/lib/email-verification";
import { buildReferralCode, recordReferral } from "@/lib/referrals";
import { registrationSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = registrationSchema.parse(await request.json());
    const existing = await db.user.findUnique({ where: { email: input.email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    // The account's own referral code, ready to share from the "My
    // plan" card. The code is built from the name plus random
    // characters; a collision (rare) retries with a fresh code instead
    // of failing the signup.
    let referralCode = buildReferralCode(input.name);
    for (let attempt = 0; attempt < 3; attempt++) {
      const taken = await db.user.findUnique({
        where: { referralCode },
        select: { id: true },
      });
      if (!taken) break;
      referralCode = buildReferralCode(input.name);
    }
    const user = await db.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await hash(input.password, 12),
        role: input.role,
        country: input.country || undefined,
        // Terms are mandatory at signup (acceptTerms in the schema),
        // so the acceptance date is recorded here.
        termsAcceptedAt: new Date(),
        referralCode,
      },
      select: { id: true, email: true, name: true, role: true, country: true },
    });
    // Referral (Nov 2026): an optional code entered at signup links
    // this account to its referrer. An unknown or missing code is
    // ignored, never a signup failure.
    if (input.referralCode) {
      try {
        await recordReferral(input.referralCode, user.id);
      } catch (error) {
        console.error("Could not record the referral for signup.", error);
      }
    }
    // Email verification (Nov 2026): the account is created UNVERIFIED
    // and NO session is created here — the visitor must confirm the
    // link in their inbox first (see /api/auth/verify-email). The
    // verification link is only ever sent by email, never returned in
    // this response. When SMTP is not configured the email cannot go
    // out: the account still exists (with its token stored) and the
    // client tells the visitor plainly, instead of failing the signup
    // or pretending the email was sent.
    const origin = new URL(request.url).origin;
    const verificationEmailSent = await issueVerificationEmail(user, origin);
    if (!verificationEmailSent) {
      console.error(
        `Signup for ${user.email} succeeded but the verification email could not be sent (SMTP not configured).`,
      );
    }
    return NextResponse.json({ user, verificationEmailSent }, { status: 201 });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid registration details." }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid registration details." }, { status: 400 });
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }
    console.error("Registration failed.", error);
    return NextResponse.json({ error: "Could not create your account right now." }, { status: 500 });
  }
}
