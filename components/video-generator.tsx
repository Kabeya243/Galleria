"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type MutableRefObject } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";
import { roomLayouts, type GalleryRoom } from "@/lib/rooms";
import { parseArtworkDimensions } from "@/components/gallery-scene";
import styles from "@/components/tools.module.css";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface VideoArtwork {
  id: string;
  title: string;
  artist: string;
  year: string;
  medium: string;
  dimensions: string;
  description: string;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotation: number;
  scale: number;
  imageUrl: string | null;
  roomId: string;
}

export interface VideoExhibition {
  id: string;
  title: string;
  status: string;
  rooms: GalleryRoom[];
  artworks: VideoArtwork[];
}

export type ShotType = "title" | "walk" | "closeup" | "statement";

export interface Shot {
  id: string;
  type: ShotType;
  label: string;
  /** Seconds. */
  duration: number;
  from: [number, number, number];
  to: [number, number, number];
  lookAt: [number, number, number];
  artworkId?: string;
  title?: string;
  body?: string;
}

export type VideoFormat = "9:16" | "1:1" | "16:9";

const FORMATS: { id: VideoFormat; label: string; width: number; height: number }[] = [
  { id: "9:16", label: "Vertical 9:16 — Reels / TikTok / Shorts", width: 720, height: 1280 },
  { id: "1:1", label: "Square 1:1 — Instagram feed", width: 1080, height: 1080 },
  { id: "16:9", label: "Landscape 16:9 — YouTube / website", width: 1280, height: 720 },
];

const PRESETS = [
  { id: "short", label: "Short — about 15 s", scale: 0.5 },
  { id: "standard", label: "Standard — about 30 s", scale: 1 },
  { id: "long", label: "Long — about 60 s", scale: 2 },
] as const;

interface RenderRecord {
  id: string;
  name: string;
  createdAt: string;
  sizeBytes: number;
  durationSeconds: number;
  format: VideoFormat;
  /** Blob URL — lives in this browser session only, never on the server. */
  url: string;
}

interface SavedVideoProject {
  id: string;
  title: string;
  data: { project?: VideoProjectData; renders?: Omit<RenderRecord, "url">[] };
  updatedAt: string;
}

interface VideoProjectData {
  exhibitionId: string;
  format: VideoFormat;
  preset: string;
  shots: Shot[];
}

const SHOT_TYPE_LABELS: Record<ShotType, string> = {
  title: "Title card",
  walk: "Camera walk",
  closeup: "Artwork close-up",
  statement: "Statement card",
};

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

function smoothstep(t: number): number {
  const x = Math.min(1, Math.max(0, t));
  return x * x * (3 - 2 * x);
}

function shotAt(shots: Shot[], time: number): { shot: Shot; local: number; start: number } | null {
  let cursor = 0;
  for (const shot of shots) {
    if (time < cursor + shot.duration) return { shot, local: (time - cursor) / shot.duration, start: cursor };
    cursor += shot.duration;
  }
  return shots.length ? { shot: shots[shots.length - 1], local: 1, start: cursor - shots[shots.length - 1].duration } : null;
}

// ---------------------------------------------------------------------------
// 3D room — a lightweight render of the selected exhibition's first room.
// GalleryScene itself is editor-coupled (dragging, selection, multi-room
// offsets), so the recorder renders the same room layout and artworks
// directly: same dimensions, same wall colours, same artwork positions.
// ---------------------------------------------------------------------------

function ArtworkPlane({ artwork }: { artwork: VideoArtwork }) {
  const { width, height } = useMemo(() => {
    const parsed = parseArtworkDimensions(artwork.dimensions ?? "");
    if (!parsed) return { width: 1.2, height: 1.5 };
    return { width: Math.min(4, parsed.widthCm / 100), height: Math.min(4, parsed.heightCm / 100) };
  }, [artwork.dimensions]);
  const texture = useTexture(artwork.imageUrl as string);
  texture.colorSpace = THREE.SRGBColorSpace;
  const w = width * artwork.scale;
  const h = height * artwork.scale;
  return (
    <group position={[artwork.positionX, artwork.positionY, artwork.positionZ]} rotation={[0, artwork.rotation, 0]}>
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[w + 0.12, h + 0.12, 0.05]} />
        <meshStandardMaterial color="#e8e2d4" />
      </mesh>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial map={texture} />
      </mesh>
    </group>
  );
}

