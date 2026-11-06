import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Persistence API for the Creative Studio tools (Mockup Studio, Color
// Intelligence, Photography Lab, Presentation Designer, Certificate
// Studio, Frame Studio presets, Collection Manager, Exhibition Planner).
// One endpoint, `kind` distinguishes the tool; `data` is the tool-specific
// configuration as JSON. All rows are scoped to the signed-in user.

const KINDS = ["mockup", "palette", "photo-edit", "presentation", "certificate", "frame-preset", "exhibition-version", "collection-record", "exhibition-plan", "accessibility-pack", "education-pack", "ai-concept", "ai-analysis", "asset-3d", "video-project"] as const;

const saveSchema = z.object({
  kind: z.enum(KINDS),
  title: z.string().min(1).max(200),
  data: z.record(z.string(), z.unknown()),
  artworkId: z.string().max(100).optional(),
});

function toClient(row: { id: string; kind: string; title: string; data: string; artworkId: string | null; createdAt: Date; updatedAt: Date }) {
  let parsed: Record<string, unknown> = {};
  try {
    parsed = JSON.parse(row.data) as Record<string, unknown>;
  } catch {
    parsed = {};
  }
  return { id: row.id, kind: row.kind, title: row.title, data: parsed, artworkId: row.artworkId, createdAt: row.createdAt, updatedAt: row.updatedAt };
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to view your saved work." }, { status: 401 });

  const kind = new URL(request.url).searchParams.get("kind");
  const rows = await db.savedWork.findMany({
    where: { userId: user.id, ...(kind && (KINDS as readonly string[]).includes(kind) ? { kind } : {}) },
    orderBy: { updatedAt: "desc" },
    take: 200,
  });
  return NextResponse.json({ saved: rows.map(toClient) });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to save your work." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = saveSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid saved work." }, { status: 400 });

  const row = await db.savedWork.create({
    data: {
      userId: user.id,
      kind: parsed.data.kind,
      title: parsed.data.title,
      data: JSON.stringify(parsed.data.data),
      artworkId: parsed.data.artworkId ?? null,
    },
  });
  return NextResponse.json({ saved: toClient(row) }, { status: 201 });
}

export async function PUT(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to save your work." }, { status: 401 });

  const body: unknown = await request.json().catch(() => null);
  const parsed = z
    .object({ id: z.string().min(1), title: z.string().min(1).max(200).optional(), data: z.record(z.string(), z.unknown()).optional() })
    .safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: "Invalid saved work." }, { status: 400 });

  const existing = await db.savedWork.findFirst({ where: { id: parsed.data.id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Saved work not found." }, { status: 404 });

  const row = await db.savedWork.update({
    where: { id: existing.id },
    data: {
      ...(parsed.data.title !== undefined ? { title: parsed.data.title } : {}),
      ...(parsed.data.data !== undefined ? { data: JSON.stringify(parsed.data.data) } : {}),
    },
  });
  return NextResponse.json({ saved: toClient(row) });
}

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in to delete saved work." }, { status: 401 });

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Missing id." }, { status: 400 });

  const existing = await db.savedWork.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Saved work not found." }, { status: 404 });

  await db.savedWork.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
}
