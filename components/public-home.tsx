"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Aperture,
  Archive,
  ArrowRight,
  ArrowUpRight,
  Calculator,
  ChevronDown,
  ClipboardList,
  Clock,
  FileDown,
  FileText,
  Frame,
  Images,
  Info,
  Menu,
  Users,
  X,
} from "lucide-react";
import BrandLogo from "@/components/brand-logo";
import SiteFooter from "@/components/site-footer";
import HeroGalleryPreview, { type HeroPreviewArtwork } from "@/components/hero-gallery-preview";
import { useT } from "@/lib/i18n";
import { handleCoverImageError } from "@/lib/image-fallback";
import styles from "./public-home.module.css";

// The tools listed in the "Resources" dropdown — the same tools as the
// /tools hub, with the same dictionary labels (section "tools") and the
// same lucide icons as the hub cards. "What we do" heads the menu and
// points at /about; "See all tools" closes it at the /tools hub.
const RESOURCE_TOOLS = [
  { href: "/tools/price-your-work", icon: Calculator, title: "priceYourWork" },
  { href: "/tools/inventory", icon: Archive, title: "inventory" },
  { href: "/tools/contacts", icon: Users, title: "contacts" },
  { href: "/tools/open-calls", icon: ClipboardList, title: "openCalls" },
  { href: "/tools/documents", icon: FileText, title: "documents" },
  { href: "/tools/frames-walls", icon: Frame, title: "framesWalls" },
  { href: "/tools/photography-lab", icon: Aperture, title: "photographyLab" },
  { href: "/tools/portfolio-pdf", icon: FileDown, title: "portfolioPdf" },
] as const;

// The public homepage — pure black & white editorial design. Logged-in
// users never see this; app/page.tsx sends them to their workspace
// (Dashboard) instead. All data is real: public exhibitions from the
// database, real artwork images, real artist names. The visit time is an
// estimate (one minute per artwork, five minutes minimum).
export type PublicHomeExhibition = {
  id: string;
  title: string;
  slug: string;
  artistName: string;
  roomCount: number;
  artworkCount: number;
  views: number;
  coverImageUrl: string | null;
};

export type FeaturedPreview = {
  id: string;
  title: string;
  slug: string;
  artistName: string;
  artworkCount: number;
  artworks: HeroPreviewArtwork[];
};

function visitMinutes(artworkCount: number): number {
  return Math.max(5, artworkCount);
}

function FloorMinimap() {
  return (
    <svg viewBox="0 0 120 84" width="86" height="60" aria-hidden="true">
      <rect x="6" y="6" width="108" height="72" fill="none" stroke="#ffffff" strokeOpacity="0.9" strokeWidth="1.5" />
      <line x1="62" y1="6" x2="62" y2="48" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.2" />
      <line x1="6" y1="48" x2="62" y2="48" stroke="#ffffff" strokeOpacity="0.55" strokeWidth="1.2" />
      <path d="M88 62 L78 48 L98 48 Z" fill="#ffffff" fillOpacity="0.22" stroke="#ffffff" strokeOpacity="0.7" strokeWidth="1" />
      <circle cx="88" cy="62" r="3.5" fill="#ffffff" />
    </svg>
  );
}

