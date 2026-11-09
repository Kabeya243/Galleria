"use client";

// Shared public navigation for the galleries-style header
// (galleries, explore, feed, discover, marketplace): the same links as
// the desktop nav, plus a hamburger dropdown on phones. On narrow
// screens the plain links are hidden by CSS (see globals.css) and the
// dropdown carries them, so visitors never lose navigation. The
// primary link (Sign in / Sell your work) stays visible in the header.
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useT } from "@/lib/i18n";

export type PublicNavLink = {
  href: string;
  label: string;
  /** The call-to-action link (Sign in / Sell your work): stays visible
      in the header on every width and is not repeated in the dropdown. */
  primary?: boolean;
};

export default function PublicNav({ links }: { links: PublicNavLink[] }) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const secondary = links.filter((link) => !link.primary);
  const primary = links.filter((link) => link.primary);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (menuRef.current?.contains(target) || btnRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open ]);

  return (
    <nav className="galleries-nav">
      {secondary.map((link) => (
        <Link key={link.href} href={link.href}>
          {link.label}
        </Link>
      ))}
      {primary.map((link) => (
        <Link key={link.href} href={link.href} className="galleries-signin">
          {link.label}
        </Link>
      ))}
      {secondary.length > 0 && (
        <>
          <button
            type="button"
            ref={btnRef}
            className="public-nav-toggle"
            aria-expanded={open}
            aria-controls="public-nav-menu"
            aria-label={open ? t("nav", "closeNav") : t("nav", "openNav")}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X size={19} /> : <Menu size={19} />}
          </button>
          {open && (
            <div ref={menuRef} id="public-nav-menu" className="public-nav-menu">
              {secondary.map((link) => (
                <Link key={link.href} href={link.href} onClick={() => setOpen(false)}>
                  {link.label}
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </nav>
  );
}
