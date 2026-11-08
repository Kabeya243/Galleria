"use client";

import { useEffect, useState } from "react";
import { Footprints, Hand, Headset, Keyboard, List, MousePointer2, Music, Route, Volume2, VolumeX } from "lucide-react";
import Avatar from "@/components/avatar";
import type { RenderQuality } from "@/lib/render-quality";
import { RENDER_QUALITIES, recommendQuality } from "@/lib/render-quality";
import type { XrSupport } from "@/lib/webxr";
import { useT } from "@/lib/i18n";

// Entry screen (public exhibition): shown before the visitor enters the
// 3D room. Title, artist, estimated visit time, the control scheme
// (keyboard / mouse / touch), a sound toggle, and a quality choice with
// the automatic recommendation for this device. Pure black & white,
// editorial, mobile-first.
export default function ExhibitionEntryScreen({
  title,
  ownerName,
  ownerAvatarUrl,
  artworkCount,
  roomCount,
  quality,
  onQualityChange,
  soundOn,
  onSoundChange,
  musicTitle = null,
  onEnter,
  onOpenListView,
  tourAvailable = false,
  onStartTour,
  // VR visit (WebXR): the button is offered only when this
  // device/browser reports immersive-vr support; while the check is
  // running the button waits disabled, and when VR is unavailable the
  // screen says why instead of promising a session that cannot start.
  xrSupport = "unknown",
  onEnterVR,
  vrStatus = null,
}: {
  title: string;
  ownerName: string;
  ownerAvatarUrl?: string | null;
  artworkCount: number;
  roomCount: number;
  quality: RenderQuality;
  onQualityChange: (quality: RenderQuality) => void;
  soundOn: boolean;
  onSoundChange: (on: boolean) => void;
  musicTitle?: string | null;
  onEnter: () => void;
  onOpenListView: () => void;
  // Guided tour: when the exhibition has an enabled tour, a third
  // entry button starts it at the first stop instead of free walking.
  tourAvailable?: boolean;
  onStartTour?: () => void;
  xrSupport?: XrSupport;
  onEnterVR?: () => void;
  vrStatus?: string | null;
}) {
  const t = useT();
  const [recommended, setRecommended] = useState<RenderQuality>("high");
  useEffect(() => {
    setRecommended(recommendQuality());
  }, []);

  // ~45 seconds per artwork + 1 minute to arrive and look around,
  // at least 2 minutes for the smallest shows.
  const estimatedMinutes = Math.max(2, Math.ceil(artworkCount * 0.75) + 1);
  const qualityLabel: Record<RenderQuality, string> = {
    high: t("entry", "qualityHigh"),
    medium: t("entry", "qualityMedium"),
    low: t("entry", "qualityLow"),
  };

  return (
    <div className="exhibition-entry" role="dialog" aria-modal="true" aria-label={title}>
      <div className="entry-creator">
        <Avatar name={ownerName} avatarUrl={ownerAvatarUrl} className="entry-creator-avatar" />
        <span className="panel-kicker">{ownerName.toUpperCase()} PRESENTS</span>
      </div>
      <h1>{title}</h1>
      <p className="entry-meta">
        {artworkCount} {t("listView", "artworks")} · {roomCount} {t("minimap", "room").toLowerCase()}
        {roomCount > 1 ? "s" : ""} · {t("entry", "estimatedVisit")} : {estimatedMinutes}{" "}
        {estimatedMinutes > 1 ? t("common", "minutes") : t("common", "minute")}
      </p>
      {musicTitle?.trim() && (
        <p className="entry-music">
          <Music size={14} aria-hidden="true" />
          <span>{t("entry", "music")}: {musicTitle}</span>
        </p>
      )}

      <div className="entry-controls" aria-label={t("entry", "controls")}>
        <div>
          <Keyboard size={16} aria-hidden="true" />
          <strong>{t("entry", "keyboard")}</strong>
          <span>{t("entry", "moveKeys")}</span>
        </div>
        <div>
          <MousePointer2 size={16} aria-hidden="true" />
          <strong>{t("entry", "mouse")}</strong>
          <span>{t("entry", "dragLook")}</span>
          <span>{t("entry", "clickArtwork")}</span>
        </div>
        <div>
          <Hand size={16} aria-hidden="true" />
          <strong>{t("entry", "touch")}</strong>
          <span>{t("entry", "touchPad")}</span>
          <span>{t("entry", "clickFloor")}</span>
        </div>
      </div>

      <div className="entry-options">
        <button
          type="button"
          className="entry-option"
          onClick={() => onSoundChange(!soundOn)}
          aria-pressed={soundOn}
        >
          {soundOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
          <span>
            <strong>{t("entry", "sound")}</strong>
            <small>{soundOn ? t("entry", "soundOn") : t("entry", "soundOff")}</small>
          </span>
        </button>
        <div className="entry-quality" role="group" aria-label={t("entry", "quality")}>
          <span className="entry-quality-label">
            <strong>{t("entry", "quality")}</strong>
            <small>{t("entry", "qualityNote")}</small>
          </span>
          <div className="entry-quality-buttons">
            {RENDER_QUALITIES.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onQualityChange(option)}
                aria-pressed={quality === option}
                className={quality === option ? "active" : ""}
              >
                {qualityLabel[option]}
                {option === recommended && (
                  <em> · {t("entry", "qualityRecommended")}</em>
                )}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="entry-actions">
        <button type="button" className="entry-enter" onClick={onEnter}>
          <Footprints size={16} /> {t("entry", "enterRoom")}
        </button>
        {onEnterVR && xrSupport === "supported" && (
          <button type="button" className="entry-list" onClick={onEnterVR}>
            <Headset size={15} /> {t("vr", "enterVR")}
          </button>
        )}
        {onEnterVR && xrSupport === "unknown" && (
          <button type="button" className="entry-list" disabled>
            <Headset size={15} /> {t("vr", "checking")}
          </button>
        )}
        {tourAvailable && onStartTour && (
          <button type="button" className="entry-list" onClick={onStartTour}>
            <Route size={15} /> {t("tour", "guidedTour")}
          </button>
        )}
        <button type="button" className="entry-list" onClick={onOpenListView}>
          <List size={15} /> {t("listView", "listView")}
        </button>
      </div>
      {(xrSupport === "unsupported" || xrSupport === "error") && (
        <p className="entry-vr-note">{t("vr", "notSupportedHint")}</p>
      )}
      {vrStatus && (
        <p className="entry-vr-note" role="status">{vrStatus}</p>
      )}
    </div>
  );
}
