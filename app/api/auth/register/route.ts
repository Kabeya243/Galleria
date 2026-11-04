import { NextResponse } from "next/server";
import { hash } from "bcryptjs";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { createSession } from "@/lib/auth";
import { db } from "@/lib/db";
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
      },
      select: { id: true, email: true, name: true },
    });
    await createSession(user.id);
    return NextResponse.json({ user }, { status: 201 });
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
