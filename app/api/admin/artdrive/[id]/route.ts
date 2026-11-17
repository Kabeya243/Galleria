import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getR2Bucket, getR2Client, isR2Configured } from "@/lib/r2";
import { requireArtDriveManager } from "@/lib/artdrive";

export const runtime = "nodejs";

// Delete one ArtDrive file (manager only): the R2 object goes first,
// then the row, so the share link dies with the file. A missing R2
// object is not an error — the row still goes, so a half-deleted file
// never lingers in the list.
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await requireArtDriveManager();
  if ("response" in auth) return auth.response;
  const { id } = await params;
  const file = await db.artDriveFile.findFirst({
    where: { id, ownerId: auth.user.id },
  });
  if (!file) {
    return NextResponse.json({ error: "File not found." }, { status: 404 });
  }
  if (isR2Configured()) {
    try {
      await getR2Client().send(
        new DeleteObjectCommand({ Bucket: getR2Bucket(), Key: file.r2Key }),
      );
    } catch (error) {
      console.error("Could not delete ArtDrive object from R2.", error);
    }
  }
  await db.artDriveFile.delete({ where: { id: file.id } });
  return NextResponse.json({ ok: true });
}
