"use client";

// Global mobile burger (Nov 2026): the single menu button on phones,
// fixed at the top-right on EVERY page (root layout), so navigation is
// never lost on mobile, signed in or not. It replaces the per-page
// mobile toggles (sidebar, public-nav, public-home), which are hidden
// on mobile so there is exactly one burger. Desktop is unchanged: the
// button is hidden above 850px and the sidebar / desktop navs render
// as before. The dropdown lists the main links, adapted to the auth
// state passed in from the layout, and closes when a link is chosen,
// when the backdrop is tapped, on Escape, or on navigation.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Compass,
  CreditCard,
  GalleryVerticalEnd,
  Grid2X2,
  Home,
  Image,
  LogIn,
  LogOut,
  Megaphone,
  Menu,
  MessageSquare,
  Newspaper,
  Plus,
  Settings2,
  UserPlus,
  Wrench,
  X,
  type LucideIcon,
} from "lucide-react";
import { useT } from "@/lib/i18n";

type BurgerLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

export default function MobileBurger({ signedIn }: { signedIn: boolean }) {
  const t = useT();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // Close on navigation, on Escape, and on a tap outside the menu.
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onPointerDown);
    };
  }, [open ]);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.assign("/login");
  }

  const links: BurgerLink[] = signedIn
    ? [
        { href: "/", label: t("nav", "dashboard"), icon: Grid2X2 },
        { href: "/exhibitions", label: t("nav", "exhibitions"), icon: GalleryVerticalEnd },
        { href: "/artworks", label: t("nav", "myArtworks"), icon: Image },
        { href: "/create", label: t("nav", "create"), icon: Plus },
        { href: "/explore", label: t("nav", "explore"), icon: Compass },
        { href: "/feed", label: t("nav", "feed"), icon: Newspaper },
        { href: "/messages", label: t("nav", "messages"), icon: MessageSquare },
        { href: "/tools", label: t("nav", "tools"), icon: Wrench },
        { href: "/open-call", label: t("openCall", "heroTitle"), icon: Megaphone },
        { href: "/settings", label: t("nav", "settings"), icon: Settings2 },
        { href: "/dashboard/plan", label: t("nav", "myPlan"), icon: CreditCard },
      ]
    : [
        { href: "/", label: t("nav", "home"), icon: Home },
        { href: "/explore", label: t("nav", "explore"), icon: Compass },
        { href: "/galleries", label: t("nav", "templates"), icon: GalleryVerticalEnd },
        { href: "/feed", label: t("nav", "feed"), icon: Newspaper },
        { href: "/tools", label: t("nav", "tools"), icon: Wrench },
        { href: "/open-call", label: t("openCall", "heroTitle"), icon: Megaphone },
      ];

  return (
    <>
      <button
        type="button"
        ref={btnRef}
        className="global-burger"
        aria-expanded={open}
        aria-controls="global-burger-menu"
        aria-label={open ? t("nav", "closeNav") : t("nav", "openNav")}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
      {open && (
        <>
          <button
            type="button"
            className="global-burger-backdrop"
            aria-label={t("nav", "closeNav")}
            onClick={() => setOpen(false)}
          />
          <nav
            ref={menuRef}
            id="global-burger-menu"
            className="global-burger-menu"
            aria-label={t("nav", "mainNav")}
          >
            {links.map((link) => (
              <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                <link.icon size={17} />
                <span>{link.label}</span>
              </Link>
            ))}
            <span className="global-burger-divider" aria-hidden="true" />
            {signedIn ? (
              <button type="button" onClick={signOut}>
                <LogOut size={17} />
                <span>{t("nav", "signOut")}</span>
              </button>
            ) : (
              <>
                <Link href="/login" onClick={() => setOpen(false)}>
                  <LogIn size={17} />
                  <span>{t("home", "signIn")}</span>
                </Link>
                <Link href="/register" onClick={() => setOpen(false)}>
                  <UserPlus size={17} />
                  <span>{t("home", "createAccount")}</span>
                </Link>
              </>
            )}
          </nav>
        </>
      )}
    </>
  );
}
