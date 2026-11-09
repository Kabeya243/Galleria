import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { db } from "@/lib/db";
import { issueVerificationEmail } from "@/lib/email-verification";
import { registrationSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = registrationSchema.parse(await request.json());
    const existing = await db.user.findUnique({ where: { email: input.email } });
    if (existing) {
      return NextResponse.json({ error: "An account with this email already exists." }, { status: 409 });
    }

    const user = await db.user.create({
      data: {
        email: input.email,
        name: input.name,
        passwordHash: await hash(input.password, 12),
        role: input.role,
        country: input.country || undefined,
      },
      select: { id: true, email: true, name: true, role: true, country: true },
    });
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
