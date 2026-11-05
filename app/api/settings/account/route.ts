import { NextResponse } from "next/server";
import { destroySession, getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    // Exhibitions and artworks are deleted with the account (onDelete: Cascade).
    await db.user.delete({ where: { id: user.id } });
    await destroySession();
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Account deletion failed.", error);
    return NextResponse.json({ error: "Could not delete your account right now." }, { status: 500 });
  }
}
