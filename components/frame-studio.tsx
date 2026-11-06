"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import FrameThumbnail from "@/components/frame-thumbnail";
import {
  FRAME_FINISH_LABELS,
  FRAME_GLASS_LABELS,
  FRAME_MATERIAL_LABELS,
  FRAME_PRESETS,
  FRAME_PROFILE_LABELS,
  FRAME_VARIANTS,
  effectiveFrameConfig,
  encodeFrameConfig,
  isCustomFrame,
  parseFrameConfig,
  parseSavedFrameConfig,
} from "@/lib/demo-data";
import type { FrameConfig, FrameFinish, FrameGlass, FrameMaterial, FrameProfile, FrameVariant } from "@/lib/demo-data";

export type FrameStudioArtwork = {
  id: string;
  title: string;
  medium: string;
  dimensions: string;
  year: string;
  color: string;
  accent: string;
  imageUrl: string | null;
  exhibitionId: string;
  exhibitionTitle: string;
  frame: string;
};

type SavedFramePreset = {
  id: string;
  title: string;
  data: Record<string, unknown>;
  artworkId: string | null;
  createdAt: string;
  updatedAt: string;
};

// Standalone Frame Studio: pick one of your artworks, preview it in
// every frame style, customise the frame (width, depth, material,
// colour, finish, grain, profile, inner border, matboard, glass, float
// and recess), compare up to 4 frames side by side, and save the chosen
// frame straight onto the artwork — the same frame value the 3D editor
// and the public exhibition read, so what you choose here is what hangs.
export default function FrameStudio({
  artworks,
  initialArtworkId,
}: {
  artworks: FrameStudioArtwork[];
  // Deep-link context (Art in Context step 4): open with this artwork
  // already selected instead of the first work in the library.
  initialArtworkId?: string;
}) {
  const initialSelected = artworks.find((a) => a.id === initialArtworkId) ?? artworks[0];
  const [selectedId, setSelectedId] = useState(initialSelected?.id ?? "");
  const selected = artworks.find((artwork) => artwork.id === selectedId) ?? artworks[0];
  const [frameValue, setFrameValue] = useState(initialSelected?.frame ?? "wood");
  const [savedFrame, setSavedFrame] = useState(initialSelected?.frame ?? "wood");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveError, setSaveError] = useState<string | null>(null);
  const [customising, setCustomising] = useState(false);
  const [comparing, setComparing] = useState(false);
  const [compareFrames, setCompareFrames] = useState<string[]>([]);
  const [presets, setPresets] = useState<SavedFramePreset[]>([]);
  const [presetsLoaded, setPresetsLoaded] = useState(false);
  const [presetsLoading, setPresetsLoading] = useState(false);
  const [presetsError, setPresetsError] = useState<string | null>(null);
  const [presetName, setPresetName] = useState("");
  const [presetMessage, setPresetMessage] = useState<string | null>(null);
  const [presetBusy, setPresetBusy] = useState(false);
  const [confirmDeletePresetId, setConfirmDeletePresetId] = useState<string | null>(null);

  const dirty = selected ? frameValue !== savedFrame : false;
  // The editable configuration behind the current frame value. A "none"
  // frame customises from plain wood, since there is no frame to customise.
  const frameConfig: FrameConfig | null = selected
    ? (() => {
        const config = effectiveFrameConfig(frameValue);
        return config.base === "none" ? { ...config, base: "wood" } : config;
      })()
    : null;
  const custom = parseFrameConfig(frameValue);
  const previewVariant = custom ? custom.base : ((frameValue as FrameVariant) in FRAME_VARIANTS ? (frameValue as FrameVariant) : "wood");
  const currentLabel = custom
    ? `${FRAME_VARIANTS[custom.base]?.label ?? custom.base} · custom`
    : (FRAME_VARIANTS[previewVariant]?.label ?? frameValue);

  function selectArtwork(id: string) {
    const next = artworks.find((artwork) => artwork.id === id);
    if (!next) return;
    setSelectedId(id);
    setFrameValue(next.frame);
    setSavedFrame(next.frame);
    setSaveState("idle");
    setSaveError(null);
    setCompareFrames([]);
  }

  function applyFrameValue(value: string) {
    setFrameValue(value);
    setSaveState("idle");
    setSaveError(null);
  }

  function applyFrameConfig(config: FrameConfig) {
    const encoded = encodeFrameConfig(config);
    if (encoded) applyFrameValue(encoded);
  }

  function updateFrameConfig(patch: Partial<FrameConfig>) {
    if (!frameConfig) return;
    const encoded = encodeFrameConfig({ ...frameConfig, ...patch });
    if (encoded) applyFrameValue(encoded);
  }

  function toggleCompareFrame(value: string) {
    setCompareFrames((current) =>
      current.includes(value) ? current.filter((item) => item !== value) : current.length >= 4 ? current : [...current, value],
    );
  }

  function compareFrameLabel(value: string): string {
    const parsed = parseFrameConfig(value);
    if (parsed) return `${FRAME_VARIANTS[parsed.base]?.label ?? parsed.base} · custom`;
    return FRAME_VARIANTS[value as FrameVariant]?.label ?? value;
  }

  async function saveFrame() {
    if (!selected || !dirty) return;
    setSaveState("saving");
    setSaveError(null);
    try {
      const response = await fetch(`/api/artworks/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ frame: frameValue }),
      });
      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as { error?: string } | null;
        throw new Error(result?.error ?? "Could not save this frame.");
      }
      setSavedFrame(frameValue);
      setSaveState("saved");
    } catch (error) {
      setSaveState("error");
      setSaveError(error instanceof Error ? error.message : "Could not save this frame.");
    }
  }

  async function loadPresets() {
    setPresetsLoading(true);
    setPresetsError(null);
    try {
      const response = await fetch("/api/saved-work?kind=frame-preset");
      if (!response.ok) throw new Error(response.status === 401 ? "Sign in to save frame presets." : "Could not load your frame presets.");
      const result = (await response.json()) as { saved: SavedFramePreset[] };
      setPresets(result.saved ?? []);
      setPresetsLoaded(true);
    } catch (error) {
      setPresetsError(error instanceof Error ? error.message : "Could not load your frame presets.");
    } finally {
      setPresetsLoading(false);
    }
  }

  useEffect(() => {
    if (!presetsLoaded && !presetsLoading) void loadPresets();
    // Load once, on first render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function savePreset() {
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
      setPresetsLoaded(false);
      await loadPresets();
    } catch (error) {
      setPresetMessage(error instanceof Error ? error.message : "Could not save this preset.");
    } finally {
      setPresetBusy(false);
    }
  }

  async function deletePreset(id: string) {
    setPresetBusy(true);
    try {
      const response = await fetch(`/api/saved-work?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Could not delete this preset.");
      setConfirmDeletePresetId(null);
      await loadPresets();
    } catch (error) {
      setPresetMessage(error instanceof Error ? error.message : "Could not delete this preset.");
    } finally {
      setPresetBusy(false);
    }
  }

  if (!selected) return null;

  return (
    <div>
      {/* Artwork picker. */}
      <div className="property-section">
        <label>ARTWORK</label>
        <select
          className="full-input"
          aria-label="Choose an artwork to frame"
          value={selected.id}
          onChange={(event) => selectArtwork(event.target.value)}
        >
          {artworks.map((artwork) => (
            <option key={artwork.id} value={artwork.id}>
              {artwork.title} — {artwork.exhibitionTitle}
            </option>
          ))}
        </select>
        <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "9px", lineHeight: 1.6 }}>
          {selected.year} · {selected.medium} · {selected.dimensions} · from “{selected.exhibitionTitle}”.{" "}
          <Link href={`/editor/${selected.exhibitionId}`} style={{ color: "var(--accent)" }}>
            Open in the 3D editor
          </Link>
        </p>
      </div>

      {/* Live preview of the artwork in the current frame, and save. */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "20px",
          alignItems: "flex-start",
          padding: "16px 0",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <div style={{ flex: "0 0 auto", maxWidth: "100%" }}>
          <FrameThumbnail
            variant={previewVariant}
            config={custom}
            imageUrl={selected.imageUrl}
            artworkColor={selected.color}
            width={320}
            height={240}
          />
        </div>
        <div style={{ flex: "1 1 220px", minWidth: "220px" }}>
          <p className="eyebrow" style={{ margin: "0 0 6px" }}>
            <span className="status-dot" /> CURRENT FRAME
          </p>
          <h3 style={{ margin: "0 0 6px", fontSize: "18px" }}>{currentLabel}</h3>
          <p style={{ margin: "0 0 12px", color: "var(--muted)", fontSize: "9px", lineHeight: 1.6 }}>
            {isCustomFrame(frameValue)
              ? `A custom frame, based on ${FRAME_VARIANTS[frameConfig?.base ?? "wood"]?.label ?? frameConfig?.base}.`
              : "A built-in frame style — pick another below, or customise this one."}
          </p>
          <div className="property-actions" style={{ paddingTop: 0 }}>
            <button
              type="button"
              disabled={!dirty || saveState === "saving"}
              onClick={() => void saveFrame()}
              style={{ minWidth: "150px", height: "32px", fontSize: "9px", fontWeight: 600 }}
            >
              {saveState === "saving" ? "Saving…" : dirty ? "Save frame to artwork" : "Frame saved"}
            </button>
            {isCustomFrame(frameValue) && (
              <button type="button" onClick={() => applyFrameValue(frameConfig?.base ?? "wood")}>
                Reset to the built-in style
              </button>
            )}
          </div>
          {saveState === "saved" && (
            <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "9px" }}>
              Saved — “{selected.title}” now hangs in {currentLabel} in the editor and in the public exhibition.
            </p>
          )}
          {saveState === "error" && saveError && (
            <p style={{ margin: "8px 0 0", color: "var(--danger, #b3261e)", fontSize: "9px", lineHeight: 1.6 }}>
              {saveError}{" "}
              <button
                type="button"
                style={{ padding: 0, border: 0, background: "none", color: "var(--accent)", fontSize: "9px", textDecoration: "underline", cursor: "pointer" }}
                onClick={() => void saveFrame()}
              >
                Retry
              </button>
            </p>
          )}
          {dirty && saveState !== "saving" && (
            <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "9px" }}>
              Unsaved changes — save to apply this frame to the artwork.
            </p>
          )}
        </div>
      </div>

      {/* Frame catalogue: all 28 styles, with faithful previews. */}
      <div className="property-section">
        <label>
          FRAME CATALOGUE <span>{Object.keys(FRAME_VARIANTS).length} STYLES</span>
        </label>
        <div className="frame-options">
          {(Object.keys(FRAME_VARIANTS) as FrameVariant[]).map((variant) => {
            const isCurrent = !comparing && frameValue === variant;
            const inCompare = compareFrames.includes(variant);
            return (
              <button
                key={variant}
                type="button"
                className={`frame-option${isCurrent || inCompare ? " selected" : ""}`}
                aria-pressed={isCurrent || inCompare}
                title={
                  comparing
                    ? inCompare
                      ? `Remove ${FRAME_VARIANTS[variant].label} from the comparison`
                      : `Add ${FRAME_VARIANTS[variant].label} to the comparison (up to 4)`
                    : `Frame this artwork in ${FRAME_VARIANTS[variant].label}`
                }
                onClick={() => {
                  if (comparing) {
                    toggleCompareFrame(variant);
                    return;
                  }
                  applyFrameValue(variant);
                }}
              >
                <FrameThumbnail variant={variant} imageUrl={selected.imageUrl} artworkColor={selected.color} />
                {FRAME_VARIANTS[variant].label}
                {inCompare && <span>· in compare</span>}
              </button>
            );
          })}
        </div>
        <div className="property-actions">
          <button type="button" onClick={() => setCustomising((value) => !value)}>
            {customising ? "Hide frame controls" : "Customise this frame"}
          </button>
          <button
            type="button"
            aria-pressed={comparing}
            onClick={() => {
              setComparing((value) => !value);
              if (comparing) setCompareFrames([]);
            }}
          >
            {comparing ? "Done comparing" : "Compare frames"}
          </button>
        </div>
        {comparing && (
          <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>
            Comparing — click frames in the catalogue above to add or remove them (up to 4), then apply one below.
          </p>
        )}
      </div>

      {/* Compare up to 4 frames side by side. */}
      {comparing && (
        <div className="property-section">
          <label>
            COMPARE FRAMES <span>{compareFrames.length}/4</span>
          </label>
          {compareFrames.length === 0 ? (
            <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>
              No frames selected yet. Click frames in the catalogue above to add up to 4 here.
            </p>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "10px", marginTop: "8px" }}>
              {compareFrames.map((value) => {
                const parsed = parseFrameConfig(value);
                const variant = parsed ? parsed.base : (value as FrameVariant);
                return (
                  <div
                    key={value}
                    style={{ minWidth: 0, border: "1px solid var(--border)", borderRadius: "3px", padding: "8px", background: "var(--surface-3)" }}
                  >
                    <FrameThumbnail variant={variant} config={parsed} imageUrl={selected.imageUrl} artworkColor={selected.color} width={180} height={135} />
                    <div style={{ marginTop: "8px", color: "var(--ink)", fontSize: "9px", fontWeight: 600, lineHeight: 1.4 }}>
                      {compareFrameLabel(value)}
                    </div>
                    <div style={{ display: "flex", gap: "6px", marginTop: "8px" }}>
                      <button
                        type="button"
                        style={{ flex: 1, padding: "5px 6px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-2)", color: "var(--ink)", fontSize: "9px", cursor: "pointer" }}
                        onClick={() => applyFrameValue(value)}
                      >
                        Apply
                      </button>
                      <button
                        type="button"
                        aria-label={`Remove ${compareFrameLabel(value)} from the comparison`}
                        style={{ padding: "5px 6px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-3)", color: "var(--muted)", fontSize: "9px", cursor: "pointer" }}
                        onClick={() => toggleCompareFrame(value)}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Custom frame controls — the same controls as the editor inspector. */}
      {customising && frameConfig && (
        <>
          <div className="property-section">
            <label>
              OUTER BORDER WIDTH <span>{Math.round(frameConfig.width * 100)} CM</span>
            </label>
            <div className="range-control">
              <input aria-label="Frame outer border width in centimetres" type="range" min="0.02" max="0.25" step="0.005" value={frameConfig.width} onChange={(event) => updateFrameConfig({ width: Number(event.target.value) })} />
              <span>{Math.round(frameConfig.width * 100)} cm</span>
            </div>
          </div>
          <div className="property-section">
            <label>
              DEPTH <span>{Math.round(frameConfig.depth * 100)} CM</span>
            </label>
            <div className="range-control">
              <input aria-label="Frame depth in centimetres" type="range" min="0.05" max="0.3" step="0.005" value={frameConfig.depth} onChange={(event) => updateFrameConfig({ depth: Number(event.target.value) })} />
              <span>{Math.round(frameConfig.depth * 100)} cm</span>
            </div>
          </div>
          <div className="property-section">
            <label>MATERIAL</label>
            <select className="full-input" aria-label="Frame material" value={frameConfig.material} onChange={(event) => updateFrameConfig({ material: event.target.value as FrameMaterial })}>
              {(Object.keys(FRAME_MATERIAL_LABELS) as FrameMaterial[]).map((material) => (
                <option key={material} value={material}>
                  {FRAME_MATERIAL_LABELS[material]}
                </option>
              ))}
            </select>
          </div>
          <div className="property-section">
            <label>COLOUR</label>
            <div className="room-color-control">
              <input type="color" aria-label="Frame colour" value={frameConfig.color} onChange={(event) => updateFrameConfig({ color: event.target.value })} />
              <span>{frameConfig.color}</span>
            </div>
          </div>
          <div className="property-section">
            <label>FINISH</label>
            <select className="full-input" aria-label="Frame finish" value={frameConfig.finish} onChange={(event) => updateFrameConfig({ finish: event.target.value as FrameFinish })}>
              {(Object.keys(FRAME_FINISH_LABELS) as FrameFinish[]).map((finish) => (
                <option key={finish} value={finish}>
                  {FRAME_FINISH_LABELS[finish]}
                </option>
              ))}
            </select>
          </div>
          <div className="property-section">
            <label>
              WOOD-GRAIN INTENSITY <span>{Math.round(frameConfig.grain * 100)}%</span>
            </label>
            <div className="range-control">
              <input aria-label="Wood-grain intensity" type="range" min="0" max="1" step="0.05" value={frameConfig.grain} disabled={frameConfig.material !== "wood"} onChange={(event) => updateFrameConfig({ grain: Number(event.target.value) })} />
              <span>{Math.round(frameConfig.grain * 100)}%</span>
            </div>
            {frameConfig.material !== "wood" && (
              <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: "8px" }}>Wood grain applies to wood frames.</p>
            )}
          </div>
          <div className="property-section">
            <label>EDGE PROFILE</label>
            <select className="full-input" aria-label="Frame edge profile" value={frameConfig.profile} onChange={(event) => updateFrameConfig({ profile: event.target.value as FrameProfile })}>
              {(Object.keys(FRAME_PROFILE_LABELS) as FrameProfile[]).map((profile) => (
                <option key={profile} value={profile}>
                  {FRAME_PROFILE_LABELS[profile]}
                </option>
              ))}
            </select>
          </div>
          <div className="property-section">
            <label>
              INNER BORDER WIDTH <span>{Math.round(frameConfig.innerBorder * 1000)} MM</span>
            </label>
            <div className="range-control">
              <input aria-label="Inner border width in millimetres" type="range" min="0" max="0.03" step="0.001" value={frameConfig.innerBorder} onChange={(event) => updateFrameConfig({ innerBorder: Number(event.target.value) })} />
              <span>{Math.round(frameConfig.innerBorder * 1000)} mm</span>
            </div>
          </div>
          <div className="property-section">
            <label>
              MATBOARD WIDTH <span>{Math.round(frameConfig.matWidth * 100)} CM</span>
            </label>
            <div className="range-control">
              <input aria-label="Matboard width in centimetres" type="range" min="0" max="0.3" step="0.005" value={frameConfig.matWidth} onChange={(event) => updateFrameConfig({ matWidth: Number(event.target.value) })} />
              <span>{Math.round(frameConfig.matWidth * 100)} cm</span>
            </div>
          </div>
          <div className="property-section">
            <label>MATBOARD COLOUR</label>
            <div className="room-color-control">
              <input type="color" aria-label="Matboard colour" value={frameConfig.matColor} onChange={(event) => updateFrameConfig({ matColor: event.target.value })} />
              <span>{frameConfig.matColor}</span>
            </div>
          </div>
          <div className="property-section">
            <label>GLASS</label>
            <select className="full-input" aria-label="Glass type" value={frameConfig.glass} onChange={(event) => updateFrameConfig({ glass: event.target.value as FrameGlass })}>
              {(Object.keys(FRAME_GLASS_LABELS) as FrameGlass[]).map((glass) => (
                <option key={glass} value={glass}>
                  {FRAME_GLASS_LABELS[glass]}
                </option>
              ))}
            </select>
          </div>
          <div className="property-section">
            <label>
              FLOAT GAP <span>{Math.round(frameConfig.floatGap * 100)} CM</span>
            </label>
            <div className="range-control">
              <input aria-label="Float gap in centimetres" type="range" min="0" max="0.2" step="0.005" value={frameConfig.floatGap} onChange={(event) => updateFrameConfig({ floatGap: Number(event.target.value) })} />
              <span>{Math.round(frameConfig.floatGap * 100)} cm</span>
            </div>
            <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: "8px" }}>How far the artwork floats inside the frame.</p>
          </div>
          <div className="property-section">
            <label>
              RECESS <span>{Math.round(frameConfig.recess * 100)} CM</span>
            </label>
            <div className="range-control">
              <input aria-label="Artwork recess in centimetres" type="range" min="0" max="0.15" step="0.005" value={frameConfig.recess} onChange={(event) => updateFrameConfig({ recess: Number(event.target.value) })} />
              <span>{Math.round(frameConfig.recess * 100)} cm</span>
            </div>
            <p style={{ margin: "6px 0 0", color: "var(--muted)", fontSize: "8px" }}>How far behind the front face the artwork sits.</p>
          </div>
        </>
      )}

      {/* Presets: built-in, and your saved ones. */}
      <div className="property-section">
        <label>FRAME PRESETS</label>
        <div className="frame-options">
          {FRAME_PRESETS.map((preset) => (
            <button key={preset.name} type="button" className="frame-option" title={preset.description} onClick={() => applyFrameConfig(preset.config)}>
              <FrameThumbnail variant={preset.config.base} config={preset.config} imageUrl={selected.imageUrl} artworkColor={selected.color} />
              {preset.name}
            </button>
          ))}
        </div>
        {presetsLoading && <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "8px" }}>Loading your presets…</p>}
        {presetsError && (
          <p style={{ margin: "8px 0 0", color: "var(--danger, #b3261e)", fontSize: "8px", lineHeight: 1.6 }}>
            {presetsError}{" "}
            <button
              type="button"
              style={{ padding: 0, border: 0, background: "none", color: "var(--accent)", fontSize: "8px", textDecoration: "underline", cursor: "pointer" }}
              onClick={() => void loadPresets()}
            >
              Retry
            </button>
          </p>
        )}
        {!presetsLoading && !presetsError && presets.length > 0 && (
          <div style={{ marginTop: "8px" }}>
            {presets.map((preset) => {
              const config = parseSavedFrameConfig(preset.data);
              const encoded = encodeFrameConfig(config);
              return (
                <div key={preset.id} style={{ display: "flex", alignItems: "center", gap: "6px", padding: "7px 0", borderBottom: "1px solid var(--border)" }}>
                  <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ink)", fontSize: "9px", fontWeight: 600 }}>
                    {preset.title}
                  </span>
                  <button
                    type="button"
                    style={{ padding: "3px 7px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-3)", color: "var(--ink)", fontSize: "8px", cursor: "pointer" }}
                    onClick={() => applyFrameConfig(config)}
                  >
                    Apply
                  </button>
                  <button
                    type="button"
                    style={{ padding: "3px 7px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-3)", color: "var(--muted)", fontSize: "8px", cursor: "pointer" }}
                    onClick={() => {
                      setComparing(true);
                      if (encoded) toggleCompareFrame(encoded);
                    }}
                  >
                    Compare
                  </button>
                  <button
                    type="button"
                    style={{ padding: "3px 7px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-3)", color: "var(--danger, #b3261e)", fontSize: "8px", cursor: "pointer" }}
                    onClick={() => {
                      if (confirmDeletePresetId === preset.id) void deletePreset(preset.id);
                      else setConfirmDeletePresetId(preset.id);
                    }}
                  >
                    {confirmDeletePresetId === preset.id ? "Click again to delete" : "Delete"}
                  </button>
                </div>
              );
            })}
          </div>
        )}
        <div style={{ marginTop: "10px" }}>
          <label style={{ display: "block", marginBottom: "6px", color: "var(--muted)", fontSize: "8px", letterSpacing: ".1em", fontWeight: 600 }}>
            SAVE THIS FRAME AS A PRESET
          </label>
          <div style={{ display: "flex", gap: "6px" }}>
            <input
              className="full-input"
              aria-label="Preset name"
              value={presetName}
              onChange={(event) => setPresetName(event.target.value.slice(0, 60))}
              placeholder="Preset name, e.g. Warm walnut"
              style={{ flex: 1 }}
            />
            <button
              type="button"
              disabled={presetBusy}
              onClick={() => void savePreset()}
              style={{ padding: "0 12px", border: "1px solid var(--border)", borderRadius: "3px", background: "var(--surface-3)", color: "var(--ink)", fontSize: "8px", cursor: "pointer" }}
            >
              {presetBusy ? "Saving…" : "Save preset"}
            </button>
          </div>
          {presetMessage && <p style={{ margin: "8px 0 0", color: "var(--muted)", fontSize: "8px", lineHeight: 1.6 }}>{presetMessage}</p>}
        </div>
      </div>

      <p style={{ margin: "16px 0 0", color: "var(--muted)", fontSize: "9px", lineHeight: 1.7 }}>
        The frame you save here is the same frame the 3D editor shows and the public exhibition hangs — no need to re-frame the work in
        two places.
      </p>
    </div>
  );
}
