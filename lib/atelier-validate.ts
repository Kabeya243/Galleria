// Validation for Atelier design documents — TypeScript mirror of the
// Python validator in api/atelier/export.py (itself adapted from
// Atelier app/services/documents.py). Both must stay in sync: the
// editor refuses invalid documents before they reach R2 or the export
// function, and the export function re-validates server-side.

export function validateAtelierDocument(document: unknown): string | null {
  if (!document || typeof document !== "object") return "Document invalide.";
  const pages = (document as { pages?: unknown }).pages ?? [document];
  if (!Array.isArray(pages) || pages.length < 1 || pages.length > 100) {
    return "Un projet doit contenir de 1 à 100 pages.";
  }
  for (const page of pages) {
    if (!page || typeof page !== "object") return "Format de page invalide.";
    for (const dimension of ["width", "height"] as const) {
      const value = Number((page as Record<string, unknown>)[dimension] ?? 1080);
      if (!Number.isFinite(value) || value < 1 || value > 6000) {
        return "Les dimensions doivent être comprises entre 1 et 6000 px.";
      }
    }
    for (const dimension of ["physicalWidthMm", "physicalHeightMm"] as const) {
      if (dimension in (page as Record<string, unknown>)) {
        const value = Number((page as Record<string, unknown>)[dimension]);
        if (!Number.isFinite(value) || value < 1 || value > 6000) {
          return "Les dimensions physiques sont hors limite.";
        }
      }
    }
    const objects = (page as { objects?: unknown }).objects ?? [];
    if (!Array.isArray(objects) || objects.length > 1000) {
      return "Chaque page accepte au maximum 1000 éléments.";
    }
    for (const obj of objects) {
      if (!obj || typeof obj !== "object") return "Élément de design invalide.";
      const o = obj as Record<string, unknown>;
      for (const [key, def] of [["left", 0], ["top", 0], ["width", 100], ["height", 100], ["scaleX", 1], ["scaleY", 1], ["angle", 0], ["opacity", 1]] as const) {
        const value = Number(o[key] ?? def);
        if (!Number.isFinite(value) || Math.abs(value) > 100000) return "Valeur de position ou de taille hors limite.";
        if ((key === "width" || key === "height") && !(value >= 1 && value <= 6000)) return "La taille d’un élément doit être comprise entre 1 et 6000 px.";
        if ((key === "scaleX" || key === "scaleY") && (value === 0 || Math.abs(value) > 100)) return "Échelle d’élément invalide.";
        if (key === "opacity" && !(value >= 0 && value <= 1)) return "L’opacité doit être comprise entre 0 et 100 %.";
      }
      if ("fontSize" in o) {
        const value = Number(o.fontSize);
        if (!Number.isFinite(value) || value < 1 || value > 2000) return "Taille de texte invalide.";
      }
      for (const key of ["brightness", "contrast", "saturation"] as const) {
        if (key in o && !(Number(o[key]) >= 0 && Number(o[key]) <= 2)) return "Réglage de filtre invalide.";
      }
      if ("text" in o && (typeof o.text !== "string" || o.text.length > 10000)) return "Le texte dépasse la longueur maximale.";
      if (o.src) {
        const source = o.src;
        if (typeof source !== "string" || source.length > 20 * 1024 * 1024) return "Source d’image invalide.";
        const uploadOk =
          /^\/api\/r2\/uploads\/[A-Za-z0-9_-]+\/[a-f0-9-]{36}\.(?:jpe?g|png|webp|svg)$/i.test(source) ||
          /^\/api\/atelier\/file\/atelier\/uploads\/[A-Za-z0-9_-]+\/[a-f0-9]{32}\.(?:jpe?g|png|webp|svg)$/i.test(source) ||
          /^https?:\/\/[^/]+\/uploads\/[A-Za-z0-9_-]+\/[a-f0-9-]{36}\.(?:jpe?g|png|webp|svg)$/i.test(source);
        const dataOk = /^data:image\/(?:png|jpe?g|webp|svg\+xml);base64,/i.test(source);
        if (!uploadOk && !dataOk) return "Les images doivent provenir de la bibliothèque Lakisa.";
      }
    }
  }
  return null;
}

export function isValidAtelierId(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && /^[A-Za-z0-9_-]+$/.test(id);
}
