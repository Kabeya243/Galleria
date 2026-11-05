"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Info, Maximize2 } from "lucide-react";
import { useProgress } from "@react-three/drei";
import GalleryScene, { type WalkDebugState } from "@/components/gallery-scene";
import type { Artwork } from "@/lib/demo-data";
import type { GalleryRoom } from "@/lib/rooms";

// Loading screen for the exhibition opening: a progress bar fed by the
// real 3D asset loading (artwork textures), covering the site until the
// room is ready, then fading out. A safety timeout makes sure it can
// never block the site if an image stalls.
function ExhibitionLoader() {
  const { progress, active } = useProgress();
  const [fading, setFading] = useState(false);
  const [gone, setGone] = useState(false);
  const done = progress >= 100 && !active;
  useEffect(() => {
    if (!done) return;
    const fadeTimer = setTimeout(() => setFading(true), 150);
    const goneTimer = setTimeout(() => setGone(true), 750);
    return () => {
      clearTimeout(fadeTimer);
      clearTimeout(goneTimer);
    };
  }, [done]);
  useEffect(() => {
    const timer = setTimeout(() => setGone(true), 10000);
    return () => clearTimeout(timer);
  }, []);
  if (gone) return null;
  return (
    <div className={`exhibition-loader${fading ? " done" : ""}`} aria-hidden={fading || undefined}>
      <div className="loader-brand"><span className="brand-mark">s.</span><span className="brand-name">SANAA</span></div>
      <div className="loader-bar"><span style={{ width: `${Math.round(progress)}%` }} /></div>
      <p>Loading the exhibition… {Math.round(progress)}%</p>
    </div>
  );
}

