import { NextResponse } from "next/server";
import { createSession, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// One-click account switch between Kabeya's two Lakisa accounts, without
// typing a password (Nov 2026). This is NOT a public passwordless login
// and NOT a generic "log in as any user" endpoint. The switch works in
// BOTH directions, and only between these two accounts:
//   kabeyailunga243@gmail.com (admin) <-> official@lakisa.art (Lakisa Official)
// The current session user must be exactly one of the two, and the
// target is hardcoded here on the server from the current user (never
// taken from the request). Everything else gets a 403. The buttons are
// only rendered for the matching account (admin shell for the admin,
// sidebar for the Official account), but the check below is what
// actually enforces it.
const ADMIN_EMAIL = "kabeyailunga243@gmail.com";
const OFFICIAL_EMAIL = "official@lakisa.art";

export async function POST() {
  const current = await getCurrentUser();
  if (!current) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const currentEmail = current.email.trim().toLowerCase();
  const targetEmail =
    currentEmail === ADMIN_EMAIL
      ? OFFICIAL_EMAIL
      : currentEmail === OFFICIAL_EMAIL
        ? ADMIN_EMAIL
        : null;
  if (!targetEmail) {
    return NextResponse.json(
      { error: "Account switching is not available for this account." },
      { status: 403 },
    );
  }

  const target = await db.user.findUnique({
    where: { email: targetEmail },
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
