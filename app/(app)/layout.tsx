import { Suspense, type ReactNode } from "react";
import RedesignShellLayout from "@/components/redesign-shell-layout";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";

// Shared layout for the signed-in workspace (route group "(app)", URL-
// transparent: /(app)/page.tsx still serves "/"). It owns the redesign
// shell — topbar, sidebar, command palette, create dialog, welcome
// tour — so the shell mounts once and persists across navigations
// (Dashboard → My Artworks → Resources …); only the page content
// re-renders. Pages inside the group render their own content only,
// never the shell.
//
// Auth: the layout does NOT redirect. Signed-out visitors only reach
// the public homepage ("/", which renders PublicHome itself); every
// other page in the group redirects to /login on its own when there is
// no user, as before. When there is no user the layout renders the
// children bare, so the public homepage is untouched.
const NEW_USER_WINDOW_MS = 30 * 24 * 60 * 60 * 1000;

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) return <>{children}</>;

  const [exhibitionCount, exhibitions] = await Promise.all([
    db.exhibition.count({ where: { ownerId: user.id } }),
    db.exhibition.findMany({
      where: { ownerId: user.id },
      select: { id: true, title: true, slug: true, status: true },
      orderBy: { updatedAt: "desc" },
    }),
  ]);

  return (
    <Suspense>
      <RedesignShellLayout
        user={user}
        exhibitionCount={exhibitionCount}
        exhibitions={exhibitions}
        isNewUser={Date.now() - user.createdAt.getTime() < NEW_USER_WINDOW_MS}
      >
        {children}
      </RedesignShellLayout>
    </Suspense>
  );
}
