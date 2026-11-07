"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Map as MapIcon, X } from "lucide-react";
import type { Artwork } from "@/lib/demo-data";
import { roomPlanOffsets, type GalleryRoom } from "@/lib/rooms";
import {
  SUNLIGHT_MAP_HEIGHT,
  SUNLIGHT_MAP_WIDTH,
  SUNLIGHT_PANELS,
  sunlightMapPoint,
  sunlightMapX,
  sunlightMapZ,
} from "@/lib/sunlight";
import type { CameraState } from "@/components/gallery-scene";
import type { SunlightElement } from "@/lib/sunlight-elements";
import { useT } from "@/lib/i18n";

// Floor plan + teleport (public exhibition and editor): the Sunlight
// Gallery's plan, drawn on a canvas like the reference room's own
// mini-plan — the room outline, the three freestanding panels as
// lines, one orange dot per artwork, and the live camera (blue dot +
// direction line). Clicking the plan walks the visitor to that point;
// clicking near an artwork dot walks to that artwork. Pure black &
// white, keyboard-navigable (native buttons), and collapsible so it
// never covers the room on a small screen.
export default function ExhibitionMinimap({
  rooms,
  artworks,
  activeRoomId,
  selectedArtworkId,
  cameraStateRef,
  onTeleport,
  onTeleportPoint,
  onRoomChange,
}: {
  rooms: GalleryRoom[];
  artworks: Artwork[];
  activeRoomId: string;
  selectedArtworkId?: string;
  // Live camera state (GalleryScene writes it every frame): the
  // camera dot and its direction line. Absent = no camera dot.
  cameraStateRef?: { current: CameraState | null };
  onTeleport: (artwork: Artwork) => void;
  // Walk to a point clicked on the plan (yaw stays null — walk there,
  // keep the current direction). Absent = a point click does nothing.
  onTeleportPoint?: (roomId: string, x: number, z: number) => void;
  onRoomChange: (roomId: string) => void;
}) {
  const t = useT();
  const [open, setOpen] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // The room's world offset in the shared 3D space (see
  // roomPlanOffsets), so the plan matches the space the visitor walks
  // through. A single Sunlight room per exhibition: the plan shows
  // that room.
  const offsets = useMemo(() => roomPlanOffsets(rooms).x, [rooms]);
  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? rooms[0];
  const activeIndex = Math.max(0, rooms.findIndex((room) => room.id === activeRoom?.id));
  const activeOffsetX = offsets[activeIndex] ?? 0;
  const activeArtworks = activeRoom ? artworks.filter((artwork) => artwork.roomId === activeRoom.id) : [];

  // Redraw the plan every frame while open: the camera dot and its
  // direction line move live with the camera.
  useEffect(() => {
    if (!open) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    let raf = 0;
    const draw = () => {
      drawSunlightMinimap(ctx, activeArtworks, selectedArtworkId, cameraStateRef?.current ?? null, activeOffsetX, activeRoom.sunlightElements ?? []);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [open, activeArtworks, selectedArtworkId, cameraStateRef, activeOffsetX, activeRoom]);

  if (rooms.length === 0 || !activeRoom) return null;

  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const point = sunlightMapPoint(event.clientX, event.clientY, rect);
    // A click near an artwork dot (within ~0.6 m) walks to that
    // artwork; anywhere else walks to the clicked point.
    const near = activeArtworks.find((artwork) => {
      const dx = artwork.position[0] - point.x;
      const dz = artwork.position[2] - point.z;
      return Math.hypot(dx, dz) <= 0.6;
    });
    if (near) {
      onTeleport(near);
    } else {
      onTeleportPoint?.(activeRoom.id, point.x, point.z);
    }
  };

  return (
    <div className="exhibition-minimap">
      {open && (
        <div className="minimap-panel" role="group" aria-label={t("minimap", "floorPlan")}>
          <canvas
            ref={canvasRef}
            width={SUNLIGHT_MAP_WIDTH}
            height={SUNLIGHT_MAP_HEIGHT}
            onClick={handleCanvasClick}
            role="img"
            aria-label={t("minimap", "floorPlan")}
            style={{ display: "block", width: "100%", height: "auto", maxHeight: 280, cursor: "pointer" }}
          />
          {/* The dots are buttons (keyboard accessible); the canvas
              above is the picture, the list below is the control. */}
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

// Draw the Sunlight plan on the canvas: white room, black outline,
// the three panels as lines, orange artwork dots, and the live camera
// (blue dot + direction line). Room-local coordinates (the room sits
// at its world offset in the scene, so the camera's world position is
// shifted back by that offset to land on the plan).
function drawSunlightMinimap(
  ctx: CanvasRenderingContext2D,
  artworks: Artwork[],
  selectedArtworkId: string | undefined,
  cameraState: CameraState | null,
  offsetX: number,
  sunlightElements: SunlightElement[],
) {
  const W = SUNLIGHT_MAP_WIDTH;
  const H = SUNLIGHT_MAP_HEIGHT;
  ctx.clearRect(0, 0, W, H);
  // Room: white fill, black outline.
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 2;
  ctx.strokeRect(2, 2, W - 4, H - 4);
  // Freestanding panels: a line each, along the panel's length.
  // The panel group is rotated y = ry, so its local +X maps to world
  // (cos ry, -sin ry) in (x, z).
  ctx.strokeStyle = "#333333";
  ctx.lineWidth = 3;
  for (const panel of SUNLIGHT_PANELS) {
    const c = Math.cos(panel.ry);
    const s = Math.sin(panel.ry);
    const half = panel.len / 2;
    ctx.beginPath();
    ctx.moveTo(sunlightMapX(panel.x + c * half), sunlightMapZ(panel.z - s * half));
    ctx.lineTo(sunlightMapX(panel.x - c * half), sunlightMapZ(panel.z + s * half));
    ctx.stroke();
  }
  // Double door on the left wall: a gap in the outline.
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(sunlightMapX(-11), sunlightMapZ(-11.55));
  ctx.lineTo(sunlightMapX(-11), sunlightMapZ(-10.45));
  ctx.stroke();
  ctx.strokeStyle = "#111111";
  ctx.lineWidth = 2;
  // Sunlight 3D elements (the reference room's own pieces): grey
  // squares, 8 × 8, the source's #8a8178.
  ctx.fillStyle = "#8a8178";
  for (const element of sunlightElements) {
    const cx = sunlightMapX(element.x);
    const cy = sunlightMapZ(element.z);
    ctx.fillRect(cx - 4, cy - 4, 8, 8);
  }
  // Artworks: orange dots (bigger when selected) — the source's
  // #BA7517.
  for (const artwork of artworks) {
    const cx = sunlightMapX(artwork.position[0]);
    const cy = sunlightMapZ(artwork.position[2]);
    const isSelected = artwork.id === selectedArtworkId;
    ctx.beginPath();
    ctx.arc(cx, cy, isSelected ? 7 : 5, 0, Math.PI * 2);
    ctx.fillStyle = isSelected ? "#ffffff" : "#BA7517";
    ctx.fill();
    ctx.strokeStyle = "#BA7517";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  // Camera: blue dot + a short direction line (yaw 0 faces -Z) — the
  // source's #1f6feb.
  if (cameraState) {
    const localX = cameraState.x - offsetX;
    const cx = sunlightMapX(localX);
    const cy = sunlightMapZ(cameraState.z);
    const len = 2; // metres
    const dx = -Math.sin(cameraState.yaw) * len;
    const dz = -Math.cos(cameraState.yaw) * len;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(sunlightMapX(localX + dx), sunlightMapZ(cameraState.z + dz));
    ctx.strokeStyle = "#1f6feb";
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = "#1f6feb";
    ctx.fill();
    ctx.strokeStyle = "#ffffff";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
}
