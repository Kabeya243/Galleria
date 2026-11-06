import { NextResponse } from "next/server";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/lib/db";

type RouteContext = { params: Promise<{ id: string }> };

const unlockSchema = z.object({
  password: z.string().min(1, "Enter the password."),
});

// Unlock a password-protected exhibition (feature 8): the password is
// checked against the bcrypt hash, and on success an httpOnly cookie
// (`sanaa_exh_<id>`) marks this browser as allowed in — no password is
// ever stored client-side, and the cookie alone never grants access to
// another exhibition. The cookie lasts 30 days.
export async function POST(request: Request, { params }: RouteContext) {
  const { id } = await params;
  const exhibition = await db.exhibition.findFirst({
    where: { id, status: "public", visibility: "password" },
    select: { id: true, accessPasswordHash: true },
  });
  if (!exhibition || !exhibition.accessPasswordHash) {
    return NextResponse.json({ error: "Exhibition not found." }, { status: 404 });
  }

  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Empty body — the schema below reports the missing password.
  }
  const parsed = unlockSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Enter the password." }, { status: 400 });
  }

  const ok = await compare(parsed.data.password, exhibition.accessPasswordHash);
  if (!ok) {
    return NextResponse.json({ error: "Incorrect password." }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(`sanaa_exh_${exhibition.id}`, "1", {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 30 * 24 * 60 * 60,
  });
  return response;
}
