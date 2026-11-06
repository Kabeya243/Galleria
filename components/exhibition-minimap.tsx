"use client";

import { useMemo, useState } from "react";
import { Map as MapIcon, X } from "lucide-react";
import type { Artwork } from "@/lib/demo-data";
import { roomLayouts, type GalleryRoom } from "@/lib/rooms";
import { useT } from "@/lib/i18n";

// Floor plan + teleport (public exhibition): a top-down plan of the
// rooms with one clickable dot per artwork. Clicking a dot walks the
// visitor straight to that artwork in the 3D room (via the
// teleportTarget prop of GalleryScene); clicking a room switches to it.
// Pure black & white, keyboard-navigable (native buttons), and
// collapsible so it never covers the room on a small screen.
export default function ExhibitionMinimap({
  rooms,
  artworks,
  activeRoomId,
  selectedArtworkId,
  onTeleport,
  onRoomChange,
}: {
  rooms: GalleryRoom[];
  artworks: Artwork[];
  activeRoomId: string;
  selectedArtworkId?: string;
  onTeleport: (artwork: Artwork) => void;
  onRoomChange: (roomId: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);

  // Same room offsets as the 3D scene (rooms side by side along X), so
  // the plan matches the space the visitor walks through.
  const { offsets, minX, maxX, maxDepth } = useMemo(() => {
    let current = 0;
    const offsets = rooms.map((room, index) => {
      if (index > 0) {
        const previousWidth = roomLayouts[rooms[index - 1].layout].width;
        const currentWidth = roomLayouts[room.layout].width;
        current += (previousWidth + currentWidth) / 2;
      }
      return current;
    });
    const minX = Math.min(...rooms.map((room, i) => offsets[i] - roomLayouts[room.layout].width / 2));
    const maxX = Math.max(...rooms.map((room, i) => offsets[i] + roomLayouts[room.layout].width / 2));
    const maxDepth = Math.max(...rooms.map((room) => roomLayouts[room.layout].depth));
    return { offsets, minX, maxX, maxDepth };
  }, [rooms]);

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxDepth);
  // 1 m = 10 units in the SVG; the plan scales to its container.
  const SCALE = 10;
  const viewWidth = width * SCALE;
  const viewHeight = height * SCALE;
  const toX = (worldX: number) => (worldX - minX) * SCALE;
  const toY = (worldZ: number) => (worldZ + maxDepth / 2) * SCALE;

  if (rooms.length === 0) return null;

  return (
    <div className="exhibition-minimap">
      {open && (
        <div className="minimap-panel" role="group" aria-label={t("minimap", "floorPlan")}>
          <svg
            viewBox={`0 0 ${viewWidth} ${viewHeight}`}
            width="100%"
            role="list"
            aria-label={t("minimap", "floorPlan")}
            style={{ display: "block", maxHeight: 180 }}
          >
            {rooms.map((room, index) => {
              const layout = roomLayouts[room.layout];
              const x = toX(offsets[index] - layout.width / 2);
              const y = toY(-layout.depth / 2);
              const w = layout.width * SCALE;
              const h = layout.depth * SCALE;
              const isActive = room.id === activeRoomId;
              const roomArtworks = artworks.filter((artwork) => artwork.roomId === room.id);
              return (
                <g key={room.id}>
                  <rect
                    x={x}
                    y={y}
                    width={w}
                    height={h}
                    fill={isActive ? "#000" : "#fff"}
                    fillOpacity={isActive ? 0.06 : 1}
                    stroke={isActive ? "#000" : "#999"}
                    strokeWidth={isActive ? 2 : 1}
                  />
                  <text
                    x={x + w / 2}
                    y={y + 14}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={700}
                    fill="#000"
                    style={{ textTransform: "uppercase", letterSpacing: ".08em" }}
                  >
                    {room.name}
                  </text>
                  {roomArtworks.map((artwork) => {
                    const cx = toX(offsets[index] + artwork.position[0]);
                    const cy = toY(artwork.position[2]);
                    const isSelected = artwork.id === selectedArtworkId;
                    return (
                      <g key={artwork.id} role="listitem">
                        <circle
                          cx={cx}
                          cy={cy}
                          r={isSelected ? 7 : 5}
                          fill={isSelected ? "#000" : "#fff"}
                          stroke="#000"
                          strokeWidth={1.5}
                        />
                        {/* A transparent hit target so the dot is easy to
                            tap on a small screen. Clicking it teleports;
                            the button list below is the keyboard path. */}
                        <circle
                          cx={cx}
                          cy={cy}
                          r={13}
                          fill="transparent"
                          style={{ cursor: "pointer" }}
                          onClick={() => onTeleport(artwork)}
                        >
                          <title>{`${artwork.title} — ${t("minimap", "goToArtwork")}`}</title>
                        </circle>
                      </g>
                    );
                  })}
                </g>
              );
            })}
          </svg>
          {/* The dots are buttons (keyboard accessible); the SVG above is
              the picture, the list below is the control. */}
          <ul className="minimap-list">
            {rooms.map((room) => (
              <li key={room.id}>
                <button
                  type="button"
                  className={room.id === activeRoomId ? "active" : ""}
                  onClick={() => onRoomChange(room.id)}
                  aria-current={room.id === activeRoomId ? "true" : undefined}
                >
                  {t("minimap", "room")} {room.name}
                </button>
                <ul>
                  {artworks
                    .filter((artwork) => artwork.roomId === room.id)
                    .map((artwork) => (
                      <li key={artwork.id}>
                        <button
                          type="button"
                          className={artwork.id === selectedArtworkId ? "active" : ""}
                          onClick={() => onTeleport(artwork)}
                          aria-label={`${t("minimap", "goToArtwork")} — ${artwork.title}`}
                        >
                          <i aria-hidden="true" />
                          {artwork.title}
                        </button>
                      </li>
                    ))}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button
        type="button"
        className="minimap-toggle"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={t("minimap", "floorPlan")}
      >
        {open ? <X size={16} /> : <MapIcon size={16} />}
        <span>{t("minimap", "floorPlan")}</span>
      </button>
    </div>
  );
}
