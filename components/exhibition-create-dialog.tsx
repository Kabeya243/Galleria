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

  // Room names in the visitor's language (admin renames included).
  // The cards show the room's real image and its name only, no
  // description.
  const modelName: Record<RoomModelId, string> = {
    sunlight: galleryLabel("sunlight", locale, nameOverrides),
    serpentine: galleryLabel("serpentine", locale, nameOverrides),
    vitrine: galleryLabel("vitrine", locale, nameOverrides),
    loft: galleryLabel("loft", locale, nameOverrides),
    halle: galleryLabel("halle", locale, nameOverrides),
    arche: galleryLabel("arche", locale, nameOverrides),
    musee: galleryLabel("musee", locale, nameOverrides),
    "claire-voie": galleryLabel("claire-voie", locale, nameOverrides),
    parquet: galleryLabel("parquet", locale, nameOverrides),
    verriere: galleryLabel("verriere", locale, nameOverrides),
    pavillon: galleryLabel("pavillon", locale, nameOverrides),
    classique: galleryLabel("classique", locale, nameOverrides),
    "atrium-blanc": galleryLabel("atrium-blanc", locale, nameOverrides),
    patio: galleryLabel("patio", locale, nameOverrides),
    escalier: galleryLabel("escalier", locale, nameOverrides),
    "salles-vertes": galleryLabel("salles-vertes", locale, nameOverrides),
    "couloir-sombre": galleryLabel("couloir-sombre", locale, nameOverrides),
    "couloir-dore": galleryLabel("couloir-dore", locale, nameOverrides),
    voutes: galleryLabel("voutes", locale, nameOverrides),
    courbes: galleryLabel("courbes", locale, nameOverrides),
    "atrium-lattes": galleryLabel("atrium-lattes", locale, nameOverrides),
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
                  {/* The room's real entrance capture (public/gallery-thumbnails/<id>.jpg, taken from the room's entrance in 3D), one image per model, same files the galleries catalogue uses. */}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`/gallery-thumbnails/${candidate.id}.jpg`}
                    alt={`${modelName[candidate.id]} entrance view`}
                    width={640}
                    height={240}
                    className="create-dialog-model-image"
                    loading="lazy"
                  />
                  <span className="create-dialog-model-name">{modelName[candidate.id]}</span>
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
