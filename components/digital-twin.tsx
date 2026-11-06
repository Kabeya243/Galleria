"use client";

import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, useTexture } from "@react-three/drei";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import styles from "./tools.module.css";

// ---------------------------------------------------------------------------
// Digital Twin + VR/AR
// Three parts, one SavedWork kind ("digital-twin"):
//  1. Twin builder — a measured model of a physical room (dimensions,
//     finishes, doors/windows, artwork positions), 3D view + top-down plan,
//     planned-vs-measured comparison in centimetres, installation order.
//  2. VR exhibition — WebXR immersive-vr when the device supports it, with
//     thumbstick movement, teleport on select, artwork info panels and a
//     guided tour; otherwise a clear "not supported" state and the standard
//     walkthrough as the preview (never labelled VR).
//  3. AR preview — WebXR immersive-ar hit-test when supported, otherwise a
//     photo-based preview: upload a photo of your wall, drag/resize the
//     framed artwork on it, export the composite as PNG.
// ---------------------------------------------------------------------------

export type TwinArtwork = {
  id: string;
  exhibitionId: string;
  exhibitionTitle: string;
  title: string;
  artist: string;
  year: string;
  medium: string;
  dimensions: string;
  description: string;
  color: string;
  imageUrl: string | null;
  frame: string;
};

type WallId = "back" | "left" | "right" | "front";
const WALLS: { id: WallId; label: string }[] = [
  { id: "back", label: "Back wall" },
  { id: "left", label: "Left wall" },
  { id: "right", label: "Right wall" },
  { id: "front", label: "Front wall (entrance)" },
];

type Opening = {
  id: string;
  kind: "door" | "window";
  wall: WallId;
  /** Distance in metres from the left end of the wall, facing the wall. */
  offset: number;
  width: number;
  height: number;
  /** Sill height for windows (0 for doors). */
  sill: number;
};

type Placement = {
  id: string;
  artworkId: string;
  wall: WallId;
  /** Planned offset along the wall (m) and hanging height to centre (m). */
  plannedOffset: number;
  plannedHeight: number;
  /** Measured offset along the wall (m) and hanging height to centre (m). */
  offset: number;
  height: number;
};

type TwinData = {
  title: string;
  roomName: string;
  length: number;
  width: number;
  height: number;
  plannedLength: number;
  plannedWidth: number;
  plannedHeight: number;
  wallColor: string;
  wallMaterial: string;
  floorMaterial: string;
  floorColor: string;
  ceilingColor: string;
  openings: Opening[];
  placements: Placement[];
};

type SavedTwin = {
  id: string;
  title: string;
  data: { twin?: TwinData };
  createdAt: string;
  updatedAt: string;
};

const FLOOR_COLORS: Record<string, string> = {
  "polished concrete": "#b9b4a8",
  "wood parquet": "#a97e4f",
  "white painted wood": "#e8e2d4",
  "terrazzo": "#cfc8ba",
  "dark stone": "#4a4640",
};

const WALL_MATERIALS = ["plaster", "brick", "concrete", "wood panelling"];
const FLOOR_MATERIALS = Object.keys(FLOOR_COLORS);
const FRAME_STYLES = ["none", "natural wood", "black", "white", "gold"] as const;
type FrameStyle = (typeof FRAME_STYLES)[number];
const FRAME_COLORS: Record<FrameStyle, string> = {
  none: "#000000",
  "natural wood": "#8a6a42",
  black: "#1c1c1c",
  white: "#f2efe8",
  gold: "#ffffff",
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function num(value: string, fallback: number) {
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

/** Parse "120×89 cm" / "120 x 89" into metres { w, h }. Returns null when unparseable. */
function parseDimensions(dimensions: string): { w: number; h: number } | null {
  const match = dimensions.match(/([\d.,]+)\s*[×x]\s*([\d.,]+)/);
  if (!match) return null;
  const w = Number.parseFloat(match[1].replace(",", "."));
  const h = Number.parseFloat(match[2].replace(",", "."));
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) return null;
  // Dimensions are stored in cm unless they are already small (<= 10 means metres).
  const scale = w > 10 || h > 10 ? 0.01 : 1;
  return { w: w * scale, h: h * scale };
}

function artworkSize(artwork: TwinArtwork): { w: number; h: number } {
  return parseDimensions(artwork.dimensions) ?? { w: 0.9, h: 1.2 };
}

function defaultTwin(): TwinData {
  return {
    title: "Untitled twin",
    roomName: "Main gallery room",
    length: 8,
    width: 6,
    height: 3.4,
    plannedLength: 8,
    plannedWidth: 6,
    plannedHeight: 3.4,
    wallColor: "#f4f1ea",
    wallMaterial: "plaster",
    floorMaterial: "polished concrete",
    floorColor: FLOOR_COLORS["polished concrete"],
    ceilingColor: "#faf9f5",
    openings: [
      { id: uid(), kind: "door", wall: "front", offset: 3, width: 1, height: 2.2, sill: 0 },
      { id: uid(), kind: "window", wall: "left", offset: 3, width: 1.8, height: 1.6, sill: 0.9 },
    ],
    placements: [],
  };
}

function wallLength(twin: TwinData, wall: WallId) {
  return wall === "back" || wall === "front" ? twin.length : twin.width;
}

/** Position of a point on a wall (offset along the wall, height) in 3D room space. */
function wallPoint(twin: TwinData, wall: WallId, offset: number, height: number): [number, number, number] {
  const L = twin.length / 2;
  const W = twin.width / 2;
  switch (wall) {
    case "back":
      return [-L + offset, height, -W];
    case "front":
      return [L - offset, height, W];
    case "left":
      return [-L, height, -W + offset];
    case "right":
      return [L, height, W - offset];
  }
}

function wallRotation(wall: WallId): [number, number, number] {
  switch (wall) {
    case "back":
      return [0, 0, 0];
    case "front":
      return [0, Math.PI, 0];
    case "left":
      return [0, Math.PI / 2, 0];
    case "right":
      return [0, -Math.PI / 2, 0];
  }
}

// --- 3D twin rendering -----------------------------------------------------

function ArtworkPlane({ artwork, width, height, position, rotation }: {
  artwork: TwinArtwork;
  width: number;
  height: number;
  position: [number, number, number];
  rotation: [number, number, number];
}) {
  const texture = artwork.imageUrl ? useTexture(artwork.imageUrl) : null;
  return (
    <group position={position} rotation={rotation}>
      {/* Frame: a slightly larger dark slab behind the image. */}
      <mesh position={[0, 0, -0.015]}>
        <boxGeometry args={[width + 0.08, height + 0.08, 0.03]} />
        <meshStandardMaterial color="#2b2620" />
      </mesh>
      <mesh position={[0, 0, 0.005]}>
        <planeGeometry args={[width, height]} />
        {texture ? (
          <meshStandardMaterial map={texture} />
        ) : (
          <meshStandardMaterial color={artwork.color || "#b8a184"} />
        )}
      </mesh>
    </group>
  );
}

function TwinScene({ twin, artworks, selectedId, onSelect }: {
  twin: TwinData;
  artworks: TwinArtwork[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
}) {
  const L = twin.length;
  const W = twin.width;
  const H = twin.height;
  const t = 0.12; // wall thickness
  const byId = useMemo(() => new Map(artworks.map((a) => [a.id, a])), [artworks]);

  return (
    <>
      <ambientLight intensity={1.1} />
      <directionalLight position={[L, H + 2, W]} intensity={1.4} />
      <pointLight position={[0, H - 0.4, 0]} intensity={12} color="#fff2df" />
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[L, W]} />
        <meshStandardMaterial color={twin.floorColor} roughness={0.85} />
      </mesh>
      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, H, 0]}>
        <planeGeometry args={[L, W]} />
        <meshStandardMaterial color={twin.ceilingColor} />
      </mesh>
      {/* Walls: back/front span length, left/right span width. */}
      <mesh position={[0, H / 2, -W / 2]}>
        <boxGeometry args={[L + t, H, t]} />
        <meshStandardMaterial color={twin.wallColor} roughness={0.95} />
      </mesh>
      <mesh position={[0, H / 2, W / 2]}>
        <boxGeometry args={[L + t, H, t]} />
        <meshStandardMaterial color={twin.wallColor} roughness={0.95} />
      </mesh>
      <mesh position={[-L / 2, H / 2, 0]}>
        <boxGeometry args={[t, H, W]} />
        <meshStandardMaterial color={twin.wallColor} roughness={0.95} />
      </mesh>
      <mesh position={[L / 2, H / 2, 0]}>
        <boxGeometry args={[t, H, W]} />
        <meshStandardMaterial color={twin.wallColor} roughness={0.95} />
      </mesh>
      {/* Openings: inset panels on the inner wall face. */}
      {twin.openings.map((opening) => {
        const [x, , z] = wallPoint(twin, opening.wall, opening.offset + opening.width / 2, 0);
        const y = opening.sill + opening.height / 2;
        const inward = opening.wall === "back" ? 0.07 : opening.wall === "front" ? -0.07 : opening.wall === "left" ? 0.07 : -0.07;
        const px = opening.wall === "left" || opening.wall === "right" ? x + inward : x;
        const pz = opening.wall === "back" || opening.wall === "front" ? z + inward : z;
        return (
          <mesh
            key={opening.id}
            position={[px, y, pz]}
            rotation={wallRotation(opening.wall)}
          >
            <planeGeometry args={[opening.width, opening.height]} />
            <meshStandardMaterial
              color={opening.kind === "door" ? "#6b4f2e" : "#9db8c4"}
              roughness={0.4}
              metalness={opening.kind === "window" ? 0.2 : 0}
            />
          </mesh>
        );
      })}
      {/* Placed artworks, nudged 4 cm off the wall face. */}
      {twin.placements.map((placement) => {
        const artwork = byId.get(placement.artworkId);
        if (!artwork) return null;
        const size = artworkSize(artwork);
        const [x, y, z] = wallPoint(twin, placement.wall, placement.offset, placement.height);
        const nudge: [number, number, number] =
          placement.wall === "back" ? [0, 0, 0.04]
          : placement.wall === "front" ? [0, 0, -0.04]
          : placement.wall === "left" ? [0.04, 0, 0]
          : [-0.04, 0, 0];
        const selected = selectedId === artwork.id;
        return (
          <group
            key={placement.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelect?.(artwork.id);
            }}
          >
            <ArtworkPlane
              artwork={artwork}
              width={size.w}
              height={size.h}
              position={[x + nudge[0], y + nudge[1], z + nudge[2]]}
              rotation={wallRotation(placement.wall)}
            />
            {selected && (
              <mesh
                position={[x + nudge[0] * 2, y, z + nudge[2] * 2]}
                rotation={wallRotation(placement.wall)}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect?.(artwork.id);
                }}
              >
                <planeGeometry args={[size.w + 0.2, size.h + 0.2]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.25} side={THREE.DoubleSide} />
              </mesh>
            )}
          </group>
        );
      })}
      <OrbitControls makeDefault target={[0, 1.5, 0]} maxPolarAngle={Math.PI / 2.05} />
    </>
  );
}

