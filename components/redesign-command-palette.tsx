"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useT, type DictionarySection } from "@/lib/i18n";
import {
  Archive,
  BarChart3,
  Boxes,
  Calculator,
  Compass,
  CreditCard,
  FileText,
  GalleryVerticalEnd,
  Home,
  Image,
  MessageSquare,
  Newspaper,
  Plus,
  Route,
  Search,
  Settings2,
  ShoppingBag,
  Users,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import styles from "./redesign-dashboard.module.css";

// Command palette (Phase 1, Nov 2026): ⌘K / Ctrl+K anywhere on the
// dashboard opens a search over pages, the user's exhibitions and the
// main actions. Arrow keys move, Enter opens, Escape closes. It only
// navigates to real routes and real exhibitions, never demo content.

export type PaletteExhibition = {
  id: string;
  title: string;
  slug: string;
  status: string;
};

type PageEntry = {
  id: string;
  href: string;
  label: DictionarySection<"redesign">;
  icon: LucideIcon;
  // Extra search words that do not show in the label: the same page is
  // called "Analytics" in the sidebar but "Exhibition insights" in the
  // top tabs and here, so typing "analytics" in the palette found
  // nothing even though the page exists.
  keywords?: string[];
};

const PAGES: PageEntry[] = [
  { id: "dashboard", href: "/", label: "dashboard", icon: Home },
  { id: "exhibitions", href: "/exhibitions", label: "myExhibitions", icon: GalleryVerticalEnd },
  { id: "published", href: "/exhibitions?status=published", label: "publishedExhibitions", icon: Compass },
  { id: "artworks", href: "/artworks", label: "myArtworks", icon: Image },
  { id: "editor", href: "/exhibitions", label: "editor3d", icon: Boxes },
  { id: "explore", href: "/explore", label: "exploreExhibitions", icon: Compass },
  { id: "feed", href: "/feed", label: "feed", icon: Newspaper },
  { id: "messages", href: "/messages", label: "messages", icon: MessageSquare },
  { id: "galleries", href: "/galleries", label: "lakisaGalerie", icon: GalleryVerticalEnd },
  { id: "inventory", href: "/tools/inventory", label: "inventory", icon: Archive },
  { id: "price", href: "/tools/price-your-work", label: "priceYourWork", icon: Calculator },
  { id: "certificates", href: "/tools/documents", label: "certificates", icon: FileText },
  { id: "orders", href: "/dashboard/orders", label: "myOrders", icon: ShoppingBag },
  { id: "plan", href: "/dashboard/plan", label: "myPlan", icon: CreditCard },
  { id: "insights", href: "/dashboard/analytics", label: "exhibitionInsights", icon: BarChart3, keywords: ["analytics"] },
  { id: "contacts", href: "/tools/contacts", label: "contacts", icon: Users },
  { id: "resources", href: "/tools", label: "resources", icon: Wrench },
  { id: "settings", href: "/settings", label: "settings", icon: Settings2 },
];

type FlatItem =
  | { kind: "action"; id: string; label: string; hint?: string; icon: LucideIcon; run: () => void }
  | { kind: "page"; id: string; href: string; label: string; icon: LucideIcon }
  | { kind: "exhibition"; id: string; href: string; label: string; meta: string; icon: LucideIcon };

export default function RedesignCommandPalette({
  open,
  onOpenChange,
  exhibitions,
  onCreate,
  onTour,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exhibitions: PaletteExhibition[];
  onCreate: () => void;
  onTour: () => void;
}) {
  const t = useT();
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  // ⌘K / Ctrl+K toggles from anywhere on the dashboard.
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        onOpenChange(!open);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onOpenChange]);

  // Reset the query and focus the input whenever the palette opens.
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const timer = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(timer);
  }, [open ]);

  const q = query.trim().toLowerCase();

  const actions: FlatItem[] = useMemo(
    () => [
      {
        kind: "action",
        id: "new-exhibition",
        label: t("redesign", "paletteNewExhibition"),
        icon: Plus,
        run: () => {
          onOpenChange(false);
          onCreate();
        },
      },
      {
        kind: "action",
        id: "add-artwork",
        label: t("redesign", "paletteAddArtwork"),
        icon: Image,
        run: () => {
          onOpenChange(false);
          router.push("/artworks");
        },
      },
      {
        kind: "action",
        id: "take-tour",
        label: t("redesign", "takeTour"),
        icon: Route,
        run: () => {
          onOpenChange(false);
          onTour();
        },
      },
    ],
    [onCreate, onTour, onOpenChange, router, t],
  );

  const pages: FlatItem[] = useMemo(
    () =>
      PAGES.filter(
        (page) =>
          !q ||
          t("redesign", page.label).toLowerCase().includes(q) ||
          (page.keywords ?? []).some((keyword) => keyword.toLowerCase().includes(q)),
      ).map((page) => ({
        kind: "page" as const,
        id: `page-${page.id}`,
        href: page.href,
        label: t("redesign", page.label),
        icon: page.icon,
      })),
    [q, t],
  );

  const exhibitionItems: FlatItem[] = useMemo(
    () =>
      exhibitions
        .filter((exhibition) => !q || exhibition.title.toLowerCase().includes(q))
        .slice(0, 8)
        .map((exhibition) => ({
          kind: "exhibition" as const,
          id: `exhibition-${exhibition.id}`,
          href: `/editor/${exhibition.id}`,
          label: exhibition.title,
          meta: t("redesign", "paletteOpenEditor"),
          icon: GalleryVerticalEnd,
        })),
    [exhibitions, q, t],
  );

  const groups: Array<{ title: string; items: FlatItem[] }> = [
    { title: t("redesign", "paletteActions"), items: actions.filter((a) => !q || a.label.toLowerCase().includes(q)) },
    { title: t("redesign", "palettePages"), items: pages },
    { title: t("redesign", "paletteExhibitions"), items: exhibitionItems },
  ].filter((group) => group.items.length > 0);

  const flat: FlatItem[] = groups.flatMap((group) => group.items);

  // Keep the active item visible while moving with the keyboard.
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-index="${activeIndex}"]`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  function runItem(item: FlatItem) {
    if (item.kind === "action") {
      item.run();
      return;
    }
    onOpenChange(false);
    router.push(item.href);
  }

  function onKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((value) => Math.min(flat.length - 1, value + 1));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((value) => Math.max(0, value - 1));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = flat[activeIndex];
      if (item) runItem(item);
    }
  }

  if (!open) return null;

  return (
    <div
      className={styles.paletteScrim}
      role="dialog"
      aria-modal="true"
      aria-label={t("redesign", "searchAria")}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onOpenChange(false);
      }}
    >
      <div className={styles.palette}>
        <div className={styles.paletteInputRow}>
          <Search size={17} />
          <input
            ref={inputRef}
            className={styles.paletteInput}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={onKeyDown}
            placeholder={t("redesign", "searchPlaceholder")}
            aria-label={t("redesign", "searchAria")}
          />
          <kbd className={styles.searchKbd}>ESC</kbd>
        </div>
        <div className={styles.paletteList} ref={listRef}>
          {flat.length === 0 && <p className={styles.paletteEmpty}>{t("redesign", "paletteEmpty")}</p>}
          {groups.map((group) => (
            <div key={group.title}>
              <p className={styles.paletteGroup}>{group.title}</p>
              {group.items.map((item) => {
                const index = flat.indexOf(item);
                const active = index === activeIndex;
                const inner = (
                  <>
                    <item.icon size={16} />
                    <span>{item.label}</span>
                    {item.kind === "exhibition" && <span className={styles.paletteItemMeta}>{item.meta}</span>}
                  </>
                );
                return item.kind === "action" ? (
                  <button
                    key={item.id}
                    type="button"
                    data-index={index}
                    className={`${styles.paletteItem}${active ? ` ${styles.paletteItemActive}` : ""}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => runItem(item)}
                  >
                    {inner}
                  </button>
                ) : (
                  <Link
                    key={item.id}
                    href={item.href}
                    data-index={index}
                    className={`${styles.paletteItem}${active ? ` ${styles.paletteItemActive}` : ""}`}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={(event) => {
                      event.preventDefault();
                      runItem(item);
                    }}
                  >
                    {inner}
                  </Link>
                );
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
