"use client";

import { useState } from "react";
import { ROOM_MODELS, roomLayouts, type RoomModelId } from "@/lib/rooms";
import { useT } from "@/lib/i18n";
import { useHiddenRoomLayouts } from "@/lib/use-hidden-room-layouts";

// Create-exhibition dialog (feature 7): the title is mandatory and the
// visitor picks a room model for the first room — one of the
// twenty-one models (Sunlight Gallery first, the default). The model
// only seeds the first room — rooms can still be added in the editor
// afterwards.
export default function ExhibitionCreateDialog({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (title: string, model: RoomModelId) => Promise<void>;
}) {
  const t = useT();
  const [title, setTitle] = useState("");
  const [model, setModel] = useState<RoomModelId>("sunlight");
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = title.trim();

  // Models the owner hid in the admin are not offered. The selection
  // follows the first visible model if the chosen one is hidden.
  const hidden = useHiddenRoomLayouts();
  const visibleModels = ROOM_MODELS.filter((candidate) => !hidden.has(candidate.layout));
  const effectiveModel = visibleModels.some((candidate) => candidate.id === model)
    ? model
    : (visibleModels[0]?.id ?? "sunlight");

  const modelText: Record<RoomModelId, { name: string; desc: string }> = {
    sunlight: { name: t("create", "modelSunlight"), desc: t("create", "modelSunlightDesc") },
    serpentine: { name: t("create", "modelSerpentine"), desc: t("create", "modelSerpentineDesc") },
    vitrine: { name: t("create", "modelVitrine"), desc: t("create", "modelVitrineDesc") },
    loft: { name: t("create", "modelLoft"), desc: t("create", "modelLoftDesc") },
    halle: { name: t("create", "modelHalle"), desc: t("create", "modelHalleDesc") },
    arche: { name: t("create", "modelArche"), desc: t("create", "modelArcheDesc") },
    musee: { name: t("create", "modelMusee"), desc: t("create", "modelMuseeDesc") },
    "claire-voie": { name: t("create", "modelClaireVoie"), desc: t("create", "modelClaireVoieDesc") },
    parquet: { name: t("create", "modelParquet"), desc: t("create", "modelParquetDesc") },
    verriere: { name: t("create", "modelVerriere"), desc: t("create", "modelVerriereDesc") },
    pavillon: { name: t("create", "modelPavillon"), desc: t("create", "modelPavillonDesc") },
    classique: { name: t("create", "modelClassique"), desc: t("create", "modelClassiqueDesc") },
    "atrium-blanc": { name: t("create", "modelAtriumBlanc"), desc: t("create", "modelAtriumBlancDesc") },
    patio: { name: t("create", "modelPatio"), desc: t("create", "modelPatioDesc") },
    escalier: { name: t("create", "modelEscalier"), desc: t("create", "modelEscalierDesc") },
    "salles-vertes": { name: t("create", "modelSallesVertes"), desc: t("create", "modelSallesVertesDesc") },
    "couloir-sombre": { name: t("create", "modelCouloirSombre"), desc: t("create", "modelCouloirSombreDesc") },
    "couloir-dore": { name: t("create", "modelCouloirDore"), desc: t("create", "modelCouloirDoreDesc") },
    voutes: { name: t("create", "modelVoutes"), desc: t("create", "modelVoutesDesc") },
    courbes: { name: t("create", "modelCourbes"), desc: t("create", "modelCourbesDesc") },
    "atrium-lattes": { name: t("create", "modelAtriumLattes"), desc: t("create", "modelAtriumLattesDesc") },
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
      await onCreate(trimmed, effectiveModel);
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
              {visibleModels.map((candidate) => (
                <label
                  key={candidate.id}
                  className={`create-dialog-model ${effectiveModel === candidate.id ? "create-dialog-model-selected" : ""}`}
                >
                  <input
                    type="radio"
                    name="room-model"
                    value={candidate.id}
                    checked={effectiveModel === candidate.id}
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
