"use client";

import { useState } from "react";
import { ROOM_MODELS, roomLayouts, type RoomModelId } from "@/lib/rooms";
import { useT } from "@/lib/i18n";

// Create-exhibition dialog (feature 7): the title is mandatory and the
// visitor picks one of the four named room models for the first room.
// The model only seeds the first room — layouts can still be switched
// and rooms added in the editor afterwards.
export default function ExhibitionCreateDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (title: string, model: RoomModelId) => Promise<void>;
}) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [model, setModel] = useState<RoomModelId>("minimalist");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = title.trim();

  const modelText: Record<RoomModelId, { name: string; desc: string }> = {
    minimalist: { name: t("create", "modelMinimalist"), desc: t("create", "modelMinimalistDesc") },
    classic: { name: t("create", "modelClassic"), desc: t("create", "modelClassicDesc") },
    studio: { name: t("create", "modelStudio"), desc: t("create", "modelStudioDesc") },
    outdoor: { name: t("create", "modelOutdoor"), desc: t("create", "modelOutdoorDesc") },
  };

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!trimmed) {
      setError(t("create", "titleRequired"));
      return;
    }
    setCreating(true);
    setError(null);
    try {
      await onCreate(trimmed, model);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("create", "titleRequired"));
      setCreating(false);
    }
  }

  return (
    <div className="create-dialog-overlay" role="presentation" onClick={onClose}>
      <div
        className="create-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={t("create", "createExhibition")}
        onClick={(event) => event.stopPropagation()}
      >
        <form onSubmit={submit}>
          <h2 className="create-dialog-title">{t("create", "createExhibition")}</h2>
          <label className="create-dialog-label" htmlFor="create-exhibition-title">
            {t("create", "exhibitionTitle")} *
          </label>
          <input
            id="create-exhibition-title"
            className="create-dialog-input"
            type="text"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder={t("create", "titlePlaceholder")}
            autoFocus
            required
            aria-required="true"
          />
          <fieldset className="create-dialog-models">
            <legend>{t("create", "chooseModel")}</legend>
            <div className="create-dialog-model-grid">
              {ROOM_MODELS.map((candidate) => (
                <label
                  key={candidate.id}
                  className={`create-dialog-model ${model === candidate.id ? "create-dialog-model-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="room-model"
                    value={candidate.id}
                    checked={model === candidate.id}
                    onChange={() => setModel(candidate.id)}
                  />
                  <span className="create-dialog-model-name">{modelText[candidate.id].name}</span>
                  <span className="create-dialog-model-layout">
                    {roomLayouts[candidate.layout].label}
                  </span>
                  <span className="create-dialog-model-desc">{modelText[candidate.id].desc}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {error && (
            <p className="create-dialog-error" role="alert">
              {error}
            </p>
          )}
          <div className="create-dialog-actions">
            <button type="button" className="create-dialog-cancel" onClick={onClose} disabled={creating}>
              {t("common", "cancel")}
            </button>
            <button
              type="submit"
              className="create-dialog-submit"
              disabled={creating || !trimmed}
            >
              {creating ? t("create", "creating") : t("create", "create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