// --- Top-down plan view (SVG) ----------------------------------------------

function PlanView({ twin, artworks }: { twin: TwinData; artworks: TwinArtwork[] }) {
  const scale = 46; // px per metre
  const pad = 34;
  const wPx = twin.length * scale + pad * 2;
  const hPx = twin.width * scale + pad * 2;
  const byId = useMemo(() => new Map(artworks.map((a) => [a.id, a])), [artworks]);
  const toX = (x: number) => pad + x * scale;
  const toY = (z: number) => pad + z * scale;

  // A point on a wall in plan coordinates (x along length, y along width).
  const wallPlanPoint = (wall: WallId, offset: number): [number, number] => {
    switch (wall) {
      case "back": return [offset, 0];
      case "front": return [twin.length - offset, twin.width];
      case "left": return [0, offset];
      case "right": return [twin.length, twin.width - offset];
    }
  };

  return (
    <svg
      viewBox={`0 0 ${wPx} ${hPx}`}
      style={{ width: "100%", height: "auto", background: "#fff", border: "1px solid var(--border)", borderRadius: 6 }}
      role="img"
      aria-label={`Top-down plan of ${twin.roomName}, ${twin.length} by ${twin.width} metres`}
    >
      {/* Room outline */}
      <rect x={pad} y={pad} width={twin.length * scale} height={twin.width * scale} fill="#fdfdfc" stroke="#141414" strokeWidth={2} />
      {/* Dimension labels */}
      <text x={pad + (twin.length * scale) / 2} y={pad - 10} textAnchor="middle" fontSize={11} fill="#141414">
        {twin.length.toFixed(2)} m
      </text>
      <text x={pad - 8} y={pad + (twin.width * scale) / 2} textAnchor="end" fontSize={11} fill="#141414" transform={`rotate(-90 ${pad - 8} ${pad + (twin.width * scale) / 2})`}>
        {twin.width.toFixed(2)} m
      </text>
      <text x={pad + 6} y={pad + 14} fontSize={10} fill="#ffffff">BACK</text>
      <text x={pad + 6} y={pad + twin.width * scale - 6} fontSize={10} fill="#ffffff">FRONT</text>
      {/* Openings as coloured wall segments */}
      {twin.openings.map((opening) => {
        const [ox, oy] = wallPlanPoint(opening.wall, opening.offset);
        const horizontal = opening.wall === "back" || opening.wall === "front";
        return (
          <rect
            key={opening.id}
            x={toX(ox) - (horizontal ? 0 : 3)}
            y={toY(oy) - (horizontal ? 3 : 0)}
            width={horizontal ? opening.width * scale : 6}
            height={horizontal ? 6 : opening.width * scale}
            fill={opening.kind === "door" ? "#6b4f2e" : "#7fa8b8"}
          />
        );
      })}
      {/* Artwork positions: gold ticks + labels */}
      {twin.placements.map((placement) => {
        const artwork = byId.get(placement.artworkId);
        if (!artwork) return null;
        const size = artworkSize(artwork);
        const [ox, oy] = wallPlanPoint(placement.wall, placement.offset);
        const horizontal = placement.wall === "back" || placement.wall === "front";
        const cx = toX(ox);
        const cy = toY(oy);
        return (
          <g key={placement.id}>
            <rect
              x={cx - (horizontal ? (size.w * scale) / 2 : 4)}
              y={cy - (horizontal ? 4 : (size.w * scale) / 2)}
              width={horizontal ? size.w * scale : 8}
              height={horizontal ? 8 : size.w * scale}
              fill="#ffffff"
              stroke="#141414"
              strokeWidth={0.5}
            />
            <text x={cx + (horizontal ? 0 : 10)} y={cy + (horizontal ? -8 : 4)} textAnchor={horizontal ? "middle" : "start"} fontSize={10} fill="#141414">
              {artwork.title} · {size.w.toFixed(2)}×{size.h.toFixed(2)} m @ {placement.height.toFixed(2)} m
            </text>
          </g>
        );
      })}
      {/* North / scale note */}
      <text x={pad} y={hPx - 8} fontSize={10} fill="#6b675f">
        Plan — 1 square ≈ 1 m · doors brown, windows blue, artworks gold
      </text>
    </svg>
  );
}

// --- Main component ---------------------------------------------------------

type XrSupport = {
  vr: "unknown" | "supported" | "unsupported" | "error";
  ar: "unknown" | "supported" | "unsupported" | "error";
};

const TABS = [
  { id: "twin", label: "Digital Twin Builder" },
  { id: "vr", label: "VR Exhibition" },
  { id: "ar", label: "AR Artwork Preview" },
] as const;
type TabId = (typeof TABS)[number]["id"];

