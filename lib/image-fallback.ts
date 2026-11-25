import type { SyntheticEvent } from "react";

// Fallback for a cover image that fails to load (stale URL, missing
// object): swap in the Lakisa cube on the dark tile instead of a black
// broken box. Guarded so a failing fallback does not loop.
export const COVER_FALLBACK_SRC = "/brand/lakisa-icon-blanc.svg";

export function applyCoverFallback(img: HTMLImageElement): void {
  if (img.dataset.fallbackApplied) return;
  img.dataset.fallbackApplied = "true";
  img.src = COVER_FALLBACK_SRC;
  img.style.objectFit = "contain";
  img.style.padding = "18%";
  img.style.background = "#111111";
}

export function handleCoverImageError(event: SyntheticEvent<HTMLImageElement>): void {
  applyCoverFallback(event.currentTarget);
}

// Ref callback for cover <img> elements (use together with onError).
// A server-rendered image that 404s before React hydrates never fires
// onError — by mount time it is already complete with naturalWidth 0.
// The ref checks that state immediately and arms an error listener
// for images still loading, so the cube shows either way.
export function coverImageRef(img: HTMLImageElement | null): void {
  if (!img) return;
  if (img.complete && img.naturalWidth === 0) {
    applyCoverFallback(img);
    return;
  }
  img.addEventListener("error", () => applyCoverFallback(img), { once: true });
}
