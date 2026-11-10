import type { SyntheticEvent } from "react";

// Fallback for a cover image that fails to load (stale URL, missing
// object): swap in the Lakisa cube on the dark tile instead of a black
// broken box. Guarded so a failing fallback does not loop.
export const COVER_FALLBACK_SRC = "/brand/lakisa-icon-blanc.svg";

export function handleCoverImageError(event: SyntheticEvent<HTMLImageElement>): void {
  const img = event.currentTarget;
  if (img.dataset.fallbackApplied) return;
  img.dataset.fallbackApplied = "true";
  img.src = COVER_FALLBACK_SRC;
  img.style.objectFit = "contain";
  img.style.padding = "18%";
  img.style.background = "#111111";
}
