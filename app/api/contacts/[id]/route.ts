import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Delete one of the artist's own contacts. The id in the path is the
// contact's id; the user id in the where clause makes sure nobody can
// delete someone else's contact by guessing an id.
export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete a contact." }, { status: 401 });
  const { id } = await params;
  const deleted = await db.contact.deleteMany({ where: { id, userId: user.id } });
  if (deleted.count === 0) return NextResponse.json({ error: "Contact not found." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
