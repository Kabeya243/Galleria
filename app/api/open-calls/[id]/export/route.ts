import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Download every response to one open call as a spreadsheet (CSV).
// Owner only. One row per response, one column per form field, plus
// the received date. A file answer becomes "name (download URL)" so
// the file can be opened straight from the sheet. The download URL
// is the owner-only file route, so the sheet stays private to the
// owner just like the responses list.
function csvCell(value: string): string {
  if (/[",\n\r]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function answerCell(value: unknown, origin: string): string {
  if (value === undefined || value === null || value === "") return "";
  if (Array.isArray(value)) return value.join(", ");
  if (typeof value === "object") {
    const file = value as { key?: string; name?: string };
    if (file.key) return `${file.name ?? "File"} (${origin}/api/open-calls/files/${file.key})`;
    return "";
  }
  return String(value);
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const call = await db.openCall.findUnique({ where: { id } });
  if (!call || call.ownerId !== user.id) {
    return NextResponse.json({ error: "Open call not found." }, { status: 404 });
  }
  const [fields, responses] = await Promise.all([
    db.openCallField.findMany({ where: { openCallId: id }, orderBy: { order: "asc" } }),
    db.openCallResponse.findMany({
      where: { openCallId: id },
      orderBy: { createdAt: "asc" },
      take: 500,
    }),
  ]);
  const origin = new URL(request.url).origin;
  const header = ["Received", ...fields.map((f) => f.label)];
  const lines: string[] = [header.map(csvCell).join(",")];
  for (const response of responses) {
    const answers = (response.answers ?? {}) as Record<string, unknown>;
    const row = [
      response.createdAt.toISOString(),
      ...fields.map((f) => answerCell(answers[f.id], origin)),
    ];
    lines.push(row.map(csvCell).join(","));
  }
  const filename = `open-call-${call.slug}-responses.csv`;
  return new NextResponse(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
