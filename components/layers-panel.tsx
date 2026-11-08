"use client";

import { Check, Eye, EyeOff, Lock, Unlock } from "lucide-react";
import ElementThumbnail from "@/components/element-thumbnail";
import { ELEMENT_DEFAULTS, type RoomElement } from "@/lib/elements";
import type { Artwork } from "@/lib/demo-data";
import type { GalleryRoom } from "@/lib/rooms";

// The editor's artworks carry the same three layer fields as elements
// (see lib/elements.ts). The artwork table has no columns for them, so
// they persist through the version-history snapshot, not the main save.
export type LayerArtwork = Artwork & { hidden?: boolean; locked?: boolean; groupId?: string };

export type LayerItemKind = "artwork" | "element";
export type LayerItemRef = { kind: LayerItemKind; id: string };

// Layers & hierarchy: every room with its artworks and elements, each
// with a visibility toggle, a lock toggle, and click-to-select (Shift or
// Ctrl/Cmd-click adds to the selection). Hidden and locked state lives on
// the item itself, so it saves with the exhibition.
export default function LayersPanel({
  rooms,
  artworks,
  activeRoomId,
  selected,
  onActivateRoom,
  onSelectItem,
  onToggleHidden,
  onToggleLocked,
}: {
  rooms: GalleryRoom[];
  artworks: LayerArtwork[];
  activeRoomId: string;
  selected: LayerItemRef[];
  onActivateRoom: (id: string) => void;
  onSelectItem: (ref: LayerItemRef, additive: boolean) => void;
  onToggleHidden: (ref: LayerItemRef) => void;
  onToggleLocked: (ref: LayerItemRef) => void;
}) {
  const isSelected = (ref: LayerItemRef) => selected.some((item) => item.kind === ref.kind && item.id === ref.id);

  return (
    <div className="asset-list">
      {rooms.map((room, index) => {
        const roomArtworks = artworks.filter((artwork) => artwork.roomId === room.id);
        const roomElements = room.elements ?? [];
        const isActive = room.id === activeRoomId;
        return (
          <div key={room.id}>
            <button
              className={`asset-row${isActive ? " selected" : ""}`}
              style={{ width: "100%" }}
              onClick={() => onActivateRoom(room.id)}
              title={isActive ? "Active room" : "Switch to this room"}
            >
              <span className="room-number">{String(index + 1).padStart(2, "0")}</span>
              <span className="asset-copy">
                <strong>{room.name}</strong>
                <small>
                  {roomArtworks.length} artwork{roomArtworks.length === 1 ? "" : "s"} · {roomElements.length} element{roomElements.length === 1 ? "" : "s"}
                </small>
              </span>
              {isActive && <span className="selected-mark"><Check size={12} /></span>}
            </button>
            {isActive && (
              <div style={{ paddingLeft: "18px" }}>
                {roomArtworks.map((artwork) => {
                  const ref: LayerItemRef = { kind: "artwork", id: artwork.id };
                  return (
                    <div className="asset-row-wrap" key={artwork.id} style={artwork.hidden ? { opacity: 0.45 } : undefined}>
                      <button
                        className={`asset-row${isSelected(ref) ? " selected" : ""}`}
                        onClick={(event) => onSelectItem(ref, event.shiftKey || event.ctrlKey || event.metaKey)}
                        title={artwork.hidden ? `${artwork.title} (hidden in 3D)` : artwork.title}
                      >
                        <span className="asset-thumb">{artwork.videoUrl ? <video src={artwork.videoUrl} muted preload="metadata" playsInline /> : artwork.imageUrl ? <img src={artwork.imageUrl} alt={artwork.altText ?? artwork.title} /> : <span style={{ backgroundColor: artwork.color }} />}</span>
                        <span className="asset-copy">
                          <strong>{artwork.title}</strong>
                          <small>
                            Artwork{artwork.groupId ? " · Group" : ""}{artwork.hidden ? " · Hidden" : ""}{artwork.locked ? " · Locked" : ""}
                          </small>
                        </span>
                        {isSelected(ref) && <span className="selected-mark"><Check size={12} /></span>}
                      </button>
                      <button type="button" className="asset-row-delete" aria-label={artwork.hidden ? `Show ${artwork.title}` : `Hide ${artwork.title}`} title={artwork.hidden ? "Show in 3D" : "Hide in 3D"} onClick={() => onToggleHidden(ref)}>
                        {artwork.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button type="button" className="asset-row-delete" aria-label={artwork.locked ? `Unlock ${artwork.title}` : `Lock ${artwork.title}`} title={artwork.locked ? "Unlock (allow dragging)" : "Lock (cannot be dragged)"} onClick={() => onToggleLocked(ref)}>
                        {artwork.locked ? <Lock size={13} /> : <Unlock size={13} />}
                      </button>
                    </div>
                  );
                })}
                {roomElements.map((element: RoomElement) => {
                  const ref: LayerItemRef = { kind: "element", id: element.id };
                  return (
                    <div className="asset-row-wrap" key={element.id} style={element.hidden ? { opacity: 0.45 } : undefined}>
                      <button
                        className={`asset-row${isSelected(ref) ? " selected" : ""}`}
                        onClick={(event) => onSelectItem(ref, event.shiftKey || event.ctrlKey || event.metaKey)}
                        title={element.hidden ? `${element.name} (hidden in 3D)` : element.name}
                      >
                        <span className="asset-thumb element-thumb"><ElementThumbnail type={element.type} size={26} /></span>
                        <span className="asset-copy">
                          <strong>{element.name}</strong>
                          <small>
                            {ELEMENT_DEFAULTS[element.type].label}{element.groupId ? " · Group" : ""}{element.hidden ? " · Hidden" : ""}{element.locked ? " · Locked" : ""}
                          </small>
                        </span>
                        {isSelected(ref) && <span className="selected-mark"><Check size={12} /></span>}
                      </button>
                      <button type="button" className="asset-row-delete" aria-label={element.hidden ? `Show ${element.name}` : `Hide ${element.name}`} title={element.hidden ? "Show in 3D" : "Hide in 3D"} onClick={() => onToggleHidden(ref)}>
                        {element.hidden ? <EyeOff size={13} /> : <Eye size={13} />}
                      </button>
                      <button type="button" className="asset-row-delete" aria-label={element.locked ? `Unlock ${element.name}` : `Lock ${element.name}`} title={element.locked ? "Unlock (allow dragging)" : "Lock (cannot be dragged)"} onClick={() => onToggleLocked(ref)}>
                        {element.locked ? <Lock size={13} /> : <Unlock size={13} />}
                      </button>
                    </div>
                  );
                })}
                {roomArtworks.length === 0 && roomElements.length === 0 && (
                  <p className="element-empty-note">Nothing in this room yet.</p>
                )}
              </div>
            )}
          </div>
        );
      })}
      <p className="element-empty-note">Click an item to select it. Shift-click (or Ctrl-click) adds to the selection. The eye hides an item in 3D; the lock stops it being dragged.</p>
    </div>
  );
}
