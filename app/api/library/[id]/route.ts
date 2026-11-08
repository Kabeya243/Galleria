import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { deleteLibraryWorkAndCopies } from "@/lib/library";

type RouteContext = { params: Promise<{ id: string }> };

// Delete one work from the library — the one explicit, confirmed
// delete. It removes the library row AND every copy hanging in the
// signed-in user's exhibitions (same image), otherwise the next
// library read would backfill the row straight back from the copy
// still on the wall. The R2 file itself is never deleted. Deleting a
// single copy from an exhibition (DELETE /api/artworks/[id]) is a
// different, non-destructive act: it only ever removes that copy.
export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete an artwork." }, { status: 401 });
  const { id } = await params;
  const result = await deleteLibraryWorkAndCopies(user.id, id);
  if ("error" in result) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, deletedCopies: result.deletedCopies });
}
