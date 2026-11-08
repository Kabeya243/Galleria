// Burger navigation of a published advanced site (mobile ≤ 768 px).
// Client component: the published view itself is a server component.
"use client";

import { useEffect, useRef, useState } from "react";
import { Menu, X } from "lucide-react";

export type PublishedNavPage = { id: string; slug: string; title: string };

export function PublishedSiteNav({
  siteSlug,
  pages,
  currentPageId
}: {
  siteSlug: string;
  pages: PublishedNavPage[];
  currentPageId: string;
}) {
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open ]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className="published-burger"
        aria-expanded={open}
        aria-controls="published-nav"
        aria-label={open ? "Fermer le menu" : "Ouvrir le menu"}
        onClick={() => setOpen((value) => !value)}
      >
        {open ? <X size={22} aria-hidden="true" /> : <Menu size={22} aria-hidden="true" />}
      </button>
      <nav id="published-nav" aria-label="Navigation principale" data-open={open ? "true" : "false"}>
        {pages.map((item) => (
          <a
            key={item.id}
            className={item.id === currentPageId ? "current" : ""}
            aria-current={item.id === currentPageId ? "page" : undefined}
            href={item.slug === "accueil" ? `/sites/${siteSlug}` : `/sites/${siteSlug}/${item.slug}`}
            onClick={() => setOpen(false)}
          >
            {item.title}
          </a>
        ))}
      </nav>
    </>
  );
}
