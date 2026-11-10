import { NextResponse } from "next/server";
import { db } from "@/lib/db";

// The public open call page (GET /api/public/open-calls/[slug]): only
// a published call whose deadline has not passed is readable. Drafts,
// closed calls and past-deadline calls answer 404, so an unpublished
// link never leaks the form.
export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const call = await db.openCall.findUnique({
    where: { slug },
    include: { fields: { orderBy: { order: "asc" } } },
  });
  if (!call || call.status !== "published") {
    return NextResponse.json({ error: "Open call not found." }, { status: 404 });
  }
  if (call.deadline && call.deadline.getTime() < Date.now()) {
    return NextResponse.json({ error: "This open call is closed." }, { status: 410 });
  }
  return NextResponse.json({
    openCall: {
      id: call.id,
      title: call.title,
      slug: call.slug,
      description: call.description,
      deadline: call.deadline?.toISOString() ?? null,
      fields: call.fields.map((f) => ({
        id: f.id,
        label: f.label,
        type: f.type,
        required: f.required,
        options: Array.isArray(f.options) ? f.options : [],
      })),
    },
  });
}
