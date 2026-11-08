"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2, VolumeX } from "lucide-react";
import { useT } from "@/lib/i18n";

// Background music for a public exhibition (option A: one track per
// exhibition). Plain <audio>: no WebAudio, no library, no playlist.
// The parent (PublicExhibition) owns the two decisions — `enabled`
// (the visitor's sound choice from the entry screen, persisted as
// `sanaa-sound`) and `ducked` (true while the audio-guide TTS is
// speaking) — this component only plays/pauses and renders the control.
//
// Autoplay rule: play() is NEVER called on mount. The only automatic
// start is the effect on `startSignal`, which the parent increments
// inside the "Enter" (or "List view") click handler, so the play()
// still runs under user activation. A visitor who paused the track
// by hand stays paused: re-enabling sound does not restart it.
export type ExhibitionMusic = {
  url: string; // same-origin, e.g. /api/audio/audio/<userId>/<uuid>.mp3
  title?: string | null;
  loop?: boolean;
  volume?: number; // 0..1, artist's starting volume
};

const VOLUME_KEY = "sanaa-music-volume";

export default function ExhibitionAudioPlayer({
  music,
  enabled,
  ducked,
  startSignal,
}: {
  music: ExhibitionMusic | null;
  enabled: boolean; // false = visitor switched sound off: never play
  ducked: boolean; // true = lower the music while TTS speaks
  startSignal: number; // increments when the visitor clicks "Enter"
}) {
  const t = useT();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [volume, setVolume] = useState(music?.volume ?? 0.5);
  // True only when the visitor paused the track by hand — sound being
  // switched back on must not override that choice.
  const pausedByHandRef = useRef(false);

  // Persist the visitor's volume choice (same pattern as `sanaa-sound`).
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(VOLUME_KEY);
      if (saved !== null) setVolume(Math.min(1, Math.max(0, Number(saved))));
    } catch {
      // Storage unavailable — keep the artist's default.
    }
  }, []);
  useEffect(() => {
    try {
      window.localStorage.setItem(VOLUME_KEY, String(volume));
    } catch {
      // Storage unavailable — the choice simply does not persist.
    }
  }, [volume]);

  // The entry gesture is the only moment autoplay is allowed:
  // `startSignal` changes inside the "Enter" click handler, so this
  // play() still runs under user activation. Never autoplay on mount.
  useEffect(() => {
    if (startSignal === 0 || !music || !enabled || pausedByHandRef.current) return;
    audioRef.current?.play().catch(() => setPlaying(false));
  }, [startSignal, music, enabled]);

  // Sound switched off mid-visit: pause at once. Switched back on:
  // resume, unless the visitor paused the track by hand.
  useEffect(() => {
    if (!enabled) {
      audioRef.current?.pause();
    } else if (startSignal > 0 && music && !pausedByHandRef.current) {
      audioRef.current?.play().catch(() => setPlaying(false));
    }
  }, [enabled, startSignal, music]);

  // Duck under the audio guide instead of talking over it: 15% of the
  // visitor's volume while TTS speaks, full volume after.
  useEffect(() => {
    if (audioRef.current) audioRef.current.volume = ducked ? volume * 0.15 : volume;
  }, [ducked, volume]);

  if (!music) return null; // no music on this exhibition: no control at all
  return (
    <div className="music-control" role="group" aria-label={t("music", "music")}>
      <audio
        ref={audioRef}
        src={music.url}
        loop={music.loop ?? true}
        preload="auto"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
      />
      <button
        type="button"
        aria-label={playing ? t("music", "pauseMusic") : t("music", "playMusic")}
        aria-pressed={playing}
        onClick={() => {
          const el = audioRef.current;
          if (!el) return;
          if (el.paused) {
            pausedByHandRef.current = false;
            void el.play().catch(() => setPlaying(false));
          } else {
            pausedByHandRef.current = true;
            el.pause(); // a click is a user gesture: play() is allowed here
          }
        }}
      >
        {playing ? <Pause size={16} /> : <Play size={16} />}
      </button>
      <span className="music-title">{music.title?.trim() ? music.title : t("music", "music")}</span>
      <button
        type="button"
        aria-label={volume === 0 ? t("music", "unmuteMusic") : t("music", "muteMusic")}
        onClick={() => setVolume((v) => (v === 0 ? 0.5 : 0))}
      >
        {volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
      </button>
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={volume}
        aria-label={t("music", "musicVolume")}
        onChange={(e) => setVolume(Number(e.target.value))}
      />
    </div>
  );
}
