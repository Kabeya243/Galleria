"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Box,
  Check,
  ChevronDown,
  CircleHelp,
  Copy,
  Expand,
  Eye,
  EyeOff,
  Grid2X2,
  Group,
  History,
  Image,
  Info,
  Layers,
  LayoutGrid,
  Lightbulb,
  Lock,
  Minus,
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
  Video,
} from "lucide-react";
import ElementThumbnail from "@/components/element-thumbnail";
import ExhibitionMinimap from "@/components/exhibition-minimap";
import ExhibitionPublishDialog, { type PublishVisibility } from "@/components/exhibition-publish-dialog";
import FrameThumbnail from "@/components/frame-thumbnail";
import GalleryScene, { artworkStandPoint, parseArtworkDimensions, type CameraState, type TeleportTarget } from "@/components/gallery-scene";
import LayersPanel, { type LayerArtwork, type LayerItemRef } from "@/components/layers-panel";
import PaletteSwatches from "@/components/palette-swatches";
import ThemeToggle from "@/components/theme-toggle";
import type { Artwork, FrameConfig, FrameFinish, FrameGlass, FrameMaterial, FrameProfile, FrameVariant } from "@/lib/demo-data";
import { FRAME_FINISH_LABELS, FRAME_GLASS_LABELS, FRAME_MATERIAL_LABELS, FRAME_PRESETS, FRAME_PROFILE_LABELS, FRAME_VARIANTS, effectiveFrameConfig, encodeFrameConfig, isCustomFrame, parseFrameConfig, parseSavedFrameConfig } from "@/lib/demo-data";
import { dominantHex, extractPalette, HARMONY_LABELS, harmonyOf, harmonyScore, hueFamilyOf, HUE_FAMILY_LABELS, isWarmHex, suggestedFrameVariant, suggestedWallColor } from "@/lib/palette";
import { DEFAULT_ARTWORK_DESCRIPTION, enrichWithGemini, generateCaption, isGeminiAvailable } from "@/lib/caption";
import { composeWall, dominantFamilyOf, wallFaceLabel, type ComposeItem, type ComposeObstacle } from "@/lib/compose-wall";
import type { ArtworkCaption, CaptionSource, CaptionStatus } from "@/lib/caption";
import { createElement, ELEMENT_DEFAULTS, ELEMENT_PLANES, PLINTH_VARIANTS, WALL_TEXT_ALIGNS, WALL_TEXT_FONTS, WALL_TEXT_LAYOUTS, WALL_TEXT_SWATCHES, type ElementType, type RoomElement, type WallTextAlign, type WallTextFont, type WallTextLayout } from "@/lib/elements";
import { applyLayoutPreset, ceilingTextures, createGalleryRoom, floorTextures, floorTypes, HIDDEN_LAYOUT_KEYS, lightTypes, parseGalleryRooms, roomLayouts, roomPlanOffsets, wallTextures, type GalleryRoom, type RoomLayout, type WallId } from "@/lib/rooms";
import { galleryLabel, type GalleryNamesMap } from "@/lib/gallery-names";
import { useLocale, useT } from "@/lib/i18n";
import { useGalleryNames } from "@/lib/use-gallery-names";
import { galleryCameraStart, galleryDef, galleryHangWalls, galleryWallHit, galleryWallsForPosition, roomFloorCenterZ } from "@/lib/gallery-defs";
import { isVideoServingUrl, VIDEO_MAX_FILE_SIZE } from "@/lib/video";
import { isSculptureServingUrl, SCULPTURE_MAX_FILE_SIZE } from "@/lib/sculpture";
import {
  createSunlightElement,
  closestHangWall,
  rotationMatches,
  SUNLIGHT_ELEMENT_BOUNDS,
  SUNLIGHT_ELEMENT_DEFAULTS,
  SUNLIGHT_ELEMENT_TYPES,
  SUNLIGHT_MAX_SPOTS,
  SUNLIGHT_TEXT_FONTS,
  sunlightElementCollisionBlocks,
  sunlightHangWalls,
  sunlightTextArtworkSize,
  sunlightWallHit,
  sunlightWallsForPosition,
  type HangWallFace,
  type SunlightElement,
  type SunlightElementType,
  type SunlightTextFont,
} from "@/lib/sunlight-elements";
import {
  CEILING_FINISHES,
  CEILING_FINISH_KEYS,
  FLOOR_PATTERNS,
  FLOOR_PATTERN_KEYS,
  FLOOR_SHINE_MAX,
  FLOOR_SHINE_MIN,
  PARTITION_DIMS,
  VIEW_PRESETS,
  partitionDimsOf,
  sunlightPartitionDimsOf,
  type CameraViewPreset,
  type CeilingFinishKey,
  type FloorPatternKey,
} from "@/lib/editor-params";
import { snapArtworkToWall } from "@/lib/snap-to-wall";
import { createTourStop, MAX_TOUR_STOPS, parseGuidedTour, pruneTourStops, type GuidedTour, type TourStop } from "@/lib/tour";
import { placeArtworkInView, PLACE_IN_VIEW_EYE_Y } from "@/lib/place-in-view";
import { SUNLIGHT_BLOCKS } from "@/lib/sunlight";
import {
  carriedArtworks,
  grabCarriedArtworks,
  releaseCarriedArtworks,
  type PartitionPose,
} from "@/lib/partition-carry";

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

