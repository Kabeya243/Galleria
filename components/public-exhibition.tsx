"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ArrowLeft, ArrowUpRight, ChevronLeft, ChevronRight, Headset, Info, List, Maximize2, Minimize2, Route } from "lucide-react";
import type { WebGLRenderer } from "three";
import { useProgress } from "@react-three/drei";
import Avatar from "@/components/avatar";
import BrandLogo from "@/components/brand-logo";
import GalleryScene, { artworkStandPoint, type CameraState, type TeleportTarget } from "@/components/gallery-scene";
import ArtworkDetailPanel from "@/components/artwork-detail-panel";
import ExhibitionAudioPlayer, { type ExhibitionMusic } from "@/components/exhibition-audio-player";
import ExhibitionMinimap from "@/components/exhibition-minimap";
import ExhibitionListView from "@/components/exhibition-list-view";
import ExhibitionEntryScreen from "@/components/exhibition-entry-screen";
import ExhibitionShare from "@/components/exhibition-share";
import LanguageSwitcher from "@/components/language-switcher";
import { loadRenderQuality, saveRenderQuality, type RenderQuality } from "@/lib/render-quality";
import { hasUsableTour, tourStopToTeleportTarget, type GuidedTour } from "@/lib/tour";
import { describeVrError, detectXrSupport, requestVrSession, type XrSupport } from "@/lib/webxr";
import { useT } from "@/lib/i18n";
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
      <div className="loader-brand"><BrandLogo variant="horizontal" height={52} /></div>
      <div className="loader-bar"><span style={{ width: `${Math.round(progress)}%` }} /></div>
      <p>Loading the exhibition… {Math.round(progress)}%</p>
    </div>
  );
}

// Accessibility pack written in the Accessibility & Audio Guide Studio
// (SavedWork kind "accessibility-pack"): audio descriptions, narration,
// captions and transcripts per artwork, plus a spoken welcome. Passed in
// by the public exhibition page; null when no pack exists for this show.
export type PublicAccessibilityPack = {
  introEn: string;
  introFr: string;
  entries: {
    artworkId: string;
    audioDescription: string;
    audioDescriptionFr: string;
    artistNarration: string;
    curatorNarration: string;
    caption: string;
    captionFr: string;
    transcript: string;
  }[];
};

