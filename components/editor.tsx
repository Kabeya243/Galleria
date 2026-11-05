"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  AppWindow,
  Armchair,
  ArrowLeft,
  ArrowRight,
  Blinds,
  Box,
  BrickWall,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  DoorOpen,
  Expand,
  Eye,
  Footprints,
  Grid2X2,
  Image,
  Info,
  Lamp,
  Layers,
  Lightbulb,
  Minus,
  Monitor,
  Move,
  Paintbrush,
  PanelsTopLeft,
  Plus,
  RectangleHorizontal,
  RotateCw,
  Save,
  Settings2,
  Sparkles,
  Table,
  Trash2,
  Type,
  Undo2,
  Upload,
} from "lucide-react";
import GalleryScene, { parseArtworkDimensions } from "@/components/gallery-scene";
import ThemeToggle from "@/components/theme-toggle";
import type { Artwork, FrameVariant } from "@/lib/demo-data";
import { FRAME_VARIANTS } from "@/lib/demo-data";
import { createElement, ELEMENT_DEFAULTS, PLINTH_VARIANTS, WALL_TEXT_ALIGNS, WALL_TEXT_FONTS, WALL_TEXT_LAYOUTS, WALL_TEXT_SWATCHES, type ElementType, type RoomElement, type WallTextAlign, type WallTextFont, type WallTextLayout } from "@/lib/elements";
import { applyLayoutPreset, ceilingTextures, createGalleryRoom, floorTextures, floorTypes, lightTypes, roomLayouts, wallTextures, type GalleryRoom, type RoomLayout, type WallId } from "@/lib/rooms";

// The Elements palette: every placeable object, with its icon.
const ELEMENT_PALETTE: { type: ElementType; label: string; icon: typeof BrickWall }[] = [
  { type: "partition", label: "Partition wall", icon: BrickWall },
  { type: "chair", label: "Chair", icon: Armchair },
  { type: "bench", label: "Long bench", icon: RectangleHorizontal },
  { type: "table", label: "Table", icon: Table },
  { type: "door", label: "Door", icon: DoorOpen },
  { type: "window", label: "Window", icon: AppWindow },
  { type: "wall-text", label: "Wall text", icon: Type },
  { type: "plinth", label: "Plinth", icon: Box },
  { type: "vitrine", label: "Display case", icon: Layers },
  { type: "track-light", label: "Track light", icon: Lamp },
  { type: "shelf", label: "Display shelf", icon: PanelsTopLeft },
  { type: "desk", label: "Desk & chair", icon: Monitor },
  { type: "curtain", label: "Sheer curtain", icon: Blinds },
];

// Paint swatches for one wall (plus the colour picker for any colour).
const WALL_SWATCHES = ["#f5f2eb", "#e8e4da", "#141414", "#b4552d", "#8a9b88", "#2e4a6b", "#c9a227"] as const;

const WALL_LABELS: Record<string, string> = {
  back: "Back wall",
  left: "Left wall",
  right: "Right wall",
  front: "Front wall",
};

// A numeric field that keeps what the user types. A controlled
// `type="number"` input cannot hold an intermediate "-" (Number("-") is
// NaN, so React snaps the value back and the minus is lost — typing -5.72
// produced +5.72). This keeps the raw text locally and only commits a
// value once it parses to a real number, so a leading minus survives.
function NumberField({
  value,
  onCommit,
  ariaLabel,
  step,
  min,
}: {
  value: number;
  onCommit: (next: number) => void;
  ariaLabel: string;
  step?: string;
  min?: number;
}) {
  const [text, setText] = useState(String(value));
  const focusedRef = useRef(false);
  useEffect(() => {
    if (!focusedRef.current) setText(String(value));
  }, [value]);
  return (
    <input
      aria-label={ariaLabel}
      type="text"
      inputMode="decimal"
      step={step}
      min={min}
      value={text}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        setText(String(value));
      }}
      onChange={(event) => {
        const nextText = event.target.value;
        setText(nextText);
        const next = Number(nextText);
        if (Number.isFinite(next)) onCommit(next);
      }}
    />
  );
}