export default function Editor({
  exhibitionId,
  hiddenLayouts = [],
  galleryNames = {},
}: {
  exhibitionId: string;
  // Layout ids the owner hid in the admin: not offered as a gallery
  // choice (the room's own layout always stays available, so a room
  // built with a hidden template still shows its own layout).
  hiddenLayouts?: string[];
  // Gallery names in both languages (admin renames included): the
  // server seeds the first paint, the hook refreshes them.
  galleryNames?: Partial<GalleryNamesMap>;
}) {
  const hiddenLayoutSet = useMemo(() => new Set(hiddenLayouts), [hiddenLayouts]);
  const { locale } = useLocale();
  const t = useT();
  // Background music for the whole visit (option A): one track per
  // exhibition, stored as Exhibition columns and sent with the normal
  // save — no separate save path. Null = no music.
  type ExhibitionMusicState = { url: string; title: string; loop: boolean; volume: number };
  const [music, setMusic] = useState<ExhibitionMusicState | null>(null);
  const [musicError, setMusicError] = useState<string | null>(null);
  const [musicUploading, setMusicUploading] = useState(false);
  const musicFileRef = useRef<HTMLInputElement>(null);
  function updateMusic(next: ExhibitionMusicState | null) {
    setMusic(next);
    setSaved(false);
  }
  // Guided tour (one per exhibition, saved with it — see lib/tour.ts):
  // the artist's stops in order, each from the camera's current stand
  // point and gaze. Null = no tour yet.
  const [tour, setTour] = useState<GuidedTour | null>(null);
  const [tourError, setTourError] = useState<string | null>(null);
  function updateTour(next: GuidedTour | null) {
    setTour(next);
    setSaved(false);
  }
  const nameOverrides = useGalleryNames(galleryNames);
  // Display name of a gallery in the current language (admin renames
  // included) — room list, status bar and the GALLERY selector.
  const roomLabel = (layout: RoomLayout) => galleryLabel(layout, locale, nameOverrides);
  const [artworks, setArtworks] = useState<LayerArtwork[]>([]);
  const [rooms, setRooms] = useState<GalleryRoom[]>([]);
  const [activeRoomId, setActiveRoomId] = useState("");
  // The editor is always in first person (the reference file's single
  // mode): walking and editing are the same view, there is no mode to
  // enter or leave. WASD / arrows / the walk pad / a floor tap move
  // the camera; a press on an artwork or element selects and drags it.
  const movementKeys = useRef(new Set<string>());
  // Camera view presets (the toolbar's View buttons: Eye / Wide /
  // High / Plan): the request carries a nonce, so the same view can
  // be re-applied, and the scene eases the camera height toward it.
  // Changing rooms resets the view to eye level.
  const [cameraView, setCameraView] = useState<CameraViewPreset>("eye");
  const [viewRequest, setViewRequest] = useState<{ nonce: number; view: CameraViewPreset } | null>(null);
  const viewNonce = useRef(0);
  function requestCameraView(view: CameraViewPreset) {
    setCameraView(view);
    viewNonce.current += 1;
    setViewRequest({ nonce: viewNonce.current, view });
  }
  function resetCameraView() {
    setCameraView("eye");
    setViewRequest(null);
  }
  // Gentle turn toward a newly added artwork (placeOnCameraWall's
  // turnYaw): the scene eases the yaw toward it (see GalleryScene's
  // lookAtRequest), only when the work could not be placed in view.
  // The nonce makes a repeat turn to the same yaw a new request.
  const [lookAtRequest, setLookAtRequest] = useState<{ nonce: number; yaw: number } | null>(null);
  const lookAtNonce = useRef(0);
  // The artwork just added, for its fade-in (GalleryScene passes it
  // to the artwork's frame). Cleared once the fade is done so a later
  // remount (room switch) does not replay it.
  const [appearingId, setAppearingId] = useState<string | null>(null);
  useEffect(() => {
    if (!appearingId) return;
    const timer = setTimeout(() => setAppearingId((current) => (current === appearingId ? null : current)), 1500);
    return () => clearTimeout(timer);
  }, [appearingId]);
  // Bring a newly added artwork before the visitor's eyes: fade it in
  // (appearingId) and, when the placement needed it, turn the view
  // gently toward it — or, when the camera looks steeply down (High /
  // Plan / Wide views), return to eye level first, since no wall-hung
  // work can be in frame from up there. Both requests can fire
  // together: the view preset clears the look target in the walk
  // controls, and the scene's look-at effect (a parent effect, so it
  // runs after the walk controls') re-applies it.
  function revealNewArtwork(id: string, turnYaw: number | null) {
    setAppearingId(id);
    const camera = cameraStateRef.current;
    if (camera && Math.abs(camera.pitch) > 0.35) requestCameraView("eye");
    if (turnYaw !== null) {
      lookAtNonce.current += 1;
      setLookAtRequest({ nonce: lookAtNonce.current, yaw: turnYaw });
    }
  }
  // WASD is ignored while typing (the walk controls guard the keys
  // too): when the focus lands in a form field, any held walk keys
  // are released, so the camera does not keep walking after the user
  // starts typing.
  useEffect(() => {
    const onFocusIn = (event: FocusEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.closest("input, textarea, select") || target.isContentEditable)) {
        movementKeys.current.clear();
      }
    };
    window.addEventListener("focusin", onFocusIn);
    return () => window.removeEventListener("focusin", onFocusIn);
  }, []);
  // Floor-plan teleport (minimap): a target in another room first
  // switches rooms, then walks to the artwork's stand point — the
  // same mechanism as the public viewer. Clicking a dot walks there
  // directly, since the editor is always in first person.
  const [teleportTarget, setTeleportTarget] = useState<TeleportTarget | null>(null);
  const teleportNonce = useRef(0);
  // Live camera state for the minimap: GalleryScene writes the
  // camera's world position and yaw here every frame; the minimap
  // draws the camera dot and its direction line from it.
  const cameraStateRef = useRef<CameraState | null>(null);
  const [selectedId, setSelectedId] = useState<string>();
  // Colour palette (ColorThief): whether the selected artwork's palette
  // is being read right now, and which artwork+image pairs were already
  // tried — a failed extraction is not retried on every selection, only
  // from the manual "Extract palette" button.
  const [extractingPalette, setExtractingPalette] = useState(false);
  const paletteAttemptedRef = useRef<Set<string>>(new Set());
  // Automatic description (captioning model, in the browser): the generation
  // running right now (scoped to one artwork — the model downloads once
  // and is cached), the inline message for the caption section, and the
  // suggestion currently applied to an artwork (what was suggested and
  // what the fields held before, so "Discard suggestion" restores
  // exactly that — and only the fields the artist has not since edited).
  // A failed generation never blocks an upload or a save; it just leaves
  // the description/alt-text empty and the manual button retries it.
  type CaptionSuggestion = {
    artworkId: string;
    imageUrl: string;
    source: CaptionSource;
    altText: string;
    description: string;
    previousDescription: string;
    previousAltText: string | null;
  };
  const [captionStatus, setCaptionStatus] = useState<{ artworkId: string; status: CaptionStatus } | null>(null);
  const [captionMessage, setCaptionMessage] = useState<{ artworkId: string; text: string } | null>(null);
  const [captionSuggestion, setCaptionSuggestion] = useState<CaptionSuggestion | null>(null);
  const captionAttemptedRef = useRef<Set<string>>(new Set());
  // The caption last applied to each artwork (captioning model or Gemini): used to
  // tell an artist's own text apart from a still-unchanged suggestion,
  // so a new image replaces a stale suggestion but never the artist's
  // words.
  const captionAppliedRef = useRef<Map<string, { imageUrl: string; altText: string; description: string }>>(new Map());
  // Gemini (optional, server-side): whether /api/describe can enrich
  // (null = not checked yet), the richer suggestion it returned, and
  // whether a request is running. Checked once when the editor loads.
  const [geminiAvailable, setGeminiAvailable] = useState<boolean | null>(null);
  const [geminiBusy, setGeminiBusy] = useState(false);
  const [geminiSuggestion, setGeminiSuggestion] = useState<(ArtworkCaption & { artworkId: string }) | null>(null);
  const [panelTab, setPanelTab] = useState<"artworks" | "elements" | "layers">("artworks");
  const [selectedElementId, setSelectedElementId] = useState<string>();
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  // Sunlight 3D elements (the reference room's own pieces — cloison,
  // suspendu, colonne, socles, vitrine, banc, fauteuils, spotlights):
  // a single selection, separate from the Asset Library's. The type
  // select, the curatorial-text composer and the inline message live
  // with it (the message is shown in the panel, never a native alert).
  const [selectedSunlightElementId, setSelectedSunlightElementId] = useState<string>();
  const [sunlightElementType, setSunlightElementType] = useState<SunlightElementType>("cloison");
  const [curatorialText, setCuratorialText] = useState("");
  const [curatorialTextFont, setCuratorialTextFont] = useState<SunlightTextFont>("d");
  const [sunlightMessage, setSunlightMessage] = useState<string | null>(null);
  // Automatic wall composition ("Compose wall", see
  // lib/compose-wall.ts): whether the compose panel is open, which
  // wall it targets, and the inline result message. The panel opens
  // from the multi-selection bar; the message is shown in the panel,
  // never a native alert.
  const [composeOpen, setComposeOpen] = useState(false);
  const [composeWallId, setComposeWallId] = useState<string | null>(null);
  const [composeMessage, setComposeMessage] = useState<string | null>(null);
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
  type SavedVersion = { id: string; title: string; createdAt: string; data: { exhibitionId?: string; title?: string; description?: string; rooms?: GalleryRoom[]; artworks?: LayerArtwork[]; tour?: GuidedTour | null; savedAt?: string } };
  const [history, setHistory] = useState<SavedVersion[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [confirmingRestoreId, setConfirmingRestoreId] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [title, setTitle] = useState("Untitled exhibition");
  const [description, setDescription] = useState("");
  const [slug, setSlug] = useState("");
  const [status, setStatus] = useState("draft");
  // Who can open the published show (feature 8): "public", "private-link"
  // or "password". Loaded with the exhibition; the publish dialog edits it.
  const [visibility, setVisibility] = useState<PublishVisibility>("public");
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  // Reusable library ("Mes œuvres"): pick a work already uploaded
  // instead of uploading again. The picker loads GET /api/library on
  // first open; choosing a work adds a COPY to this room (same image
  // URL, fresh placement on the wall the camera is looking at — the
  // same placement addArtwork uses), saved with the next exhibition
  // save. Nothing is re-uploaded.
  type LibraryPickerWork = {
    id: string;
    title: string;
    artist: string;
    year: string;
    medium: string;
    dimensions: string;
    description: string;
    imageUrl: string | null;
    videoUrl: string | null;
    sculptureUrl: string | null;
    frame: string;
    palette: string[] | null;
    altText: string | null;
  };
  const [showLibraryPicker, setShowLibraryPicker] = useState(false);
  const [libraryWorks, setLibraryWorks] = useState<LibraryPickerWork[]>([]);
  const [libraryLoaded, setLibraryLoaded] = useState(false);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryQuery, setLibraryQuery] = useState("");
  const [libraryError, setLibraryError] = useState<string | null>(null);
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
  const replaceImageRef = useRef<HTMLInputElement>(null);
  const sculptureUploadRef = useRef<HTMLInputElement>(null);
  const replaceSculptureRef = useRef<HTMLInputElement>(null);
  const videoUploadRef = useRef<HTMLInputElement>(null);
  const replaceVideoRef = useRef<HTMLInputElement>(null);
  // Undo history: full editor snapshots (artworks + rooms + title +
  // description), so Ctrl+Z covers artworks, elements and room settings
  // alike. One snapshot per discrete action — never per keystroke (see
  // beginEdit/endEdit below).
  type EditorSnapshot = { artworks: LayerArtwork[]; rooms: GalleryRoom[]; title: string; description: string; tour: GuidedTour | null };
  const historyRef = useRef<{ past: EditorSnapshot[]; future: EditorSnapshot[] }>({ past: [], future: [] });
  const [, setHistoryTick] = useState(0);
  const latestRef = useRef({ artworks, rooms, title, description, tour });
  useEffect(() => {
    latestRef.current = { artworks, rooms, title, description, tour };
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
        const loadedRooms = result.exhibition.rooms as GalleryRoom[];
        const loadedArtworks = result.exhibition.artworks as LayerArtwork[];
        setArtworks(loadedArtworks);
        setRooms(loadedRooms);
        setActiveRoomId(result.exhibition.rooms[0]?.id ?? "");
        historyRef.current = { past: [], future: [] };
        setSelectedId(loadedArtworks.find((artwork: Artwork) => artwork.roomId === result.exhibition.rooms[0]?.id)?.id);
        setTitle(result.exhibition.title);
        setDescription(result.exhibition.description);
        setTour(parseGuidedTour(result.exhibition.tour));
        setMusic(
          result.exhibition.audioUrl
            ? {
                url: result.exhibition.audioUrl,
                title: result.exhibition.audioTitle ?? "",
                loop: result.exhibition.audioLoop ?? true,
                volume: typeof result.exhibition.audioVolume === "number" ? result.exhibition.audioVolume : 0.5,
              }
            : null,
        );
        setSlug(result.exhibition.slug);
        setStatus(result.exhibition.status);
        if (
          result.exhibition.visibility === "public" ||
          result.exhibition.visibility === "private-link" ||
          result.exhibition.visibility === "password"
        ) {
          setVisibility(result.exhibition.visibility);
        }
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

  // Colour palette, lazy pass: artworks saved before palettes existed
  // (or whose extraction failed at upload) get theirs read when they
  // are selected. The palette is stored on the artwork, so the next
  // save persists it — extraction happens once per artwork+image.
  const selectedIdForPalette = selected?.id;
  const selectedImageForPalette = selected?.imageUrl ?? null;
  const selectedHasPalette = Boolean(selected?.palette?.length);
  const selectedIsText = Boolean(selected?.text);
  useEffect(() => {
    if (!selectedIdForPalette || !selectedImageForPalette || selectedHasPalette || selectedIsText) return;
    const key = `${selectedIdForPalette}:${selectedImageForPalette}`;
    if (paletteAttemptedRef.current.has(key)) return;
    paletteAttemptedRef.current.add(key);
    let cancelled = false;
    setExtractingPalette(true);
    void extractPalette(selectedImageForPalette).then((palette) => {
      if (cancelled) return;
      setExtractingPalette(false);
      if (palette) {
        updateArtwork(selectedIdForPalette, (artwork) =>
          artwork.imageUrl === selectedImageForPalette ? { ...artwork, palette } : artwork,
        );
      }
    });
    return () => {
      cancelled = true;
    };
  }, [selectedIdForPalette, selectedImageForPalette, selectedHasPalette, selectedIsText]);

  // Manual retry when the automatic read failed (button in the palette
  // section). The attempted-set entry stays, so the effect above does
  // not loop; a fresh selection retries once.
  async function extractSelectedPalette() {
    if (!selected || !selected.imageUrl || selected.text) return;
    setExtractingPalette(true);
    const palette = await extractPalette(selected.imageUrl);
    setExtractingPalette(false);
    if (palette) {
      updateArtwork(selected.id, (artwork) =>
        artwork.imageUrl === selected.imageUrl ? { ...artwork, palette } : artwork,
      );
    }
  }

  // Automatic description (captioning model / Gemini): apply a caption to an
  // artwork's description + alt-text, but ONLY where the artist has not
  // written their own text — an empty description, the default
  // placeholder, or a still-unchanged earlier suggestion is replaced;
  // the artist's own words are never overwritten. With force=true (the
  // artist explicitly clicked "Use this text" on a Gemini suggestion)
  // both fields are written. Returns the suggestion record when at
  // least one field was written, so the inspector can offer "Discard
  // suggestion".
  function applyCaption(
    artworkId: string,
    imageUrl: string,
    caption: ArtworkCaption,
    force = false,
  ): CaptionSuggestion | null {
    const artwork = latestRef.current.artworks.find((item) => item.id === artworkId);
    if (!artwork || artwork.text || artwork.imageUrl !== imageUrl) return null;
    const previous = captionAppliedRef.current.get(artworkId);
    const descriptionIsSuggestion = Boolean(previous && artwork.description === previous.description);
    const altTextIsSuggestion = Boolean(previous && artwork.altText === previous.altText);
    const writeDescription =
      force ||
      artwork.description.trim() === "" ||
      artwork.description === DEFAULT_ARTWORK_DESCRIPTION ||
      descriptionIsSuggestion;
    const writeAltText = force || !artwork.altText?.trim() || altTextIsSuggestion;
    if (!writeDescription && !writeAltText) return null;
    const suggestion: CaptionSuggestion = {
      artworkId,
      imageUrl,
      source: caption.source,
      altText: caption.altText,
      description: caption.description,
      previousDescription: artwork.description,
      previousAltText: artwork.altText ?? null,
    };
    updateArtwork(artworkId, (current) => ({
      ...current,
      description: writeDescription ? caption.description : current.description,
      altText: writeAltText ? caption.altText : current.altText,
    }));
    captionAppliedRef.current.set(artworkId, {
      imageUrl,
      altText: caption.altText,
      description: caption.description,
    });
    return suggestion;
  }

  // Generate a caption for an artwork's image in the background (captioning model,
  // in the browser). Never blocks the upload or the save: the model
  // downloads once (then is cached), and a failure just leaves the
  // description/alt-text empty — the manual button retries it. The
  // "already have your own text" note only shows for a manual retry
  // (force), never for a background run.
  async function describeArtwork(
    artworkId: string,
    source: File | string,
    imageUrl: string,
    force = false,
  ): Promise<void> {
    const key = `${artworkId}:${imageUrl}`;
    if (!force && captionAttemptedRef.current.has(key)) return;
    captionAttemptedRef.current.add(key);
    setCaptionMessage(null);
    setGeminiSuggestion(null);
    const caption = await generateCaption(source, (status) =>
      setCaptionStatus({ artworkId, status }),
    );
    setCaptionStatus((current) => (current?.artworkId === artworkId ? null : current));
    if (!caption) {
      setCaptionMessage({
        artworkId,
        text: "Could not generate a description for this image (offline or model unavailable). Use the Generate description button to retry.",
      });
      return;
    }
    const suggestion = applyCaption(artworkId, imageUrl, caption);
    if (suggestion) {
      setCaptionSuggestion(suggestion);
    } else if (force) {
      setCaptionMessage({
        artworkId,
        text: "You already have your own description and alt-text here — clear a field to let a suggestion fill it.",
      });
    }
  }

  // Manual retry for the selected artwork (button in the description
  // section): bypasses the attempted-set, so a failed automatic read
  // can be tried again.
  async function generateSelectedCaption() {
    if (!selected || !selected.imageUrl || selected.text) return;
    await describeArtwork(selected.id, selected.imageUrl, selected.imageUrl, true);
  }

  // Discard the applied suggestion: each field goes back to what it
  // held before — but only the fields the artist has not since edited,
  // so their own words are never lost by discarding.
  function discardCaptionSuggestion() {
    if (!captionSuggestion) return;
    const { artworkId, altText, description, previousDescription, previousAltText } = captionSuggestion;
    updateArtwork(artworkId, (artwork) => ({
      ...artwork,
      description: artwork.description === description ? previousDescription : artwork.description,
      altText: artwork.altText === altText ? (previousAltText ?? null) : artwork.altText,
    }));
    captionAppliedRef.current.delete(artworkId);
    setCaptionSuggestion(null);
  }

  // Gemini (optional, server-side): ask for a richer description of the
  // selected artwork's image. The suggestion is shown in a box — the
  // artist chooses "Use this text" or "Dismiss"; nothing is overwritten
  // without that click.
  async function enrichSelectedWithGemini() {
    if (!selected || !selected.imageUrl || selected.text) return;
    setGeminiBusy(true);
    setCaptionMessage(null);
    setGeminiSuggestion(null);
    const caption = await enrichWithGemini(selected.imageUrl);
    setGeminiBusy(false);
    if (!caption) {
      setCaptionMessage({
        artworkId: selected.id,
        text: "Gemini did not answer — the current suggestion is kept.",
      });
      return;
    }
    setGeminiSuggestion({ ...caption, artworkId: selected.id });
  }

  function applyGeminiSuggestion() {
    if (!selected || !selected.imageUrl || !geminiSuggestion) return;
    const suggestion = applyCaption(selected.id, selected.imageUrl, geminiSuggestion, true);
    if (suggestion) {
      setCaptionSuggestion(suggestion);
      setGeminiSuggestion(null);
      setCaptionMessage(null);
    }
  }

  // Whether the server can enrich with Gemini — checked once, so the
  // "Enrich with Gemini" button only appears when it can actually work.
  useEffect(() => {
    let active = true;
    void isGeminiAvailable().then((available) => {
      if (active) setGeminiAvailable(available);
    });
    return () => {
      active = false;
    };
  }, []);

  // Hanging harmony for the selected artwork: other works in this room
  // with a palette, ranked by how well their dominant colour sits with
  // this one's (analogous / complementary first, same family next).
  const selectedDominant = dominantHex(selected?.palette ?? null);
  const colourMatches = useMemo(() => {
    if (!selected || !selectedDominant || selected.text) return [];
    return currentArtworks
      .filter((item) => item.id !== selected.id && !item.text && item.palette?.length)
      .map((item) => {
        const other = item.palette![0];
        return { artwork: item, harmony: harmonyOf(selectedDominant, other), score: harmonyScore(selectedDominant, other) };
      })
      .filter((match) => match.score > 0)
      .sort((a, b) => b.score - a.score || a.artwork.title.localeCompare(b.artwork.title))
      .slice(0, 4);
  }, [selected, selectedDominant, currentArtworks]);

  // Wall and frame suggestions from the dominant colour — shown in
  // the inspector, never applied on their own.
  const wallSuggestion = useMemo(
    () => (selectedDominant && !selected?.text ? suggestedWallColor(selectedDominant) : null),
    [selectedDominant, selected?.text],
  );
  const frameSuggestion = useMemo(
    () => (selectedDominant && !selected?.text ? suggestedFrameVariant(selectedDominant) : null),
    [selectedDominant, selected?.text],
  );

  // Two works with the same dominant colour hung side by side muddy
  // each other — flag the neighbours on this wall that share the
  // selected work's dominant family, so the curator can space them out.
  const sameFamilyWallNeighbours = useMemo(() => {
    if (!selected || !selectedDominant || selected.text || !activeRoom) return [];
    const key = wallsForArtwork(selected, activeRoom)[0]?.key;
    if (!key) return [];
    const family = hueFamilyOf(selectedDominant);
    return artworks.filter(
      (item) =>
        item.roomId === selected.roomId &&
        item.id !== selected.id &&
        !item.text &&
        item.palette?.length &&
        hueFamilyOf(item.palette[0]) === family &&
        wallsForArtwork(item, activeRoom)[0]?.key === key,
    );
  }, [selected, selectedDominant, activeRoom, artworks]);

  function snapshot() {
    const current = latestRef.current;
    historyRef.current = {
      past: [...historyRef.current.past, { artworks: current.artworks, rooms: current.rooms, title: current.title, description: current.description, tour: current.tour }].slice(-50),
      future: [],
    };
    setHistoryTick((tick) => tick + 1);
  }

  function applySnapshot(next: EditorSnapshot) {
    setArtworks(next.artworks);
    setRooms(next.rooms);
    setTitle(next.title);
    setDescription(next.description);
    setTour(next.tour);
    setSaved(false);
  }

  function undo() {
    const history = historyRef.current;
    const previous = history.past[history.past.length - 1];
    if (!previous) return;
    const current = latestRef.current;
    historyRef.current = {
      past: history.past.slice(0, -1),
      future: [{ artworks: current.artworks, rooms: current.rooms, title: current.title, description: current.description, tour: current.tour }, ...history.future],
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
      past: [...history.past, { artworks: current.artworks, rooms: current.rooms, title: current.title, description: current.description, tour: current.tour }],
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

  // Which walls an artwork hangs on, from its position. Every hangable
  // wall counts: the room's four walls, the three freestanding panels,
  // and any cloison/suspendu the user added — so a dragged artwork (or
  // a curatorial text, which is an artwork) turns to face the wall it
  // lands on, whatever that wall is. Near a corner several walls can
  // match at once; the caller prefers the wall the artwork was already
  // on, so sliding along one wall never flips it to the next.
  function wallsForArtwork(artwork: Artwork, room: GalleryRoom): { key: string; rotation: number }[] {
    if (room.layout !== "sunlight") {
      return galleryWallsForPosition(
        { x: artwork.position[0], y: artwork.position[1], z: artwork.position[2] },
        room.layout,
        room.elements,
      );
    }
    return sunlightWallsForPosition(
      { x: artwork.position[0], y: artwork.position[1], z: artwork.position[2] },
      room.sunlightElements ?? [],
    );
  }

  // Artworks carried by a partition (Claude's grab / release): the
  // carried set is taken from the current artworks and the partition's
  // pose before the change, and released onto the new pose — absolute
  // positions, so rapid updates (a drag's pointermoves) never drift.
  // The pose's length already includes the element's scale, so a
  // resize-handle drag carries the artworks too.
  function carryArtworksWithPartition(before: PartitionPose, after: PartitionPose, y0: number) {
    const carried = grabCarriedArtworks(latestRef.current.artworks, before, y0);
    if (!carried.length) return;
    const released = releaseCarriedArtworks(carried, after, y0, before.length);
    const byId = new Map(released.map((item) => [item.id, item]));
    setArtworks((current) =>
      current.map((artwork) => {
        const next = byId.get(artwork.id);
        return next ? { ...artwork, position: next.position, rotation: next.rotation } : artwork;
      }),
    );
  }

  // Deleting a partition deletes the artworks hanging on it too (the
  // wall leaves the hangable list on its own, since the list is
  // rebuilt from the room's elements). Runs inside the delete's undo
  // session, so undo brings the artworks back with the partition.
  function deleteCarriedArtworks(partition: PartitionPose, y0 = 0) {
    const carried = carriedArtworks(latestRef.current.artworks, partition, y0);
    if (!carried.length) return;
    const ids = new Set(carried.map((artwork) => artwork.id));
    setArtworks((current) => current.filter((artwork) => !ids.has(artwork.id)));
  }

  function updateArtwork(id: string, update: (artwork: Artwork) => Artwork) {
    setArtworks((current) => current.map((artwork) => {
      if (artwork.id !== id) return artwork;
      const next = update(artwork);
      // Auto-rotate: when the artwork moves onto a different wall, turn
      // it to face that wall. A move along the same wall keeps its
      // rotation, so a deliberate tilt is never reset. An update that
      // sets a rotation explicitly (the drag-end snap, "Fit to wall",
      // the rotation slider) is authoritative: auto-rotate never
      // overrides it.
      const moved = next.position[0] !== artwork.position[0] || next.position[1] !== artwork.position[1] || next.position[2] !== artwork.position[2];
      const explicitRotation = next.rotation !== artwork.rotation;
      if (moved && !explicitRotation && activeRoom && artwork.roomId === activeRoom.id) {
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

  // Automatic wall composition ("Compose wall"): the artworks it
  // can hang — the selected artworks of the active room, excluding
  // curatorial texts (they are artworks in the model, but the
  // size/dominant rules do not apply to them). Elements and artworks
  // from other rooms are ignored.
  const composeCandidates = useMemo(() => {
    if (!activeRoom) return [];
    const selectedIds = new Set(selectionRefs.filter((ref) => ref.kind === "artwork").map((ref) => ref.id));
    return artworks.filter((artwork) => selectedIds.has(artwork.id) && artwork.roomId === activeRoom.id && !artwork.text && !artwork.sculptureUrl);
  }, [selectionRefs, artworks, activeRoom]);
  // Every hangable face of the active room (room walls, Sunlight
  // panels, added cloisons/suspendus), for the wall picker.
  const composeFaces = useMemo(() => {
    if (!activeRoom) return [];
    return activeRoom.layout === "sunlight"
      ? sunlightHangWalls(activeRoom.sunlightElements ?? [])
      : galleryHangWalls(activeRoom.layout, activeRoom.elements);
  }, [activeRoom]);
  const composeFaceOptions = useMemo(() => {
    const elements = activeRoom?.sunlightElements ?? [];
    return composeFaces.map((face) => ({ id: face.id, label: wallFaceLabel(face, elements) }));
  }, [composeFaces, activeRoom]);

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
    setSelectedSunlightElementId(undefined);
    setSelectedWallId(null);
    setShowStageSettings(false);
    setMultiSelected(artwork?.groupId ? groupMembers(artwork.groupId, { kind: "artwork", id }) : []);
    // A text artwork fills the curatorial-text composer (the file's
    // fill()), so "Modify the selected text" edits it.
    if (artwork?.text) {
      setCuratorialText(artwork.text);
      setCuratorialTextFont(artwork.textFont === "s" || artwork.textFont === "g" || artwork.textFont === "m" ? artwork.textFont : "d");
    }
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
    setSelectedSunlightElementId(undefined);
    setSelectedWallId(null);
    setShowStageSettings(false);
    setMultiSelected(element?.groupId ? groupMembers(element.groupId, { kind: "element", id }) : []);
  }

  // Sunlight 3D elements are a single selection (no multi-select, no
  // groups): picking one clears any artwork, element or wall, like the
  // selections above, and vice versa.
  function selectSunlightElement(id: string | undefined) {
    if (id === undefined) {
      setSelectedSunlightElementId(undefined);
      return;
    }
    const owner = rooms.find((room) => (room.sunlightElements ?? []).some((item) => item.id === id));
    if (owner && owner.id !== activeRoomId) setActiveRoomId(owner.id);
    setSelectedSunlightElementId(id);
    setSelectedId(undefined);
    setSelectedElementId(undefined);
    setSelectedWallId(null);
    setShowStageSettings(false);
    setMultiSelected([]);
  }

  function selectWall(id: string | null) {
    setSelectedWallId(id);
    setSelectedId(undefined);
    setSelectedElementId(undefined);
    setSelectedSunlightElementId(undefined);
    setMultiSelected([]);
    setShowStageSettings(false);
  }

  function clearSelection() {
    setSelectedId(undefined);
    setSelectedElementId(undefined);
    setSelectedSunlightElementId(undefined);
    setSelectedWallId(null);
    setMultiSelected([]);
  }

  // Floor-plan teleport (minimap): walk to the artwork's stand point.
  // The scene switches rooms itself when the artwork is in another
  // room (see the teleport effect in GalleryScene).
  function handleTeleport(artwork: Artwork) {
    const stand = artworkStandPoint(artwork);
    teleportNonce.current += 1;
    setTeleportTarget({ roomId: artwork.roomId, ...stand, nonce: teleportNonce.current });
  }

  // Floor-plan point teleport (minimap): walk to a point clicked on
  // the plan. The yaw stays null — walk there, keep the current
  // direction (the same teleportTarget path as an artwork dot).
  function handleTeleportPoint(roomId: string, x: number, z: number) {
    teleportNonce.current += 1;
    setTeleportTarget({ roomId, x, z, yaw: null, nonce: teleportNonce.current });
  }

  // Floor-plan room click (minimap): a room name in the plan is a
  // teleport too, not just an edit-view switch — it walks to that
  // room's entrance (the same teleportTarget path as an artwork dot,
  // so the scene switches rooms and walks in). The left panel's room
  // list stays the way to switch rooms without walking.
  function handleRoomTeleport(roomId: string) {
    const room = rooms.find((candidate) => candidate.id === roomId);
    if (!room) return;
    const start = galleryCameraStart(room.layout);
    teleportNonce.current += 1;
    setTeleportTarget({ roomId, x: start.x, z: start.z, yaw: start.yaw, nonce: teleportNonce.current });
  }

  // Guided tour: add a stop from the camera's current stand point and
  // gaze. The camera state the scene reports every frame is in world
  // coordinates, so the room-plan offsets come off to store the stop
  // room-local, like every teleport target. The first stop switches
  // the tour on — the artist can switch it off again below.
  function addTourStop() {
    setTourError(null);
    const camera = cameraStateRef.current;
    if (!camera || !activeRoom) {
      setTourError(t("tour", "noCamera"));
      return;
    }
    const current = tour ?? { enabled: true, stops: [] };
    if (current.stops.length >= MAX_TOUR_STOPS) return;
    const planOffsets = roomPlanOffsets(sceneRooms);
    const roomIndex = Math.max(0, sceneRooms.findIndex((room) => room.id === activeRoom.id));
    snapshot();
    updateTour({
      ...current,
      stops: [
        ...current.stops,
        createTourStop(
          activeRoom.id,
          camera.x - (planOffsets.x[roomIndex] ?? 0),
          camera.z - (planOffsets.z[roomIndex] ?? 0),
          camera.yaw,
        ),
      ],
    });
  }

  function updateTourStop(id: string, patch: Partial<TourStop>) {
    if (!tour) return;
    updateTour({ ...tour, stops: tour.stops.map((stop) => (stop.id === id ? { ...stop, ...patch } : stop)) });
  }

  function moveTourStop(index: number, direction: -1 | 1) {
    if (!tour) return;
    const target = index + direction;
    if (target < 0 || target >= tour.stops.length) return;
    snapshot();
    const stops = [...tour.stops];
    [stops[index], stops[target]] = [stops[target], stops[index]];
    updateTour({ ...tour, stops });
  }

  function removeTourStop(id: string) {
    if (!tour) return;
    snapshot();
    updateTour({ ...tour, stops: tour.stops.filter((stop) => stop.id !== id) });
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
  // keeps its wall auto-rotate (same rule as updateArtwork), unless the
  // scene set the rotation itself: a wall-aware drag turns the work to
  // the wall the pointer is over, and that rotation is authoritative.
  function handleSceneArtworkUpdate(id: string, patch: { position?: [number, number, number]; scale?: number; rotation?: number }) {
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
          if (patch.rotation !== undefined) {
            next = { ...next, rotation: patch.rotation };
          } else if (activeRoom && artwork.roomId === activeRoom.id) {
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
    // Partition carry: if the dragged element is a partition, its
    // artworks follow it — grabbed from the pre-move pose (latest
    // render), released onto the new pose. The pose's length includes
    // the element's scale, so a resize-handle drag carries them too.
    const draggedBefore = latestRef.current.rooms
      .flatMap((room) => room.elements)
      .find((element) => element.id === id);
    const beforeDims = draggedBefore?.type === "partition" ? partitionDimsOf(draggedBefore) : null;
    const beforePose: PartitionPose | null =
      beforeDims && draggedBefore && !draggedBefore.locked
        ? {
            x: draggedBefore.x,
            z: draggedBefore.z,
            rotation: draggedBefore.rotation,
            length: beforeDims.length * (draggedBefore.scale ?? 1),
            height: beforeDims.height,
            thickness: beforeDims.thickness,
          }
        : null;
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
    // The carried artworks follow the partition onto its new pose
    // (the snapped target, or the new scale for a resize-handle drag).
    if (beforePose && beforeDims) {
      if (patch.scale !== undefined) {
        carryArtworksWithPartition(beforePose, { ...beforePose, length: beforeDims.length * patch.scale }, 0);
      } else if (patch.x !== undefined || patch.y !== undefined || patch.z !== undefined) {
        const target = { x: snapIfGrid(patch.x ?? beforePose.x), z: snapIfGrid(patch.z ?? beforePose.z) };
        carryArtworksWithPartition(beforePose, { ...beforePose, x: target.x, z: target.z }, 0);
      }
    }
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

  // Sunlight 3D elements, same pattern as the Asset Library above.
  const selectedSunlightElement = useMemo(
    () => rooms.flatMap((room) => room.sunlightElements ?? []).find((element) => element.id === selectedSunlightElementId),
    [rooms, selectedSunlightElementId],
  );
  const currentSunlightElements = activeRoom?.sunlightElements ?? [];

  function updateElement(id: string, patch: Partial<RoomElement>) {
    // The element may live in any room, not just the active one — update
    // the room that actually holds it.
    const owner = rooms.find((room) => room.elements.some((element) => element.id === id)) ?? activeRoom;
    if (!owner) return;
    // Partition carry: moving, turning or resizing a partition in the
    // inspector carries its artworks with it (grab before, release
    // onto the merged element).
    const element = owner.elements.find((item) => item.id === id);
    const touchesPose =
      element?.type === "partition" &&
      (patch.x !== undefined || patch.z !== undefined || patch.rotation !== undefined || patch.length !== undefined || patch.height !== undefined || patch.thickness !== undefined);
    const beforeDims = touchesPose && element ? partitionDimsOf(element) : null;
    const beforePose: PartitionPose | null =
      beforeDims && element
        ? {
            x: element.x,
            z: element.z,
            rotation: element.rotation,
            length: beforeDims.length * (element.scale ?? 1),
            height: beforeDims.height,
            thickness: beforeDims.thickness,
          }
        : null;
    updateRoom(owner.id, (room) => ({
      ...room,
      elements: room.elements.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
    if (beforePose && beforeDims && element) {
      const merged = { ...element, ...patch };
      const afterDims = partitionDimsOf(merged);
      carryArtworksWithPartition(
        beforePose,
        {
          x: merged.x,
          z: merged.z,
          rotation: merged.rotation,
          length: afterDims.length * (merged.scale ?? 1),
          height: afterDims.height,
          thickness: afterDims.thickness,
        },
        0,
      );
    }
  }

  function addElement(type: ElementType) {
    if (!activeRoom) return;
    const number = currentElements.filter((element) => element.type === type).length;
    const element = createElement(type, roomLayouts[activeRoom.layout], number, roomFloorCenterZ(activeRoom.layout));
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
    const element = createElement(type, layout, number, roomFloorCenterZ(activeRoom.layout));
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
    // A partition takes the artworks hanging on it with it (inside
    // the same undo session, so undo brings them back together).
    const element = owner.elements.find((item) => item.id === id);
    if (element?.type === "partition") {
      const dims = partitionDimsOf(element);
      deleteCarriedArtworks(
        {
          x: element.x,
          z: element.z,
          rotation: element.rotation,
          length: dims.length * (element.scale ?? 1),
          height: dims.height,
          thickness: dims.thickness,
        },
        0,
      );
    }
    updateRoom(owner.id, (room) => ({
      ...room,
      elements: room.elements.filter((item) => item.id !== id),
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

  // --- Sunlight 3D elements -------------------------------------------
  // The reference room's own pieces (cloison, suspendu, colonne, socles,
  // vitrine, banc, fauteuils, spotlights). Same add/update/remove
  // pattern as the Asset Library, but saved on the room's
  // `sunlightElements` (no groups, locks or hidden flags).

  function updateSunlightElement(id: string, patch: Partial<SunlightElement>) {
    const owner = rooms.find((room) => (room.sunlightElements ?? []).some((element) => element.id === id)) ?? activeRoom;
    if (!owner) return;
    // Partition carry: moving, turning or resizing a cloison or
    // suspendu in the inspector carries its artworks with it.
    const element = (owner.sunlightElements ?? []).find((item) => item.id === id);
    const touchesPose =
      element &&
      (element.type === "cloison" || element.type === "suspendu") &&
      (patch.x !== undefined || patch.z !== undefined || patch.rotation !== undefined || patch.length !== undefined || patch.height !== undefined || patch.thickness !== undefined);
    const beforeDims = touchesPose && element ? sunlightPartitionDimsOf(element) : null;
    const beforePose: PartitionPose | null =
      beforeDims && element
        ? {
            x: element.x,
            z: element.z,
            rotation: element.rotation,
            length: beforeDims.length,
            height: beforeDims.height,
            thickness: beforeDims.thickness,
          }
        : null;
    updateRoom(owner.id, (room) => ({
      ...room,
      sunlightElements: (room.sunlightElements ?? []).map((item) => (item.id === id ? { ...item, ...patch } : item)),
    }));
    if (beforePose && beforeDims && element) {
      const merged = { ...element, ...patch };
      const afterDims = sunlightPartitionDimsOf(merged);
      carryArtworksWithPartition(
        beforePose,
        {
          x: merged.x,
          z: merged.z,
          rotation: merged.rotation,
          length: afterDims.length,
          height: afterDims.height,
          thickness: afterDims.thickness,
        },
        beforeDims.y0,
      );
    }
  }

  // Add a Sunlight element 3 m in front of the camera (the file's
  // "placed 3 m ahead"), on the floor, clamped inside the room. The
  // spotlight count is capped at 8 (the file's maximum): the cap is
  // reported inline, never as a native alert.
  function addSunlightElement(type: SunlightElementType) {
    if (!activeRoom) return;
    if (type === "spot" && currentSunlightElements.filter((element) => element.type === "spot").length >= SUNLIGHT_MAX_SPOTS) {
      setSunlightMessage(`Maximum ${SUNLIGHT_MAX_SPOTS} spotlights — remove one to add another.`);
      return;
    }
    setSunlightMessage(null);
    const number = currentSunlightElements.filter((element) => element.type === type).length;
    const camera = cameraStateRef.current;
    // The camera state is in world coordinates; the active room sits at
    // its plan offset in the shared space (a single Sunlight room has
    // offset 0). Subtract it to get room coordinates.
    const activeIndex = Math.max(0, sceneRooms.findIndex((room) => room.id === activeRoom.id));
    const offsetX = roomPlanOffsets(sceneRooms).x[activeIndex] ?? 0;
    let x = 0;
    let z = 0;
    if (camera) {
      // Horizontal forward from the camera yaw (the element stands on
      // the floor, so pitch is ignored).
      x = camera.x - offsetX + -Math.sin(camera.yaw) * 3;
      z = camera.z + -Math.cos(camera.yaw) * 3;
    }
    x = Math.max(SUNLIGHT_ELEMENT_BOUNDS.minX, Math.min(SUNLIGHT_ELEMENT_BOUNDS.maxX, x));
    z = Math.max(SUNLIGHT_ELEMENT_BOUNDS.minZ, Math.min(SUNLIGHT_ELEMENT_BOUNDS.maxZ, z));
    const element = createSunlightElement(type, x, z, number);
    snapshot();
    updateRoom(activeRoom.id, (room) => ({ ...room, sunlightElements: [...(room.sunlightElements ?? []), element] }));
    selectSunlightElement(element.id);
  }

  // Delete works from the inspector, from the Elements list row, and
  // from the keyboard — always in the room that actually holds the
  // element, and it persists with the next save like every other edit.
  function removeSunlightElementById(id: string) {
    const owner = rooms.find((room) => (room.sunlightElements ?? []).some((element) => element.id === id));
    if (!owner) return;
    snapshot();
    // A cloison or suspendu takes the artworks hanging on it with it
    // (inside the same undo session).
    const element = (owner.sunlightElements ?? []).find((item) => item.id === id);
    if (element && (element.type === "cloison" || element.type === "suspendu")) {
      const dims = sunlightPartitionDimsOf(element);
      deleteCarriedArtworks(
        {
          x: element.x,
          z: element.z,
          rotation: element.rotation,
          length: dims.length,
          height: dims.height,
          thickness: dims.thickness,
        },
        dims.y0,
      );
    }
    updateRoom(owner.id, (room) => ({
      ...room,
      sunlightElements: (room.sunlightElements ?? []).filter((item) => item.id !== id),
    }));
    setSelectedSunlightElementId((current) => (current === id ? undefined : current));
  }

  function removeSunlightElement() {
    if (!selectedSunlightElement) return;
    removeSunlightElementById(selectedSunlightElement.id);
  }

  // The 3D scene's update path for Sunlight element drags: the dragged
  // element slides on the floor (x/z only, y is always 0) and snaps to
  // the grid when it is on. The collision block follows because the
  // walk controls rebuild it from the room's elements every frame.
  // On drop, hang the artwork on the wall under the drop point (the
  // file's putOnWall). Its rotation already adapted during the drag,
  // but its position is still on the old wall's plane — up to 0.45 m
  // off the new wall. Snapping it onto the wall (0.1 m off, facing
  // outward, at its current height) makes it sit as if just hung
  // there, never sideways or backwards. A curatorial text is an
  // artwork, so it lands the same way. Runs inside the drag's undo
  // session (beginEdit at drag start, endEdit after this), so the
  // drag + snap undo together.
  // Snap one artwork onto its wall after a drag (lib/snap-to-wall):
  // 0.1 m off, facing outward, at its current height — as if just
  // hung there, never sideways or backwards — and shifted along the
  // wall when a solid volume stands in front of it, so a dropped work
  // never ends up buried in a wall or floating mid-air.
  function handleArtworkDragEnd(id: string) {
    if (!activeRoom) return;
    const artwork = artworks.find((item) => item.id === id);
    if (!artwork || artwork.roomId !== activeRoom.id) return;
    // The dragged work AND its followers: a multi-select or grouped
    // drag moves the whole set by the same delta, so a follower that
    // started on another wall ends up off its wall too — snapping
    // only the dragged one left the followers floating or inside a
    // wall. One state update, inside the drag's undo session.
    const selectedIds = new Set(selectionRef.current.filter((ref) => ref.kind === "artwork").map((ref) => ref.id));
    const targets = artworks.filter(
      (item) =>
        item.roomId === activeRoom.id &&
        !item.sculptureUrl &&
        (item.id === id ||
          selectedIds.has(item.id) ||
          (artwork.groupId !== undefined && item.groupId === artwork.groupId)),
    );
    const snapped = new Map<string, { position: [number, number, number]; rotation: number }>();
    for (const target of targets) {
      const parsed = parseArtworkDimensions(target.dimensions ?? "");
      const next = snapArtworkToWall(
        {
          position: target.position,
          rotation: target.rotation,
          width: ((parsed?.widthCm ?? 80) / 100) * target.scale,
          height: ((parsed?.heightCm ?? 100) / 100) * target.scale,
        },
        activeRoom,
      );
      if (!next) continue;
      const moved =
        Math.abs(next.position[0] - target.position[0]) > 0.01 ||
        Math.abs(next.position[1] - target.position[1]) > 0.01 ||
        Math.abs(next.position[2] - target.position[2]) > 0.01;
      const turned = Math.abs(next.rotation - target.rotation) > 0.01;
      if (moved || turned) snapped.set(target.id, next);
    }
    if (snapped.size === 0) return;
    setArtworks((current) =>
      current.map((item) => {
        const next = snapped.get(item.id);
        return next ? { ...item, position: next.position, rotation: next.rotation } : item;
      }),
    );
  }

  function handleSceneSunlightElementUpdate(id: string, patch: { x?: number; y?: number; z?: number; scale?: number }) {
    if (patch.x === undefined && patch.z === undefined) return;
    // Partition carry: if the dragged element is a cloison or
    // suspendu, its artworks follow it — grabbed from the pre-move
    // pose, released onto the snapped target.
    const draggedBefore = latestRef.current.rooms
      .flatMap((room) => room.sunlightElements ?? [])
      .find((element) => element.id === id);
    const beforeDims =
      draggedBefore && (draggedBefore.type === "cloison" || draggedBefore.type === "suspendu")
        ? sunlightPartitionDimsOf(draggedBefore)
        : null;
    const beforePose: PartitionPose | null =
      beforeDims && draggedBefore
        ? {
            x: draggedBefore.x,
            z: draggedBefore.z,
            rotation: draggedBefore.rotation,
            length: beforeDims.length,
            height: beforeDims.height,
            thickness: beforeDims.thickness,
          }
        : null;
    setRooms((currentRooms) => {
      const owner = currentRooms.find((room) => (room.sunlightElements ?? []).some((element) => element.id === id));
      if (!owner) return currentRooms;
      return currentRooms.map((room) => (room.id === owner.id
        ? {
            ...room,
            sunlightElements: (room.sunlightElements ?? []).map((element) => (element.id === id
              ? { ...element, x: snapIfGrid(patch.x ?? element.x), z: snapIfGrid(patch.z ?? element.z) }
              : element)),
          }
        : room));
    });
    if (beforePose && beforeDims) {
      const target = { x: snapIfGrid(patch.x ?? beforePose.x), z: snapIfGrid(patch.z ?? beforePose.z) };
      carryArtworksWithPartition(beforePose, { ...beforePose, x: target.x, z: target.z }, beforeDims.y0);
    }
    setSaved(false);
  }

  // Delete key removes the whole selection (artworks and elements) —
  // the same delete the inspector button does, without reaching for the
  // mouse. Never fires while typing in a field.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable)) return;
      if (selectionRefs.length > 0) {
        event.preventDefault();
        deleteSelection();
      } else if (selectedSunlightElementId) {
        // A Sunlight element is a single selection outside the
        // artwork/element multi-selection: Delete removes it too.
        event.preventDefault();
        removeSunlightElementById(selectedSunlightElementId);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectionRefs, selectedSunlightElementId]);

  // Ctrl+Z / Cmd+Z undoes one real action (artworks, elements, room
  // settings); Ctrl+Shift+Z / Ctrl+Y redoes it. Never fires while typing
  // in a field, so the browser's own text undo keeps working there.
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
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
  }, []);

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
    // Keep in sync with the server-side imageUrl check in
    // lib/validation.ts: a URL the server rejects must not pass here,
    // and a URL the server accepts must not be blocked here.
    if (/^\/api\/(?:uploads\/[a-f0-9-]+\.webp|portfolio-artworks\/[a-z0-9-]+\.(?:jpg|jpeg|webp)|r2\/uploads\/[A-Za-z0-9_-]+\/[a-f0-9-]{36}\.(?:png|jpe?g|webp|avif|heic|heif))$/i.test(url)) return true;
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
    if (artwork.videoUrl && !isVideoServingUrl(artwork.videoUrl)) {
      problems.push("a re-uploaded video (this video link cannot be saved)");
    }
    if (artwork.sculptureUrl && !isSculptureServingUrl(artwork.sculptureUrl)) {
      problems.push("a re-uploaded sculpture (this sculpture link cannot be saved)");
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
          tour,
          audioUrl: music?.url ?? null,
          audioTitle: music?.title.trim() ? music.title.trim() : null,
          audioLoop: music?.loop ?? true,
          audioVolume: music?.volume ?? 0.5,
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
  }, [artworks, rooms, title, description, tour, saved, loading, loadFailed]);

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
            tour: current.tour ?? null,
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
    // Only snapshots that actually carry a tour restore one — an older
    // snapshot (before tours existed) never clears the current tour.
    if (data.tour !== undefined) setTour(parseGuidedTour(data.tour));
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

  // Place a new artwork (or a text panel) where the visitor can
  // actually see it (lib/place-in-view.ts): on the wall the camera
  // is looking at, clamped into a safe cone around the gaze
  // (±20° horizontal) so the ±2 m spread of consecutive adds can
  // never push the work off-screen — the old code hung it at the
  // ray's hit point plus the spread, and at a wall 1–2 m away that
  // is 45–63° off axis, invisible. When no wall is in view at all
  // the work goes on the face most in front of the camera, NOT the
  // blind back wall (which can sit behind the camera), and
  // `turnYaw` carries the yaw the camera must turn to for the work
  // to be centred — the editor turns the view gently toward it.
  // `turnYaw` is null when the work already sits in view.
  // Every wall can carry one — the room's four walls, the three
  // freestanding panels, and any cloison/suspendu the user added.
  function placeOnCameraWall(width: number, height: number, alongOffset = 0): { position: [number, number, number]; rotation: number; turnYaw: number | null } {
    if (!activeRoom) {
      return { position: [0, PLACE_IN_VIEW_EYE_Y, 0], rotation: 0, turnYaw: null };
    }
    const layout = activeRoom.layout;
    // The camera state is in world coordinates; convert to the
    // active room's local frame (subtract the room's plan offset).
    // Before the scene reports a camera (first frame), fall back to
    // the room's entrance pose — facing the back wall from the
    // entrance — instead of hanging the work blind.
    const activeIndex = Math.max(0, sceneRooms.findIndex((room) => room.id === activeRoom.id));
    const offsetX = roomPlanOffsets(sceneRooms).x[activeIndex] ?? 0;
    const camera = cameraStateRef.current;
    const localCamera = camera
      ? { x: camera.x - offsetX, y: camera.y, z: camera.z, yaw: camera.yaw, pitch: camera.pitch }
      : galleryCameraStart(layout);
    const faces =
      layout === "sunlight"
        ? sunlightHangWalls(activeRoom.sunlightElements ?? [])
        : galleryHangWalls(layout, activeRoom.elements);
    const placed = placeArtworkInView(localCamera, faces, width, height, alongOffset);
    // The placement is room-local; the artwork position the editor
    // stores is room-local too (the scene adds the room offset).
    return { position: placed.position, rotation: placed.rotation, turnYaw: placed.needsTurn ? placed.yawToFace : null };
  }

  // The hangable face the camera is looking at (the same raycast
  // placeOnCameraWall uses, but returning the face instead of a
  // position): the default wall for a composition, so the curator
  // usually does not have to pick one. Null when the camera looks at
  // no wall (or before the scene reports a camera).
  function cameraWallFace(): HangWallFace | null {
    const camera = cameraStateRef.current;
    if (!camera || !activeRoom) return null;
    const direction = {
      x: -Math.cos(camera.pitch) * Math.sin(camera.yaw),
      y: Math.sin(camera.pitch),
      z: -Math.cos(camera.pitch) * Math.cos(camera.yaw),
    };
    const activeIndex = Math.max(0, sceneRooms.findIndex((room) => room.id === activeRoom.id));
    const offsetX = roomPlanOffsets(sceneRooms).x[activeIndex] ?? 0;
    const origin = { x: camera.x - offsetX, y: camera.y, z: camera.z };
    const hit = activeRoom.layout !== "sunlight"
      ? galleryWallHit(origin, direction, activeRoom.layout, activeRoom.elements)
      : sunlightWallHit(origin, direction, activeRoom.sunlightElements ?? []);
    return hit?.face ?? null;
  }

  // Open the compose panel, defaulting to the wall the camera is
  // looking at (or the room's first hangable wall).
  function openComposePanel() {
    const face = cameraWallFace() ?? composeFaces[0];
    setComposeWallId(face?.id ?? null);
    setComposeMessage(null);
    setComposeOpen(true);
  }

  // The solid volumes standing in front of a room's walls, for
  // Compose and for the layout-change re-hang below: the room's own
  // collision blocks (the Arche dividing wall joins its side walls)
  // plus the blocks of the room's partition elements. A block that
  // straddles a wall's own plane is the wall itself and forbids
  // nothing there (see lib/compose-wall.ts).
  function roomObstacles(room: GalleryRoom): ComposeObstacle[] {
    return room.layout === "sunlight"
      ? [...SUNLIGHT_BLOCKS, ...sunlightElementCollisionBlocks(room.sunlightElements ?? [])]
      : [
          ...(galleryDef(room.layout)?.blocks ?? []),
          ...(room.elements ?? [])
            .filter((element) => element.type === "partition" && !element.hidden)
            .map((element) => {
              const dims = partitionDimsOf(element);
              return {
                x: element.x,
                z: element.z,
                ry: element.rotation,
                hl: (dims.length * (element.scale ?? 1)) / 2,
                hw: dims.thickness / 2,
              };
            }),
        ];
  }

  // Automatic wall composition ("Compose wall"): place the selected
  // artworks of the active room on the chosen wall — one row at eye
  // level when they fit, otherwise as many as the wall holds (see
  // lib/compose-wall.ts). One snapshot, one state update: the whole
  // composition undoes in a single step, and the curator drags
  // anything that does not please them afterwards.
  function applyComposition() {
    if (!activeRoom) return;
    const face = composeFaces.find((item) => item.id === composeWallId)
      ?? cameraWallFace()
      ?? composeFaces[0];
    if (!face) {
      setComposeMessage("This room has no hangable wall to compose on.");
      return;
    }
    const items: ComposeItem[] = composeCandidates.map((artwork) => {
      const parsed = parseArtworkDimensions(artwork.dimensions ?? "");
      return {
        id: artwork.id,
        title: artwork.title,
        width: ((parsed?.widthCm ?? 80) / 100) * artwork.scale,
        height: ((parsed?.heightCm ?? 100) / 100) * artwork.scale,
        dominantFamily: dominantFamilyOf(artwork.palette),
      };
    });
    // The solid volumes standing in front of the chosen wall: the
    // room's own collision blocks plus the blocks of its elements
    // (see roomObstacles above).
    const obstacles = roomObstacles(activeRoom);
    const result = composeWall(items, face, obstacles);
    setComposeMessage(result.message);
    if (result.placements.length === 0) return;
    const byId = new Map(result.placements.map((placement) => [placement.id, placement]));
    snapshot();
    setArtworks((current) => current.map((artwork) => {
      const placement = byId.get(artwork.id);
      return placement ? { ...artwork, position: placement.position, rotation: placement.rotation } : artwork;
    }));
    setSaved(false);
  }

  // The artist a newly created artwork or text carries: the most
  // common non-empty artist among the works already in this show, so
  // a solo show's texts and uploads carry the artist automatically
  // instead of leaving the field undefined — an undefined artist
  // fails the save validation ("expected string, received undefined")
  // and blocks every save until the field is filled by hand. Empty
  // when the show has no artist yet (the server defaults it to "").
  function defaultArtist(): string {
    const counts = new Map<string, number>();
    for (const item of artworks) {
      const name = item.artist?.trim();
      if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    }
    let best = "";
    let bestCount = 0;
    for (const [name, count] of counts) {
      if (count > bestCount) {
        best = name;
        bestCount = count;
      }
    }
    return best;
  }

  // Curatorial text (the reference room's "Texte curatorial"): a text
  // panel as an artwork, on the wall the camera is looking at. The
  // panel is 1.4 m wide; its height follows the wrapped text, and the
  // artwork's dimensions field carries that size so it renders at true
  // scale. Saved like any artwork, so it persists and reloads.
  function addCuratorialText() {
    if (!activeRoom) return;
    const text = curatorialText.trim();
    if (!text) {
      setSunlightMessage("Write the text first, then add it to the wall.");
      return;
    }
    setSunlightMessage(null);
    const size = sunlightTextArtworkSize(text, curatorialTextFont);
    const { position, rotation, turnYaw } = placeOnCameraWall(size.width, size.height);
    const artwork: Artwork = {
      id: crypto.randomUUID(),
      title: "Curatorial text",
      artist: defaultArtist(),
      year: "",
      medium: "Curatorial text",
      dimensions: `140 × ${Math.round(size.height * 100)} cm`,
      description: "",
      color: "#f6f6f4",
      accent: "#2a2623",
      position,
      rotation,
      scale: 1,
      frame: "none",
      imageUrl: null,
      text,
      textFont: curatorialTextFont,
      roomId: activeRoom.id,
    };
    snapshot();
    setArtworks((current) => [...current, artwork]);
    selectArtwork(artwork.id);
    revealNewArtwork(artwork.id, turnYaw);
    setSaved(false);
  }

  // Replace the selected text artwork's text and typeface, keeping its
  // position, rotation and scale (the file's "Modifier le texte
  // sélectionné"). The panel height follows the new text.
  function modifyCuratorialText() {
    const artwork = artworks.find((item) => item.id === selectedId);
    if (!artwork || !artwork.text) {
      setSunlightMessage("Select a curatorial text artwork first, then modify it.");
      return;
    }
    const text = curatorialText.trim();
    if (!text) {
      setSunlightMessage("Write the new text first, then modify the selected text.");
      return;
    }
    setSunlightMessage(null);
    const size = sunlightTextArtworkSize(text, curatorialTextFont);
    snapshot();
    setArtworks((current) => current.map((item) => (item.id === artwork.id
      ? { ...item, text, textFont: curatorialTextFont, dimensions: `140 × ${Math.round(size.height * 100)} cm` }
      : item)));
    setSaved(false);
  }

  function addArtwork(imageUrl: string | null = null, palette: string[] | null = null): string | undefined {
    if (!activeRoom) return undefined;
    const index = currentArtworks.length;
    // New artworks go on the wall the camera is looking at (every wall
    // can carry one, including an added cloison/suspendu), spread along
    // the wall so consecutive adds do not stack — clamped into the
    // view cone, and the view turns gently toward the work when no
    // wall is in view (see placeOnCameraWall).
    const alongOffset = (index % 5 - 2) * 1.0;
    const { position, rotation, turnYaw } = placeOnCameraWall(0.8, 1.0, alongOffset);
    const artwork: Artwork = {
      id: crypto.randomUUID(),
      title: `New artwork ${index + 1}`,
      artist: defaultArtist(),
      year: "2025",
      medium: "Mixed media",
      dimensions: "80 × 100 cm",
      description: "Add a description to tell visitors about this work.",
      color: ["#8a9b88", "#bb8365", "#8796a9"][index % 3],
      accent: "#e5c7a0",
      position,
      rotation,
      scale: 1,
      frame: "wood",
      imageUrl,
      palette,
      roomId: activeRoom.id,
    };
    snapshot();
    setArtworks((current) => [...current, artwork]);
    selectArtwork(artwork.id);
    revealNewArtwork(artwork.id, turnYaw);
    setSaved(false);
    return artwork.id;
  }

  // Add a video artwork: same camera-wall placement as addArtwork, but
  // a 16:9 frame (128 × 72 cm — the dimensions field drives the wall
  // size, so a video hangs at 1.28 × 0.72 m, not at the 80 × 100 cm
  // portrait default). The video itself is the media; there is no
  // image, no palette to extract and no caption to generate. Compose,
  // drag and snap treat it exactly like an image artwork afterwards —
  // they only read position, rotation, scale and dimensions.
  function addVideoArtwork(videoUrl: string): string | undefined {
    if (!activeRoom) return undefined;
    const index = currentArtworks.length;
    const alongOffset = (index % 5 - 2) * 1.0;
    const { position, rotation, turnYaw } = placeOnCameraWall(1.28, 0.72, alongOffset);
    const artwork: Artwork = {
      id: crypto.randomUUID(),
      title: `New video artwork ${index + 1}`,
      artist: defaultArtist(),
      year: "2025",
      medium: "Video, MP4",
      dimensions: "128 × 72 cm",
      description: "Add a description to tell visitors about this work.",
      color: ["#8a9b88", "#bb8365", "#8796a9"][index % 3],
      accent: "#e5c7a0",
      position,
      rotation,
      scale: 1,
      frame: "wood",
      imageUrl: null,
      videoUrl,
      palette: null,
      roomId: activeRoom.id,
    };
    snapshot();
    setArtworks((current) => [...current, artwork]);
    selectArtwork(artwork.id);
    revealNewArtwork(artwork.id, turnYaw);
    setSaved(false);
    return artwork.id;
  }

  // Place a sculpture on the floor, 3 m in front of the camera (room
  // coordinates), facing the camera — the pedestal needs open floor,
  // not a wall. Before the scene reports a camera, fall back to the
  // room's centre. Clamped inside the room so the pedestal never
  // lands in a wall.
  function placeSculptureOnFloor(): { position: [number, number, number]; rotation: number } {
    if (!activeRoom) return { position: [0, 0, 2], rotation: 0 };
    const layout = roomLayouts[activeRoom.layout];
    const zCenter = roomFloorCenterZ(activeRoom.layout);
    const activeIndex = Math.max(0, sceneRooms.findIndex((room) => room.id === activeRoom.id));
    const offsetX = roomPlanOffsets(sceneRooms).x[activeIndex] ?? 0;
    const camera = cameraStateRef.current;
    const localCamera = camera
      ? { x: camera.x - offsetX, y: camera.y, z: camera.z, yaw: camera.yaw }
      : galleryCameraStart(activeRoom.layout);
    const fx = -Math.sin(localCamera.yaw);
    const fz = -Math.cos(localCamera.yaw);
    const x = Math.max(-layout.width / 2 + 0.6, Math.min(layout.width / 2 - 0.6, localCamera.x + fx * 3));
    const z = Math.max(zCenter - layout.depth / 2 + 0.6, Math.min(zCenter + layout.depth / 2 - 0.6, localCamera.z + fz * 3));
    // Face the camera: the pedestal's front (+Z after rotation) looks
    // back along the direction the visitor came from.
    const rotation = Math.atan2(localCamera.x - x, localCamera.z - z);
    return { position: [x, 0, z], rotation };
  }

  // Add a sculpture artwork: same flow as addVideoArtwork, but on the
  // floor on its automatic pedestal (placeSculptureOnFloor) instead
  // of on a wall. The GLB is the media; there is no image, no palette
  // to extract and no caption to generate. Dimensions are the
  // pedestal + model envelope (60 cm wide, up to ~190 cm tall).
  function addSculptureArtwork(sculptureUrl: string): string | undefined {
    if (!activeRoom) return undefined;
    const index = currentArtworks.length;
    const { position, rotation } = placeSculptureOnFloor();
    const artwork: Artwork = {
      id: crypto.randomUUID(),
      title: `New sculpture ${index + 1}`,
      artist: defaultArtist(),
      year: "2025",
      medium: "Sculpture, GLB",
      dimensions: "60 × 190 cm",
      description: "Add a description to tell visitors about this work.",
      color: ["#8a9b88", "#bb8365", "#8796a9"][index % 3],
      accent: "#e5c7a0",
      position,
      rotation,
      scale: 1,
      frame: "wood",
      imageUrl: null,
      videoUrl: null,
      sculptureUrl,
      palette: null,
      roomId: activeRoom.id,
    };
    snapshot();
    setArtworks((current) => [...current, artwork]);
    selectArtwork(artwork.id);
    revealNewArtwork(artwork.id, null);
    setSaved(false);
    return artwork.id;
  }

  async function openLibraryPicker() {
    setShowLibraryPicker((value) => !value);
    if (libraryLoaded || libraryLoading) return;
    setLibraryLoading(true);
    setLibraryError(null);
    try {
      const response = await fetch("/api/library");
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error ?? t("library", "couldNotLoad"));
      setLibraryWorks(result.works ?? []);
      setLibraryLoaded(true);
    } catch (error) {
      console.error("Could not load library.", error);
      setLibraryError(error instanceof Error ? error.message : t("library", "couldNotLoad"));
    } finally {
      setLibraryLoading(false);
    }
  }

  // Add a library work to this room: a COPY — the same imageUrl (the
  // same R2 file, no upload), the library's metadata, a fresh id and
  // the camera-wall placement addArtwork uses. A video library work
  // copies its videoUrl the same way (same R2 file, no re-upload) and
  // keeps its own dimensions — a 16:9 video must not be squeezed into
  // the 80 × 100 cm image default. The copy is
  // independent afterwards and only persists when the exhibition is
  // saved (the save also re-records it in the library, which is a
  // no-op — the row already exists).
  function addLibraryArtwork(work: LibraryPickerWork): string | undefined {
    if (!activeRoom) return undefined;
    const index = currentArtworks.length;
    const alongOffset = (index % 5 - 2) * 1.0;
    // A sculpture library work stands on the floor (its pedestal),
    // never on the camera wall — same placement addSculptureArtwork
    // uses. Every other work keeps the camera-wall placement.
    const sculpturePlacement = work.sculptureUrl ? placeSculptureOnFloor() : null;
    const { position, rotation, turnYaw } = sculpturePlacement
      ? { position: sculpturePlacement.position, rotation: sculpturePlacement.rotation, turnYaw: null }
      : placeOnCameraWall(0.8, 1.0, alongOffset);
    const artwork: Artwork = {
      id: crypto.randomUUID(),
      title: work.title,
      artist: work.artist || defaultArtist(),
      year: work.year || "2025",
      medium: work.medium || (work.sculptureUrl ? "Sculpture, GLB" : "Mixed media"),
      dimensions: work.dimensions || (work.sculptureUrl ? "60 × 190 cm" : "80 × 100 cm"),
      description: work.description || "Add a description to tell visitors about this work.",
      color: ["#8a9b88", "#bb8365", "#8796a9"][index % 3],
      accent: "#e5c7a0",
      position,
      rotation,
      scale: 1,
      frame: work.frame || "wood",
      imageUrl: work.imageUrl,
      videoUrl: work.videoUrl,
      sculptureUrl: work.sculptureUrl ?? null,
      palette: work.palette,
      altText: work.altText,
      roomId: activeRoom.id,
    };
    snapshot();
    setArtworks((current) => [...current, artwork]);
    selectArtwork(artwork.id);
    revealNewArtwork(artwork.id, turnYaw);
    setShowLibraryPicker(false);
    setSaved(false);
    return artwork.id;
  }

// Photos from a phone are often over Vercel's 4.5 MB request limit, which
// rejects the upload before it reaches the server (HTTP 413, plain text).
// Shrink big files in the browser first so they always fit. On any failure
// (e.g. HEIC, which canvas cannot decode) the original file is sent and the
// server answers with a readable error instead.
async function compressImage(file: File): Promise<File> {
  if (file.size <= 3_500_000) return file;
  const bitmap = await createImageBitmap(file);
  // SANAA keeps images at up to 4096 px (4k); only larger images are
  // shrunk to that ceiling (JPEG 0.85), so they still fit Vercel's
  // 4.5 MB request cap.
  const scale = Math.min(1, 4096 / Math.max(bitmap.width, bitmap.height));
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

  // Upload to R2 through the server proxy (/api/uploads/r2). The browser
  // used to PUT straight to R2 via a presigned URL, but the bucket has no
  // CORS policy, so the browser's preflight fails and fetch rejects with
  // "Failed to fetch" — that is the error users kept seeing on every image
  // upload. The bytes now go through this same-origin route and the server
  // puts them in R2, so no CORS is involved. Trade-off: Vercel caps the
  // body at 4.5 MB (the editor compresses first), and an oversized file
  // gets a clear message. Once a CORS policy is set on the bucket, the
  // presigned direct upload can be re-enabled to lift the cap.
  // Returns the public URL — the same-origin serving URL (/api/r2/...)
  // so the image loads as a 3D texture without CORS — or null when R2
  // is not configured so the caller can fall back to the legacy
  // database upload.
  async function uploadToR2(file: File): Promise<string | null> {
    const body = new FormData();
    body.set("file", file);
    let response: Response;
    try {
      response = await fetch("/api/uploads/r2", { method: "POST", body });
    } catch {
      // A network failure (not an HTTP error): never surface the raw
      // browser "Failed to fetch" — say what happened in plain words.
      throw new Error("Could not reach the server to upload this image. Check your connection and try again.");
    }
    if (response.status === 501) return null;
    // Read as text first: an error page (e.g. Vercel's plain-text 413 for
    // an oversized request) is not JSON and used to throw a cryptic
    // "Unexpected end of JSON input" instead of a readable error.
    const text = await response.text();
    let result: { error?: string; url?: string } = {};
    try {
      result = text ? (JSON.parse(text) as typeof result) : {};
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
    return result.url;
  }

  // Upload one image file and return its public URL (R2 when configured,
  // otherwise the legacy database upload). Shared by adding a new
  // artwork and by replacing the selected artwork's image.
  async function uploadImageFile(file: File): Promise<string> {
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
    return url;
  }

  // Upload one music track (MP3/AAC, ≤ 4.5 MB) to R2 via the dedicated
  // audio proxy and keep it as the exhibition's background music. The
  // file name (without extension) becomes the default title; the
  // visitor hears it from the "Enter" click, on loop. Removing the
  // track later only clears the exhibition fields — the R2 file stays
  // (no DeleteObject in the code yet; see the schema comment).
  const MUSIC_MAX_SIZE = 4_500_000;
  const MUSIC_TYPES = ["audio/mpeg", "audio/mp3", "audio/mp4", "audio/x-m4a"];
  async function uploadMusicFile(file?: File) {
    if (!file) return;
    setMusicError(null);
    const name = file.name.toLowerCase();
    const looksAudio =
      MUSIC_TYPES.includes(file.type.toLowerCase()) || name.endsWith(".mp3") || name.endsWith(".m4a");
    if (!looksAudio) {
      setMusicError(t("music", "musicInvalidFormat"));
      return;
    }
    if (file.size === 0 || file.size > MUSIC_MAX_SIZE) {
      setMusicError(t("music", "musicTooLarge"));
      return;
    }
    setBusy(true);
    setMusicUploading(true);
    try {
      const body = new FormData();
      body.set("file", file);
      let response: Response;
      try {
        response = await fetch("/api/uploads/audio", { method: "POST", body });
      } catch {
        throw new Error(t("music", "musicUploadFailed"));
      }
      // Read as text first: an error page (e.g. Vercel's plain-text 413
      // for an oversized request) is not JSON.
      const text = await response.text();
      let result: { error?: string; url?: string } = {};
      try {
        result = text ? (JSON.parse(text) as typeof result) : {};
      } catch {
        result = {};
      }
      if (!response.ok) {
        throw new Error(
          result.error ??
            (response.status === 413 ? t("music", "musicTooLarge") : t("music", "musicUploadFailed")),
        );
      }
      if (!result.url) throw new Error(t("music", "musicUploadFailed"));
      const title = file.name.replace(/\.[^.]+$/, "").trim();
      updateMusic({ url: result.url, title, loop: true, volume: 0.5 });
      if (musicFileRef.current) musicFileRef.current.value = "";
    } catch (error) {
      console.error("Could not upload music.", error);
      setMusicError(error instanceof Error ? error.message : t("music", "musicUploadFailed"));
    } finally {
      setBusy(false);
      setMusicUploading(false);
    }
  }

  async function uploadArtwork(file?: File) {
    if (!file) return;
    setBusy(true);
    setUploadError(null);
    try {
      // The palette is read from the file itself while it uploads —
      // decoding locally, so no extra network fetch and no wait after
      // the upload. A failed read just leaves the palette empty; the
      // editor retries it lazily when the artwork is selected.
      const [url, palette] = await Promise.all([uploadImageFile(file), extractPalette(file)]);
      const artworkId = addArtwork(url, palette);
      // The description is generated in the background (captioning model, in the
      // browser): the model downloads once, then is cached. It never
      // blocks the upload; a failure just leaves the description and
      // alt-text empty, and the manual button retries it.
      if (artworkId) void describeArtwork(artworkId, file, url);
      if (uploadRef.current) uploadRef.current.value = "";
    } catch (error) {
      console.error("Could not upload artwork.", error);
      setUploadError(error instanceof Error ? error.message : "Could not upload this image.");
    } finally {
      setBusy(false);
    }
  }

  // Replace the selected artwork's image (e.g. a Stone Gallery
  // placeholder) with an uploaded one. The artwork itself — title,
  // position, size, frame — stays put, only the image changes.
  async function replaceArtworkImage(file?: File) {
    if (!file || !selected) return;
    setBusy(true);
    setUploadError(null);
    try {
      const [url, palette] = await Promise.all([uploadImageFile(file), extractPalette(file)]);
      snapshot();
      // A new image gets a new palette; when the read fails the palette
      // is cleared so the lazy pass re-reads it on selection instead of
      // keeping the old image's colours.
      updateArtwork(selected.id, (artwork) => ({ ...artwork, imageUrl: url, palette }));
      // The description follows the new image (captioning model, in the background):
      // a still-unchanged suggestion is replaced, the artist's own words
      // are kept.
      void describeArtwork(selected.id, file, url);
      if (replaceImageRef.current) replaceImageRef.current.value = "";
    } catch (error) {
      console.error("Could not replace artwork image.", error);
      setUploadError(error instanceof Error ? error.message : "Could not upload this image.");
    } finally {
      setBusy(false);
    }
  }

  // Upload one video file (MP4 H.264, ≤ 4.5 MB) to R2 via the dedicated
  // video proxy and hang it as a video artwork (addVideoArtwork). The
  // file name (without extension) becomes the working title only when
  // the artist renames it — the artwork starts as "New video artwork
  // N", like an image upload. Errors are inline (setUploadError), never
  // window.alert. Removing a video later only clears the artwork's
  // videoUrl — the R2 file stays (no DeleteObject in the code yet; same
  // policy as music and images).
  async function uploadVideoFile(file: File): Promise<string> {
    const body = new FormData();
    body.set("file", file);
    let response: Response;
    try {
      response = await fetch("/api/uploads/video", { method: "POST", body });
    } catch {
      // A network failure (not an HTTP error): never surface the raw
      // browser "Failed to fetch" — say what happened in plain words.
      throw new Error(t("video", "videoUploadFailed"));
    }
    // Read as text first: an error page (e.g. Vercel's plain-text 413 for
    // an oversized request) is not JSON and used to throw a cryptic
    // "Unexpected end of JSON input" instead of a readable error.
    const text = await response.text();
    let result: { error?: string; url?: string } = {};
    try {
      result = text ? (JSON.parse(text) as typeof result) : {};
    } catch {
      result = {};
    }
    if (!response.ok) {
      throw new Error(
        result.error ??
          (response.status === 413 ? t("video", "videoTooLarge") : t("video", "videoUploadFailed")),
      );
    }
    if (!result.url) throw new Error(t("video", "videoUploadFailed"));
    return result.url;
  }

  async function uploadVideoArtwork(file?: File) {
    if (!file) return;
    const name = file.name.toLowerCase();
    const looksVideo = file.type.toLowerCase() === "video/mp4" || name.endsWith(".mp4");
    if (!looksVideo) {
      setUploadError(t("video", "videoInvalidFormat"));
      return;
    }
    if (file.size === 0 || file.size > VIDEO_MAX_FILE_SIZE) {
      setUploadError(t("video", "videoTooLarge"));
      return;
    }
    setBusy(true);
    setUploadError(null);
    try {
      const url = await uploadVideoFile(file);
      addVideoArtwork(url);
      if (videoUploadRef.current) videoUploadRef.current.value = "";
    } catch (error) {
      console.error("Could not upload video artwork.", error);
      setUploadError(error instanceof Error ? error.message : t("video", "videoUploadFailed"));
    } finally {
      setBusy(false);
    }
  }

  // Replace the selected artwork's video with an uploaded one. The
  // artwork itself — title, position, size, frame — stays put, only
  // the video changes. Replacing a video with a video keeps it a video
  // artwork; the imageUrl stays as it was (null, or a poster).
  async function replaceArtworkVideo(file?: File) {
    if (!file || !selected) return;
    const name = file.name.toLowerCase();
    const looksVideo = file.type.toLowerCase() === "video/mp4" || name.endsWith(".mp4");
    if (!looksVideo) {
      setUploadError(t("video", "videoInvalidFormat"));
      return;
    }
    if (file.size === 0 || file.size > VIDEO_MAX_FILE_SIZE) {
      setUploadError(t("video", "videoTooLarge"));
      return;
    }
    setBusy(true);
    setUploadError(null);
    try {
      const url = await uploadVideoFile(file);
      snapshot();
      updateArtwork(selected.id, (artwork) => ({ ...artwork, videoUrl: url }));
      if (replaceVideoRef.current) replaceVideoRef.current.value = "";
    } catch (error) {
      console.error("Could not replace artwork video.", error);
      setUploadError(error instanceof Error ? error.message : t("video", "videoUploadFailed"));
    } finally {
      setBusy(false);
    }
  }

  // Upload one sculpture file (GLB, ≤ 4.5 MB) to R2 via the dedicated
  // sculpture proxy and stand it on its pedestal (addSculptureArtwork).
  // The artwork starts as "New sculpture N", like an image upload.
  // Errors are inline (setUploadError), never window.alert. Removing a
  // sculpture later only clears the artwork's sculptureUrl — the R2
  // file stays (no DeleteObject in the code yet; same policy as music,
  // images and video).
  async function uploadSculptureFile(file: File): Promise<string> {
    const body = new FormData();
    body.set("file", file);
    let response: Response;
    try {
      response = await fetch("/api/uploads/sculpture", { method: "POST", body });
    } catch {
      // A network failure (not an HTTP error): never surface the raw
      // browser "Failed to fetch" — say what happened in plain words.
      throw new Error(t("sculpture", "sculptureUploadFailed"));
    }
    // Read as text first: an error page (e.g. Vercel's plain-text 413 for
    // an oversized request) is not JSON and used to throw a cryptic
    // "Unexpected end of JSON input" instead of a readable error.
    const text = await response.text();
    let result: { error?: string; url?: string } = {};
    try {
      result = text ? (JSON.parse(text) as typeof result) : {};
    } catch {
      result = {};
    }
    if (!response.ok) {
      throw new Error(
        result.error ??
          (response.status === 413 ? t("sculpture", "sculptureTooLarge") : t("sculpture", "sculptureUploadFailed")),
      );
    }
    if (!result.url) throw new Error(t("sculpture", "sculptureUploadFailed"));
    return result.url;
  }

  async function uploadSculptureArtwork(file?: File) {
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".glb")) {
      setUploadError(t("sculpture", "sculptureInvalidFormat"));
      return;
    }
    if (file.size === 0 || file.size > SCULPTURE_MAX_FILE_SIZE) {
      setUploadError(t("sculpture", "sculptureTooLarge"));
      return;
    }
    setBusy(true);
    setUploadError(null);
    try {
      const url = await uploadSculptureFile(file);
      addSculptureArtwork(url);
      if (sculptureUploadRef.current) sculptureUploadRef.current.value = "";
    } catch (error) {
      console.error("Could not upload sculpture artwork.", error);
      setUploadError(error instanceof Error ? error.message : t("sculpture", "sculptureUploadFailed"));
    } finally {
      setBusy(false);
    }
  }

  // Replace the selected sculpture with an uploaded one. The artwork
  // itself — title, pedestal position, scale — stays put, only the
  // GLB changes.
  async function replaceArtworkSculpture(file?: File) {
    if (!file || !selected) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith(".glb")) {
      setUploadError(t("sculpture", "sculptureInvalidFormat"));
      return;
    }
    if (file.size === 0 || file.size > SCULPTURE_MAX_FILE_SIZE) {
      setUploadError(t("sculpture", "sculptureTooLarge"));
      return;
    }
    setBusy(true);
    setUploadError(null);
    try {
      const url = await uploadSculptureFile(file);
      snapshot();
      updateArtwork(selected.id, (artwork) => ({ ...artwork, sculptureUrl: url }));
      if (replaceSculptureRef.current) replaceSculptureRef.current.value = "";
    } catch (error) {
      console.error("Could not replace artwork sculpture.", error);
      setUploadError(error instanceof Error ? error.message : t("sculpture", "sculptureUploadFailed"));
    } finally {
      setBusy(false);
    }
  }

  // Publishing (feature 8): a draft opens the visibility dialog; a
  // published show unpublishes with the old toggle (no body). The dialog
  // passes the chosen visibility (and password, when protected) plus
  // publishToFeed — false when the author unchecked the feed.
  async function publishExhibition(nextVisibility?: PublishVisibility, password?: string, publishToFeed?: boolean) {
    if (!saved && !(await saveExhibition())) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/exhibitions/${exhibitionId}/publish`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body:
          nextVisibility === undefined
            ? undefined
            : JSON.stringify({
                visibility: nextVisibility,
                ...(password === undefined ? {} : { password }),
                ...(publishToFeed === undefined ? {} : { publishToFeed }),
              }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Could not publish this exhibition.");
      setStatus(result.status);
      setSlug(result.slug);
      if (result.visibility) setVisibility(result.visibility);
      setShowPublishDialog(false);
    } catch (error) {
      console.error("Could not publish exhibition.", error);
      setSaveError(error instanceof Error ? error.message : "Could not publish this exhibition.");
      throw error;
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
    if (!selected || !activeRoom) return;
    // The copy sits 1.5 m along the SAME wall as the original — the
    // offset follows the wall's own axis (cos r, −sin r), not world X:
    // a +1.5 m world-X shift on a side-wall work pushed the copy 1.5 m
    // off its wall, floating mid-room (or inside the opposite wall),
    // and the copy was saved like that. The snap then seats it 0.1 m
    // off its wall, clear of any solid volume.
    const axis = { x: Math.cos(selected.rotation), z: -Math.sin(selected.rotation) };
    const copy: LayerArtwork = {
      ...selected,
      id: crypto.randomUUID(),
      title: `${selected.title} copy`.slice(0, 120),
      position: [
        selected.position[0] + axis.x * 1.5,
        selected.position[1],
        selected.position[2] + axis.z * 1.5,
      ],
      // A copy starts ungrouped, visible and unlocked.
      hidden: false,
      locked: false,
      groupId: undefined,
    };
    const parsed = parseArtworkDimensions(copy.dimensions ?? "");
    // A sculpture copy stays on the floor, 1.5 m along the floor from
    // the original — never snapped onto a wall.
    if (selected.sculptureUrl) {
      copy.position = [selected.position[0] + axis.x * 1.5, 0, selected.position[2] + axis.z * 1.5];
      snapshot();
      setArtworks((current) => [...current, copy]);
      selectArtwork(copy.id);
      setSaved(false);
      return;
    }
    const snapped = snapArtworkToWall(
      {
        position: copy.position,
        rotation: copy.rotation,
        width: ((parsed?.widthCm ?? 80) / 100) * copy.scale,
        height: ((parsed?.heightCm ?? 100) / 100) * copy.scale,
      },
      activeRoom,
    );
    if (snapped) {
      copy.position = snapped.position;
      copy.rotation = snapped.rotation;
    }
    snapshot();
    setArtworks((current) => [...current, copy]);
    selectArtwork(copy.id);
    setSaved(false);
  }

  // "Fit to wall": seat the selected artwork on its nearest wall at
  // eye level, at true scale. The old handler parked every artwork at
  // the hardcoded position [0, 1.55, −5.72] — a spot that belongs to
  // no room in particular — so in most galleries the work landed
  // floating mid-room or inside a wall.
  function fitArtworkToWall() {
    if (!selected || !activeRoom) return;
    // A sculpture stands on the floor — "fit to wall" does not apply.
    if (selected.sculptureUrl) return;
    const parsed = parseArtworkDimensions(selected.dimensions ?? "");
    const snapped = snapArtworkToWall(
      {
        // Eye level: the snap clamps the centre inside the wall's
        // height when the work is too tall for 1.55 m.
        position: [selected.position[0], 1.55, selected.position[2]],
        rotation: selected.rotation,
        width: ((parsed?.widthCm ?? 80) / 100) * 1,
        height: ((parsed?.heightCm ?? 100) / 100) * 1,
      },
      activeRoom,
    );
    if (!snapped) return;
    snapshot();
    updateArtwork(selected.id, (artwork) => ({ ...artwork, position: snapped.position, rotation: snapped.rotation, scale: 1 }));
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
      // Re-hang the room's artworks on the NEW layout's walls: the old
      // code moved every work to z = −depth / 2 + 0.28 — the preset
      // depth is not the back wall (the Musée's back wall sits at
      // z = −12 in a 40 m preset, the Vitrine's at −12 in a 16 m one,
      // the Serpentine has no back wall at all) — so a layout switch
      // stacked all the works on one bogus line, 1.7 m in front of the
      // Vitrine's wall, 0.7 m behind the Parquet's, 7.7 m outside the
      // Musée's room, or floating outdoors, and saved them there: the
      // exhibition then opened with its works in mid-air or inside a
      // wall. Compose re-hangs them properly — one row at eye level on
      // the new back wall (or the longest wall), clear of any solid
      // volume — and any work Compose cannot place is snapped onto its
      // nearest wall instead of being left where it fell.
      const newRoom = normalizedRoom;
      setArtworks((current) => {
        const roomArtworks = current.filter((artwork) => artwork.roomId === id && !artwork.sculptureUrl);
        if (roomArtworks.length === 0 && !current.some((artwork) => artwork.roomId === id && artwork.sculptureUrl)) return current;
        const faces =
          newRoom.layout === "sunlight"
            ? sunlightHangWalls(newRoom.sunlightElements ?? [])
            : galleryHangWalls(newRoom.layout, newRoom.elements);
        const face =
          faces.find((item) => item.id === "back") ??
          [...faces].sort((a, b) => b.halfLen - a.halfLen)[0];
        const byId = new Map<string, { position: [number, number, number]; rotation: number }>();
        if (face) {
          const items: ComposeItem[] = roomArtworks.map((artwork) => {
            const parsed = parseArtworkDimensions(artwork.dimensions ?? "");
            return {
              id: artwork.id,
              title: artwork.title,
              width: ((parsed?.widthCm ?? 80) / 100) * artwork.scale,
              height: ((parsed?.heightCm ?? 100) / 100) * artwork.scale,
              dominantFamily: dominantFamilyOf(artwork.palette),
            };
          });
          for (const placement of composeWall(items, face, roomObstacles(newRoom)).placements) {
            byId.set(placement.id, { position: placement.position, rotation: placement.rotation });
          }
        }
        return current.map((artwork) => {
          if (artwork.roomId !== id) return artwork;
          // A sculpture stands on the floor: never re-hung on a wall
          // by a layout change — only keep its pedestal inside the
          // resized room (y stays 0).
          if (artwork.sculptureUrl) {
            return {
              ...artwork,
              position: [
                Math.max(-width / 2 + 0.6, Math.min(width / 2 - 0.6, artwork.position[0])),
                0,
                Math.max(-depth / 2 + 0.6, Math.min(depth / 2 - 0.6, artwork.position[2])),
              ] as [number, number, number],
            };
          }
          const placed = byId.get(artwork.id);
          if (placed) return { ...artwork, position: placed.position, rotation: placed.rotation };
          const parsed = parseArtworkDimensions(artwork.dimensions ?? "");
          const snapped = snapArtworkToWall(
            {
              position: artwork.position,
              rotation: artwork.rotation,
              width: ((parsed?.widthCm ?? 80) / 100) * artwork.scale,
              height: ((parsed?.heightCm ?? 100) / 100) * artwork.scale,
            },
            newRoom,
          );
          return snapped ? { ...artwork, position: snapped.position, rotation: snapped.rotation } : artwork;
        });
      });
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

  // Switching a room's layout keeps the owner's artworks (updateRoom's
  // layout-change re-hang composes them onto the new layout's back
  // wall at eye level); nothing is seeded — the new layout opens with
  // bare walls when it has no artworks of its own.
  function changeRoomLayout(roomId: string, layout: RoomLayout) {
    const room = rooms.find((item) => item.id === roomId);
    if (!room) return;
    snapshot();
    updateRoom(roomId, (current) => applyLayoutPreset(current, layout));
  }

  function addRoom() {
    if (rooms.length >= 12) return;
    const room = createGalleryRoom(rooms.length);
    snapshot();
    setRooms((current) => [...current, room]);
    // A new room opens empty: no template artworks are seeded.
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
    // Stops in the deleted room go with it — a stop must never point
    // at a room that no longer exists.
    setTour((current) => (current ? pruneTourStops(current, nextRooms.map((room) => room.id)) : current));
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
          <button
            className="editor-publish-button"
            onClick={() => {
              // A published show unpublishes directly (toggle); a draft
              // opens the visibility dialog (feature 8).
              if (status === "public") void publishExhibition();
              else setShowPublishDialog(true);
            }}
            disabled={busy}
          >
            {status === "public" ? "Unpublish" : "Publish"} <ArrowRight size={15} />
          </button>
        </div>
      </header>
      {showPublishDialog && (
        <ExhibitionPublishDialog
          currentVisibility={visibility}
          onClose={() => setShowPublishDialog(false)}
          onPublish={publishExhibition}
        />
      )}
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
                <span><strong>{room.name}</strong><small>{roomLabel(room.layout)} · {artworks.filter((artwork) => artwork.roomId === room.id).length} artworks</small></span>
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
                    <span className={`asset-thumb asset-color-${index % 3}`}>{artwork.sculptureUrl ? <span>3D</span> : artwork.videoUrl ? <video src={artwork.videoUrl} muted preload="metadata" playsInline /> : artwork.imageUrl ? <img src={artwork.imageUrl} alt={artwork.altText ?? artwork.title} /> : <span />}</span>
                    <span className="asset-copy"><strong>{artwork.title}</strong><small>{artwork.year} · {artwork.sculptureUrl ? t("sculpture", "sculpture") : artwork.videoUrl ? t("video", "video") : artwork.medium.split(" ")[0]}</small></span>
                    {selectedId === artwork.id && <span className="selected-mark"><Check size={12} /></span>}
                  </button>
                ))}
              </div>
              <button className="add-to-room" onClick={() => uploadRef.current?.click()} disabled={busy}><Plus size={15} /> Add artwork to room</button>
              {/* Video artwork: an MP4 on the wall, looped and muted —
                  the same camera-wall placement as an image, a 16:9
                  frame, and the same compose / drag / snap afterwards. */}
              <button className="add-to-room" onClick={() => videoUploadRef.current?.click()} disabled={busy}><Video size={15} /> {t("video", "addVideo")}</button>
              {/* Sculpture artwork: a GLB on an automatic pedestal on
                  the floor — same upload flow as a video, floor
                  placement instead of a wall. */}
              <button className="add-to-room" onClick={() => sculptureUploadRef.current?.click()} disabled={busy}><Box size={15} /> {t("sculpture", "addSculpture")}</button>
              {/* Reuse instead of re-uploading: pick a work already in
                  the artist's library ("Mes œuvres") and hang a copy
                  of it in this room — same image, fresh placement. */}
              <button className="add-to-room" onClick={() => void openLibraryPicker()} disabled={busy}><Image size={15} /> {t("library", "fromLibrary")}</button>
              {showLibraryPicker && (
                <div className="library-picker">
                  <div className="library-picker-head">
                    <strong>{t("library", "chooseFromLibrary")}</strong>
                    <button type="button" aria-label={t("common", "dismiss")} onClick={() => setShowLibraryPicker(false)}>×</button>
                  </div>
                  <input
                    type="search"
                    className="library-picker-search"
                    value={libraryQuery}
                    onChange={(event) => setLibraryQuery(event.target.value)}
                    placeholder={t("library", "searchPlaceholder")}
                    aria-label={t("library", "searchAria")}
                  />
                  {libraryLoading && <p className="library-picker-empty">{t("common", "loading")}</p>}
                  {libraryError && <div className="asset-upload-error" role="alert">{libraryError}</div>}
                  {!libraryLoading && !libraryError && libraryWorks.length === 0 && (
                    <p className="library-picker-empty">{t("library", "libraryEmpty")}</p>
                  )}
                  {!libraryLoading && !libraryError && libraryWorks.length > 0 && (
                    <div className="asset-list">
                      {libraryWorks
                        .filter((work) =>
                          !libraryQuery.trim() ||
                          [work.title, work.artist, work.year, work.medium].some((field) =>
                            field.toLowerCase().includes(libraryQuery.trim().toLowerCase()),
                          ),
                        )
                        .map((work, index) => (
                          <button className="asset-row" key={work.id} onClick={() => addLibraryArtwork(work)}>
                            <span className={`asset-thumb asset-color-${index % 3}`}>{work.sculptureUrl ? <span>3D</span> : work.videoUrl ? <video src={work.videoUrl} muted preload="metadata" playsInline /> : work.imageUrl ? <img src={work.imageUrl} alt={work.altText ?? work.title} /> : <span />}</span>
                            <span className="asset-copy"><strong>{work.title}</strong><small>{work.year} · {work.sculptureUrl ? t("sculpture", "sculpture") : work.videoUrl ? t("video", "video") : work.medium.split(" ")[0]}</small></span>
                          </button>
                        ))}
                    </div>
                  )}
                  <p className="asset-upload-hint"><Image size={15} /><span>{t("library", "reuseHint")}</span></p>
                </div>
              )}
              {uploadError && <div className="asset-upload-error" role="alert">{uploadError}</div>}
              <input ref={uploadRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/heic,image/heif" onChange={(event) => void uploadArtwork(event.target.files?.[0])} />
              <input ref={videoUploadRef} className="visually-hidden" type="file" accept="video/mp4,.mp4" onChange={(event) => void uploadVideoArtwork(event.target.files?.[0])} />
              <input ref={sculptureUploadRef} className="visually-hidden" type="file" accept=".glb" onChange={(event) => void uploadSculptureArtwork(event.target.files?.[0])} />
              <div className="asset-upload-hint"><Upload size={15} /><span>Upload a PNG, JPEG, WebP, AVIF, HEIC or HEIF image. Large photos are compressed automatically.</span></div>
              <div className="asset-upload-hint"><Video size={15} /><span>{t("video", "videoHint")} {t("video", "onlyOwnVideo")}</span></div>
              <div className="asset-upload-hint"><Box size={15} /><span>{t("sculpture", "sculptureHint")} {t("sculpture", "onlyOwnSculpture")}</span></div>
              {/* Curatorial text (the reference room's "Texte curatorial"):
                  a text panel as an artwork, on the wall the camera is
                  looking at — any wall, including a partition just
                  added. Selecting a text artwork fills the composer so
                  it can be edited and modified in place. */}
              <div className="property-section">
                <label>CURATORIAL TEXT</label>
                <textarea className="full-input property-textarea" rows={3} value={curatorialText} onChange={(event) => setCuratorialText(event.target.value)} placeholder="Write a wall text for this room…" maxLength={2000} />
                <select className="full-input" style={{ marginTop: 8 }} value={curatorialTextFont} onChange={(event) => setCuratorialTextFont(event.target.value as SunlightTextFont)} aria-label="Curatorial text typeface">
                  {(Object.keys(SUNLIGHT_TEXT_FONTS) as SunlightTextFont[]).map((key) => (
                    <option key={key} value={key}>{SUNLIGHT_TEXT_FONTS[key].label}</option>
                  ))}
                </select>
                <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                  <button className="add-to-room" style={{ flex: 1, marginTop: 0 }} onClick={addCuratorialText}>Add to wall</button>
                  <button className="add-to-room" style={{ flex: 1, marginTop: 0 }} onClick={modifyCuratorialText}>Modify selected text</button>
                </div>
                <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: 8, lineHeight: 1.6 }}>The text goes on the wall the camera is looking at — any wall, including a partition you added. Select a text artwork to edit its wording and typeface.</p>
                {sunlightMessage && <div className="asset-upload-error" role="alert">{sunlightMessage}</div>}
              </div>
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
              {/* Sunlight 3D elements — the reference room's own pieces
                  (cloison, suspendu, colonne, socles, vitrine, banc,
                  fauteuils, spotlights). Separate from the Asset Library
                  above; both systems coexist. Added 3 m in front of the
                  camera, then dragged on the floor; spotlights are
                  capped at 8. Sunlight only: the generic rooms have no
                  reference-room pieces. */}
              {activeRoom?.layout === "sunlight" && (
              <div className="property-section">
                <label>3D ELEMENTS <span>REFERENCE ROOM</span></label>
                <p style={{ margin: "0 0 8px", color: "var(--muted)", fontSize: 8, lineHeight: 1.6 }}>Partitions, columns, plinths, vitrines, benches, armchairs and spotlights from the reference room — placed 3 m in front of the camera.</p>
                <div style={{ display: "flex", gap: 8 }}>
                  <select className="full-input" style={{ flex: 1 }} value={sunlightElementType} onChange={(event) => setSunlightElementType(event.target.value as SunlightElementType)} aria-label="3D element type">
                    {SUNLIGHT_ELEMENT_TYPES.map((type) => (
                      <option key={type} value={type}>{SUNLIGHT_ELEMENT_DEFAULTS[type].label}</option>
                    ))}
                  </select>
                  <button className="add-to-room" style={{ flex: "0 0 auto", marginTop: 0, padding: "9px 12px" }} onClick={() => addSunlightElement(sunlightElementType)}>Add element</button>
                </div>
                {sunlightMessage && <div className="asset-upload-error" role="alert">{sunlightMessage}</div>}
                <div className="asset-list" style={{ marginTop: 8 }}>
                  {currentSunlightElements.map((element) => (
                    <div className="asset-row-wrap" key={element.id}>
                      <button className={`asset-row ${selectedSunlightElementId === element.id ? "selected" : ""}`} onClick={() => selectSunlightElement(element.id)}>
                        <span className="asset-copy"><strong>{element.name}</strong><small>{SUNLIGHT_ELEMENT_DEFAULTS[element.type].label}</small></span>
                        {selectedSunlightElementId === element.id && <span className="selected-mark"><Check size={12} /></span>}
                      </button>
                      <button type="button" className="asset-row-delete" aria-label={`Delete ${element.name}`} title={`Delete ${element.name}`} onClick={() => removeSunlightElementById(element.id)}><Trash2 size={13} /></button>
                    </div>
                  ))}
                  {currentSunlightElements.length === 0 && (
                    <p className="element-empty-note">No 3D elements yet. Pick a type above and add it — it lands 3 m in front of the camera, then drag it around the floor.</p>
                  )}
                </div>
              </div>
              )}
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
          <div className="left-panel-bottom">{showGuide ? (<div className="tip-card editor-guide" role="dialog" aria-label="Editor guide"><div className="tip-heading"><Lightbulb size={14} /> EDITOR GUIDE</div><ol><li><strong>Select</strong> — double-click (or double-tap) an artwork, an element or a wall to select it; Shift-click adds to the selection.</li><li><strong>Move</strong> — drag a selected item; drag an element from the palette straight into the room.</li><li><strong>Paint a wall</strong> — click a wall, then pick a colour.</li><li><strong>Undo / redo</strong> — Ctrl+Z / Ctrl+Shift+Z (Cmd on Mac).</li><li><strong>Walk</strong> — WASD or the arrow keys to move, drag elsewhere to look, click the floor to walk to a spot.</li><li><strong>Floor plan</strong> — open the plan at the bottom left to jump between rooms and artworks.</li><li><strong>Publish</strong> — Save, then Publish to share your exhibition.</li></ol><button type="button" className="editor-guide-close" onClick={() => setShowGuide(false)}>Close guide</button></div>) : (<div className="tip-card"><div className="tip-heading"><Lightbulb size={14} /> QUICK TIP</div><p>Double-click an artwork, an element or a wall to select it. Drag a selected item to move it, drag an element from the palette above straight into the room, and drag anywhere else to look around. WASD moves you through the room; click the floor to walk to a spot. Click a wall to paint it.</p></div>)}<button className="panel-help-link" aria-expanded={showGuide} onClick={() => setShowGuide((value) => !value)}><CircleHelp size={15} /> {showGuide ? "Hide editor guide" : "Editor guide"} <ArrowRight size={13} /></button></div>
        </aside>

        <section className="editor-stage">
          <div className="stage-toolbar">
            <div className="tool-group">
              <button className="tool-button" aria-label="Rotate selected artwork or element" onClick={() => {
                snapshot();
                if (selected) updateArtwork(selected.id, (artwork) => ({ ...artwork, rotation: artwork.rotation + Math.PI / 12 }));
                else if (selectedElement) updateElement(selectedElement.id, { rotation: selectedElement.rotation + Math.PI / 12 });
                else if (selectedSunlightElement) updateSunlightElement(selectedSunlightElement.id, { rotation: selectedSunlightElement.rotation + Math.PI / 12 });
              }}><RotateCw size={16} /></button>
              <span className="tool-divider" />
              <button className="tool-button" aria-label="Undo" title="Undo (Ctrl+Z)" onClick={undo} disabled={historyRef.current.past.length === 0}><Undo2 size={16} /></button>
              <button className="tool-button" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" onClick={redo} disabled={historyRef.current.future.length === 0}><Redo2 size={16} /></button>
            </div>
            <div className="stage-room-name"><span /> {activeRoom?.name.toUpperCase() ?? "ROOM"} <ChevronDown size={13} /></div>
            <div className="tool-group" role="group" aria-label="Camera view">
              {(Object.keys(VIEW_PRESETS) as CameraViewPreset[]).map((view) => (
                <button key={view} type="button" className={`tool-button view-button${cameraView === view ? " active" : ""}`} aria-pressed={cameraView === view} title={view === "eye" ? "Eye level view" : view === "wide" ? "Wide view from the front-right corner" : view === "high" ? "High view from above (ceiling hidden)" : "Plan view from above (ceiling hidden)"} onClick={() => requestCameraView(view)}>{VIEW_PRESETS[view].label}</button>
              ))}
            </div>
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
              {composeCandidates.length >= 2 && (
                <button type="button" title="Compose the selected artworks on a wall — one row at eye level, 12 cm apart" style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-2)", color: "var(--ink)", fontSize: "9px", cursor: "pointer" }} onClick={openComposePanel}><LayoutGrid size={12} /> Compose wall</button>
              )}
              <span style={{ color: "var(--muted)" }}>Shift-click in 3D or in Layers adds to the selection; dragging moves all selected items together.</span>
            </div>
          )}
          {composeOpen && composeCandidates.length >= 2 && (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "6px 12px", borderBottom: "1px solid var(--border)", background: "var(--surface-3)", color: "var(--ink)", fontSize: "9px", flexWrap: "wrap" }}>
              <span>Compose {composeCandidates.length} artworks on</span>
              <select
                value={composeFaceOptions.some((option) => option.id === composeWallId) ? (composeWallId ?? "") : (composeFaceOptions[0]?.id ?? "")}
                onChange={(event) => setComposeWallId(event.target.value || null)}
                aria-label="Wall to compose on"
                style={{ padding: "4px 6px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-2)", color: "var(--ink)", fontSize: "9px", cursor: "pointer", maxWidth: "240px" }}
              >
                {composeFaceOptions.map((option) => (
                  <option key={option.id} value={option.id}>{option.label}</option>
                ))}
              </select>
              <button type="button" title="Place the selected artworks on this wall" style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-2)", color: "var(--ink)", fontSize: "9px", cursor: "pointer" }} onClick={applyComposition}>Compose</button>
              <button type="button" title="Close the compose panel" style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "4px 8px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-2)", color: "var(--ink)", fontSize: "9px", cursor: "pointer" }} onClick={() => setComposeOpen(false)}>Close</button>
              {composeMessage && <span role="status" style={{ color: "var(--muted)", lineHeight: 1.5 }}>{composeMessage}</span>}
            </div>
          )}
          <div className="scene-wrap">
            {activeRoom && sceneRoom && <GalleryScene artworks={visibleArtworks} selectedId={selectedId} onSelect={selectArtwork} className="gallery-canvas editor-canvas" room={sceneRoom} rooms={sceneRooms} interior walkMode walking input={movementKeys} activeRoomId={activeRoom.id} onRoomChange={(id) => { setActiveRoomId(id); clearSelection(); resetCameraView(); }} teleportTarget={teleportTarget} cameraStateRef={cameraStateRef} viewRequest={viewRequest} lookAtRequest={lookAtRequest} appearingId={appearingId} editable onArtworkUpdate={handleSceneArtworkUpdate} onArtworkDragEnd={handleArtworkDragEnd} selectedElementId={selectedElementId} onSelectElement={selectElement} onElementUpdate={handleSceneElementUpdate} selectedSunlightElementId={selectedSunlightElementId} onSelectSunlightElement={selectSunlightElement} onSunlightElementUpdate={handleSceneSunlightElementUpdate} selectedWallId={selectedWallId} onWallSelect={(wallId) => selectWall(wallId)} onEditStart={beginEdit} onEditEnd={endEdit} onElementDrop={dropElement} showGrid={showGrid} showMeasure={showMeasure} multiSelectedIds={multiSelected.map((ref) => ref.id)} />}
            {/* Floor plan + teleport (the same minimap as the public
                viewer): the Sunlight room with its panels, one dot per
                artwork and the live camera position. Clicking the plan
                walks to that point; clicking a dot walks to that
                artwork. Collapsible, so it never covers the room when
                closed — the plan navigation the room relies on, now in
                the editor too. */}
            <ExhibitionMinimap
              rooms={sceneRooms}
              artworks={artworks}
              activeRoomId={activeRoom?.id ?? ""}
              selectedArtworkId={selectedId}
              cameraStateRef={cameraStateRef}
              onTeleport={handleTeleport}
              onTeleportPoint={handleTeleportPoint}
              onRoomChange={handleRoomTeleport}
            />
            {/* On-screen walk pad (the same as the public viewer):
                hold an arrow to walk — WASD and the arrow keys work
                the same way. */}
            <div className="walk-pad">
              <button aria-label="Move forward" onPointerDown={() => movementKeys.current.add("KeyW")} onPointerUp={() => movementKeys.current.delete("KeyW")} onPointerLeave={() => movementKeys.current.delete("KeyW")} onPointerCancel={() => movementKeys.current.delete("KeyW")}><ArrowUp size={15} /></button>
              <button aria-label="Move left" onPointerDown={() => movementKeys.current.add("KeyA")} onPointerUp={() => movementKeys.current.delete("KeyA")} onPointerLeave={() => movementKeys.current.delete("KeyA")} onPointerCancel={() => movementKeys.current.delete("KeyA")}><ArrowLeft size={15} /></button>
              <button aria-label="Move backward" onPointerDown={() => movementKeys.current.add("KeyS")} onPointerUp={() => movementKeys.current.delete("KeyS")} onPointerLeave={() => movementKeys.current.delete("KeyS")} onPointerCancel={() => movementKeys.current.delete("KeyS")}><ArrowDown size={15} /></button>
              <button aria-label="Move right" onPointerDown={() => movementKeys.current.add("KeyD")} onPointerUp={() => movementKeys.current.delete("KeyD")} onPointerLeave={() => movementKeys.current.delete("KeyD")} onPointerCancel={() => movementKeys.current.delete("KeyD")}><ArrowRight size={15} /></button>
            </div>
            <div className="scene-caption"><span className="scene-caption-dot" /> DOUBLE-CLICK TO SELECT <span className="caption-divider">·</span> DRAG A SELECTED ITEM TO MOVE IT <span className="caption-divider">·</span> WASD TO WALK <span className="caption-divider">·</span> CLICK THE FLOOR TO WALK THERE <span className="caption-divider">·</span> DRAG ELSEWHERE TO LOOK</div>
            <div className="scene-room-count"><span>{String(rooms.findIndex((room) => room.id === activeRoom?.id) + 1).padStart(2, "0")}</span><span className="room-count-line" /><span>{String(rooms.length).padStart(2, "0")}</span></div>
            <div className="stage-tools-float"><button onClick={() => moveArtwork(1, 0.15)} title="Move up" aria-label="Move selected artwork up"><Plus size={14} /></button><button onClick={() => moveArtwork(1, -0.15)} title="Move down" aria-label="Move selected artwork down"><Minus size={14} /></button><span /><button onClick={() => { if (!selected) return; snapshot(); updateArtwork(selected.id, (artwork) => ({ ...artwork, scale: Math.min(3, artwork.scale + 0.1) })); }} title="Increase scale" aria-label="Increase scale of selected artwork"><Expand size={14} /></button><button onClick={() => { if (!selected) return; snapshot(); updateArtwork(selected.id, (artwork) => ({ ...artwork, scale: Math.max(0.5, artwork.scale - 0.1) })); }} title="Decrease scale" aria-label="Decrease scale of selected artwork"><Minus size={14} /></button></div>
            <div className="stage-add-button"><button onClick={() => uploadRef.current?.click()}><Plus size={14} /> Add artwork</button></div>
          </div>
          <div className="editor-statusbar"><span><span className="status-online" /> Scene ready</span><span>{activeRoom ? roomLabel(activeRoom.layout) : "Gallery"} <span className="status-dot-separator">·</span> {rooms.length} rooms <span className="status-dot-separator">·</span> {currentArtworks.length} artworks{showGrid ? <><span className="status-dot-separator">·</span> Grid on — drags snap to 0.25 m</> : null}</span><span>{autosaveState === "saving" ? "Saving…" : saved ? `All changes saved ✓${lastSavedAt ? ` ${lastSavedAt}` : ""}` : "Unsaved changes"}</span></div>
        </section>

        <aside className="editor-properties-panel">
          <div className="properties-header"><div><span className="panel-kicker">INSPECTOR</span><h2>{selected ? "Artwork details" : selectedElement ? "Element details" : selectedSunlightElement ? "3D element details" : selectedWallId ? "Wall paint" : "Room settings"}</h2></div><button className="tiny-icon-button" aria-label="Version history" aria-expanded={showHistory} aria-pressed={showHistory} title="Version history — the last 10 saves" onClick={() => { setShowHistory((value) => !value); if (!showHistory) void loadHistory(); }}><Info size={15} /></button></div>
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
              <div className="selected-art-preview"><div className="selected-art-image" style={{ backgroundColor: selected.color }}>{selected.sculptureUrl ? <span>3D</span> : selected.videoUrl ? <video src={selected.videoUrl} muted loop playsInline preload="metadata" controls /> : selected.imageUrl ? <img src={selected.imageUrl} alt={selected.altText ?? selected.title} /> : <span style={{ backgroundColor: selected.accent }} />}</div><div><strong>{selected.title}</strong><small>{selected.year} · {selected.sculptureUrl ? t("sculpture", "sculptureArtwork") : selected.videoUrl ? t("video", "videoArtwork") : selected.medium}</small></div></div>
              {!selected.text && !selected.videoUrl && !selected.sculptureUrl && (
                <>
                  <button type="button" className="add-to-room" onClick={() => replaceImageRef.current?.click()} disabled={busy}>Replace image</button>
                  <input ref={replaceImageRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/avif,image/heic,image/heif" onChange={(event) => void replaceArtworkImage(event.target.files?.[0])} />
                </>
              )}
              {!selected.text && selected.videoUrl && (
                <>
                  <button type="button" className="add-to-room" onClick={() => replaceVideoRef.current?.click()} disabled={busy}>{t("video", "replaceVideo")}</button>
                  <input ref={replaceVideoRef} className="visually-hidden" type="file" accept="video/mp4,.mp4" onChange={(event) => void replaceArtworkVideo(event.target.files?.[0])} />
                  <button type="button" className="add-to-room" onClick={() => { snapshot(); updateArtwork(selected.id, (artwork) => ({ ...artwork, videoUrl: null })); }} disabled={busy}>{t("video", "removeVideo")}</button>
                  <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>{t("video", "videoPlaysMuted")}</p>
                </>
              )}
              {!selected.text && selected.sculptureUrl && (
                <>
                  <button type="button" className="add-to-room" onClick={() => replaceSculptureRef.current?.click()} disabled={busy}>{t("sculpture", "replaceSculpture")}</button>
                  <input ref={replaceSculptureRef} className="visually-hidden" type="file" accept=".glb" onChange={(event) => void replaceArtworkSculpture(event.target.files?.[0])} />
                  <button type="button" className="add-to-room" onClick={() => { snapshot(); updateArtwork(selected.id, (artwork) => ({ ...artwork, sculptureUrl: null })); }} disabled={busy}>{t("sculpture", "removeSculpture")}</button>
                  <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>{t("sculpture", "sculptureOnPedestal")}</p>
                </>
              )}
              {!selected.text && selected.imageUrl && (
                <div className="property-section">
                  <label>COLOUR PALETTE <span>{selected.palette?.length ? "CLICK A SWATCH TO COPY" : "FROM THE IMAGE"}</span></label>
                  {selected.palette && selected.palette.length > 0 ? (
                    <>
                      <PaletteSwatches palette={selected.palette} />
                      <p style={{ margin: "8px 0 0", color: "var(--ink)", fontSize: "9px", lineHeight: 1.6 }}>
                        Dominant {selected.palette[0]} · {HUE_FAMILY_LABELS[hueFamilyOf(selected.palette[0])]}
                        {isWarmHex(selected.palette[0]) ? " · warm" : " · cool"}
                      </p>
                      {sameFamilyWallNeighbours.length > 0 && (
                        <p style={{ margin: "8px 0 0", color: "var(--danger, #b3261e)", fontSize: "8px", lineHeight: 1.6 }}>
                          {sameFamilyWallNeighbours.map((item) => item.title).join(", ")}{" "}
                          {sameFamilyWallNeighbours.length === 1 ? "shares" : "share"} this dominant colour on the same
                          wall — consider spacing them apart.
                        </p>
                      )}
                      {colourMatches.length > 0 && (
                        <>
                          <p style={{ margin: "10px 0 6px", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>
                            HARMONISES WITH — CLICK TO SELECT
                          </p>
                          {colourMatches.map(({ artwork, harmony }) => (
                            <button
                              key={artwork.id}
                              type="button"
                              onClick={() => selectArtwork(artwork.id)}
                              title={`${artwork.title} — ${HARMONY_LABELS[harmony]} with ${selected.title}`}
                              style={{ display: "flex", alignItems: "center", gap: "6px", width: "100%", padding: "4px 0", border: 0, borderBottom: "1px solid var(--border)", background: "none", color: "var(--ink)", fontSize: "9px", cursor: "pointer", textAlign: "left" }}
                            >
                              <span style={{ width: "12px", height: "12px", borderRadius: "2px", backgroundColor: artwork.palette![0], flexShrink: 0, border: "1px solid rgba(0,0,0,0.15)" }} />
                              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{artwork.title}</span>
                              <span style={{ color: "var(--muted)", fontSize: "8px", whiteSpace: "nowrap" }}>{HARMONY_LABELS[harmony]}</span>
                            </button>
                          ))}
                        </>
                      )}
                      {wallSuggestion && frameSuggestion && (
                        <>
                          <p style={{ margin: "10px 0 6px", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>
                            SUGGESTIONS — NEVER IMPOSED
                          </p>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "6px" }}>
                            <span style={{ width: "12px", height: "12px", borderRadius: "2px", backgroundColor: wallSuggestion.hex, flexShrink: 0, border: "1px solid rgba(0,0,0,0.15)" }} />
                            <span style={{ flex: 1, color: "var(--ink)", fontSize: "9px", lineHeight: 1.5 }}>
                              Wall — try {wallSuggestion.hex}. {wallSuggestion.reason}
                            </span>
                            {activeRoom && activeRoom.wallColor.toLowerCase() !== wallSuggestion.hex.toLowerCase() && (
                              <button
                                type="button"
                                style={{ padding: "3px 7px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-3)", color: "var(--ink)", fontSize: "8px", cursor: "pointer", whiteSpace: "nowrap" }}
                                onClick={() => { snapshot(); updateRoom(activeRoom.id, (room) => ({ ...room, wallColor: wallSuggestion.hex })); }}
                              >
                                Apply
                              </button>
                            )}
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span style={{ flex: 1, color: "var(--ink)", fontSize: "9px", lineHeight: 1.5 }}>
                              Frame — {FRAME_VARIANTS[frameSuggestion.variant]?.label ?? frameSuggestion.variant}. {frameSuggestion.reason}
                            </span>
                            {(selected.frame ?? "wood") !== frameSuggestion.variant && (
                              <button
                                type="button"
                                style={{ padding: "3px 7px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-3)", color: "var(--ink)", fontSize: "8px", cursor: "pointer", whiteSpace: "nowrap" }}
                                onClick={() => { snapshot(); updateArtwork(selected.id, (artwork) => ({ ...artwork, frame: frameSuggestion.variant })); }}
                              >
                                Apply
                              </button>
                            )}
                          </div>
                        </>
                      )}
                    </>
                  ) : extractingPalette ? (
                    <p style={{ margin: 0, color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>Reading the colours in this image…</p>
                  ) : (
                    <div className="property-actions"><button type="button" onClick={() => void extractSelectedPalette()}>Extract palette</button></div>
                  )}
                </div>
              )}
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
                  {!selected.text && selected.imageUrl && (
                    <div className="property-section">
                      <label>ALT TEXT <span>FOR SCREEN READERS & SEARCH</span></label>
                      <input
                        className="full-input"
                        {...editSessionProps}
                        value={selected.altText ?? ""}
                        onChange={(event) => updateArtwork(selected.id, (artwork) => ({ ...artwork, altText: event.target.value.trim() === "" ? null : event.target.value }))}
                        placeholder="One sentence describing what the artwork shows"
                        maxLength={500}
                      />
                      {captionStatus?.artworkId === selected.id && (
                        <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>
                          {captionStatus.status === "loading-model"
                            ? "Loading the description model (first time only — it is then cached)…"
                            : "Describing this image…"}
                        </p>
                      )}
                      {captionSuggestion?.artworkId === selected.id && (
                        <p style={{ margin: "8px 0 0", color: "var(--ink)", fontSize: "8px", lineHeight: 1.6 }}>
                          Suggested by {captionSuggestion.source === "caption" ? "the description model" : "Gemini"} — edit or discard before saving.{" "}
                          <button type="button" onClick={discardCaptionSuggestion} style={{ border: 0, background: "none", color: "var(--muted)", fontSize: "8px", cursor: "pointer", textDecoration: "underline", padding: 0 }}>
                            Discard suggestion
                          </button>
                        </p>
                      )}
                      {captionMessage?.artworkId === selected.id && (
                        <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>
                          {captionMessage.text}
                        </p>
                      )}
                      <div className="property-actions">
                        <button type="button" onClick={() => void generateSelectedCaption()}>Generate description</button>
                        {geminiAvailable && (
                          <button type="button" onClick={() => void enrichSelectedWithGemini()} disabled={geminiBusy}>
                            {geminiBusy ? "Asking Gemini…" : "Enrich with Gemini"}
                          </button>
                        )}
                      </div>
                      {geminiSuggestion?.artworkId === selected.id && (
                        <div style={{ marginTop: "10px", padding: "8px", border: "1px solid var(--border)", borderRadius: "4px" }}>
                          <p style={{ margin: "0 0 6px", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>GEMINI SUGGESTS — CLICK TO USE</p>
                          <p style={{ margin: "0 0 4px", color: "var(--ink)", fontSize: "9px", lineHeight: 1.5 }}>Alt-text: {geminiSuggestion.altText}</p>
                          <p style={{ margin: "0 0 8px", color: "var(--ink)", fontSize: "9px", lineHeight: 1.5 }}>{geminiSuggestion.description}</p>
                          <div className="property-actions">
                            <button type="button" onClick={applyGeminiSuggestion}>Use this text</button>
                            <button type="button" onClick={() => { setGeminiSuggestion(null); setCaptionMessage(null); }}>Dismiss</button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                  {selected.text && (
                    <>
                      <div className="property-section"><label>CURATORIAL TEXT</label><textarea className="full-input property-textarea" rows={3} value={curatorialText} onChange={(event) => setCuratorialText(event.target.value)} maxLength={2000} /></div>
                      <div className="property-section"><label>TYPEFACE</label><select className="full-input" value={curatorialTextFont} onChange={(event) => setCuratorialTextFont(event.target.value as SunlightTextFont)}>{(Object.keys(SUNLIGHT_TEXT_FONTS) as SunlightTextFont[]).map((key) => (<option key={key} value={key}>{SUNLIGHT_TEXT_FONTS[key].label}</option>))}</select></div>
                      <div className="property-actions"><button onClick={modifyCuratorialText}>Modify text</button></div>
                    </>
                  )}
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
                  <div className="property-actions"><button onClick={() => { if (!selected) return; fitArtworkToWall(); }}><Sparkles size={14} /> Fit to wall</button><button aria-label={selected.hidden ? "Show artwork in 3D" : "Hide artwork in 3D"} title={selected.hidden ? "Show in 3D" : "Hide in 3D"} onClick={() => toggleHidden({ kind: "artwork", id: selected.id })}>{selected.hidden ? <EyeOff size={14} /> : <Eye size={14} />}</button><button aria-label={selected.locked ? "Unlock artwork" : "Lock artwork"} title={selected.locked ? "Unlock (allow dragging)" : "Lock (cannot be dragged)"} onClick={() => toggleLocked({ kind: "artwork", id: selected.id })}>{selected.locked ? <Lock size={14} /> : <Unlock size={14} />}</button><button aria-label="Duplicate artwork" onClick={duplicateArtwork}><Copy size={14} /></button><button className="delete-action" aria-label="Delete artwork" onClick={removeArtwork}><Trash2 size={14} /></button></div>
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
                    <div className="property-section"><label>{selectedElement.type === "track-light" ? "RAIL LENGTH" : selectedElement.type === "wall-text" ? "TEXT WIDTH" : selectedElement.type === "platform" || selectedElement.type === "stairs" || selectedElement.type === "arch" ? "WIDTH" : "LENGTH"} <span>METERS</span></label><div className="range-control"><input aria-label="Element length in metres" type="range" {...editSessionProps} onPointerDown={beginEdit} onPointerUp={endEdit} min={selectedElement.type === "partition" || selectedElement.type === "track-light" ? 1 : 0.5} max={selectedElement.type === "partition" ? 14 : selectedElement.type === "wall-text" ? 12 : 6} step={selectedElement.type === "partition" ? 0.1 : 0.5} value={selectedElement.length} onChange={(event) => updateElement(selectedElement.id, { length: Number(event.target.value) })} /><span>{selectedElement.length} m</span></div></div>
                  )}
                  {selectedElement.type === "partition" && (
                    <>
                      <div className="property-section"><label>HEIGHT <span>METERS</span></label><div className="range-control"><input aria-label="Partition height in metres" type="range" {...editSessionProps} onPointerDown={beginEdit} onPointerUp={endEdit} min={PARTITION_DIMS.height.min} max={PARTITION_DIMS.height.max} step={PARTITION_DIMS.height.step} value={partitionDimsOf(selectedElement).height} onChange={(event) => updateElement(selectedElement.id, { height: Number(event.target.value) })} /><span>{partitionDimsOf(selectedElement).height} m</span></div></div>
                      <div className="property-section"><label>THICKNESS <span>METERS</span></label><div className="range-control"><input aria-label="Partition thickness in metres" type="range" {...editSessionProps} onPointerDown={beginEdit} onPointerUp={endEdit} min={PARTITION_DIMS.thickness.min} max={PARTITION_DIMS.thickness.max} step={PARTITION_DIMS.thickness.step} value={partitionDimsOf(selectedElement).thickness} onChange={(event) => updateElement(selectedElement.id, { thickness: Number(event.target.value) })} /><span>{partitionDimsOf(selectedElement).thickness} m</span></div></div>
                    </>
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
              ) : selectedSunlightElement ? (
                <>
                  <div className="selected-art-preview"><div><strong>{selectedSunlightElement.name}</strong><small>{SUNLIGHT_ELEMENT_DEFAULTS[selectedSunlightElement.type].label}</small></div></div>
                  <div className="property-section"><label>NAME</label><input className="full-input" {...editSessionProps} value={selectedSunlightElement.name} onChange={(event) => updateSunlightElement(selectedSunlightElement.id, { name: event.target.value.slice(0, 60) })} /></div>
                  <div className="property-section"><label>POSITION <span>METERS · FLOOR</span></label><div className="coordinate-row" style={{ gridTemplateColumns: "repeat(2, 1fr)" }}>{(["X", "Z"] as const).map((axis) => {
                    const key = axis.toLowerCase() as "x" | "z";
                    return (
                      <div key={axis}><span>{axis}</span><NumberField ariaLabel={`3D element position ${axis}`} step="0.1" value={selectedSunlightElement[key]} {...editSessionProps} onCommit={(next) => updateSunlightElement(selectedSunlightElement.id, { [key]: next } as Partial<SunlightElement>)} /></div>
                    );
                  })}</div></div>
                  <div className="property-section"><label>ROTATION <span>{((Math.round((selectedSunlightElement.rotation * 180) / Math.PI) % 360) + 360) % 360}°</span></label><div className="range-control"><input aria-label="3D element rotation in degrees" type="range" {...editSessionProps} onPointerDown={beginEdit} onPointerUp={endEdit} min="0" max="360" step="1" value={((Math.round((selectedSunlightElement.rotation * 180) / Math.PI) % 360) + 360) % 360} onChange={(event) => updateSunlightElement(selectedSunlightElement.id, { rotation: (Number(event.target.value) * Math.PI) / 180 })} /><span>{((Math.round((selectedSunlightElement.rotation * 180) / Math.PI) % 360) + 360) % 360}°</span></div></div>
                  {(selectedSunlightElement.type === "cloison" || selectedSunlightElement.type === "suspendu") && (
                    <>
                      <div className="property-section"><label>LENGTH <span>METERS</span></label><div className="range-control"><input aria-label="Partition length in metres" type="range" {...editSessionProps} onPointerDown={beginEdit} onPointerUp={endEdit} min={PARTITION_DIMS.length.min} max={PARTITION_DIMS.length.max} step={PARTITION_DIMS.length.step} value={sunlightPartitionDimsOf(selectedSunlightElement).length} onChange={(event) => updateSunlightElement(selectedSunlightElement.id, { length: Number(event.target.value) })} /><span>{sunlightPartitionDimsOf(selectedSunlightElement).length} m</span></div></div>
                      <div className="property-section"><label>HEIGHT <span>METERS</span></label><div className="range-control"><input aria-label="Partition height in metres" type="range" {...editSessionProps} onPointerDown={beginEdit} onPointerUp={endEdit} min={PARTITION_DIMS.height.min} max={PARTITION_DIMS.height.max} step={PARTITION_DIMS.height.step} value={sunlightPartitionDimsOf(selectedSunlightElement).height} onChange={(event) => updateSunlightElement(selectedSunlightElement.id, { height: Number(event.target.value) })} /><span>{sunlightPartitionDimsOf(selectedSunlightElement).height} m</span></div></div>
                      <div className="property-section"><label>THICKNESS <span>METERS</span></label><div className="range-control"><input aria-label="Partition thickness in metres" type="range" {...editSessionProps} onPointerDown={beginEdit} onPointerUp={endEdit} min={PARTITION_DIMS.thickness.min} max={PARTITION_DIMS.thickness.max} step={PARTITION_DIMS.thickness.step} value={sunlightPartitionDimsOf(selectedSunlightElement).thickness} onChange={(event) => updateSunlightElement(selectedSunlightElement.id, { thickness: Number(event.target.value) })} /><span>{sunlightPartitionDimsOf(selectedSunlightElement).thickness} m</span></div></div>
                    </>
                  )}
                  <div className="property-section"><label>COLOUR</label><div className="room-color-control"><input type="color" aria-label="3D element colour" {...editSessionProps} value={selectedSunlightElement.color} onChange={(event) => updateSunlightElement(selectedSunlightElement.id, { color: event.target.value })} /><span>{selectedSunlightElement.color}</span></div></div>
                  <div className="property-actions"><button className="delete-action" aria-label="Delete 3D element" onClick={removeSunlightElement}><Trash2 size={14} /></button></div>
                  <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>Drag it on the floor to move it. A cloison or suspendu is a wall — artworks and curatorial text can hang on it.</p>
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
                      <div className="property-section"><label>GALLERY</label><select className="full-input" {...editSessionProps} value={activeRoom.layout} onChange={(event) => changeRoomLayout(activeRoom.id, event.target.value as RoomLayout)}>{Object.entries(roomLayouts).filter(([layout]) => (!hiddenLayoutSet.has(layout) && !HIDDEN_LAYOUT_KEYS.has(layout as RoomLayout)) || layout === activeRoom.layout).map(([layout, details]) => <option key={layout} value={layout}>{roomLabel(layout as RoomLayout)} · {details.width} × {details.depth} m</option>)}</select></div>
                      <div className="property-section"><label>BACK WALL</label><div className="room-color-control"><input type="color" aria-label="Back wall colour" {...editSessionProps} value={activeRoom.wallColor} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, wallColor: event.target.value }))} /><span>{activeRoom.wallColor}</span></div></div>
                      <div className="property-section"><label>SIDE WALLS</label><div className="room-color-control"><input type="color" aria-label="Side walls colour" {...editSessionProps} value={activeRoom.sideWallColor} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, sideWallColor: event.target.value }))} /><span>{activeRoom.sideWallColor}</span></div></div>
                      <div className="property-section"><label>CEILING</label><div className="room-color-control"><input type="color" aria-label="Ceiling colour" {...editSessionProps} value={activeRoom.ceilingColor} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, ceilingColor: event.target.value }))} /><span>{activeRoom.ceilingColor}</span></div></div>
                      <div className="property-section"><label>CEILING FINISH</label><select className="full-input" {...editSessionProps} value={activeRoom.ceilingFinish ?? "blanc"} onChange={(event) => {
                        const finish = CEILING_FINISHES[event.target.value as CeilingFinishKey];
                        updateRoom(activeRoom.id, (room) => ({ ...room, ceilingFinish: event.target.value as CeilingFinishKey, ceilingColor: finish.color, ceilingRoughness: finish.roughness }));
                      }}>{CEILING_FINISH_KEYS.map((key) => <option key={key} value={key}>{CEILING_FINISHES[key].label}</option>)}</select><label className="room-lighting-toggle" style={{ marginTop: 6 }}><input type="checkbox" checked={activeRoom.ceilingHidden ?? false} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, ceilingHidden: event.target.checked }))} /> Hide ceiling</label></div>
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
                      <div className="property-section"><label>FLOOR PATTERN</label><select className="full-input" {...editSessionProps} value={activeRoom.floorPattern ?? "original"} onChange={(event) => {
                        const pattern = event.target.value as FloorPatternKey;
                        updateRoom(activeRoom.id, (room) => ({ ...room, floorPattern: pattern, floorColor: pattern === "original" ? room.floorColor : "#ffffff" }));
                      }}>{FLOOR_PATTERN_KEYS.map((key) => <option key={key} value={key}>{FLOOR_PATTERNS[key].label}</option>)}</select></div>
                      <div className="property-section"><label>FLOOR SHINE <span>{activeRoom.floorShine ?? 70}</span></label><div className="range-control"><input aria-label="Floor shine" type="range" {...editSessionProps} onPointerDown={beginEdit} onPointerUp={endEdit} min={FLOOR_SHINE_MIN} max={FLOOR_SHINE_MAX} step="1" value={activeRoom.floorShine ?? 70} onChange={(event) => updateRoom(activeRoom.id, (room) => ({ ...room, floorShine: Number(event.target.value) }))} /><span>{activeRoom.floorShine ?? 70}</span></div></div>
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
                    <div className="property-section">
                      <label>{t("music", "music").toUpperCase()} <span>ONE TRACK · PLAYS FROM “ENTER”</span></label>
                      <p style={{ margin: "0 0 8px", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>
                        {t("music", "musicHint")}
                      </p>
                      <p style={{ margin: "0 0 8px", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>
                        {t("music", "onlyOwnMusic")}
                      </p>
                      {music ? (
                        <>
                          <audio controls src={music.url} preload="none" style={{ width: "100%", marginBottom: "8px" }} aria-label={t("music", "musicPreview")} />
                          <label style={{ display: "block", marginBottom: "8px" }}>
                            <span style={{ display: "block", color: "var(--muted)", fontSize: "8px", marginBottom: "4px" }}>{t("music", "musicTitle").toUpperCase()}</span>
                            <input
                              className="full-input"
                              {...editSessionProps}
                              value={music.title}
                              maxLength={120}
                              placeholder={t("music", "musicTitlePlaceholder")}
                              onChange={(event) => updateMusic({ ...music, title: event.target.value })}
                            />
                          </label>
                          <label style={{ display: "block", marginBottom: "8px" }}>
                            <span style={{ display: "block", color: "var(--muted)", fontSize: "8px", marginBottom: "4px" }}>{t("music", "musicVolume").toUpperCase()} · {Math.round(music.volume * 100)}%</span>
                            <div className="range-control">
                              <input
                                aria-label={t("music", "musicVolume")}
                                type="range"
                                min={0}
                                max={1}
                                step={0.05}
                                value={music.volume}
                                {...editSessionProps}
                                onPointerDown={beginEdit}
                                onPointerUp={endEdit}
                                onChange={(event) => updateMusic({ ...music, volume: Number(event.target.value) })}
                              />
                              <span>{Math.round(music.volume * 100)}%</span>
                            </div>
                          </label>
                          <label className="room-lighting-toggle" style={{ marginBottom: "8px" }}>
                            <input
                              type="checkbox"
                              checked={music.loop}
                              onChange={(event) => updateMusic({ ...music, loop: event.target.checked })}
                            />{" "}
                            {t("music", "loop")}
                          </label>
                          <div className="property-actions">
                            <button type="button" onClick={() => musicFileRef.current?.click()} disabled={busy}>
                              {musicUploading ? t("music", "musicUploading") : t("music", "uploadMusic")}
                            </button>
                            <button
                              type="button"
                              onClick={() => { updateMusic(null); setMusicError(null); }}
                            >
                              {t("music", "removeMusic")}
                            </button>
                          </div>
                          <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>
                            {t("music", "musicRemovedNote")}
                          </p>
                        </>
                      ) : (
                        <div className="property-actions">
                          <button type="button" onClick={() => musicFileRef.current?.click()} disabled={busy}>
                            {musicUploading ? t("music", "musicUploading") : t("music", "uploadMusic")}
                          </button>
                        </div>
                      )}
                      <input
                        ref={musicFileRef}
                        className="visually-hidden"
                        type="file"
                        accept="audio/mpeg,audio/mp4,.mp3,.m4a"
                        onChange={(event) => void uploadMusicFile(event.target.files?.[0])}
                      />
                      {musicError && <p role="alert" style={{ margin: "8px 0 0", color: "var(--danger, #b3261e)", fontSize: "8px", lineHeight: 1.6 }}>{musicError}</p>}
                    </div>
                    <div className="property-section">
                      <label>{t("tour", "guidedTour").toUpperCase()} <span>{tour?.stops.length ?? 0}/{MAX_TOUR_STOPS}</span></label>
                      <p style={{ margin: "0 0 8px", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>
                        {t("tour", "tourHint")}
                      </p>
                      <label className="room-lighting-toggle" style={{ marginBottom: "8px" }}>
                        <input
                          type="checkbox"
                          checked={tour?.enabled ?? false}
                          onChange={(event) => updateTour({ enabled: event.target.checked, stops: tour?.stops ?? [] })}
                        />{" "}
                        {t("tour", "enableTour")}
                      </label>
                      <p style={{ margin: "0 0 8px", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>
                        {t("tour", "addStopHint")}
                      </p>
                      <div className="property-actions">
                        <button type="button" onClick={addTourStop} disabled={(tour?.stops.length ?? 0) >= MAX_TOUR_STOPS}>
                          <Plus size={12} /> {t("tour", "addStop")}
                        </button>
                      </div>
                      {tourError && <p role="alert" style={{ margin: "8px 0 0", color: "var(--danger, #b3261e)", fontSize: "8px", lineHeight: 1.6 }}>{tourError}</p>}
                      {tour && tour.stops.length === 0 && (
                        <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>{t("tour", "noStops")}</p>
                      )}
                      {(tour?.stops ?? []).map((stop, index) => {
                        const stopRoomName = rooms.find((room) => room.id === stop.roomId)?.name ?? t("tour", "roomRemoved");
                        return (
                          <div key={stop.id} style={{ borderTop: "1px solid var(--border)", padding: "10px 0 2px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "6px" }}>
                              <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)", fontSize: "9px", fontWeight: 700 }}>{t("tour", "stop")} {index + 1} · {stopRoomName}</span>
                              <button type="button" className="tiny-icon-button" aria-label={t("tour", "moveUp")} disabled={index === 0} onClick={() => moveTourStop(index, -1)}><ArrowUp size={12} /></button>
                              <button type="button" className="tiny-icon-button" aria-label={t("tour", "moveDown")} disabled={index === (tour?.stops.length ?? 0) - 1} onClick={() => moveTourStop(index, 1)}><ArrowDown size={12} /></button>
                              <button type="button" className="tiny-icon-button" aria-label={t("tour", "removeStop")} onClick={() => removeTourStop(stop.id)}><Trash2 size={12} /></button>
                            </div>
                            <input
                              className="full-input"
                              {...editSessionProps}
                              value={stop.title}
                              maxLength={120}
                              placeholder={t("tour", "stopTitlePlaceholder")}
                              aria-label={`${t("tour", "stopTitle")} ${index + 1}`}
                              onChange={(event) => updateTourStop(stop.id, { title: event.target.value })}
                              style={{ marginBottom: "6px" }}
                            />
                            <textarea
                              className="full-input property-textarea"
                              {...editSessionProps}
                              value={stop.text}
                              maxLength={2000}
                              placeholder={t("tour", "stopTextPlaceholder")}
                              aria-label={`${t("tour", "stopText")} ${index + 1}`}
                              onChange={(event) => updateTourStop(stop.id, { text: event.target.value })}
                            />
                            <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>{stopRoomName} · x {stop.x.toFixed(1)}, z {stop.z.toFixed(1)}</p>
                          </div>
                        );
                      })}
                      <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>
                        {t("tour", "tourSavedNote")}
                      </p>
                    </div>
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
