import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { upsertUserProfile } from "@/lib/profile";
import { profileUpdateSchema } from "@/lib/validation";

export async function PATCH(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Please sign in." }, { status: 401 });
  try {
    const input = profileUpdateSchema.parse(await request.json());
    const updated = await db.user.update({
      where: { id: user.id },
      data: { name: input.name },
      select: { id: true, email: true, name: true },
    });
    // Avatar + bio live in the "profile" SavedWork row (no DB migration).
    const profile =
      input.avatarUrl !== undefined || input.bio !== undefined
        ? await upsertUserProfile(user.id, {
            ...(input.avatarUrl !== undefined ? { avatarUrl: input.avatarUrl } : {}),
            ...(input.bio !== undefined ? { bio: input.bio } : {}),
          })
        : { avatarUrl: user.avatarUrl ?? null, bio: user.bio ?? null };
    return NextResponse.json({ user: { ...updated, avatarUrl: profile.avatarUrl, bio: profile.bio } });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: error.issues[0]?.message ?? "Invalid name." }, { status: 400 });
    }
    if (error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid details." }, { status: 400 });
    }
    console.error("Profile update failed.", error);
    return NextResponse.json({ error: "Could not update your profile right now." }, { status: 500 });
  }
}