function ArtworkColour({ artwork }: { artwork: VideoArtwork }) {
  const { width, height } = useMemo(() => {
    const parsed = parseArtworkDimensions(artwork.dimensions ?? "");
    if (!parsed) return { width: 1.2, height: 1.5 };
    return { width: Math.min(4, parsed.widthCm / 100), height: Math.min(4, parsed.heightCm / 100) };
  }, [artwork.dimensions]);
  const w = width * artwork.scale;
  const h = height * artwork.scale;
  return (
    <group position={[artwork.positionX, artwork.positionY, artwork.positionZ]} rotation={[0, artwork.rotation, 0]}>
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[w + 0.12, h + 0.12, 0.05]} />
        <meshStandardMaterial color="#e8e2d4" />
      </mesh>
      <mesh>
        <planeGeometry args={[w, h]} />
        <meshStandardMaterial color="#8a7a5f" />
      </mesh>
    </group>
  );
}

/** Title / statement card drawn as a texture on a plane that floats in
 *  front of the camera. It is part of the 3D scene, so the recorder
 *  captures it — a DOM overlay would not be in the video. */
function CardPlane({ title, body }: { title: string; body: string }) {
  const group = useRef<THREE.Group>(null);
  const texture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      ctx.fillStyle = "#fdfdfc";
      ctx.fillRect(0, 0, 1024, 1024);
      ctx.fillStyle = "#a67c37";
      ctx.fillRect(112, 400, 120, 3);
      ctx.fillStyle = "#141414";
      ctx.font = "600 64px Georgia, 'Times New Roman', serif";
      const words = title.split(" ");
      const lines: string[] = [];
      let line = "";
      for (const word of words) {
        const test = line ? `${line} ${word}` : word;
        if (ctx.measureText(test).width > 800 && line) {
          lines.push(line);
          line = word;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      lines.slice(0, 4).forEach((text, i) => ctx.fillText(text, 112, 500 + i * 78));
      ctx.fillStyle = "#5c5648";
      ctx.font = "28px 'DM Sans', Arial, sans-serif";
      const bodyLines: string[] = [];
      let bodyLine = "";
      for (const word of body.split(" ")) {
        const test = bodyLine ? `${bodyLine} ${word}` : word;
        if (ctx.measureText(test).width > 800 && bodyLine) {
          bodyLines.push(bodyLine);
          bodyLine = word;
        } else {
          bodyLine = test;
        }
      }
      if (bodyLine) bodyLines.push(bodyLine);
      bodyLines.slice(0, 6).forEach((text, i) => ctx.fillText(text, 112, 620 + i * 42));
    }
    const tex = new THREE.CanvasTexture(canvas);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }, [title, body]);

  const camera = useThree((state) => state.camera);
  useFrame(() => {
    const g = group.current;
    if (!g) return;
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    g.position.copy(camera.position).addScaledVector(direction, 1.6);
    g.lookAt(camera.position);
  });

  return (
    <group ref={group}>
      <mesh>
        <planeGeometry args={[1.9, 1.9]} />
        <meshBasicMaterial map={texture} transparent={false} />
      </mesh>
    </group>
  );
}

/** Drives the camera along the shot list from a shared clock ref. */
function CameraRig({ shots, clockRef }: { shots: Shot[]; clockRef: MutableRefObject<number> }) {
  const camera = useThree((state) => state.camera);
  useFrame(() => {
    const current = shotAt(shots, clockRef.current);
    if (!current) {
      camera.position.set(0, 1.6, 4);
      camera.lookAt(0, 1.6, -4);
      return;
    }
    const { shot, local } = current;
    const t = smoothstep(local);
    const from = new THREE.Vector3(...shot.from);
    const to = new THREE.Vector3(...shot.to);
    camera.position.lerpVectors(from, to, t);
    camera.lookAt(new THREE.Vector3(...shot.lookAt));
  });
  return null;
}

