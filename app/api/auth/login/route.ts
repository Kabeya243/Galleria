import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { ZodError } from "zod";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
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
