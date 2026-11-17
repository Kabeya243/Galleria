import { GetObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getR2Bucket, getR2Client, isR2Configured } from "@/lib/r2";

export const runtime = "nodejs";

// Download one ArtDrive file by its share token. Anyone with the link
// may download it — no account needed, like a Drive share link. The
// file streams straight from R2 (no buffering in memory), with the
// original name in the download. `?inline=1` serves it inline instead,
// so the share page can preview images and PDFs in the browser. Each
// download bumps the counter the admin sees.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  if (!isR2Configured()) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  const file = await db.artDriveFile.findUnique({ where: { token } });
  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  let object;
  try {
    object = await getR2Client().send(
      new GetObjectCommand({ Bucket: getR2Bucket(), Key: file.r2Key }),
    );
  } catch {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  if (!object.Body) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }

  // Count the download before streaming: a slow or cancelled download
  // still reached the link, and the counter must not depend on the
  // stream finishing.
  void db.artDriveFile
    .update({ where: { id: file.id }, data: { downloads: { increment: 1 } } })
    .catch(() => undefined);

  const inline = new URL(request.url).searchParams.get("inline") === "1";
  // RFC 5987 for a non-ASCII name, with a plain ASCII fallback.
  const asciiName = file.fileName.replace(/[^\x20-\x7E]/g, "_");
  const encodedName = encodeURIComponent(file.fileName);
  return new NextResponse(object.Body as unknown as ReadableStream, {
    headers: {
      "Content-Type": file.mimeType || "application/octet-stream",
      "Content-Length": String(file.size),
      "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${asciiName}"; filename*=UTF-8''${encodedName}`,
      "X-Content-Type-Options": "nosniff",
      "Cache-Control": "private, no-store",
    },
  });
}
