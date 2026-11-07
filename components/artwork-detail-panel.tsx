"use client";

import { useEffect, useRef, useState } from "react";
import { Mail, Maximize2, Minimize2, X, ZoomIn, ZoomOut } from "lucide-react";
import type { Artwork } from "@/lib/demo-data";
import PaletteSwatches from "@/components/palette-swatches";
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
  const alt = `${artwork.title} — ${artist}${artwork.year ? `, ${artwork.year}` : ""}`;

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

      {artwork.imageUrl ? (
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

      {!artwork.text && artwork.palette && artwork.palette.length > 0 && (
        <div style={{ marginTop: "14px" }}>
          <span className="panel-kicker">COLOUR PALETTE</span>
          <div style={{ marginTop: "8px" }}>
            <PaletteSwatches palette={artwork.palette} size={22} label={`Colour palette of ${artwork.title}`} />
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
              placeholder={`${t("artwork", "writeToArtist")} — ${artwork.title}`}
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
      <span className="artwork-detail-zoom-hint">
        <ZoomIn size={12} /> {t("artwork", "zoomIn")}
      </span>
    </aside>
  );
}
