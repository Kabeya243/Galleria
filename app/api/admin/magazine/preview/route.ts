import { NextResponse } from "next/server";
import { z } from "zod";
import { requireAdminPermission } from "@/lib/admin";
import { renderMarkdown } from "@/lib/magazine-markdown";

// Markdown preview for the magazine editor: renders the draft exactly
// as the public article page will, so the admin sees the real result
// before publishing. Admin-only (magazine.manage).
const bodySchema = z.object({ markdown: z.string().max(200000) });

export async function POST(request: Request) {
  const access = await requireAdminPermission("magazine.manage");
  if (!access) {
    return NextResponse.json({ error: "Admin access required." }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Send the markdown to preview." }, { status: 400 });
  }
  return NextResponse.json({ html: renderMarkdown(parsed.data.markdown) });
}
