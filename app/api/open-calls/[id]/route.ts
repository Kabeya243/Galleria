import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { cleanFieldInput } from "@/lib/open-calls";

// One open call, owner only: read (with its fields and responses),
// update (title, description, deadline, status, fields) and delete.
const updateSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().max(5000).optional(),
  deadline: z.string().trim().nullable().optional(),
  status: z.enum(["draft", "published", "closed"]).optional(),
  fields: z.array(z.unknown()).max(50).optional(),
});

async function ownerCall(id: string) {
  const user = await getCurrentUser();
  if (!user) return null;
  const call = await db.openCall.findUnique({ where: { id } });
  if (!call || call.ownerId !== user.id) return null;
  return { user, call };
}

function serialise(call: {
  id: string;
  title: string;
  slug: string;
  description: string;
  deadline: Date | null;
  status: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: call.id,
    title: call.title,
    slug: call.slug,
    description: call.description,
    deadline: call.deadline?.toISOString() ?? null,
    status: call.status,
    createdAt: call.createdAt.toISOString(),
    updatedAt: call.updatedAt.toISOString(),
  };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await ownerCall(id);
  if (!found) return NextResponse.json({ error: "Open call not found." }, { status: 404 });
  const [fields, responses] = await Promise.all([
    db.openCallField.findMany({ where: { openCallId: id }, orderBy: { order: "asc" } }),
    db.openCallResponse.findMany({
      where: { openCallId: id },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
  ]);
  return NextResponse.json({
    openCall: {
      ...serialise(found.call),
      fields: fields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        required: f.required,
        options: Array.isArray(f.options) ? f.options : [],
      })),
      responses: responses.map((r) => ({
        id: r.id,
        answers: r.answers,
        createdAt: r.createdAt.toISOString(),
      })),
    },
  });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await ownerCall(id);
  if (!found) return NextResponse.json({ error: "Open call not found." }, { status: 404 });
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    // Empty body — the schema below reports what is missing.
  }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "The update is not valid." }, { status: 400 });
  }
  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.status !== undefined) data.status = parsed.data.status;
  if (parsed.data.deadline !== undefined) {
    if (parsed.data.deadline === null || parsed.data.deadline === "") {
      data.deadline = null;
    } else {
      const d = new Date(parsed.data.deadline);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "The deadline is not a valid date." }, { status: 400 });
      }
      data.deadline = d;
    }
  }
  let fields: Array<{ label: string; type: string; required: boolean; options: string[] }> | null = null;
  if (parsed.data.fields !== undefined) {
    fields = [];
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
  }
  const updated = await db.$transaction(async (tx) => {
    if (fields !== null) {
      await tx.openCallField.deleteMany({ where: { openCallId: id } });
      await tx.openCallField.createMany({
        data: fields.map((field, order) => ({
          openCallId: id,
          label: field.label,
          type: field.type,
          required: field.required,
          options: field.options,
          order,
        })),
      });
    }
    return tx.openCall.update({ where: { id }, data });
  });
  return NextResponse.json({ openCall: serialise(updated) });
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const found = await ownerCall(id);
  if (!found) return NextResponse.json({ error: "Open call not found." }, { status: 404 });
  // Fields and responses go with the call (onDelete: Cascade).
  await db.openCall.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
