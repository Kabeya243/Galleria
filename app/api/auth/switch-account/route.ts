import { NextResponse } from "next/server";
import { createSession, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// One-click switch from the Kabeya admin account to the Lakisa Official
// account, without typing a password (Nov 2026). This is NOT a public
// passwordless login and NOT a generic "log in as any user" endpoint.
// The switch works in ONE direction only: the current session user must
// be exactly kabeyailunga243@gmail.com, and the target is hardcoded
// here on the server to official@lakisa.art (never taken from the
// request). Everything else gets a 403. The button is only rendered in
// the admin shell for that one account, but the check below is what
// actually enforces it. There is deliberately no return button on the
// Official account: to get back to admin, sign in with the admin
// password as usual.
const ADMIN_EMAIL = "kabeyailunga243@gmail.com";
const OFFICIAL_EMAIL = "official@lakisa.art";

export async function POST() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  if (current.email.trim().toLowerCase() !== ADMIN_EMAIL) {
    return NextResponse.json(
      { error: "Account switching is not available for this account." },
      { status: 403 },
    );
  }

  const target = await db.user.findUnique({
    where: { email: OFFICIAL_EMAIL },
    select: { id: true, email: true },
  });
  if (!target) {
    return NextResponse.json({ error: "Target account not found." }, { status: 500 });
  }

  // Reuse the normal session mechanism (lib/auth.ts): the new session
  // cookie replaces the old one, same 30-day duration as a remembered
  // sign-in. No password is involved.
  await createSession(target.id);
  return NextResponse.json({ ok: true, email: target.email });
}
