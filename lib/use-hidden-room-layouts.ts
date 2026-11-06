"use client";

import { useEffect, useState } from "react";

// Hidden room-template ids, fetched once from the public endpoint. Used
// by client components that list templates (the creation dialog) so a
// template the owner hid in the admin never appears as a choice. While
// the list loads, nothing is hidden — the filter only tightens.
export function useHiddenRoomLayouts(): Set<string> {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  useEffect(() => {
    let cancelled = false;
    fetch("/api/room-templates/hidden")
      .then((res) => (res.ok ? res.json() : { hidden: [] }))
      .then((data) => {
        if (!cancelled && Array.isArray(data.hidden)) setHidden(new Set<string>(data.hidden));
      })
      .catch(() => {
        // Hidden list unavailable: show everything rather than breaking.
      });
    return () => {
      cancelled = true;
    };
  }, []);
  return hidden;
}
