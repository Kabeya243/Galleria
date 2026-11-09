"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, Maximize2, Minimize2, Pause, Play, Volume2, VolumeX, X, ZoomIn, ZoomOut } from "lucide-react";
import type { Artwork } from "@/lib/demo-data";
import { extractPalette } from "@/lib/palette";
import PaletteSwatches from "@/components/palette-swatches";
import ArWallView from "@/components/ar-wall-view";
import { useT } from "@/lib/i18n";

// Artwork detail panel (public exhibition): the side panel that opens
// when a visitor clicks an artwork in the 3D room. High-resolution
// image with zoom, full metadata, and a "Contact the artist" form wired
// to the inquiries system (POST /api/inquiries with artworkId +
// exhibitionId — no marketplace listing involved).
export default function ArtworkDetailPanel({
  artwork,
  exhibitionId,
  ownerName,
  index,
  onClose,
}: {
  artwork: Artwork;
  exhibitionId: string;
  ownerName: string;
  index: number;
  onClose: () => void;
}) {
  const t = useT();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [zoomed, setZoomed] = useState(false);
  const [origin, setOrigin] = useState({ x: 50, y: 50 });
  // Video artwork: the wall texture is muted by default, and so is this
  // player — browsers block autoplay with sound, and a gallery that
  // starts talking on open would be hostile. Sound turns on only from
  // the visitor's own click on the sound button below (a real gesture,
  // so unmuted play is allowed); turning it off mutes at once. The
  // video loops, like on the wall.
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [soundOn, setSoundOn] = useState(false);
  const isVideo = Boolean(artwork.videoUrl);
  // A video opens playing, muted — muted autoplay is always allowed,
  // and the visitor just clicked the artwork to open this panel. Sound
  // still waits for the sound button below.
  useEffect(() => {
    if (!isVideo) return;
    videoRef.current?.play().catch(() => undefined);
  }, [isVideo]);
  const [showForm, setShowForm] = useState(false);
  const [buyerName, setBuyerName] = useState("");
  const [buyerEmail, setBuyerEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Focus the close button on open; Escape closes. Focus returns to the
  // canvas when the panel unmounts (the browser restores it to the
  // element that had it — the 3D canvas keeps keyboard control).
  useEffect(() => {
    closeRef.current?.focus();
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  function pointerOrigin(event: { clientX: number; clientY: number; currentTarget: { getBoundingClientRect: () => DOMRect } }): { x: number; y: number } {
    const rect = (event.currentTarget as HTMLElement).getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100)),
      y: Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100)),
    };
  }

  async function submitContact(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/inquiries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          artworkId: artwork.id,
          exhibitionId,
          buyerName: buyerName.trim(),
          buyerEmail: buyerEmail.trim(),
          message: message.trim(),
        }),
      });
      const result = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Could not send your message.");
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send your message.");
    } finally {
      setBusy(false);
    }
  }

  const artist = artwork.artist || ownerName;
  // The alt-text (caption/Gemini suggestion, validated by the artist) says
  // what the work shows; without one, fall back to title + artist + year.
  const alt = artwork.altText?.trim()
    ? artwork.altText.trim()
    : `${artwork.title}, ${artist}${artwork.year ? `, ${artwork.year}` : ""}`;

  // Colour palette: works created before ColorThief (or whose palette
  // was never stored) have none on the record, so the panel reads it
  // from the image itself, in the browser, the same way the editor
  // does on selection. Read-only here — the palette is shown, never
  // saved back. A failed read just leaves the section hidden.
  const [extractedPalette, setExtractedPalette] = useState<string[] | null>(null);
  useEffect(() => {
    setExtractedPalette(null);
    if (artwork.text || !artwork.imageUrl || (artwork.palette && artwork.palette.length > 0)) return;
    let cancelled = false;
    extractPalette(artwork.imageUrl).then((palette) => {
      if (!cancelled && palette && palette.length > 0) setExtractedPalette(palette);
    });
    return () => {
      cancelled = true;
    };
  }, [artwork.id, artwork.imageUrl, artwork.palette, artwork.text]);
  const displayPalette =
    artwork.palette && artwork.palette.length > 0 ? artwork.palette : extractedPalette;

  return (
    <aside
      className="artwork-info-card artwork-detail-panel"
      role="dialog"
      aria-modal="true"
      aria-label={artwork.title}
    >
      <button ref={closeRef} className="info-close" onClick={onClose} aria-label={t("common", "close")}>
        <X size={18} />
      </button>
      <span className="panel-kicker">
        {t("artwork", "artwork").toUpperCase()} {String(index).padStart(2, "0")}
      </span>

      {artwork.sculptureUrl ? (
        <figure className="artwork-detail-figure">
          {/* A sculpture has no flat image to show: the work is the 3D
              model standing on its pedestal in the room behind this
              panel. The panel carries the metadata and the contact
              form; the sculpture itself is inspected by walking up to
              it (click its dot on the mini-plan). A poster image, when
              the artist set one, shows below the note instead. */}
          <div
            className="artwork-detail-placeholder"
            style={{ background: `linear-gradient(135deg, ${artwork.color}, ${artwork.accent})`, display: "flex", alignItems: "center", justifyContent: "center", minHeight: 180 }}
            role="img"
            aria-label={alt}
          >
            <span style={{ color: "#fff", fontWeight: 700, letterSpacing: "0.2em", fontSize: 13 }}>3D</span>
          </div>
          <figcaption>{t("sculpture", "sculptureOnPedestal")}</figcaption>
        </figure>
      ) : artwork.videoUrl ? (
        <figure className="artwork-detail-figure">
          {/* The video itself: muted + loop, like the wall texture. No
              native controls — the two buttons below are the controls,
              so the sound switch is always visible and explicit. */}
          <video
            ref={videoRef}
            src={artwork.videoUrl}
            muted={!soundOn}
            loop
            playsInline
            preload="metadata"
            aria-label={alt}
            onClick={() => {
              const el = videoRef.current;
              if (!el) return;
              if (el.paused) void el.play().catch(() => undefined);
              else el.pause();
            }}
            onPlay={() => setVideoPlaying(true)}
            onPause={() => setVideoPlaying(false)}
          />
          <figcaption style={{ display: "flex", gap: "8px", alignItems: "center" }}>
            <button
              type="button"
              aria-label={videoPlaying ? t("video", "pauseVideo") : t("video", "playVideo")}
              aria-pressed={videoPlaying}
              onClick={() => {
                const el = videoRef.current;
                if (!el) return;
                if (el.paused) void el.play().catch(() => undefined);
                else el.pause();
              }}
            >
              {videoPlaying ? <Pause size={13} /> : <Play size={13} />}
              {videoPlaying ? t("video", "pauseVideo") : t("video", "playVideo")}
            </button>
            <button
              type="button"
              aria-label={soundOn ? t("video", "turnSoundOff") : t("video", "turnSoundOn")}
              aria-pressed={soundOn}
              onClick={() => {
                const el = videoRef.current;
                const next = !soundOn;
                setSoundOn(next);
                // A click is a user gesture: unmuting and playing here
                // is allowed. Sound on starts the video too, so the
                // visitor hears it at once instead of a silent frame.
                if (el) {
                  el.muted = !next;
                  if (next && el.paused) void el.play().catch(() => undefined);
                }
              }}
            >
              {soundOn ? <Volume2 size={13} /> : <VolumeX size={13} />}
              {soundOn ? t("video", "turnSoundOff") : t("video", "turnSoundOn")}
            </button>
          </figcaption>
        </figure>
      ) : artwork.imageUrl ? (
        <figure
          className={`artwork-detail-figure${zoomed ? " zoomed" : ""}`}
          onClick={(event) => {
            setOrigin(pointerOrigin(event));
            setZoomed((value) => !value);
          }}
          onPointerMove={(event) => {
            if (zoomed) setOrigin(pointerOrigin(event));
          }}
          role="button"
          tabIndex={0}
          aria-label={zoomed ? t("artwork", "zoomOut") : t("artwork", "zoomIn")}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setZoomed((value) => !value);
            }
          }}
        >
          {/* The full-resolution image: the same URL the 3D texture uses,
              shown at native resolution so details stay sharp. */}
          <img
            src={artwork.imageUrl}
            alt={alt}
            draggable={false}
            style={{ transformOrigin: `${origin.x}% ${origin.y}%` }}
          />
          <figcaption>
            {zoomed ? <Minimize2 size={13} /> : <Maximize2 size={13} />}
            {zoomed ? t("artwork", "zoomOut") : t("artwork", "viewFullSize")}
          </figcaption>
        </figure>
      ) : (
        <div
          className="artwork-detail-placeholder"
          style={{ background: `linear-gradient(135deg, ${artwork.color}, ${artwork.accent})` }}
          role="img"
          aria-label={alt}
        />
      )}

      <h1>{artwork.title}</h1>
      <p className="public-art-meta">
        {artist} <i /> {artwork.year} <i /> {artwork.medium} <i /> {artwork.dimensions}
      </p>
      {artwork.description && <p>{artwork.description}</p>}

      {/* "Voir sur mon mur" (WebXR AR): image artworks only. A video
          work is a moving image and a sculpture is a 3D object — neither
          hangs on a wall as a framed print, so the AR button is not
          offered for them. */}
      {artwork.imageUrl && !artwork.videoUrl && !artwork.sculptureUrl && (
        <ArWallView
          artwork={{
            title: artwork.title,
            dimensions: artwork.dimensions,
            imageUrl: artwork.imageUrl,
            color: artwork.color,
          }}
        />
      )}

      {!artwork.text && displayPalette && displayPalette.length > 0 && (
        <div style={{ marginTop: "14px" }}>
          <span className="panel-kicker">COLOUR PALETTE</span>
          <div style={{ marginTop: "8px" }}>
            <PaletteSwatches palette={displayPalette} size={22} label={`Colour palette of ${artwork.title}`} />
          </div>
        </div>
      )}

      {!showForm && !sent && (
        <button type="button" className="artwork-detail-contact" onClick={() => setShowForm(true)}>
          <Mail size={14} /> {t("artwork", "contactArtist")}
        </button>
      )}
      {showForm && !sent && (
        <form className="artwork-detail-form" onSubmit={submitContact}>
          <span className="panel-kicker">{t("artwork", "writeToArtist")}</span>
          {error && (
            <p className="artwork-detail-error" role="alert">
              {error}
            </p>
          )}
          <label>
            <span>{t("artwork", "yourName")} *</span>
            <input value={buyerName} onChange={(e) => setBuyerName(e.target.value)} required maxLength={200} autoComplete="name" />
          </label>
          <label>
            <span>{t("artwork", "yourEmail")} *</span>
            <input type="email" value={buyerEmail} onChange={(e) => setBuyerEmail(e.target.value)} required maxLength={200} autoComplete="email" />
          </label>
          <label>
            <span>{t("artwork", "yourMessage")} *</span>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              required
              rows={4}
              maxLength={4000}
              placeholder={`${t("artwork", "writeToArtist")}, ${artwork.title}`}
            />
          </label>
          <button type="submit" className="artwork-detail-submit" disabled={busy}>
            {busy ? t("common", "loading") : t("artwork", "sendMessage")}
          </button>
        </form>
      )}
      {sent && (
        <p className="artwork-detail-sent" role="status">
          <strong>{t("artwork", "messageSent")}</strong>
          <span>{t("artwork", "messageSentDetail")}</span>
        </p>
      )}
      {!isVideo && (
        <span className="artwork-detail-zoom-hint">
          <ZoomIn size={12} /> {t("artwork", "zoomIn")}
        </span>
      )}
      {isVideo && (
        <span className="artwork-detail-zoom-hint">
          <VolumeX size={12} /> {t("video", "soundMutedNote")}
        </span>
      )}
    </aside>
  );
}