function RoomScene({ room, artworks, shots, clockRef }: { room: GalleryRoom; artworks: VideoArtwork[]; shots: Shot[]; clockRef: MutableRefObject<number> }) {
  const layout = roomLayouts[room.layout] ?? roomLayouts.cube;
  const width = layout.width;
  const depth = layout.depth;
  const height = layout.height;
  const active = shotAt(shots, clockRef.current);
  const cardShot = active && (active.shot.type === "title" || active.shot.type === "statement") ? active.shot : null;
  // The parent re-renders every frame while playing or recording
  // (previewTime state), so cardShot tracks the clock without extra work.

  return (
    <>
      <ambientLight intensity={0.75} />
      <directionalLight position={[0, height, 4]} intensity={1.1} />
      <pointLight position={[0, height - 0.5, 0]} intensity={30} distance={width} />
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={room.floorColor} roughness={0.9} />
      </mesh>
      {/* Ceiling */}
      <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, height, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={room.ceilingColor} roughness={1} />
      </mesh>
      {/* Back + front walls */}
      <mesh position={[0, height / 2, -depth / 2]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={room.wallColor} roughness={1} />
      </mesh>
      <mesh position={[0, height / 2, depth / 2]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[width, height]} />
        <meshStandardMaterial color={room.wallColor} roughness={1} />
      </mesh>
      {/* Side walls */}
      <mesh position={[-width / 2, height / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[depth, height]} />
        <meshStandardMaterial color={room.sideWallColor} roughness={1} />
      </mesh>
      <mesh position={[width / 2, height / 2, 0]} rotation={[0, -Math.PI / 2, 0]}>
        <planeGeometry args={[depth, height]} />
        <meshStandardMaterial color={room.sideWallColor} roughness={1} />
      </mesh>
      {artworks.map((artwork) =>
        artwork.imageUrl ? <ArtworkPlane key={artwork.id} artwork={artwork} /> : <ArtworkColour key={artwork.id} artwork={artwork} />,
      )}
      {cardShot && <CardPlane title={cardShot.title ?? ""} body={cardShot.body ?? ""} />}
      <CameraRig shots={shots} clockRef={clockRef} />
    </>
  );
}

// ---------------------------------------------------------------------------
// Shot list generation
// ---------------------------------------------------------------------------

function buildDefaultShots(exhibition: VideoExhibition): Shot[] {
  const room = exhibition.rooms[0];
  const layout = room ? (roomLayouts[room.layout] ?? roomLayouts.cube) : roomLayouts.cube;
  const depth = layout.depth;
  const shots: Shot[] = [
    {
      id: uid(),
      type: "title",
      label: "Title card",
      duration: 3,
      from: [0, 1.6, depth / 2 - 1],
      to: [0, 1.6, depth / 2 - 1.5],
      lookAt: [0, 1.6, -depth / 2],
      title: exhibition.title,
      body: "A SANAA virtual exhibition",
    },
    {
      id: uid(),
      type: "walk",
      label: "Walk through the room",
      duration: 8,
      from: [0, 1.6, depth / 2 - 1],
      to: [0, 1.6, -depth / 2 + 2],
      lookAt: [0, 1.8, -depth / 2],
    },
  ];
  for (const artwork of exhibition.artworks.slice(0, 6)) {
    const front: [number, number, number] = [artwork.positionX, artwork.positionY, artwork.positionZ + 2.6];
    const near: [number, number, number] = [artwork.positionX, artwork.positionY, artwork.positionZ + 1.2];
    shots.push({
      id: uid(),
      type: "closeup",
      label: `Close-up — ${artwork.title}`,
      duration: 4,
      from: front,
      to: near,
      lookAt: [artwork.positionX, artwork.positionY, artwork.positionZ],
      artworkId: artwork.id,
      title: artwork.title,
      body: `${artwork.artist} · ${artwork.year} · ${artwork.medium}`,
    });
  }
  shots.push({
    id: uid(),
    type: "statement",
    label: "Artist statement",
    duration: 4,
    from: [0, 1.6, 0],
    to: [0, 1.6, -0.5],
    lookAt: [0, 1.6, -depth / 2],
    title: "Artist statement",
    body: room?.curatorialText || exhibition.title,
  });
  return shots;
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function VideoGenerator({
  exhibitions,
  initialExhibitionId,
}: {
  exhibitions: VideoExhibition[];
  // Deep-link context (Art in Context step 10): open with this
  // exhibition already selected instead of the newest one.
  initialExhibitionId?: string;
}) {
  const initialExhibition =
    exhibitions.find((item) => item.id === initialExhibitionId) ?? exhibitions[0];
  const [exhibitionId, setExhibitionId] = useState(initialExhibition?.id ?? "");
  const exhibition = exhibitions.find((item) => item.id === exhibitionId) ?? exhibitions[0];
  const [format, setFormat] = useState<VideoFormat>("9:16");
  const [preset, setPreset] = useState<string>("standard");
  const [shots, setShots] = useState<Shot[]>(() => (initialExhibition ? buildDefaultShots(initialExhibition) : []));
  const [projectTitle, setProjectTitle] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Saved projects
  const [projects, setProjects] = useState<SavedVideoProject[]>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);
  const [projectsError, setProjectsError] = useState<string | null>(null);

  // Preview / recording
  const clockRef = useRef(0);
  const [previewTime, setPreviewTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [recording, setRecording] = useState(false);
  const [progress, setProgress] = useState(0);
  const [recordError, setRecordError] = useState<string | null>(null);
  const [renders, setRenders] = useState<RenderRecord[]>([]);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const rafRef = useRef<number | null>(null);
  const cancelRef = useRef(false);

  const totalDuration = useMemo(() => shots.reduce((sum, shot) => sum + shot.duration, 0), [shots]);
  const formatSpec = FORMATS.find((item) => item.id === format) ?? FORMATS[0];

  const loadProjects = useCallback(async () => {
    setProjectsLoading(true);
    setProjectsError(null);
    try {
      const response = await fetch("/api/saved-work?kind=video-project");
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in to view your video projects." : "Could not load your video projects.");
      const result = (await response.json()) as { saved: SavedVideoProject[] };
      setProjects(result.saved ?? []);
    } catch (error) {
      setProjectsError(error instanceof Error ? error.message : "Could not load your video projects.");
    } finally {
      setProjectsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadProjects();
  }, [loadProjects]);

  // Preview playback loop (no recording).
  useEffect(() => {
    if (!playing) return;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = (now - last) / 1000;
      last = now;
      clockRef.current = Math.min(totalDuration, clockRef.current + dt);
      setPreviewTime(clockRef.current);
      if (clockRef.current >= totalDuration) {
        setPlaying(false);
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [playing, totalDuration]);

  function selectExhibition(id: string) {
    const next = exhibitions.find((item) => item.id === id);
    if (!next) return;
    setExhibitionId(id);
    setShots(buildDefaultShots(next));
    clockRef.current = 0;
    setPreviewTime(0);
    setPlaying(false);
  }

  function applyPreset(presetId: string) {
    const found = PRESETS.find((item) => item.id === presetId);
    if (!found) return;
    setPreset(presetId);
    setShots((current) => current.map((shot) => ({ ...shot, duration: Math.max(1, Math.round(shot.duration * found.scale)) })));
  }

  function updateShot(id: string, patch: Partial<Shot>) {
    setShots((current) => current.map((shot) => (shot.id === id ? { ...shot, ...patch } : shot)));
  }

  function removeShot(id: string) {
    setShots((current) => current.filter((shot) => shot.id !== id));
  }

  function moveShot(id: string, direction: -1 | 1) {
    setShots((current) => {
      const index = current.findIndex((shot) => shot.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  function addShot(type: ShotType) {
    if (!exhibition) return;
    const room = exhibition.rooms[0];
    const layout = room ? (roomLayouts[room.layout] ?? roomLayouts.cube) : roomLayouts.cube;
    const depth = layout.depth;
    const base: Shot = {
      id: uid(),
      type,
      label: SHOT_TYPE_LABELS[type],
      duration: type === "walk" ? 6 : 4,
      from: [0, 1.6, depth / 2 - 1],
      to: [0, 1.6, -depth / 2 + 2],
      lookAt: [0, 1.6, -depth / 2],
    };
    if (type === "title") {
      base.title = exhibition.title;
      base.body = "A SANAA virtual exhibition";
    }
    if (type === "statement") {
      base.title = "Artist statement";
      base.body = room?.curatorialText || exhibition.title;
    }
    setShots((current) => [...current, base]);
  }

  function regenerateShots() {
    if (!exhibition) return;
    setShots(buildDefaultShots(exhibition));
    clockRef.current = 0;
    setPreviewTime(0);
  }

  async function saveProject() {
    if (!exhibition) return;
    const title = projectTitle.trim() || `${exhibition.title} — video`;
    const data: VideoProjectData = { exhibitionId: exhibition.id, format, preset, shots };
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/saved-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "video-project",
          title,
          data: { project: data, renders: renders.map(({ url: _url, ...meta }) => meta) },
        }),
      });
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in to save video projects." : "Could not save this project.");
      setMessage(`Saved “${title}”.`);
      await loadProjects();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save this project.");
    } finally {
      setBusy(false);
    }
  }

  function loadProject(project: SavedVideoProject) {
    const data = project.data.project;
    if (!data) return;
    const target = exhibitions.find((item) => item.id === data.exhibitionId);
    if (target) setExhibitionId(target.id);
    setFormat(data.format);
    setPreset(data.preset);
    setShots(data.shots);
    setProjectTitle(project.title);
    clockRef.current = 0;
    setPreviewTime(0);
    setMessage(`Loaded “${project.title}”.`);
  }

  async function deleteProject(id: string) {
    setBusy(true);
    try {
      const response = await fetch(`/api/saved-work?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete this project.");
      await loadProjects();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not delete this project.");
    } finally {
      setBusy(false);
    }
  }

  // --- Recording -----------------------------------------------------------

  function pickMimeType(): string {
    const candidates = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"];
    return candidates.find((type) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(type)) ?? "";
  }

  async function startRecording() {
    setRecordError(null);
    setMessage(null);
    if (typeof MediaRecorder === "undefined") {
      setRecordError("MediaRecorder is not available in this browser, so video capture is not possible here. Try a recent Chrome, Edge or Firefox.");
      return;
    }
    const canvas = canvasElRef.current;
    if (!canvas || typeof canvas.captureStream !== "function") {
      setRecordError("This browser cannot capture the 3D canvas as a video stream (canvas.captureStream is missing).");
      return;
    }
    if (shots.length === 0 || totalDuration <= 0) {
      setRecordError("Add at least one shot before recording.");
      return;
    }
    const mimeType = pickMimeType();
    if (!mimeType) {
      setRecordError("This browser reports no supported video recording format (WebM/MP4). Recording is not possible here.");
      return;
    }
    const stream = canvas.captureStream(30);
    const chunks: Blob[] = [];
    let recorder: MediaRecorder;
    try {
      recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
    } catch (error) {
      setRecordError(error instanceof Error ? `Could not start the recorder: ${error.message}` : "Could not start the recorder.");
      return;
    }
    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunks.push(event.data);
    };
    recorder.onstop = () => {
      setRecording(false);
      setProgress(0);
      if (cancelRef.current) {
        setMessage("Recording cancelled — nothing was saved.");
        return;
      }
      const blob = new Blob(chunks, { type: mimeType.split(";")[0] });
      if (blob.size === 0) {
        setRecordError("The recording came out empty. Nothing was saved.");
        return;
      }
      const url = URL.createObjectURL(blob);
      const record: RenderRecord = {
        id: uid(),
        name: `${exhibition?.title ?? "Exhibition"} — ${format} — ${new Date().toLocaleString()}`,
        createdAt: new Date().toISOString(),
        sizeBytes: blob.size,
        durationSeconds: Math.round(totalDuration),
        format,
        url,
      };
      setRenders((current) => [record, ...current]);
      setMessage(`Recorded ${Math.round(totalDuration)} s of video (${(blob.size / 1024 / 1024).toFixed(1)} MB). Download it below — the file lives in this browser session only.`);
    };
    recorder.onerror = () => {
      setRecording(false);
      setRecordError("The recorder failed. Nothing was saved.");
    };

    cancelRef.current = false;
    recorderRef.current = recorder;
    clockRef.current = 0;
    setPreviewTime(0);
    setProgress(0);
    setRecording(true);
    setPlaying(false);
    recorder.start(250);
    const start = performance.now();
    const tick = (now: number) => {
      const elapsed = (now - start) / 1000;
      clockRef.current = Math.min(totalDuration, elapsed);
      setPreviewTime(clockRef.current);
      setProgress(Math.min(100, (elapsed / totalDuration) * 100));
      if (cancelRef.current || elapsed >= totalDuration) {
        if (recorder.state !== "inactive") recorder.stop();
        return;
      }
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
  }

  function cancelRecording() {
    cancelRef.current = true;
    if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
  }

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (recorderRef.current && recorderRef.current.state !== "inactive") recorderRef.current.stop();
    };
  }, []);

  if (exhibitions.length === 0) {
    return (
      <div className={styles.emptyBox}>
        <strong>No exhibitions yet.</strong>
        <p>Create an exhibition in the editor first — the video generator walks a camera through your real rooms and artworks.</p>
      </div>
    );
  }
  if (!exhibition) return null;

  const room = exhibition.rooms[0];
  const activeShot = shotAt(shots, previewTime)?.shot;

  return (
    <div>
      {message && (
        <p role="status" style={{ margin: "0 0 12px", color: "var(--ink)", fontSize: "12px", lineHeight: 1.6 }}>
          {message}
        </p>
      )}

      <div className={styles.emptyBox} style={{ marginBottom: 16 }}>
        <strong>What this records — honestly.</strong>
        <p>
          This is a browser-captured walkthrough, not a server render farm: your browser plays the camera path through the 3D room in real time
          and records the canvas to a .webm file. A 30-second video takes 30 seconds to record. Files are kept in this browser session only —
          download them before you close the tab; only the project (shot list and settings) is saved server-side.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 24 }}>
        {/* ------------------------------------------------------- PREVIEW */}
        <div>
          <div
            style={{
              position: "relative",
              width: "100%",
              aspectRatio: format === "9:16" ? "9 / 16" : format === "1:1" ? "1 / 1" : "16 / 9",
              maxHeight: 560,
              margin: "0 auto",
              border: "1px solid var(--border)",
              borderRadius: 6,
              overflow: "hidden",
              background: "#111",
            }}
          >
            {room ? (
              <Canvas
                camera={{ position: [0, 1.6, 4], fov: 55 }}
                dpr={[1, 2]}
                gl={{ preserveDrawingBuffer: true }}
                onCreated={({ gl }) => {
                  canvasElRef.current = gl.domElement;
                }}
              >
                <RoomScene room={room} artworks={exhibition.artworks.filter((a) => a.roomId === room.id)} shots={shots} clockRef={clockRef} />
              </Canvas>
            ) : (
              <p style={{ color: "#fff", padding: 20 }}>This exhibition has no rooms yet.</p>
            )}
            {recording && (
              <span style={{ position: "absolute", top: 10, left: 10, background: "#a33", color: "#fff", fontSize: 11, fontWeight: 700, padding: "4px 8px", borderRadius: 4 }}>
                ● REC {Math.round(previewTime)}s / {Math.round(totalDuration)}s
              </span>
            )}
          </div>

          <div style={{ marginTop: 10 }}>
            <label style={{ display: "block", marginBottom: 6, color: "var(--muted)", fontSize: 11 }}>
              Preview — {activeShot ? `${activeShot.label} (${Math.round(previewTime)}s / ${Math.round(totalDuration)}s)` : "no shots yet"}
            </label>
            <input
              type="range"
              min={0}
              max={Math.max(totalDuration, 0.1)}
              step={0.1}
              value={previewTime}
              disabled={recording}
              onChange={(event) => {
                const value = Number(event.target.value);
                clockRef.current = value;
                setPreviewTime(value);
              }}
              style={{ width: "100%" }}
              aria-label="Scrub preview"
            />
            <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button
                className="galleries-open-button"
                disabled={recording || totalDuration === 0}
                onClick={() => {
                  if (previewTime >= totalDuration) {
                    clockRef.current = 0;
                    setPreviewTime(0);
                  }
                  setPlaying((value) => !value);
                }}
              >
                {playing ? "Pause preview" : "Play preview"}
              </button>
              {!recording ? (
                <button className="galleries-open-button" disabled={totalDuration === 0 || !room} onClick={() => void startRecording()}>
                  Record video
                </button>
              ) : (
                <button className="galleries-open-button" style={{ background: "#a33" }} onClick={cancelRecording}>
                  Cancel recording
                </button>
              )}
            </div>
            {recording && (
              <div style={{ marginTop: 10 }}>
                <div style={{ height: 8, background: "var(--border)", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ height: "100%", width: `${progress}%`, background: "#a67c37" }} />
                </div>
                <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: 11 }}>Recording… {Math.round(progress)}% — keep this tab in the foreground until it finishes.</p>
              </div>
            )}
            {recordError && (
              <p role="alert" style={{ margin: "10px 0 0", color: "#a33", fontSize: 12, lineHeight: 1.6 }}>
                {recordError}
              </p>
            )}
          </div>

          {/* Renders this session */}
          {renders.length > 0 && (
            <div className="property-section">
              <label>RENDERS — THIS BROWSER SESSION ONLY</label>
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
                {renders.map((render) => (
                  <li key={render.id} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 10, fontSize: 12, lineHeight: 1.6 }}>
                    <strong>{render.name}</strong>
                    <br />
                    <span style={{ color: "var(--muted)" }}>
                      {render.durationSeconds}s · {render.format} · {(render.sizeBytes / 1024 / 1024).toFixed(1)} MB · WebM
                    </span>
                    <br />
                    <a href={render.url} download={`${render.name.replace(/[^\w\-]+/g, "-")}.webm`} style={{ color: "var(--accent)", fontWeight: 600 }}>
                      Download .webm ↓
                    </a>
                  </li>
                ))}
              </ul>
              <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
                These files are not stored server-side. Download them before closing the tab; saving the project keeps the shot list and settings,
                not the video files.
              </p>
            </div>
          )}
        </div>

        {/* ------------------------------------------------------- EDITOR */}
        <div>
          <div className="property-section">
            <label>EXHIBITION</label>
            <select className="full-input" value={exhibition.id} onChange={(event) => selectExhibition(event.target.value)} aria-label="Exhibition">
              {exhibitions.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({item.status}) — {item.artworks.length} artwork{item.artworks.length === 1 ? "" : "s"}
                </option>
              ))}
            </select>
            {!room && (
              <p style={{ margin: "8px 0 0", color: "#a33", fontSize: 12 }}>This exhibition has no rooms yet — open it in the editor and add a room first.</p>
            )}
          </div>

          <div className="property-section">
            <label>FORMAT</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {FORMATS.map((item) => (
                <button
                  key={item.id}
                  className="galleries-open-button"
                  style={format === item.id ? undefined : { background: "transparent", color: "var(--ink)", border: "1px solid var(--border)" }}
                  onClick={() => setFormat(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 11 }}>Render size: {formatSpec.width}×{formatSpec.height} (browser canvas resolution).</p>
          </div>

          <div className="property-section">
            <label>DURATION PRESET</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {PRESETS.map((item) => (
                <button
                  key={item.id}
                  className="galleries-open-button"
                  style={preset === item.id ? undefined : { background: "transparent", color: "var(--ink)", border: "1px solid var(--border)" }}
                  onClick={() => applyPreset(item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>
            <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 11 }}>
              Total: {Math.round(totalDuration)}s across {shots.length} shot{shots.length === 1 ? "" : "s"}. Recording happens in real time.
            </p>
          </div>

          <div className="property-section">
            <label>SHOT LIST</label>
            {shots.length === 0 && <p style={{ color: "var(--muted)", fontSize: 12 }}>No shots yet — add one below or regenerate the default list.</p>}
            <ol style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 10 }}>
              {shots.map((shot, index) => (
                <li key={shot.id} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 10 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 8, alignItems: "center" }}>
                    <strong style={{ fontSize: 13 }}>
                      {index + 1}. {SHOT_TYPE_LABELS[shot.type]} — {shot.label}
                    </strong>
                    <span style={{ display: "flex", gap: 4 }}>
                      <button className="galleries-open-button" style={{ padding: "4px 8px" }} disabled={index === 0} onClick={() => moveShot(shot.id, -1)} aria-label="Move shot up">
                        ↑
                      </button>
                      <button className="galleries-open-button" style={{ padding: "4px 8px" }} disabled={index === shots.length - 1} onClick={() => moveShot(shot.id, 1)} aria-label="Move shot down">
                        ↓
                      </button>
                      <button className="galleries-open-button" style={{ padding: "4px 8px", background: "transparent", color: "var(--ink)", border: "1px solid var(--border)" }} onClick={() => removeShot(shot.id)}>
                        Remove
                      </button>
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                    <label style={{ fontSize: 11, color: "var(--muted)" }}>
                      Duration (s)
                      <input
                        type="number"
                        min={1}
                        max={60}
                        value={shot.duration}
                        onChange={(event) => updateShot(shot.id, { duration: Math.max(1, Number(event.target.value) || 1) })}
                        style={{ display: "block", width: 70, height: 30, marginTop: 2, padding: "0 6px", border: "1px solid var(--border)", borderRadius: 3 }}
                      />
                    </label>
                    {shot.type === "closeup" && (
                      <label style={{ fontSize: 11, color: "var(--muted)", flex: "1 1 160px" }}>
                        Artwork
                        <select
                          className="full-input"
                          style={{ marginTop: 2 }}
                          value={shot.artworkId ?? ""}
                          onChange={(event) => {
                            const artwork = exhibition.artworks.find((a) => a.id === event.target.value);
                            if (!artwork) return;
                            updateShot(shot.id, {
                              artworkId: artwork.id,
                              label: `Close-up — ${artwork.title}`,
                              from: [artwork.positionX, artwork.positionY, artwork.positionZ + 2.6],
                              to: [artwork.positionX, artwork.positionY, artwork.positionZ + 1.2],
                              lookAt: [artwork.positionX, artwork.positionY, artwork.positionZ],
                              title: artwork.title,
                              body: `${artwork.artist} · ${artwork.year} · ${artwork.medium}`,
                            });
                          }}
                        >
                          {exhibition.artworks.map((artwork) => (
                            <option key={artwork.id} value={artwork.id}>
                              {artwork.title}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  </div>
                  {(shot.type === "title" || shot.type === "statement") && (
                    <div style={{ display: "grid", gap: 6, marginTop: 8 }}>
                      <input className="full-input" value={shot.title ?? ""} onChange={(event) => updateShot(shot.id, { title: event.target.value })} placeholder="Card title" aria-label="Card title" />
                      <input className="full-input" value={shot.body ?? ""} onChange={(event) => updateShot(shot.id, { body: event.target.value })} placeholder="Card text" aria-label="Card text" />
                    </div>
                  )}
                  <details style={{ marginTop: 8 }}>
                    <summary style={{ fontSize: 11, color: "var(--muted)", cursor: "pointer" }}>Camera path (metres)</summary>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6, marginTop: 6 }}>
                      {(["from", "to", "lookAt"] as const).map((key) => (
                        <div key={key}>
                          <span style={{ fontSize: 10, color: "var(--muted)" }}>{key}</span>
                          {shot[key].map((value, axis) => (
                            <input
                              key={axis}
                              type="number"
                              step={0.1}
                              value={value}
                              onChange={(event) => {
                                const next = [...shot[key]] as [number, number, number];
                                next[axis] = Number(event.target.value) || 0;
                                updateShot(shot.id, { [key]: next });
                              }}
                              style={{ display: "block", width: "100%", height: 28, marginTop: 2, padding: "0 6px", border: "1px solid var(--border)", borderRadius: 3, fontSize: 12 }}
                              aria-label={`${key} ${["x", "y", "z"][axis]}`}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </details>
                </li>
              ))}
            </ol>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginTop: 10 }}>
              {(["title", "walk", "closeup", "statement"] as ShotType[]).map((type) => (
                <button
                  key={type}
                  className="galleries-open-button"
                  style={{ background: "transparent", color: "var(--ink)", border: "1px solid var(--border)" }}
                  onClick={() => addShot(type)}
                >
                  + {SHOT_TYPE_LABELS[type]}
                </button>
              ))}
              <button className="galleries-open-button" style={{ background: "transparent", color: "var(--ink)", border: "1px solid var(--border)" }} onClick={regenerateShots}>
                Regenerate default shots
              </button>
            </div>
          </div>

          <div className="property-section">
            <label>SAVE PROJECT</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <input className="full-input" style={{ flex: "1 1 200px", height: 36 }} value={projectTitle} onChange={(event) => setProjectTitle(event.target.value)} placeholder={`${exhibition.title} — video`} aria-label="Project title" />
              <button className="galleries-open-button" disabled={busy} onClick={() => void saveProject()}>
                {busy ? "Saving…" : "Save project"}
              </button>
            </div>
            <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 11, lineHeight: 1.6 }}>
              Saves the exhibition, format, preset and shot list. Render files are not saved with it — download them from this session.
            </p>
          </div>

          <div className="property-section">
            <label>SAVED PROJECTS</label>
            {projectsLoading ? (
              <p style={{ color: "var(--muted)", fontSize: 12 }}>Loading…</p>
            ) : projectsError ? (
              <p role="alert" style={{ color: "#a33", fontSize: 12 }}>
                {projectsError} <button className="galleries-open-button" onClick={() => void loadProjects()}>Try again</button>
              </p>
            ) : projects.length === 0 ? (
              <p style={{ color: "var(--muted)", fontSize: 12 }}>No saved video projects yet.</p>
            ) : (
              <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 8 }}>
                {projects.map((project) => (
                  <li key={project.id} style={{ border: "1px solid var(--border)", borderRadius: 6, padding: 10, fontSize: 12, lineHeight: 1.6 }}>
                    <strong>{project.title}</strong>
                    <br />
                    <span style={{ color: "var(--muted)" }}>
                      {project.data.project ? `${project.data.project.shots.length} shots · ${project.data.project.format}` : "No shot list"} · updated{" "}
                      {new Date(project.updatedAt).toLocaleDateString()}
                      {project.data.renders?.length ? ` · ${project.data.renders.length} past render${project.data.renders.length === 1 ? "" : "s"} (files not stored)` : ""}
                    </span>
                    <br />
                    <span style={{ display: "flex", gap: 8, marginTop: 4 }}>
                      <button className="galleries-open-button" style={{ padding: "4px 8px" }} onClick={() => loadProject(project)}>
                        Load
                      </button>
                      <button className="galleries-open-button" style={{ padding: "4px 8px", background: "transparent", color: "var(--ink)", border: "1px solid var(--border)" }} disabled={busy} onClick={() => void deleteProject(project.id)}>
                        Delete
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
