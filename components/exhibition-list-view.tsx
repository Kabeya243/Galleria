"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import type { Artwork } from "@/lib/demo-data";
import type { GalleryRoom } from "@/lib/rooms";
import { useT } from "@/lib/i18n";

// List view (public exhibition): every artwork as a 2D grid — the light
// alternative to the 3D room for slow connections and screen readers.
// Keyboard: arrow keys move between artworks, Enter opens the artwork in
// 3D, Escape closes the list. Every image carries an alt text; every
// card is a real button, so the grid works with a keyboard, a switch
// device and a screen reader without any pointer.
export default function ExhibitionListView({
  artworks,
  rooms,
  exhibitionTitle,
  onViewIn3d,
  onClose,
}: {
  artworks: Artwork[];
  rooms: GalleryRoom[];
  exhibitionTitle: string;
  onViewIn3d: (artwork: Artwork) => void;
  onClose: () => void;
}) {
  const t = useT();
  const gridRef = useRef<HTMLUListElement>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    itemRefs.current[0]?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Arrow-key navigation across the grid (roving focus): Right/Down
  // move forward, Left/Up move back. The buttons are the focus targets.
  function onGridKeyDown(event: React.KeyboardEvent) {
    const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
    if (!keys.includes(event.key)) return;
    const active = document.activeElement as HTMLElement | null;
    const index = itemRefs.current.findIndex((el) => el === active);
    if (index < 0) return;
    event.preventDefault();
    const step = event.key === "ArrowRight" || event.key === "ArrowDown" ? 1 : -1;
    const next = (index + step + artworks.length) % artworks.length;
    itemRefs.current[next]?.focus();
  }

  const roomNameById = new Map(rooms.map((room) => [room.id, room.name]));

  return (
    <div className="exhibition-list-view" role="dialog" aria-modal="true" aria-label={t("listView", "allArtworks")}>
      <header className="list-view-header">
        <div>
          <span className="panel-kicker">{exhibitionTitle.toUpperCase()}</span>
          <h1>{t("listView", "allArtworks")}</h1>
          <p>
            {artworks.length} {t("listView", "artworks")} · {t("listView", "lowBandwidthNote")}
          </p>
        </div>
        <button type="button" className="list-view-close" onClick={onClose} aria-label={t("common", "close")}>
          <X size={18} />
        </button>
      </header>
      {artworks.length === 0 ? (
        <p className="list-view-empty">{t("listView", "noArtworks")}</p>
      ) : (
        <ul ref={gridRef} className="list-view-grid" onKeyDown={onGridKeyDown}>
          {artworks.map((artwork, index) => {
            const alt = `${artwork.title} — ${artwork.artist}${artwork.year ? `, ${artwork.year}` : ""}`;
            return (
              <li key={artwork.id}>
                <article className="list-view-card">
                  {artwork.imageUrl ? (
                    <img src={artwork.imageUrl} alt={alt} loading="lazy" />
                  ) : (
                    <div
                      className="list-view-placeholder"
                      style={{ background: `linear-gradient(135deg, ${artwork.color}, ${artwork.accent})` }}
                      role="img"
                      aria-label={alt}
                    />
                  )}
                  <h2>{artwork.title}</h2>
                  <p className="list-view-meta">
                    {artwork.artist}
                    {artwork.year ? ` · ${artwork.year}` : ""}
                  </p>
                  <p className="list-view-meta">
                    {artwork.medium}
                    {artwork.dimensions ? ` · ${artwork.dimensions}` : ""}
                  </p>
                  <p className="list-view-room">
                    {roomNameById.get(artwork.roomId) ?? ""}
                  </p>
                  <button
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    type="button"
                    className="list-view-open"
                    onClick={() => onViewIn3d(artwork)}
                  >
                    {t("listView", "viewIn3d")}
                  </button>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
