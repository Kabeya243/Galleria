"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./studio-tools.module.css";

// ---------------------------------------------------------------------------
// Accessibility & Audio Guide Studio — write audio descriptions, artist and
// curator narration, captions and transcripts per artwork, in English and
// French; preview them with the browser's built-in speech synthesis (no
// external API, labelled honestly as a browser preview); check the pack
// against a real accessibility checklist computed from the exhibition
// itself; save it as a SavedWork ("accessibility-pack") so the public
// exhibition can surface it.
// ---------------------------------------------------------------------------

export type AccessibilityArtwork = {
  id: string;
  title: string;
  medium: string;
  year: string;
  dimensions: string;
  description: string;
  imageUrl: string | null;
};

export type AccessibilityExhibition = {
  id: string;
  title: string;
  status: string;
  artworks: AccessibilityArtwork[];
};

type ArtworkEntry = {
  audioDescription: string;
  audioDescriptionFr: string;
  artistNarration: string;
  curatorNarration: string;
  caption: string;
  captionFr: string;
  transcript: string;
};

type PackData = {
  exhibitionId: string;
  exhibitionTitle: string;
  introEn: string;
  introFr: string;
  wallTextColor: string;
  wallBgColor: string;
  entries: Record<string, ArtworkEntry>;
};

type SavedPack = {
  id: string;
  title: string;
  data: PackData;
  createdAt: string;
  updatedAt: string;
};

const EMPTY_ENTRY: ArtworkEntry = {
  audioDescription: "",
  audioDescriptionFr: "",
  artistNarration: "",
  curatorNarration: "",
  caption: "",
  captionFr: "",
  transcript: "",
};

function blankPack(exhibition: AccessibilityExhibition): PackData {
  return {
    exhibitionId: exhibition.id,
    exhibitionTitle: exhibition.title,
    introEn: "",
    introFr: "",
    wallTextColor: "#141414",
    wallBgColor: "#fdfdfc",
    entries: {},
  };
}

function hexToRgb(hex: string): [number, number, number] | null {
  const clean = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(clean)) return null;
  return [
    parseInt(clean.slice(0, 2), 16),
    parseInt(clean.slice(2, 4), 16),
    parseInt(clean.slice(4, 6), 16),
  ];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

