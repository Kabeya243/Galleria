"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Eye, Footprints, PenLine, Search, Star } from "lucide-react";
import GalleryScene from "@/components/gallery-scene";
import Sidebar from "@/components/sidebar";
import ThemeToggle from "@/components/theme-toggle";
import { ceilingTextures, createGalleryRoom, floorTextures, roomCategories, roomLayouts, wallTextures, type RoomCategory, type RoomLayout } from "@/lib/rooms";

export type GalleryPresetCard = {
  key: RoomLayout;
  label: string;
  category: RoomCategory;
  description: string;
  width: number;
  depth: number;
  height: number;
  wallColor: string;
  sideWallColor: string;
  floorColor: string;
  ceilingColor: string;
  wallTexture: keyof typeof wallTextures;
  floorTexture: keyof typeof floorTextures;
  ceilingTexture: keyof typeof ceilingTextures;
};

function shadeHex(hex: string, factor: number): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = Math.min(255, Math.max(0, Math.round(((value >> 16) & 255) * factor)));
  const g = Math.min(255, Math.max(0, Math.round(((value >> 8) & 255) * factor)));
  const b = Math.min(255, Math.max(0, Math.round((value & 255) * factor)));
  return `rgb(${r}, ${g}, ${b})`;
}

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 2D version of the 3D surface patterns, painted with the room's real
// colours: each card preview is derived from the preset itself, not a
// stock image.
function paintPattern(
  ctx: CanvasRenderingContext2D,
  texture: keyof typeof wallTextures | keyof typeof floorTextures,
  color: string,
  x: number,
  y: number,
  w: number,
  h: number,
) {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
  const dark = shadeHex(color, 0.45);
  const rand = mulberry32(7);
  if (texture === "brick") {
    const rows = 8;
    const rh = h / rows;
    for (let row = 0; row < rows; row += 1) {
      const offset = row % 2 ? -w / 8 : 0;
      for (let cx = offset; cx < w; cx += w / 4) {
        ctx.fillStyle = shadeHex(color, 0.92 + ((row + Math.round(cx)) % 3) * 0.04);
        ctx.fillRect(x + cx + 1.5, y + row * rh + 1.5, w / 4 - 3, rh - 3);
      }
    }
    ctx.fillStyle = dark;
    for (let row = 0; row <= rows; row += 1) ctx.fillRect(x, y + row * rh - 1, w, 2);
    for (let row = 0; row < rows; row += 1) {
      const offset = row % 2 ? -w / 8 : 0;
      for (let cx = offset; cx <= w; cx += w / 4) ctx.fillRect(x + cx - 1, y + row * rh, 2, rh);
    }
  } else if (texture === "concrete") {
    ctx.fillStyle = dark;
    ctx.fillRect(x, y + h / 2 - 1, w, 2);
    ctx.fillRect(x + w / 2 - 1, y, 2, h);
    ctx.fillStyle = shadeHex(color, 0.3);
    for (const gx of [0.25, 0.75]) {
      for (const gy of [0.25, 0.75]) {
        ctx.beginPath();
        ctx.arc(x + w * gx, y + h * gy, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    for (let i = 0; i < 120; i += 1) {
      ctx.fillStyle = `rgba(0, 0, 0, ${0.04 + rand() * 0.06})`;
      ctx.fillRect(x + rand() * w, y + rand() * h, 2, 2);
    }
  } else if (texture === "wood") {
    const planks = 6;
    const ph = h / planks;
    for (let p = 0; p < planks; p += 1) {
      ctx.fillStyle = shadeHex(color, 0.9 + (p % 3) * 0.06);
      ctx.fillRect(x, y + p * ph + 1, w, ph - 2);
    }
    ctx.fillStyle = dark;
    for (let p = 0; p <= planks; p += 1) ctx.fillRect(x, y + p * ph - 1, w, 2);
  } else if (texture === "marble") {
    ctx.strokeStyle = shadeHex(color, 0.62);
    ctx.lineWidth = 1.2;
    for (let i = 0; i < 5; i += 1) {
      const sx = x + rand() * w;
      ctx.beginPath();
      ctx.moveTo(sx, y);
      ctx.bezierCurveTo(sx + (rand() - 0.5) * 60, y + h * 0.33, sx + (rand() - 0.5) * 60, y + h * 0.66, sx + (rand() - 0.5) * 40, y + h);
      ctx.stroke();
    }
  } else if (texture === "stone") {
    ctx.fillStyle = dark;
    ctx.fillRect(x, y + h / 2 - 1, w, 2);
    ctx.fillRect(x + w / 2 - 1, y, 2, h);
    ctx.fillStyle = shadeHex(color, 0.96);
    ctx.fillRect(x + 2, y + 2, w / 2 - 4, h / 2 - 4);
    ctx.fillStyle = shadeHex(color, 1.02);
    ctx.fillRect(x + w / 2 + 2, y + h / 2 + 2, w / 2 - 4, h / 2 - 4);
  } else {
    for (let i = 0; i < 90; i += 1) {
      ctx.fillStyle = `rgba(0, 0, 0, ${0.03 + rand() * 0.05})`;
      ctx.fillRect(x + rand() * w, y + rand() * h, 2, 2);
    }
  }
  ctx.restore();
}

function RoomPreviewCanvas({ room }: { room: GalleryPresetCard }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const w = canvas.width;
    const h = canvas.height;
    // Ceiling strip, wall, floor — the room's real finishes, stacked.
    paintPattern(ctx, room.ceilingTexture, room.ceilingColor, 0, 0, w, h * 0.12);
    paintPattern(ctx, room.wallTexture, room.wallColor, 0, h * 0.12, w, h * 0.58);
    paintPattern(ctx, room.floorTexture, room.floorColor, 0, h * 0.7, w, h * 0.3);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, h * 0.7 - 1, w, 2);
  }, [room]);
  return <canvas ref={ref} width={640} height={240} className="gallery-card-preview" aria-label={`${room.label} finishes preview`} />;
}

