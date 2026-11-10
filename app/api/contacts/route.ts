import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

const CONTACT_ROLES = ["Collector", "Curator", "Gallery", "Artist", "Art Advisor", "Institution", "Other"] as const;

function clean(value: unknown, max = 500): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

// The artist's own address book, stored on the account (see the
// Contact model): list it, or add one contact. The browser copy from
// before (localStorage "sanaa-contacts") is migrated by the tool
// itself on first load, through this same POST.
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your contacts." }, { status: 401 });
  const contacts = await db.contact.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, role: true, email: true, notes: true, createdAt: true },
  });
  return NextResponse.json({ contacts });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to add a contact." }, { status: 401 });
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid contact details." }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  const name = clean(data.name, 200);
  if (!name) return NextResponse.json({ error: "A name is required." }, { status: 400 });
  const role = typeof data.role === "string" && (CONTACT_ROLES as readonly string[]).includes(data.role)
    ? data.role
    : "Collector";
  const email = clean(data.email, 200);
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: "That email address does not look right." }, { status: 400 });
  }
  const contact = await db.contact.create({
    data: { userId: user.id, name, role, email, notes: clean(data.notes, 2000) },
    select: { id: true, name: true, role: true, email: true, notes: true, createdAt: true },
  });
  return NextResponse.json({ contact }, { status: 201 });
}