function contrastRatio(fg: string, bg: string): number | null {
  const f = hexToRgb(fg);
  const b = hexToRgb(bg);
  if (!f || !b) return null;
  const l1 = relativeLuminance(f);
  const l2 = relativeLuminance(b);
  const [hi, lo] = l1 >= l2 ? [l1, l2] : [l2, l1];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT_SIZES = { S: "13px", M: "16px", L: "20px" } as const;
type TextSize = keyof typeof TEXT_SIZES;

export default function AccessibilityStudio({ exhibitions }: { exhibitions: AccessibilityExhibition[] }) {
  const [exhibitionId, setExhibitionId] = useState(exhibitions[0]?.id ?? "");
  const exhibition = exhibitions.find((e) => e.id === exhibitionId) ?? exhibitions[0];
  const [pack, setPack] = useState<PackData | null>(() =>
    exhibition ? blankPack(exhibition) : null,
  );
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedPack[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [selectedArtworkId, setSelectedArtworkId] = useState<string>("");
  const [lang, setLang] = useState<"en" | "fr">("en");
  const [textSize, setTextSize] = useState<TextSize>("M");
  const [ttsSupported] = useState(
    () => typeof window !== "undefined" && "speechSynthesis" in window,
  );
  const [speakingKey, setSpeakingKey] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);
  const [rate, setRate] = useState(1);

  const artworks = exhibition?.artworks ?? [];
  const selectedArtwork =
    artworks.find((a) => a.id === selectedArtworkId) ?? artworks[0] ?? null;

  const loadSaved = useCallback(async () => {
    setSavedLoading(true);
    setSavedError(null);
    try {
      const res = await fetch("/api/saved-work?kind=accessibility-pack");
      if (!res.ok) throw new Error("fetch");
      const json = (await res.json()) as { saved?: SavedPack[] };
      setSaved(json.saved ?? []);
    } catch {
      setSavedError("Saved packs could not be loaded, check your connection and refresh.");
      setSaved([]);
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  // Stop any preview speech when leaving the tool.
  useEffect(() => {
    return () => {
      if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    };
  }, []);

  const switchExhibition = useCallback(
    (id: string) => {
      const next = exhibitions.find((e) => e.id === id);
      if (!next) return;
      setExhibitionId(id);
      setSelectedArtworkId("");
      setSavedId(null);
      setSaveStatus(null);
      const existing = saved.find((s) => s.data.exhibitionId === id);
      setPack(existing ? existing.data : blankPack(next));
      if (existing) setSavedId(existing.id);
    },
    [exhibitions, saved],
  );

  const entry: ArtworkEntry =
    (selectedArtwork && pack?.entries[selectedArtwork.id]) || EMPTY_ENTRY;

  const setEntryField = useCallback(
    (field: keyof ArtworkEntry, value: string) => {
      if (!selectedArtwork || !pack) return;
      setPack((current) => {
        if (!current) return current;
        const prev = current.entries[selectedArtwork.id] ?? EMPTY_ENTRY;
        return {
          ...current,
          entries: {
            ...current.entries,
            [selectedArtwork.id]: { ...prev, [field]: value },
          },
        };
      });
    },
    [selectedArtwork, pack],
  );

  const setPackField = useCallback((field: keyof PackData, value: string) => {
    setPack((current) => (current ? { ...current, [field]: value } : current));
  }, []);

  const speak = useCallback(
    (key: string, text: string, language: "en" | "fr") => {
      if (!ttsSupported) {
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
      utterance.rate = rate;
      const voices = window.speechSynthesis.getVoices();
      const voice = voices.find((v) => v.lang.toLowerCase().startsWith(language));
      if (voice) utterance.voice = voice;
      utterance.onend = () => setSpeakingKey(null);
      utterance.onerror = () => {
        setSpeakingKey(null);
        setTtsError("The browser could not play this preview.");
      };
      setTtsError(null);
      setSpeakingKey(key);
      window.speechSynthesis.speak(utterance);
    },
    [ttsSupported, speakingKey, rate],
  );

  const stopSpeaking = useCallback(() => {
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    setSpeakingKey(null);
  }, []);

  // --- real checklist, computed from the exhibition and the pack --------
  const checks = useMemo(() => {
    if (!exhibition || !pack) return [];
    const entries = pack.entries;
    const withAudio = artworks.filter((a) => entries[a.id]?.audioDescription.trim());
    const withAudioFr = artworks.filter((a) => entries[a.id]?.audioDescriptionFr.trim());
    const withCaption = artworks.filter((a) => entries[a.id]?.caption.trim());
    const withTranscript = artworks.filter((a) => entries[a.id]?.transcript.trim());
    const withNarration = artworks.filter(
      (a) => entries[a.id]?.artistNarration.trim() || entries[a.id]?.curatorNarration.trim(),
    );
    const ratio = contrastRatio(pack.wallTextColor, pack.wallBgColor);
    return [
      {
        label: "Every artwork has a title",
        detail: `${artworks.filter((a) => a.title.trim()).length} of ${artworks.length} artworks titled`,
        pass: artworks.length > 0 && artworks.every((a) => a.title.trim()),
      },
      {
        label: "Every artwork has an image",
        detail: `${artworks.filter((a) => a.imageUrl).length} of ${artworks.length} artworks have an image, a screen reader needs one to describe`,
        pass: artworks.length > 0 && artworks.every((a) => a.imageUrl),
      },
      {
        label: "Every artwork has an audio description (English)",
        detail: `${withAudio.length} of ${artworks.length} artworks described`,
        pass: artworks.length > 0 && withAudio.length === artworks.length,
      },
      {
        label: "Every artwork has an audio description (French)",
        detail: `${withAudioFr.length} of ${artworks.length} artworks described in French`,
        pass: artworks.length > 0 && withAudioFr.length === artworks.length,
      },
      {
        label: "Every artwork has a caption",
        detail: `${withCaption.length} of ${artworks.length} artworks captioned`,
        pass: artworks.length > 0 && withCaption.length === artworks.length,
      },
      {
        label: "Every artwork has a transcript",
        detail: `${withTranscript.length} of ${artworks.length} artworks transcribed`,
        pass: artworks.length > 0 && withTranscript.length === artworks.length,
      },
      {
        label: "Every artwork has artist or curator narration",
        detail: `${withNarration.length} of ${artworks.length} artworks narrated`,
        pass: artworks.length > 0 && withNarration.length === artworks.length,
      },
      {
        label: "Wall text contrast meets WCAG AA (4.5:1 or better)",
        detail:
          ratio === null
            ? "Pick valid wall text and background colours to measure the contrast."
            : `Measured contrast ${ratio.toFixed(2)}:1, ${ratio >= 4.5 ? "passes AA for normal text" : ratio >= 3 ? "passes AA for large text only" : "too low, darken the text or lighten the wall"}`,
        pass: ratio !== null && ratio >= 4.5,
      },
    ];
  }, [exhibition, pack, artworks]);

  const passedCount = checks.filter((c) => c.pass).length;
  const ratio = pack ? contrastRatio(pack.wallTextColor, pack.wallBgColor) : null;

  const savePack = useCallback(async () => {
    if (!pack || !exhibition) return;
    const title = saveName.trim() || `Accessibility pack: ${exhibition.title}`;
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch("/api/saved-work", {
        method: savedId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          savedId ? { id: savedId, title, data: pack } : { kind: "accessibility-pack", title, data: pack },
        ),
      });
      if (!res.ok) throw new Error("save");
      const json = (await res.json()) as { saved?: SavedPack };
      if (json.saved) setSavedId(json.saved.id);
      setSaveStatus(`Saved as “${title}”. The public exhibition will show this pack to visitors.`);
      setSaveName("");
      await loadSaved();
    } catch {
      setSaveStatus("Could not save, check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }, [pack, exhibition, saveName, savedId, loadSaved]);

  const loadPack = useCallback((row: SavedPack) => {
    const target = exhibitions.find((e) => e.id === row.data.exhibitionId);
    if (target) {
      setExhibitionId(target.id);
      setSelectedArtworkId("");
    }
    setPack(row.data);
    setSavedId(row.id);
    setSaveStatus(`Loaded “${row.title}”.`);
  }, [exhibitions]);

  const deletePack = useCallback(
    async (id: string) => {
      await fetch(`/api/saved-work?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setConfirmDeleteId(null);
      if (savedId === id) {
        setSavedId(null);
        if (exhibition) setPack(blankPack(exhibition));
      }
      await loadSaved();
    },
    [savedId, exhibition, loadSaved],
  );

  if (exhibitions.length === 0) {
    return (
      <div className={styles.wrap}>
        <div className={styles.emptyBox}>
          <strong>No exhibitions yet.</strong>
          <p>Create an exhibition and add artworks first, the accessibility pack is written per exhibition, artwork by artwork.</p>
        </div>
      </div>
    );
  }

  if (!exhibition || !pack) return null;

  const previewText =
    lang === "fr" ? entry.audioDescriptionFr : entry.audioDescription;

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <p className={styles.kicker}>Exhibition</p>
        <div className={styles.field} style={{ marginTop: 0 }}>
          <label htmlFor="a11y-exhibition">Which exhibition is this pack for?</label>
          <select
            id="a11y-exhibition"
            value={exhibition.id}
            onChange={(e) => switchExhibition(e.target.value)}
          >
            {exhibitions.map((e) => (
              <option key={e.id} value={e.id}>
                {e.title} ({e.artworks.length} artworks · {e.status})
              </option>
            ))}
          </select>
        </div>
        <div className={styles.twoCol}>
          <div className={styles.field}>
            <label htmlFor="a11y-intro-en">Welcome narration: English</label>
            <textarea
              id="a11y-intro-en"
              value={pack.introEn}
              onChange={(e) => setPackField("introEn", e.target.value)}
              placeholder="A short spoken welcome visitors hear when they open the exhibition…"
            />
          </div>
          <div className={styles.field}>
            <label htmlFor="a11y-intro-fr">Accueil: français</label>
            <textarea
              id="a11y-intro-fr"
              value={pack.introFr}
              onChange={(e) => setPackField("introFr", e.target.value)}
              placeholder="Un court message d’accueil en français…"
            />
          </div>
        </div>
        <p className={styles.muted} style={{ marginTop: 12 }}>
          The pack is saved per exhibition. When it is saved, the public exhibition
          shows an Accessibility panel with the audio descriptions, a listen button
          and the transcripts.
        </p>
      </div>

      {artworks.length === 0 ? (
        <div className={styles.emptyBox}>
          <strong>This exhibition has no artworks yet.</strong>
          <p>Add artworks in the editor first, each one gets its own audio description, narration, caption and transcript here.</p>
        </div>
      ) : (
        <div className={styles.card}>
          <p className={styles.kicker}>Artworks</p>
          <h2>{selectedArtwork ? selectedArtwork.title : "Pick an artwork"}</h2>
          <div className={styles.artworkPicker}>
            {artworks.map((a) => {
              const e = pack.entries[a.id];
              const done = Boolean(e?.audioDescription.trim() && e?.caption.trim());
              return (
                <button
                  key={a.id}
                  type="button"
                  className={`${styles.artworkPick} ${selectedArtwork?.id === a.id ? styles.artworkPickActive : ""}`}
                  onClick={() => setSelectedArtworkId(a.id)}
                  aria-pressed={selectedArtwork?.id === a.id}
                >
                  {a.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={a.imageUrl} alt="" loading="lazy" />
                  ) : (
                    <span style={{ aspectRatio: "4 / 3", display: "grid", placeItems: "center", background: "#efebe1", color: "#898a82" }}>
                      No image
                    </span>
                  )}
                  <span>{a.title}</span>
                  <small>
                    {a.year} · {a.medium}
                    {done ? " · described ✓" : " · not yet described"}
                  </small>
                </button>
              );
            })}
          </div>

          {selectedArtwork && (
            <>
              <div className={styles.divider} />
              <div className={styles.spread}>
                <div className={styles.tabs} role="group" aria-label="Description language">
                  <button
                    type="button"
                    className={`${styles.tab} ${lang === "en" ? styles.tabActive : ""}`}
                    onClick={() => setLang("en")}
                    aria-pressed={lang === "en"}
                  >
                    English
                  </button>
                  <button
                    type="button"
                    className={`${styles.tab} ${lang === "fr" ? styles.tabActive : ""}`}
                    onClick={() => setLang("fr")}
                    aria-pressed={lang === "fr"}
                  >
                    Français
                  </button>
                </div>
                <p className={styles.muted} style={{ margin: 0 }}>
                  {selectedArtwork.year} · {selectedArtwork.medium}
                  {selectedArtwork.dimensions ? ` · ${selectedArtwork.dimensions}` : ""}
                </p>
              </div>

              <div className={styles.field}>
                <label htmlFor="a11y-audio">
                  Audio description: {lang === "fr" ? "français" : "English"}{" "}
                  <span>(long descriptive text: what is in the work, colours, composition, feeling)</span>
                </label>
                <textarea
                  id="a11y-audio"
                  value={lang === "fr" ? entry.audioDescriptionFr : entry.audioDescription}
                  onChange={(e) =>
                    setEntryField(lang === "fr" ? "audioDescriptionFr" : "audioDescription", e.target.value)
                  }
                  placeholder={
                    lang === "fr"
                      ? "Décrivez l’œuvre comme si vous la racontiez à quelqu’un qui ne la voit pas…"
                      : "Describe the work as if telling someone who cannot see it: subject, colours, composition, mood…"
                  }
                />
              </div>

              <div className={styles.twoCol}>
                <div className={styles.field}>
                  <label htmlFor="a11y-artist">Artist narration <span>(your voice, first person)</span></label>
                  <textarea
                    id="a11y-artist"
                    value={entry.artistNarration}
                    onChange={(e) => setEntryField("artistNarration", e.target.value)}
                    placeholder="What I wanted this work to say…"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="a11y-curator">Curator narration <span>(context, third person)</span></label>
                  <textarea
                    id="a11y-curator"
                    value={entry.curatorNarration}
                    onChange={(e) => setEntryField("curatorNarration", e.target.value)}
                    placeholder="Why this work matters in the exhibition…"
                  />
                </div>
              </div>

              <div className={styles.twoCol}>
                <div className={styles.field}>
                  <label htmlFor="a11y-caption">Caption: English <span>(one or two lines)</span></label>
                  <textarea
                    id="a11y-caption"
                    style={{ minHeight: 64 }}
                    value={entry.caption}
                    onChange={(e) => setEntryField("caption", e.target.value)}
                    placeholder="Short label text for the wall and the screen reader."
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="a11y-caption-fr">Légende: français</label>
                  <textarea
                    id="a11y-caption-fr"
                    style={{ minHeight: 64 }}
                    value={entry.captionFr}
                    onChange={(e) => setEntryField("captionFr", e.target.value)}
                    placeholder="Légende courte en français."
                  />
                </div>
              </div>

              <div className={styles.field}>
                <label htmlFor="a11y-transcript">Transcript <span>(word-for-word text of the audio, for deaf visitors and search)</span></label>
                <textarea
                  id="a11y-transcript"
                  value={entry.transcript}
                  onChange={(e) => setEntryField("transcript", e.target.value)}
                  placeholder="Paste the full spoken text here, exactly as it is heard…"
                />
              </div>

              <h3>Listen &amp; preview</h3>
              <p className={styles.muted}>
                Browser preview: this uses your device’s built-in voices (SpeechSynthesis),
                not a studio recording. It is a way to check wording and length, not the
                audio visitors will hear from a recorded guide.
              </p>
              {!ttsSupported && (
                <p className={styles.statusErr} role="alert">
                  Text-to-speech is not available in this browser, try Chrome, Edge or Safari.
                </p>
              )}
              <div className={styles.row} style={{ marginTop: 10 }}>
                <button
                  type="button"
                  className={`${styles.btn} ${styles.btnPrimary}`}
                  disabled={!ttsSupported || !previewText.trim()}
                  onClick={() =>
                    speak(
                      `audio-${selectedArtwork.id}-${lang}`,
                      previewText,
                      lang,
                    )
                  }
                >
                  {speakingKey === `audio-${selectedArtwork.id}-${lang}`
                    ? "⏸ Stop preview"
                    : "▶ Listen to audio description"}
                </button>
                <button
                  type="button"
                  className={styles.btn}
                  disabled={!entry.artistNarration.trim()}
                  onClick={() => speak(`artist-${selectedArtwork.id}`, entry.artistNarration, "en")}
                >
                  {speakingKey === `artist-${selectedArtwork.id}` ? "⏸ Stop" : "▶ Artist narration"}
                </button>
                <button
                  type="button"
                  className={styles.btn}
                  disabled={!entry.curatorNarration.trim()}
                  onClick={() => speak(`curator-${selectedArtwork.id}`, entry.curatorNarration, "en")}
                >
                  {speakingKey === `curator-${selectedArtwork.id}` ? "⏸ Stop" : "▶ Curator narration"}
                </button>
                {speakingKey && (
                  <button type="button" className={styles.btn} onClick={stopSpeaking}>
                    Stop all
                  </button>
                )}
                <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 11 }}>
                  Speed
                  <input
                    type="range"
                    min={0.6}
                    max={1.4}
                    step={0.1}
                    value={rate}
                    onChange={(e) => setRate(Number(e.target.value))}
                    aria-label="Speech speed"
                  />
                  {rate.toFixed(1)}×
                </label>
              </div>
              {ttsError && (
                <p className={styles.statusErr} role="alert" style={{ marginTop: 8 }}>
                  {ttsError}
                </p>
              )}
              {!previewText.trim() && (
                <p className={styles.status} style={{ marginTop: 8 }}>
                  Write the {lang === "fr" ? "French" : "English"} audio description above to hear it read aloud.
                </p>
              )}

              <h3>How the label reads</h3>
              <p className={styles.muted}>
                Text-size preview: how the caption and audio description render at
                small, medium and large visitor text sizes.
              </p>
              <div className={styles.tabs} role="group" aria-label="Text size preview" style={{ marginTop: 10 }}>
                {(Object.keys(TEXT_SIZES) as TextSize[]).map((size) => (
                  <button
                    key={size}
                    type="button"
                    className={`${styles.tab} ${textSize === size ? styles.tabActive : ""}`}
                    onClick={() => setTextSize(size)}
                    aria-pressed={textSize === size}
                  >
                    {size === "S" ? "Small" : size === "M" ? "Medium" : "Large"}
                  </button>
                ))}
              </div>
              <div className={styles.previewBox} style={{ fontSize: TEXT_SIZES[textSize], lineHeight: 1.6 }}>
                <h4 style={{ fontSize: `calc(${TEXT_SIZES[textSize]} + 4px)` }}>{selectedArtwork.title}</h4>
                <p style={{ margin: "0 0 8px", color: "#898a82" }}>
                  {selectedArtwork.year} · {selectedArtwork.medium}
                  {selectedArtwork.dimensions ? ` · ${selectedArtwork.dimensions}` : ""}
                </p>
                <p style={{ margin: "0 0 8px" }}>
                  {lang === "fr" ? entry.captionFr || entry.caption : entry.caption || "No caption written yet."}
                </p>
                <p style={{ margin: 0 }}>{previewText || "No audio description written yet."}</p>
              </div>
            </>
          )}
        </div>
      )}

      <div className={styles.card}>
        <p className={styles.kicker}>Checklist</p>
        <h2>Is this exhibition ready for every visitor?</h2>
        <p className={styles.muted}>
          Real checks against this exhibition and this pack: {passedCount} of {checks.length} passing.
          Nothing here is assumed: each line is measured from the artworks and the text you wrote.
        </p>
        <ul className={styles.checkList}>
          {checks.map((check) => (
            <li key={check.label}>
              <span className={`${styles.checkIcon} ${check.pass ? styles.checkPass : styles.checkFail}`} aria-hidden>
                {check.pass ? "✓" : "✕"}
              </span>
              <span>
                <strong>{check.label}</strong>
                <small>{check.detail}</small>
              </span>
            </li>
          ))}
        </ul>
        <div className={styles.divider} />
        <h3>Wall text contrast</h3>
        <p className={styles.muted}>
          The contrast of the wall labels visitors read in the room. WCAG AA asks for
          4.5:1 for normal text, this is measured live from the two colours.
        </p>
        <div className={styles.swatchRow} style={{ marginTop: 10 }}>
          <label style={{ fontSize: 11, fontWeight: 600 }}>
            Text colour
            <input
              type="color"
              value={pack.wallTextColor}
              onChange={(e) => setPackField("wallTextColor", e.target.value)}
              aria-label="Wall text colour"
            />
          </label>
          <label style={{ fontSize: 11, fontWeight: 600 }}>
            Wall colour
            <input
              type="color"
              value={pack.wallBgColor}
              onChange={(e) => setPackField("wallBgColor", e.target.value)}
              aria-label="Wall background colour"
            />
          </label>
          <span className={styles.ratio}>
            {ratio === null ? "Invalid colours" : `${ratio.toFixed(2)}:1`}
            {ratio !== null && (ratio >= 4.5 ? ", passes AA" : ratio >= 3 ? ", large text only" : ", fails AA")}
          </span>
        </div>
        <div
          className={styles.previewBox}
          style={{ background: pack.wallBgColor, color: pack.wallTextColor }}
        >
          <p style={{ margin: 0, fontSize: 15, lineHeight: 1.6 }}>
            Wall label preview: {selectedArtwork?.title ?? exhibition.title}. This is how
            the text sits on the wall colour you chose.
          </p>
        </div>
      </div>

      <div className={styles.card}>
        <p className={styles.kicker}>Save</p>
        <h2>Save this accessibility pack</h2>
        <div className={styles.row} style={{ marginTop: 12 }}>
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder={savedId ? "Rename the pack…" : `Accessibility pack: ${exhibition.title}`}
            aria-label="Pack name"
            style={{ flex: 1, minWidth: 220, padding: "10px 12px", border: "1px solid var(--line, #eceae4)", borderRadius: 6, background: "#fff", fontSize: 13 }}
          />
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void savePack()} disabled={saving}>
            {saving ? "Saving…" : savedId ? "Update saved pack" : "Save pack"}
          </button>
        </div>
        {saveStatus && (
          <p className={`${styles.status} ${saveStatus.startsWith("Could") ? styles.statusErr : styles.statusOk}`} role="status" style={{ marginTop: 10 }}>
            {saveStatus}
          </p>
        )}
        <div className={styles.divider} />
        <h3>Saved packs</h3>
        {savedLoading ? (
          <p className={styles.status}>Loading saved packs…</p>
        ) : savedError ? (
          <p className={styles.statusErr} role="alert">{savedError}</p>
        ) : saved.length === 0 ? (
          <p className={styles.status}>No accessibility packs saved yet.</p>
        ) : (
          <div className={styles.list}>
            {saved.map((row) => (
              <div key={row.id} className={styles.listItem}>
                <div>
                  <strong>{row.title}</strong>
                  <span>
                    {row.data.exhibitionTitle} ·{" "}
                    {Object.keys(row.data.entries ?? {}).length} artworks described · updated{" "}
                    {new Date(row.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className={styles.row}>
                  <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => loadPack(row)}>
                    Load
                  </button>
                  {confirmDeleteId === row.id ? (
                    <>
                      <button type="button" className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`} onClick={() => void deletePack(row.id)}>
                        Confirm delete
                      </button>
                      <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => setConfirmDeleteId(null)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <button type="button" className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`} onClick={() => setConfirmDeleteId(row.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
