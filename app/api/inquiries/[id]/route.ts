import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Seller-only: mark an inquiry answered or closed (or reopen it).
// The inquiry must belong to one of the seller's own listings.

type RouteContext = { params: Promise<{ id: string }> };

const updateSchema = z.object({
  status: z.enum(["open", "answered", "closed"]),
});

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to update inquiries." }, { status: 401 });
  const { id } = await params;

  const existing = await db.inquiry.findFirst({
    where: { id, listing: { sellerId: user.id } },
    select: { id: true, status: true },
  });
  if (!existing) return NextResponse.json({ error: "Inquiry not found." }, { status: 404 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid status." }, { status: 400 });

  const row = await db.inquiry.update({ where: { id: existing.id }, data: { status: parsed.data.status } });
  return NextResponse.json({ inquiry: { id: row.id, status: row.status } });
}