export default function PublicExhibition({
  exhibition,
  accessibilityPack = null,
  music = null,
  // Embedded (iframe) mode: the same visit, without SANAA platform
  // chrome — no back link, no share panel, no platform navigation.
  // The 3D visit itself (entry screen, minimap, list view, fullscreen,
  // artwork panels) is unchanged; the rooms and their layouts are
  // never touched by this flag.
  embedded = false,
}: {
  exhibition: {
    id: string;
    slug: string;
    title: string;
    description: string;
    ownerName: string;
    ownerAvatarUrl?: string | null;
    visibility: string;
    rooms: GalleryRoom[];
    artworks: Artwork[];
    // The exhibition's guided tour, if any (null when none). The
    // public loader prunes stops whose room no longer exists.
    tour?: GuidedTour | null;
  };
  accessibilityPack?: PublicAccessibilityPack | null;
  music?: ExhibitionMusic | null;
  embedded?: boolean;
}) {
  const [selected, setSelected] = useState<Artwork | undefined>();
  const [showInfo, setShowInfo] = useState(false);
  const [showAccessibility, setShowAccessibility] = useState(false);
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [a11yLang, setA11yLang] = useState<"en" | "fr">("en");
  const [ttsError, setTtsError] = useState<string | null>(null);
  const t = useT();

  // Entry screen + viewer options (features 2–5): render quality owned
  // by this parent so the entry-screen choice actually applies, sound
  // preference for the audio guide, list view, and the minimap teleport.
  const [quality, setQuality] = useState<RenderQuality>("high");
  const [soundOn, setSoundOn] = useState(true);
  const [showListView, setShowListView] = useState(false);
  // Background music: incremented only inside a user gesture that enters
  // the exhibition ("Enter", or a teleport from the list view) — the
  // player's play() runs under that activation, never on mount.
  const [enterSignal, setEnterSignal] = useState(0);
  const [teleportTarget, setTeleportTarget] = useState<TeleportTarget | null>(null);
  const [shareUrl, setShareUrl] = useState("");
  const teleportNonce = useRef(0);
  // Guided tour: the index of the stop the visitor is on, null when
  // no tour is running. The tour only exists when the exhibition has
  // an enabled tour with at least one stop (see hasUsableTour).
  const [tourIndex, setTourIndex] = useState<number | null>(null);
  const tourAvailable = hasUsableTour(exhibition.tour);
  const tourActive = tourAvailable && tourIndex !== null;
  const tourStop = tourActive ? exhibition.tour!.stops[tourIndex!] : null;
  // Walk to a stop: the same teleport the minimap already uses — the
  // scene switches rooms when needed, then walks to the point and
  // turns gently toward the stop's yaw (never a blind jump). Entering
  // walk mode first when the visitor is still on the entry screen.
  function goToTourStop(index: number) {
    const tour = exhibition.tour;
    if (!tour || index < 0 || index >= tour.stops.length) return;
    const stop = tour.stops[index];
    teleportNonce.current += 1;
    setSelected(undefined);
    setTourIndex(index);
    setTeleportTarget(tourStopToTeleportTarget(stop, teleportNonce.current));
    if (!walking) {
      setWalking(true);
      setEnterSignal((n) => n + 1);
    }
  }
  function startTour() {
    goToTourStop(0);
  }
  // Leaving the tour never moves the visitor: they stay exactly where
  // they are and walk freely from there.
  function exitTour() {
    setTourIndex(null);
  }
  // Live camera state for the minimap: GalleryScene writes the
  // camera's world position and yaw here every frame; the minimap
  // draws the camera dot and its direction line from it.
  const cameraStateRef = useRef<CameraState | null>(null);
  useEffect(() => {
    setQuality(loadRenderQuality());
    try {
      if (window.localStorage.getItem("sanaa-sound") === "off") setSoundOn(false);
    } catch {
      // Storage unavailable — sound stays on.
    }
    setShareUrl(window.location.href);
  }, []);
  function handleQualityChange(next: RenderQuality) {
    setQuality(next);
    saveRenderQuality(next);
  }
  function handleSoundChange(next: boolean) {
    setSoundOn(next);
    try {
      window.localStorage.setItem("sanaa-sound", next ? "on" : "off");
    } catch {
      // Storage unavailable — the choice simply does not persist.
    }
    if (!next && "speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeakingKey(null);
  }
  // Teleport (minimap / list view): walk to the artwork's stand point,
  // entering walk mode first when the visitor is still on the entry
  // screen. The scene switches rooms itself when the artwork is in
  // another room.
  function handleTeleport(artwork: Artwork) {
    const stand = artworkStandPoint(artwork);
    teleportNonce.current += 1;
    setSelected(artwork);
    setShowListView(false);
    exitTour();
    setTeleportTarget({ roomId: artwork.roomId, ...stand, nonce: teleportNonce.current });
    if (!walking) {
      setWalking(true);
      setEnterSignal((n) => n + 1);
    }
  }

  // Floor-plan point teleport (minimap): walk to a point clicked on
  // the plan, entering walk mode first when the visitor is still on
  // the entry screen. The yaw stays null — walk there, keep the
  // current direction.
  function handleTeleportPoint(roomId: string, x: number, z: number) {
    teleportNonce.current += 1;
    exitTour();
    setTeleportTarget({ roomId, x, z, yaw: null, nonce: teleportNonce.current });
    if (!walking) setWalking(true);
  }

  // Anonymous visit tracking (see lib/visits.ts): the exhibition view
  // itself is logged server-side; this only makes sure the visitor
  // cookie exists, and logs each artwork-detail open. Fire-and-forget —
  // a failed call must never disturb the visit.
  useEffect(() => {
    fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ identifyOnly: true }),
    }).catch(() => {});
  }, []);
  useEffect(() => {
    if (!selected) return;
    fetch("/api/visits", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ exhibitionId: exhibition.id, artworkId: selected.id }),
    }).catch(() => {});
  }, [selected, exhibition.id]);

  // Visit duration (creator statistics): the time spent in the
  // exhibition, reported once when the visit ends (tab closed, hidden
  // or navigated away). sendBeacon survives pagehide; the server stores
  // it on the visit row opened at entry, never a new row.
  const visitStartRef = useRef(Date.now());
  useEffect(() => {
    function reportDuration() {
      const seconds = Math.max(0, Math.round((Date.now() - visitStartRef.current) / 1000));
      const payload = JSON.stringify({ exhibitionId: exhibition.id, durationSeconds: seconds });
      try {
        if (navigator.sendBeacon) {
          navigator.sendBeacon("/api/visits", new Blob([payload], { type: "application/json" }));
        } else {
          fetch("/api/visits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: payload,
            keepalive: true,
          }).catch(() => {});
        }
      } catch {
        // Best-effort — a missed duration never disturbs the visit.
      }
    }
    function onVisibility() {
      if (document.visibilityState === "hidden") reportDuration();
    }
    window.addEventListener("pagehide", reportDuration);
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.removeEventListener("pagehide", reportDuration);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [exhibition.id]);
  const [activeRoomId, setActiveRoomId] = useState(exhibition.rooms[0]?.id ?? "");
  const [walking, setWalking] = useState(false);
  const movementKeys = useRef(new Set<string>());
  const walkReset = useRef(0);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [fullscreenError, setFullscreenError] = useState<string | null>(null);

  // VR visit (WebXR immersive-vr, shared with the Digital Twin tool —
  // lib/webxr.ts for detection + session start, components/vr-rig.tsx
  // for the in-scene movement). The button is offered only when this
  // device/browser reports immersive-vr support; everywhere else the
  // entry screen says so plainly instead of promising VR that cannot
  // start. The session renders the SAME gallery scene (GalleryScene
  // below, vrEnabled) in stereo — no second scene, no layout change.
  const [xrSupport, setXrSupport] = useState<XrSupport>("unknown");
  const [vrInSession, setVrInSession] = useState(false);
  const [vrStatus, setVrStatus] = useState<string | null>(null);
  const glRef = useRef<WebGLRenderer | null>(null);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const support = await detectXrSupport();
        if (!cancelled) setXrSupport(support.vr);
      } catch {
        if (!cancelled) setXrSupport("error");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Entering VR mounts the dolly at the current viewpoint BEFORE the
  // session is requested (see GalleryScene / VrDolly), so the visitor
  // arrives in VR exactly where they were standing. If the request
  // fails the dolly unmounts, the camera is restored exactly, and the
  // normal visit continues with an inline message — never a broken
  // page. Ending the session (here, or from the headset's own system
  // button — the "end" listener covers both) returns to the normal
  // visit at the spot reached in VR; only the look direction resets
  // to the pre-VR yaw, which the flat walk controls own.
  async function enterVR() {
    if (xrSupport !== "supported") {
      setVrStatus(t("vr", "notSupported"));
      return;
    }
    const gl = glRef.current;
    if (!gl) {
      setVrStatus(t("vr", "viewLoading"));
      return;
    }
    setVrStatus(null);
    setVrInSession(true);
    try {
      const session = await requestVrSession(gl);
      setWalking(true);
      setEnterSignal((n) => n + 1);
      setVrStatus(t("vr", "inSession"));
      session.addEventListener("end", () => {
        setVrInSession(false);
        setVrStatus(t("vr", "ended"));
      });
    } catch (error) {
      setVrInSession(false);
      setVrStatus(t("vr", describeVrError(error)));
    }
  }

  async function exitVR() {
    try {
      await glRef.current?.xr.getSession()?.end();
    } catch {
      // The "end" listener above already resets the state when the
      // session ends; a failure here just forces the same outcome.
      setVrInSession(false);
    }
  }

  // Keep the button in sync with fullscreen state (e.g. the user exits
  // with Esc), so the same button always offers the opposite action.
  useEffect(() => {
    function onFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  // Taking the walk controls ends the tour: WASD / arrows / the touch
  // pad all write into movementKeys (the scene's input ref), so a
  // visitor who starts walking has taken over — the tour stops
  // following them and they walk free from where they are. Dragging
  // to look around does not end the tour: looking is not leaving.
  useEffect(() => {
    if (tourIndex === null) return;
    const timer = window.setInterval(() => {
      if (movementKeys.current.size > 0) setTourIndex(null);
    }, 250);
    return () => window.clearInterval(timer);
  }, [tourIndex]);

  async function toggleFullscreen() {
    setFullscreenError(null);
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        await document.documentElement.requestFullscreen();
      }
    } catch {
      setFullscreenError("Fullscreen is not available in this browser.");
    }
  }

  // Accessibility panel: read an audio description aloud with the
  // visitor's own device voices (browser speech synthesis). Stops any
  // speech when the panel closes.
  function speakAccessibility(key: string, text: string, language: "en" | "fr") {
    // Sound is an entry-screen choice: with sound off, the audio guide
    // stays silent instead of speaking over the visitor.
    if (!soundOn) {
      setTtsError(t("entry", "soundOff"));
      return;
    }
    if (!("speechSynthesis" in window)) {
      setTtsError("Text-to-speech is not available in this browser.");
      return;
    }
    window.speechSynthesis.cancel();
    if (speakingKey === key) {
      setSpeakingKey(null);
      return;
    }
    const clean = text.trim();
    if (!clean) return;
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.lang = language === "fr" ? "fr-FR" : "en-GB";
    const voice = window.speechSynthesis
      .getVoices()
      .find((v) => v.lang.toLowerCase().startsWith(language));
    if (voice) utterance.voice = voice;
    utterance.onend = () => setSpeakingKey(null);
    utterance.onerror = () => {
      setSpeakingKey(null);
      setTtsError("The browser could not play this audio.");
    };
    setTtsError(null);
    setSpeakingKey(key);
    window.speechSynthesis.speak(utterance);
  }
  useEffect(() => {
    if (showAccessibility) return;
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeakingKey(null);
  }, [showAccessibility]);
  const activeRoom = exhibition.rooms.find((room) => room.id === activeRoomId) ?? exhibition.rooms[0];
  const roomArtworks = exhibition.artworks.filter((artwork) => artwork.roomId === activeRoom?.id);

  function changeRoom(index: number) {
    const room = exhibition.rooms[index];
    if (!room) return;
    exitTour();
    setActiveRoomId(room.id);
    setSelected(undefined);
  }

  return (
    <main className="public-exhibition">
      <ExhibitionLoader />
      {activeRoom && !showListView && <GalleryScene
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
        resetSignal={walkReset}
        quality={quality}
        onQualityChange={handleQualityChange}
        teleportTarget={teleportTarget}
        cameraStateRef={cameraStateRef}
        vrEnabled={vrInSession}
        onGlReady={(gl) => { glRef.current = gl; }}
        // A floor tap is the visitor walking somewhere of their own
        // choosing — it ends the tour, like any other manual move.
        onFloorClick={() => exitTour()}
      />}
      <header className="public-topbar">
        {embedded ? (
          <span className="public-back" aria-hidden="true">LAKISA</span>
        ) : (
          <Link href="/" className="public-back"><ArrowLeft size={16} /> Lakisa</Link>
        )}
        <div className="public-title"><Avatar name={exhibition.ownerName} avatarUrl={exhibition.ownerAvatarUrl} className="public-creator-avatar" /><span>{exhibition.ownerName.toUpperCase()} PRESENTS</span><strong>{exhibition.title}</strong></div>
        <div className="public-topbar-actions">
          <LanguageSwitcher />
          {tourAvailable && (
            <button className="public-info-button" aria-label={t("tour", "guidedTour")} aria-pressed={tourActive} title={t("tour", "guidedTour")} onClick={() => { if (tourActive) exitTour(); else startTour(); }}><Route size={16} /></button>
          )}
          <button className="public-info-button" aria-label={t("listView", "listView")} aria-pressed={showListView} onClick={() => setShowListView((value) => !value)}><List size={16} /></button>
          {!embedded && (
            <ExhibitionShare
              title={exhibition.title}
              url={shareUrl || (typeof window !== "undefined" ? window.location.href : "")}
              slug={exhibition.slug}
              embeddable={exhibition.visibility === "public"}
            />
          )}
          <button className="public-info-button" aria-label="Exhibition information" onClick={() => setShowInfo((value) => !value)}><Info size={17} /></button>
          {accessibilityPack && (
            <button
              className="public-info-button"
              aria-label="Accessibility and audio guide"
              aria-pressed={showAccessibility}
              onClick={() => { setShowAccessibility((value) => !value); setShowInfo(false); }}
            >
              <span aria-hidden style={{ fontSize: 15, fontWeight: 700, lineHeight: 1 }}>A</span>
            </button>
          )}
        </div>
      </header>
      {activeRoom && <div className="public-room-label"><span>ROOM {String(exhibition.rooms.indexOf(activeRoom) + 1).padStart(2, "0")}</span><i /> {activeRoom.name.toUpperCase()}</div>}
      {exhibition.rooms.length > 1 && <nav className="public-room-nav" aria-label="Exhibition rooms">
        <button aria-label="Previous room" onClick={() => changeRoom((exhibition.rooms.indexOf(activeRoom) - 1 + exhibition.rooms.length) % exhibition.rooms.length)}><ChevronLeft size={15} /></button>
        {exhibition.rooms.map((room, index) => <button key={room.id} className={room.id === activeRoom?.id ? "active" : ""} onClick={() => changeRoom(index)}>{String(index + 1).padStart(2, "0")} <span>{room.name}</span></button>)}
        <button aria-label="Next room" onClick={() => changeRoom((exhibition.rooms.indexOf(activeRoom) + 1) % exhibition.rooms.length)}><ChevronRight size={15} /></button>
      </nav>}
      {!walking && !showListView && (
        <ExhibitionEntryScreen
          title={exhibition.title}
          ownerName={exhibition.ownerName}
          ownerAvatarUrl={exhibition.ownerAvatarUrl}
          artworkCount={exhibition.artworks.length}
          roomCount={exhibition.rooms.length}
          quality={quality}
          onQualityChange={handleQualityChange}
          soundOn={soundOn}
          onSoundChange={handleSoundChange}
          musicTitle={music?.title ?? null}
          onEnter={() => { setWalking(true); setEnterSignal((n) => n + 1); }}
          onOpenListView={() => setShowListView(true)}
          tourAvailable={tourAvailable}
          onStartTour={startTour}
          xrSupport={xrSupport}
          onEnterVR={() => void enterVR()}
          vrStatus={vrStatus}
        />
      )}
      {walking && !showListView && (
        <ExhibitionMinimap
          rooms={exhibition.rooms}
          artworks={exhibition.artworks}
          activeRoomId={activeRoom?.id ?? ""}
          selectedArtworkId={selected?.id}
          cameraStateRef={cameraStateRef}
          onTeleport={handleTeleport}
          onTeleportPoint={handleTeleportPoint}
          onRoomChange={(id) => { setActiveRoomId(id); setSelected(undefined); }}
        />
      )}
      {showListView && (
        <ExhibitionListView
          artworks={exhibition.artworks}
          rooms={exhibition.rooms}
          exhibitionTitle={exhibition.title}
          onViewIn3d={handleTeleport}
          onClose={() => setShowListView(false)}
        />
      )}
      {walking && <div className="public-controls-hint"><span>CLICK THE FLOOR OR USE WASD / ARROWS TO WALK</span><i /> <span>DRAG TO LOOK</span><i /> <span>USE THE FLOOR PLAN TO CHANGE ROOMS</span></div>}
      {walking && <button className="public-reset-view" onClick={() => { exitTour(); walkReset.current += 1; }}>↺ Entrance</button>}
      {walking && (
        <ExhibitionAudioPlayer
          music={music ?? null}
          enabled={soundOn}
          ducked={speakingKey !== null}
          startSignal={enterSignal}
        />
      )}
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
      {walking && xrSupport === "supported" && (
        <button
          className="public-fullscreen public-vr-button"
          aria-label={vrInSession ? t("vr", "exitVR") : t("vr", "enterVR")}
          aria-pressed={vrInSession}
          title={vrInSession ? t("vr", "exitVR") : t("vr", "enterVR")}
          onClick={() => void (vrInSession ? exitVR() : enterVR())}
        ><Headset size={17} /></button>
      )}
      <button className="public-fullscreen" aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={() => void toggleFullscreen()}>{isFullscreen ? <Minimize2 size={17} /> : <Maximize2 size={17} />}</button>
      {fullscreenError && <p className="public-fullscreen-note" role="alert">{fullscreenError}</p>}
      {vrStatus && <p className="public-fullscreen-note" role="status">{vrStatus}</p>}
      {selected && !showListView && (
        <ArtworkDetailPanel
          artwork={selected}
          exhibitionId={exhibition.id}
          ownerName={exhibition.ownerName}
          index={roomArtworks.indexOf(selected) + 1}
          onClose={() => setSelected(undefined)}
        />
      )}
      {tourActive && tourStop && !selected && !showListView && (
        <aside className="tour-panel" aria-label={t("tour", "guidedTour")}>
          <button className="tour-close" onClick={exitTour} aria-label={t("tour", "exitTour")}>×</button>
          <span className="panel-kicker">{t("tour", "guidedTour").toUpperCase()} · {tourIndex! + 1} / {exhibition.tour!.stops.length}</span>
          <h2>{tourStop.title.trim() || `${t("tour", "stop")} ${tourIndex! + 1}`}</h2>
          <p className="tour-room">{exhibition.rooms.find((room) => room.id === tourStop.roomId)?.name}</p>
          {tourStop.text.trim() && <p>{tourStop.text}</p>}
          <div className="tour-nav">
            <button type="button" disabled={tourIndex === 0} onClick={() => goToTourStop(tourIndex! - 1)}>← {t("tour", "previousStop")}</button>
            {tourIndex! < exhibition.tour!.stops.length - 1 ? (
              <button type="button" onClick={() => goToTourStop(tourIndex! + 1)}>{t("tour", "nextStop")} →</button>
            ) : (
              <button type="button" onClick={exitTour}>{t("tour", "finishTour")}</button>
            )}
          </div>
        </aside>
      )}
      {showInfo && !selected && (
        <aside className="artwork-info-card">
          <button className="info-close" onClick={() => setShowInfo(false)} aria-label="Close information">×</button>
          <span className="panel-kicker">ABOUT THIS EXHIBITION</span>
          <h1>{exhibition.title}</h1>
          <p className="public-art-meta">Curated by {exhibition.ownerName}</p>
          <p>{exhibition.description || "A collection of artworks, brought together in a space of its own."}</p>
          <span className="public-art-meta">{exhibition.artworks.length} artworks · {exhibition.rooms.length} rooms</span>
        </aside>
      )}
      {showAccessibility && accessibilityPack && (
        <aside className="artwork-info-card" aria-label="Accessibility and audio guide">
          <button className="info-close" onClick={() => setShowAccessibility(false)} aria-label="Close accessibility panel">×</button>
          <span className="panel-kicker">ACCESSIBILITY · AUDIO GUIDE</span>
          <h1>Listen to the exhibition</h1>
          <p className="public-art-meta">
            Audio descriptions read aloud by your device’s own voices, with full transcripts.
          </p>
          <div style={{ display: "flex", gap: 6, margin: "10px 0 14px" }} role="group" aria-label="Audio guide language">
            {(["en", "fr"] as const).map((language) => (
              <button
                key={language}
                type="button"
                onClick={() => setA11yLang(language)}
                aria-pressed={a11yLang === language}
                style={{
                  padding: "6px 12px",
                  borderRadius: 999,
                  border: "1px solid var(--line, #eceae4)",
                  background: a11yLang === language ? "#141414" : "transparent",
                  color: a11yLang === language ? "#fdfdfc" : "inherit",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                {language === "en" ? "English" : "Français"}
              </button>
            ))}
          </div>
          {(a11yLang === "fr" ? accessibilityPack.introFr : accessibilityPack.introEn).trim() && (
            <div style={{ marginBottom: 16 }}>
              <p>{a11yLang === "fr" ? accessibilityPack.introFr : accessibilityPack.introEn}</p>
              <button
                type="button"
                className="editor-secondary-button"
                onClick={() => speakAccessibility("intro", a11yLang === "fr" ? accessibilityPack.introFr : accessibilityPack.introEn, a11yLang)}
              >
                {speakingKey === "intro" ? "⏸ Stop" : "▶ Listen to the welcome"}
              </button>
            </div>
          )}
          {ttsError && <p role="alert" style={{ color: "#9a3b2e", fontSize: 12 }}>{ttsError}</p>}
          {accessibilityPack.entries.map((entry) => {
            const artwork = exhibition.artworks.find((a) => a.id === entry.artworkId);
            if (!artwork) return null;
            const description = a11yLang === "fr" ? entry.audioDescriptionFr || entry.audioDescription : entry.audioDescription;
            const caption = a11yLang === "fr" ? entry.captionFr || entry.caption : entry.caption;
            const narration = entry.artistNarration || entry.curatorNarration;
            if (!description.trim() && !caption.trim() && !narration.trim() && !entry.transcript.trim()) return null;
            return (
              <div key={entry.artworkId} style={{ marginBottom: 20 }}>
                <span className="panel-kicker">{artwork.title.toUpperCase()}</span>
                {caption.trim() && <p style={{ marginTop: 6 }}>{caption}</p>}
                {description.trim() && (
                  <>
                    <p>{description}</p>
                    <button
                      type="button"
                      className="editor-secondary-button"
                      onClick={() => speakAccessibility(`desc-${entry.artworkId}`, description, a11yLang)}
                    >
                      {speakingKey === `desc-${entry.artworkId}` ? "⏸ Stop" : "▶ Listen to the description"}
                    </button>
                  </>
                )}
                {narration.trim() && (
                  <p style={{ marginTop: 10 }}><em>{narration}</em></p>
                )}
                {entry.transcript.trim() && (
                  <details style={{ marginTop: 10 }}>
                    <summary style={{ cursor: "pointer", fontSize: 12, fontWeight: 600 }}>Transcript</summary>
                    <p style={{ marginTop: 6 }}>{entry.transcript}</p>
                  </details>
                )}
              </div>
            );
          })}
        </aside>
      )}
      <footer className="public-footer"><span>AN EXHIBITION BY {exhibition.ownerName.toUpperCase()}</span><span>MADE WITH <Link href="/">LAKISA <ArrowUpRight size={12} /></Link></span></footer>
    </main>
  );
}
