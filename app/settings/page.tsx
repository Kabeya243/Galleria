import { redirect } from "next/navigation";
import SettingsPage from "@/components/settings-page";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

export default async function SettingsRoute() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [full, exhibitionCount] = await Promise.all([
    db.user.findUnique({ where: { id: user.id }, select: { createdAt: true } }),
    db.exhibition.count({ where: { ownerId: user.id } }),
  ]);

  return (
    <SettingsPage
      user={{
        name: user.name,
        email: user.email,
        avatarUrl: user.avatarUrl ?? null,
        bio: user.bio ?? null,
        createdAt: full?.createdAt.toISOString() ?? null,
        exhibitionCount,
      }}
    />
  );
}
