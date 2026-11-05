"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  Expand,
  Eye,
  Grid2X2,
  Image,
  Info,
  Lightbulb,
  Minus,
  Move,
  Plus,
  RotateCw,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  Undo2,
  Upload,
} from "lucide-react";
import GalleryScene from "@/components/gallery-scene";
import ThemeToggle from "@/components/theme-toggle";
import type { Artwork } from "@/lib/demo-data";
import { applyLayoutPreset, createGalleryRoom, floorTextures, roomLayouts, wallTextures, type GalleryRoom, type RoomLayout } from "@/lib/rooms";

export default function Editor({ exhibitionId }: { exhibitionId: string }) {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [rooms, setRooms] = useState<GalleryRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [selectedId, setSelectedId] = useState<string>();
  const [saved, setSaved] = useState(false);
  const [title, setTitle] = useState("Untitled exhibition");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("draft");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const uploadRef = useRef<HTMLInputElement>(null);
  const historyRef = useRef<Artwork[][]>([]);

  useEffect(() => {
    let active = true;
    async function loadExhibition() {
      try {
        const response = await fetch(`/api/exhibitions/${exhibitionId}`);
        const result = await response.json();
        if (response.status === 401) {
          window.location.assign("/login");
          return;
        }
        if (!response.ok) throw new Error(result.error ?? "Could not load this exhibition.");
        if (!active) return;
        setArtworks(result.exhibition.artworks);
        setRooms(result.exhibition.rooms);
        setActiveRoomId(result.exhibition.rooms[0]?.id ?? "");
        historyRef.current = [];
        setSelectedId(result.exhibition.artworks.find((artwork: Artwork) => artwork.roomId === result.exhibition.rooms[0]?.id)?.id);
        setTitle(result.exhibition.title);
        setDescription(result.exhibition.description);
        setSlug(result.exhibition.slug);
        setStatus(result.exhibition.status);
        setSaved(true);
      } catch (error) {
        console.error("Could not load exhibition.", error);
        window.alert(error instanceof Error ? error.message : "Could not load this exhibition.");
        window.location.assign("/");
      } finally {
        if (active) setLoading(false);
      }
    }
    void loadExhibition();
    return () => { active = false; };
  }, [exhibitionId]);

  const selected = useMemo(
    () => artworks.find((artwork) => artwork.id === selectedId && artwork.roomId === activeRoomId),
    [artworks, activeRoomId, selectedId],
  );
  const activeRoom = rooms.find((room) => room.id === activeRoomId) ?? rooms[0];
  const currentArtworks = artworks.filter((artwork) => artwork.roomId === activeRoom?.id);

  function updateArtwork(id: string, update: (artwork: Artwork) => Artwork) {
    historyRef.current = [...historyRef.current, artworks].slice(-30);
    setArtworks((current) => current.map((artwork) => (artwork.id === id ? update(artwork) : artwork)));
    setSaved(false);
  }

  function undoArtworkChange() {
    const previous = historyRef.current.pop();
    if (!previous) return;
    setArtworks(previous);
    setSaved(false);
  }

  function moveArtwork(axis: 0 | 1, amount: number) {
    if (!selected) return;
    updateArtwork(selected.id, (artwork) => {
      const position: [number, number, number] = [...artwork.position];
      position[axis] += amount;
      return { ...artwork, position };
    });
  }

  async function saveExhibition() {
    setBusy(true);
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          description,
          rooms,
          artworks,
        }),
      });
      const result = await response.json();
      if (response.status === 401) {
        window.location.assign("/login");
        return false;
      }
      if (!response.ok) throw new Error(result.error ?? "Could not save this exhibition.");
      setSaved(true);
      return true;
    } catch (error) {
      console.error("Could not save exhibition.", error);
      window.alert(error instanceof Error ? error.message : "Could not save this exhibition.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  function addArtwork(imageUrl: string | null = null) {
    if (!activeRoom) return;
    const index = currentArtworks.length;
    const { width, depth } = roomLayouts[activeRoom.layout];
    const artworkCount = index + 1;
    const spacing = artworkCount > 1 ? Math.min(3.3, (width - 3) / (artworkCount - 1)) : 0;
    const artwork: Artwork = {
      id: crypto.randomUUID(),
      title: `New artwork ${index + 1}`,
      year: "2025",
      medium: "Mixed media",
      dimensions: "80 × 100 cm",
      description: "Add a description to tell visitors about this work.",
      color: ["#8a9b88", "#bb8365", "#8796a9"][index % 3],
      accent: "#e5c7a0",
      position: [(index - (artworkCount - 1) / 2) * spacing, 2.4, -depth / 2 + 0.28],
      rotation: 0,
      scale: 0.8,
      imageUrl,
      roomId: activeRoom.id,
    };
    historyRef.current = [...historyRef.current, artworks].slice(-30);
    setArtworks((current) => [...current, artwork]);
    setSelectedId(artwork.id);
    setSaved(false);
  }

  async function uploadArtwork(file?: File) {
    if (!file) return;
    setBusy(true);
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/uploads", { method: "POST", body });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not upload this image.");
      addArtwork(result.url);
      if (uploadRef.current) uploadRef.current.value = "";
    } catch (error) {
      console.error("Could not upload artwork.", error);
      window.alert(error instanceof Error ? error.message : "Could not upload this image.");
    } finally {
      setBusy(false);
    }
  }

  async function publishExhibition() {
    if (!saved && !(await saveExhibition())) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}/publish`, { method: "POST" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not publish this exhibition.");
      setStatus(result.status);
      setSlug(result.slug);
    } catch (error) {
      console.error("Could not publish exhibition.", error);
      window.alert(error instanceof Error ? error.message : "Could not publish this exhibition.");
    } finally {
      setBusy(false);
    }
  }

  function editTitle() {
    const updatedTitle = window.prompt("Exhibition title", title);
    if (!updatedTitle?.trim()) return;
    setTitle(updatedTitle.trim().slice(0, 120));
    setSaved(false);
  }

  function removeArtwork() {
    if (!selected) return;
    historyRef.current = [...historyRef.current, artworks].slice(-30);
    setArtworks((current) => current.filter((artwork) => artwork.id !== selected.id));
    setSelectedId(undefined);
    setSaved(false);
  }

  function duplicateArtwork() {
    if (!selected) return;
    const copy: Artwork = {
      ...selected,
      id: crypto.randomUUID(),
      title: `${selected.title} copy`.slice(0, 120),
      position: [selected.position[0] + 1.5, selected.position[1], selected.position[2]],
    };
    historyRef.current = [...historyRef.current, artworks].slice(-30);
    setArtworks((current) => [...current, copy]);
    setSelectedId(copy.id);
    setSaved(false);
  }

  function updateRoom(id: string, update: (room: GalleryRoom) => GalleryRoom) {
    const currentRoom = rooms.find((room) => room.id === id);
    if (!currentRoom) return;
    const updatedRoom = update(currentRoom);
    const { width, depth } = roomLayouts[updatedRoom.layout];
    const normalizedRoom = {
      ...updatedRoom,
      partitionWalls: updatedRoom.partitionWalls.map((wall) => {
        const length = Math.max(1, Math.min(wall.length, (wall.orientation === "horizontal" ? width : depth) - 0.18));
        const halfWidth = wall.orientation === "horizontal" ? length / 2 : 0.09;
        const halfDepth = wall.orientation === "vertical" ? length / 2 : 0.09;
        return {
          ...wall,
          length,
          x: Math.max(-width / 2 + halfWidth, Math.min(width / 2 - halfWidth, wall.x)),
          z: Math.max(-depth / 2 + halfDepth, Math.min(depth / 2 - halfDepth, wall.z)),
        };
      }),
    };
    setRooms((current) => current.map((room) => room.id === id ? normalizedRoom : room));
    if (updatedRoom.layout !== currentRoom.layout) {
      historyRef.current = [...historyRef.current, artworks].slice(-30);
      setArtworks((current) => current.map((artwork) => artwork.roomId === id
        ? { ...artwork, position: [Math.max(-width / 2 + 1.5, Math.min(width / 2 - 1.5, artwork.position[0])), artwork.position[1], -depth / 2 + 0.28] }
        : artwork));
    }
    setSaved(false);
  }

  function addPartitionWall() {
    if (!activeRoom || activeRoom.partitionWalls.length >= 8) return;
    updateRoom(activeRoom.id, (room) => ({
      ...room,
      partitionWalls: [...room.partitionWalls, {
        id: crypto.randomUUID(),
        x: 0,
        z: 0,
        length: 4,
        orientation: "horizontal",
      }],
    }));
  }

  function removePartitionWall(wallId: string) {
    if (!activeRoom) return;
    updateRoom(activeRoom.id, (room) => ({
      ...room,
      partitionWalls: room.partitionWalls.filter((wall) => wall.id !== wallId),
    }));
  }

  function addRoom() {
    if (rooms.length >= 12) return;
    const room = createGalleryRoom(rooms.length);
    setRooms((current) => [...current, room]);
    setActiveRoomId(room.id);
    setSelectedId(undefined);
    setSaved(false);
  }

  function removeRoom() {
    if (!activeRoom || rooms.length <= 1) return;
    const artworksToRemove = artworks.filter((artwork) => artwork.roomId === activeRoom.id).length;
    if (!window.confirm(`Remove "${activeRoom.name}" and its ${artworksToRemove} artwork${artworksToRemove === 1 ? "" : "s"}?`)) return;
    const nextRooms = rooms.filter((room) => room.id !== activeRoom.id);
    const nextRoom = nextRooms[0];
    historyRef.current = [];
    setRooms(nextRooms);
    setArtworks((current) => current.filter((artwork) => artwork.roomId !== activeRoom.id));
    setActiveRoomId(nextRoom.id);
    setSelectedId(artworks.find((artwork) => artwork.roomId === nextRoom.id)?.id);
    setSaved(false);
  }

  return (
    <main className="editor-shell">
      {loading && <div className="editor-loading">Opening your exhibition…</div>}
      <header className="editor-topbar">
        <div className="editor-brand-group">
          <Link href="/" className="editor-back" aria-label="Back to dashboard"><ArrowLeft size={18} /></Link>
          <Link className="brand-lockup editor-brand" href="/"><span className="brand-mark">s.</span><span className="brand-name">SANAA</span></Link>
          <span className="editor-separator" />
          <div className="editor-title"><strong>{title}</strong><span><i /> {saved ? "All changes saved" : "Unsaved changes"}</span></div>
          <button className="subtle-edit-button" aria-label="Edit exhibition title" onClick={editTitle}><Settings2 size={14} /></button>
        </div>
        <div className="editor-top-actions">
          <ThemeToggle />
          <span className="saved-state"><span className={saved ? "save-indicator done" : "save-indicator"} />{saved ? "Saved" : "Unsaved changes"}</span>
          <button className="editor-secondary-button" onClick={() => void saveExhibition()} disabled={busy}><Save size={15} /> Save</button>
          {status === "public" && <Link className="editor-secondary-button" href={`/exhibition/${slug}`}><Eye size={15} /> Preview</Link>}
          <button className="editor-publish-button" onClick={() => void publishExhibition()} disabled={busy}>{status === "public" ? "Unpublish" : "Publish"} <ArrowRight size={15} /></button>
        </div>
      </header>

      <div className="editor-workspace">
        <aside className="editor-assets-panel">
          <div className="panel-heading"><div><span className="panel-kicker">YOUR EXHIBITION</span><h1>Build your space</h1></div><button className="tiny-icon-button" aria-label="Editor help"><CircleHelp size={16} /></button></div>
          <div className="room-list">
            {rooms.map((room, index) => (
              <button
                className={`room-selector ${room.id === activeRoom?.id ? "selected" : ""}`}
                key={room.id}
                onClick={() => { setActiveRoomId(room.id); setSelectedId(undefined); }}
              >
                <span className="room-number">{String(index + 1).padStart(2, "0")}</span>
                <span><strong>{room.name}</strong><small>{roomLayouts[room.layout].label} · {artworks.filter((artwork) => artwork.roomId === room.id).length} artworks</small></span>
                <ChevronDown size={15} />
              </button>
            ))}
            <button className="add-room-button" onClick={addRoom} disabled={rooms.length >= 12}><Plus size={13} /> Add a room</button>
          </div>
          <div className="panel-tabs"><button className="active">Artworks <span>{currentArtworks.length}</span></button><button>Elements</button></div>
          <div className="asset-list">
            {currentArtworks.map((artwork, index) => (
              <button className={`asset-row ${selectedId === artwork.id ? "selected" : ""}`} key={artwork.id} onClick={() => setSelectedId(artwork.id)}>
                <span className={`asset-thumb asset-color-${index % 3}`}><span /></span>
                <span className="asset-copy"><strong>{artwork.title}</strong><small>{artwork.year} · {artwork.medium.split(" ")[0]}</small></span>
                {selectedId === artwork.id && <span className="selected-mark"><Check size={12} /></span>}
              </button>
            ))}
          </div>
          <button className="add-to-room" onClick={() => uploadRef.current?.click()} disabled={busy}><Plus size={15} /> Add artwork to room</button>
          <input ref={uploadRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/heic,image/heif" onChange={(event) => void uploadArtwork(event.target.files?.[0])} />
          <div className="asset-upload-hint"><Upload size={15} /><span>Upload a PNG, JPEG, WebP, AVIF, HEIC or HEIF image (max. 8 MB).</span></div>
          <div className="left-panel-bottom"><div className="tip-card"><div className="tip-heading"><Lightbulb size={14} /> QUICK TIP</div><p>Select an artwork in the room to adjust its placement and scale.</p></div><button className="panel-help-link"><CircleHelp size={15} /> Editor guide <ArrowRight size={13} /></button></div>
        </aside>

        <section className="editor-stage">
          <div className="stage-toolbar">
            <div className="tool-group">
              <button className="tool-button active" aria-label="Select and move"><Move size={16} /></button>
              <button className="tool-button" aria-label="Rotate selected artwork" onClick={() => selected && updateArtwork(selected.id, (artwork) => ({ ...artwork, rotation: artwork.rotation + Math.PI / 12 }))}><RotateCw size={16} /></button>
              <span className="tool-divider" />
              <button className="tool-button" aria-label="Undo artwork change" onClick={undoArtworkChange} disabled={!historyRef.current.length}><Undo2 size={16} /></button>
            </div>
            <div className="stage-room-name"><span /> {activeRoom?.name.toUpperCase() ?? "ROOM"} <ChevronDown size={13} /></div>
            <div className="tool-group">
              <button className="tool-button" aria-label="Toggle grid"><Grid2X2 size={16} /></button>
              <button className="tool-button" aria-label="Toggle stage settings"><Settings2 size={16} /></button>
              <button className="tool-button" aria-label="Fullscreen" onClick={() => document.querySelector(".scene-wrap")?.requestFullscreen()}><Expand size={16} /></button>
            </div>
          </div>
          <div className="scene-wrap">
            {activeRoom && <GalleryScene artworks={currentArtworks} selectedId={selectedId} onSelect={setSelectedId} className="gallery-canvas editor-canvas" room={activeRoom} interior />}
            <div className="scene-caption"><span className="scene-caption-dot" /> 3D VIEW <span className="caption-divider">·</span> INSIDE THE ROOM <span className="caption-divider">·</span> DRAG TO LOOK AROUND <span className="caption-divider">·</span> SCROLL TO ZOOM</div>
            <div className="scene-room-count"><span>{String(rooms.findIndex((room) => room.id === activeRoom?.id) + 1).padStart(2, "0")}</span><span className="room-count-line" /><span>{String(rooms.length).padStart(2, "0")}</span></div>
            <div className="stage-tools-float"><button onClick={() => moveArtwork(1, 0.15)} title="Move up"><Plus size={14} /></button><button onClick={() => moveArtwork(1, -0.15)} title="Move down"><Minus size={14} /></button><span /><button onClick={() => selected && updateArtwork(selected.id, (artwork) => ({ ...artwork, scale: Math.min(1.6, artwork.scale + 0.1) }))} title="Increase scale"><Expand size={14} /></button><button onClick={() => selected && updateArtwork(selected.id, (artwork) => ({ ...artwork, scale: Math.max(0.5, artwork.scale - 0.1) }))} title="Decrease scale"><Minus size={14} /></button></div>
            <div className="stage-add-button"><button onClick={() => uploadRef.current?.click()}><Plus size={14} /> Add artwork</button></div>
          </div>
          <div className="editor-statusbar"><span><span className="status-online" /> Scene ready</span><span>{activeRoom ? roomLayouts[activeRoom.layout].label : "Gallery"} <span className="status-dot-separator">·</span> {rooms.length} rooms <span className="status-dot-separator">·</span> {currentArtworks.length} artworks</span><span>100%</span></div>
        </section>

        <aside className="editor-properties-panel">
          <div className="properties-header"><div><span className="panel-kicker">INSPECTOR</span><h2>{selected ? "Artwork details" : "Room settings"}</h2></div><button className="tiny-icon-button" aria-label="More properties"><Info size={15} /></button></div>
          {selected ? (
            <>
              <div className="selected-art-preview"><div className="selected-art-image" style={{ backgroundColor: selected.color }}><span style={{ backgroundColor: selected.accent }} /></div><div><strong>{selected.title}</strong><small>{selected.year} · {selected.medium}</small></div></div>
              <div className="property-section"><label>POSITION <span>METERS</span></label><div className="coordinate-row">{(["X", "Y", "Z"] as const).map((axis, index) => <div key={axis}><span>{axis}</span><input aria-label={`Position ${axis}`} type="number" step="0.1" value={selected.position[index]} onChange={(event) => updateArtwork(selected.id, (artwork) => { const position: [number, number, number] = [...artwork.position]; position[index] = Number(event.target.value); return { ...artwork, position }; })} /></div>)}</div></div>
              <div className="property-section"><label>SIZE <span>UNIFORM</span></label><div className="range-control"><input aria-label="Artwork scale" type="range" min="0.5" max="1.6" step="0.05" value={selected.scale} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, scale: Number(event.target.value) }))} /><span>{Math.round(selected.scale * 100)}%</span></div></div>
              <div className="property-section"><label>ROTATION</label><div className="rotate-control"><button aria-label="Rotate counterclockwise" onClick={() => updateArtwork(selected.id, (artwork) => ({ ...artwork, rotation: artwork.rotation - Math.PI / 12 }))}><RotateCw className="rotate-back" size={15} /></button><span>{Math.round((selected.rotation * 180) / Math.PI)}°</span><button aria-label="Rotate clockwise" onClick={() => updateArtwork(selected.id, (artwork) => ({ ...artwork, rotation: artwork.rotation + Math.PI / 12 }))}><RotateCw size={15} /></button></div></div>
              <div className="property-section"><label>ARTWORK LABEL</label><input className="full-input" value={selected.title} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, title: event.target.value }))} /></div>
                  <div className="property-section"><label>ARTIST</label><input className="full-input" value={selected.artist ?? ""} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, artist: event.target.value }))} /></div>
                  <div className="property-section"><label>YEAR</label><input className="full-input" value={selected.year} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, year: event.target.value }))} /></div>
                  <div className="property-section"><label>MEDIUM</label><input className="full-input" value={selected.medium} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, medium: event.target.value }))} /></div>
                  <div className="property-section"><label>DIMENSIONS</label><input className="full-input" value={selected.dimensions} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, dimensions: event.target.value }))} /></div>
                  <div className="property-section"><label>DESCRIPTION</label><textarea className="full-input property-textarea" value={selected.description} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, description: event.target.value }))} /></div>
                  <div className="property-section"><label>FRAME STYLE</label><button className="select-input">Natural oak <ChevronDown size={14} /></button></div>
                  <div className="property-actions"><button onClick={() => selected && updateArtwork(selected.id, (artwork) => ({ ...artwork, position: [0, 2.5, -5.72], rotation: 0, scale: 1 }))}><Sparkles size={14} /> Fit to wall</button><button aria-label="Duplicate artwork" onClick={duplicateArtwork}><Copy size={14} /></button><button className="delete-action" aria-label="Delete artwork" onClick={removeArtwork}><Trash2 size={14} /></button></div>
                </>
              ) : (
                <div className="room-properties">
                    <p>Shape this room and its walls.</p>
                    {activeRoom && <>
                      <div className="property-section"><label>ROOM NAME</label><input className="full-input" value={activeRoom.name} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, name: event.target.value.slice(0, 60) }))} /></div>
                      <div className="property-section"><label>GALLERY</label><select className="full-input" value={activeRoom.layout} onChange={(event) => updateRoom(activeRoom.id, (room) => applyLayoutPreset(room, event.target.value as RoomLayout))}>{Object.entries(roomLayouts).map(([layout, details]) => <option key={layout} value={layout}>{details.label} · {details.width} × {details.depth} m</option>)}</select></div>
                      <div className="property-section"><label>BACK WALL</label><div className="room-color-control"><input type="color" aria-label="Back wall colour" value={activeRoom.wallColor} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, wallColor: event.target.value }))} /><span>{activeRoom.wallColor}</span></div></div>
                      <div className="property-section"><label>SIDE WALLS</label><div className="room-color-control"><input type="color" aria-label="Side walls colour" value={activeRoom.sideWallColor} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, sideWallColor: event.target.value }))} /><span>{activeRoom.sideWallColor}</span></div></div>
                      <div className="property-section"><label>CEILING</label><div className="room-color-control"><input type="color" aria-label="Ceiling colour" value={activeRoom.ceilingColor} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, ceilingColor: event.target.value }))} /><span>{activeRoom.ceilingColor}</span></div></div>
                      <div className="property-section"><label>FLOOR</label><div className="room-color-control"><input type="color" aria-label="Floor colour" value={activeRoom.floorColor} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, floorColor: event.target.value }))} /><span>{activeRoom.floorColor}</span></div></div>
                      <div className="property-section"><label>WALL TEXTURE</label><select className="full-input" value={activeRoom.wallTexture} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, wallTexture: event.target.value as GalleryRoom["wallTexture"] }))}>{Object.entries(wallTextures).map(([texture, label]) => <option key={texture} value={texture}>{label}</option>)}</select></div>
                      <div className="property-section"><label>FLOOR TEXTURE</label><select className="full-input" value={activeRoom.floorTexture} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, floorTexture: event.target.value as GalleryRoom["floorTexture"] }))}>{Object.entries(floorTextures).map(([texture, label]) => <option key={texture} value={texture}>{label}</option>)}</select></div>
                      <div className="property-section"><label>CEILING TEXTURE</label><select className="full-input" value={activeRoom.ceilingTexture} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, ceilingTexture: event.target.value as GalleryRoom["ceilingTexture"] }))}>{Object.entries(wallTextures).map(([texture, label]) => <option key={texture} value={texture}>{label}</option>)}</select></div>
                      <div className="property-section"><label>LIGHTING</label><label className="room-lighting-toggle"><input type="checkbox" checked={activeRoom.spotlights} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, spotlights: event.target.checked }))} /> Ceiling spotlights</label></div>
                      <div className="property-section">
                        <label>PARTITION WALLS <span>{activeRoom.partitionWalls.length}/8</span></label>
                        <div className="partition-wall-list">{activeRoom.partitionWalls.map((wall, index) => (
                          <div className="partition-wall-setting" key={wall.id}>
                            <div className="partition-wall-heading"><span>WALL {String(index + 1).padStart(2, "0")}</span><button type="button" aria-label={`Remove wall ${index + 1}`} onClick={() => removePartitionWall(wall.id)}><Trash2 size={12} /></button></div>
                            <select className="full-input" aria-label={`Wall ${index + 1} direction`} value={wall.orientation} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, partitionWalls: room.partitionWalls.map((item) => item.id === wall.id ? { ...item, orientation: event.target.value as typeof item.orientation } : item) }))}>
                              <option value="horizontal">Horizontal</option><option value="vertical">Vertical</option>
                            </select>
                            <div className="partition-wall-coordinates">
                              <label>X<input aria-label={`Wall ${index + 1} position X`} type="number" step="0.5" value={wall.x} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, partitionWalls: room.partitionWalls.map((item) => item.id === wall.id ? { ...item, x: Number(event.target.value) } : item) }))} /></label>
                              <label>Z<input aria-label={`Wall ${index + 1} position Z`} type="number" step="0.5" value={wall.z} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, partitionWalls: room.partitionWalls.map((item) => item.id === wall.id ? { ...item, z: Number(event.target.value) } : item) }))} /></label>
                              <label>LENGTH<input aria-label={`Wall ${index + 1} length`} type="number" min="1" max="16" step="0.5" value={wall.length} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, partitionWalls: room.partitionWalls.map((item) => item.id === wall.id ? { ...item, length: Number(event.target.value) } : item) }))} /></label>
                            </div>
                          </div>
                        ))}</div>
                        <button className="add-partition-wall" type="button" onClick={addPartitionWall} disabled={activeRoom.partitionWalls.length >= 8}><Plus size={12} /> Add a partition wall</button>
                      </div>
                      <div className="property-section"><label>CURATORIAL TEXT ON WALL <span>{activeRoom.curatorialText.length}/300</span></label><textarea className="full-input property-textarea" maxLength={300} placeholder="Write the introduction visitors will read in this room." value={activeRoom.curatorialText} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, curatorialText: event.target.value }))} /></div>
                      <button className="remove-room-button" onClick={removeRoom} disabled={rooms.length <= 1}><Trash2 size={13} /> Remove this room</button>
                    </>}
                    <div className="property-section"><label>EXHIBITION DESCRIPTION</label><textarea className="full-input property-textarea" value={description} onChange={(event) => { setDescription(event.target.value); setSaved(false); }} /></div>
                <div className="room-settings-note"><Sparkles size={15} /><span>Each gallery keeps its own layout, colours, ceiling and artworks.</span></div>
            </div>
          )}
          <div className="inspector-footer"><span>Saved with exhibition</span><span className="local-save-dot" /></div>
        </aside>
      </div>
    </main>
  );
}
