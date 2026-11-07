// Creator profile extras (avatar photo + bio), stored WITHOUT a database
// migration: the production database cannot be migrated from this repo
// (no production DATABASE_URL here), so the profile lives in one SavedWork
// row of kind "profile" per user, data = { avatarUrl, bio }. The User
// table itself is untouched. getCurrentUser() (lib/auth.ts) merges these
// onto the session user, so every page sees user.avatarUrl / user.bio.

import { db } from "@/lib/db";

export type UserProfile = { avatarUrl: string | null; bio: string | null };

export function parseProfileData(data: unknown): UserProfile {
  if (!data || typeof data !== "object") return { avatarUrl: null, bio: null };
  const d = data as Record<string, unknown>;
  return {
    avatarUrl: typeof d.avatarUrl === "string" && d.avatarUrl.length > 0 ? d.avatarUrl : null,
    bio: typeof d.bio === "string" && d.bio.length > 0 ? d.bio : null,
  };
}

export async function getUserProfile(userId: string): Promise<UserProfile> {
  const row = await db.savedWork.findFirst({
    where: { userId, kind: "profile" },
    select: { data: true },
  });
  if (!row) return { avatarUrl: null, bio: null };
  try {
    return parseProfileData(JSON.parse(row.data) as unknown);
  } catch {
    return { avatarUrl: null, bio: null };
  }
}

export async function upsertUserProfile(
  userId: string,
  patch: Partial<UserProfile>,
): Promise<UserProfile> {
  const existing = await db.savedWork.findFirst({
    where: { userId, kind: "profile" },
    select: { id: true, data: true },
  });
  const current = existing ? parseProfileData(safeJson(existing.data)) : { avatarUrl: null, bio: null };
  const next: UserProfile = {
    avatarUrl: patch.avatarUrl !== undefined ? patch.avatarUrl : current.avatarUrl,
    bio: patch.bio !== undefined ? patch.bio : current.bio,
  };
  const data = JSON.stringify(next);
  if (existing) {
    await db.savedWork.update({ where: { id: existing.id }, data: { data } });
  } else {
    await db.savedWork.create({ data: { userId, kind: "profile", title: "Profile", data } });
  }
  return next;
}

function safeJson(raw: string): unknown {
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return null;
  }
}
