"use client";

import { useEffect, useState } from "react";
import { useLocale } from "@/lib/i18n";
import {
  galleryLabel,
  type GalleryNamesMap,
} from "@/lib/gallery-names";
import type { RoomLayout } from "@/lib/rooms";

// Gallery-name overrides from the database (renames made by the owner
// in the admin dashboard), fetched once from the public endpoint. Used
// by client components that show a gallery name (the catalogue, the
// editor, the creation dialog) so a rename shows up everywhere. While
// the list loads, the code defaults apply — the fetch only tightens.
// A server page can pass its own map as `initial` so the first paint
// already carries the overrides.
let sharedFetch: Promise<GalleryNamesMap | null> | null = null;
let sharedResult: GalleryNamesMap | null = null;

function loadGalleryNames(): Promise<GalleryNamesMap | null> {
  if (sharedResult) return Promise.resolve(sharedResult);
  if (!sharedFetch) {
    sharedFetch = fetch("/api/gallery-names")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        const names = (data as { names?: GalleryNamesMap } | null)?.names;
        sharedResult = names ?? null;
        return sharedResult;
      })
      .catch(() => null);
  }
  return sharedFetch;
}

/** Name overrides from the database, or the initial map while loading. */
export function useGalleryNames(initial?: Partial<GalleryNamesMap>): Partial<GalleryNamesMap> {
  const [overrides, setOverrides] = useState<Partial<GalleryNamesMap>>(initial ?? {});
  useEffect(() => {
    let cancelled = false;
    // Refresh once so a rename made in another tab shows up without a
    // reload; a failed fetch simply keeps the initial map.
    loadGalleryNames().then((names) => {
      if (!cancelled && names) setOverrides(names);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  return overrides;
}

/** Display name for a gallery. Proper names never translate: the same name shows in every language. */
export function useGalleryLabel(layout: RoomLayout, initial?: Partial<GalleryNamesMap>): string {
  const { locale } = useLocale();
  const overrides = useGalleryNames(initial);
  return galleryLabel(layout, locale, overrides);
}
