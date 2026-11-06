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
  EyeOff,
  Footprints,
  Grid2X2,
  Group,
  History,
  Info,
  Layers,
  Lightbulb,
  Lock,
  Minus,
  Move,
  Paintbrush,
  PanelLeft,
  Plus,
  Redo2,
  RotateCw,
  Ruler,
  Save,
  Settings2,
  Sparkles,
  Trash2,
  Undo2,
  Ungroup,
  Unlock,
  Upload,
} from "lucide-react";
import ElementThumbnail from "@/components/element-thumbnail";
import FrameThumbnail from "@/components/frame-thumbnail";
import GalleryScene, { parseArtworkDimensions } from "@/components/gallery-scene";
import LayersPanel, { type LayerArtwork, type LayerItemRef } from "@/components/layers-panel";
import ThemeToggle from "@/components/theme-toggle";
import type { Artwork, FrameConfig, FrameFinish, FrameGlass, FrameMaterial, FrameProfile, FrameVariant } from "@/lib/demo-data";
import { FRAME_FINISH_LABELS, FRAME_GLASS_LABELS, FRAME_MATERIAL_LABELS, FRAME_PRESETS, FRAME_PROFILE_LABELS, FRAME_VARIANTS, effectiveFrameConfig, encodeFrameConfig, isCustomFrame, parseFrameConfig, parseSavedFrameConfig } from "@/lib/demo-data";
import { createElement, ELEMENT_DEFAULTS, ELEMENT_PLANES, PLINTH_VARIANTS, WALL_TEXT_ALIGNS, WALL_TEXT_FONTS, WALL_TEXT_LAYOUTS, WALL_TEXT_SWATCHES, type ElementType, type RoomElement, type WallTextAlign, type WallTextFont, type WallTextLayout } from "@/lib/elements";
import { applyLayoutPreset, ceilingTextures, createGalleryRoom, floorTextures, floorTypes, lightTypes, parseGalleryRooms, roomLayouts, wallTextures, type GalleryRoom, type RoomLayout, type WallId } from "@/lib/rooms";

