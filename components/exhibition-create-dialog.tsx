"use client";

import { useState } from "react";
import { ROOM_MODELS, type RoomModelId } from "@/lib/rooms";
import { galleryLabel } from "@/lib/gallery-names";
import { useLocale, useT } from "@/lib/i18n";
import { useGalleryNames } from "@/lib/use-gallery-names";
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
  const { locale } = useLocale();
  // Gallery names in the visitor's language (admin renames included).
  const nameOverrides = useGalleryNames();
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
    sunlight: { name: galleryLabel("sunlight", locale, nameOverrides), desc: t("create", "modelSunlightDesc") },
    serpentine: { name: galleryLabel("serpentine", locale, nameOverrides), desc: t("create", "modelSerpentineDesc") },
    vitrine: { name: galleryLabel("vitrine", locale, nameOverrides), desc: t("create", "modelVitrineDesc") },
    loft: { name: galleryLabel("loft", locale, nameOverrides), desc: t("create", "modelLoftDesc") },
    halle: { name: galleryLabel("halle", locale, nameOverrides), desc: t("create", "modelHalleDesc") },
    arche: { name: galleryLabel("arche", locale, nameOverrides), desc: t("create", "modelArcheDesc") },
    musee: { name: galleryLabel("musee", locale, nameOverrides), desc: t("create", "modelMuseeDesc") },
    "claire-voie": { name: galleryLabel("claire-voie", locale, nameOverrides), desc: t("create", "modelClaireVoieDesc") },
    parquet: { name: galleryLabel("parquet", locale, nameOverrides), desc: t("create", "modelParquetDesc") },
    verriere: { name: galleryLabel("verriere", locale, nameOverrides), desc: t("create", "modelVerriereDesc") },
    pavillon: { name: galleryLabel("pavillon", locale, nameOverrides), desc: t("create", "modelPavillonDesc") },
    classique: { name: galleryLabel("classique", locale, nameOverrides), desc: t("create", "modelClassiqueDesc") },
    "atrium-blanc": { name: galleryLabel("atrium-blanc", locale, nameOverrides), desc: t("create", "modelAtriumBlancDesc") },
    patio: { name: galleryLabel("patio", locale, nameOverrides), desc: t("create", "modelPatioDesc") },
    escalier: { name: galleryLabel("escalier", locale, nameOverrides), desc: t("create", "modelEscalierDesc") },
    "salles-vertes": { name: galleryLabel("salles-vertes", locale, nameOverrides), desc: t("create", "modelSallesVertesDesc") },
    "couloir-sombre": { name: galleryLabel("couloir-sombre", locale, nameOverrides), desc: t("create", "modelCouloirSombreDesc") },
    "couloir-dore": { name: galleryLabel("couloir-dore", locale, nameOverrides), desc: t("create", "modelCouloirDoreDesc") },
    voutes: { name: galleryLabel("voutes", locale, nameOverrides), desc: t("create", "modelVoutesDesc") },
    courbes: { name: galleryLabel("courbes", locale, nameOverrides), desc: t("create", "modelCourbesDesc") },
    "atrium-lattes": { name: galleryLabel("atrium-lattes", locale, nameOverrides), desc: t("create", "modelAtriumLattesDesc") },
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
                    {galleryLabel(candidate.layout, locale, nameOverrides)}
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
