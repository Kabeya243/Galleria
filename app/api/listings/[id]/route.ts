import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { toClientListing } from "@/lib/listings";

// Single listing: public read, owner-only edit / delete. Every write
// re-checks that the signed-in user is the seller — the listing id in
// the URL is never trusted on its own.

type RouteContext = { params: Promise<{ id: string }> };

const STATUSES = ["active", "reserved", "sold", "withdrawn"] as const;
const KINDS = ["original", "edition", "print", "digital"] as const;
const CURRENCIES = ["USD", "EUR", "GBP", "UGX", "KES", "ZAR", "XOF", "CHF"] as const;

const updateSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  artist: z.string().max(200).optional(),
  year: z.string().max(20).optional(),
  medium: z.string().max(200).optional(),
  dimensions: z.string().max(100).optional(),
  description: z.string().max(4000).optional(),
  imageUrl: z.string().max(1000).nullable().optional(),
  price: z.number().int().min(0).max(100_000_000).nullable().optional(),
  currency: z.enum(CURRENCIES).optional(),
  kind: z.enum(KINDS).optional(),
  editionSize: z.number().int().min(1).max(10000).nullable().optional(),
  editionNumber: z.number().int().min(1).max(10000).nullable().optional(),
  status: z.enum(STATUSES).optional(),
});

async function ownListing(userId: string, id: string) {
  return db.listing.findFirst({
    where: { id, sellerId: userId },
    include: { seller: { select: { name: true } }, _count: { select: { inquiries: true } } },
  });
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { id } = await params;
  const row = await db.listing.findUnique({
    where: { id },
    include: { seller: { select: { name: true } }, _count: { select: { inquiries: true } } },
  });
  if (!row) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  return NextResponse.json({ listing: toClientListing(row) });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to edit this listing." }, { status: 401 });
  const { id } = await params;
  const existing = await ownListing(user.id, id);
  if (!existing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Check the listing details and try again." }, { status: 400 });

  const row = await db.listing.update({
    where: { id: existing.id },
    data: parsed.data,
    include: { seller: { select: { name: true } }, _count: { select: { inquiries: true } } },
  });
  return NextResponse.json({ listing: toClientListing(row) });
}

export async function DELETE(_request: Request, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete this listing." }, { status: 401 });
  const { id } = await params;
  const existing = await ownListing(user.id, id);
  if (!existing) return NextResponse.json({ error: "Listing not found." }, { status: 404 });
  await db.listing.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