// The Elements palette: every placeable object. Each row shows a
// faithful thumbnail (components/element-thumbnail.tsx) and can be
// dragged straight into the 3D room, or clicked to add it.
const ELEMENT_PALETTE: { type: ElementType; label: string }[] = [
  { type: "partition", label: "Partition wall" },
  { type: "chair", label: "Chair" },
  { type: "sofa", label: "Teal sofa" },
  { type: "bench", label: "Long bench" },
  { type: "table", label: "Table" },
  { type: "door", label: "Door" },
  { type: "window", label: "Window" },
  { type: "wall-text", label: "Wall text" },
  { type: "plinth", label: "Plinth" },
  { type: "vitrine", label: "Display case" },
  { type: "track-light", label: "Track light" },
  { type: "shelf", label: "Display shelf" },
  { type: "desk", label: "Desk & chair" },
  { type: "curtain", label: "Sheer curtain" },
  { type: "column", label: "Column" },
  { type: "platform", label: "Platform · low stage" },
  { type: "stairs", label: "Stairs" },
  { type: "arch", label: "Arch · doorway" },
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
  onFocus,
  onBlur,
}: {
  value: number;
  onCommit: (next: number) => void;
  ariaLabel: string;
  step?: string;
  min?: number;
  onFocus?: () => void;
  onBlur?: () => void;
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
        onFocus?.();
      }}
      onBlur={() => {
        focusedRef.current = false;
        setText(String(value));
        onBlur?.();
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
  const [artworks, setArtworks] = useState<LayerArtwork[]>([]);
  const [rooms, setRooms] = useState<GalleryRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState("");
  const [walking, setWalking] = useState(false);
  const movementKeys = useRef(new Set<string>());
  const [selectedId, setSelectedId] = useState<string>();
  const [panelTab, setPanelTab] = useState<"artworks" | "elements" | "layers">("artworks");
  const [selectedElementId, setSelectedElementId] = useState<string>();
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  // 3D builder: 0.5 m floor grid (drags snap to 0.25 m while it is on),
  // measurement guides, and the stage-settings toggle (shows the room
  // settings panel — the same UI the inspector falls back to).
  const [showGrid, setShowGrid] = useState(false);
  const [showMeasure, setShowMeasure] = useState(false);
  const [showStageSettings, setShowStageSettings] = useState(false);
  // Phase 8: on small screens the left panel floats over the canvas
  // (see globals.css) — this collapses it so the canvas is fully
  // usable. Desktop is unaffected: the toggle button is hidden there
  // and the panel is always visible.
  const [mobilePanelOpen, setMobilePanelOpen] = useState(true);
  // Multi-selection: everything selected beyond the primary artwork /
  // element (Shift/Ctrl-click in 3D or in the Layers panel).
  const [multiSelected, setMultiSelected] = useState<LayerItemRef[]>([]);
  // Autosave: 5 s after the last edit, unless a save is already running.
  const [autosaveState, setAutosaveState] = useState<"idle" | "saving" | "saved">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);
  const saveInFlightRef = useRef(false);
  const autosaveTimerRef = useRef<number | null>(null);
  // Version history: the last 10 saves, via /api/saved-work
  // (kind "exhibition-version"). Restoring replaces the editor state
  // and marks the exhibition unsaved.
  type SavedVersion = { id: string; title: string; createdAt: string; data: { exhibitionId?: string; title?: string; description?: string; rooms?: GalleryRoom[]; artworks?: LayerArtwork[]; savedAt?: string } };
  const [history, setHistory] = useState<SavedVersion[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmingRestoreId, setConfirmingRestoreId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [title, setTitle] = useState("Untitled exhibition");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("draft");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  // The exhibition failed to load (bad id, deleted, or server error): the
  // workspace below stays hidden and the banner above explains, with a
  // way back to the dashboard, instead of a native alert + redirect.
  const [loadFailed, setLoadFailed] = useState(false);
  const [editingTitle, setEditingTitle] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  // Editor guide panel (see the "Editor guide" link at the bottom of the
  // left panel): the shortcuts and workflow, in the page's own words.
  const [showGuide, setShowGuide] = useState(false);
  // Two-step inline confirm for removing a room (see removeRoom).
  const [confirmingRemoveRoom, setConfirmingRemoveRoom] = useState(false);
  // Frame Studio (artwork inspector): saved custom frame presets, the
  // customise panel, and compare mode.
  type SavedFramePreset = { id: string; title: string; data: Record<string, unknown>; artworkId: string | null; createdAt: string; updatedAt: string };
  const [framePresets, setFramePresets] = useState<SavedFramePreset[]>([]);
  const [framePresetsLoaded, setFramePresetsLoaded] = useState(false);
  const [framePresetsLoading, setFramePresetsLoading] = useState(false);
  const [framePresetsError, setFramePresetsError] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");
  const [presetMessage, setPresetMessage] = useState<string | null>(null);
  const [presetBusy, setPresetBusy] = useState(false);
  const [customisingFrame, setCustomisingFrame] = useState(false);
  const [comparingFrames, setComparingFrames] = useState(false);
  const [compareFrames, setCompareFrames] = useState<string[]>([]);
  const [renamingPresetId, setRenamingPresetId] = useState<string | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [confirmDeletePresetId, setConfirmDeletePresetId] = useState<string | null>(null);
  const uploadRef = useRef<HTMLInputElement>(null);
  // Undo history: full editor snapshots (artworks + rooms + title +
  // description), so Ctrl+Z covers artworks, elements and room settings
  // alike. One snapshot per discrete action — never per keystroke (see
  // beginEdit/endEdit below).
  type EditorSnapshot = { artworks: LayerArtwork[]; rooms: GalleryRoom[]; title: string; description: string };
  const historyRef = useRef<{ past: EditorSnapshot[]; future: EditorSnapshot[] }>({ past: [], future: [] });
  const [, setHistoryTick] = useState(0);
  const latestRef = useRef({ artworks, rooms, title, description });
  useEffect(() => {
    latestRef.current = { artworks, rooms, title, description };
  });

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
        historyRef.current = { past: [], future: [] };
        setSelectedId(result.exhibition.artworks.find((artwork: Artwork) => artwork.roomId === result.exhibition.rooms[0]?.id)?.id);
        setTitle(result.exhibition.title);
        setDescription(result.exhibition.description);
        setSlug(result.exhibition.slug);
        setStatus(result.exhibition.status);
        setSaved(true);
        setMultiSelected([]);
        // Artwork layer state (hidden / locked / group) has no columns
        // in the artwork table, so it is not in the main save — it comes
        // back from the latest version snapshot, if one exists.
        void overlayLayerStateFromLatestVersion();
        void loadHistory();
      } catch (error) {
        console.error("Could not load exhibition.", error);
        if (!active) return;
        setSaveError(error instanceof Error ? error.message : "Could not load this exhibition.");
        setLoadFailed(true);
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
  const activeRoomDims = activeRoom ? roomLayouts[activeRoom.layout] : null;
  // Hidden items stay in the exhibition but are not rendered in 3D.
  const visibleArtworks = currentArtworks.filter((artwork) => !artwork.hidden);
  const sceneRooms = useMemo(
    () => rooms.map((room) => ({ ...room, elements: (room.elements ?? []).filter((element) => !element.hidden) })),
    [rooms],
  );
  const sceneRoom = activeRoom ? sceneRooms.find((room) => room.id === activeRoom.id) ?? activeRoom : undefined;

  function snapshot() {
    const current = latestRef.current;
    historyRef.current = {
      past: [...historyRef.current.past, { artworks: current.artworks, rooms: current.rooms, title: current.title, description: current.description }].slice(-50),
      future: [],
    };
    setHistoryTick((tick) => tick + 1);
  }

  function applySnapshot(next: EditorSnapshot) {
    setArtworks(next.artworks);
    setRooms(next.rooms);
    setTitle(next.title);
    setDescription(next.description);
    setSaved(false);
  }

  function undo() {
    const history = historyRef.current;
    const previous = history.past[history.past.length - 1];
    if (!previous) return;
    const current = latestRef.current;
    historyRef.current = {
      past: history.past.slice(0, -1),
      future: [{ artworks: current.artworks, rooms: current.rooms, title: current.title, description: current.description }, ...history.future],
    };
    applySnapshot(previous);
    setHistoryTick((tick) => tick + 1);
  }

  function redo() {
    const history = historyRef.current;
    const next = history.future[0];
    if (!next) return;
    const current = latestRef.current;
    historyRef.current = {
      past: [...history.past, { artworks: current.artworks, rooms: current.rooms, title: current.title, description: current.description }],
      future: history.future.slice(1),
    };
    applySnapshot(next);
    setHistoryTick((tick) => tick + 1);
  }

  // One undo step per discrete edit: a typing session (focus to blur), a
  // slider drag (pointer down to up) or a 3D drag snapshots once at the
  // start, and the changes inside it never snapshot again.
  const editSessionRef = useRef(false);
  function beginEdit() {
    if (editSessionRef.current) return;
    snapshot();
    editSessionRef.current = true;
  }
  function endEdit() {
    editSessionRef.current = false;
  }
  // Spread onto text inputs, selects and sliders: focus starts one undo
  // step, blur ends it. Sliders also get onPointerDown/Up.
  const editSessionProps = { onFocus: beginEdit, onBlur: endEdit } as const;

  // Which walls an artwork hangs on, from its position (within 0.4 m of
  // the wall plane and inside its span). Near a corner several walls can
  // match at once; the caller prefers the wall the artwork was already
  // on, so sliding along one wall never flips it to the next.
  function wallsForArtwork(artwork: Artwork, room: GalleryRoom): { key: string; rotation: number }[] {
    const { width, depth } = roomLayouts[room.layout];
    const [x, , z] = artwork.position;
    const inset = 0.28;
    const found: { key: string; rotation: number }[] = [];
    // Partition walls first: they stand inside the room, so an artwork
    // can be near both a partition and a room wall at once.
    for (const wall of room.partitionWalls) {
      if (wall.orientation === "horizontal") {
        if (Math.abs(z - wall.z) > 0.45 || Math.abs(x - wall.x) > wall.length / 2 + 0.3) continue;
        found.push({ key: `partition:${wall.id}`, rotation: z >= wall.z ? 0 : Math.PI });
      } else {
        if (Math.abs(x - wall.x) > 0.45 || Math.abs(z - wall.z) > wall.length / 2 + 0.3) continue;
        found.push({ key: `partition:${wall.id}`, rotation: x >= wall.x ? Math.PI / 2 : -Math.PI / 2 });
      }
    }
    if (Math.abs(z - (-depth / 2 + inset)) < 0.4 && Math.abs(x) <= width / 2) found.push({ key: "back", rotation: 0 });
    if (Math.abs(z - (depth / 2 - inset)) < 0.4 && Math.abs(x) <= width / 2) found.push({ key: "front", rotation: Math.PI });
    if (Math.abs(x - (-width / 2 + inset)) < 0.4 && Math.abs(z) <= depth / 2) found.push({ key: "left", rotation: Math.PI / 2 });
    if (Math.abs(x - (width / 2 - inset)) < 0.4 && Math.abs(z) <= depth / 2) found.push({ key: "right", rotation: -Math.PI / 2 });
    return found;
  }

  function updateArtwork(id: string, update: (artwork: Artwork) => Artwork) {
    setArtworks((current) => current.map((artwork) => {
      if (artwork.id !== id) return artwork;
      const next = update(artwork);
      // Auto-rotate: when the artwork moves onto a different wall, turn
      // it to face that wall. A move along the same wall keeps its
      // rotation, so a deliberate tilt is never reset.
      const moved = next.position[0] !== artwork.position[0] || next.position[1] !== artwork.position[1] || next.position[2] !== artwork.position[2];
      if (moved && activeRoom && artwork.roomId === activeRoom.id) {
        const before = wallsForArtwork(artwork, activeRoom);
        const after = wallsForArtwork(next, activeRoom);
        const beforeKey = before[0]?.key;
        const match = after.find((wall) => wall.key === beforeKey) ?? after[0];
        if (match && beforeKey !== match.key) {
          return { ...next, rotation: match.rotation };
        }
      }
      return next;
    }));
    setSaved(false);
  }

  // The full selection: the primary artwork / element plus everything
  // added with Shift/Ctrl-click. The inspector shows the primary item;
  // Delete, Group and dragging act on the whole selection.
  const selectionRefs: LayerItemRef[] = useMemo(() => {
    const primary: LayerItemRef | null = selectedId
      ? { kind: "artwork", id: selectedId }
      : selectedElementId
        ? { kind: "element", id: selectedElementId }
        : null;
    return primary ? [primary, ...multiSelected] : [...multiSelected];
  }, [selectedId, selectedElementId, multiSelected]);
  const selectionRef = useRef(selectionRefs);
  useEffect(() => { selectionRef.current = selectionRefs; });

  // Selection is exclusive unless Shift/Ctrl/Cmd is held: picking an
  // artwork clears any element or wall, and vice versa, so the inspector
  // always shows one thing. An additive click toggles one item in or out
  // of the multi-selection. Picking a grouped item selects its whole
  // group, so the group moves together.
  function toggleSelectionRef(ref: LayerItemRef) {
    if (selectedId === ref.id || selectedElementId === ref.id) {
      // Removing the primary item promotes the first extra item.
      const [next, ...rest] = multiSelected;
      if (next) {
        if (next.kind === "artwork") {
          setSelectedId(next.id);
          setSelectedElementId(undefined);
        } else {
          setSelectedElementId(next.id);
          setSelectedId(undefined);
        }
        setMultiSelected(rest);
      } else {
        setSelectedId(undefined);
        setSelectedElementId(undefined);
      }
      return;
    }
    if (multiSelected.some((item) => item.kind === ref.kind && item.id === ref.id)) {
      setMultiSelected((current) => current.filter((item) => !(item.kind === ref.kind && item.id === ref.id)));
      return;
    }
    if (!selectedId && !selectedElementId) {
      if (ref.kind === "artwork") setSelectedId(ref.id);
      else setSelectedElementId(ref.id);
      return;
    }
    setMultiSelected((current) => [...current, ref]);
  }

  function groupMembers(groupId: string, except: LayerItemRef): LayerItemRef[] {
    const members: LayerItemRef[] = [];
    for (const artwork of artworks) {
      if (artwork.groupId === groupId && artwork.id !== except.id) members.push({ kind: "artwork", id: artwork.id });
    }
    for (const room of rooms) {
      for (const element of room.elements) {
        if (element.groupId === groupId && element.id !== except.id) members.push({ kind: "element", id: element.id });
      }
    }
    return members;
  }

  function groupIdOfRef(ref: LayerItemRef): string | undefined {
    if (ref.kind === "artwork") return artworks.find((item) => item.id === ref.id)?.groupId;
    return rooms.flatMap((room) => room.elements).find((item) => item.id === ref.id)?.groupId;
  }

  function selectArtwork(id: string | undefined, additive = false) {
    if (id === undefined) {
      setSelectedId(undefined);
      setMultiSelected([]);
      return;
    }
    const artwork = artworks.find((item) => item.id === id);
    if (artwork && artwork.roomId !== activeRoomId) setActiveRoomId(artwork.roomId);
    if (additive) {
      toggleSelectionRef({ kind: "artwork", id });
      return;
    }
    setSelectedId(id);
    setSelectedElementId(undefined);
    setSelectedWallId(null);
    setShowStageSettings(false);
    setMultiSelected(artwork?.groupId ? groupMembers(artwork.groupId, { kind: "artwork", id }) : []);
  }

  function selectElement(id: string | undefined, additive = false) {
    if (id === undefined) {
      setSelectedElementId(undefined);
      setMultiSelected([]);
      return;
    }
    const element = rooms.flatMap((room) => room.elements).find((item) => item.id === id);
    const owner = rooms.find((room) => room.elements.some((item) => item.id === id));
    if (owner && owner.id !== activeRoomId) setActiveRoomId(owner.id);
    if (additive) {
      toggleSelectionRef({ kind: "element", id });
      return;
    }
    setSelectedElementId(id);
    setSelectedId(undefined);
    setSelectedWallId(null);
    setShowStageSettings(false);
    setMultiSelected(element?.groupId ? groupMembers(element.groupId, { kind: "element", id }) : []);
  }

  function selectWall(id: string | null) {
    setSelectedWallId(id);
    setSelectedId(undefined);
    setSelectedElementId(undefined);
    setMultiSelected([]);
    setShowStageSettings(false);
  }

  function clearSelection() {
    setSelectedId(undefined);
    setSelectedElementId(undefined);
    setSelectedWallId(null);
    setMultiSelected([]);
  }

  // The Layers panel selects by ref and switches to the item's room.
  function selectLayerItem(ref: LayerItemRef, additive: boolean) {
    if (ref.kind === "artwork") selectArtwork(ref.id, additive);
    else selectElement(ref.id, additive);
  }

  function toggleHidden(ref: LayerItemRef) {
    snapshot();
    if (ref.kind === "artwork") {
      setArtworks((current) => current.map((artwork) => (artwork.id === ref.id ? { ...artwork, hidden: !artwork.hidden } : artwork)));
    } else {
      const element = rooms.flatMap((room) => room.elements).find((item) => item.id === ref.id);
      if (element) updateElement(ref.id, { hidden: !element.hidden });
    }
    setSaved(false);
  }

  function toggleLocked(ref: LayerItemRef) {
    snapshot();
    if (ref.kind === "artwork") {
      setArtworks((current) => current.map((artwork) => (artwork.id === ref.id ? { ...artwork, locked: !artwork.locked } : artwork)));
    } else {
      const element = rooms.flatMap((room) => room.elements).find((item) => item.id === ref.id);
      if (element) updateElement(ref.id, { locked: !element.locked });
    }
    setSaved(false);
  }

  // Delete removes the whole selection — artworks and elements alike.
  function deleteSelection() {
    const refs = selectionRefs;
    if (refs.length === 0) return;
    snapshot();
    const artworkIds = new Set(refs.filter((ref) => ref.kind === "artwork").map((ref) => ref.id));
    const elementIds = new Set(refs.filter((ref) => ref.kind === "element").map((ref) => ref.id));
    if (artworkIds.size > 0) setArtworks((current) => current.filter((artwork) => !artworkIds.has(artwork.id)));
    if (elementIds.size > 0) {
      setRooms((current) => current.map((room) => ({ ...room, elements: room.elements.filter((element) => !elementIds.has(element.id)) })));
    }
    clearSelection();
    setSaved(false);
  }

  function groupSelection() {
    const refs = selectionRefs;
    if (refs.length < 2) return;
    snapshot();
    const groupId = crypto.randomUUID();
    const artworkIds = new Set(refs.filter((ref) => ref.kind === "artwork").map((ref) => ref.id));
    const elementIds = new Set(refs.filter((ref) => ref.kind === "element").map((ref) => ref.id));
    if (artworkIds.size > 0) setArtworks((current) => current.map((artwork) => (artworkIds.has(artwork.id) ? { ...artwork, groupId } : artwork)));
    if (elementIds.size > 0) {
      setRooms((current) => current.map((room) => ({ ...room, elements: room.elements.map((element) => (elementIds.has(element.id) ? { ...element, groupId } : element)) })));
    }
    setSaved(false);
  }

  function ungroupSelection() {
    const groupIds = new Set(selectionRefs.map((ref) => groupIdOfRef(ref)).filter((id): id is string => Boolean(id)));
    if (groupIds.size === 0) return;
    snapshot();
    setArtworks((current) => current.map((artwork) => (artwork.groupId && groupIds.has(artwork.groupId) ? { ...artwork, groupId: undefined } : artwork)));
    setRooms((current) => current.map((room) => ({
      ...room,
      elements: room.elements.map((element) => (element.groupId && groupIds.has(element.groupId) ? { ...element, groupId: undefined } : element)),
    })));
    setSaved(false);
  }

  // Grid snapping: while the grid is on, dragged positions snap to
  // 0.25 m steps (the grid itself is drawn every 0.5 m).
  function snap025(value: number) {
    return Math.round(value / 0.25) * 0.25;
  }
  function snapIfGrid(value: number) {
    return showGrid ? snap025(value) : value;
  }

  // The 3D scene's update path for artwork drags: locked artworks do not
  // move, the dragged artwork snaps to the grid when it is on, and the
  // rest of the selection — plus every other member of the dragged
  // artwork's group — follows by the same delta. The dragged artwork
  // keeps its wall auto-rotate (same rule as updateArtwork).
  function handleSceneArtworkUpdate(id: string, patch: { position?: [number, number, number]; scale?: number }) {
    const selectedArtworkIds = new Set(selectionRef.current.filter((ref) => ref.kind === "artwork").map((ref) => ref.id));
    setArtworks((current) => {
      const dragged = current.find((artwork) => artwork.id === id);
      if (!dragged || dragged.locked) return current;
      if (patch.scale !== undefined) {
        return current.map((artwork) => (artwork.id === id ? { ...artwork, scale: patch.scale as number } : artwork));
      }
      if (!patch.position) return current;
      const target: [number, number, number] = [snapIfGrid(patch.position[0]), snapIfGrid(patch.position[1]), snapIfGrid(patch.position[2])];
      const delta: [number, number, number] = [target[0] - dragged.position[0], target[1] - dragged.position[1], target[2] - dragged.position[2]];
      return current.map((artwork) => {
        if (artwork.id === id) {
          let next: LayerArtwork = { ...artwork, position: target };
          if (activeRoom && artwork.roomId === activeRoom.id) {
            const before = wallsForArtwork(artwork, activeRoom);
            const after = wallsForArtwork(next, activeRoom);
            const beforeKey = before[0]?.key;
            const match = after.find((wall) => wall.key === beforeKey) ?? after[0];
            if (match && beforeKey !== match.key) next = { ...next, rotation: match.rotation };
          }
          return next;
        }
        const follows = artwork.roomId === dragged.roomId
          && (selectedArtworkIds.has(artwork.id) || (dragged.groupId !== undefined && artwork.groupId === dragged.groupId));
        if (!follows || artwork.locked) return artwork;
        return {
          ...artwork,
          position: [snapIfGrid(artwork.position[0] + delta[0]), snapIfGrid(artwork.position[1] + delta[1]), snapIfGrid(artwork.position[2] + delta[2])],
        };
      });
    });
    setSaved(false);
  }

  // Same rules for element drags: locked elements do not move, the
  // dragged element snaps when the grid is on, the selection and the
  // group follow by the same delta (within the same room).
  function handleSceneElementUpdate(id: string, patch: { x?: number; y?: number; z?: number; scale?: number }) {
    const selectedElementIds = new Set(selectionRef.current.filter((ref) => ref.kind === "element").map((ref) => ref.id));
    setRooms((currentRooms) => {
      const owner = currentRooms.find((room) => room.elements.some((element) => element.id === id));
      if (!owner) return currentRooms;
      const dragged = owner.elements.find((element) => element.id === id);
      if (!dragged || dragged.locked) return currentRooms;
      if (patch.scale !== undefined) {
        return currentRooms.map((room) => (room.id === owner.id
          ? { ...room, elements: room.elements.map((element) => (element.id === id ? { ...element, scale: patch.scale as number } : element)) }
          : room));
      }
      if (patch.x === undefined && patch.y === undefined && patch.z === undefined) return currentRooms;
      const target = { x: snapIfGrid(patch.x ?? dragged.x), y: snapIfGrid(patch.y ?? dragged.y), z: snapIfGrid(patch.z ?? dragged.z) };
      const delta = { x: target.x - dragged.x, y: target.y - dragged.y, z: target.z - dragged.z };
      return currentRooms.map((room) => (room.id === owner.id
        ? {
            ...room,
            elements: room.elements.map((element) => {
              if (element.id === id) return { ...element, ...target };
              const follows = selectedElementIds.has(element.id)
                || (dragged.groupId !== undefined && element.groupId === dragged.groupId);
              if (!follows || element.locked) return element;
              return { ...element, x: snapIfGrid(element.x + delta.x), y: snapIfGrid(element.y + delta.y), z: snapIfGrid(element.z + delta.z) };
            }),
          }
        : room));
    });
    setSaved(false);
  }

  // --- Frame Studio ---------------------------------------------------
  // The editable configuration behind the selected artwork's frame. A
  // "none" frame customises from plain wood, since there is no frame
  // to customise.
  const frameConfig: FrameConfig | null = selected
    ? (() => {
        const config = effectiveFrameConfig(selected.frame);
        return config.base === "none" ? { ...config, base: "wood" } : config;
      })()
    : null;

  function applyFrameValue(value: string, takeSnapshot = true) {
    if (!selected) return;
    if (takeSnapshot) snapshot();
    updateArtwork(selected.id, (artwork) => ({ ...artwork, frame: value }));
  }

  function applyFrameConfig(config: FrameConfig) {
    const encoded = encodeFrameConfig(config);
    if (encoded) applyFrameValue(encoded);
  }

  // A control change: merge the patch into the current configuration and
  // store it encoded on the artwork, so the 3D frame, the thumbnail and
  // the saved exhibition all see the same frame. Sliders snapshot once
  // on pointer down (beginEdit), so this never snapshots per tick.
  function updateFrameConfig(patch: Partial<FrameConfig>) {
    if (!selected || !frameConfig) return;
    const encoded = encodeFrameConfig({ ...frameConfig, ...patch });
    if (encoded) updateArtwork(selected.id, (artwork) => ({ ...artwork, frame: encoded }));
  }

  async function loadFramePresets() {
    setFramePresetsLoading(true);
    setFramePresetsError(null);
    try {
      const response = await fetch("/api/saved-work?kind=frame-preset");
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in to save frame presets." : "Could not load your frame presets.");
      const result = (await response.json()) as { saved: SavedFramePreset[] };
      setFramePresets(result.saved ?? []);
      setFramePresetsLoaded(true);
    } catch (error) {
      setFramePresetsError(error instanceof Error ? error.message : "Could not load your frame presets.");
    } finally {
      setFramePresetsLoading(false);
    }
  }

  // Load the saved presets once an artwork is selected — the Frame
  // Studio lives in the artwork inspector.
  const selectedArtworkId = selected?.id;
  useEffect(() => {
    if (selectedArtworkId && !framePresetsLoaded && !framePresetsLoading) void loadFramePresets();
  }, [selectedArtworkId, framePresetsLoaded, framePresetsLoading]);

  async function saveFramePreset() {
    if (!selected || !frameConfig) return;
    const name = presetName.trim();
    if (!name) {
      setPresetMessage("Give the preset a name first.");
      return;
    }
    setPresetBusy(true);
    setPresetMessage(null);
    try {
      const response = await fetch("/api/saved-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "frame-preset", title: name, data: frameConfig, artworkId: selected.id }),
      });
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in to save frame presets." : "Could not save this preset.");
      setPresetName("");
      setPresetMessage(`Saved “${name}”.`);
      setFramePresetsLoaded(false);
      await loadFramePresets();
    } catch (error) {
      setPresetMessage(error instanceof Error ? error.message : "Could not save this preset.");
    } finally {
      setPresetBusy(false);
    }
  }

  async function renameFramePreset(id: string) {
    const title = renameDraft.trim();
    if (!title) {
      setPresetMessage("Give the preset a name first.");
      return;
    }
    setPresetBusy(true);
    try {
      const response = await fetch("/api/saved-work", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title }),
      });
      if (!response.ok) throw new Error("Could not rename this preset.");
      setRenamingPresetId(null);
      await loadFramePresets();
    } catch (error) {
      setPresetMessage(error instanceof Error ? error.message : "Could not rename this preset.");
    } finally {
      setPresetBusy(false);
    }
  }

  async function deleteFramePreset(id: string) {
    setPresetBusy(true);
    try {
      const response = await fetch(`/api/saved-work?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete this preset.");
      setConfirmDeletePresetId(null);
      await loadFramePresets();
    } catch (error) {
      setPresetMessage(error instanceof Error ? error.message : "Could not delete this preset.");
    } finally {
      setPresetBusy(false);
    }
  }

  function toggleCompareFrame(value: string) {
    setCompareFrames((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : current.length >= 4 ? current : [...current, value],
    );
  }

  function compareFrameLabel(value: string): string {
    const custom = parseFrameConfig(value);
    if (custom) return `${FRAME_VARIANTS[custom.base]?.label ?? custom.base} · custom`;
    return FRAME_VARIANTS[value as FrameVariant]?.label ?? value;
  }
  // --- /Frame Studio --------------------------------------------------

  const selectedElement = useMemo(
    // Elements live in every room, not just the active one: the inspector
    // follows the selected element wherever it is.
    () => rooms.flatMap((room) => room.elements).find((element) => element.id === selectedElementId),
    [rooms, selectedElementId],
  );
  const currentElements = activeRoom?.elements ?? [];

  function updateElement(id: string, patch: Partial<RoomElement>) {
    // The element may live in any room, not just the active one — update
    // the room that actually holds it.
    const owner = rooms.find((room) => room.elements.some((element) => element.id === id)) ?? activeRoom;
    if (!owner) return;
    updateRoom(owner.id, (room) => ({
      ...room,
      elements: room.elements.map((element) => (element.id === id ? { ...element, ...patch } : element)),
    }));
  }

  function addElement(type: ElementType) {
    if (!activeRoom) return;
    const number = currentElements.filter((element) => element.type === type).length;
    const element = createElement(type, roomLayouts[activeRoom.layout], number);
    snapshot();
    updateRoom(activeRoom.id, (room) => ({ ...room, elements: [...room.elements, element] }));
    selectElement(element.id);
  }

  // Drag and drop from the palette: the dropped element lands at the drop
  // point in the room (on the floor, or against the back wall for wall
  // pieces) and is selected right away. Click-to-add still works too.
  function dropElement(type: ElementType, point: { x: number; y: number; z: number }) {
    if (!activeRoom) return;
    const layout = roomLayouts[activeRoom.layout];
    const number = currentElements.filter((element) => element.type === type).length;
    const element = createElement(type, layout, number);
    const plane = ELEMENT_PLANES[type];
    const y = plane === "floor"
      ? 0
      : plane === "ceiling"
        ? Math.max(2.5, layout.height - 0.4)
        : type === "window" || type === "wall-text" || type === "shelf"
          ? Math.min(3.2, Math.max(1.0, point.y))
          : 0;
    snapshot();
    updateRoom(activeRoom.id, (room) => ({
      ...room,
      elements: [...room.elements, { ...element, x: Math.round(point.x * 100) / 100, y, z: Math.round(point.z * 100) / 100 }],
    }));
    selectElement(element.id);
  }

  // Delete works from the inspector, from the Elements list row, and from
  // the keyboard — always in the room that actually holds the element,
  // and it persists with the next save like every other edit.
  function removeElementById(id: string) {
    const owner = rooms.find((room) => room.elements.some((element) => element.id === id));
    if (!owner) return;
    snapshot();
    updateRoom(owner.id, (room) => ({
      ...room,
      elements: room.elements.filter((element) => element.id !== id),
    }));
    setSelectedElementId((current) => (current === id ? undefined : current));
  }

  function removeElement() {
    if (!selectedElement) return;
    removeElementById(selectedElement.id);
  }

  function duplicateElement() {
    if (!selectedElement) return;
    const owner = rooms.find((room) => room.elements.some((element) => element.id === selectedElement.id)) ?? activeRoom;
    if (!owner) return;
    snapshot();
    const copy: RoomElement = {
      ...selectedElement,
      id: crypto.randomUUID(),
      name: `${selectedElement.name} copy`.slice(0, 60),
      x: Math.min(selectedElement.x + 1.5, roomLayouts[owner.layout].width / 2 - 0.5),
      // A copy starts ungrouped, visible and unlocked.
      hidden: false,
      locked: false,
      groupId: undefined,
    };
    updateRoom(owner.id, (room) => ({ ...room, elements: [...room.elements, copy] }));
    selectElement(copy.id);
  }

  // Delete key removes the whole selection (artworks and elements) —
  // the same delete the inspector button does, without reaching for the
  // mouse. Never fires while typing in a field, and never while walking.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      if (walking) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (selectionRefs.length > 0) {
        event.preventDefault();
        deleteSelection();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectionRefs, walking]);

  // Ctrl+Z / Cmd+Z undoes one real action (artworks, elements, room
  // settings); Ctrl+Shift+Z / Ctrl+Y redoes it. Never fires while typing
  // in a field, so the browser's own text undo keeps working there, and
  // never while walking.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (walking) return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (!event.ctrlKey && !event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key === "z" && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === "z" && event.shiftKey) || key === "y") {
        event.preventDefault();
        redo();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
    // undo/redo read state through refs, so they stay correct.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walking]);

  // Measurement readouts for the inspector: the selected artwork's
  // centre height and its distances to the neighbours on the same wall,
  // centre to centre and edge to edge, computed from the real positions.
  function neighbourMeasurements(artwork: LayerArtwork): { name: string; direction: string; centreCm: number; gapCm: number }[] {
    if (!activeRoom) return [];
    const key = wallsForArtwork(artwork, activeRoom)[0]?.key;
    if (!key) return [];
    const along = key === "left" || key === "right"
      ? (item: Artwork) => item.position[2]
      : (item: Artwork) => item.position[0];
    const sameWall = artworks
      .filter((item) => item.roomId === artwork.roomId && item.id !== artwork.id && wallsForArtwork(item, activeRoom)[0]?.key === key)
      .sort((a, b) => along(a) - along(b));
    const position = along(artwork);
    const widthOf = (item: Artwork) => {
      const parsed = parseArtworkDimensions(item.dimensions ?? "");
      return ((parsed?.widthCm ?? 182) / 100) * item.scale;
    };
    const neighbours: { name: string; direction: string; centreCm: number; gapCm: number }[] = [];
    const before = [...sameWall].reverse().find((item) => along(item) < position);
    const after = sameWall.find((item) => along(item) > position);
    for (const [other, direction] of [[before, "before it"], [after, "after it"]] as const) {
      if (!other) continue;
      const centreCm = Math.round(Math.abs(along(other) - position) * 100);
      const gapCm = Math.max(0, Math.round((centreCm - ((widthOf(artwork) + widthOf(other)) / 2) * 100)));
      neighbours.push({ name: other.title, direction, centreCm, gapCm });
    }
    return neighbours;
  }

  // The room switch disarms a pending room removal — the second click must
  // always remove the room the user is looking at.
  useEffect(() => { setConfirmingRemoveRoom(false); }, [activeRoomId]);

  // Painting one wall: the colour is stored as an override on the room
  // (or on the partition wall itself), never on the other walls.
  function paintWall(color: string) {
    if (!activeRoom || !selectedWallId) return;
    snapshot();
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
    snapshot();
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
    snapshot();
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

  async function saveExhibition(options?: { autosave?: boolean }) {
    const autosave = options?.autosave === true;
    setSaveError(null);
    if (!title.trim()) {
      if (!autosave) setSaveError("Give the exhibition a title before saving.");
      return false;
    }
    const incomplete = artworks
      .map((artwork, index) => ({ artwork, index, problems: artworkSaveProblems(artwork) }))
      .filter((item) => item.problems.length > 0);
    if (incomplete.length > 0) {
      if (autosave) return false;
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
    if (saveInFlightRef.current) return false;
    saveInFlightRef.current = true;
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
      setAutosaveState("saved");
      setLastSavedAt(new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }));
      // Every save — manual or autosave — keeps a version snapshot, so
      // the last 10 saves can be restored from the History panel.
      void recordVersionSnapshot();
      return true;
    } catch (error) {
      console.error("Could not save exhibition.", error);
      if (!autosave) setSaveError(error instanceof Error ? error.message : "Could not save this exhibition.");
      return false;
    } finally {
      saveInFlightRef.current = false;
      setBusy(false);
    }
  }

  // Autosave: 5 s after the last edit, debounced. Never while a save is
  // already in flight, and never while the exhibition is already saved.
  const savedRef = useRef(saved);
  useEffect(() => { savedRef.current = saved; });
  useEffect(() => {
    if (loading || loadFailed || saved) return;
    if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = window.setTimeout(() => { void runAutosave(); }, 5000);
    return () => {
      if (autosaveTimerRef.current) window.clearTimeout(autosaveTimerRef.current);
    };
  }, [artworks, rooms, title, description, saved, loading, loadFailed]);

  async function runAutosave() {
    if (saveInFlightRef.current || savedRef.current || loading || loadFailed) return;
    setAutosaveState("saving");
    const ok = await saveExhibition({ autosave: true });
    if (!ok) {
      // Validation failed (e.g. an artwork still misses a title): stay
      // unsaved and quiet — the manual Save button explains the problem.
      setAutosaveState("idle");
    }
  }

  // --- Version history (light) ----------------------------------------
  // Snapshots live in /api/saved-work as kind "exhibition-version", one
  // per save, titled with the exhibition title and the time. Only the
  // last 10 are kept; older ones are deleted when the list refreshes.
  async function recordVersionSnapshot() {
    const current = latestRef.current;
    const when = new Date();
    try {
      await fetch("/api/saved-work", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          kind: "exhibition-version",
          title: `${current.title} · ${when.toLocaleDateString([], { day: "2-digit", month: "short" })} ${when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`,
          data: {
            exhibitionId,
            title: current.title,
            description: current.description,
            rooms: current.rooms,
            artworks: current.artworks,
            savedAt: when.toISOString(),
          },
        }),
      });
      await loadHistory();
    } catch (error) {
      console.error("Could not record a version snapshot.", error);
    }
  }

  async function loadHistory() {
    try {
      const response = await fetch("/api/saved-work?kind=exhibition-version");
      if (!response.ok) return;
      const result = (await response.json()) as { saved: { id: string; title: string; createdAt: string; data: SavedVersion["data"] }[] };
      const versions = (result.saved ?? []).filter((row) => row.data?.exhibitionId === exhibitionId);
      setHistory(versions.slice(0, 10));
      const extra = versions.slice(10);
      if (extra.length > 0) {
        await Promise.all(extra.map((row) => fetch(`/api/saved-work?id=${encodeURIComponent(row.id)}`, { method: "DELETE" }).catch(() => undefined)));
      }
    } catch (error) {
      console.error("Could not load version history.", error);
    }
  }

  function restoreVersion(version: SavedVersion) {
    const data = version.data;
    if (!Array.isArray(data.rooms) || !Array.isArray(data.artworks)) return;
    snapshot();
    setTitle(data.title ?? title);
    setDescription(data.description ?? "");
    try {
      setRooms(parseGalleryRooms(JSON.stringify(data.rooms)));
    } catch {
      setRooms(data.rooms);
    }
    setArtworks(data.artworks);
    setSaved(false);
    setShowHistory(false);
    setConfirmingRestoreId(null);
    clearSelection();
  }

  // Artwork layer state has no columns in the artwork table, so the main
  // save drops it — the latest version snapshot carries it instead, and
  // it is overlaid here by id after the exhibition loads. Only fields
  // the snapshot actually has are applied, so an old snapshot never
  // clears a newer value.
  async function overlayLayerStateFromLatestVersion() {
    try {
      const response = await fetch("/api/saved-work?kind=exhibition-version");
      if (!response.ok) return;
      const result = (await response.json()) as { saved: { data: SavedVersion["data"] }[] };
      const latest = (result.saved ?? []).find((row) => row.data?.exhibitionId === exhibitionId);
      if (!latest) return;
      const layerById = new Map<string, { hidden?: boolean; locked?: boolean; groupId?: string }>();
      const collect = (id: string, hidden?: boolean, locked?: boolean, groupId?: string) => {
        const layer: { hidden?: boolean; locked?: boolean; groupId?: string } = {};
        if (hidden !== undefined) layer.hidden = hidden;
        if (locked !== undefined) layer.locked = locked;
        if (groupId !== undefined) layer.groupId = groupId;
        if (Object.keys(layer).length > 0) layerById.set(id, layer);
      };
      for (const artwork of latest.data.artworks ?? []) collect(artwork.id, artwork.hidden, artwork.locked, artwork.groupId);
      for (const room of latest.data.rooms ?? []) {
        for (const element of room.elements ?? []) collect(element.id, element.hidden, element.locked, element.groupId);
      }
      if (layerById.size === 0) return;
      setArtworks((current) => current.map((artwork) => {
        const layer = layerById.get(artwork.id);
        return layer ? { ...artwork, ...layer } : artwork;
      }));
      setRooms((current) => current.map((room) => ({
        ...room,
        elements: room.elements.map((element) => {
          const layer = layerById.get(element.id);
          return layer ? { ...element, ...layer } : element;
        }),
      })));
    } catch (error) {
      console.error("Could not restore layer state from the latest version.", error);
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
    snapshot();
    setArtworks((current) => [...current, artwork]);
    selectArtwork(artwork.id);
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
      setSaveError(error instanceof Error ? error.message : "Could not publish this exhibition.");
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
    snapshot();
    setArtworks((current) => current.filter((artwork) => artwork.id !== selected.id));
    setSelectedId(undefined);
    setMultiSelected([]);
    setSaved(false);
  }

  function duplicateArtwork() {
    if (!selected) return;
    const copy: LayerArtwork = {
      ...selected,
      id: crypto.randomUUID(),
      title: `${selected.title} copy`.slice(0, 120),
      position: [selected.position[0] + 1.5, selected.position[1], selected.position[2]],
      // A copy starts ungrouped, visible and unlocked.
      hidden: false,
      locked: false,
      groupId: undefined,
    };
    snapshot();
    setArtworks((current) => [...current, copy]);
    selectArtwork(copy.id);
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
    snapshot();
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
    snapshot();
    updateRoom(activeRoom.id, (room) => ({
      ...room,
      partitionWalls: room.partitionWalls.filter((wall) => wall.id !== wallId),
    }));
  }

  function addRoom() {
    if (rooms.length >= 12) return;
    const room = createGalleryRoom(rooms.length);
    snapshot();
    setRooms((current) => [...current, room]);
    setActiveRoomId(room.id);
    setSelectedId(undefined);
    setMultiSelected([]);
    setSaved(false);
  }

  function removeRoom() {
    if (!activeRoom || rooms.length <= 1) return;
    // Two-step inline confirm: the old window.confirm was swallowed by
    // automation and some mobile browsers, so the button silently did
    // nothing. First click arms it, second click removes the room; the
    // armed state clears when the room changes or after a few seconds.
    if (!confirmingRemoveRoom) {
      setConfirmingRemoveRoom(true);
      window.setTimeout(() => setConfirmingRemoveRoom(false), 10000);
      return;
    }
    setConfirmingRemoveRoom(false);
    const nextRooms = rooms.filter((room) => room.id !== activeRoom.id);
    const nextRoom = nextRooms[0];
    snapshot();
    setRooms(nextRooms);
    setArtworks((current) => current.filter((artwork) => artwork.roomId !== activeRoom.id));
    setActiveRoomId(nextRoom.id);
    setSelectedId(artworks.find((artwork) => artwork.roomId === nextRoom.id)?.id);
    setSelectedElementId(undefined);
    setSelectedWallId(null);
    setMultiSelected([]);
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
              {...editSessionProps}
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
            <div className="editor-title"><strong>{title}</strong><span><i /> {autosaveState === "saving" ? "Saving…" : saved ? `All changes saved ✓${lastSavedAt ? ` ${lastSavedAt}` : ""}` : "Unsaved changes"}</span></div>
          )}
          <button className="subtle-edit-button" aria-label={editingTitle ? "Save exhibition title" : "Edit exhibition title"} onClick={() => { if (editingTitle) confirmTitle(); else startEditingTitle(); }}>{editingTitle ? <Check size={14} /> : <Settings2 size={14} />}</button>
        </div>
        <div className="editor-top-actions">
          <ThemeToggle />
          <span className="saved-state"><span className={saved ? "save-indicator done" : "save-indicator"} />{autosaveState === "saving" ? "Saving…" : saved ? `Saved ✓${lastSavedAt ? ` ${lastSavedAt}` : ""}` : "Unsaved changes"}</span>
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

      {!loadFailed && (
      <div className="editor-workspace">
        <aside className={`editor-assets-panel${mobilePanelOpen ? "" : " assets-collapsed"}`}>
          <div className="panel-heading"><div><span className="panel-kicker">YOUR EXHIBITION</span><h1>Build your space</h1></div><button className="tiny-icon-button" aria-label="Editor help" aria-expanded={showGuide} onClick={() => setShowGuide((value) => !value)}><CircleHelp size={16} /></button></div>
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
            <button className={panelTab === "layers" ? "active" : ""} onClick={() => setPanelTab("layers")} title="Layers — rooms, artworks and elements with visibility and lock"><Layers size={12} /> Layers <span>{artworks.length + rooms.reduce((count, room) => count + room.elements.length, 0)}</span></button>
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
          ) : panelTab === "elements" ? (
            <>
              <div className="element-palette">
                {ELEMENT_PALETTE.map(({ type, label }) => (
                  <button key={type} className="element-palette-item" draggable onDragStart={(event) => { event.dataTransfer.setData("application/x-sanaa-element", type); event.dataTransfer.effectAllowed = "copy"; }} onClick={() => addElement(type)} title={`Add a ${label.toLowerCase()} to this room — or drag it into the room`}>
                    <ElementThumbnail type={type} size={26} />
                    <span>{label}</span>
                  </button>
                ))}
              </div>
              <div className="asset-list">
                {currentElements.map((element) => {
                  const palette = ELEMENT_PALETTE.find((item) => item.type === element.type);
                  return (
                    <div className="asset-row-wrap" key={element.id}>
                      <button className={`asset-row ${selectedElementId === element.id ? "selected" : ""}`} onClick={() => selectElement(element.id)}>
                        <span className="asset-thumb element-thumb"><ElementThumbnail type={element.type} size={26} /></span>
                        <span className="asset-copy"><strong>{element.name}</strong><small>{palette?.label ?? element.type}</small></span>
                        {selectedElementId === element.id && <span className="selected-mark"><Check size={12} /></span>}
                      </button>
                      <button type="button" className="asset-row-delete" aria-label={`Delete ${element.name}`} title={`Delete ${element.name}`} onClick={() => removeElementById(element.id)}><Trash2 size={13} /></button>
                    </div>
                  );
                })}
                {currentElements.length === 0 && (
                  <p className="element-empty-note">No elements yet. Add a partition wall, a bench, a plinth or a track light above — then drag it around the room.</p>
                )}
              </div>
            </>
          ) : (
            <LayersPanel
              rooms={rooms}
              artworks={artworks}
              activeRoomId={activeRoom?.id ?? ""}
              selected={selectionRefs}
              onActivateRoom={(id) => { setActiveRoomId(id); clearSelection(); }}
              onSelectItem={selectLayerItem}
              onToggleHidden={toggleHidden}
              onToggleLocked={toggleLocked}
            />
          )}
          <div className="left-panel-bottom">{showGuide ? (<div className="tip-card editor-guide" role="dialog" aria-label="Editor guide"><div className="tip-heading"><Lightbulb size={14} /> EDITOR GUIDE</div><ol><li><strong>Select</strong> — double-click an artwork, an element or a wall.</li><li><strong>Move</strong> — drag a selected item; drag an element from the palette straight into the room.</li><li><strong>Paint a wall</strong> — double-click a wall, then pick a colour.</li><li><strong>Undo / redo</strong> — Ctrl+Z / Ctrl+Shift+Z (Cmd on Mac).</li><li><strong>Walk</strong> — switch on the footprints button, then WASD to move and drag to look.</li><li><strong>Publish</strong> — Save, then Publish to share your exhibition.</li></ol><button type="button" className="editor-guide-close" onClick={() => setShowGuide(false)}>Close guide</button></div>) : (<div className="tip-card"><div className="tip-heading"><Lightbulb size={14} /> QUICK TIP</div><p>Double-click an artwork, an element or a wall to select it. Drag a selected item to move it, drag an element from the palette above straight into the room, and drag anywhere else to look around. Double-click a wall to paint it.</p></div>)}<button className="panel-help-link" aria-expanded={showGuide} onClick={() => setShowGuide((value) => !value)}><CircleHelp size={15} /> {showGuide ? "Hide editor guide" : "Editor guide"} <ArrowRight size={13} /></button></div>
        </aside>

        <section className="editor-stage">
          <div className="stage-toolbar">
            <div className="tool-group">
              {/* Phase 8: was a dead button (no onClick) — select/move is
                  the default drag mode, so this exits walk mode back
                  to it instead of doing nothing. */}
              <button className="tool-button active" aria-label="Select and move" aria-pressed={!walking} title="Select and move — drag artworks to move them" onClick={() => setWalking(false)}><Move size={16} /></button>
              <button className="tool-button" aria-label="Rotate selected artwork or element" onClick={() => {
                snapshot();
                if (selected) updateArtwork(selected.id, (artwork) => ({ ...artwork, rotation: artwork.rotation + Math.PI / 12 }));
                else if (selectedElement) updateElement(selectedElement.id, { rotation: selectedElement.rotation + Math.PI / 12 });
              }}><RotateCw size={16} /></button>
              <span className="tool-divider" />
              <button className="tool-button" aria-label="Undo" title="Undo (Ctrl+Z)" onClick={undo} disabled={historyRef.current.past.length === 0}><Undo2 size={16} /></button>
              <button className="tool-button" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={historyRef.current.future.length === 0}><Redo2 size={16} /></button>
              <span className="tool-divider" />
              <button className={`tool-button${walking ? " active" : ""}`} aria-label="Walk through the rooms" title="Walk through the rooms" onClick={() => setWalking((value) => !value)}><Footprints size={16} /></button>
            </div>
            <div className="stage-room-name"><span /> {activeRoom?.name.toUpperCase() ?? "ROOM"} <ChevronDown size={13} /></div>
            <div className="tool-group">
              {/* Phase 8: collapses the floating build panel on small
                  screens. Hidden on desktop via globals.css. */}
              <button className="tool-button mobile-panel-toggle" aria-label={mobilePanelOpen ? "Hide build panel" : "Show build panel"} aria-expanded={mobilePanelOpen} title={mobilePanelOpen ? "Hide build panel" : "Show build panel"} onClick={() => setMobilePanelOpen((value) => !value)}><PanelLeft size={16} /></button>
              <button className={`tool-button${showGrid ? " active" : ""}`} aria-label="Toggle grid" aria-pressed={showGrid} title="Toggle grid — 0.5 m grid; drags snap to 0.25 m" onClick={() => setShowGrid((value) => !value)}><Grid2X2 size={16} /></button>
              <button className={`tool-button${showMeasure ? " active" : ""}`} aria-label="Measure" aria-pressed={showMeasure} title="Measure — distances between neighbouring artworks" onClick={() => setShowMeasure((value) => !value)}><Ruler size={16} /></button>
              <button className={`tool-button${showStageSettings ? " active" : ""}`} aria-label="Toggle stage settings" aria-pressed={showStageSettings} title="Stage settings — room dimensions, walls, floor and ceiling" onClick={() => { const next = !showStageSettings; setShowStageSettings(next); if (next) clearSelection(); }}><Settings2 size={16} /></button>
              <button className={`tool-button${showHistory ? " active" : ""}`} aria-label="Version history" aria-pressed={showHistory} title="Version history — the last 10 saves" onClick={() => { setShowHistory((value) => !value); if (!showHistory) void loadHistory(); }}><History size={16} /></button>
              <button className="tool-button" aria-label="Fullscreen" onClick={() => document.querySelector(".scene-wrap")?.requestFullscreen()}><Expand size={16} /></button>
            </div>
          </div>
          {(selectionRefs.length > 1 || (selectionRefs.length === 1 && groupIdOfRef(selectionRefs[0]) !== undefined)) && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", borderBottom: "1px solid var(--border)", background: "var(--surface-3)", color: "var(--ink)", fontSize: "9px" }}>
              <span>{selectionRefs.length} item{selectionRefs.length === 1 ? "" : "s"} selected</span>
              <button type="button" disabled={selectionRefs.length < 2} title="Group the selected items so they move together" style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-2)", color: "var(--ink)", fontSize: "9px", cursor: selectionRefs.length < 2 ? "default" : "pointer", opacity: selectionRefs.length < 2 ? 0.45 : 1 }} onClick={groupSelection}><Group size={12} /> Group</button>
              <button type="button" disabled={!selectionRefs.some((ref) => groupIdOfRef(ref) !== undefined)} title="Ungroup the selected items" style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-2)", color: "var(--ink)", fontSize: "9px", cursor: "pointer" }} onClick={ungroupSelection}><Ungroup size={12} /> Ungroup</button>
              {selectionRefs.length > 1 && (
                <button type="button" title="Delete all selected items" style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-2)", color: "var(--danger, #b3261e)", fontSize: "9px", cursor: "pointer" }} onClick={deleteSelection}><Trash2 size={12} /> Delete</button>
              )}
              <span style={{ color: "var(--muted)" }}>Shift-click in 3D or in Layers adds to the selection; dragging moves all selected items together.</span>
            </div>
          )}
          <div className="scene-wrap">
            {activeRoom && sceneRoom && <GalleryScene artworks={visibleArtworks} selectedId={selectedId} onSelect={selectArtwork} className="gallery-canvas editor-canvas" room={sceneRoom} rooms={sceneRooms} interior walkMode={walking} walking={walking} input={walking ? movementKeys : undefined} activeRoomId={activeRoom.id} onRoomChange={(id) => { setActiveRoomId(id); clearSelection(); }} editable onArtworkUpdate={handleSceneArtworkUpdate} selectedElementId={selectedElementId} onSelectElement={selectElement} onElementUpdate={handleSceneElementUpdate} selectedWallId={selectedWallId} onWallSelect={(wallId) => selectWall(wallId)} onEditStart={beginEdit} onEditEnd={endEdit} onElementDrop={dropElement} showGrid={showGrid} showMeasure={showMeasure} multiSelectedIds={multiSelected.map((ref) => ref.id)} />}
            <div className="scene-caption"><span className="scene-caption-dot" /> {walking ? <>WALK MODE <span className="caption-divider">·</span> CLICK THE FLOOR OR AN ARTWORK TO WALK <span className="caption-divider">·</span> WASD TO MOVE <span className="caption-divider">·</span> DRAG TO LOOK</> : <>3D VIEW <span className="caption-divider">·</span> INSIDE THE ROOM <span className="caption-divider">·</span> DRAG AN ARTWORK TO MOVE IT <span className="caption-divider">·</span> DRAG ELSEWHERE TO LOOK AROUND <span className="caption-divider">·</span> SCROLL TO ZOOM</>}</div>
            <div className="scene-room-count"><span>{String(rooms.findIndex((room) => room.id === activeRoom?.id) + 1).padStart(2, "0")}</span><span className="room-count-line" /><span>{String(rooms.length).padStart(2, "0")}</span></div>
            <div className="stage-tools-float"><button onClick={() => moveArtwork(1, 0.15)} title="Move up" aria-label="Move selected artwork up"><Plus size={14} /></button><button onClick={() => moveArtwork(1, -0.15)} title="Move down" aria-label="Move selected artwork down"><Minus size={14} /></button><span /><button onClick={() => { if (!selected) return; snapshot(); updateArtwork(selected.id, (artwork) => ({ ...artwork, scale: Math.min(3, artwork.scale + 0.1) })); }} title="Increase scale" aria-label="Increase scale of selected artwork"><Expand size={14} /></button><button onClick={() => { if (!selected) return; snapshot(); updateArtwork(selected.id, (artwork) => ({ ...artwork, scale: Math.max(0.5, artwork.scale - 0.1) })); }} title="Decrease scale" aria-label="Decrease scale of selected artwork"><Minus size={14} /></button></div>
            <div className="stage-add-button"><button onClick={() => uploadRef.current?.click()}><Plus size={14} /> Add artwork</button></div>
          </div>
          <div className="editor-statusbar"><span><span className="status-online" /> Scene ready</span><span>{activeRoom ? roomLayouts[activeRoom.layout].label : "Gallery"} <span className="status-dot-separator">·</span> {rooms.length} rooms <span className="status-dot-separator">·</span> {currentArtworks.length} artworks{showGrid ? <><span className="status-dot-separator">·</span> Grid on — drags snap to 0.25 m</> : null}</span><span>{autosaveState === "saving" ? "Saving…" : saved ? `All changes saved ✓${lastSavedAt ? ` ${lastSavedAt}` : ""}` : "Unsaved changes"}</span></div>
        </section>

        <aside className="editor-properties-panel">
          <div className="properties-header"><div><span className="panel-kicker">INSPECTOR</span><h2>{selected ? "Artwork details" : selectedElement ? "Element details" : selectedWallId ? "Wall paint" : "Room settings"}</h2></div><button className="tiny-icon-button" aria-label="Version history" aria-expanded={showHistory} aria-pressed={showHistory} title="Version history — the last 10 saves" onClick={() => { setShowHistory((value) => !value); if (!showHistory) void loadHistory(); }}><Info size={15} /></button></div>
          {showHistory && (
            <div className="property-section">
              <label>VERSION HISTORY <span>LAST 10 SAVES</span></label>
              <p style={{ margin: "0 0 8px", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>
                Every save — manual or autosave — keeps a snapshot. Restoring replaces what is in the editor now and marks the exhibition unsaved.
              </p>
              {history.length === 0 && <p style={{ margin: 0, color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>No snapshots yet — save the exhibition to create one.</p>}
              {history.map((version) => (
                <div key={version.id} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "6px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)", fontSize: "9px" }}>{version.title}</span>
                  <span style={{ color: "var(--muted)", fontSize: "8px", whiteSpace: "nowrap" }}>{new Date(version.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                  <button
                    type="button"
                    style={{ padding: "3px 7px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-3)", color: confirmingRestoreId === version.id ? "var(--danger, #b3261e)" : "var(--ink)", fontSize: "8px", cursor: "pointer", whiteSpace: "nowrap" }}
                    onClick={() => {
                      if (confirmingRestoreId === version.id) restoreVersion(version);
                      else {
                        setConfirmingRestoreId(version.id);
                        window.setTimeout(() => setConfirmingRestoreId((current) => (current === version.id ? null : current)), 10000);
                      }
                    }}
                  >
                    {confirmingRestoreId === version.id ? "Click again to restore" : "Restore"}
                  </button>
                </div>
              ))}
              <div className="property-actions"><button type="button" onClick={() => setShowHistory(false)}>Close history</button></div>
            </div>
          )}
          {selected ? (
            <>
              <div className="selected-art-preview"><div className="selected-art-image" style={{ backgroundColor: selected.color }}>{selected.imageUrl ? <img src={selected.imageUrl} alt={selected.title} /> : <span style={{ backgroundColor: selected.accent }} />}</div><div><strong>{selected.title}</strong><small>{selected.year} · {selected.medium}</small></div></div>
              <div className="property-section"><label>POSITION <span>METERS</span></label><div className="coordinate-row">{(["X", "Y", "Z"] as const).map((axis, index) => <div key={axis}><span>{axis}</span><NumberField ariaLabel={`Position ${axis}`} step="0.1" value={selected.position[index]} {...editSessionProps} onCommit={(next) => updateArtwork(selected.id, (artwork) => { const position: [number, number, number] = [...artwork.position]; position[index] = next; return { ...artwork, position }; })} /></div>)}</div></div>
              {showMeasure && (
                <div className="property-section"><label>MEASUREMENTS <span>FROM REAL POSITIONS</span></label>
                  <p style={{ margin: "0 0 6px", color: "var(--ink)", fontSize: "9px" }}>Centre height: {Math.round(selected.position[1] * 100)} cm</p>
                  {neighbourMeasurements(selected).length === 0 ? (
                    <p style={{ margin: 0, color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>No neighbours on this wall — hang another artwork on the same wall to see distances.</p>
                  ) : (
                    neighbourMeasurements(selected).map((neighbour) => (
                      <p key={neighbour.name} style={{ margin: "0 0 6px", color: "var(--ink)", fontSize: "9px", lineHeight: 1.5 }}>
                        {neighbour.name} ({neighbour.direction}): {neighbour.centreCm} cm centre to centre · {neighbour.gapCm} cm gap
                      </p>
                    ))
                  )}
                </div>
              )}
              <div className="property-section"><label>DIMENSIONS <span>CM</span></label><div className="coordinate-row">{(["Width", "Height"] as const).map((label, index) => {
                const parsed = parseArtworkDimensions(selected.dimensions ?? "");
                const current = parsed ?? { widthCm: 182, heightCm: 212 };
                const value = index === 0 ? current.widthCm : current.heightCm;
                return (
                  <div key={label}><span>{label}</span><NumberField ariaLabel={`Artwork ${label.toLowerCase()} in centimetres`} step="1" min={1} value={value} {...editSessionProps} onCommit={(next) => {
                    const clamped = Math.max(1, Math.round(next));
                    const widthCm = index === 0 ? clamped : current.widthCm;
                    const heightCm = index === 1 ? clamped : current.heightCm;
                    updateArtwork(selected.id, (artwork) => ({ ...artwork, dimensions: `${widthCm} × ${heightCm} cm` }));
                  }} /></div>
                );
              })}</div></div>
              <div className="property-section"><label>SIZE <span>UNIFORM</span></label><div className="range-control"><input aria-label="Artwork scale" type="range" min="0.5" max="3" step="0.05" value={selected.scale} {...editSessionProps} onPointerDown={beginEdit} onPointerUp={endEdit} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, scale: Number(event.target.value) }))} /><span>{Math.round(selected.scale * 100)}%</span></div></div>
              <div className="property-section"><label>ROTATION</label><div className="rotate-control"><button aria-label="Rotate counterclockwise" onClick={() => { snapshot(); updateArtwork(selected.id, (artwork) => ({ ...artwork, rotation: artwork.rotation - Math.PI / 12 })); }}><RotateCw className="rotate-back" size={15} /></button><span>{Math.round((selected.rotation * 180) / Math.PI)}°</span><button aria-label="Rotate clockwise" onClick={() => { snapshot(); updateArtwork(selected.id, (artwork) => ({ ...artwork, rotation: artwork.rotation + Math.PI / 12 })); }}><RotateCw size={15} /></button></div></div>
              <div className="property-section"><label>ARTWORK LABEL</label><input className="full-input" {...editSessionProps} value={selected.title} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, title: event.target.value }))} /></div>
                  <div className="property-section"><label>ARTIST</label><input className="full-input" {...editSessionProps} value={selected.artist ?? ""} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, artist: event.target.value }))} /></div>
                  <div className="property-section"><label>YEAR</label><input className="full-input" {...editSessionProps} value={selected.year} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, year: event.target.value }))} /></div>
                  <div className="property-section"><label>MEDIUM</label><input className="full-input" {...editSessionProps} value={selected.medium} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, medium: event.target.value }))} /></div>
                  <div className="property-section"><label>DIMENSIONS</label><input className="full-input" {...editSessionProps} value={selected.dimensions} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, dimensions: event.target.value }))} /></div>
                  <div className="property-section"><label>DESCRIPTION</label><textarea className="full-input property-textarea" {...editSessionProps} value={selected.description} onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, description: event.target.value }))} /></div>
                  <div className="property-section"><label>FRAME</label><div className="frame-options">{(Object.keys(FRAME_VARIANTS) as FrameVariant[]).map((variant) => {
                    const isCurrent = !comparingFrames && (selected.frame ?? "wood") === variant;
                    const inCompare = compareFrames.includes(variant);
                    return (
                      <button
                        key={variant}
                        type="button"
                        className={`frame-option${isCurrent || inCompare ? " selected" : ""}`}
                        aria-pressed={isCurrent || inCompare}
                        title={comparingFrames ? (inCompare ? `Remove ${FRAME_VARIANTS[variant].label} from the comparison` : `Add ${FRAME_VARIANTS[variant].label} to the comparison (up to 4)`) : `Frame this artwork in ${FRAME_VARIANTS[variant].label}`}
                        onClick={() => {
                          if (comparingFrames) { toggleCompareFrame(variant); return; }
                          snapshot(); updateArtwork(selected.id, (artwork) => ({ ...artwork, frame: variant }));
                        }}
                      >
                        <FrameThumbnail variant={variant} />
                        {FRAME_VARIANTS[variant].label}
                        {inCompare && <span>· in compare</span>}
                      </button>
                    );
                  })}</div>
                  {isCustomFrame(selected.frame) && frameConfig && (
                    <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>
                      Custom frame — based on {FRAME_VARIANTS[frameConfig.base]?.label ?? frameConfig.base}.{" "}
                      <button type="button" style={{ padding: 0, border: 0, background: "none", color: "var(--accent)", fontSize: "8px", textDecoration: "underline", cursor: "pointer" }} onClick={() => applyFrameValue(frameConfig.base)}>Reset to the built-in style</button>
                    </p>
                  )}
                  {comparingFrames && (
                    <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>
                      Comparing — click frames in the grid above to add or remove them (up to 4), then apply one below.
                    </p>
                  )}
                  <div className="property-actions">
                    <button type="button" onClick={() => setCustomisingFrame((value) => !value)}>{customisingFrame ? "Hide frame controls" : "Customise this frame"}</button>
                    <button type="button" aria-pressed={comparingFrames} onClick={() => { setComparingFrames((value) => !value); if (comparingFrames) setCompareFrames([]); }}>{comparingFrames ? "Done comparing" : "Compare frames"}</button>
                  </div></div>
                  <div className="property-section"><label>FRAME PRESETS</label>
                    <div className="frame-options">{FRAME_PRESETS.map((preset) => (
                      <button key={preset.name} type="button" className="frame-option" title={preset.description} onClick={() => applyFrameConfig(preset.config)}>
                        <FrameThumbnail variant={preset.config.base} config={preset.config} />
                        {preset.name}
                      </button>
                    ))}</div>
                    {framePresetsLoading && <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "8px" }}>Loading your presets…</p>}
                    {framePresetsError && <p style={{ margin: "8px 0 0", color: "var(--danger, #b3261e)", fontSize: "8px", lineHeight: 1.6 }}>{framePresetsError} <button type="button" style={{ padding: 0, border: 0, background: "none", color: "var(--accent)", fontSize: "8px", textDecoration: "underline", cursor: "pointer" }} onClick={() => void loadFramePresets()}>Retry</button></p>}
                    {!framePresetsLoading && !framePresetsError && framePresets.length === 0 && (
                      <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>No saved presets yet — customise a frame below and save it with a name.</p>
                    )}
                    {!framePresetsLoading && !framePresetsError && framePresets.length > 0 && (
                      <div style={{ marginTop: "8px" }}>
                        {framePresets.map((preset) => {
                          const config = parseSavedFrameConfig(preset.data);
                          const encoded = encodeFrameConfig(config);
                          const inCompare = encoded !== null && compareFrames.includes(encoded);
                          return (
                            <div key={preset.id} style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                              {renamingPresetId === preset.id ? (
                                <div style={{ display: "flex", gap: "6px" }}>
                                  <input className="full-input" style={{ flex: 1 }} aria-label="Preset name" value={renameDraft} onChange={(event) => setRenameDraft(event.target.value.slice(0, 60))} onKeyDown={(event) => { if (event.key === "Enter") void renameFramePreset(preset.id); }} />
                                  <button type="button" style={{ padding: "0 8px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-3)", color: "var(--ink)", fontSize: "8px", cursor: "pointer" }} disabled={presetBusy} onClick={() => void renameFramePreset(preset.id)}>Save</button>
                                  <button type="button" style={{ padding: "0 8px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-3)", color: "var(--muted)", fontSize: "8px", cursor: "pointer" }} onClick={() => setRenamingPresetId(null)}>Cancel</button>
                                </div>
                              ) : (
                                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)", fontSize: "9px", fontWeight: 600 }}>{preset.title}</span>
                                  <button type="button" style={{ padding: "3px 7px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-3)", color: "var(--ink)", fontSize: "8px", cursor: "pointer" }} onClick={() => applyFrameConfig(config)}>Apply</button>
                                  <button type="button" aria-pressed={inCompare} style={{ padding: "3px 7px", border: `1px solid ${inCompare ? "var(--accent)" : "var(--border)"}`, borderRadius: "3px", background: "var(--surface-3)", color: "var(--muted)", fontSize: "8px", cursor: "pointer" }} onClick={() => { setComparingFrames(true); if (encoded) toggleCompareFrame(encoded); }}>{inCompare ? "In compare" : "Compare"}</button>
                                  <button type="button" style={{ padding: "3px 7px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-3)", color: "var(--muted)", fontSize: "8px", cursor: "pointer" }} onClick={() => { setRenamingPresetId(preset.id); setRenameDraft(preset.title); }}>Rename</button>
                                  <button type="button" style={{ padding: "3px 7px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-3)", color: "var(--danger, #b3261e)", fontSize: "8px", cursor: "pointer" }} onClick={() => { if (confirmDeletePresetId === preset.id) void deleteFramePreset(preset.id); else setConfirmDeletePresetId(preset.id); }}>{confirmDeletePresetId === preset.id ? "Click again to delete" : "Delete"}</button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {presetMessage && <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>{presetMessage}</p>}
                  </div>
                  {customisingFrame && frameConfig && (
                    <>
                      <div className="property-section"><label>OUTER BORDER WIDTH <span>{Math.round(frameConfig.width * 100)} CM</span></label><div className="range-control"><input aria-label="Frame outer border width in centimetres" type="range" min="0.02" max="0.25" step="0.005" value={frameConfig.width} {...editSessionProps} onPointerDown={beginEdit} onPointerUp={endEdit} onChange={(event) => updateFrameConfig({ width: Number(event.target.value) })} /><span>{Math.round(frameConfig.width * 100)} cm</span></div></div>
                      <div className="property-section"><label>DEPTH <span>{Math.round(frameConfig.depth * 100)} CM</span></label><div className="range-control"><input aria-label="Frame depth in centimetres" type="range" min="0.05" max="0.3" step="0.005" value={frameConfig.depth} {...editSessionProps} onPointerDown={beginEdit} onPointerUp={endEdit} onChange={(event) => updateFrameConfig({ depth: Number(event.target.value) })} /><span>{Math.round(frameConfig.depth * 100)} cm</span></div></div>
                      <div className="property-section"><label>MATERIAL</label><select className="full-input" aria-label="Frame material" {...editSessionProps} value={frameConfig.material} onChange={(event) => updateFrameConfig({ material: event.target.value as FrameMaterial })}>{(Object.keys(FRAME_MATERIAL_LABELS) as FrameMaterial[]).map((material) => <option key={material} value={material}>{FRAME_MATERIAL_LABELS[material]}</option>)}</select></div>
                      <div className="property-section"><label>COLOUR</label><div className="room-color-control"><input type="color" aria-label="Frame colour" {...editSessionProps} value={frameConfig.color} onChange={(event) => updateFrameConfig({ color: event.target.value })} /><span>{frameConfig.color}</span></div></div>
                      <div className="property-section"><label>FINISH</label><select className="full-input" aria-label="Frame finish" {...editSessionProps} value={frameConfig.finish} onChange={(event) => updateFrameConfig({ finish: event.target.value as FrameFinish })}>{(Object.keys(FRAME_FINISH_LABELS) as FrameFinish[]).map((finish) => <option key={finish} value={finish}>{FRAME_FINISH_LABELS[finish]}</option>)}</select></div>
                      <div className="property-section"><label>WOOD-GRAIN INTENSITY <span>{Math.round(frameConfig.grain * 100)}%</span></label><div className="range-control"><input aria-label="Wood-grain intensity" type="range" min="0" max="1" step="0.05" value={frameConfig.grain} disabled={frameConfig.material !== "wood"} {...editSessionProps} onPointerDown={beginEdit} onPointerUp={endEdit} onChange={(event) => updateFrameConfig({ grain: Number(event.target.value) })} /><span>{Math.round(frameConfig.grain * 100)}%</span></div>{frameConfig.material !== "wood" && <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: "8px" }}>Wood grain applies to wood frames.</p>}</div>
                      <div className="property-section"><label>EDGE PROFILE</label><select className="full-input" aria-label="Frame edge profile" {...editSessionProps} value={frameConfig.profile} onChange={(event) => updateFrameConfig({ profile: event.target.value as FrameProfile })}>{(Object.keys(FRAME_PROFILE_LABELS) as FrameProfile[]).map((profile) => <option key={profile} value={profile}>{FRAME_PROFILE_LABELS[profile]}</option>)}</select></div>
                      <div className="property-section"><label>INNER BORDER WIDTH <span>{Math.round(frameConfig.innerBorder * 1000)} MM</span></label><div className="range-control"><input aria-label="Inner border width in millimetres" type="range" min="0" max="0.03" step="0.001" value={frameConfig.innerBorder} {...editSessionProps} onPointerDown={beginEdit} onPointerUp={endEdit} onChange={(event) => updateFrameConfig({ innerBorder: Number(event.target.value) })} /><span>{Math.round(frameConfig.innerBorder * 1000)} mm</span></div></div>
                      <div className="property-section"><label>MATBOARD WIDTH <span>{Math.round(frameConfig.matWidth * 100)} CM</span></label><div className="range-control"><input aria-label="Matboard width in centimetres" type="range" min="0" max="0.3" step="0.005" value={frameConfig.matWidth} {...editSessionProps} onPointerDown={beginEdit} onPointerUp={endEdit} onChange={(event) => updateFrameConfig({ matWidth: Number(event.target.value) })} /><span>{Math.round(frameConfig.matWidth * 100)} cm</span></div></div>
                      <div className="property-section"><label>MATBOARD COLOUR</label><div className="room-color-control"><input type="color" aria-label="Matboard colour" {...editSessionProps} value={frameConfig.matColor} onChange={(event) => updateFrameConfig({ matColor: event.target.value })} /><span>{frameConfig.matColor}</span></div></div>
                      <div className="property-section"><label>GLASS</label><select className="full-input" aria-label="Glass type" {...editSessionProps} value={frameConfig.glass} onChange={(event) => updateFrameConfig({ glass: event.target.value as FrameGlass })}>{(Object.keys(FRAME_GLASS_LABELS) as FrameGlass[]).map((glass) => <option key={glass} value={glass}>{FRAME_GLASS_LABELS[glass]}</option>)}</select></div>
                      <div className="property-section"><label>FLOAT GAP <span>{Math.round(frameConfig.floatGap * 100)} CM</span></label><div className="range-control"><input aria-label="Float gap in centimetres" type="range" min="0" max="0.2" step="0.005" value={frameConfig.floatGap} {...editSessionProps} onPointerDown={beginEdit} onPointerUp={endEdit} onChange={(event) => updateFrameConfig({ floatGap: Number(event.target.value) })} /><span>{Math.round(frameConfig.floatGap * 100)} cm</span></div><p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: "8px" }}>How far the artwork floats inside the frame.</p></div>
                      <div className="property-section"><label>RECESS <span>{Math.round(frameConfig.recess * 100)} CM</span></label><div className="range-control"><input aria-label="Artwork recess in centimetres" type="range" min="0" max="0.15" step="0.005" value={frameConfig.recess} {...editSessionProps} onPointerDown={beginEdit} onPointerUp={endEdit} onChange={(event) => updateFrameConfig({ recess: Number(event.target.value) })} /><span>{Math.round(frameConfig.recess * 100)} cm</span></div><p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: "8px" }}>How far behind the front face the artwork sits.</p></div>
                      <div className="property-section"><label>SAVE AS PRESET</label><input className="full-input" aria-label="Preset name" value={presetName} onChange={(event) => setPresetName(event.target.value.slice(0, 60))} placeholder="Preset name, e.g. Warm walnut" /><div className="property-actions"><button type="button" disabled={presetBusy} onClick={() => void saveFramePreset()}>{presetBusy ? "Saving…" : "Save this frame as a preset"}</button></div>{presetMessage && <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>{presetMessage}</p>}</div>
                    </>
                  )}
                  {comparingFrames && (
                    <div className="property-section"><label>COMPARE FRAMES <span>{compareFrames.length}/4</span></label>
                      {compareFrames.length === 0 ? (
                        <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>No frames selected yet. Click frames in the grid above — or Compare on a saved preset — to add up to 4 here.</p>
                      ) : (
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: "8px", marginTop: "8px" }}>
                          {compareFrames.map((value) => {
                            const custom = parseFrameConfig(value);
                            const variant = custom ? custom.base : (value as FrameVariant);
                            return (
                              <div key={value} style={{ minWidth: 0, border: "1px solid var(--border)", borderRadius: "3px", padding: "6px", background: "var(--surface-3)" }}>
                                <FrameThumbnail variant={variant} config={custom} imageUrl={selected.imageUrl} artworkColor={selected.color} width={120} height={90} />
                                <div style={{ marginTop: "6px", color: "var(--ink)", fontSize: "8px", fontWeight: 600, lineHeight: 1.4 }}>{compareFrameLabel(value)}</div>
                                <div style={{ display: "flex", gap: "6px", marginTop: "6px" }}>
                                  <button type="button" style={{ flex: 1, padding: "4px 6px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-2)", color: "var(--ink)", fontSize: "8px", cursor: "pointer" }} onClick={() => applyFrameValue(value)}>Apply</button>
                                  <button type="button" aria-label={`Remove ${compareFrameLabel(value)} from the comparison`} style={{ padding: "4px 6px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-3)", color: "var(--muted)", fontSize: "8px", cursor: "pointer" }} onClick={() => toggleCompareFrame(value)}>Remove</button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}
                  <div className="property-actions"><button onClick={() => { if (!selected) return; snapshot(); updateArtwork(selected.id, (artwork) => ({ ...artwork, position: [0, 1.55, -5.72], rotation: 0, scale: 1 })); }}><Sparkles size={14} /> Fit to wall</button><button aria-label={selected.hidden ? "Show artwork in 3D" : "Hide artwork in 3D"} title={selected.hidden ? "Show in 3D" : "Hide in 3D"} onClick={() => toggleHidden({ kind: "artwork", id: selected.id })}>{selected.hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button><button aria-label={selected.locked ? "Unlock artwork" : "Lock artwork"} title={selected.locked ? "Unlock (allow dragging)" : "Lock (cannot be dragged)"} onClick={() => toggleLocked({ kind: "artwork", id: selected.id })}>{selected.locked ? <Lock size={14} /> : <Unlock size={14} />}</button><button aria-label="Duplicate artwork" onClick={duplicateArtwork}><Copy size={14} /></button><button className="delete-action" aria-label="Delete artwork" onClick={removeArtwork}><Trash2 size={14} /></button></div>
                </>
              ) : selectedElement ? (
                <>
                  <div className="selected-art-preview"><div className="selected-art-image element-preview-icon"><ElementThumbnail type={selectedElement.type} size={32} /></div><div><strong>{selectedElement.name}</strong><small>{ELEMENT_DEFAULTS[selectedElement.type].label}</small></div></div>
                  <div className="property-section"><label>NAME</label><input className="full-input" {...editSessionProps} value={selectedElement.name} onChange={(event) => updateElement(selectedElement.id, { name: event.target.value.slice(0, 60) })} /></div>
                  <div className="property-section"><label>POSITION <span>METERS</span></label><div className="coordinate-row">{(["X", "Y", "Z"] as const).map((axis, index) => {
                    const key = ["x", "y", "z"][index] as "x" | "y" | "z";
                    return (
                      <div key={axis}><span>{axis}</span><NumberField ariaLabel={`Element position ${axis}`} step="0.1" value={selectedElement[key]} {...editSessionProps} onCommit={(next) => updateElement(selectedElement.id, { [key]: next } as Partial<RoomElement>)} /></div>
                    );
                  })}</div></div>
                  <div className="property-section"><label>ROTATION</label><div className="rotate-control"><button aria-label="Rotate counterclockwise" onClick={() => { snapshot(); updateElement(selectedElement.id, { rotation: selectedElement.rotation - Math.PI / 12 }); }}><RotateCw className="rotate-back" size={15} /></button><span>{Math.round((selectedElement.rotation * 180) / Math.PI)}°</span><button aria-label="Rotate clockwise" onClick={() => { snapshot(); updateElement(selectedElement.id, { rotation: selectedElement.rotation + Math.PI / 12 }); }}><RotateCw size={15} /></button></div></div>
                  <div className="property-section"><label>SIZE <span>UNIFORM</span></label><div className="range-control"><input aria-label="Element scale" type="range" {...editSessionProps} onPointerDown={beginEdit} onPointerUp={endEdit} min="0.25" max="3" step="0.05" value={selectedElement.scale} onChange={(event) => updateElement(selectedElement.id, { scale: Number(event.target.value) })} /><span>{Math.round(selectedElement.scale * 100)}%</span></div></div>
                  {(selectedElement.type === "partition" || selectedElement.type === "shelf" || selectedElement.type === "track-light" || selectedElement.type === "wall-text" || selectedElement.type === "platform" || selectedElement.type === "stairs" || selectedElement.type === "arch") && (
                    <div className="property-section"><label>{selectedElement.type === "track-light" ? "RAIL LENGTH" : selectedElement.type === "wall-text" ? "TEXT WIDTH" : selectedElement.type === "platform" || selectedElement.type === "stairs" || selectedElement.type === "arch" ? "WIDTH" : "LENGTH"} <span>METERS</span></label><div className="range-control"><input aria-label="Element length in metres" type="range" {...editSessionProps} onPointerDown={beginEdit} onPointerUp={endEdit} min={selectedElement.type === "track-light" ? 1 : 0.5} max={selectedElement.type === "partition" || selectedElement.type === "wall-text" ? 12 : 6} step="0.5" value={selectedElement.length} onChange={(event) => updateElement(selectedElement.id, { length: Number(event.target.value) })} /><span>{selectedElement.length} m</span></div></div>
                  )}
                  {selectedElement.type === "plinth" && (
                    <div className="property-section"><label>HEIGHT</label><select className="full-input" {...editSessionProps} value={selectedElement.variant} onChange={(event) => updateElement(selectedElement.id, { variant: event.target.value })}>{PLINTH_VARIANTS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></div>
                  )}
                  {selectedElement.type === "wall-text" ? (
                    <>
                      <div className="property-section"><label>TITLE <span>BIG TEXT · ONE LINE PER ROW</span></label><textarea className="full-input property-textarea" {...editSessionProps} rows={3} value={selectedElement.title} onChange={(event) => updateElement(selectedElement.id, { title: event.target.value.slice(0, 120) })} placeholder={"PEOPLE\nMAKE THIS\nPLACE"} /></div>
                      <div className="property-section"><label>BODY TEXT</label><textarea className="full-input property-textarea" {...editSessionProps} value={selectedElement.body} onChange={(event) => updateElement(selectedElement.id, { body: event.target.value.slice(0, 600) })} /></div>
                      <div className="property-section"><label>TYPEFACE</label><select className="full-input" {...editSessionProps} value={selectedElement.font} onChange={(event) => updateElement(selectedElement.id, { font: event.target.value as WallTextFont })}>{(Object.keys(WALL_TEXT_FONTS) as WallTextFont[]).map((font) => <option key={font} value={font}>{WALL_TEXT_FONTS[font].label}</option>)}</select></div>
                      <div className="property-section"><label>LAYOUT</label><select className="full-input" {...editSessionProps} value={selectedElement.layout} onChange={(event) => updateElement(selectedElement.id, { layout: event.target.value as WallTextLayout })}>{(Object.keys(WALL_TEXT_LAYOUTS) as WallTextLayout[]).map((layout) => <option key={layout} value={layout}>{WALL_TEXT_LAYOUTS[layout]}</option>)}</select></div>
                      <div className="property-section"><label>ALIGNMENT</label><div className="frame-options">{(Object.keys(WALL_TEXT_ALIGNS) as WallTextAlign[]).map((align) => (
                        <button key={align} type="button" className={`frame-option${selectedElement.align === align ? " selected" : ""}`} aria-pressed={selectedElement.align === align} onClick={() => { snapshot(); updateElement(selectedElement.id, { align }); }}>{WALL_TEXT_ALIGNS[align]}</button>
                      ))}</div></div>
                      <div className="property-section"><label>TITLE SIZE</label><div className="range-control"><input aria-label="Wall text title size" type="range" {...editSessionProps} onPointerDown={beginEdit} onPointerUp={endEdit} min="0.08" max="1" step="0.01" value={selectedElement.fontSize} onChange={(event) => updateElement(selectedElement.id, { fontSize: Number(event.target.value) })} /><span>{Math.round(selectedElement.fontSize * 100)} cm</span></div></div>
                      <div className="property-section"><label>BODY SIZE</label><div className="range-control"><input aria-label="Wall text body size" type="range" {...editSessionProps} onPointerDown={beginEdit} onPointerUp={endEdit} min="0.04" max="0.3" step="0.01" value={selectedElement.bodySize} onChange={(event) => updateElement(selectedElement.id, { bodySize: Number(event.target.value) })} /><span>{Math.round(selectedElement.bodySize * 100)} cm</span></div></div>
                      <div className="property-section"><label>TITLE COLOUR</label><div className="room-color-control"><input type="color" aria-label="Wall text title colour" {...editSessionProps} value={selectedElement.textColor} onChange={(event) => updateElement(selectedElement.id, { textColor: event.target.value })} /><span>{selectedElement.textColor}</span></div><div className="wall-swatches">{WALL_TEXT_SWATCHES.map((swatch) => (
                        <button key={swatch} type="button" className={`wall-swatch${selectedElement.textColor.toLowerCase() === swatch ? " selected" : ""}`} style={{ backgroundColor: swatch }} aria-label={`Title colour ${swatch}`} onClick={() => { snapshot(); updateElement(selectedElement.id, { textColor: swatch }); }} />
                      ))}</div></div>
                      <div className="property-section"><label>BODY COLOUR</label><div className="room-color-control"><input type="color" aria-label="Wall text body colour" {...editSessionProps} value={selectedElement.bodyColor} onChange={(event) => updateElement(selectedElement.id, { bodyColor: event.target.value })} /><span>{selectedElement.bodyColor}</span></div></div>
                    </>
                  ) : selectedElement.type === "sofa" ? null : (
                    <div className="property-section"><label>{selectedElement.type === "track-light" ? "LIGHT COLOUR" : "COLOUR"}</label><div className="room-color-control"><input type="color" aria-label="Element colour" {...editSessionProps} value={selectedElement.color} onChange={(event) => updateElement(selectedElement.id, { color: event.target.value })} /><span>{selectedElement.color}</span></div></div>
                  )}
                  <div className="property-actions"><button aria-label={selectedElement.hidden ? "Show element in 3D" : "Hide element in 3D"} title={selectedElement.hidden ? "Show in 3D" : "Hide in 3D"} onClick={() => toggleHidden({ kind: "element", id: selectedElement.id })}>{selectedElement.hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button><button aria-label={selectedElement.locked ? "Unlock element" : "Lock element"} title={selectedElement.locked ? "Unlock (allow dragging)" : "Lock (cannot be dragged)"} onClick={() => toggleLocked({ kind: "element", id: selectedElement.id })}>{selectedElement.locked ? <Lock size={14} /> : <Unlock size={14} />}</button><button aria-label="Duplicate element" onClick={duplicateElement}><Copy size={14} /></button><button className="delete-action" aria-label="Delete element" onClick={removeElement}><Trash2 size={14} /></button></div>
                </>
              ) : selectedWallId ? (
                <>
                  <div className="selected-art-preview"><div className="selected-art-image element-preview-icon"><Paintbrush size={22} /></div><div><strong>{selectedWallLabel()}</strong><small>Paint this wall only</small></div></div>
                  <div className="property-section"><label>WALL COLOUR</label><div className="room-color-control"><input type="color" aria-label="Wall colour" {...editSessionProps} value={selectedWallColor()} onChange={(event) => paintWall(event.target.value)} /><span>{selectedWallColor()}</span></div></div>
                  <div className="property-section"><label>PRESETS</label><div className="wall-swatches">{WALL_SWATCHES.map((swatch) => (
                    <button key={swatch} type="button" className={`wall-swatch${selectedWallColor().toLowerCase() === swatch ? " selected" : ""}`} style={{ backgroundColor: swatch }} aria-label={`Paint wall ${swatch}`} onClick={() => paintWall(swatch)} />
                  ))}</div></div>
                  <div className="property-actions"><button onClick={resetWallPaint}><Sparkles size={14} /> Reset to room colour</button></div>
                  <p className="wall-paint-note">Only this wall changes colour. The other walls keep the room's colours.</p>
                </>
              ) : (
                <div className="room-properties">
                    <p>Shape this room and its walls.</p>
                    {activeRoomDims && (
                      <p style={{ margin: "0 0 4px", color: "var(--ink)", fontSize: "9px", lineHeight: 1.6 }}>
                        {activeRoomDims.width} × {activeRoomDims.depth} m · walls {activeRoomDims.height} m high · floor {Math.round(activeRoomDims.width * activeRoomDims.depth)} m²
                      </p>
                    )}
                    {activeRoom && <>
                      <div className="property-section"><label>ROOM NAME</label><input className="full-input" {...editSessionProps} value={activeRoom.name} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, name: event.target.value.slice(0, 60) }))} /></div>
                      <div className="property-section"><label>GALLERY</label><select className="full-input" {...editSessionProps} value={activeRoom.layout} onChange={(event) => updateRoom(activeRoom.id, (room) => applyLayoutPreset(room, event.target.value as RoomLayout))}>{Object.entries(roomLayouts).map(([layout, details]) => <option key={layout} value={layout}>{details.label} · {details.width} × {details.depth} m</option>)}</select></div>
                      <div className="property-section"><label>BACK WALL</label><div className="room-color-control"><input type="color" aria-label="Back wall colour" {...editSessionProps} value={activeRoom.wallColor} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, wallColor: event.target.value }))} /><span>{activeRoom.wallColor}</span></div></div>
                      <div className="property-section"><label>SIDE WALLS</label><div className="room-color-control"><input type="color" aria-label="Side walls colour" {...editSessionProps} value={activeRoom.sideWallColor} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, sideWallColor: event.target.value }))} /><span>{activeRoom.sideWallColor}</span></div></div>
                      <div className="property-section"><label>CEILING</label><div className="room-color-control"><input type="color" aria-label="Ceiling colour" {...editSessionProps} value={activeRoom.ceilingColor} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, ceilingColor: event.target.value }))} /><span>{activeRoom.ceilingColor}</span></div></div>
                      <div className="property-section"><label>FLOOR</label><div className="room-color-control"><input type="color" aria-label="Floor colour" {...editSessionProps} value={activeRoom.floorColor} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, floorColor: event.target.value }))} /><span>{activeRoom.floorColor}</span></div></div>
                      <div className="property-section"><label>WALL TEXTURE</label><select className="full-input" {...editSessionProps} value={activeRoom.wallTexture} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, wallTexture: event.target.value as GalleryRoom["wallTexture"] }))}>{Object.entries(wallTextures).map(([texture, label]) => <option key={texture} value={texture}>{label}</option>)}</select></div>
                      <div className="property-section"><label>FLOOR TEXTURE</label><select className="full-input" {...editSessionProps} value={activeRoom.floorTexture} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, floorTexture: event.target.value as GalleryRoom["floorTexture"] }))}>{Object.entries(floorTextures).map(([texture, label]) => <option key={texture} value={texture}>{label}</option>)}</select></div>
                      <div className="property-section"><label>CEILING TEXTURE</label><select className="full-input" {...editSessionProps} value={activeRoom.ceilingTexture} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, ceilingTexture: event.target.value as GalleryRoom["ceilingTexture"] }))}>{Object.entries(ceilingTextures).map(([texture, label]) => <option key={texture} value={texture}>{label}</option>)}</select></div>
                      <div className="property-section"><label>LIGHTING</label><label className="room-lighting-toggle"><input type="checkbox" checked={activeRoom.spotlights} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, spotlights: event.target.checked }))} /> Ceiling spotlights</label></div>
                      <div className="property-section"><label>LIGHT TYPE</label><select className="full-input" {...editSessionProps} value={activeRoom.lightType ?? "spot-warm"} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, lightType: event.target.value as GalleryRoom["lightType"] }))}>{Object.entries(lightTypes).map(([type, details]) => <option key={type} value={type}>{details.label}</option>)}</select></div>
                      <div className="property-section"><label>FLOOR TYPE</label><select className="full-input" {...editSessionProps} value={activeRoom.floorType ?? "charcoal"} onChange={(event) => {
                        const floorType = event.target.value as GalleryRoom["floorType"];
                        const preset = floorTypes[floorType];
                        updateRoom(activeRoom.id, (room) => ({ ...room, floorType, floorColor: preset.color, floorTexture: preset.texture as GalleryRoom["floorTexture"] }));
                      }}>{Object.entries(floorTypes).map(([type, details]) => <option key={type} value={type}>{details.label}</option>)}</select></div>
                      <div className="property-section">
                        <label>PARTITION WALLS <span>{activeRoom.partitionWalls.length}/8</span></label>
                        <div className="partition-wall-list">{activeRoom.partitionWalls.map((wall, index) => (
                          <div className="partition-wall-setting" key={wall.id}>
                            <div className="partition-wall-heading"><span>WALL {String(index + 1).padStart(2, "0")}</span><button type="button" aria-label={`Remove wall ${index + 1}`} onClick={() => removePartitionWall(wall.id)}><Trash2 size={12} /></button></div>
                            <select className="full-input" {...editSessionProps} aria-label={`Wall ${index + 1} direction`} value={wall.orientation} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, partitionWalls: room.partitionWalls.map((item) => item.id === wall.id ? { ...item, orientation: event.target.value as typeof item.orientation } : item) }))}>
                              <option value="horizontal">Horizontal</option><option value="vertical">Vertical</option>
                            </select>
                            <div className="partition-wall-coordinates">
                              <label>X<NumberField ariaLabel={`Wall ${index + 1} position X`} step="0.5" value={wall.x} {...editSessionProps} onCommit={(next) => updateRoom(activeRoom.id, (room) => ({ ...room, partitionWalls: room.partitionWalls.map((item) => item.id === wall.id ? { ...item, x: next } : item) }))} /></label>
                              <label>Z<NumberField ariaLabel={`Wall ${index + 1} position Z`} step="0.5" value={wall.z} {...editSessionProps} onCommit={(next) => updateRoom(activeRoom.id, (room) => ({ ...room, partitionWalls: room.partitionWalls.map((item) => item.id === wall.id ? { ...item, z: next } : item) }))} /></label>
                              <label>LENGTH<input aria-label={`Wall ${index + 1} length`} type="number" min="1" max="16" step="0.5" value={wall.length} {...editSessionProps} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, partitionWalls: room.partitionWalls.map((item) => item.id === wall.id ? { ...item, length: Number(event.target.value) } : item) }))} /></label>
                            </div>
                          </div>
                        ))}</div>
                        <button className="add-partition-wall" type="button" onClick={addPartitionWall} disabled={activeRoom.partitionWalls.length >= 8}><Plus size={12} /> Add a partition wall</button>
                      </div>
                      <div className="property-section"><label>CURATORIAL TEXT ON WALL <span>{activeRoom.curatorialText.length}/300</span></label><textarea className="full-input property-textarea" {...editSessionProps} maxLength={300} placeholder="Write the introduction visitors will read in this room." value={activeRoom.curatorialText} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, curatorialText: event.target.value }))} /></div>
                      <button className={`remove-room-button${confirmingRemoveRoom ? " confirming" : ""}`} onClick={removeRoom} disabled={rooms.length <= 1}><Trash2 size={13} /> {confirmingRemoveRoom ? `Click again to remove "${activeRoom.name}"` : "Remove this room"}</button>
                    </>}
                    <div className="property-section"><label>EXHIBITION DESCRIPTION</label><textarea className="full-input property-textarea" {...editSessionProps} value={description} onChange={(event) => { setDescription(event.target.value); setSaved(false); }} /></div>
                <div className="room-settings-note"><Sparkles size={15} /><span>Each gallery keeps its own layout, colours, ceiling and artworks.</span></div>
            </div>
          )}
          <div className="inspector-footer"><span>Saved with exhibition</span><span className="local-save-dot" /></div>
        </aside>
      </div>
      )}
      {loadFailed && (
        <div className="editor-load-failed">
          <p>This exhibition could not be opened. It may have been deleted, or the server could not be reached.</p>
          <Link href="/">Back to the dashboard</Link>
        </div>
      )}
    </main>
  );
}