export default function PublicHome({
  exhibitions,
  featured,
}: {
  exhibitions: PublicHomeExhibition[];
  featured: FeaturedPreview | null;
}) {
  const t = useT();
  const shown = exhibitions.slice(0, 3);
  const visitHref = featured ? `/exhibition/${featured.slug}` : "/galleries";

  // "Resources" dropdown: click to open (never hover-only), closes on
  // outside click or Escape, Arrow keys move between items. The mobile
  // menu below the header carries the same entries as an expandable
  // group, since touch devices have no hover.
  const [resourcesOpen, setResourcesOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileResourcesOpen, setMobileResourcesOpen] = useState(false);
  const resourcesBtnRef = useRef<HTMLButtonElement>(null);
  const resourcesMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!resourcesOpen) return;
    const onPointerDown = (event: MouseEvent) => {
      const target = event.target as Node;
      if (
        resourcesMenuRef.current?.contains(target) ||
        resourcesBtnRef.current?.contains(target)
      ) {
        return;
      }
      setResourcesOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setResourcesOpen(false);
        resourcesBtnRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [resourcesOpen]);

  // Mobile menu: Escape closes it (and its Resources subgroup), like
  // the desktop dropdown. Links already close it via closeMobileMenu.
  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileOpen(false);
        setMobileResourcesOpen(false);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [mobileOpen]);

  const focusMenuItem = (index: number) => {
    const items = resourcesMenuRef.current?.querySelectorAll("a");
    if (!items || items.length === 0) return;
    const clamped = ((index % items.length) + items.length) % items.length;
    items[clamped]?.focus();
  };

  const onMenuKeyDown = (event: React.KeyboardEvent) => {
    const items = resourcesMenuRef.current?.querySelectorAll("a");
    if (!items) return;
    const current = Array.from(items).indexOf(document.activeElement as HTMLAnchorElement);
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusMenuItem(current + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusMenuItem(current - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusMenuItem(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusMenuItem(items.length - 1);
    }
  };

  const closeMobileMenu = () => {
    setMobileOpen(false);
    setMobileResourcesOpen(false);
  };

  return (
    <main className={styles.page}>
      <header className={styles.header}>
        <Link className={styles.brand} href="/">
          <BrandLogo variant="horizontal" theme="dark" height={80} tagline={false} />
        </Link>
        <nav className={styles.nav} aria-label="Main">
          <div className={styles.navLinks}>
            <Link href="/explore">{t("home", "explore")}</Link>
            <Link href="/galleries">{t("home", "exhibitions")}</Link>
            <Link href="/create">{t("home", "create")}</Link>
            <div className={styles.dropdown}>
              <button
                type="button"
                ref={resourcesBtnRef}
                className={styles.dropdownBtn}
                aria-haspopup="true"
                aria-expanded={resourcesOpen}
                aria-controls="resources-menu"
                onClick={() => setResourcesOpen((open) => !open)}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setResourcesOpen(true);
                    // Focus the first item once the menu has rendered.
                    requestAnimationFrame(() => focusMenuItem(0));
                  }
                }}
              >
                {t("home", "resources")}
                <ChevronDown size={14} className={resourcesOpen ? styles.chevronOpen : undefined} />
              </button>
              {resourcesOpen && (
                <div
                  ref={resourcesMenuRef}
                  id="resources-menu"
                  className={styles.dropdownMenu}
                  role="menu"
                  onKeyDown={onMenuKeyDown}
                >
                  <Link href="/about" role="menuitem" className={styles.dropdownItem} onClick={() => setResourcesOpen(false)}>
                    <Info size={15} />
                    <span>{t("home", "whatWeDo")}</span>
                  </Link>
                  <span className={styles.dropdownDivider} aria-hidden="true" />
                  {RESOURCE_TOOLS.map((tool) => (
                    <Link
                      key={tool.href}
                      href={tool.href}
                      role="menuitem"
                      className={styles.dropdownItem}
                      onClick={() => setResourcesOpen(false)}
                    >
                      <tool.icon size={15} />
                      <span>{t("tools", tool.title)}</span>
                    </Link>
                  ))}
                  <span className={styles.dropdownDivider} aria-hidden="true" />
                  <Link href="/tools" role="menuitem" className={styles.dropdownAll} onClick={() => setResourcesOpen(false)}>
                    {t("toolpages", "seeAllTools")} <ArrowRight size={14} />
                  </Link>
                </div>
              )}
            </div>
            <Link href="#about">{t("home", "about")}</Link>
          </div>
          <Link href="/login" className={styles.signin}>
            {t("home", "signIn")}
          </Link>
          <button
            type="button"
            className={styles.mobileToggle}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? t("nav", "closeNav") : t("nav", "openNav")}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
        </nav>
        {mobileOpen && (
          <div id="mobile-menu" className={styles.mobileMenu}>
            <Link href="/explore" onClick={closeMobileMenu}>
              {t("home", "explore")}
            </Link>
            <Link href="/galleries" onClick={closeMobileMenu}>
              {t("home", "exhibitions")}
            </Link>
            <Link href="/create" onClick={closeMobileMenu}>
              {t("home", "create")}
            </Link>
            <button
              type="button"
              className={styles.mobileSubToggle}
              aria-expanded={mobileResourcesOpen}
              onClick={() => setMobileResourcesOpen((open) => !open)}
            >
              {t("home", "resources")}
              <ChevronDown size={15} className={mobileResourcesOpen ? styles.chevronOpen : undefined} />
            </button>
            {mobileResourcesOpen && (
              <div className={styles.mobileSubmenu}>
                <Link href="/about" onClick={closeMobileMenu}>
                  <Info size={15} />
                  <span>{t("home", "whatWeDo")}</span>
                </Link>
                {RESOURCE_TOOLS.map((tool) => (
                  <Link key={tool.href} href={tool.href} onClick={closeMobileMenu}>
                    <tool.icon size={15} />
                    <span>{t("tools", tool.title)}</span>
                  </Link>
                ))}
                <Link href="/tools" onClick={closeMobileMenu}>
                  <ArrowRight size={15} />
                  <span>{t("toolpages", "seeAllTools")}</span>
                </Link>
              </div>
            )}
            <Link href="#about" onClick={closeMobileMenu}>
              {t("home", "about")}
            </Link>
          </div>
        )}
      </header>

      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>{t("home", "eyebrow")}</p>
          <h1 className={styles.title}>{t("home", "title")}</h1>
          <p className={styles.subtitle}>{t("home", "subtitle")}</p>
          <div className={styles.heroActions}>
            <Link href={visitHref} className={styles.primaryBtn}>
              {t("home", "visitExhibition")} <ArrowRight size={16} />
            </Link>
            <Link href="/register" className={styles.outlineBtn}>
              {t("home", "createMyOwn")}
            </Link>
          </div>
        </div>

        <div className={styles.previewWrap}>
          {featured && featured.artworks.length > 0 ? (
            <Link
              href={`/exhibition/${featured.slug}`}
              className={styles.preview}
              aria-label={`${t("home", "visit")}, ${featured.title}`}
            >
              <HeroGalleryPreview artworks={featured.artworks} />
              <span className={styles.liveLabel}>
                <span className={styles.liveDot} aria-hidden="true" /> {t("home", "livePreview")}
              </span>
              <span className={styles.minimap}>
                <FloorMinimap />
                <em>{t("home", "floorMap")}</em>
              </span>
              <span className={styles.caption}>
                <strong>{featured.title}</strong>
                <span>
                  {featured.artistName} · {featured.artworkCount}{" "}
                  {featured.artworkCount === 1 ? t("home", "artwork") : t("home", "artworks")}
                </span>
              </span>
            </Link>
          ) : (
            <Link href="/galleries" className={styles.previewFallback}>
              <strong>{t("home", "title")}</strong>
              <span>{t("home", "browseExhibitions")}</span>
              <span className={styles.previewFallbackCta}>
                {t("home", "browseExhibitions")} <ArrowRight size={15} />
              </span>
            </Link>
          )}
        </div>
      </section>

      <section className={styles.section} id="exhibitions">
        <div className={styles.sectionHead}>
          <h2 className={styles.sectionTitle}>{t("home", "trending")}</h2>
          {exhibitions.length > 3 && (
            <Link href="/galleries" className={styles.sectionLink}>
              {t("home", "browseAll")} <ArrowUpRight size={14} />
            </Link>
          )}
        </div>
        {shown.length === 0 ? (
          <div className={styles.emptyState}>
            <strong>{t("home", "noPublicYet")}</strong>
            <p>{t("home", "beFirst")}</p>
            <Link href="/register" className={styles.primaryBtn}>
              {t("home", "createAccount")} <ArrowRight size={16} />
            </Link>
          </div>
        ) : (
          <div className={styles.grid}>
            {shown.map((exhibition) => (
              <Link
                key={exhibition.id}
                href={`/exhibition/${exhibition.slug}`}
                className={styles.card}
                aria-label={`${t("home", "visit")}, ${exhibition.title}`}
              >
                {exhibition.coverImageUrl ? (
                  <img
                    src={exhibition.coverImageUrl}
                    alt=""
                    className={styles.cover}
                    loading="lazy"
                    onError={handleCoverImageError}
                  />
                ) : (
                  <span className={styles.coverFallback}>LAKISA</span>
                )}
                <span className={styles.cardBody}>
                  <span className={styles.cardTitle}>{exhibition.title}</span>
                  <span className={styles.cardArtist}>{exhibition.artistName}</span>
                  <span className={styles.cardMeta}>
                    <span>
                      <Images size={13} /> {exhibition.artworkCount}{" "}
                      {exhibition.artworkCount === 1 ? t("home", "artwork") : t("home", "artworks")}
                    </span>
                    <span>
                      <Clock size={13} /> {visitMinutes(exhibition.artworkCount)} min
                    </span>
                  </span>
                </span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className={styles.about} id="about">
        <h2>{t("home", "aboutTitle")}</h2>
        <p>{t("home", "aboutText")}</p>
      </section>

      <SiteFooter />
    </main>
  );
}
