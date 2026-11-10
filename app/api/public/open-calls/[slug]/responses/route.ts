import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { validateAnswers } from "@/lib/open-calls";

// Submit an application to a published open call (no sign-in needed:
// applicants are the public). The call must be published and its
// deadline must not have passed; answers are validated against the
// call's fields, and file answers must reference a file uploaded
// through the form's upload route.
export async function POST(request: Request, { params }: { params: Promise<{ slug: string }> }) {
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
  let body: unknown = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Answers are required." }, { status: 400 });
  }
  const answers = (body as Record<string, unknown>).answers;
  const checked = validateAnswers(
    call.fields.map((f) => ({
      id: f.id,
      label: f.label,
      type: f.type,
      required: f.required,
      options: f.options,
    })),
    answers,
  );
  if ("error" in checked) {
    return NextResponse.json({ error: checked.error }, { status: 400 });
  }
  const response = await db.openCallResponse.create({
    data: { openCallId: call.id, answers: checked.answers },
  });
  return NextResponse.json({ ok: true, responseId: response.id });
}
