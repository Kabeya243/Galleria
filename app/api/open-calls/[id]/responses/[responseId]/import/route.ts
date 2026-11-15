import { randomUUID } from "node:crypto";
import { CopyObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { upsertLibraryWorks } from "@/lib/library";
import { getR2Bucket, getR2Client, isR2Configured } from "@/lib/r2";

// Add one or more works from an open-call response straight into one
// of the owner's exhibitions. Owner only. The submitted file stays
// where it is (the submission record is untouched); the image is
// COPIED inside R2 from open-calls/<slug>/<uuid>.<ext> to
// uploads/<userId>/<uuid>.<ext>, so the new artwork gets the normal
// same-origin serving URL (/api/r2/...) and hangs in the 3D room like
// any uploaded work (a raw R2 public URL cannot be a WebGL texture —
// no CORS on the bucket — and /api/r2 only serves uploads/ keys).
// The work also joins the reusable library ("Mes œuvres") through the
// same upsert the artwork routes use. Positions are staggered across
// the wall so several imported works never stack on one spot; the
// curator rearranges them in the editor afterwards.
const IMAGE_EXTENSIONS = ["png", "jpg", "jpeg", "webp", "avif"];

const workSchema = z.object({
  fileFieldId: z.string().min(1),
  title: z.string().max(200).optional().default(""),
  artist: z.string().max(200).optional().default(""),
  medium: z.string().max(200).optional().default(""),
  dimensions: z.string().max(100).optional().default(""),
});

const importSchema = z.object({
  exhibitionId: z.string().min(1),
  works: z.array(workSchema).min(1).max(10),
});

function firstRoomId(roomsJson: string): string {
  try {
    const rooms = JSON.parse(roomsJson) as Array<{ id?: string }>;
    if (Array.isArray(rooms) && typeof rooms[0]?.id === "string" && rooms[0].id) {
      return rooms[0].id;
    }
  } catch {
    // Fall through to the default.
  }
  return "room-main";
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; responseId: string }> },
) {
  const { id, responseId } = await params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  const call = await db.openCall.findUnique({ where: { id } });
  if (!call || call.ownerId !== user.id) {
    return NextResponse.json({ error: "Open call not found." }, { status: 404 });
  }
  let input: z.infer<typeof importSchema>;
  try {
    input = importSchema.parse(await request.json());
  } catch {
    return NextResponse.json({ error: "That import is not valid." }, { status: 400 });
  }
  const [response, fields, exhibition] = await Promise.all([
    db.openCallResponse.findFirst({ where: { id: responseId, openCallId: id } }),
    db.openCallField.findMany({ where: { openCallId: id } }),
    db.exhibition.findFirst({ where: { id: input.exhibitionId, ownerId: user.id } }),
  ]);
  if (!response) return NextResponse.json({ error: "Response not found." }, { status: 404 });
  if (!exhibition) return NextResponse.json({ error: "Exhibition not found." }, { status: 404 });
  if (!isR2Configured()) {
    return NextResponse.json({ error: "File storage is not configured." }, { status: 500 });
  }
  const answers = (response.answers ?? {}) as Record<string, unknown>;
  const fieldById = new Map(fields.map((f) => [f.id, f]));
  const roomId = firstRoomId(exhibition.rooms);
  const created: Array<{ id: string; title: string; imageUrl: string }> = [];
  const failed: Array<{ fileFieldId: string; error: string }> = [];
  let index = 0;
  for (const work of input.works) {
    const field = fieldById.get(work.fileFieldId);
    const value = answers[work.fileFieldId] as { key?: string; name?: string } | undefined;
    const key = typeof value?.key === "string" ? value.key : "";
    const match = /^open-calls\/[A-Za-z0-9-]+\/([a-f0-9-]{36})\.(png|jpe?g|webp|avif)$/i.exec(key);
    if (!field || field.type !== "file" || !match) {
      failed.push({ fileFieldId: work.fileFieldId, error: "That answer is not an image file." });
      continue;
    }
    const extension = match[2].toLowerCase();
    if (!IMAGE_EXTENSIONS.includes(extension)) {
      failed.push({ fileFieldId: work.fileFieldId, error: "Only images can hang in an exhibition." });
      continue;
    }
    const newKey = `uploads/${user.id}/${randomUUID()}.${extension}`;
    const title = work.title.trim() || value?.name?.replace(/\.[^.]+$/, "") || "Untitled work";
    try {
      await getR2Client().send(
        new CopyObjectCommand({
          Bucket: getR2Bucket(),
          CopySource: `${getR2Bucket()}/${key}`,
          Key: newKey,
        }),
      );
      const imageUrl = `/api/r2/${newKey}`;
      const artwork = await db.artwork.create({
        data: {
          title: title.slice(0, 200),
          artist: work.artist.trim().slice(0, 200),
          year: "",
          medium: work.medium.trim().slice(0, 200),
          dimensions: work.dimensions.trim().slice(0, 100),
          description: "",
          imageUrl,
          positionX: -2 + index * 2,
          positionY: 2.5,
          positionZ: -5.72,
          rotation: 0,
          roomId,
          frame: "wood",
          exhibitionId: exhibition.id,
        },
      });
      await upsertLibraryWorks(user.id, [
        {
          title: artwork.title,
          artist: artwork.artist,
          year: "",
          medium: artwork.medium,
          dimensions: artwork.dimensions,
          description: "",
          imageUrl,
          videoUrl: null,
          sculptureUrl: null,
          frame: "wood",
        },
      ]);
      created.push({ id: artwork.id, title: artwork.title, imageUrl });
      index += 1;
    } catch {
      failed.push({ fileFieldId: work.fileFieldId, error: "Could not copy that file. Try again." });
    }
  }
  if (created.length === 0) {
    return NextResponse.json(
      { error: failed[0]?.error ?? "Nothing could be imported.", failed },
      { status: 400 },
    );
  }
  return NextResponse.json(
    { artworks: created, failed, exhibitionId: exhibition.id, exhibitionTitle: exhibition.title },
    { status: 201 },
  );
}
