import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import {
  deviceFromUserAgent,
  getOrCreateVisitorKey,
  logVisit,
} from "@/lib/visits";

// Logs one artwork-detail open on a public exhibition (the exhibition
// view itself is logged server-side in app/exhibition/[slug]/page.tsx).
// No sign-in: visitors are anonymous. The body carries only ids — the
// visitorKey lives in an httpOnly cookie, country comes from the
// x-vercel-ip-country header when Vercel supplies it, device from the
// user-agent. Nothing personal is stored; a failed log still returns
// 200 so the gallery never breaks for the visitor.
//
// A body of { identifyOnly: true } only ensures the visitor cookie
// exists (set by the public exhibition client on first load, so the
// server-side exhibition-view row can be tied to a stable anonymous
// id on later visits) and logs nothing.

const bodySchema = z.object({
  exhibitionId: z.string().min(1).max(100).optional(),
  artworkId: z.string().min(1).max(100).optional(),
  identifyOnly: z.boolean().optional(),
  // Seconds spent in the exhibition, sent by the client when the visit
  // ends (pagehide / sendBeacon). Stored on the visit row this visitor
  // opened most recently for the exhibition (within the last 3 hours) —
  // never a new row, never invented.
  durationSeconds: z.number().int().min(0).max(86400).optional(),
});

export async function POST(request: Request) {
  const body: unknown = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  // Always ensure the anonymous visitor cookie exists, even for a
  // no-op identify call — that is the whole point of that call.
  const visitorKey = await getOrCreateVisitorKey();
  if (parsed.data.identifyOnly || !parsed.data.exhibitionId) {
    return NextResponse.json({ ok: true });
  }

  // Visit duration: update the most recent visit row for this visitor
  // and exhibition (opened within the last 3 hours). Keep the longest
  // reported duration — a second pagehide must not shrink it.
  if (typeof parsed.data.durationSeconds === "number" && !parsed.data.artworkId) {
    const threeHoursAgo = new Date(Date.now() - 3 * 60 * 60 * 1000);
    const latest = await db.visitLog.findFirst({
      where: {
        exhibitionId: parsed.data.exhibitionId,
        visitorKey,
        artworkId: null,
        createdAt: { gte: threeHoursAgo },
      },
      orderBy: { createdAt: "desc" },
      select: { id: true, durationSeconds: true },
    });
    if (latest) {
      const next = Math.max(latest.durationSeconds ?? 0, parsed.data.durationSeconds);
      if (next !== latest.durationSeconds) {
        await db.visitLog.update({ where: { id: latest.id }, data: { durationSeconds: next } });
      }
    }
    return NextResponse.json({ ok: true });
  }

  // The artwork must belong to the exhibition, so a stray or forged id
  // cannot pollute another exhibition's stats.
  const artwork = parsed.data.artworkId
    ? await db.artwork.findFirst({
        where: { id: parsed.data.artworkId, exhibitionId: parsed.data.exhibitionId },
        select: { id: true },
      })
    : null;
  if (parsed.data.artworkId && !artwork) {
    return NextResponse.json({ ok: false }, { status: 404 });
  }

  const country = request.headers.get("x-vercel-ip-country");
  const referrer = request.headers.get("referer");
  await logVisit({
    exhibitionId: parsed.data.exhibitionId,
    artworkId: parsed.data.artworkId ?? null,
    visitorKey,
    country,
    device: deviceFromUserAgent(request.headers.get("user-agent")),
    referrer: referrer && referrer.length <= 2048 ? referrer : null,
  });
  return NextResponse.json({ ok: true });
}
