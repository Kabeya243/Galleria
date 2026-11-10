"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

// Legacy anchors (Nov 2026): the Admin used to be one single page and
// its sections were reached as /admin#users, /admin#subscriptions and
// so on. Each section is now its own page, so an old anchor has no
// element to scroll to any more. Mounted only on the overview page:
// when it lands with a section hash, send the visitor to that
// section's page instead of leaving them on an overview that ignores
// the anchor.
const SECTION_ROUTES: Record<string, string> = {
  overview: "/admin",
  users: "/admin/users",
  exhibitions: "/admin/exhibitions",
  artworks: "/admin/artworks",
  galleries: "/admin/galleries",
  tools: "/admin/tools",
  "test-reports": "/admin/test-reports",
  subscriptions: "/admin/subscriptions",
  "sub-admins": "/admin/sub-admins",
};

export default function AdminHashRedirect() {
  const router = useRouter();
  useEffect(() => {
    const hash = window.location.hash.replace(/^#/, "");
    const target = SECTION_ROUTES[hash];
    if (target && target !== "/admin") router.replace(target);
  }, [router]);
  return null;
}