export default function Editor({ exhibitionId }: { exhibitionId: string }) {
  const [artworks, setArtworks] = useState<Artwork[]>([]);
  const [rooms, setRooms] = useState<GalleryRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [walking, setWalking] = useState(false);
  const movementKeys = useRef(new Set<string>());
  const [selectedId, setSelectedId] = useState<string>();
  const [panelTab, setPanelTab] = useState<"artworks" | "elements">("artworks");
  const [selectedElementId, setSelectedElementId] = useState<string>();
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [title, setTitle] = useState("Untitled exhibition");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("draft");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
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

  // Selection is exclusive: picking an artwork clears any element or wall,
  // and vice versa, so the inspector always shows one thing.
  function selectArtwork(id: string | undefined) {
    setSelectedId(id);
    setSelectedElementId(undefined);
    setSelectedWallId(null);
  }

  function selectElement(id: string | undefined) {
    setSelectedElementId(id);
    setSelectedId(undefined);
    setSelectedWallId(null);
  }

  function selectWall(id: string | null) {
    setSelectedWallId(id);
    setSelectedId(undefined);
    setSelectedElementId(undefined);
  }

  function clearSelection() {
    setSelectedId(undefined);
    setSelectedElementId(undefined);
    setSelectedWallId(null);
  }

  const selectedElement = useMemo(
    () => activeRoom?.elements.find((element) => element.id === selectedElementId),
    [activeRoom, selectedElementId],
  );
  const currentElements = activeRoom?.elements ?? [];

  function updateElement(id: string, patch: Partial<RoomElement>) {
    if (!activeRoom) return;
    updateRoom(activeRoom.id, (room) => ({
      ...room,
      elements: room.elements.map((element) => (element.id === id ? { ...element, ...patch } : element)),
    }));
  }

  function addElement(type: ElementType) {
    if (!activeRoom) return;
    const number = currentElements.filter((element) => element.type === type).length;
    const element = createElement(type, roomLayouts[activeRoom.layout], number);
    updateRoom(activeRoom.id, (room) => ({ ...room, elements: [...room.elements, element] }));
    selectElement(element.id);
  }

  function removeElement() {
    if (!selectedElement || !activeRoom) return;
    updateRoom(activeRoom.id, (room) => ({
      ...room,
      elements: room.elements.filter((element) => element.id !== selectedElement.id),
    }));
    setSelectedElementId(undefined);
  }

  function duplicateElement() {
    if (!selectedElement || !activeRoom) return;
    const copy: RoomElement = {
      ...selectedElement,
      id: crypto.randomUUID(),
      name: `${selectedElement.name} copy`.slice(0, 60),
      x: Math.min(selectedElement.x + 1.5, roomLayouts[activeRoom.layout].width / 2 - 0.5),
    };
    updateRoom(activeRoom.id, (room) => ({ ...room, elements: [...room.elements, copy] }));
    selectElement(copy.id);
  }

  // Painting one wall: the colour is stored as an override on the room
  // (or on the partition wall itself), never on the other walls.
  function paintWall(color: string) {
    if (!activeRoom || !selectedWallId) return;
    if (selectedWallId === "back" || selectedWallId === "left" || selectedWallId === "right" || selectedWallId === "front") {
      const wallId = selectedWallId as WallId;
      updateRoom(activeRoom.id, (room) => ({
        ...room,
        wallPaint: { ...room.wallPaint, [wallId]: color },
      }));
    } else {
      updateRoom(activeRoom.id, (room) => ({
        ...room,
        partitionWalls: room.partitionWalls.map((wall) => (wall.id === selectedWallId ? { ...wall, color } : wall)),
      }));
    }
  }

  function resetWallPaint() {
    if (!activeRoom || !selectedWallId) return;
    if (selectedWallId === "back" || selectedWallId === "left" || selectedWallId === "right" || selectedWallId === "front") {
      const wallId = selectedWallId as WallId;
      updateRoom(activeRoom.id, (room) => {
        const wallPaint = { ...room.wallPaint };
        delete wallPaint[wallId];
        return { ...room, wallPaint };
      });
    } else {
      updateRoom(activeRoom.id, (room) => ({
        ...room,
        partitionWalls: room.partitionWalls.map((wall) => {
          if (wall.id !== selectedWallId) return wall;
          const next = { ...wall };
          delete next.color;
          return next;
        }),
      }));
    }
  }

  function selectedWallColor(): string {
    if (!activeRoom || !selectedWallId) return "#f5f2eb";
    if (selectedWallId === "back") return activeRoom.wallPaint.back ?? activeRoom.wallColor;
    if (selectedWallId === "front") return activeRoom.wallPaint.front ?? activeRoom.sideWallColor;
    if (selectedWallId === "left") return activeRoom.wallPaint.left ?? activeRoom.sideWallColor;
    if (selectedWallId === "right") return activeRoom.wallPaint.right ?? activeRoom.sideWallColor;
    return activeRoom.partitionWalls.find((wall) => wall.id === selectedWallId)?.color ?? activeRoom.sideWallColor;
  }

  function selectedWallLabel(): string {
    if (!selectedWallId) return "Wall";
    if (WALL_LABELS[selectedWallId]) return WALL_LABELS[selectedWallId];
    const index = activeRoom?.partitionWalls.findIndex((wall) => wall.id === selectedWallId) ?? -1;
    return index >= 0 ? `Partition wall ${index + 1}` : "Wall";
  }

  function moveArtwork(axis: 0 | 1, amount: number) {
    if (!selected) return;
    updateArtwork(selected.id, (artwork) => {
      const position: [number, number, number] = [...artwork.position];
      position[axis] += amount;
      return { ...artwork, position };
    });
  }

  // The server rejects the whole save when a single artwork is missing a
  // required detail (title, colours, room, or a valid uploaded image).
  // Check here first, so the editor names the artwork and the missing
  // detail instead of failing with a cryptic error.
  function isAllowedImageUrl(url: string): boolean {
    if (/^\/api\/(?:uploads\/[a-f0-9-]+\.webp|portfolio-artworks\/[a-z0-9-]+\.(?:jpg|jpeg|webp))$/i.test(url)) return true;
    // New R2 uploads: a public URL under the configured R2 base. The base
    // is a public CDN address, so it is exposed to the browser as well.
    const r2Base = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "").replace(/\/$/, "");
    return Boolean(r2Base) && url.startsWith(`${r2Base}/uploads/`);
  }

  function artworkSaveProblems(artwork: Artwork): string[] {
    const problems: string[] = [];
    if (!artwork.title.trim()) problems.push("a title");
    if (!/^#[0-9a-f]{6}$/i.test(artwork.color)) problems.push("a valid frame colour");
    if (!/^#[0-9a-f]{6}$/i.test(artwork.accent)) problems.push("a valid accent colour");
    if (artwork.imageUrl && !isAllowedImageUrl(artwork.imageUrl)) {
      problems.push("a re-uploaded image (this image link cannot be saved)");
    }
    if (!artwork.roomId) problems.push("a room");
    return problems;
  }

  async function saveExhibition() {
    setSaveError(null);
    if (!title.trim()) {
      setSaveError("Give the exhibition a title before saving.");
      return false;
    }
    const incomplete = artworks
      .map((artwork, index) => ({ artwork, index, problems: artworkSaveProblems(artwork) }))
      .filter((item) => item.problems.length > 0);
    if (incomplete.length > 0) {
      const first = incomplete[0];
      const label = first.artwork.title.trim() || `Artwork ${first.index + 1}`;
      setSaveError(
        `${label} needs ${first.problems.join(" and ")} before this exhibition can be saved.` +
          (incomplete.length > 1 ? ` ${incomplete.length} artworks are missing details.` : "") +
          " Fill them in on the right, then save again.",
      );
      setSelectedId(first.artwork.id);
      return false;
    }
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
      // Read as text first: an error page (e.g. Vercel's plain-text 413 for
      // an oversized request) is not JSON and used to throw a cryptic
      // "Unexpected end of JSON input" instead of a readable error.
      const text = await response.text();
      let result: { error?: string } = {};
      try {
        result = text ? (JSON.parse(text) as { error?: string }) : {};
      } catch {
        result = {};
      }
      if (response.status === 401) {
        window.location.assign("/login");
        return false;
      }
      if (!response.ok) {
        throw new Error(
          result.error ??
            (response.status === 413
              ? "This exhibition is too large to save. Remove an artwork or use smaller images, then save again."
              : "Could not save this exhibition."),
        );
      }
      setSaved(true);
      return true;
    } catch (error) {
      console.error("Could not save exhibition.", error);
      setSaveError(error instanceof Error ? error.message : "Could not save this exhibition.");
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
      position: [(index - (artworkCount - 1) / 2) * spacing, 1.55, -depth / 2 + 0.28],
      rotation: 0,
      scale: 1,
      frame: "wood",
      imageUrl,
      roomId: activeRoom.id,
    };
    historyRef.current = [...historyRef.current, artworks].slice(-30);
    setArtworks((current) => [...current, artwork]);
    setSelectedId(artwork.id);
    setSaved(false);
  }

// Photos from a phone are often over Vercel's 4.5 MB request limit, which
// rejects the upload before it reaches the server (HTTP 413, plain text).
// Shrink big files in the browser first so they always fit. On any failure
// (e.g. HEIC, which canvas cannot decode) the original file is sent and the
// server answers with a readable error instead.
async function compressImage(file: File): Promise<File> {
  if (file.size <= 3_500_000) return file;
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 3000 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d");
  if (!context) return file;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  if (!blob) return file;
  return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
}

  // Upload straight to R2 via a presigned URL (no Vercel size cap).
  // Returns the public URL, or null when R2 is not configured so the
  // caller can fall back to the legacy database upload.
  async function uploadToR2(file: File): Promise<string | null> {
    const presign = await fetch("/api/uploads/presign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: file.name, contentType: file.type, size: file.size }),
    });
    if (presign.status === 501) return null;
    const text = await presign.text();
    let signed: { uploadUrl?: string; publicUrl?: string; error?: string } = {};
    try {
      signed = text ? (JSON.parse(text) as typeof signed) : {};
    } catch {
      signed = {};
    }
    if (!presign.ok) throw new Error(signed.error ?? "Could not upload this image.");
    if (!signed.uploadUrl || !signed.publicUrl) throw new Error("Could not upload this image.");
    const put = await fetch(signed.uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!put.ok) throw new Error("Could not upload this image.");
    return signed.publicUrl;
  }

  async function uploadArtwork(file?: File) {
    if (!file) return;
    setBusy(true);
    setUploadError(null);
    try {
      const uploadFile = await compressImage(file).catch(() => file);
      let url: string | null = null;
      try {
        url = await uploadToR2(uploadFile);
      } catch (error) {
        // A real R2 failure (not "not configured"): surface it, do not
        // silently fall back — the file may be too large for the legacy
        // route anyway, and the user should know the upload failed.
        throw error;
      }
      if (!url) {
        // R2 is not configured: legacy database upload.
        const body = new FormData();
        body.set("file", uploadFile);
        const response = await fetch("/api/uploads", { method: "POST", body });
        // Read as text first: an error page (e.g. Vercel's plain-text 413 for
        // an oversized request) is not JSON and used to throw a cryptic
        // "Unexpected end of JSON input" instead of a readable error.
        const text = await response.text();
        let result: { error?: string; url?: string } = {};
        try {
          result = text ? (JSON.parse(text) as { error?: string; url?: string }) : {};
        } catch {
          result = {};
        }
        if (!response.ok) {
          throw new Error(
            result.error ??
              (response.status === 413
                ? "This image is too large to upload (over 4 MB even after compression). Try a smaller file."
                : "Could not upload this image."),
          );
        }
        if (!result.url) throw new Error("Could not upload this image.");
        url = result.url;
      }
      addArtwork(url);
      if (uploadRef.current) uploadRef.current.value = "";
    } catch (error) {
      console.error("Could not upload artwork.", error);
      setUploadError(error instanceof Error ? error.message : "Could not upload this image.");
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

  // Inline rename (an input in the header): the old window.prompt opened a
  // native dialog that automation — and some mobile browsers — cannot see
  // or fill, so the title could never be set that way.
  function startEditingTitle() {
    setTitleDraft(title);
    setEditingTitle(true);
  }

  function confirmTitle() {
    const next = titleDraft.trim();
    if (next) {
      setTitle(next.slice(0, 120));
      setSaved(false);
    }
    setEditingTitle(false);
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
      // Elements stay inside the resized room too.
      setRooms((current) => current.map((room) => room.id === id
        ? {
            ...room,
            elements: room.elements.map((element) => ({
              ...element,
              x: Math.max(-width / 2 + 0.5, Math.min(width / 2 - 0.5, element.x)),
              z: Math.max(-depth / 2 + 0.5, Math.min(depth / 2 - 0.5, element.z)),
            })),
          }
        : room));
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
    setSelectedElementId(undefined);
    setSelectedWallId(null);
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
          {editingTitle ? (
            <input
              className="editor-title-input"
              value={titleDraft}
              autoFocus
              maxLength={120}
              aria-label="Exhibition title"
              onChange={(event) => setTitleDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") confirmTitle();
                if (event.key === "Escape") setEditingTitle(false);
              }}
              onBlur={confirmTitle}
            />
          ) : (
            <div className="editor-title"><strong>{title}</strong><span><i /> {saved ? "All changes saved" : "Unsaved changes"}</span></div>
          )}
          <button className="subtle-edit-button" aria-label={editingTitle ? "Save exhibition title" : "Edit exhibition title"} onClick={() => { if (editingTitle) confirmTitle(); else startEditingTitle(); }}>{editingTitle ? <Check size={14} /> : <Settings2 size={14} />}</button>
        </div>
        <div className="editor-top-actions">
          <ThemeToggle />
          <span className="saved-state"><span className={saved ? "save-indicator done" : "save-indicator"} />{saved ? "Saved" : "Unsaved changes"}</span>
          <button className="editor-secondary-button" onClick={() => void saveExhibition()} disabled={busy}><Save size={15} /> Save</button>
          {status === "public" && <Link className="editor-secondary-button" href={`/exhibition/${slug}`}><Eye size={15} /> Preview</Link>}
          <button className="editor-publish-button" onClick={() => void publishExhibition()} disabled={busy}>{status === "public" ? "Unpublish" : "Publish"} <ArrowRight size={15} /></button>
        </div>
      </header>
      {saveError && (
        <div className="editor-error-banner" role="alert">
          <span>{saveError}</span>
          <button type="button" aria-label="Dismiss" onClick={() => setSaveError(null)}>
            ×
          </button>
        </div>
      )}

      <div className="editor-workspace">
        <aside className="editor-assets-panel">
          <div className="panel-heading"><div><span className="panel-kicker">YOUR EXHIBITION</span><h1>Build your space</h1></div><button className="tiny-icon-button" aria-label="Editor help"><CircleHelp size={16} /></button></div>
          <div className="room-list">
            {rooms.map((room, index) => (
              <button
                className={`room-selector ${room.id === activeRoom?.id ? "selected" : ""}`}
                key={room.id}
                onClick={() => { setActiveRoomId(room.id); clearSelection(); }}
              >
                <span className="room-number">{String(index + 1).padStart(2, "0")}</span>
                <span><strong>{room.name}</strong><small>{roomLayouts[room.layout].label} · {artworks.filter((artwork) => artwork.roomId === room.id).length} artworks</small></span>
                <ChevronDown size={15} />
              </button>
            ))}
            <button className="add-room-button" onClick={addRoom} disabled={rooms.length >= 12}><Plus size={13} /> Add a room</button>
          </div>
          <div className="panel-tabs">
            <button className={panelTab === "artworks" ? "active" : ""} onClick={() => setPanelTab("artworks")}>Artworks <span>{currentArtworks.length}</span></button>
            <button className={panelTab === "elements" ? "active" : ""} onClick={() => setPanelTab("elements")}>Elements <span>{currentElements.length}</span></button>
          </div>
          {panelTab === "artworks" ? (
            <>
              <div className="asset-list">
                {currentArtworks.map((artwork, index) => (
                  <button className={`asset-row ${selectedId === artwork.id ? "selected" : ""}`} key={artwork.id} onClick={() => selectArtwork(artwork.id)}>
                    <span className={`asset-thumb asset-color-${index % 3}`}>{artwork.imageUrl ? <img src={artwork.imageUrl} alt={artwork.title} /> : <span />}</span>
                    <span className="asset-copy"><strong>{artwork.title}</strong><small>{artwork.year} · {artwork.medium.split(" ")[0]}</small></span>
                    {selectedId === artwork.id && <span className="selected-mark"><Check size={12} /></span>}
                  </button>
                ))}
              </div>
              <button className="add-to-room" onClick={() => uploadRef.current?.click()} disabled={busy}><Plus size={15} /> Add artwork to room</button>
              {uploadError && <div className="asset-upload-error" role="alert">{uploadError}</div>}
              <input ref={uploadRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/heic,image/heif" onChange={(event) => void uploadArtwork(event.target.files?.[0])} />
              <div className="asset-upload-hint"><Upload size={15} /><span>Upload a PNG, JPEG, WebP, AVIF, HEIC or HEIF image. Large photos are compressed automatically.</span></div>
            </>
          ) : (
            <>
              <div className="element-palette">
                {ELEMENT_PALETTE.map(({ type, label, icon: Icon }) => (
                  <button key={type} className="element-palette-item" onClick={() => addElement(type)} title={`Add a ${label.toLowerCase()} to this room`}>
                    <Icon size={17} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <div className="asset-list">
                {currentElements.map((element) => {
                  const palette = ELEMENT_PALETTE.find((item) => item.type === element.type);
                  const Icon = palette?.icon ?? Box;
                  return (
                    <button className={`asset-row ${selectedElementId === element.id ? "selected" : ""}`} key={element.id} onClick={() => selectElement(element.id)}>
                      <span className="asset-thumb element-thumb"><Icon size={16} /></span>
                      <span className="asset-copy"><strong>{element.name}</strong><small>{palette?.label ?? element.type}</small></span>
                      {selectedElementId === element.id && <span className="selected-mark"><Check size={12} /></span>}
                    </button>
                  );
                })}
                {currentElements.length === 0 && (
                  <p className="element-empty-note">No elements yet. Add a partition wall, a bench, a plinth or a track light above — then drag it around the room.</p>
                )}
              </div>
            </>
          )}
          <div className="left-panel-bottom"><div className="tip-card"><div className="tip-heading"><Lightbulb size={14} /> QUICK TIP</div><p>Select an artwork or an element in the room to adjust its placement and scale. Click a wall to paint it.</p></div><button className="panel-help-link"><CircleHelp size={15} /> Editor guide <ArrowRight size={13} /></button></div>
        </aside>

        <section className="editor-stage">
          <div className="stage-toolbar">
            <div className="tool-group">
              <button className="tool-button active" aria-label="Select and move"><Move size={16} /></button>
              <button className="tool-button" aria-label="Rotate selected artwork or element" onClick={() => {
                if (selected) updateArtwork(selected.id, (artwork) => ({ ...artwork, rotation: artwork.rotation + Math.PI / 12 }));
                else if (selectedElement) updateElement(selectedElement.id, { rotation: selectedElement.rotation + Math.PI / 12 });
              }}><RotateCw size={16} /></button>
              <span className="tool-divider" />
              <button className="tool-button" aria-label="Undo artwork change" onClick={undoArtworkChange} disabled={!historyRef.current.length}><Undo2 size={16} /></button>
              <span className="tool-divider" />
              <button className={`tool-button${walking ? " active" : ""}`} aria-label="Walk through the rooms" title="Walk through the rooms" onClick={() => setWalking((value) => !value)}><Footprints size={16} /></button>
            </div>
            <div className="stage-room-name"><span /> {activeRoom?.name.toUpperCase() ?? "ROOM"} <ChevronDown size={13} /></div>
            <div className="tool-group">
              <button className="tool-button" aria-label="Toggle grid"><Grid2X2 size={16} /></button>
              <button className="tool-button" aria-label="Toggle stage settings"><Settings2 size={16} /></button>
              <button className="tool-button" aria-label="Fullscreen" onClick={() => document.querySelector(".scene-wrap")?.requestFullscreen()}><Expand size={16} /></button>
            </div>
          </div>
          <div className="scene-wrap">
            {activeRoom && <GalleryScene artworks={currentArtworks} selectedId={selectedId} onSelect={selectArtwork} className="gallery-canvas editor-canvas" room={activeRoom} rooms={rooms} interior walkMode={walking} walking={walking} input={walking ? movementKeys : undefined} activeRoomId={activeRoom.id} onRoomChange={(id) => { setActiveRoomId(id); clearSelection(); }} editable onArtworkUpdate={(id, patch) => updateArtwork(id, (artwork) => ({ ...artwork, ...patch }))} selectedElementId={selectedElementId} onSelectElement={selectElement} onElementUpdate={(id, patch) => updateElement(id, patch)} selectedWallId={selectedWallId} onWallSelect={(wallId) => selectWall(wallId)} />}
            <div className="scene-caption"><span className="scene-caption-dot" /> {walking ? <>WALK MODE <span className="caption-divider">·</span> CLICK THE FLOOR OR AN ARTWORK TO WALK <span className="caption-divider">·</span> WASD TO MOVE <span className="caption-divider">·</span> DRAG TO LOOK</> : <>3D VIEW <span className="caption-divider">·</span> INSIDE THE ROOM <span className="caption-divider">·</span> DRAG AN ARTWORK TO MOVE IT <span className="caption-divider">·</span> DRAG ELSEWHERE TO LOOK AROUND <span className="caption-divider">·</span> SCROLL TO ZOOM</>}</div>
            <div className="scene-room-count"><span>{String(rooms.findIndex((room) => room.id === activeRoom?.id) + 1).padStart(2, "0")}</span><span className="room-count-line" /><span>{String(rooms.length).padStart(2, "0")}</span></div>
            <div className="stage-tools-float"><button onClick={() => moveArtwork(1, 0.15)} title="Move up"><Plus size={14} /></button><button onClick={() => moveArtwork(1, -0.15)} title="Move down"><Minus size={14} /></button><span /><button onClick={() => selected && updateArtwork(selected.id, (artwork) => ({ ...artwork, scale: Math.min(1.6, artwork.scale + 0.1) }))} title="Increase scale"><Expand size={14} /></button><button onClick={() => selected && updateArtwork(selected.id, (artwork) => ({ ...artwork, scale: Math.max(0.5, artwork.scale - 0.1) }))} title="Decrease scale"><Minus size={14} /></button></div>
            <div className="stage-add-button"><button onClick={() => uploadRef.current?.click()}><Plus size={14} /> Add artwork</button></div>
          </div>
          <div className="editor-statusbar"><span><span className="status-online" /> Scene ready</span><span>{activeRoom ? roomLayouts[activeRoom.layout].label : "Gallery"} <span className="status-dot-separator">·</span> {rooms.length} rooms <span className="status-dot-separator">·</span> {currentArtworks.length} artworks</span><span>100%</span></div>
        </section>

        <aside className="editor-properties-panel">
          <div className="properties-header"><div><span className="panel-kicker">INSPECTOR</span><h2>{selected ? "Artwork details" : selectedElement ? "Element details" : selectedWallId ? "Wall paint" : "Room settings"}</h2></div><button className="tiny-icon-button" aria-label="More properties"><Info size={15} /></button></div>
          {selected ? (
            <>
              <div className="selected-art-preview"><div className="selected-art-image" style={{ backgroundColor: selected.color }}>{selected.imageUrl ? <img src={selected.imageUrl} alt={selected.title} /> : <span style={{ backgroundColor: selected.accent }} />}</div><div><strong>{selected.title}</strong><small>{selected.year} · {selected.medium}</small></div></div>
              <div className="property-section"><label>POSITION <span>METERS</span></label><div className="coordinate-row">{(["X", "Y", "Z"] as const).map((axis, index) => <div key={axis}><span>{axis}</span><NumberField ariaLabel={`Position ${axis}`} step="0.1" value={selected.position[index]} onCommit={(next) => updateArtwork(selected.id, (artwork) => { const position: [number, number, number] = [...artwork.position]; position[index] = next; return { ...artwork, position }; })} /></div>)}</div></div>
              <div className="property-section"><label>DIMENSIONS <span>CM</span></label><div className="coordinate-row">{(["Width", "Height"] as const).map((label, index) => {
                const parsed = parseArtworkDimensions(selected.dimensions ?? "");
                const current = parsed ?? { widthCm: 182, heightCm: 212 };
                const value = index === 0 ? current.widthCm : current.heightCm;
                return (
                  <div key={label}><span>{label}</span><NumberField ariaLabel={`Artwork ${label.toLowerCase()} in centimetres`} step="1" min={1} value={value} onCommit={(next) => {
                    const clamped = Math.max(1, Math.round(next));
                    const widthCm = index === 0 ? clamped : current.widthCm;
                    const heightCm = index === 1 ? clamped : current.heightCm;
                    updateArtwork(selected.id, (artwork) => ({ ...artwork, dimensions: `${widthCm} × ${heightCm} cm` }));
                  }} /></div>
                );
              })}</div></div>
              <div className="property-section"><label>SIZE <span>UNIFORM</span></label><div className="range-control"><input aria-label="Artwork scale" type="range" min="0.5" max="1.6" step="0.05" value={selected.scale} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, scale: Number(event.target.value) }))} /><span>{Math.round(selected.scale * 100)}%</span></div></div>
              <div className="property-section"><label>ROTATION</label><div className="rotate-control"><button aria-label="Rotate counterclockwise" onClick={() => updateArtwork(selected.id, (artwork) => ({ ...artwork, rotation: artwork.rotation - Math.PI / 12 }))}><RotateCw className="rotate-back" size={15} /></button><span>{Math.round((selected.rotation * 180) / Math.PI)}°</span><button aria-label="Rotate clockwise" onClick={() => updateArtwork(selected.id, (artwork) => ({ ...artwork, rotation: artwork.rotation + Math.PI / 12 }))}><RotateCw size={15} /></button></div></div>
              <div className="property-section"><label>ARTWORK LABEL</label><input className="full-input" value={selected.title} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, title: event.target.value }))} /></div>
                  <div className="property-section"><label>ARTIST</label><input className="full-input" value={selected.artist ?? ""} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, artist: event.target.value }))} /></div>
                  <div className="property-section"><label>YEAR</label><input className="full-input" value={selected.year} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, year: event.target.value }))} /></div>
                  <div className="property-section"><label>MEDIUM</label><input className="full-input" value={selected.medium} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, medium: event.target.value }))} /></div>
                  <div className="property-section"><label>DIMENSIONS</label><input className="full-input" value={selected.dimensions} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, dimensions: event.target.value }))} /></div>
                  <div className="property-section"><label>DESCRIPTION</label><textarea className="full-input property-textarea" value={selected.description} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, description: event.target.value }))} /></div>
                  <div className="property-section"><label>FRAME</label><div className="frame-options">{(Object.keys(FRAME_VARIANTS) as FrameVariant[]).map((variant) => (
                    <button
                      key={variant}
                      type="button"
                      className={`frame-option${(selected.frame ?? "wood") === variant ? " selected" : ""}`}
                      aria-pressed={(selected.frame ?? "wood") === variant}
                      onClick={() => updateArtwork(selected.id, (artwork) => ({ ...artwork, frame: variant }))}
                    >
                      <span className={`frame-swatch frame-swatch-${variant}`} />
                      {FRAME_VARIANTS[variant].label}
                    </button>
                  ))}</div></div>
                  <div className="property-actions"><button onClick={() => selected && updateArtwork(selected.id, (artwork) => ({ ...artwork, position: [0, 1.55, -5.72], rotation: 0, scale: 1 }))}><Sparkles size={14} /> Fit to wall</button><button aria-label="Duplicate artwork" onClick={duplicateArtwork}><Copy size={14} /></button><button className="delete-action" aria-label="Delete artwork" onClick={removeArtwork}><Trash2 size={14} /></button></div>
                </>
              ) : selectedElement ? (
                <>
                  <div className="selected-art-preview"><div className="selected-art-image element-preview-icon">{(() => { const palette = ELEMENT_PALETTE.find((item) => item.type === selectedElement.type); const Icon = palette?.icon ?? Box; return <Icon size={22} />; })()}</div><div><strong>{selectedElement.name}</strong><small>{ELEMENT_DEFAULTS[selectedElement.type].label}</small></div></div>
                  <div className="property-section"><label>NAME</label><input className="full-input" value={selectedElement.name} onChange={(event) => updateElement(selectedElement.id, { name: event.target.value.slice(0, 60) })} /></div>
                  <div className="property-section"><label>POSITION <span>METERS</span></label><div className="coordinate-row">{(["X", "Y", "Z"] as const).map((axis, index) => {
                    const key = ["x", "y", "z"][index] as "x" | "y" | "z";
                    return (
                      <div key={axis}><span>{axis}</span><NumberField ariaLabel={`Element position ${axis}`} step="0.1" value={selectedElement[key]} onCommit={(next) => updateElement(selectedElement.id, { [key]: next } as Partial<RoomElement>)} /></div>
                    );
                  })}</div></div>
                  <div className="property-section"><label>ROTATION</label><div className="rotate-control"><button aria-label="Rotate counterclockwise" onClick={() => updateElement(selectedElement.id, { rotation: selectedElement.rotation - Math.PI / 12 })}><RotateCw className="rotate-back" size={15} /></button><span>{Math.round((selectedElement.rotation * 180) / Math.PI)}°</span><button aria-label="Rotate clockwise" onClick={() => updateElement(selectedElement.id, { rotation: selectedElement.rotation + Math.PI / 12 })}><RotateCw size={15} /></button></div></div>
                  <div className="property-section"><label>SIZE <span>UNIFORM</span></label><div className="range-control"><input aria-label="Element scale" type="range" min="0.25" max="3" step="0.05" value={selectedElement.scale} onChange={(event) => updateElement(selectedElement.id, { scale: Number(event.target.value) })} /><span>{Math.round(selectedElement.scale * 100)}%</span></div></div>
                  {(selectedElement.type === "partition" || selectedElement.type === "shelf" || selectedElement.type === "track-light" || selectedElement.type === "wall-text") && (
                    <div className="property-section"><label>{selectedElement.type === "track-light" ? "RAIL LENGTH" : selectedElement.type === "wall-text" ? "TEXT WIDTH" : "LENGTH"} <span>METERS</span></label><div className="range-control"><input aria-label="Element length in metres" type="range" min={selectedElement.type === "track-light" ? 1 : 0.5} max={selectedElement.type === "partition" || selectedElement.type === "wall-text" ? 12 : 6} step="0.5" value={selectedElement.length} onChange={(event) => updateElement(selectedElement.id, { length: Number(event.target.value) })} /><span>{selectedElement.length} m</span></div></div>
                  )}
                  {selectedElement.type === "plinth" && (
                    <div className="property-section"><label>HEIGHT</label><select className="full-input" value={selectedElement.variant} onChange={(event) => updateElement(selectedElement.id, { variant: event.target.value })}>{PLINTH_VARIANTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
                  )}
                  {selectedElement.type === "wall-text" ? (
                    <>
                      <div className="property-section"><label>TITLE <span>BIG TEXT · ONE LINE PER ROW</span></label><textarea className="full-input property-textarea" rows={3} value={selectedElement.title} onChange={(event) => updateElement(selectedElement.id, { title: event.target.value.slice(0, 120) })} placeholder={"PEOPLE\nMAKE THIS\nPLACE"} /></div>
                      <div className="property-section"><label>BODY TEXT</label><textarea className="full-input property-textarea" value={selectedElement.body} onChange={(event) => updateElement(selectedElement.id, { body: event.target.value.slice(0, 600) })} /></div>
                      <div className="property-section"><label>TYPEFACE</label><select className="full-input" value={selectedElement.font} onChange={(event) => updateElement(selectedElement.id, { font: event.target.value as WallTextFont })}>{(Object.keys(WALL_TEXT_FONTS) as WallTextFont[]).map((font) => <option key={font} value={font}>{WALL_TEXT_FONTS[font].label}</option>)}</select></div>
                      <div className="property-section"><label>LAYOUT</label><select className="full-input" value={selectedElement.layout} onChange={(event) => updateElement(selectedElement.id, { layout: event.target.value as WallTextLayout })}>{(Object.keys(WALL_TEXT_LAYOUTS) as WallTextLayout[]).map((layout) => <option key={layout} value={layout}>{WALL_TEXT_LAYOUTS[layout]}</option>)}</select></div>
                      <div className="property-section"><label>ALIGNMENT</label><div className="frame-options">{(Object.keys(WALL_TEXT_ALIGNS) as WallTextAlign[]).map((align) => (
                        <button key={align} type="button" className={`frame-option${selectedElement.align === align ? " selected" : ""}`} aria-pressed={selectedElement.align === align} onClick={() => updateElement(selectedElement.id, { align })}>{WALL_TEXT_ALIGNS[align]}</button>
                      ))}</div></div>
                      <div className="property-section"><label>TITLE SIZE</label><div className="range-control"><input aria-label="Wall text title size" type="range" min="0.08" max="1" step="0.01" value={selectedElement.fontSize} onChange={(event) => updateElement(selectedElement.id, { fontSize: Number(event.target.value) })} /><span>{Math.round(selectedElement.fontSize * 100)} cm</span></div></div>
                      <div className="property-section"><label>BODY SIZE</label><div className="range-control"><input aria-label="Wall text body size" type="range" min="0.04" max="0.3" step="0.01" value={selectedElement.bodySize} onChange={(event) => updateElement(selectedElement.id, { bodySize: Number(event.target.value) })} /><span>{Math.round(selectedElement.bodySize * 100)} cm</span></div></div>
                      <div className="property-section"><label>TITLE COLOUR</label><div className="room-color-control"><input type="color" aria-label="Wall text title colour" value={selectedElement.textColor} onChange={(event) => updateElement(selectedElement.id, { textColor: event.target.value })} /><span>{selectedElement.textColor}</span></div><div className="wall-swatches">{WALL_TEXT_SWATCHES.map((swatch) => (
                        <button key={swatch} type="button" className={`wall-swatch${selectedElement.textColor.toLowerCase() === swatch ? " selected" : ""}`} style={{ backgroundColor: swatch }} aria-label={`Title colour ${swatch}`} onClick={() => updateElement(selectedElement.id, { textColor: swatch })} />
                      ))}</div></div>
                      <div className="property-section"><label>BODY COLOUR</label><div className="room-color-control"><input type="color" aria-label="Wall text body colour" value={selectedElement.bodyColor} onChange={(event) => updateElement(selectedElement.id, { bodyColor: event.target.value })} /><span>{selectedElement.bodyColor}</span></div></div>
                    </>
                  ) : (
                    <div className="property-section"><label>{selectedElement.type === "track-light" ? "LIGHT COLOUR" : "COLOUR"}</label><div className="room-color-control"><input type="color" aria-label="Element colour" value={selectedElement.color} onChange={(event) => updateElement(selectedElement.id, { color: event.target.value })} /><span>{selectedElement.color}</span></div></div>
                  )}
                  <div className="property-actions"><button aria-label="Duplicate element" onClick={duplicateElement}><Copy size={14} /></button><button className="delete-action" aria-label="Delete element" onClick={removeElement}><Trash2 size={14} /></button></div>
                </>
              ) : selectedWallId ? (
                <>
                  <div className="selected-art-preview"><div className="selected-art-image element-preview-icon"><Paintbrush size={22} /></div><div><strong>{selectedWallLabel()}</strong><small>Paint this wall only</small></div></div>
                  <div className="property-section"><label>WALL COLOUR</label><div className="room-color-control"><input type="color" aria-label="Wall colour" value={selectedWallColor()} onChange={(event) => paintWall(event.target.value)} /><span>{selectedWallColor()}</span></div></div>
                  <div className="property-section"><label>PRESETS</label><div className="wall-swatches">{WALL_SWATCHES.map((swatch) => (
                    <button key={swatch} type="button" className={`wall-swatch${selectedWallColor().toLowerCase() === swatch ? " selected" : ""}`} style={{ backgroundColor: swatch }} aria-label={`Paint wall ${swatch}`} onClick={() => paintWall(swatch)} />
                  ))}</div></div>
                  <div className="property-actions"><button onClick={resetWallPaint}><Sparkles size={14} /> Reset to room colour</button></div>
                  <p className="wall-paint-note">Only this wall changes colour. The other walls keep the room's colours.</p>
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
                      <div className="property-section"><label>CEILING TEXTURE</label><select className="full-input" value={activeRoom.ceilingTexture} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, ceilingTexture: event.target.value as GalleryRoom["ceilingTexture"] }))}>{Object.entries(ceilingTextures).map(([texture, label]) => <option key={texture} value={texture}>{label}</option>)}</select></div>
                      <div className="property-section"><label>LIGHTING</label><label className="room-lighting-toggle"><input type="checkbox" checked={activeRoom.spotlights} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, spotlights: event.target.checked }))} /> Ceiling spotlights</label></div>
                      <div className="property-section"><label>LIGHT TYPE</label><select className="full-input" value={activeRoom.lightType ?? "spot-warm"} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, lightType: event.target.value as GalleryRoom["lightType"] }))}>{Object.entries(lightTypes).map(([type, details]) => <option key={type} value={type}>{details.label}</option>)}</select></div>
                      <div className="property-section"><label>FLOOR TYPE</label><select className="full-input" value={activeRoom.floorType ?? "charcoal"} onChange={(event) => {
                        const floorType = event.target.value as GalleryRoom["floorType"];
                        const preset = floorTypes[floorType];
                        updateRoom(activeRoom.id, (room) => ({ ...room, floorType, floorColor: preset.color, floorTexture: preset.texture as GalleryRoom["floorTexture"] }));
                      }}>{Object.entries(floorTypes).map(([type, details]) => <option key={type} value={type}>{details.label}</option>)}</select></div>
                      <div className="property-section">
                        <label>PARTITION WALLS <span>{activeRoom.partitionWalls.length}/8</span></label>
                        <div className="partition-wall-list">{activeRoom.partitionWalls.map((wall, index) => (
                          <div className="partition-wall-setting" key={wall.id}>
                            <div className="partition-wall-heading"><span>WALL {String(index + 1).padStart(2, "0")}</span><button type="button" aria-label={`Remove wall ${index + 1}`} onClick={() => removePartitionWall(wall.id)}><Trash2 size={12} /></button></div>
                            <select className="full-input" aria-label={`Wall ${index + 1} direction`} value={wall.orientation} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, partitionWalls: room.partitionWalls.map((item) => item.id === wall.id ? { ...item, orientation: event.target.value as typeof item.orientation } : item) }))}>
                              <option value="horizontal">Horizontal</option><option value="vertical">Vertical</option>
                            </select>
                            <div className="partition-wall-coordinates">
                              <label>X<NumberField ariaLabel={`Wall ${index + 1} position X`} step="0.5" value={wall.x} onCommit={(next) => updateRoom(activeRoom.id, (room) => ({ ...room, partitionWalls: room.partitionWalls.map((item) => item.id === wall.id ? { ...item, x: next } : item) }))} /></label>
                              <label>Z<NumberField ariaLabel={`Wall ${index + 1} position Z`} step="0.5" value={wall.z} onCommit={(next) => updateRoom(activeRoom.id, (room) => ({ ...room, partitionWalls: room.partitionWalls.map((item) => item.id === wall.id ? { ...item, z: next } : item) }))} /></label>
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
