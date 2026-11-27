"use client";

import type { ReactNode } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import RedesignShell, { type RedesignShellUser } from "@/components/redesign-shell";
import type { PaletteExhibition } from "@/components/redesign-command-palette";

// Client wrapper owned by the shared (app) layout (app/(app)/layout.tsx).
// It derives the sidebar/tab highlight ("active") from the URL, so the
// layout — which cannot receive props from the pages — still lights the
// right item, and it passes the welcome-tour flag for the dashboard
// home only. The shell itself (sidebar, topbar, palette, dialogs)
// mounts once in this layout and persists across navigations; only
// {children} changes.
function resolveActive(pathname: string, status: string | null): string {
  if (pathname === "/") return "dashboard";
  if (pathname === "/exhibitions") return status === "published" ? "published" : "exhibitions";
  if (pathname === "/artworks") return "artworks";
  if (pathname === "/explore") return "explore";
  if (pathname === "/feed") return "feed";
  if (pathname === "/messages" || pathname.startsWith("/messages/")) return "messages";
  if (pathname === "/galleries") return "galleries";
  if (pathname === "/tools") return "resources";
  if (pathname === "/tools/inventory") return "inventory";
  if (pathname === "/tools/contacts") return "contacts";
  if (pathname === "/tools/price-your-work") return "price";
  if (pathname === "/tools/documents") return "certificates";
  if (pathname === "/dashboard/analytics") return "insights";
  if (pathname === "/dashboard/orders") return "orders";
  if (pathname === "/dashboard/plan") return "plan";
  if (pathname === "/settings") return "settings";
  return "";
}

export default function RedesignShellLayout({
  user,
  exhibitionCount,
  exhibitions,
  isNewUser,
  children,
}: {
  user: RedesignShellUser;
  exhibitionCount: number;
  exhibitions: PaletteExhibition[];
  isNewUser: boolean;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const active = resolveActive(pathname, searchParams.get("status"));

  return (
    <RedesignShell
      user={user}
      active={active}
      exhibitionCount={exhibitionCount}
      exhibitions={exhibitions}
      openTourOnMount={pathname === "/" && isNewUser}
    >
      {children}
    </RedesignShell>
  );
}