export default function PublicExhibition({
  exhibition,
}: {
  exhibition: {
    title: string;
    description: string;
    ownerName: string;
    rooms: GalleryRoom[];
    artworks: Artwork[];
  };
}) {
  const [selected, setSelected] = useState<Artwork | undefined>();
  const [showInfo, setShowInfo] = useState(false);
  const [activeRoomId, setActiveRoomId] = useState(exhibition.rooms[0]?.id ?? "");
  const [walking, setWalking] = useState(false);
  const movementKeys = useRef(new Set<string>());
  const walkReset = useRef(0);
  const activeRoom = exhibition.rooms.find((room) => room.id === activeRoomId) ?? exhibition.rooms[0];
  const roomArtworks = exhibition.artworks.filter((artwork) => artwork.roomId === activeRoom?.id);

  // Temporary walk-mode diagnostics, visible only with ?debug=walk in the
  // URL (never for normal visitors). Reports the live walk state, the
  // "Enter the room" card's real position, what element covers it, and the
  // camera position, so a walk failure can be pinpointed from the page text.
  const [debug, setDebug] = useState(false);
  const walkDebug = useRef<WalkDebugState | null>(null);
  const [debugText, setDebugText] = useState("");
  useEffect(() => {
    setDebug(new URLSearchParams(window.location.search).get("debug") === "walk");
  }, []);
  useEffect(() => {
    if (!debug) return;
    const id = setInterval(() => {
      const btn = document.getElementById("walk-start") as HTMLElement | null;
      const card = btn?.closest(".walk-start-card") as HTMLElement | null;
      const rect = btn?.getBoundingClientRect();
      const cx = rect ? rect.left + rect.width / 2 : 0;
      const cy = rect ? rect.top + rect.height / 2 : 0;
      const topEl = rect && rect.width > 0 ? document.elementFromPoint(cx, cy) : null;
      const loader = document.querySelector(".exhibition-loader");
      const cs = card ? getComputedStyle(card) : null;
      const bs = btn ? getComputedStyle(btn) : null;
      const d = walkDebug.current;
      setDebugText([
        `walking=${walking}`,
        `card class=${card?.className ?? "none"}`,
        `card rect=${rect ? `${Math.round(rect.x)},${Math.round(rect.y)} ${Math.round(rect.width)}x${Math.round(rect.height)}` : "none"}`,
        `card computed: pos=${cs?.position} top=${cs?.top} left=${cs?.left} w=${cs?.width} transform=${cs?.transform} z=${cs?.zIndex} display=${cs?.display}`,
        `btn computed: minH=${bs?.minHeight} pad=${bs?.padding} bg=${bs?.backgroundColor}`,
        `card offsetParent=${(card?.offsetParent as HTMLElement)?.tagName ?? "none"}.${((card?.offsetParent as HTMLElement)?.className as string) ?? ""}`,
        `top at card center=${topEl ? `${topEl.tagName}.${(topEl as HTMLElement).className || ""}` : "none"}`,
        `loader in DOM=${loader ? "yes" : "no"}`,
        `walk enabled=${d?.enabled ?? "?"}`,
        `keys=${d?.keys?.length ? d.keys.join(",") : "none"}`,
        `lastKey=${d?.lastKey ?? "none"}`,
        `destination=${d?.destination ? d.destination.map((n) => n.toFixed(1)).join(",") : "null"}`,
        `camera=${d?.camera ? d.camera.map((n) => n.toFixed(2)).join(",") : "?"}`,
      ].join(" | "));
    }, 250);
    return () => clearInterval(id);
  }, [debug, walking]);

  function changeRoom(index: number) {
    const room = exhibition.rooms[index];
    if (!room) return;
    setActiveRoomId(room.id);
    setSelected(undefined);
  }

  return (
    <main className="public-exhibition">
      <ExhibitionLoader />
      {debug && <div className="walk-debug-panel">{debugText}</div>}
      {activeRoom && <GalleryScene
        artworks={exhibition.artworks}
        onSelect={(id) => setSelected(roomArtworks.find((artwork) => artwork.id === id))}
        className="public-gallery-canvas"
        room={activeRoom}
        rooms={exhibition.rooms}
        activeRoomId={activeRoom.id}
        walkMode
        walking={walking}
        input={movementKeys}
        onRoomChange={(id) => { setActiveRoomId(id); setSelected(undefined); }}
        debugState={walkDebug}
        resetSignal={walkReset}
      />}
      <header className="public-topbar">
        <Link href="/" className="public-back"><ArrowLeft size={16} /> SANAA</Link>
        <div className="public-title"><span>{exhibition.ownerName.toUpperCase()} PRESENTS</span><strong>{exhibition.title}</strong></div>
        <button className="public-info-button" aria-label="Exhibition information" onClick={() => setShowInfo((value) => !value)}><Info size={17} /></button>
      </header>
      {activeRoom && <div className="public-room-label"><span>ROOM {String(exhibition.rooms.indexOf(activeRoom) + 1).padStart(2, "0")}</span><i /> {activeRoom.name.toUpperCase()}</div>}
      {exhibition.rooms.length > 1 && <nav className="public-room-nav" aria-label="Exhibition rooms">
        <button aria-label="Previous room" onClick={() => changeRoom((exhibition.rooms.indexOf(activeRoom) - 1 + exhibition.rooms.length) % exhibition.rooms.length)}><ChevronLeft size={15} /></button>
        {exhibition.rooms.map((room, index) => <button key={room.id} className={room.id === activeRoom?.id ? "active" : ""} onClick={() => changeRoom(index)}>{String(index + 1).padStart(2, "0")} <span>{room.name}</span></button>)}
        <button aria-label="Next room" onClick={() => changeRoom((exhibition.rooms.indexOf(activeRoom) + 1) % exhibition.rooms.length)}><ChevronRight size={15} /></button>
      </nav>}
      {!walking && <div className="walk-start-card">
        <span>WALK THROUGH THE EXHIBITION</span>
        <p>Move freely around the room, explore the artworks and pass through the doors to continue.</p>
        <button id="walk-start" onClick={() => setWalking(true)}>Enter the room</button>
      </div>}
      {walking && <div className="public-controls-hint"><span>CLICK THE FLOOR OR USE WASD / ARROWS TO WALK</span><i /> <span>DRAG TO LOOK</span><i /> <span>PASS THROUGH DOORS TO CHANGE ROOMS</span></div>}
      {walking && <button className="public-reset-view" onClick={() => { walkReset.current += 1; }}>↺ Entrance</button>}
      {walking && <div className="walk-pad" aria-label="Touch movement controls">
        {([
          ["ArrowUp", "Forward", "↑"],
          ["ArrowLeft", "Left", "←"],
          ["ArrowDown", "Back", "↓"],
          ["ArrowRight", "Right", "→"],
        ] as const).map(([key, label, icon]) => (
          <button
            key={key}
            aria-label={label}
            onPointerDown={(event) => { event.preventDefault(); movementKeys.current.add(key); }}
            onPointerUp={() => movementKeys.current.delete(key)}
            onPointerLeave={() => movementKeys.current.delete(key)}
            onPointerCancel={() => movementKeys.current.delete(key)}
          >{icon}</button>
        ))}
      </div>}
      <button className="public-fullscreen" aria-label="Fullscreen" onClick={() => document.documentElement.requestFullscreen?.()}><Maximize2 size={17} /></button>
      {(selected || showInfo) && (
        <aside className="artwork-info-card">
          <button className="info-close" onClick={() => { setSelected(undefined); setShowInfo(false); }} aria-label="Close information">×</button>
          {selected ? (
            <>
              <span className="panel-kicker">ARTWORK {String(roomArtworks.indexOf(selected) + 1).padStart(2, "0")}</span>
              <h1>{selected.title}</h1>
              <p className="public-art-meta">{selected.year} <i /> {selected.medium} <i /> {selected.dimensions}</p>
              <p>{selected.description}</p>
              <a href="#artist">{selected.artist || exhibition.ownerName} <ArrowUpRight size={14} /></a>
            </>
          ) : (
            <>
              <span className="panel-kicker">ABOUT THIS EXHIBITION</span>
              <h1>{exhibition.title}</h1>
              <p className="public-art-meta">Curated by {exhibition.ownerName}</p>
              <p>{exhibition.description || "A collection of artworks, brought together in a space of its own."}</p>
              <span className="public-art-meta">{exhibition.artworks.length} artworks · {exhibition.rooms.length} rooms</span>
            </>
          )}
        </aside>
      )}
      <footer className="public-footer"><span>AN EXHIBITION BY {exhibition.ownerName.toUpperCase()}</span><span>MADE WITH <Link href="/">SANAA <ArrowUpRight size={12} /></Link></span></footer>
    </main>
  );
}