export default function GalleriesPage({
  rooms,
  user,
  ownExhibitionCount,
}: {
  rooms: GalleryPresetCard[];
  user: { id: string; name: string; email: string; isAdmin?: boolean } | null;
  ownExhibitionCount: number;
}) {
  const [selected, setSelected] = useState<RoomLayout>("cube");
  const [opening, setOpening] = useState<RoomLayout | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [walking, setWalking] = useState(false);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<"All" | "Favourites" | RoomCategory>("All");
  const [favourites, setFavourites] = useState<RoomLayout[]>([]);

  // Favourites live in this browser only (localStorage) — the same
  // pattern as the Contacts tool. They do not sync to the account.
  const FAVOURITES_KEY = "sanaa:favourite-galleries";
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FAVOURITES_KEY);
      if (!raw) return;
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        setFavourites(parsed.filter((key): key is RoomLayout => typeof key === "string" && key in roomLayouts));
      }
    } catch {
      // A corrupt stored list just means no favourites yet.
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(FAVOURITES_KEY, JSON.stringify(favourites));
    } catch {
      // Private browsing or a full store: favourites just won't persist.
    }
  }, [favourites]);

  function toggleFavourite(layout: RoomLayout) {
    setFavourites((current) =>
      current.includes(layout) ? current.filter((key) => key !== layout) : [...current, layout],
    );
  }

  const filteredRooms = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return rooms.filter((room) => {
      if (category === "Favourites" && !favourites.includes(room.key)) return false;
      if (category !== "All" && category !== "Favourites" && room.category !== category) return false;
      if (needle && ![room.label, room.description, room.category].join(" ").toLowerCase().includes(needle)) return false;
      return true;
    });
  }, [rooms, query, category, favourites]);
  const movementKeys = useRef(new Set<string>());
  const viewerRef = useRef<HTMLDivElement>(null);
  const selectedRoom = rooms.find((room) => room.key === selected) ?? rooms[0];
  const viewerRoom = useMemo(() => createGalleryRoom(0, selected), [selected]);

  function viewIn3D(layout: RoomLayout) {
    setWalking(false);
    setSelected(layout);
    viewerRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  // Existing flow, unchanged: create an exhibition, give its first room
  // this layout, then open the editor. Signed-out visitors go to /login.
  async function openInEditor(layout: RoomLayout) {
    setOpening(layout);
    setOpenError(null);
    try {
      const createResponse = await fetch("/api/exhibitions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // The title is mandatory (feature 7): the room's own label names
        // the show, and the PUT below still seeds this layout's room.
        body: JSON.stringify({ title: roomLayouts[layout].label }),
      });
      if (createResponse.status === 401) {
        window.location.assign("/login");
        return;
      }
      const created = await createResponse.json();
      if (!createResponse.ok) throw new Error(created.error ?? "Could not create an exhibition.");
      const room = createGalleryRoom(0, layout);
      const saveResponse = await fetch(`/api/exhibitions/${created.exhibition.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: roomLayouts[layout].label,
          description: "",
          rooms: [room],
          artworks: [],
        }),
      });
      const saved = await saveResponse.json();
      if (!saveResponse.ok) throw new Error(saved.error ?? "Could not prepare this room.");
      window.location.assign(`/editor/${created.exhibition.id}`);
    } catch (error) {
      console.error("Could not open this room in the editor.", error);
      setOpenError(error instanceof Error ? error.message : "Could not open this room in the editor.");
      setOpening(null);
    }
  }

  // The models only — the same content in both shells: a live 3D preview
  // plus the room cards, with category filters, search and favourites.
  // Nothing else lives on this page.
  const galleriesContent = (
    <>
      <section className="galleries-intro">
        <p className="eyebrow">{rooms.length} ROOMS · ONE COLLECTION</p>
        <h1>Galleries<span className="title-period">.</span></h1>
        <p>{rooms.length} gallery rooms, each with its own light, walls and floor. Pick one to walk through, or open it in the editor and hang your work.</p>
      </section>

      {openError && (
        <div className="editor-error-banner" role="alert">
          <span>{openError}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setOpenError(null)}>
            ×
          </button>
        </div>
      )}

      <section className="galleries-viewer" ref={viewerRef}>
        <div className="galleries-viewer-head">
          <div>
            <span className="panel-kicker">LIVE 3D PREVIEW</span>
            <h2>{selectedRoom.label}</h2>
            <p>{selectedRoom.width} × {selectedRoom.depth} m · {selectedRoom.height} m high · {wallTextures[selectedRoom.wallTexture]} walls · {floorTextures[selectedRoom.floorTexture]} floor</p>
          </div>
          <button className="galleries-open-button" onClick={() => void openInEditor(selected)} disabled={opening !== null}>
            <PenLine size={15} /> {opening === selected ? "Opening…" : "Open in editor"}
          </button>
          <button
            className="galleries-open-button"
            onClick={() => toggleFavourite(selected)}
            aria-label={favourites.includes(selected) ? `Remove ${selectedRoom.label} from favourites` : `Save ${selectedRoom.label} as a favourite`}
            aria-pressed={favourites.includes(selected)}
            style={{ background: "transparent", color: "var(--ink)", border: "1px solid var(--line)" }}
          >
            <Star size={15} fill={favourites.includes(selected) ? "currentColor" : "none"} /> {favourites.includes(selected) ? "Saved" : "Save"}
          </button>
          <button className="galleries-open-button" onClick={() => setWalking((value) => !value)} aria-label="Walk through this room">
            <Footprints size={15} /> {walking ? "Exit walk" : "Walk through"}
          </button>
        </div>
        <div className="galleries-viewer-stage">
          <GalleryScene artworks={[]} room={viewerRoom} rooms={[viewerRoom]} activeRoomId={viewerRoom.id} className="galleries-viewer-canvas" interior walkMode={walking} walking={walking} input={walking ? movementKeys : undefined} />
        </div>
        <p className="galleries-viewer-hint">{walking ? "Walk mode · Click the floor to walk · WASD to move · Drag to look" : "Inside the room · Drag to look around · Scroll to zoom"}</p>
      </section>

      <section aria-label="Find a gallery" style={{ maxWidth: 1350, margin: "28px auto 0", padding: "0 44px" }}>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, border: "1px solid var(--line)", borderRadius: 8, padding: "0 12px", minHeight: 40, flex: "1 1 240px", maxWidth: 340, background: "var(--surface-3)" }}>
            <Search size={15} style={{ color: "var(--muted)", flexShrink: 0 }} />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search galleries…"
              aria-label="Search galleries by name or description"
              style={{ border: 0, outline: "none", background: "transparent", font: "inherit", fontSize: 13, width: "100%", color: "inherit" }}
            />
          </label>
          <div role="group" aria-label="Filter by category" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {(["All", "Favourites", ...roomCategories] as const).map((chip) => {
              const active = category === chip;
              const count = chip === "All" ? rooms.length : chip === "Favourites" ? favourites.length : rooms.filter((room) => room.category === chip).length;
              return (
                <button
                  key={chip}
                  type="button"
                  onClick={() => setCategory(chip)}
                  aria-pressed={active}
                  style={{
                    minHeight: 34,
                    padding: "0 13px",
                    borderRadius: 999,
                    border: "1px solid var(--line)",
                    background: active ? "var(--ink)" : "transparent",
                    color: active ? "var(--paper)" : "inherit",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {chip === "Favourites" ? `★ Favourites (${count})` : `${chip} (${count})`}
                </button>
              );
            })}
          </div>
        </div>
        <p style={{ margin: "10px 0 0", color: "var(--muted)", fontSize: 11 }}>
          {filteredRooms.length === rooms.length
            ? `Showing all ${rooms.length} rooms.`
            : `Showing ${filteredRooms.length} of ${rooms.length} rooms.`}{" "}
          Favourites are saved in this browser only — they do not sync to your account yet.
        </p>
      </section>

      <section className="galleries-grid">
        {filteredRooms.map((room) => (
          <article key={room.key} className={`gallery-card${room.key === selected ? " selected" : ""}`}>
            <button className="gallery-card-preview-button" onClick={() => viewIn3D(room.key)} aria-label={`Preview ${room.label} in 3D`}>
              <RoomPreviewCanvas room={room} />
            </button>
            <div className="gallery-card-body">
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <div>
                  <p style={{ margin: "0 0 2px", color: "var(--accent)", fontSize: 10, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase" }}>{room.category}</p>
                  <h3>{room.label}</h3>
                </div>
                <button
                  type="button"
                  onClick={() => toggleFavourite(room.key)}
                  aria-label={favourites.includes(room.key) ? `Remove ${room.label} from favourites` : `Save ${room.label} as a favourite`}
                  aria-pressed={favourites.includes(room.key)}
                  title={favourites.includes(room.key) ? "Remove from favourites" : "Save as favourite"}
                  style={{ background: "transparent", border: 0, padding: 2, cursor: "pointer", color: favourites.includes(room.key) ? "var(--accent)" : "var(--muted)", flexShrink: 0 }}
                >
                  <Star size={17} fill={favourites.includes(room.key) ? "currentColor" : "none"} />
                </button>
              </div>
              <p style={{ marginTop: 4, lineHeight: 1.5 }}>{room.description}</p>
              <p className="gallery-card-finishes" style={{ marginTop: 6 }}>{room.width} × {room.depth} m · {room.height} m high · {wallTextures[room.wallTexture]} walls · {floorTextures[room.floorTexture]} floor</p>
              <div className="gallery-card-actions">
                <button onClick={() => viewIn3D(room.key)}><Eye size={14} /> View in 3D</button>
                <button className="gallery-card-open" onClick={() => void openInEditor(room.key)} disabled={opening !== null}>
                  <PenLine size={14} /> {opening === room.key ? "Opening…" : "Open in editor"}
                </button>
              </div>
            </div>
          </article>
        ))}
        {filteredRooms.length === 0 && (
          <div style={{ gridColumn: "1 / -1", border: "1px solid var(--line)", borderRadius: 12, padding: "32px 20px", textAlign: "center" }}>
            <p style={{ margin: 0, fontWeight: 600 }}>No galleries match that search.</p>
            <p style={{ margin: "6px 0 14px", color: "var(--muted)", fontSize: 12 }}>
              {category === "Favourites" ? "You have not saved any favourites yet — tap the star on a room to save it here." : "Try a different word, or clear the filters."}
            </p>
            <button
              type="button"
              onClick={() => { setQuery(""); setCategory("All"); }}
              style={{ minHeight: 36, padding: "0 16px", borderRadius: 8, border: "1px solid var(--line)", background: "var(--ink)", color: "var(--paper)", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
            >
              Clear filters
            </button>
          </div>
        )}
      </section>
    </>
  );

  if (!user) {
    return (
      <main className="galleries-page">
        <header className="galleries-header">
          <Link className="brand-lockup" href="/">
            <span className="brand-mark">s.</span>
            <span className="brand-name">SANAA</span>
          </Link>
          <nav className="galleries-nav">
            <Link href="/">Workspace</Link>
            <Link href="/login" className="galleries-signin">Sign in</Link>
          </nav>
        </header>

        {galleriesContent}
      </main>
    );
  }

  return (
    <main className="app-shell">
      <Sidebar user={user} active="galleries" exhibitionCount={ownExhibitionCount} />

      <section className="dashboard-main">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-slash">/</span><strong>Galleries</strong></div>
          <div className="topbar-actions">
            <ThemeToggle />
            {/* Phase 8: the Search / Notifications / Help buttons were
                dead — no handler, no backend — so they were removed.
                The working exhibition search is on the dashboard. */}
          </div>
        </header>

        <div className="dashboard-content">{galleriesContent}</div>
      </section>
    </main>
  );
}