export default function DigitalTwin({ artworks }: { artworks: TwinArtwork[] }) {
  const [tab, setTab] = useState<TabId>("twin");
  const [twin, setTwin] = useState<TwinData>(defaultTwin);
  const [selectedArtworkId, setSelectedArtworkId] = useState("");
  const [selectedWall, setSelectedWall] = useState<WallId>("back");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState<SavedTwin[]>([]);
  const [savedLoading, setSavedLoading] = useState(false);
  const [savedError, setSavedError] = useState<string | null>(null);

  // VR state
  const [xr, setXr] = useState<XrSupport>({ vr: "unknown", ar: "unknown" });
  const [vrExhibitionId, setVrExhibitionId] = useState("");
  const [vrStatus, setVrStatus] = useState<string | null>(null);
  const [vrInSession, setVrInSession] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const [tourIndex, setTourIndex] = useState(0);
  const [vrSelectedId, setVrSelectedId] = useState<string | null>(null);
  const glRef = useRef<THREE.WebGLRenderer | null>(null);
  const vrSessionRef = useRef<XRSession | null>(null);

  // AR state
  const [arStatus, setArStatus] = useState<string | null>(null);
  const [arInSession, setArInSession] = useState(false);
  const [arArtworkId, setArArtworkId] = useState(artworks[0]?.id ?? "");
  const [arFrame, setArFrame] = useState<FrameStyle>("natural wood");
  const [arScale, setArScale] = useState(1);

  // Photo-fallback state
  const [wallPhoto, setWallPhoto] = useState<string | null>(null);
  const [wallPhotoName, setWallPhotoName] = useState("");
  const [overlay, setOverlay] = useState({ x: 0.3, y: 0.25, w: 0.4 }); // fractions of the photo
  const photoImgRef = useRef<HTMLImageElement | null>(null);
  const artImgRef = useRef<HTMLImageElement | null>(null);
  const dragRef = useRef<{ mode: "move" | "resize"; startX: number; startY: number; start: typeof overlay } | null>(null);
  const photoBoxRef = useRef<HTMLDivElement | null>(null);

  const exhibitions = useMemo(() => {
    const map = new Map<string, { id: string; title: string; works: TwinArtwork[] }>();
    for (const art of artworks) {
      const entry = map.get(art.exhibitionId) ?? { id: art.exhibitionId, title: art.exhibitionTitle, works: [] };
      entry.works.push(art);
      map.set(art.exhibitionId, entry);
    }
    return [...map.values()];
  }, [artworks]);

  const vrExhibition = exhibitions.find((e) => e.id === vrExhibitionId) ?? exhibitions[0];
  const vrWorks = vrExhibition?.works ?? [];
  const vrTourWork = vrWorks[tourIndex % Math.max(1, vrWorks.length)];

  const updateTwin = useCallback((patch: Partial<TwinData>) => {
    setTwin((current) => ({ ...current, ...patch }));
  }, []);

  // --- Saved twins ---------------------------------------------------------
  const loadSaved = useCallback(async () => {
    setSavedLoading(true);
    setSavedError(null);
    try {
      const response = await fetch("/api/saved-work?kind=digital-twin");
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in to view your saved twins." : "Could not load your saved twins.");
      const result = (await response.json()) as { saved: SavedTwin[] };
      setSaved(result.saved ?? []);
    } catch (error) {
      setSavedError(error instanceof Error ? error.message : "Could not load your saved twins.");
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  // --- XR capability checks (up front, honest about what is missing) -------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (typeof navigator === "undefined" || !("xr" in navigator) || !navigator.xr) {
        if (!cancelled) setXr({ vr: "unsupported", ar: "unsupported" });
        return;
      }
      try {
        const [vr, ar] = await Promise.all([
          navigator.xr.isSessionSupported("immersive-vr").catch(() => false),
          navigator.xr.isSessionSupported("immersive-ar").catch(() => false),
        ]);
        if (!cancelled) setXr({ vr: vr ? "supported" : "unsupported", ar: ar ? "supported" : "unsupported" });
      } catch {
        if (!cancelled) setXr({ vr: "error", ar: "error" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Guided tour auto-advance.
  useEffect(() => {
    if (!tourActive || vrWorks.length === 0) return;
    const timer = window.setInterval(() => {
      setTourIndex((i) => (i + 1) % vrWorks.length);
    }, 9000);
    return () => window.clearInterval(timer);
  }, [tourActive, vrWorks.length]);

  // --- Twin editing ----------------------------------------------------------
  function addOpening(kind: "door" | "window") {
    const wallLen = wallLength(twin, "back");
    updateTwin({
      openings: [
        ...twin.openings,
        {
          id: uid(),
          kind,
          wall: "back",
          offset: Math.max(0, wallLen / 2 - 0.5),
          width: kind === "door" ? 0.9 : 1.5,
          height: kind === "door" ? 2.1 : 1.4,
          sill: kind === "door" ? 0 : 0.9,
        },
      ],
    });
  }

  function updateOpening(id: string, patch: Partial<Opening>) {
    updateTwin({ openings: twin.openings.map((o) => (o.id === id ? { ...o, ...patch } : o)) });
  }

  function removeOpening(id: string) {
    updateTwin({ openings: twin.openings.filter((o) => o.id !== id) });
  }

  function addPlacement() {
    const artwork = artworks.find((a) => a.id === selectedArtworkId) ?? artworks[0];
    if (!artwork) return;
    const size = artworkSize(artwork);
    const wallLen = wallLength(twin, selectedWall);
    const placement: Placement = {
      id: uid(),
      artworkId: artwork.id,
      wall: selectedWall,
      plannedOffset: Math.max(size.w / 2, wallLen / 2),
      plannedHeight: 1.6,
      offset: Math.max(size.w / 2, wallLen / 2),
      height: 1.6,
    };
    updateTwin({ placements: [...twin.placements, placement] });
    setMessage(`Added “${artwork.title}” to the ${selectedWall} wall. Set its planned and measured positions below.`);
  }

  function updatePlacement(id: string, patch: Partial<Placement>) {
    updateTwin({ placements: twin.placements.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
  }

  function removePlacement(id: string) {
    updateTwin({ placements: twin.placements.filter((p) => p.id !== id) });
  }

  // --- Comparison ------------------------------------------------------------
  const comparison = useMemo(() => {
    const rows: { label: string; planned: number; measured: number }[] = [
      { label: "Room length", planned: twin.plannedLength, measured: twin.length },
      { label: "Room width", planned: twin.plannedWidth, measured: twin.width },
      { label: "Ceiling height", planned: twin.plannedHeight, measured: twin.height },
    ];
    for (const placement of twin.placements) {
      const artwork = artworks.find((a) => a.id === placement.artworkId);
      rows.push(
        { label: `${artwork?.title ?? "Artwork"} — offset on ${placement.wall} wall`, planned: placement.plannedOffset, measured: placement.offset },
        { label: `${artwork?.title ?? "Artwork"} — hanging height (centre)`, planned: placement.plannedHeight, measured: placement.height },
      );
    }
    return rows.map((row) => ({ ...row, diffCm: Math.round((row.measured - row.planned) * 100) }));
  }, [twin, artworks]);

  const mismatches = comparison.filter((row) => Math.abs(row.diffCm) > 2);

  // --- Installation order ------------------------------------------------------
  const installSteps = useMemo(() => {
    const wallOrder: WallId[] = ["back", "left", "right", "front"];
    const steps: string[] = [];
    steps.push(`1. Mark the room: verify the tape — ${twin.length.toFixed(2)} × ${twin.width.toFixed(2)} m, ceiling ${twin.height.toFixed(2)} m.`);
    steps.push("2. Hang the largest work first, then work outward — large pieces set the sightlines.");
    let n = 3;
    for (const wall of wallOrder) {
      const onWall = twin.placements
        .filter((p) => p.wall === wall)
        .sort((a, b) => a.offset - b.offset);
      if (onWall.length === 0) continue;
      steps.push(`${n}. ${WALLS.find((w) => w.id === wall)?.label}:`);
      n += 1;
      onWall.forEach((placement, i) => {
        const artwork = artworks.find((a) => a.id === placement.artworkId);
        const size = artwork ? artworkSize(artwork) : { w: 0, h: 0 };
        const prev = onWall[i - 1];
        const gap =
          prev && artwork
            ? ` — ${Math.round((placement.offset - size.w / 2 - (prev.offset + artworkSize(artworks.find((a) => a.id === prev.artworkId) ?? artwork).w / 2)) * 100)} cm from the previous work`
            : "";
        steps.push(
          `   • ${artwork?.title ?? "Artwork"} (${size.w.toFixed(2)} × ${size.h.toFixed(2)} m): centre ${placement.height.toFixed(2)} m high, ${placement.offset.toFixed(2)} m from the wall's left end${gap}.`,
        );
      });
    }
    steps.push(`${n}. Step back to the entrance, check sightlines and spacing at eye level (centre ≈ 1.45–1.60 m), then level every work.`);
    return steps;
  }, [twin, artworks]);

  // --- Save / load -------------------------------------------------------------
  async function saveTwin() {
    const title = twin.title.trim() || twin.roomName || "Untitled twin";
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/saved-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "digital-twin", title, data: { twin } }),
      });
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in to save a twin." : "Could not save this twin.");
      setMessage(`Saved “${title}”.`);
      await loadSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this twin.");
    } finally {
      setBusy(false);
    }
  }

  function loadTwin(item: SavedTwin) {
    if (!item.data.twin) return;
    setTwin(item.data.twin);
    setTab("twin");
    setMessage(`Loaded “${item.title}”.`);
  }

  async function deleteTwin(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/saved-work?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete this twin.");
      await loadSaved();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete this twin.");
    } finally {
      setBusy(false);
    }
  }

  // --- VR ----------------------------------------------------------------------
  async function enterVR() {
    const gl = glRef.current;
    if (!navigator.xr) {
      setVrStatus("WebXR is not available in this browser, so a VR session cannot start here.");
      return;
    }
    if (!gl) {
      setVrStatus("The 3D view is still loading — wait a moment and try again.");
      return;
    }
    setVrStatus("Requesting a VR session…");
    try {
      const session = await navigator.xr.requestSession("immersive-vr", {
        optionalFeatures: ["local-floor", "bounded-floor"],
      });
      vrSessionRef.current = session;
      gl.xr.enabled = true;
      await gl.xr.setSession(session);
      setVrInSession(true);
      setVrStatus("You are in VR. Use the thumbstick to walk, point at the floor and press select to teleport, and press select on a work to see its panel.");
      session.addEventListener("end", () => {
        setVrInSession(false);
        vrSessionRef.current = null;
        setVrStatus("VR session ended. The walkthrough below is still available as a preview.");
      });
    } catch (error) {
      setVrStatus(
        error instanceof Error
          ? `VR session could not start: ${error.message}`
          : "VR session could not start on this device.",
      );
    }
  }

  async function exitVR() {
    try {
      await vrSessionRef.current?.end();
    } catch {
      setVrInSession(false);
    }
  }

  // --- AR ----------------------------------------------------------------------
  // A real immersive-ar session: a dedicated WebGL renderer draws a reticle
  // at the hit-test pose, and tapping (select) anchors the selected artwork
  // — at its real dimensions, in the chosen frame — to that wall point.
  const arCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const arRendererRef = useRef<THREE.WebGLRenderer | null>(null);

  async function startAR() {
    const canvas = arCanvasRef.current;
    if (!navigator.xr) {
      setArStatus("WebXR is not available in this browser, so AR cannot start here. Use the photo preview below instead.");
      return;
    }
    if (!canvas) {
      setArStatus("The AR view is still loading — wait a moment and try again.");
      return;
    }
    if (!arArtwork) {
      setArStatus("Choose an artwork first.");
      return;
    }
    setArStatus("Requesting an AR session with hit-test…");
    try {
      const session = await navigator.xr.requestSession("immersive-ar", {
        requiredFeatures: ["hit-test"],
        optionalFeatures: ["local-floor", "dom-overlay"],
        domOverlay: { root: document.body },
      });
      const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
      renderer.xr.enabled = true;
      arRendererRef.current = renderer;
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(70, 1, 0.01, 50);
      scene.add(new THREE.HemisphereLight(0xffffff, 0x888888, 1.2));

      // Reticle: a small ring shown where the hit-test finds a surface.
      const reticle = new THREE.Mesh(
        new THREE.RingGeometry(0.08, 0.1, 32),
        new THREE.MeshBasicMaterial({ color: 0xa67c37, side: THREE.DoubleSide }),
      );
      reticle.visible = false;
      scene.add(reticle);

      // The artwork: image on a plane, frame as a slightly larger slab behind.
      const artGroup = new THREE.Group();
      artGroup.visible = false;
      const artW = arArtSize.w * arScale;
      const artH = arArtSize.h * arScale;
      const frameDepth = 0.04;
      if (arFrame !== "none") {
        const frame = new THREE.Mesh(
          new THREE.BoxGeometry(artW + 0.08, artH + 0.08, frameDepth),
          new THREE.MeshStandardMaterial({ color: FRAME_COLORS[arFrame] }),
        );
        frame.position.z = -frameDepth / 2;
        artGroup.add(frame);
      }
      const artMesh = new THREE.Mesh(
        new THREE.PlaneGeometry(artW, artH),
        new THREE.MeshStandardMaterial({ color: arArtwork.color || "#b8a184" }),
      );
      artMesh.position.z = 0.005;
      artGroup.add(artMesh);
      if (arArtwork.imageUrl) {
        new THREE.TextureLoader().load(arArtwork.imageUrl, (texture) => {
          texture.colorSpace = THREE.SRGBColorSpace;
          (artMesh.material as THREE.MeshStandardMaterial).map = texture;
          (artMesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
        });
      }
      scene.add(artGroup);

      const viewerSpace = await session.requestReferenceSpace("viewer");
      if (typeof session.requestHitTestSource !== "function") {
        throw new Error("This device's AR session does not offer hit-test.");
      }
      const hitSource = await session.requestHitTestSource({ space: viewerSpace });
      if (!hitSource) {
        throw new Error("This device's AR session could not create a hit-test source.");
      }
      let latestHit: XRPose | null = null;

      const onSelect = () => {
        if (latestHit) {
          artGroup.position.copy(latestHit.transform.position);
          artGroup.quaternion.copy(latestHit.transform.orientation);
          artGroup.visible = true;
        }
      };
      session.addEventListener("select", onSelect);
      session.addEventListener("end", () => {
        setArInSession(false);
        arRendererRef.current = null;
        renderer.setAnimationLoop(null);
        renderer.dispose();
        setArStatus("AR session ended. The photo preview below is still available.");
      });

      await renderer.xr.setSession(session);
      renderer.setAnimationLoop((time, frame) => {
        if (!frame) return;
        const hits = frame.getHitTestResults(hitSource);
        if (hits.length > 0) {
          const pose = hits[0].getPose(viewerSpace);
          if (pose) {
            latestHit = pose;
            reticle.visible = true;
            reticle.position.copy(pose.transform.position);
            reticle.quaternion.copy(pose.transform.orientation);
          } else {
            latestHit = null;
            reticle.visible = false;
          }
        } else {
          latestHit = null;
          reticle.visible = false;
        }
        renderer.render(scene, camera);
      });
      setArInSession(true);
      setArStatus(
        "AR session started. Point your phone at a wall until the gold ring appears, then tap the screen to hang the artwork there at its real size. End the session from your phone's system UI.",
      );
    } catch (error) {
      setArStatus(
        error instanceof Error
          ? `AR could not start: ${error.message} — hit-test may be unsupported on this device. Use the photo preview below instead.`
          : "AR could not start on this device. Use the photo preview below instead.",
      );
    }
  }

  // --- Photo fallback ------------------------------------------------------------
  function handleWallPhoto(file: File | undefined) {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      photoImgRef.current = img;
      setWallPhoto(url);
      setWallPhotoName(file.name);
      setMessage(`Loaded “${file.name}” — drag the artwork to position it, use the corner handle to resize.`);
    };
    img.onerror = () => setMessage("That photo could not be read. Try a JPG or PNG.");
    img.src = url;
  }

  const arArtwork = artworks.find((a) => a.id === arArtworkId) ?? artworks[0];
  const arArtSize = arArtwork ? artworkSize(arArtwork) : { w: 0.9, h: 1.2 };

  useEffect(() => {
    if (!arArtwork?.imageUrl) {
      artImgRef.current = null;
      return;
    }
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      artImgRef.current = img;
    };
    img.onerror = () => {
      artImgRef.current = null;
    };
    img.src = arArtwork.imageUrl;
  }, [arArtwork?.imageUrl]);

  function onOverlayPointerDown(e: React.PointerEvent, mode: "move" | "resize") {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, start: overlay };
  }

  function onOverlayPointerMove(e: React.PointerEvent) {
    const drag = dragRef.current;
    const box = photoBoxRef.current;
    if (!drag || !box) return;
    const rect = box.getBoundingClientRect();
    const dx = (e.clientX - drag.startX) / rect.width;
    const dy = (e.clientY - drag.startY) / rect.height;
    if (drag.mode === "move") {
      setOverlay((current) => ({
        ...current,
        x: Math.min(0.95 - current.w, Math.max(0, drag.start.x + dx)),
        y: Math.min(0.95, Math.max(0, drag.start.y + dy)),
      }));
    } else {
      const aspect = arArtSize.h / arArtSize.w;
      const nextW = Math.min(0.95, Math.max(0.08, drag.start.w + dx));
      setOverlay((current) => ({ ...current, w: nextW, x: Math.min(current.x, 0.95 - nextW), y: current.y }));
      void aspect;
    }
  }

  function onOverlayPointerUp() {
    dragRef.current = null;
  }

  function exportPhotoComposite() {
    const wall = photoImgRef.current;
    if (!wall || !wallPhoto) {
      setMessage("Upload a photo of your wall first.");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = wall.naturalWidth;
    canvas.height = wall.naturalHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setMessage("This browser could not create the export canvas.");
      return;
    }
    ctx.drawImage(wall, 0, 0);
    const frameW = overlay.w * canvas.width;
    const frameH = (frameW * arArtSize.h) / arArtSize.w;
    const x = overlay.x * canvas.width;
    const y = overlay.y * canvas.height;
    const framePx = Math.max(4, frameW * 0.04);
    // Frame
    if (arFrame !== "none") {
      ctx.fillStyle = FRAME_COLORS[arFrame];
      ctx.fillRect(x - framePx, y - framePx, frameW + framePx * 2, frameH + framePx * 2);
    }
    // Artwork image, or a coloured placeholder with the title when the image
    // cannot be drawn (e.g. a cross-origin image without CORS).
    const art = artImgRef.current;
    if (art) {
      try {
        ctx.drawImage(art, x, y, frameW, frameH);
      } catch {
        ctx.fillStyle = arArtwork?.color ?? "#b8a184";
        ctx.fillRect(x, y, frameW, frameH);
      }
    } else {
      ctx.fillStyle = arArtwork?.color ?? "#b8a184";
      ctx.fillRect(x, y, frameW, frameH);
      ctx.fillStyle = "#ffffff";
      ctx.font = `${Math.max(14, frameW * 0.05)}px sans-serif`;
      ctx.fillText(arArtwork?.title ?? "Artwork", x + frameW * 0.05, y + frameH / 2);
    }
    canvas.toBlob((blob) => {
      if (!blob) {
        setMessage("The export could not be created.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `${(arArtwork?.title ?? "artwork").replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-wall-preview.png`;
      link.click();
      URL.revokeObjectURL(url);
      setMessage("Exported the wall preview as PNG.");
    }, "image/png");
  }

  // --- Unreal Engine / Twinmotion export -----------------------------------
  // A JSON manifest of the measured twin: the bridge for rebuilding this
  // exact room in Twinmotion or Unreal Engine. This is NOT a Datasmith
  // (.udatasmith) or FBX file and NOT a live link to Unreal — SANAA
  // produces no Unreal file format. The manifest carries the numbers so the
  // room can be rebuilt 1:1 in Twinmotion/Unreal, by hand or by a Datasmith
  // workflow. All dimensions are metres; origin is the centre of the floor,
  // +X along the room length, +Z along the room width, +Y up.
  function exportUnrealManifest() {
    const slug = (twin.title || "twin").replace(/[^a-z0-9]+/gi, "-").toLowerCase();
    const manifest = {
      format: "sanaa-digital-twin",
      version: 1,
      units: "metres",
      exportedAt: new Date().toISOString(),
      twin: { title: twin.title, roomName: twin.roomName },
      room: {
        lengthMetres: twin.length,
        widthMetres: twin.width,
        heightMetres: twin.height,
        plannedLengthMetres: twin.plannedLength,
        plannedWidthMetres: twin.plannedWidth,
        plannedHeightMetres: twin.plannedHeight,
      },
      materials: {
        wall: { material: twin.wallMaterial, color: twin.wallColor },
        floor: { material: twin.floorMaterial, color: twin.floorColor },
        ceiling: { color: twin.ceilingColor },
      },
      openings: twin.openings.map((opening) => ({
        kind: opening.kind,
        wall: opening.wall,
        offsetAlongWallMetres: opening.offset,
        widthMetres: opening.width,
        heightMetres: opening.height,
        sillHeightMetres: opening.sill,
        position3d: wallPoint(twin, opening.wall, opening.offset, opening.sill + opening.height / 2),
      })),
      artworks: twin.placements.map((placement) => {
        const art = artworks.find((item) => item.id === placement.artworkId);
        const size = art ? parseDimensions(art.dimensions) : null;
        return {
          title: art?.title ?? "Unknown artwork",
          artist: art?.artist ?? "",
          year: art?.year ?? "",
          medium: art?.medium ?? "",
          dimensions: art?.dimensions ?? "",
          widthMetres: size?.w ?? null,
          heightMetres: size?.h ?? null,
          frame: art?.frame ?? "",
          wall: placement.wall,
          offsetAlongWallMetres: placement.offset,
          hangingHeightToCentreMetres: placement.height,
          plannedOffsetAlongWallMetres: placement.plannedOffset,
          plannedHangingHeightToCentreMetres: placement.plannedHeight,
          position3d: wallPoint(twin, placement.wall, placement.offset, placement.height),
          imageUrl: art?.imageUrl ?? null,
        };
      }),
      notes: [
        "This is a JSON manifest, NOT a Datasmith (.udatasmith) or FBX file. Rebuild the room in Twinmotion or Unreal Engine from these dimensions and place each artwork as an image plane at the listed wall, offset and hanging height.",
        "Artwork image files are referenced by URL where available; they are not embedded in this file — supply the image files to Twinmotion / Unreal Engine separately.",
        "Requires Twinmotion or Unreal Engine installed and an Epic Games account. This export is a one-way bridge, not a live link to Unreal.",
      ],
    };
    const blob = new Blob([JSON.stringify(manifest, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${slug}-unreal-twinmotion-manifest.json`;
    link.click();
    URL.revokeObjectURL(url);
    setMessage("Exported the Unreal / Twinmotion manifest as JSON. It is a data bridge for rebuilding this room — not a Datasmith file and not a live link to Unreal.");
  }

// --- VR movement rig ----------------------------------------------------------
// Runs inside the VR Canvas: while a session is presenting, the thumbstick
// (gamepad axes) walks the camera on the floor plane, and pressing the
// primary button teleports the viewer to the floor point 2 m ahead.
function VrRig({ enabled }: { enabled: boolean }) {
  const { gl, camera } = useThree();
  const buttonWasPressed = useRef(false);
  const tmp = useMemo(() => new THREE.Vector3(), []);

  useFrame(() => {
    if (!enabled || !gl.xr.isPresenting) return;
    const session = gl.xr.getSession();
    if (!session) return;
    const speed = 1.6;
    for (const source of session.inputSources) {
      const gamepad = source.gamepad;
      if (!gamepad) continue;
      const axes = gamepad.axes;
      if (axes.length >= 4) {
        const forward = -(axes[3] ?? 0);
        const strafe = axes[2] ?? 0;
        if (Math.abs(forward) > 0.08 || Math.abs(strafe) > 0.08) {
          camera.getWorldDirection(tmp);
          tmp.y = 0;
          tmp.normalize();
          const right = new THREE.Vector3().crossVectors(tmp, new THREE.Vector3(0, 1, 0)).negate();
          camera.position.addScaledVector(tmp, forward * speed * 0.016);
          camera.position.addScaledVector(right, strafe * speed * 0.016);
          camera.position.y = 1.6;
        }
      }
      const pressed = gamepad.buttons[0]?.pressed ?? false;
      if (pressed && !buttonWasPressed.current) {
        // Teleport: 2 m ahead on the floor, at eye height.
        camera.getWorldDirection(tmp);
        tmp.y = 0;
        tmp.normalize();
        camera.position.addScaledVector(tmp, 2);
        camera.position.y = 1.6;
      }
      buttonWasPressed.current = pressed;
    }
  });
  return null;
}

function VrCameraTour({ target, active }: { target: [number, number, number] | null; active: boolean }) {
  const { camera } = useThree();
  const controls = useThree((state) => state.controls) as unknown as { target?: THREE.Vector3; update?: () => void } | null;
  useEffect(() => {
    if (!active || !target) return;
    camera.position.set(target[0], 1.6, target[2] + 2.2);
    if (controls?.target) {
      controls.target.set(target[0], target[1], target[2]);
      controls.update?.();
    }
  }, [target, active, camera, controls]);
  return null;
}

// --- Render ---------------------------------------------------------------------
  // VR room: the twin's measured room, with the chosen exhibition's works
  // hung in a row on the back wall at eye level.
  const vrTwin: TwinData = useMemo(() => {
    const placements: Placement[] = vrWorks.map((work, i) => {
      const size = artworkSize(work);
      const gap = 0.6;
      const total = vrWorks.reduce((sum, w) => sum + artworkSize(w).w + gap, -gap);
      let offset = twin.length / 2 - total / 2 + size.w / 2;
      for (let j = 0; j < i; j += 1) offset += artworkSize(vrWorks[j]).w + gap;
      return {
        id: `vr-${work.id}`,
        artworkId: work.id,
        wall: "back",
        plannedOffset: offset,
        plannedHeight: 1.6,
        offset,
        height: 1.6,
      };
    });
    return { ...twin, title: vrExhibition?.title ?? "VR exhibition", openings: [], placements };
  }, [twin, vrWorks, vrExhibition]);

  const tourTarget: [number, number, number] | null = useMemo(() => {
    if (!vrTourWork) return null;
    const placement = vrTwin.placements.find((p) => p.artworkId === vrTourWork.id);
    if (!placement) return null;
    return wallPoint(vrTwin, placement.wall, placement.offset, placement.height);
  }, [vrTourWork, vrTwin]);

  const fieldStyle: React.CSSProperties = { display: "flex", flexDirection: "column", gap: 4, fontSize: 12 };
  const inputStyle: React.CSSProperties = {
    padding: "8px 10px", border: "1px solid var(--border)", borderRadius: 5, background: "#fff", fontSize: 13, width: "100%",
  };
  const cardStyle: React.CSSProperties = {
    background: "#fff", border: "1px solid var(--border)", borderRadius: 8, padding: 16, marginBottom: 16,
  };
  const grid2: React.CSSProperties = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 };

  return (
    <div>
      {/* Tabs */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }} role="tablist" aria-label="Digital Twin sections">
        {TABS.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={tab === t.id ? "primary-button" : "editor-secondary-button"}
            style={tab === t.id ? undefined : { height: 34, padding: "0 14px", fontSize: 11 }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {message && (
        <p role="status" style={{ margin: "0 0 12px", color: "var(--ink)", fontSize: 12, lineHeight: 1.6 }}>
          {message}
        </p>
      )}

      {tab === "twin" && (
        <div>
          {/* Room measurements */}
          <section style={cardStyle} aria-label="Room measurements">
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 18, margin: "0 0 4px" }}>1 · Measure the room</h2>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.6 }}>
              Enter the tape-measure values of the physical room. “Planned” is what the floor plan or the gallery said;
              “measured” is what you found on site — the comparison below flags any difference over 2 cm.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 12 }}>
              <label style={fieldStyle}>Twin name
                <input style={inputStyle} value={twin.title} onChange={(e) => updateTwin({ title: e.target.value })} />
              </label>
              <label style={fieldStyle}>Room name
                <input style={inputStyle} value={twin.roomName} onChange={(e) => updateTwin({ roomName: e.target.value })} />
              </label>
              <label style={fieldStyle}>Length — measured (m)
                <input style={inputStyle} type="number" step={0.01} min={0.5} value={twin.length} onChange={(e) => updateTwin({ length: num(e.target.value, twin.length) })} />
              </label>
              <label style={fieldStyle}>Length — planned (m)
                <input style={inputStyle} type="number" step={0.01} min={0.5} value={twin.plannedLength} onChange={(e) => updateTwin({ plannedLength: num(e.target.value, twin.plannedLength) })} />
              </label>
              <label style={fieldStyle}>Width — measured (m)
                <input style={inputStyle} type="number" step={0.01} min={0.5} value={twin.width} onChange={(e) => updateTwin({ width: num(e.target.value, twin.width) })} />
              </label>
              <label style={fieldStyle}>Width — planned (m)
                <input style={inputStyle} type="number" step={0.01} min={0.5} value={twin.plannedWidth} onChange={(e) => updateTwin({ plannedWidth: num(e.target.value, twin.plannedWidth) })} />
              </label>
              <label style={fieldStyle}>Ceiling height — measured (m)
                <input style={inputStyle} type="number" step={0.01} min={1.5} value={twin.height} onChange={(e) => updateTwin({ height: num(e.target.value, twin.height) })} />
              </label>
              <label style={fieldStyle}>Ceiling height — planned (m)
                <input style={inputStyle} type="number" step={0.01} min={1.5} value={twin.plannedHeight} onChange={(e) => updateTwin({ plannedHeight: num(e.target.value, twin.plannedHeight) })} />
              </label>
              <label style={fieldStyle}>Wall colour
                <input style={inputStyle} type="color" value={twin.wallColor} onChange={(e) => updateTwin({ wallColor: e.target.value })} />
              </label>
              <label style={fieldStyle}>Wall material
                <select style={inputStyle} value={twin.wallMaterial} onChange={(e) => updateTwin({ wallMaterial: e.target.value })}>
                  {WALL_MATERIALS.map((m) => (<option key={m} value={m}>{m}</option>))}
                </select>
              </label>
              <label style={fieldStyle}>Floor material
                <select
                  style={inputStyle}
                  value={twin.floorMaterial}
                  onChange={(e) => updateTwin({ floorMaterial: e.target.value, floorColor: FLOOR_COLORS[e.target.value] ?? twin.floorColor })}
                >
                  {FLOOR_MATERIALS.map((m) => (<option key={m} value={m}>{m}</option>))}
                </select>
              </label>
              <label style={fieldStyle}>Ceiling colour
                <input style={inputStyle} type="color" value={twin.ceilingColor} onChange={(e) => updateTwin({ ceilingColor: e.target.value })} />
              </label>
            </div>
          </section>

          {/* Openings */}
          <section style={cardStyle} aria-label="Doors and windows">
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 18, margin: "0 0 4px" }}>2 · Doors &amp; windows</h2>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.6 }}>
              Offset is measured from the left end of the wall as you face it from inside the room.
            </p>
            {twin.openings.length === 0 && <p style={{ fontSize: 12 }}>No doors or windows recorded yet.</p>}
            {twin.openings.map((opening) => (
              <div key={opening.id} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
                <label style={fieldStyle}>Type
                  <select style={inputStyle} value={opening.kind} onChange={(e) => updateOpening(opening.id, { kind: e.target.value as "door" | "window" })}>
                    <option value="door">Door</option>
                    <option value="window">Window</option>
                  </select>
                </label>
                <label style={fieldStyle}>Wall
                  <select style={inputStyle} value={opening.wall} onChange={(e) => updateOpening(opening.id, { wall: e.target.value as WallId })}>
                    {WALLS.map((w) => (<option key={w.id} value={w.id}>{w.label}</option>))}
                  </select>
                </label>
                <label style={fieldStyle}>Offset (m)
                  <input style={inputStyle} type="number" step={0.01} min={0} value={opening.offset} onChange={(e) => updateOpening(opening.id, { offset: num(e.target.value, opening.offset) })} />
                </label>
                <label style={fieldStyle}>Width (m)
                  <input style={inputStyle} type="number" step={0.01} min={0.1} value={opening.width} onChange={(e) => updateOpening(opening.id, { width: num(e.target.value, opening.width) })} />
                </label>
                <label style={fieldStyle}>Height (m)
                  <input style={inputStyle} type="number" step={0.01} min={0.1} value={opening.height} onChange={(e) => updateOpening(opening.id, { height: num(e.target.value, opening.height) })} />
                </label>
                <label style={fieldStyle}>Sill height (m)
                  <input style={inputStyle} type="number" step={0.01} min={0} value={opening.sill} onChange={(e) => updateOpening(opening.id, { sill: num(e.target.value, opening.sill) })} />
                </label>
                <div style={{ display: "flex", alignItems: "end" }}>
                  <button className="editor-secondary-button" onClick={() => removeOpening(opening.id)}>Remove</button>
                </div>
              </div>
            ))}
            <div style={{ display: "flex", gap: 8 }}>
              <button className="editor-secondary-button" onClick={() => addOpening("door")}>+ Add door</button>
              <button className="editor-secondary-button" onClick={() => addOpening("window")}>+ Add window</button>
            </div>
          </section>

          {/* Artwork placements */}
          <section style={cardStyle} aria-label="Artwork positions">
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 18, margin: "0 0 4px" }}>3 · Where each work hangs</h2>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.6 }}>
              Works come from your own artworks, with their real dimensions. Offset is along the wall from its left end;
              height is to the centre of the work. Planned values are the hang plan; measured values are what the tape says after hanging.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "end" }}>
              <label style={{ ...fieldStyle, minWidth: 220 }}>Artwork
                <select style={inputStyle} value={selectedArtworkId || artworks[0]?.id} onChange={(e) => setSelectedArtworkId(e.target.value)}>
                  {artworks.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} — {a.dimensions || "dimensions unknown"} ({a.exhibitionTitle})
                    </option>
                  ))}
                </select>
              </label>
              <label style={fieldStyle}>Wall
                <select style={inputStyle} value={selectedWall} onChange={(e) => setSelectedWall(e.target.value as WallId)}>
                  {WALLS.map((w) => (<option key={w.id} value={w.id}>{w.label}</option>))}
                </select>
              </label>
              <button className="primary-button" onClick={addPlacement}>Add to wall</button>
            </div>
            {twin.placements.length === 0 && <p style={{ fontSize: 12 }}>No works placed yet — add your first work above.</p>}
            {twin.placements.map((placement) => {
              const artwork = artworks.find((a) => a.id === placement.artworkId);
              const size = artwork ? artworkSize(artwork) : { w: 0, h: 0 };
              const maxOffset = wallLength(twin, placement.wall);
              return (
                <div key={placement.id} style={{ marginBottom: 10, paddingBottom: 10, borderBottom: "1px solid var(--border)" }}>
                  <strong style={{ fontSize: 13 }}>
                    {artwork?.title ?? "Artwork"} · {size.w.toFixed(2)} × {size.h.toFixed(2)} m · {WALLS.find((w) => w.id === placement.wall)?.label}
                  </strong>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 10, marginTop: 8 }}>
                    <label style={fieldStyle}>Offset — planned (m)
                      <input style={inputStyle} type="number" step={0.01} min={0} max={maxOffset} value={placement.plannedOffset} onChange={(e) => updatePlacement(placement.id, { plannedOffset: num(e.target.value, placement.plannedOffset) })} />
                    </label>
                    <label style={fieldStyle}>Offset — measured (m)
                      <input style={inputStyle} type="number" step={0.01} min={0} max={maxOffset} value={placement.offset} onChange={(e) => updatePlacement(placement.id, { offset: num(e.target.value, placement.offset) })} />
                    </label>
                    <label style={fieldStyle}>Height — planned (m)
                      <input style={inputStyle} type="number" step={0.01} min={0} max={twin.height} value={placement.plannedHeight} onChange={(e) => updatePlacement(placement.id, { plannedHeight: num(e.target.value, placement.plannedHeight) })} />
                    </label>
                    <label style={fieldStyle}>Height — measured (m)
                      <input style={inputStyle} type="number" step={0.01} min={0} max={twin.height} value={placement.height} onChange={(e) => updatePlacement(placement.id, { height: num(e.target.value, placement.height) })} />
                    </label>
                    <div style={{ display: "flex", alignItems: "end" }}>
                      <button className="editor-secondary-button" onClick={() => removePlacement(placement.id)}>Remove</button>
                    </div>
                  </div>
                </div>
              );
            })}
          </section>

          {/* Views */}
          <section style={cardStyle} aria-label="Twin views">
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 18, margin: "0 0 12px" }}>4 · The twin — 3D view &amp; plan</h2>
            <div style={grid2}>
              <div>
                <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 6px" }}>3D VIEW — drag to orbit, scroll to zoom</p>
                <div style={{ height: 360, border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", background: "#efebe1" }}>
                  <Canvas camera={{ position: [twin.length * 0.9, twin.height + 1.2, twin.width * 1.1], fov: 45 }} dpr={[1, 2]}>
                    <Suspense fallback={null}>
                      <TwinScene twin={twin} artworks={artworks} />
                    </Suspense>
                  </Canvas>
                </div>
              </div>
              <div>
                <p style={{ fontSize: 11, color: "var(--muted)", margin: "0 0 6px" }}>TOP-DOWN PLAN</p>
                <PlanView twin={twin} artworks={artworks} />
              </div>
            </div>
          </section>

          {/* Comparison */}
          <section style={cardStyle} aria-label="Planned versus measured">
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 18, margin: "0 0 4px" }}>5 · Planned vs measured</h2>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.6 }}>
              {mismatches.length === 0
                ? "Everything matches the plan within 2 cm."
                : `${mismatches.length} value${mismatches.length > 1 ? "s differ" : " differs"} from the plan by more than 2 cm — highlighted below.`}
            </p>
            <div className={styles.tableScroll}>
              <table className={styles.inventoryTable}>
              <thead>
                <tr><th>Item</th><th>Planned</th><th>Measured</th><th>Difference</th></tr>
              </thead>
              <tbody>
                {comparison.map((row) => (
                  <tr key={row.label} style={Math.abs(row.diffCm) > 2 ? { background: "#fdf3e3" } : undefined}>
                    <td>{row.label}</td>
                    <td>{row.planned.toFixed(2)} m</td>
                    <td>{row.measured.toFixed(2)} m</td>
                    <td style={{ fontWeight: Math.abs(row.diffCm) > 2 ? 700 : 400, color: Math.abs(row.diffCm) > 2 ? "#8a5a12" : "inherit" }}>
                      {row.diffCm === 0 ? "—" : `${row.diffCm > 0 ? "+" : ""}${row.diffCm} cm`}
                    </td>
                  </tr>
                ))}
              </tbody>
              </table>
            </div>
          </section>

          {/* Installation order */}
          <section style={cardStyle} aria-label="Installation order">
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 18, margin: "0 0 12px" }}>6 · Installation order</h2>
            {twin.placements.length === 0 ? (
              <p style={{ fontSize: 12 }}>Add works to the walls above and the hang order will be generated here.</p>
            ) : (
              <ol style={{ fontSize: 13, lineHeight: 1.9, margin: 0, paddingLeft: 18 }}>
                {installSteps.map((step, i) => (
                  <li key={i} style={{ whiteSpace: "pre-wrap" }}>{step}</li>
                ))}
              </ol>
            )}
          </section>

          {/* Save + saved list */}
          <section style={cardStyle} aria-label="Save this twin">
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 18, margin: "0 0 12px" }}>Save this twin</h2>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="primary-button" onClick={() => void saveTwin()} disabled={busy}>
                {busy ? "Saving…" : "Save twin"}
              </button>
              <button className="editor-secondary-button" onClick={() => { setTwin(defaultTwin()); setMessage("Started a new empty twin."); }}>
                New empty twin
              </button>
            </div>
            <h3 style={{ fontSize: 13, margin: "18px 0 8px" }}>Saved twins</h3>
            {savedLoading && <p style={{ fontSize: 12 }}>Loading saved twins…</p>}
            {savedError && <p style={{ fontSize: 12, color: "#8a2f2f" }}>{savedError}</p>}
            {!savedLoading && saved.length === 0 && !savedError && <p style={{ fontSize: 12 }}>No saved twins yet.</p>}
            <ul style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {saved.map((item) => (
                <li key={item.id} style={{ display: "flex", gap: 8, alignItems: "center", padding: "8px 0", borderBottom: "1px solid var(--border)", fontSize: 13, flexWrap: "wrap" }}>
                  <strong style={{ flex: 1, minWidth: 160 }}>{item.title}</strong>
                  <span style={{ color: "var(--muted)", fontSize: 11 }}>
                    {new Date(item.updatedAt).toLocaleDateString()}
                  </span>
                  <button className="editor-secondary-button" onClick={() => loadTwin(item)}>Load</button>
                  <button className="editor-secondary-button" onClick={() => void deleteTwin(item.id)} disabled={busy}>Delete</button>
                </li>
              ))}
            </ul>
          </section>

          {/* Unreal Engine / Twinmotion export — JSON manifest bridge */}
          <section style={cardStyle} aria-label="Export for Unreal Engine and Twinmotion">
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 18, margin: "0 0 4px" }}>7 · Export for Unreal Engine / Twinmotion</h2>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.6 }}>
              Download this twin as a JSON manifest — room dimensions, wall / floor / ceiling materials and colours,
              door and window positions, and every artwork placement with its real dimensions, frame and hanging
              height — so the room can be rebuilt 1:1 in Twinmotion or Unreal Engine.
            </p>
            <p style={{ fontSize: 12, lineHeight: 1.6, background: "#fdf3e3", border: "1px solid #e8d5ae", borderRadius: 6, padding: 10 }}>
              <strong>An export bridge, not a live link.</strong> This downloads a JSON manifest — it does <em>not</em>{" "}
              produce a Datasmith (.udatasmith) or FBX file, and there is no one-click Datasmith import. In Twinmotion
              or Unreal Engine, rebuild the room to these exact dimensions and place each artwork as an image plane at
              the listed wall, offset and hanging height. That needs Twinmotion or Unreal Engine installed, with an Epic
              Games account. Artwork images are referenced by URL in the manifest, not embedded — supply the image files
              separately.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button className="primary-button" onClick={exportUnrealManifest}>
                Download Unreal / Twinmotion manifest (JSON)
              </button>
            </div>
            <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8, lineHeight: 1.6 }}>
              Included: room length × width × height (measured and planned), wall material and colour, floor material
              and colour, ceiling colour, every door and window (wall, offset, size, sill height, 3D position), and
              every placed artwork (title, artist, year, medium, dimensions in metres, frame, wall, offset along the
              wall, hanging height to centre, 3D position). All dimensions are in metres.
            </p>
          </section>

          {/* Unreal Engine — Pixel Streaming: PAID, not part of the free stack */}
          <section style={cardStyle} aria-label="Unreal Engine Pixel Streaming — paid, not part of the free stack">
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 18, margin: "0 0 4px" }}>8 · Unreal Engine — Pixel Streaming</h2>
            <p style={{ fontSize: 12, lineHeight: 1.6, background: "#fbe9e7", border: "1px solid #d98a7a", borderRadius: 6, padding: 10 }}>
              <strong>PAID — not part of the free stack.</strong> Pixel Streaming is NOT the path SANAA uses. It
              requires a paid GPU cloud server running while visitors watch — an ongoing cost, not a free tool. Nothing
              on this page streams Unreal, and no stream URL is wired in. This section exists only as a labelled
              integration point, for completeness.
            </p>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.6 }}>
              Unreal Engine does <strong>not</strong> run natively in a browser the way Three.js does. Pixel Streaming
              is how Unreal quality reaches a browser anyway: the packaged Unreal application runs on a remote GPU
              server and streams its rendered frames to the visitor&apos;s browser as video over WebRTC, with input
              travelling back. The visitor needs only a modern browser — but somebody pays for the GPU server the whole
              time the stream is up.
            </p>
            <h3 style={{ fontSize: 13, margin: "0 0 6px" }}>What Pixel Streaming really requires (paid)</h3>
            <ul style={{ fontSize: 12, lineHeight: 1.8, margin: "0 0 12px", paddingLeft: 18 }}>
              <li>An Epic Games developer account, and the gallery built as an Unreal Engine project with the Pixel Streaming plugin enabled and packaged.</li>
              <li>A GPU cloud server to run it on — for example an AWS, Azure or GCP GPU instance (Epic publishes an official Pixel Streaming solution in the Azure Marketplace). The server runs while visitors are watching, so this is an <strong>ongoing cost</strong>, priced by the cloud provider — no price is stated here because it depends on the instance, region and hours used.</li>
              <li>A signalling server (the plugin ships a Node.js one) plus STUN / TURN servers so the stream can reach visitors behind home routers — see Epic&apos;s Pixel Streaming documentation at dev.epicgames.com.</li>
              <li>At scale, a matchmaker / load balancer so several visitors each get their own running instance — one stream is one running Unreal app.</li>
            </ul>
            <h3 style={{ fontSize: 13, margin: "0 0 6px" }}>The primary path — free, offline, no streaming</h3>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.6 }}>
              This is the path SANAA actually uses, and it needs no server at all: scan real spaces and objects with
              RealityCapture / RealityScan (free under $1M annual revenue), dress the scene with Fab&apos;s free assets,
              build the exact room from the JSON manifest above (section 7), and produce photorealistic renders and
              models in Twinmotion / Unreal Engine <strong>offline</strong> — then feed those renders and .glb models
              back into this web platform, which already shows them in Three.js. Streaming is only ever a later step,
              if the gallery must be interactive in the browser at Unreal quality <em>and</em> the GPU server cost is
              budgeted. If that day comes: build in Unreal from the manifest, enable the Pixel Streaming plugin,
              package, deploy to a GPU server with the signalling server, and only then wire the stream URL in here.
            </p>
            <p style={{ fontSize: 11, color: "var(--muted)", margin: 0, lineHeight: 1.6 }}>
              Reference: Epic&apos;s official Pixel Streaming deployment in Azure —{" "}
              <a href="https://learn.microsoft.com/de-de/gaming/azure/reference-architectures/unreal-pixel-streaming-in-azure" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
                Unreal Pixel Streaming in Azure ↗
              </a>{" "}
              (Epic&apos;s own Pixel Streaming documentation lives at dev.epicgames.com).
            </p>
          </section>
        </div>
      )}

      {tab === "vr" && (
        <div>
          <section style={cardStyle} aria-label="VR exhibition">
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 18, margin: "0 0 4px" }}>VR exhibition</h2>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.6 }}>
              Walk the measured room in a headset. The check below runs on this device and browser — on most desktops
              and phones WebXR is unavailable, and the walkthrough underneath is the honest fallback: the same room,
              the same works, on a flat screen. It is a preview, not VR.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end", marginBottom: 12 }}>
              <label style={{ ...fieldStyle, minWidth: 240 }}>Exhibition
                <select style={inputStyle} value={vrExhibition?.id ?? ""} onChange={(e) => { setVrExhibitionId(e.target.value); setTourIndex(0); setVrSelectedId(null); }}>
                  {exhibitions.map((e) => (
                    <option key={e.id} value={e.id}>{e.title} ({e.works.length} works)</option>
                  ))}
                </select>
              </label>
              {xr.vr === "supported" && !vrInSession && (
                <button className="primary-button" onClick={() => void enterVR()}>Enter VR</button>
              )}
              {xr.vr === "supported" && vrInSession && (
                <button className="primary-button" onClick={() => void exitVR()}>Exit VR</button>
              )}
              {xr.vr === "unsupported" && (
                <button className="primary-button" disabled title="WebXR immersive-vr is not available on this device or browser">
                  VR not supported on this device/browser
                </button>
              )}
              {xr.vr === "unknown" && (
                <button className="primary-button" disabled>Checking VR support…</button>
              )}
            </div>
            {xr.vr === "unsupported" && (
              <p style={{ fontSize: 12, background: "#fdf3e3", border: "1px solid #e8d5ae", borderRadius: 6, padding: 10, lineHeight: 1.6 }}>
                <strong>VR not supported on this device/browser.</strong> This browser reports no WebXR
                immersive-vr session — the usual case on desktop and on phones without a headset. Use the walkthrough
                below as the preview instead: drag to look around, scroll to move closer, click a work to read its panel.
                To try real VR, open this page in a WebXR browser on a headset (e.g. Meta Quest browser) or a phone with
                a Cardboard-style viewer and a WebXR-capable browser.
              </p>
            )}
            {vrStatus && (
              <p role="status" style={{ fontSize: 12, lineHeight: 1.6 }}>{vrStatus}</p>
            )}
            {vrWorks.length === 0 ? (
              <p style={{ fontSize: 12 }}>This exhibition has no artworks.</p>
            ) : (
              <>
                <div style={{ height: 420, border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", background: "#efebe1" }}>
                  <Canvas
                    camera={{ position: [0, 1.6, vrTwin.width / 2 - 0.6], fov: 70 }}
                    dpr={[1, 2]}
                    onCreated={({ gl }) => {
                      glRef.current = gl;
                    }}
                  >
                    <Suspense fallback={null}>
                      <TwinScene twin={vrTwin} artworks={vrWorks} selectedId={vrSelectedId} onSelect={setVrSelectedId} />
                    </Suspense>
                    <VrRig enabled={vrInSession} />
                    <VrCameraTour target={tourActive ? tourTarget : null} active={tourActive} />
                  </Canvas>
                </div>
                <p style={{ fontSize: 11, color: "var(--muted)", margin: "8px 0 0" }}>
                  Walkthrough preview — drag to look around. In a live VR session: thumbstick walks, the primary
                  button teleports you 2 m forward, and selecting a work opens its panel.
                </p>
              </>
            )}
          </section>

          {/* Guided tour */}
          <section style={cardStyle} aria-label="Guided tour">
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 18, margin: "0 0 4px" }}>Guided tour</h2>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.6 }}>
              The tour advances to the next work every 9 seconds and reads its narration. In the walkthrough the camera
              moves to each work; in VR the narration and highlight follow you.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
              <button
                className="primary-button"
                disabled={vrWorks.length === 0}
                onClick={() => {
                  setTourActive((a) => !a);
                  if (!tourActive) setTourIndex(0);
                }}
              >
                {tourActive ? "Stop tour" : "Start guided tour"}
              </button>
              {tourActive && (
                <>
                  <button className="editor-secondary-button" onClick={() => setTourIndex((i) => (i - 1 + vrWorks.length) % vrWorks.length)}>← Previous</button>
                  <button className="editor-secondary-button" onClick={() => setTourIndex((i) => (i + 1) % vrWorks.length)}>Next →</button>
                </>
              )}
            </div>
            {tourActive && vrTourWork && (
              <div style={{ border: "1px solid #ffffff", borderRadius: 6, padding: 14, background: "#0d0d0d" }}>
                <p style={{ fontSize: 11, color: "#ffffff", margin: "0 0 4px" }}>
                  STOP {tourIndex + 1} OF {vrWorks.length}
                </p>
                <h3 style={{ fontFamily: "Fraunces, serif", fontSize: 17, margin: "0 0 6px" }}>
                  {vrTourWork.title} <span style={{ fontSize: 12, color: "var(--muted)" }}>— {vrTourWork.artist} {vrTourWork.year ? `(${vrTourWork.year})` : ""}</span>
                </h3>
                <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>
                  {vrTourWork.description ||
                    `${vrTourWork.title} is a ${vrTourWork.medium || "work"} by ${vrTourWork.artist || "the artist"}, measuring ${vrTourWork.dimensions || "unrecorded dimensions"}. Take a moment with it before the tour moves on.`}
                </p>
              </div>
            )}
            {!tourActive && (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {vrWorks.map((work) => (
                  <button
                    key={work.id}
                    className="editor-secondary-button"
                    onClick={() => {
                      setVrSelectedId(work.id);
                      setTourIndex(vrWorks.findIndex((w) => w.id === work.id));
                    }}
                  >
                    {work.title}
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* Info panel for the selected work */}
          {vrSelectedId && (() => {
            const work = vrWorks.find((w) => w.id === vrSelectedId);
            if (!work) return null;
            const size = artworkSize(work);
            return (
              <section style={cardStyle} aria-label="Artwork information">
                <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 18, margin: "0 0 6px" }}>{work.title}</h2>
                <p style={{ fontSize: 13, lineHeight: 1.7, margin: "0 0 6px" }}>
                  {work.artist} {work.year ? `· ${work.year}` : ""} · {work.medium} · {size.w.toFixed(2)} × {size.h.toFixed(2)} m
                  {work.dimensions ? ` (${work.dimensions})` : ""}
                </p>
                {work.description && <p style={{ fontSize: 13, lineHeight: 1.7, margin: 0 }}>{work.description}</p>}
                <button className="editor-secondary-button" style={{ marginTop: 10 }} onClick={() => setVrSelectedId(null)}>Close panel</button>
              </section>
            );
          })()}
        </div>
      )}

      {tab === "ar" && (
        <div>
          <section style={cardStyle} aria-label="AR artwork preview">
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 18, margin: "0 0 4px" }}>AR artwork preview</h2>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 14px", lineHeight: 1.6 }}>
              Place a work on a real wall at its real size. On a phone with WebXR AR and hit-test this runs as a live
              AR session; on any other device the photo preview below does the same job on a picture of your wall.
            </p>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "end", marginBottom: 12 }}>
              <label style={{ ...fieldStyle, minWidth: 240 }}>Artwork
                <select style={inputStyle} value={arArtworkId} onChange={(e) => setArArtworkId(e.target.value)}>
                  {artworks.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.title} — {a.dimensions || "dimensions unknown"}
                    </option>
                  ))}
                </select>
              </label>
              <label style={fieldStyle}>Frame
                <select style={inputStyle} value={arFrame} onChange={(e) => setArFrame(e.target.value as FrameStyle)}>
                  {FRAME_STYLES.map((f) => (<option key={f} value={f}>{f}</option>))}
                </select>
              </label>
              <label style={{ ...fieldStyle, minWidth: 140 }}>Scale
                <input style={inputStyle} type="number" step={0.1} min={0.5} max={2} value={arScale} onChange={(e) => setArScale(num(e.target.value, arScale))} />
              </label>
              {xr.ar === "supported" && !arInSession && (
                <button className="primary-button" onClick={() => void startAR()}>Start AR (hit-test)</button>
              )}
              {xr.ar === "supported" && arInSession && (
                <button className="primary-button" disabled>AR session running…</button>
              )}
              {xr.ar === "unsupported" && (
                <button className="primary-button" disabled title="WebXR immersive-ar with hit-test is not available on this device or browser">
                  AR not supported on this device/browser
                </button>
              )}
              {xr.ar === "unknown" && (
                <button className="primary-button" disabled>Checking AR support…</button>
              )}
            </div>
            {arArtwork && (
              <p style={{ fontSize: 12, margin: "0 0 12px" }}>
                Previewing <strong>{arArtwork.title}</strong> at {(arArtSize.w * arScale).toFixed(2)} × {(arArtSize.h * arScale).toFixed(2)} m
                {arFrame !== "none" ? `, ${arFrame} frame` : ", unframed"}.
              </p>
            )}
            {xr.ar === "unsupported" && (
              <p style={{ fontSize: 12, background: "#fdf3e3", border: "1px solid #e8d5ae", borderRadius: 6, padding: 10, lineHeight: 1.6 }}>
                <strong>AR not supported on this device/browser.</strong> This browser reports no WebXR immersive-ar
                session with hit-test — the usual case on desktop. The photo preview below is the fallback and works
                everywhere: upload a photo of your wall, drag the framed work into place, resize it, and export the
                composite as a PNG.
              </p>
            )}
            {arStatus && (
              <p role="status" style={{ fontSize: 12, lineHeight: 1.6 }}>{arStatus}</p>
            )}
            {/* The AR session renders into this canvas when a session is live. */}
            <canvas
              ref={arCanvasRef}
              style={{
                width: "100%", height: arInSession ? 420 : 0, display: arInSession ? "block" : "none",
                background: "#000", borderRadius: 6,
              }}
              aria-label="AR view"
            />
            {!arInSession && xr.ar === "supported" && (
              <p style={{ fontSize: 12, lineHeight: 1.6 }}>
                AR is available on this device. Press “Start AR (hit-test)”, point at a wall until the gold ring appears,
                then tap to hang the work.
              </p>
            )}
          </section>

          {/* Photo fallback — genuinely works everywhere */}
          <section style={cardStyle} aria-label="Photo wall preview">
            <h2 style={{ fontFamily: "Fraunces, serif", fontSize: 18, margin: "0 0 4px" }}>Photo preview — no AR needed</h2>
            <p style={{ fontSize: 12, color: "var(--muted)", margin: "0 0 12px", lineHeight: 1.6 }}>
              Upload a photo of your wall. Drag the framed artwork to move it, drag its bottom-right corner to resize it,
              then export the composite as a PNG. The artwork is drawn at the same proportions as its real dimensions.
            </p>
            <label className="editor-secondary-button" style={{ display: "inline-flex", cursor: "pointer", marginBottom: 12 }}>
              Upload a photo of your wall
              <input
                type="file"
                accept="image/*"
                style={{ display: "none" }}
                onChange={(e) => handleWallPhoto(e.target.files?.[0])}
              />
            </label>
            {wallPhotoName && <span style={{ fontSize: 12, marginLeft: 10 }}>{wallPhotoName}</span>}
            {!wallPhoto && (
              <div className={styles.emptyBox}>
                <strong>No wall photo yet.</strong>
                <p>Take a straight-on photo of the wall where the work would hang, then upload it here.</p>
              </div>
            )}
            {wallPhoto && (
              <>
                <div
                  ref={photoBoxRef}
                  style={{ position: "relative", maxWidth: 900, margin: "0 auto", border: "1px solid var(--border)", borderRadius: 6, overflow: "hidden", touchAction: "none", userSelect: "none" }}
                  onPointerMove={onOverlayPointerMove}
                  onPointerUp={onOverlayPointerUp}
                  onPointerLeave={onOverlayPointerUp}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={wallPhoto} alt="Your wall" style={{ display: "block", width: "100%", height: "auto" }} draggable={false} />
                  <div
                    style={{
                      position: "absolute",
                      left: `${overlay.x * 100}%`,
                      top: `${overlay.y * 100}%`,
                      width: `${overlay.w * 100}%`,
                      aspectRatio: `${arArtSize.w} / ${arArtSize.h}`,
                      border: arFrame === "none" ? "2px solid #141414" : `${Math.max(6, overlay.w * 900 * 0.04)}px solid ${FRAME_COLORS[arFrame]}`,
                      boxSizing: "border-box",
                      background: arArtwork?.imageUrl ? `url(${arArtwork.imageUrl}) center / cover no-repeat` : arArtwork?.color ?? "#b8a184",
                      cursor: "grab",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.35)",
                      touchAction: "none",
                    }}
                    onPointerDown={(e) => onOverlayPointerDown(e, "move")}
                    role="img"
                    aria-label={`Preview of ${arArtwork?.title ?? "artwork"} on your wall — drag to move`}
                  >
                    <span
                      style={{
                        position: "absolute", right: -10, bottom: -10, width: 20, height: 20,
                        background: "#ffffff", border: "2px solid #fff", borderRadius: "50%", cursor: "nwse-resize",
                      }}
                      onPointerDown={(e) => {
                        e.stopPropagation();
                        onOverlayPointerDown(e, "resize");
                      }}
                      aria-label="Resize handle"
                    />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 12 }}>
                  <button className="primary-button" onClick={exportPhotoComposite}>Export composite as PNG</button>
                  <button
                    className="editor-secondary-button"
                    onClick={() => setOverlay({ x: 0.3, y: 0.25, w: 0.4 })}
                  >
                    Reset position
                  </button>
                </div>
                <p style={{ fontSize: 11, color: "var(--muted)", marginTop: 8 }}>
                  The export draws your photo and the framed artwork onto one PNG at the photo&apos;s full resolution.
                </p>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
