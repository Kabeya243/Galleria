import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { buildCallSlug, cleanFieldInput } from "@/lib/open-calls";

// Owner's open calls (GET) and creation (POST). All rows are scoped to
// the signed-in user; the public side lives under /api/public/open-calls.
const createSchema = z.object({
  title: z.string().trim().min(1).max(160),
  description: z.string().trim().max(5000).optional().default(""),
  deadline: z.string().trim().optional().nullable(),
  fields: z.array(z.unknown()).max(50).optional().default([]),
});

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const calls = await db.openCall.findMany({
    where: { ownerId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { responses: true, fields: true } },
    },
  });
  return NextResponse.json({
    openCalls: calls.map((call) => ({
      id: call.id,
      title: call.title,
      slug: call.slug,
      description: call.description,
      deadline: call.deadline?.toISOString() ?? null,
      status: call.status,
      responseCount: call._count.responses,
      fieldCount: call._count.fields,
      createdAt: call.createdAt.toISOString(),
      updatedAt: call.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Empty body — the schema below reports what is missing.
  }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "A title is required." }, { status: 400 });
  }
  const fields: Array<{ label: string; type: string; required: boolean; options: string[] }> = [];
  for (const raw of parsed.data.fields) {
    const field = cleanFieldInput(raw);
    if (!field) {
      return NextResponse.json(
        { error: "Each form field needs a label, a valid type, and choices for dropdowns and checkboxes." },
        { status: 400 },
      );
    }
    fields.push(field);
  }
  let deadline: Date | null = null;
  if (parsed.data.deadline) {
    const d = new Date(parsed.data.deadline);
    if (Number.isNaN(d.getTime())) {
      return NextResponse.json({ error: "The deadline is not a valid date." }, { status: 400 });
    }
    deadline = d;
  }
  // A readable slug with a random tail; retry on the rare collision.
  let slug = buildCallSlug(parsed.data.title);
  for (let attempt = 0; attempt < 5; attempt++) {
    const existing = await db.openCall.findUnique({ where: { slug }, select: { id: true } });
    if (!existing) break;
    slug = buildCallSlug(parsed.data.title);
  }
  const call = await db.openCall.create({
    data: {
      ownerId: user.id,
      title: parsed.data.title,
      slug,
      description: parsed.data.description,
      deadline,
      status: "draft",
      fields: {
        create: fields.map((field, order) => ({
          label: field.label,
          type: field.type,
          required: field.required,
          options: field.options,
          order,
        })),
      },
    },
    include: { fields: { orderBy: { order: "asc" } } },
  });
  return NextResponse.json({
    openCall: {
      id: call.id,
      title: call.title,
      slug: call.slug,
      description: call.description,
      deadline: call.deadline?.toISOString() ?? null,
      status: call.status,
      fields: call.fields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        required: f.required,
        options: Array.isArray(f.options) ? f.options : [],
      })),
      createdAt: call.createdAt.toISOString(),
    },
  });
}
