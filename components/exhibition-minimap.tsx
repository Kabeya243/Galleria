"use client";

import { useMemo, useState } from "react";
import { Map as MapIcon, X } from "lucide-react";
import type { Artwork } from "@/lib/demo-data";
import { roomLayouts, roomPlanOffsets, type GalleryRoom } from "@/lib/rooms";
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

  // Same room offsets as the 3D scene (see roomPlanOffsets), so the
  // plan matches the space the visitor walks through. Rooms normally
  // line up along X; a Stone Gallery front/back pair shares one X and
  // stacks along Z (front half below, back half above), so the plan
  // shows both rooms and the visitor can switch between them.
  const { offsets, zOffsets, minX, maxX, minZ, maxZ } = useMemo(() => {
    const plan = roomPlanOffsets(rooms);
    const minX = Math.min(...rooms.map((room, i) => plan.x[i] - roomLayouts[room.layout].width / 2));
    const maxX = Math.max(...rooms.map((room, i) => plan.x[i] + roomLayouts[room.layout].width / 2));
    const minZ = Math.min(...rooms.map((room, i) => plan.z[i] - roomLayouts[room.layout].depth / 2));
    const maxZ = Math.max(...rooms.map((room, i) => plan.z[i] + roomLayouts[room.layout].depth / 2));
    return { offsets: plan.x, zOffsets: plan.z, minX, maxX, minZ, maxZ };
  }, [rooms]);

  const width = Math.max(1, maxX - minX);
  const height = Math.max(1, maxZ - minZ);
  // 1 m = 10 units in the SVG; the plan scales to its container.
  const SCALE = 10;
  // The panel is dark (#050505, pure black & white theme), so the plan
  // must read on a dark background: the active room is a solid white
  // block with a black label, an inactive room a dark block with a
  // light border and a white label. (The old scheme — active 6% black,
  // inactive white — was drawn for a light panel, so whichever room
  // was active vanished into the dark panel with its label, and the
  // plan looked cut off at the top where that room sits.)
  // A padding ring keeps rooms and dots off the SVG edge: artworks
  // hung on the back wall sit at the very edge of their room, and
  // without it their dots are half clipped by the viewport.
  const PAD = 12;
  const viewWidth = width * SCALE + PAD * 2;
  const viewHeight = height * SCALE + PAD * 2;
  const toX = (worldX: number) => (worldX - minX) * SCALE + PAD;
  // The back wall (most negative z) is at the top of the plan, the
  // front wall at the bottom — like a floor plan with the entrance
  // at the bottom.
  const toY = (worldZ: number) => (worldZ - minZ) * SCALE + PAD;
  // Keep every dot fully inside the plan (visible and clickable): a
  // dot on a wall would otherwise sit half outside the viewport.
  const clampDot = (value: number, max: number) => Math.min(Math.max(value, 8), Math.max(8, max - 8));

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
            style={{ display: "block", maxHeight: 200 }}
          >
            {rooms.map((room, index) => {
              const layout = roomLayouts[room.layout];
              const x = toX(offsets[index] - layout.width / 2);
              const y = toY(zOffsets[index] - layout.depth / 2);
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
                    fill={isActive ? "#fff" : "rgba(255,255,255,0.07)"}
                    stroke={isActive ? "#fff" : "rgba(255,255,255,0.55)"}
                    strokeWidth={isActive ? 2 : 1}
                  />
                  <text
                    x={x + w / 2}
                    y={y + 14}
                    textAnchor="middle"
                    fontSize={9}
                    fontWeight={700}
                    fill={isActive ? "#000" : "#fff"}
                    style={{ textTransform: "uppercase", letterSpacing: ".08em" }}
                  >
                    {room.name}
                  </text>
                  {roomArtworks.map((artwork) => {
                    const cx = clampDot(toX(offsets[index] + artwork.position[0]), viewWidth);
                    const cy = clampDot(toY(zOffsets[index] + artwork.position[2]), viewHeight);
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
                  {room.name}
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
