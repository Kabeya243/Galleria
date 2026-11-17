import { randomBytes, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminAccess } from "@/lib/admin";
import { getCurrentUser } from "@/lib/auth";

// ArtDrive (Nov 2026): a Drive-style file share, manager only for now.
// Shared helpers for the admin API routes and the public share page.
// Files live in R2 under artdrive/<token>/<uuid>; the row in the
// ArtDriveFile table holds the name, type and size shown on the share
// page. The token is random and unguessable, so the link itself is the
// access control, exactly like a Drive share link.

// Vercel caps request bodies at 4.5 MB: files up to this size go
// through the server proxy (/api/admin/artdrive), heavier files go
// straight to R2 with a presigned PUT URL (/api/admin/artdrive/presign),
// the same split the artwork uploader uses (see lib/direct-upload.ts).
export const ARTDRIVE_PROXY_LIMIT = 4_500_000;
// A Drive file may be a heavy PDF or a video: 100 MB, the same cap as a
// GLB sculpture upload.
export const ARTDRIVE_MAX_SIZE = 100 * 1024 * 1024;

// 16 URL-safe characters (96 bits): short enough to paste in a message,
// far too long to guess.
export function newArtDriveToken(): string {
  return randomBytes(12).toString("base64url");
}

export function newArtDriveKey(token: string): string {
  return `artdrive/${token}/${randomUUID()}`;
}

export function artDriveShareUrl(token: string): string {
  return `/artdrive/${token}`;
}

// The public share link, absolute so it pastes cleanly into a message.
// NEXT_PUBLIC_SITE_URL is the site origin (lakisa.art in production).
export function artDriveShareLink(token: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "https://lakisa.art").replace(/\/$/, "");
  return `${base}/artdrive/${token}`;
}

// ArtDrive is manager only for now (the platform owner, Kabeya): the
// admin page and every admin API route run this first. Returns the user
// on success, or the error response to return directly.
export async function requireArtDriveManager():
  Promise<{ user: { id: string; email: string } } | { response: NextResponse }> {
  const user = await getCurrentUser();
  if (!user) {
    return { response: NextResponse.json({ error: "Sign in to use ArtDrive." }, { status: 401 }) };
  }
  const access = await getAdminAccess(user);
  if (!access.isManager) {
    return { response: NextResponse.json({ error: "ArtDrive is for the admin only." }, { status: 403 }) };
  }
  return { user };
}
