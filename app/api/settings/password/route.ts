import { NextResponse } from "next/server";
import { compare, hash } from "bcryptjs";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { passwordChangeSchema } from "@/lib/validation";

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const input = passwordChangeSchema.parse(await request.json());
    const stored = await db.user.findUnique({
      where: { id: user.id },
      select: { passwordHash: true },
    });
    if (!stored || !(await compare(input.currentPassword, stored.passwordHash))) {
      return NextResponse.json({ error: "Your current password is incorrect." }, { status: 401 });
    }
    if (input.currentPassword === input.newPassword) {
      return NextResponse.json(
        { error: "Your new password must be different from the current one." },
        { status: 400 },
      );
    }
    await db.user.update({
      where: { id: user.id },
      data: { passwordHash: await hash(input.newPassword, 12) },
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json(
        { error: error.issues[0]?.message ?? "Invalid password." },
        { status: 400 },
      );
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid details." }, { status: 400 });
    }
    console.error("Password change failed.", error);
    return NextResponse.json({ error: "Could not change your password right now." }, { status: 500 });
  }
}
