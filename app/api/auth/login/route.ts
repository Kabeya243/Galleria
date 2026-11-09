import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { ZodError } from "zod";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
import { isEmailVerified } from "@/lib/email-verification";
import { credentialsSchema } from "@/lib/validation";

export async function POST(request: Request) {
  try {
    const input = credentialsSchema.parse(await request.json());
    const user = await db.user.findUnique({ where: { email: input.email } });
    // No password on file (Google sign-in account): password login can
    // never match — the visitor must use Google sign-in instead.
    if (user && !user.passwordHash) {
      return NextResponse.json(
        { error: "This account signs in with Google — use “Continue with Google” below." },
        { status: 401 },
      );
    }
    if (!user || !(await compare(input.password, user.passwordHash as string))) {
      return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
    }
    // Email verification (Nov 2026): an unverified account cannot sign
    // in. Accounts created before verification shipped are grandfathered
    // by isEmailVerified (createdAt cutoff, or Google sign-in), so
    // existing accounts keep working. The flag lets the form offer a
    // resend link instead of a dead end.
    if (!isEmailVerified(user)) {
      return NextResponse.json(
        {
          error: "Please verify your email before signing in — check your inbox for the link we sent you.",
          emailNotVerified: true,
          email: user.email,
        },
        { status: 403 },
      );
    }
    await createSession(user.id, { rememberMe: input.rememberMe ?? false });
    return NextResponse.json({ user: { id: user.id, email: user.email, name: user.name } });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid sign-in details." }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid sign-in details." }, { status: 400 });
    }
    console.error("Sign-in failed.", error);
    return NextResponse.json({ error: "Could not sign in right now." }, { status: 500 });
  }
}
